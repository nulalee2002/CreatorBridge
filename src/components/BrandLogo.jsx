const BRAND_LOCKUP = '/images/brand/creatorbridge-logo-lockup.png';
const BRAND_MARK = '/images/brand/creatorbridge-mark.png';

export function BrandMark({ className = '', title = 'CreatorBridge' }) {
  return (
    <img
      src={BRAND_MARK}
      alt={title}
      className={`block object-contain ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

export function BrandLogo({ compact = false, className = '' }) {
  if (compact) {
    return <BrandMark className={`h-10 w-10 rounded-xl ${className}`} />;
  }

  return (
    <img
      src={BRAND_LOCKUP}
      alt="CreatorBridge, verified media marketplace"
      className={`block h-12 w-auto max-w-[260px] object-contain sm:h-14 sm:max-w-[320px] ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
