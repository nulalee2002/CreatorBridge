import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import {
  classifyFinalPaymentIntent,
  expectedFinalChargeCents,
  finalPaymentAttemptKey,
  validateFinalPaymentIntent,
} from '../_shared/finalPaymentPolicy.js';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-platform-job-secret',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function stripeFailure(error: any) {
  const intent = error?.payment_intent || error?.raw?.payment_intent || null;
  return {
    code: error?.code || error?.decline_code || intent?.last_payment_error?.code || 'final_payment_failed',
    message: error?.message || intent?.last_payment_error?.message || 'The saved payment method could not complete the final payment.',
    intent,
    requiresAction: intent?.status === 'requires_action' || error?.code === 'authentication_required',
  };
}

async function notifyAttention(admin: ReturnType<typeof createClient>, txn: Record<string, any>, message: string) {
  const [{ data: project }, { data: client }] = await Promise.all([
    admin.from('projects').select('title').eq('id', txn.project_id).maybeSingle(),
    admin.auth.admin.getUserById(txn.client_id),
  ]);
  await Promise.allSettled([
    admin.rpc('create_platform_notification', {
      p_recipient_id: txn.client_id,
      p_type: 'payment',
      p_title: 'Final payment needs attention',
      p_body: message,
      p_action_url: `/projects?project=${txn.project_id}`,
      p_metadata: { project_id: txn.project_id, transaction_id: txn.id },
      p_actor_id: null,
      p_response_due_at: null,
    }),
    client?.user?.email
      ? fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
          },
          body: JSON.stringify({
            to: client.user.email,
            template: 'final_payment_attention',
            data: { project_title: project?.title || 'your project', payment_message: message },
          }),
        })
      : Promise.resolve(),
  ]);
}

async function setAttention(
  admin: ReturnType<typeof createClient>,
  txn: Record<string, any>,
  jobId: string | null,
  failure: { code: string; message: string; requiresAction?: boolean; intent?: any },
) {
  const now = new Date().toISOString();
  await Promise.all([
    admin.from('transactions').update({
      final_status: 'attention',
      final_payment_intent: failure.intent?.id || txn.final_payment_intent || null,
      final_payment_error_code: failure.code,
      final_payment_error_message: failure.message,
      final_payment_requires_action: Boolean(failure.requiresAction),
      final_payment_attention_at: now,
      final_payment_attempted_at: now,
      updated_at: now,
    }).eq('id', txn.id).not('final_status', 'in', '(paid,released)'),
    admin.from('projects').update({ status: 'final_payment_attention' }).eq('id', txn.project_id),
    jobId
      ? admin.rpc('complete_project_final_payment_job', { p_job_id: jobId, p_status: 'attention', p_error: failure.message })
      : Promise.resolve(),
  ]);
  await notifyAttention(admin, txn, failure.message);
}

async function markProcessing(
  admin: ReturnType<typeof createClient>,
  txn: Record<string, any>,
  jobId: string | null,
  paymentIntentId: string,
) {
  const now = new Date().toISOString();
  await Promise.all([
    admin.from('transactions').update({
      final_status: 'processing',
      final_payment_intent: paymentIntentId,
      final_payment_error_code: null,
      final_payment_error_message: null,
      final_payment_requires_action: false,
      final_payment_attention_at: null,
      final_payment_attempted_at: now,
      updated_at: now,
    }).eq('id', txn.id).not('final_status', 'in', '(paid,released)'),
    admin.from('projects').update({ status: 'final_payment_processing' }).eq('id', txn.project_id),
    jobId
      ? admin.rpc('complete_project_final_payment_job', { p_job_id: jobId, p_status: 'processing', p_error: null })
      : Promise.resolve(),
  ]);
}

async function processTransaction(
  admin: ReturnType<typeof createClient>,
  txn: Record<string, any>,
  jobId: string | null,
  recovery: boolean,
) {
  if (['paid', 'released'].includes(txn.final_status)) {
    if (jobId) await admin.rpc('complete_project_final_payment_job', { p_job_id: jobId, p_status: 'complete', p_error: null });
    return { transactionId: txn.id, status: txn.final_status };
  }
  if (!['paid', 'released'].includes(txn.retainer_status)) throw new Error('Retainer payment is not complete');

  const { data: approvedDelivery } = await admin.from('project_deliveries')
    .select('id').eq('project_id', txn.project_id).eq('status', 'approved').limit(1).maybeSingle();
  if (!approvedDelivery) throw new Error('Final delivery has not been approved');

  const expectedAmount = expectedFinalChargeCents(txn);

  if (txn.final_payment_intent) {
    const existing = await stripe.paymentIntents.retrieve(txn.final_payment_intent);
    validateFinalPaymentIntent(existing, txn);
    const existingPolicy = classifyFinalPaymentIntent(existing);
    if (existingPolicy.state === 'processing') {
      await markProcessing(admin, txn, jobId, existing.id);
      return { transactionId: txn.id, paymentIntentId: existing.id, status: 'processing' };
    }
    if (existing.status === 'requires_action') {
      await setAttention(admin, txn, jobId, {
        code: 'authentication_required',
        message: 'Stripe needs the client to authenticate the final payment.',
        requiresAction: true,
        intent: existing,
      });
      return {
        transactionId: txn.id,
        status: 'requires_action',
        ...(recovery ? { clientSecret: existing.client_secret } : {}),
      };
    }
  }

  if (recovery) {
    const recoveryIntent = await stripe.paymentIntents.create({
      amount: expectedAmount,
      currency: 'usd',
      customer: txn.stripe_customer_id || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        projectId: String(txn.project_id), transactionId: txn.id,
        creatorId: String(txn.creator_id), clientId: String(txn.client_id),
        paymentType: 'final', paymentFlow: 'platform_charge_then_transfer', recovery: 'true',
      },
    }, { idempotencyKey: `cb_final_recovery_${txn.id}_${Number(txn.final_payment_attempt_count || 0) + 1}` });
    await admin.from('transactions').update({
      final_status: 'attention',
      final_payment_intent: recoveryIntent.id,
      final_payment_requires_action: true,
      final_payment_attempt_count: Number(txn.final_payment_attempt_count || 0) + 1,
      final_payment_attempted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', txn.id).not('final_status', 'in', '(paid,released)');
    return { transactionId: txn.id, status: 'requires_action', clientSecret: recoveryIntent.client_secret };
  }

  if (!txn.stripe_customer_id || !txn.client_payment_method_id || !txn.payment_method_consent_at) {
    const failure = {
      code: 'payment_method_required',
      message: 'A payment method is needed to complete the final project balance.',
      requiresAction: true,
    };
    await setAttention(admin, txn, jobId, failure);
    return { transactionId: txn.id, status: 'attention', code: failure.code };
  }

  const attempt = Number(txn.final_payment_attempt_count || 0) + 1;
  await admin.from('transactions').update({
    final_payment_attempt_count: attempt,
    final_payment_attempted_at: new Date().toISOString(),
    final_status: 'processing',
    updated_at: new Date().toISOString(),
  }).eq('id', txn.id).not('final_status', 'in', '(paid,released)');

  try {
    const intent = await stripe.paymentIntents.create({
      amount: expectedAmount,
      currency: 'usd',
      customer: txn.stripe_customer_id,
      payment_method: txn.client_payment_method_id,
      off_session: true,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        projectId: String(txn.project_id), transactionId: txn.id,
        creatorId: String(txn.creator_id), clientId: String(txn.client_id),
        paymentType: 'final', paymentFlow: 'platform_charge_then_transfer',
      },
    }, { idempotencyKey: finalPaymentAttemptKey(txn.id, attempt) });
    validateFinalPaymentIntent(intent, txn);
    const policy = classifyFinalPaymentIntent(intent);
    if (policy.state === 'attention') {
      await setAttention(admin, txn, jobId, {
        code: 'authentication_required', message: 'Stripe needs the client to authenticate the final payment.',
        requiresAction: policy.requiresAction, intent,
      });
      return { transactionId: txn.id, status: 'requires_action' };
    }
    await markProcessing(admin, txn, jobId, intent.id);
    return { transactionId: txn.id, paymentIntentId: intent.id, status: 'processing' };
  } catch (error) {
    const failure = stripeFailure(error);
    await setAttention(admin, txn, jobId, failure);
    return { transactionId: txn.id, status: 'attention', code: failure.code };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const expectedSecret = Deno.env.get('PLATFORM_JOB_SECRET') || '';
  const suppliedSecret = req.headers.get('x-platform-job-secret') || '';
  const isTrustedJob = Boolean(expectedSecret && suppliedSecret === expectedSecret);
  const body = await req.json().catch(() => ({}));

  if (isTrustedJob) {
    const { data: jobs, error } = await admin.rpc('claim_project_final_payment_jobs', { p_limit: 25 });
    if (error) return json({ error: error.message }, 500);
    const results = [];
    for (const job of jobs || []) {
      try {
        const { data: txn, error: txnError } = await admin.from('transactions').select('*').eq('id', job.transaction_id).single();
        if (txnError) throw txnError;
        results.push(await processTransaction(admin, txn, job.job_id, false));
      } catch (error) {
        await admin.rpc('complete_project_final_payment_job', {
          p_job_id: job.job_id, p_status: 'attention', p_error: error instanceof Error ? error.message : String(error),
        });
        results.push({ transactionId: job.transaction_id, status: 'attention' });
      }
    }
    return json({ processed: results.length, results });
  }

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const { data: authData, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: new Error('Missing authorization token') };
  if (authError || !authData.user || !body.projectId) return json({ error: 'Client authentication is required' }, 403);

  const { data: txn, error: txnError } = await admin.from('transactions').select('*')
    .eq('project_id', body.projectId).eq('client_id', authData.user.id).maybeSingle();
  if (txnError || !txn) return json({ error: 'Project payment could not be found' }, 404);

  try {
    return json(await processTransaction(admin, txn, null, body.recovery === true));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 409);
  }
});
