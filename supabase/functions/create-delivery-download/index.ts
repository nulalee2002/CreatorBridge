import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { deliveryItemId } = await req.json();
    if (!deliveryItemId) return json({ error: 'Delivery item is required' }, 400);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);

    const { data: item, error: itemError } = await admin
      .from('project_delivery_items')
      .select('*')
      .eq('id', deliveryItemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return json({ error: 'Delivery item not found' }, 404);
    const { data: delivery, error: deliveryError } = await admin
      .from('project_deliveries')
      .select('id, project_id, status, retention_expires_at')
      .eq('id', item.delivery_id)
      .maybeSingle();
    if (deliveryError || !delivery) return json({ error: 'Delivery not found' }, 404);
    const { data: project } = await admin
      .from('projects')
      .select('client_id, accepted_creator_id')
      .eq('id', delivery.project_id)
      .maybeSingle();
    const { data: creator } = await admin
      .from('creator_listings')
      .select('user_id')
      .eq('id', project?.accepted_creator_id)
      .maybeSingle();
    const { data: adminRow } = await admin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (!project || (![project.client_id, creator?.user_id].includes(authData.user.id) && !adminRow)) {
      return json({ error: 'Project party access required' }, 403);
    }

    const { count: activeHolds } = await admin
      .from('project_delivery_holds')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_id', delivery.id)
      .eq('active', true);
    const expired = delivery.retention_expires_at
      && new Date(delivery.retention_expires_at).getTime() <= Date.now()
      && !activeHolds;
    if (item.upload_status === 'deleted' || expired) {
      return json({ error: 'This CreatorBridge-hosted file has reached the end of its retention window' }, 410);
    }

    if (item.item_type === 'external') {
      return json({ signedUrl: item.external_url, expiresAt: null, external: true });
    }
    if (item.upload_status !== 'uploaded' || !item.bucket || !item.object_path) {
      return json({ error: 'Delivery upload is not available' }, 409);
    }

    const expiresIn = 900;
    const { data, error } = await admin.storage
      .from(item.bucket)
      .createSignedUrl(item.object_path, expiresIn, { download: item.original_file_name || item.label });
    if (error || !data?.signedUrl) throw error || new Error('Signed download could not be created');
    return json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      external: false,
    });
  } catch (error) {
    console.error('create-delivery-download error:', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'Download could not be prepared' }, 500);
  }
});
