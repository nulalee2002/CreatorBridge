import { supabase, supabaseConfigured } from '../lib/supabase.js';

export const BUNNY_REF_PREFIX = 'bunny:';
export const BUNNY_TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
export const MAX_INTRO_VIDEO_BYTES = 750 * 1024 * 1024;
export const MAX_PORTFOLIO_VIDEO_BYTES = 1024 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function isBunnyVideoRef(value = '') {
  return String(value || '').startsWith(BUNNY_REF_PREFIX);
}

export function makeBunnyVideoRef(videoId) {
  return `${BUNNY_REF_PREFIX}${String(videoId || '').trim()}`;
}

export function getBunnyVideoId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return isBunnyVideoRef(raw) ? raw.slice(BUNNY_REF_PREFIX.length) : raw;
}

export function getBunnyEmbedUrl(videoId, libraryId) {
  const id = getBunnyVideoId(videoId);
  const lib = libraryId || getPublicBunnyLibraryId();
  if (!id || !lib) return '';
  return `https://iframe.mediadelivery.net/embed/${lib}/${id}`;
}

export function getBunnyThumbnailUrl(videoId, libraryId) {
  const id = getBunnyVideoId(videoId);
  const lib = libraryId || getPublicBunnyLibraryId();
  if (!id || !lib) return '';
  return `https://vz-${lib}.b-cdn.net/${id}/thumbnail.jpg`;
}

export function getPublicBunnyLibraryId() {
  return import.meta.env?.VITE_BUNNY_STREAM_LIBRARY_ID || '';
}

function validateVideo(file, purpose) {
  if (!supabaseConfigured) throw new Error('Video uploads are not configured yet.');
  if (!file) throw new Error('Choose a video file to upload.');
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    throw new Error('Use an MP4, MOV, or WEBM video.');
  }
  const limit = purpose === 'intro' ? MAX_INTRO_VIDEO_BYTES : MAX_PORTFOLIO_VIDEO_BYTES;
  if (file.size > limit) {
    throw new Error(purpose === 'intro'
      ? 'Intro video must be under 750 MB.'
      : 'Portfolio video must be under 1 GB.');
  }
}

function encodeMetadata(value = '') {
  return btoa(unescape(encodeURIComponent(String(value))));
}

function uploadTusFile({ endpoint, headers, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const create = new XMLHttpRequest();
    create.open('POST', endpoint);
    create.setRequestHeader('Tus-Resumable', '1.0.0');
    create.setRequestHeader('Upload-Length', String(file.size));
    create.setRequestHeader(
      'Upload-Metadata',
      `filename ${encodeMetadata(file.name)},filetype ${encodeMetadata(file.type)}`,
    );
    Object.entries(headers || {}).forEach(([key, value]) => create.setRequestHeader(key, String(value)));

    create.onload = () => {
      if (create.status < 200 || create.status >= 300) {
        reject(new Error('Bunny upload session could not be created.'));
        return;
      }

      const location = create.getResponseHeader('Location');
      if (!location) {
        reject(new Error('Bunny upload session did not return a location.'));
        return;
      }

      const patch = new XMLHttpRequest();
      patch.open('PATCH', location.startsWith('http') ? location : new URL(location, endpoint).toString());
      patch.setRequestHeader('Tus-Resumable', '1.0.0');
      patch.setRequestHeader('Content-Type', 'application/offset+octet-stream');
      patch.setRequestHeader('Upload-Offset', '0');
      Object.entries(headers || {}).forEach(([key, value]) => patch.setRequestHeader(key, String(value)));
      patch.upload.onprogress = event => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      patch.onload = () => {
        if (patch.status >= 200 && patch.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error('Bunny video upload failed.'));
        }
      };
      patch.onerror = () => reject(new Error('Bunny video upload failed.'));
      patch.send(file);
    };
    create.onerror = () => reject(new Error('Bunny upload session could not be created.'));
    create.send();
  });
}

export async function uploadVideoToBunny({ file, purpose = 'portfolio', title = 'CreatorBridge video', onProgress }) {
  validateVideo(file, purpose);

  const { data, error } = await supabase.functions.invoke('bunny-create-video', {
    body: {
      title,
      purpose,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    },
  });
  if (error) throw new Error(error.message || 'Video upload could not start.');
  if (!data?.videoId || !data?.tusEndpoint || !data?.headers) {
    throw new Error('Video upload is not configured correctly.');
  }

  await uploadTusFile({
    endpoint: data.tusEndpoint || BUNNY_TUS_ENDPOINT,
    headers: data.headers,
    file,
    onProgress,
  });

  return {
    videoId: data.videoId,
    videoRef: data.videoRef || makeBunnyVideoRef(data.videoId),
    embedUrl: data.embedUrl || getBunnyEmbedUrl(data.videoId, data.libraryId),
    thumbnailUrl: data.thumbnailUrl || getBunnyThumbnailUrl(data.videoId, data.libraryId),
    libraryId: data.libraryId,
  };
}

export async function deleteBunnyVideo(videoId) {
  const id = getBunnyVideoId(videoId);
  if (!id || !supabaseConfigured) return { ok: false };
  const { data, error } = await supabase.functions.invoke('bunny-delete-video', {
    body: { videoId: id },
  });
  if (error) throw new Error(error.message || 'Bunny video could not be removed.');
  return data || { ok: true };
}
