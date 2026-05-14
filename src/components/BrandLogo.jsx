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
    return <BrandMark className={`h-11 w-11 sm:h-12 sm:w-12 ${className}`} />;
  }

  return (
    <img
      src={BRAND_LOCKUP}
      alt="CreatorBridge, verified media marketplace"
      className={`block h-12 w-auto max-w-[280px] object-contain sm:h-14 sm:max-w-[360px] ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
