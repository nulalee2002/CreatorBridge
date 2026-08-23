import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { renderAndStoreContractPdf } from '../_shared/contractPdfStorage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const rateLimited = await checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const { projectId, contractId } = await req.json();
    if (!projectId && !contractId) return json({ error: 'projectId or contractId is required' }, 400);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: authData, error: authError } = token
      ? await admin.auth.getUser(token)
      : { data: { user: null }, error: new Error('Missing authorization token') };
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);

    let query = admin.from('contracts').select('id,project_id,client_id,creator_user_id,status');
    query = contractId ? query.eq('id', contractId) : query.eq('project_id', projectId);
    const { data: contract, error: contractError } = await query.maybeSingle();
    if (contractError || !contract) return json({ error: 'Contract not found' }, 404);
    if (![contract.client_id, contract.creator_user_id].includes(authData.user.id)) {
      return json({ error: 'Contract access denied' }, 403);
    }
    if (contract.status === 'void') return json({ error: 'A void contract cannot be generated' }, 409);

    const updated = await renderAndStoreContractPdf(admin, req, contract.id);
    if (contract.status === 'draft') {
      const metadata = { project_id: contract.project_id, contract_id: contract.id };
      await Promise.all([
        admin.rpc('create_platform_notification', {
          p_recipient_id: contract.client_id,
          p_type: 'contract_ready',
          p_title: 'Your production agreement is ready',
          p_body: 'Review and sign the agreement before paying the retainer.',
          p_action_url: '/projects',
          p_metadata: metadata,
          p_actor_id: contract.creator_user_id,
          p_response_due_at: null,
        }),
        admin.rpc('create_platform_notification', {
          p_recipient_id: contract.creator_user_id,
          p_type: 'contract_ready',
          p_title: 'A production agreement is ready',
          p_body: 'Review and sign the agreement. Work begins only after both signatures and the retainer.',
          p_action_url: '/projects',
          p_metadata: metadata,
          p_actor_id: contract.client_id,
          p_response_due_at: null,
        }),
      ]);
    }
    return json({ contract: updated });
  } catch (error) {
    console.error('generate-contract error:', error);
    return json({ error: error instanceof Error ? error.message : 'Contract generation failed' }, 500);
  }
});
