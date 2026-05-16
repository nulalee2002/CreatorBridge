import { supabase, supabaseConfigured } from '../lib/supabase.js';

const STORAGE_PREFIX = 'storage://';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isStorageReference(value = '') {
  return String(value || '').startsWith(STORAGE_PREFIX);
}

export function makeStorageReference(bucket, path) {
  return `${STORAGE_PREFIX}${bucket}/${path}`;
}

export function parseStorageReference(value = '') {
  const raw = String(value || '');
  if (!raw.startsWith(STORAGE_PREFIX)) return null;
  const withoutPrefix = raw.slice(STORAGE_PREFIX.length);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex < 1) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    path: withoutPrefix.slice(slashIndex + 1),
  };
}

export function normalizeExternalUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed || isStorageReference(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  return `https://${trimmed}`;
}

export async function getStorageDisplayUrl(value = '', expiresIn = 3600) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized || !isStorageReference(normalized) || !supabaseConfigured) return normalized;

  const parsed = parseStorageReference(normalized);
  if (!parsed) return '';

  if (parsed.bucket === 'creator-portfolio') {
    const { data, error } = await supabase.functions.invoke('create-storage-signed-url', {
      body: { ref: normalized, expiresIn },
    });

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const { data, error } = await supabase
    .storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error) return '';
  return data?.signedUrl || '';
}

function cleanFileName(name = 'asset') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'asset';
}

export async function uploadUserAsset({ bucket, userId, folder = 'uploads', file }) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  if (!bucket || !userId || !file) throw new Error('Missing upload details.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be under 8 MB.');
  }

  const safeName = cleanFileName(file.name);
  const unique = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/${folder}/${unique}-${safeName}`;

  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return makeStorageReference(bucket, path);
}
