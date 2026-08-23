import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { parsePngDataUrl, parseStorageReference, renderAndStoreContractPdf } from '../_shared/contractPdfStorage.ts';

const CONSENT_TEXT = 'By signing, I agree this electronic signature is legally binding and I have authority to enter this agreement.';
const METHODS = new Set(['drawn', 'typed', 'saved']);
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

function auditIp(req: Request) {
  const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  return /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null;
}

async function bytesForSavedSignature(admin: any, savedSignatureId: string, userId: string) {
  const { data: saved, error } = await admin
    .from('saved_signatures')
    .select('id,user_id,signature_image_ref')
    .eq('id', savedSignatureId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !saved) throw new Error('Saved signature not found');
  const parsed = parseStorageReference(saved.signature_image_ref);
  if (!parsed || parsed.bucket !== 'signatures') throw new Error('Saved signature reference is invalid');
  const { data: file, error: fileError } = await admin.storage.from(parsed.bucket).download(parsed.path);
  if (fileError || !file) throw new Error('Saved signature image could not be loaded');
  return new Uint8Array(await file.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const rateLimited = await checkRateLimit(req, { maxRequests: 8, windowMs: 60_000, failClosed: true });
  if (rateLimited) return rateLimited;

  try {
    const {
      contractId,
      signerName,
      method,
      signatureDataUrl,
      savedSignatureId,
      saveSignature = false,
      signedContentHash,
      consentText,
    } = await req.json();
    if (!contractId || !signerName || !METHODS.has(method)) return json({ error: 'Complete signature details are required' }, 400);
    if (String(signerName).trim().length < 2 || String(signerName).trim().length > 160) return json({ error: 'Enter your legal name' }, 400);
    if (consentText !== CONSENT_TEXT) return json({ error: 'Electronic signature consent is required' }, 400);

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

    const { data: contract, error: contractError } = await admin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .maybeSingle();
    if (contractError || !contract) return json({ error: 'Contract not found' }, 404);
    const signerRole = authData.user.id === contract.client_id
      ? 'client'
      : authData.user.id === contract.creator_user_id
        ? 'creator'
        : null;
    if (!signerRole) return json({ error: 'Only the contract parties can sign' }, 403);
    if (contract.status === 'void') return json({ error: 'A void agreement cannot be signed' }, 409);
    if (signedContentHash !== contract.content_hash) return json({ error: 'The agreement changed. Review the latest version before signing.' }, 409);

    const { data: trustRows, error: trustError } = await admin
      .rpc('require_verified_project_parties', { p_project_id: contract.project_id });
    const trust = Array.isArray(trustRows) ? trustRows[0] : trustRows;
    if (trustError) {
      console.error('sign-contract identity gate error:', trustError);
      return json({ error: 'Identity status could not be verified', code: 'IDENTITY_GATE_UNAVAILABLE' }, 503);
    }
    if (!trust?.both_verified) {
      return json({
        error: 'Both project parties must complete identity verification before signing.',
        code: 'IDENTITY_VERIFICATION_REQUIRED',
      }, 409);
    }

    const { data: existing } = await admin
      .from('contract_signatures')
      .select('*')
      .eq('contract_id', contract.id)
      .eq('signer_role', signerRole)
      .maybeSingle();
    if (existing) {
      const { data: refreshed } = await admin.rpc('refresh_contract_signature_status', { p_contract_id: contract.id });
      const regenerated = await renderAndStoreContractPdf(admin, req, contract.id);
      return json({ signature: existing, contract: regenerated || refreshed || contract, idempotent: true });
    }

    const signatureBytes = method === 'saved'
      ? await bytesForSavedSignature(admin, String(savedSignatureId || ''), authData.user.id)
      : parsePngDataUrl(String(signatureDataUrl || ''));
    const signatureId = crypto.randomUUID();
    const signaturePath = `${contract.id}/${signerRole}.png`;
    const { error: uploadError } = await admin.storage
      .from('signatures')
      .upload(signaturePath, signatureBytes, { contentType: 'image/png', upsert: true, cacheControl: '0' });
    if (uploadError) throw new Error(`Signature could not be stored: ${uploadError.message}`);
    const signatureRef = `storage://signatures/${signaturePath}`;

    const { data: inserted, error: insertError } = await admin
      .from('contract_signatures')
      .insert({
        id: signatureId,
        contract_id: contract.id,
        signer_user_id: authData.user.id,
        signer_role: signerRole,
        signer_name: String(signerName).trim(),
        method,
        signature_image_ref: signatureRef,
        consent_text: CONSENT_TEXT,
        signed_content_hash: contract.content_hash,
        ip_address: auditIp(req),
        user_agent: req.headers.get('user-agent') || null,
      })
      .select('*')
      .single();
    if (insertError || !inserted) {
      if (insertError?.code === '23505') {
        const { data: concurrentSignature } = await admin
          .from('contract_signatures')
          .select('*')
          .eq('contract_id', contract.id)
          .eq('signer_role', signerRole)
          .maybeSingle();
        const { data: concurrentContract } = await admin.rpc('refresh_contract_signature_status', { p_contract_id: contract.id });
        const regenerated = await renderAndStoreContractPdf(admin, req, contract.id);
        return json({ signature: concurrentSignature, contract: regenerated || concurrentContract || contract, idempotent: true });
      }
      throw new Error(insertError?.message || 'Signature audit record could not be saved');
    }

    if (saveSignature && method !== 'saved') {
      await admin.from('saved_signatures').update({ is_default: false }).eq('user_id', authData.user.id);
      const savedId = crypto.randomUUID();
      const savedPath = `saved/${authData.user.id}/${savedId}.png`;
      const { error: savedUploadError } = await admin.storage
        .from('signatures')
        .upload(savedPath, signatureBytes, { contentType: 'image/png', upsert: false, cacheControl: '0' });
      if (!savedUploadError) {
        await admin.from('saved_signatures').insert({
          id: savedId,
          user_id: authData.user.id,
          label: 'My signature',
          method,
          signature_image_ref: `storage://signatures/${savedPath}`,
          is_default: true,
        });
      }
    }

    const { data: refreshedContract, error: statusError } = await admin
      .rpc('refresh_contract_signature_status', { p_contract_id: contract.id });
    if (statusError || !refreshedContract) throw new Error('Contract signature status could not be saved');
    const countersigned = refreshedContract.status === 'countersigned';
    const updatedContract = await renderAndStoreContractPdf(admin, req, contract.id);
    const recipientId = signerRole === 'client' ? contract.creator_user_id : contract.client_id;
    await admin.rpc('create_platform_notification', {
      p_recipient_id: recipientId,
      p_type: countersigned ? 'contract_countersigned' : 'contract_signed',
      p_title: countersigned ? 'Production agreement complete' : 'The other party signed the agreement',
      p_body: countersigned
        ? 'Both signatures are complete. The client can now pay the retainer.'
        : 'Review and sign the agreement to continue the booking.',
      p_action_url: '/projects',
      p_metadata: { project_id: contract.project_id, contract_id: contract.id },
      p_actor_id: authData.user.id,
      p_response_due_at: null,
    });
    return json({ signature: inserted, contract: updatedContract });
  } catch (error) {
    console.error('sign-contract error:', error);
    return json({ error: error instanceof Error ? error.message : 'Agreement could not be signed' }, 500);
  }
});

export { CONSENT_TEXT };
