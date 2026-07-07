import { useEffect, useState } from 'react';

function isImageSource(value) {
  return typeof value === 'string' && (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

/** Two-letter initials from a name, e.g. "Copper Line Media" -> "CM". */
function initialsFrom(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function initialsFromStoredValue(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9]{1,3}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

export function CreatorAvatar({ src, alt = 'Creator', fallback, className = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (isImageSource(src) && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  // No usable image source: prefer stored initials like "CB", then caller
  // fallbacks, then initials derived from the displayed creator name.
  const content = initialsFromStoredValue(src) ?? (fallback === '🎬' ? null : fallback) ?? initialsFrom(alt);
  return (
    <span
      className={`inline-flex h-full w-full items-center justify-center font-bold text-gold-400 ${className}`}
      aria-hidden="true"
    >
      {content}
    </span>
  );
}
