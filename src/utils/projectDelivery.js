import { DELIVERY_DIRECT_LIMIT_BYTES, REVIEW_WINDOW_HOURS } from '../config/projectCompletion.js';

export const DELIVERY_BUCKET = 'project-deliveries';
export const DELIVERY_REVIEW_HOURS = REVIEW_WINDOW_HOURS;

export const DELIVERY_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/flac',
  'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
]);

export function normalizeDeliveryUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed || /^(javascript|data|file):/i.test(trimmed)) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname || !url.hostname.includes('.')) return '';
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function directDeliveryBytes(items = []) {
  return items.reduce((total, item) => {
    const external = item?.itemType === 'external' || item?.item_type === 'external' || item?.externalUrl || item?.external_url;
    return external ? total : total + Math.max(0, Number(item?.size ?? item?.sizeBytes ?? item?.size_bytes ?? 0));
  }, 0);
}

export function validateDirectDelivery(files = []) {
  for (const file of files) {
    const external = file?.itemType === 'external' || file?.item_type === 'external';
    if (external) continue;
    if (!DELIVERY_MIME_TYPES.has(String(file?.type || file?.contentType || file?.content_type || '').toLowerCase())) {
      return { ok: false, code: 'UNSAFE_FILE_TYPE', message: `${file?.name || 'File'} is not an approved final-deliverable type.` };
    }
    const size = Number(file?.size ?? file?.sizeBytes ?? file?.size_bytes ?? 0);
    if (!Number.isSafeInteger(size) || size <= 0) {
      return { ok: false, code: 'INVALID_FILE_SIZE', message: `${file?.name || 'File'} has an invalid size.` };
    }
  }

  const sizeBytes = directDeliveryBytes(files);
  if (sizeBytes > DELIVERY_DIRECT_LIMIT_BYTES) {
    return { ok: false, code: 'DIRECT_SIZE_LIMIT', sizeBytes, limitBytes: DELIVERY_DIRECT_LIMIT_BYTES };
  }
  return { ok: true, sizeBytes, limitBytes: DELIVERY_DIRECT_LIMIT_BYTES };
}

export function safeDeliveryFileName(name = 'deliverable') {
  const parts = String(name || 'deliverable').normalize('NFKC').split('.');
  const extension = parts.length > 1 ? `.${parts.pop().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}` : '';
  const stem = parts.join('.').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `${stem || 'deliverable'}${extension.toLowerCase()}`;
}

export function deliveryCanFinalize(items = []) {
  if (!items.length) return { ok: false, code: 'EMPTY_DELIVERY' };
  const invalidExternal = items.find(item => (item.itemType === 'external' || item.item_type === 'external') && !normalizeDeliveryUrl(item.url || item.externalUrl || item.external_url));
  if (invalidExternal) return { ok: false, code: 'INVALID_EXTERNAL_URL' };
  const pendingDirect = items.find(item => !(item.itemType === 'external' || item.item_type === 'external') && !['uploaded', 'ready'].includes(item.uploadStatus || item.upload_status));
  if (pendingDirect) return { ok: false, code: 'UPLOAD_INCOMPLETE' };
  return validateDirectDelivery(items);
}
