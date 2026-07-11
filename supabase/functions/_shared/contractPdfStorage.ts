import { createContractPdf } from '../../../src/utils/contractPdf.js';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { autoTable } from 'npm:jspdf-autotable@5.0.2';

type SupabaseAdmin = any;

function parseStorageReference(value = '') {
  if (!value.startsWith('storage://')) return null;
  const remainder = value.slice('storage://'.length);
  const slash = remainder.indexOf('/');
  if (slash < 1) return null;
  return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) };
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = '';
  const chunkSize = 16384;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    for (const byte of chunk) binary += String.fromCharCode(byte);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function downloadAsDataUrl(admin: SupabaseAdmin, ref: string, expectedBucket: string, mimeType: string) {
  const parsed = parseStorageReference(ref);
  if (!parsed || parsed.bucket !== expectedBucket) throw new Error('Private contract asset reference is invalid');
  const { data, error } = await admin.storage.from(parsed.bucket).download(parsed.path);
  if (error || !data) throw new Error('Private contract asset could not be loaded');
  return bytesToDataUrl(new Uint8Array(await data.arrayBuffer()), mimeType);
}

function contractLogoUrl(req: Request) {
  const explicit = Deno.env.get('CONTRACT_LOGO_URL')?.trim();
  if (explicit) return explicit;
  const site = Deno.env.get('SITE_URL')?.trim();
  if (site) return new URL('/images/brand/creatorbridge-platform-logo-transparent.png', site).toString();
  const origin = req.headers.get('origin') || '';
  const parsed = origin ? new URL(origin) : null;
  if (parsed && ['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    return new URL('/images/brand/creatorbridge-platform-logo-transparent.png', parsed).toString();
  }
  throw new Error('Set CONTRACT_LOGO_URL before generating production agreements');
}

async function loadLogo(req: Request) {
  const response = await fetch(contractLogoUrl(req));
  if (!response.ok) throw new Error('The real CreatorBridge logo could not be loaded');
  return bytesToDataUrl(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type') || 'image/png');
}

export async function renderAndStoreContractPdf(admin: SupabaseAdmin, req: Request, contractId: string) {
  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle();
  if (contractError || !contract) throw new Error('Contract could not be loaded for PDF generation');

  const { data: signatureRows, error: signatureError } = await admin
    .from('contract_signatures')
    .select('signer_role,signer_name,method,signature_image_ref,signed_content_hash,ip_address,user_agent,signed_at')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: true });
  if (signatureError) throw new Error('Contract signatures could not be loaded');

  const signatures = [];
  for (const signature of signatureRows || []) {
    signatures.push({
      ...signature,
      image_data_url: signature.signature_image_ref
        ? await downloadAsDataUrl(admin, signature.signature_image_ref, 'signatures', 'image/png')
        : null,
    });
  }

  const logoDataUrl = await loadLogo(req);
  const { bytes } = await createContractPdf({
    terms: contract.terms,
    signatures,
    contentHash: contract.content_hash,
    logoDataUrl,
    modules: { jsPDF, autoTable },
  });
  const path = `${contract.id}/agreement.pdf`;
  const { error: uploadError } = await admin.storage
    .from('contracts')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });
  if (uploadError) throw new Error(`Contract PDF could not be stored: ${uploadError.message}`);

  const pdfRef = `storage://contracts/${path}`;
  const patch: Record<string, unknown> = { pdf_ref: pdfRef };
  if (contract.status === 'draft') patch.status = 'sent';
  const { data: updated, error: updateError } = await admin
    .from('contracts')
    .update(patch)
    .eq('id', contract.id)
    .eq('content_hash', contract.content_hash)
    .select('*')
    .maybeSingle();
  if (updateError || !updated) throw new Error('Contract PDF state could not be finalized');
  return updated;
}

export function parsePngDataUrl(value: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
  if (!match) throw new Error('Signature must be a transparent PNG');
  const binary = atob(match[1]);
  if (binary.length < 40 || binary.length > 2 * 1024 * 1024) throw new Error('Signature image size is invalid');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export { parseStorageReference };
