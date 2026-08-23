import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function sendEmail(admin: ReturnType<typeof createClient>, event: Record<string, any>, template: string) {
  const { data: client } = await admin.auth.admin.getUserById(event.client_id);
  if (!client?.user?.email) return;
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
    },
    body: JSON.stringify({
      to: client.user.email,
      template,
      data: {
        project_title: event.project_title,
        review_deadline: event.review_deadline_at,
      },
    }),
  });
  if (!response.ok) throw new Error(`Review email provider returned ${response.status}`);
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get('PLATFORM_JOB_SECRET') || '';
  const providedSecret = req.headers.get('x-platform-job-secret') || '';
  if (!expectedSecret || providedSecret !== expectedSecret) return json({ error: 'Trusted job authorization required' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: events, error: claimError } = await admin.rpc('claim_project_review_events', { p_limit: 50 });
  if (claimError) return json({ error: claimError.message }, 500);

  const results = [];
  for (const event of events || []) {
    try {
      if (event.event_type === 'auto_approve') {
        const { data: delivery, error } = await admin.rpc('complete_project_delivery_auto_approval', {
          p_event_id: event.event_id,
          p_delivery_id: event.delivery_id,
        });
        if (error) throw error;
        const notifications = await Promise.allSettled([
          admin.rpc('create_platform_notification', {
            p_recipient_id: event.client_id,
            p_type: 'system',
            p_title: 'Review window completed',
            p_body: 'The five-day review window ended without a revision or dispute. CreatorBridge is attempting the final payment.',
            p_action_url: `/projects?project=${event.project_id}`,
            p_metadata: { project_id: event.project_id, delivery_id: event.delivery_id },
            p_actor_id: null,
            p_response_due_at: null,
          }),
          admin.rpc('create_platform_notification', {
            p_recipient_id: event.creator_user_id,
            p_type: 'system',
            p_title: 'Delivery automatically approved',
            p_body: 'The review window ended without a revision or dispute. Final payment processing is starting.',
            p_action_url: `/projects?project=${event.project_id}`,
            p_metadata: { project_id: event.project_id, delivery_id: event.delivery_id },
            p_actor_id: null,
            p_response_due_at: null,
          }),
          sendEmail(admin, event, 'delivery_auto_approved'),
        ]);
        for (const notification of notifications) {
          if (notification.status === 'rejected') {
            console.error('Auto-approval notification failed:', notification.reason);
          }
        }
        results.push({ eventId: event.event_id, status: 'approved', deliveryId: delivery.id });
        continue;
      }

      const [{ data: delivery }, { count: activeHolds }] = await Promise.all([
        admin.from('project_deliveries')
          .select('status, review_deadline_at')
          .eq('id', event.delivery_id)
          .maybeSingle(),
        admin.from('project_delivery_holds')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_id', event.delivery_id)
          .eq('active', true),
      ]);
      if (!delivery || delivery.status !== 'under_review' || activeHolds) {
        throw new Error('Delivery is no longer eligible for a review reminder');
      }

      const is48Hour = event.event_type === 'reminder_48h';
      await Promise.all([
        admin.rpc('create_platform_notification', {
          p_recipient_id: event.client_id,
          p_type: 'system',
          p_title: is48Hour ? 'Two days left to review delivery' : 'One day left to review delivery',
          p_body: 'Approve, request a revision, or open a dispute before the review deadline.',
          p_action_url: `/projects?project=${event.project_id}`,
          p_metadata: { project_id: event.project_id, delivery_id: event.delivery_id },
          p_actor_id: null,
          p_response_due_at: event.review_deadline_at,
        }),
        sendEmail(admin, event, is48Hour ? 'delivery_review_48h' : 'delivery_review_24h'),
        admin.from('project_deliveries').update({
          [is48Hour ? 'reminder_48h_sent_at' : 'reminder_24h_sent_at']: new Date().toISOString(),
        }).eq('id', event.delivery_id).eq('status', 'under_review'),
      ]);
      const { error: completeError } = await admin.rpc('complete_project_delivery_event', {
        p_event_id: event.event_id,
        p_succeeded: true,
        p_error: null,
      });
      if (completeError) throw completeError;
      results.push({ eventId: event.event_id, status: 'reminded' });
    } catch (error) {
      await admin.rpc('complete_project_delivery_event', {
        p_event_id: event.event_id,
        p_succeeded: false,
        p_error: error instanceof Error ? error.message : String(error),
      });
      results.push({ eventId: event.event_id, status: 'failed' });
    }
  }

  return json({ processed: results.length, results });
});
