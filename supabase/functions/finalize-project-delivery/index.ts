import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const BUCKET = 'project-deliveries';
const LIMIT_BYTES = 5_000_000_000;
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function normalizeExternalUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw || /^(javascript|data|file):/i.test(raw)) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return '';
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

async function verifyUploadedObject(admin: ReturnType<typeof createClient>, item: Record<string, any>) {
  const slash = item.object_path.lastIndexOf('/');
  const folder = item.object_path.slice(0, slash);
  const fileName = item.object_path.slice(slash + 1);
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 10, search: fileName });
  if (error) throw error;
  const object = (data || []).find(candidate => candidate.name === fileName);
  const actualSize = Number(object?.metadata?.size ?? -1);
  if (!object || actualSize !== Number(item.size_bytes)) {
    throw new Error(`Upload verification failed for ${item.original_file_name || item.label}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { projectId, deliveryDraftId, note, idempotencyKey, externalItems = [] } = await req.json();
    if (!projectId || String(idempotencyKey || '').trim().length < 8) {
      return json({ error: 'Project and a valid idempotency key are required' }, 400);
    }
    if (!Array.isArray(externalItems) || externalItems.length > 50) {
      return json({ error: 'External delivery links are invalid' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id, title, client_id, accepted_creator_id, status')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return json({ error: 'Project not found' }, 404);
    const { data: creator } = await admin
      .from('creator_listings')
      .select('id, user_id, name')
      .eq('id', project.accepted_creator_id)
      .maybeSingle();
    if (creator?.user_id !== authData.user.id) return json({ error: 'Only the accepted creator can finalize delivery' }, 403);

    const cleanIdempotencyKey = String(idempotencyKey).trim().slice(0, 200);
    const { data: existing } = await admin
      .from('project_deliveries')
      .select('id, version, review_deadline_at')
      .eq('project_id', project.id)
      .eq('creator_user_id', authData.user.id)
      .eq('idempotency_key', cleanIdempotencyKey)
      .maybeSingle();
    if (existing) {
      return json({
        deliveryId: existing.id,
        version: existing.version,
        reviewDeadlineAt: existing.review_deadline_at,
        reused: true,
      });
    }

    let activeDraftId = deliveryDraftId;
    if (!activeDraftId && externalItems.length) {
      const { data: createdDraft, error: createDraftError } = await admin
        .from('project_deliveries')
        .insert({ project_id: project.id, creator_user_id: authData.user.id })
        .select('id')
        .single();
      if (createDraftError) throw createDraftError;
      activeDraftId = createdDraft.id;
    }
    if (!activeDraftId) return json({ error: 'Add at least one finished deliverable before submitting' }, 400);

    const { data: draft, error: draftError } = await admin
      .from('project_deliveries')
      .select('id, project_id, creator_user_id, status')
      .eq('id', activeDraftId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft || draft.project_id !== project.id || draft.creator_user_id !== authData.user.id || draft.status !== 'draft') {
      return json({ error: 'Delivery draft is not available' }, 409);
    }

    const { data: currentExternalItems } = await admin
      .from('project_delivery_items')
      .select('external_url')
      .eq('delivery_id', draft.id)
      .eq('item_type', 'external');
    const currentExternalUrls = new Set((currentExternalItems || []).map(item => item.external_url));

    for (const external of externalItems) {
      const url = normalizeExternalUrl(external?.url);
      const label = String(external?.label || '').trim().slice(0, 240);
      if (!url || !label) return json({ error: 'Every external item needs a label and secure HTTPS URL' }, 400);
      if (currentExternalUrls.has(url)) continue;
      const { error } = await admin.from('project_delivery_items').insert({
        delivery_id: draft.id,
        item_type: 'external',
        label,
        external_url: url,
        size_bytes: 0,
        upload_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw error;
      currentExternalUrls.add(url);
    }

    const { data: items, error: itemsError } = await admin
      .from('project_delivery_items')
      .select('*')
      .eq('delivery_id', draft.id);
    if (itemsError) throw itemsError;
    if (!items?.length) return json({ error: 'Add at least one finished deliverable before submitting' }, 400);
    const directItems = items.filter(item => item.item_type === 'direct');
    const directBytes = directItems.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    if (directBytes > LIMIT_BYTES) return json({ error: 'Direct delivery files exceed the combined 5 GB limit' }, 413);

    for (const item of directItems) await verifyUploadedObject(admin, item);
    if (directItems.length) {
      const { error } = await admin.from('project_delivery_items')
        .update({ upload_status: 'uploaded', uploaded_at: new Date().toISOString() })
        .in('id', directItems.map(item => item.id))
        .eq('upload_status', 'pending');
      if (error) throw error;
    }

    const { data: delivery, error: finalizeError } = await admin.rpc('finalize_project_delivery', {
      p_project_id: project.id,
      p_delivery_id: draft.id,
      p_creator_user_id: authData.user.id,
      p_note: String(note || '').trim().slice(0, 5000),
      p_idempotency_key: cleanIdempotencyKey,
    });
    if (finalizeError) throw finalizeError;

    try {
      const { data: clientUser } = await admin.auth.admin.getUserById(project.client_id);
      if (clientUser?.user?.email) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
          },
          body: JSON.stringify({
            to: clientUser.user.email,
            template: 'delivery_submitted',
            data: { project_title: project.title, creator_name: creator.name || 'Creator' },
          }),
        });
      }
    } catch (emailError) {
      console.error('Delivery email dispatch failed:', emailError instanceof Error ? emailError.message : emailError);
    }

    return json({
      deliveryId: delivery.id,
      version: delivery.version,
      reviewDeadlineAt: delivery.review_deadline_at,
    });
  } catch (error) {
    console.error('finalize-project-delivery error:', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'Delivery could not be finalized' }, 500);
  }
});
