import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get('PLATFORM_JOB_SECRET') || '';
  const providedSecret = req.headers.get('x-platform-job-secret') || '';
  if (!expectedSecret || providedSecret !== expectedSecret) return json({ error: 'Trusted job authorization required' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: claims, error: claimError } = await admin.rpc('claim_project_delivery_cleanup', { p_limit: 50 });
  if (claimError) return json({ error: claimError.message }, 500);

  const results = [];
  for (const claim of claims || []) {
    try {
      const [{ data: delivery }, { count: activeHolds }, { data: items, error: itemError }] = await Promise.all([
        admin.from('project_deliveries').select('id, status, retention_expires_at').eq('id', claim.delivery_id).maybeSingle(),
        admin.from('project_delivery_holds').select('id', { count: 'exact', head: true }).eq('delivery_id', claim.delivery_id).eq('active', true),
        admin.from('project_delivery_items').select('id, object_path').eq('delivery_id', claim.delivery_id).eq('item_type', 'direct').eq('upload_status', 'uploaded'),
      ]);
      if (itemError) throw itemError;
      if (!delivery || delivery.status !== 'approved' || !delivery.retention_expires_at || new Date(delivery.retention_expires_at) > new Date()) {
        throw new Error('Delivery is no longer eligible for cleanup');
      }
      if (activeHolds) throw new Error('Delivery cleanup is blocked by an active hold');

      const paths = (items || []).map(item => item.object_path).filter(Boolean);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from('project-deliveries').remove(paths);
        if (removeError) throw removeError;
        const deletedAt = new Date().toISOString();
        const { error: updateItemError } = await admin.from('project_delivery_items')
          .update({ upload_status: 'deleted', deleted_at: deletedAt, deletion_error: null })
          .in('id', items.map(item => item.id));
        if (updateItemError) throw updateItemError;
      }

      const { error: deliveryError } = await admin.from('project_deliveries')
        .update({ status: 'archived', cleanup_claimed_at: null, cleanup_last_error: null })
        .eq('id', claim.delivery_id)
        .eq('status', 'approved');
      if (deliveryError) throw deliveryError;
      await admin.rpc('complete_project_delivery_event', {
        p_event_id: claim.event_id,
        p_succeeded: true,
        p_error: null,
      });
      results.push({ deliveryId: claim.delivery_id, deletedObjects: paths.length, status: 'cleaned' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all([
        admin.from('project_deliveries')
          .update({ cleanup_claimed_at: null, cleanup_last_error: message.slice(0, 2000) })
          .eq('id', claim.delivery_id),
        admin.rpc('complete_project_delivery_event', {
          p_event_id: claim.event_id,
          p_succeeded: false,
          p_error: message,
        }),
      ]);
      results.push({ deliveryId: claim.delivery_id, status: 'failed' });
    }
  }
  return json({ processed: results.length, results });
});
