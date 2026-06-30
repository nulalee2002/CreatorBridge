const BRAND_LOCKUP = '/images/creatorbridge/handoff/logo.png';
const BRAND_MARK = '/images/brand/creatorbridge-mark.png';

export function BrandMark({ className = '', title = 'CreatorBridge' }) {
  return (
    <img
      src={BRAND_MARK}
      alt={title}
      className={`cb-brand-mark-img ${className}`}
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
      alt="CreatorBridge, verified media platform"
      className={`cb-brand-lockup-img ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
