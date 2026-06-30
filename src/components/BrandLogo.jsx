const PLATFORM_LOGO = '/images/brand/creatorbridge-platform-logo.png';

export function BrandMark({ className = '', title = 'CreatorBridge' }) {
  return (
    <img
      src={PLATFORM_LOGO}
      alt={title}
      className={`cb-brand-mark-img cb-brand-platform-mark ${className}`}
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
      src={PLATFORM_LOGO}
      alt="CreatorBridge, verified media platform"
      className={`cb-brand-lockup-img cb-brand-platform-logo ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
