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

export function CreatorAvatar({ src, alt = 'Creator', fallback = '🎬', className = '' }) {
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

  return (
    <span className={`inline-flex h-full w-full items-center justify-center ${className}`} aria-hidden="true">
      {fallback}
    </span>
  );
}
