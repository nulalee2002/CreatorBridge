export function BrandMark({ className = '', title = 'CreatorBridge' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 72"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cb-mark-gold" x1="14" y1="63" x2="83" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9f7626" />
          <stop offset="0.45" stopColor="#d4a941" />
          <stop offset="1" stopColor="#f2d37a" />
        </linearGradient>
      </defs>
      <path
        d="M18.5 55.5C29 42.2 41.7 33.1 57.7 28.3c5.7-1.7 11.8-2.7 18.3-2.9v8.1c-15.6.6-28.4 5.4-38.5 14.3-3.1 2.8-5.9 5.9-8.4 9.4H18.5v-1.7Z"
        fill="url(#cb-mark-gold)"
      />
      <path
        d="M9.6 55.6C22.9 36.2 40.7 24.1 63 19.3c4.3-.9 8.7-1.4 13.2-1.5v6.1C55.7 24.8 39 33.4 26.1 49.8l-4.3 5.8H9.6Z"
        fill="url(#cb-mark-gold)"
        opacity="0.8"
      />
      <path
        d="M52.6 11.6h18.6c5.7 0 10.2 1.3 13.5 3.8 3.4 2.5 5.1 6.1 5.1 10.7 0 3.6-1 6.5-3 8.7-1.9 2.2-4.4 3.7-7.5 4.5 3.9.7 7 2.3 9.2 4.9 2.2 2.5 3.3 5.8 3.3 9.8 0 5-1.8 8.9-5.5 11.7-3.6 2.8-8.8 4.2-15.5 4.2H52.6V11.6Zm17.1 24.2c7.3 0 11-2.8 11-8.4 0-2.8-.9-4.8-2.7-6.1-1.8-1.3-4.5-2-8.2-2h-8.2v16.5h8.1Zm.8 26.2c4.1 0 7.1-.7 9-2.2 2-1.5 3-3.8 3-6.9 0-3.2-1-5.6-3.1-7.2-2.1-1.6-5.2-2.4-9.4-2.4h-8.4V62h8.9Z"
        fill="url(#cb-mark-gold)"
      />
      <path
        d="M43.6 11.8c-6.8 0-12.2 2.3-16.2 6.8-4 4.6-6 10.8-6 18.7 0 6.5 1.4 11.9 4.2 16.1l-7.5 4.1C14 52.1 12 45.3 12 37.2c0-6.5 1.3-12.3 3.8-17.2 2.6-4.9 6.2-8.7 10.9-11.4 4.7-2.7 10.2-4 16.4-4 5.7 0 10.9 1.1 15.7 3.4v8.8c-4.7-3.3-9.8-5-15.2-5Z"
        fill="url(#cb-mark-gold)"
      />
    </svg>
  );
}

export function BrandLogo({ dark = true, compact = false, markClassName = '' }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center overflow-hidden rounded-xl border shadow-[0_0_24px_rgba(212,169,65,0.12)] ${
        dark ? 'border-gold-500/24 bg-charcoal-950/72' : 'border-gold-500/24 bg-white'
      }`}>
        <BrandMark className={`h-8 w-8 ${markClassName}`} />
      </span>
      {!compact && (
        <span className="hidden sm:flex flex-col leading-none">
          <span className={`font-display text-xl font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>
            Creator<span className="text-gradient-gold">Bridge</span>
          </span>
          <span className={`mt-1 text-[9px] font-bold uppercase ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
            Verified media marketplace
          </span>
        </span>
      )}
    </span>
  );
}
