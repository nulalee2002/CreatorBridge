import { createChangeOrderPdf } from '../../../src/utils/changeOrderPdf.js';
import { jsPDF } from 'npm:jspdf@4.2.1';

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function logoDataUrl(req: Request) {
  const site = Deno.env.get('CONTRACT_LOGO_URL') || `${Deno.env.get('SITE_URL') || req.headers.get('origin')}/images/brand/creatorbridge-platform-logo-transparent.png`;
  const response = await fetch(site);
  if (!response.ok) throw new Error('CreatorBridge logo could not be loaded');
  return bytesToDataUrl(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type') || 'image/png');
}

export async function renderAndStoreChangeOrderPdf(admin: any, req: Request, changeOrderId: string) {
  const { data: order, error } = await admin.from('contract_change_orders').select('*').eq('id', changeOrderId).maybeSingle();
  if (error || !order) throw new Error('Change order could not be loaded');
  const { data: signatures, error: signatureError } = await admin.from('change_order_signatures')
    .select('signer_role,signer_name,signed_at').eq('change_order_id', changeOrderId).order('signed_at');
  if (signatureError) throw new Error('Change-order signatures could not be loaded');
  const { bytes } = await createChangeOrderPdf({
    terms: order.terms,
    signatures: signatures || [],
    contentHash: order.content_hash,
    logoDataUrl: await logoDataUrl(req),
    modules: { jsPDF },
  });
  const path = `change-orders/${order.id}/change-order.pdf`;
  const { error: uploadError } = await admin.storage.from('contracts')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true, cacheControl: '0' });
  if (uploadError) throw new Error(`Change-order PDF could not be stored: ${uploadError.message}`);
  const pdfRef = `storage://contracts/${path}`;
  const { data: updated, error: updateError } = await admin.from('contract_change_orders')
    .update({ pdf_ref: pdfRef, updated_at: new Date().toISOString() })
    .eq('id', order.id).eq('content_hash', order.content_hash).select('*').single();
  if (updateError) throw new Error('Change-order PDF state could not be saved');
  return updated;
}
