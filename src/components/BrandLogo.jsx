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
    <span className={`cb-brand-lockup ${className}`} aria-label="CreatorBridge, verified media platform">
      <BrandMark className="cb-brand-lockup-mark" title="" />
      <span className="cb-brand-lockup-divider" aria-hidden="true" />
      <span className="cb-brand-lockup-text">
        <span className="cb-brand-lockup-name">CreatorBridge</span>
        <span className="cb-brand-lockup-tagline">Verified Media Platform</span>
      </span>
    </span>
  );
}
