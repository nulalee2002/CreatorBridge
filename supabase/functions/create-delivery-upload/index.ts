import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const BUCKET = 'project-deliveries';
const LIMIT_BYTES = 5_000_000_000;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/flac',
  'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
]);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function safeFileName(value: string) {
  const parts = String(value || 'deliverable').normalize('NFKC').split('.');
  const ext = parts.length > 1 ? `.${parts.pop()!.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}` : '';
  const stem = parts.join('.').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `${stem || 'deliverable'}${ext.toLowerCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { projectId, deliveryDraftId, fileName, contentType, sizeBytes } = await req.json();
    const bytes = Number(sizeBytes);
    if (!projectId || !fileName || !ALLOWED_TYPES.has(String(contentType || '').toLowerCase())) {
      return json({ error: 'Project, file name, and an approved final-deliverable type are required' }, 400);
    }
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > LIMIT_BYTES) {
      return json({ error: 'File size must be between 1 byte and 5 GB' }, 400);
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
      .select('id, accepted_creator_id, status')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return json({ error: 'Project not found' }, 404);
    const { data: creator } = await admin
      .from('creator_listings')
      .select('id, user_id')
      .eq('id', project.accepted_creator_id)
      .maybeSingle();
    if (creator?.user_id !== authData.user.id) return json({ error: 'Only the accepted creator can upload delivery files' }, 403);
    if (!['retainer_paid', 'in_progress', 'revision', 'delivered'].includes(project.status)) {
      return json({ error: 'Project is not ready for delivery' }, 409);
    }

    let draft;
    if (deliveryDraftId) {
      const { data, error } = await admin
        .from('project_deliveries')
        .select('id, project_id, creator_user_id, status')
        .eq('id', deliveryDraftId)
        .maybeSingle();
      if (error) throw error;
      draft = data;
    } else {
      const { data, error } = await admin
        .from('project_deliveries')
        .insert({ project_id: project.id, creator_user_id: authData.user.id })
        .select('id, project_id, creator_user_id, status')
        .single();
      if (error) throw error;
      draft = data;
    }
    if (!draft || draft.project_id !== project.id || draft.creator_user_id !== authData.user.id || draft.status !== 'draft') {
      return json({ error: 'Delivery draft is not available' }, 409);
    }

    const itemId = crypto.randomUUID();
    const objectPath = `${project.id}/${draft.id}/${itemId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
    const { error: itemError } = await admin.from('project_delivery_items').insert({
      id: itemId,
      delivery_id: draft.id,
      item_type: 'direct',
      label: String(fileName).slice(0, 240),
      original_file_name: String(fileName).slice(0, 240),
      content_type: String(contentType).toLowerCase(),
      size_bytes: bytes,
      bucket: BUCKET,
      object_path: objectPath,
    });
    if (itemError) {
      const status = itemError.message?.includes('Direct delivery limit exceeded') ? 413 : 400;
      return json({ error: itemError.message || 'Upload item could not be reserved' }, status);
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signedError || !signed?.token) {
      await admin.from('project_delivery_items')
        .update({ upload_status: 'failed', deletion_error: signedError?.message || 'Signed upload unavailable' })
        .eq('id', itemId);
      throw signedError || new Error('Signed upload could not be created');
    }

    const projectUrl = new URL(Deno.env.get('SUPABASE_URL') ?? 'https://invalid.local');
    const storageHost = projectUrl.hostname.replace('.supabase.co', '.storage.supabase.co');
    return json({
      deliveryDraftId: draft.id,
      itemId,
      bucket: BUCKET,
      objectPath,
      signedUploadToken: signed.token,
      signedUploadUrl: signed.signedUrl,
      tusEndpoint: `https://${storageHost}/storage/v1/upload/resumable`,
    });
  } catch (error) {
    console.error('create-delivery-upload error:', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'Upload could not be prepared' }, 500);
  }
});
