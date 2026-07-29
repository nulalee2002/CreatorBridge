import { reduceIdentityOutcome } from './identityWebhookPolicy.js';

const handledEvents = new Set([
  'identity.verification_session.verified',
  'identity.verification_session.requires_input',
  'identity.verification_session.canceled',
  'identity.verification_session.redacted',
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function isIdentityEventType(eventType) {
  return handledEvents.has(eventType);
}

export async function processIdentityEvent({ event, stripe, admin }) {
  const sessionFromEvent = event.data.object;
  const providerSessionId = sessionFromEvent?.id || null;
  let claimed = false;

  try {
    const { data: claim, error: claimError } = await admin.rpc('claim_identity_provider_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_provider_session_id: providerSessionId,
    });
    if (claimError) throw claimError;
    claimed = claim === true;
    if (!claimed) return json({ received: true, idempotent: true });

    if (!handledEvents.has(event.type)) {
      await admin
        .from('identity_provider_events')
        .update({ processing_status: 'ignored', processed_at: new Date().toISOString() })
        .eq('event_id', event.id);
      return json({ received: true, ignored: true });
    }
    if (!providerSessionId) throw new Error('Identity session reference is missing.');

    const { data: verification, error: verificationError } = await admin
      .from('identity_verifications')
      .select('id,user_id,provider_session_id,status,attempt_count')
      .eq('provider_session_id', providerSessionId)
      .maybeSingle();
    if (verificationError || !verification) {
      throw verificationError || new Error('Identity verification record was not found.');
    }

    const session = await stripe.identity.verificationSessions.retrieve(providerSessionId);
    if (event.type !== 'identity.verification_session.redacted' && (
      session.client_reference_id !== verification.user_id
      || session.metadata?.user_id !== verification.user_id
    )) {
      const now = new Date().toISOString();
      await admin
        .from('identity_verifications')
        .update({
          status: 'manual_review',
          risk_label: 'account_inconsistency',
          review_reason: 'Provider session account reference did not match.',
          provider_error_code: 'ACCOUNT_REFERENCE_MISMATCH',
          verified_at: null,
          updated_at: now,
        })
        .eq('id', verification.id);
      await admin
        .from('identity_provider_events')
        .update({ processing_status: 'processed', processed_at: now })
        .eq('event_id', event.id);
      return json({ received: true, reviewRequired: true });
    }

    let report = null;
    if (event.type === 'identity.verification_session.verified') {
      const reportRef = session.last_verification_report;
      if (typeof reportRef === 'string') {
        report = await stripe.identity.verificationReports.retrieve(reportRef);
      } else if (reportRef && typeof reportRef === 'object') {
        report = reportRef;
      }
    }

    const now = new Date();
    const outcome = reduceIdentityOutcome({
      eventType: event.type,
      session,
      report,
      attemptCount: verification.attempt_count,
      now,
    });
    const { error: updateError } = await admin
      .from('identity_verifications')
      .update({
        ...outcome,
        updated_at: now.toISOString(),
      })
      .eq('id', verification.id)
      .eq('provider_session_id', providerSessionId);
    if (updateError) throw updateError;

    await admin
      .from('identity_provider_events')
      .update({
        processing_status: 'processed',
        processing_error: null,
        processed_at: now.toISOString(),
      })
      .eq('event_id', event.id);

    await admin.rpc('create_platform_notification', {
      p_recipient_id: verification.user_id,
      p_type: outcome.status === 'verified' ? 'identity_verified' : 'identity_action_required',
      p_title: outcome.status === 'verified' ? 'Identity verified' : 'Identity check needs attention',
      p_body: outcome.status === 'verified'
        ? 'Your identity is verified for protected CreatorBridge actions.'
        : outcome.review_reason || 'Open CreatorBridge to review the secure next step.',
      p_action_url: outcome.status === 'verified' ? '/projects' : '/verification/identity/return',
      p_metadata: { identity_status: outcome.status },
      p_actor_id: null,
      p_response_due_at: null,
    });

    return json({ received: true, status: outcome.status });
  } catch (error) {
    if (claimed) {
      await admin
        .from('identity_provider_events')
        .update({
          processing_status: 'failed',
          processing_error: 'PROCESSING_FAILED',
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', event.id);
    }
    console.error('identity event processing failed:', event.id, error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'Identity webhook processing failed.' }, 500);
  }
}
