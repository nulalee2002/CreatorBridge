import { useState, useRef } from 'react';
import { Info } from 'lucide-react';

export function Tooltip({ content, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  const posClass = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children || (
        <button type="button" className="text-charcoal-400 hover:text-gold-400 transition-colors ml-1" aria-label="Info">
          <Info size={13} />
        </button>
      )}
      {visible && (
        <span className={`absolute ${posClass} z-50 bg-charcoal-950 border border-white/[0.09] text-white text-xs rounded-lg px-3 py-2 shadow-xl w-56 pointer-events-none animate-fade-in`}>
          {content}
          <span className="absolute inset-0 rounded-lg ring-1 ring-white/5" />
        </span>
      )}
    </span>
  );
}
