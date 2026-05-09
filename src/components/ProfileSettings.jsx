import { useState } from 'react';
import { User, ChevronDown } from 'lucide-react';

export function ProfileSettings({ profile, onChange, dark = true }) {
  const [open, setOpen] = useState(false);
  const bg = dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200';
  const dropBg = dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.36)]' : 'bg-white border-gray-200';
  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1 ${textSub}`;

  const fields = [
    { key: 'companyName', label: 'Company Name', placeholder: 'Your Production Co.' },
    { key: 'email',       label: 'Email',         placeholder: 'hello@yourco.com' },
    { key: 'phone',       label: 'Phone',         placeholder: '+1 (555) 000-0000' },
    { key: 'website',     label: 'Website',       placeholder: 'yourco.com' },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${bg} ${textMain} text-sm transition-all hover:border-gold-500/40`}
      >
        <User size={14} className="text-gold-400" />
        <span className="font-medium truncate max-w-[120px]">{profile?.companyName || 'Profile'}</span>
        <ChevronDown size={12} className={`${textSub} shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-full mt-2 z-40 w-72 rounded-2xl border shadow-2xl ${dropBg} overflow-hidden animate-slide-up`}>
            <div className={`px-4 py-3 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <p className={`text-xs font-bold ${textMain}`}>Company Profile</p>
              <p className={`text-[10px] ${textSub}`}>Shows on PDF exports</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              {fields.map(f => (
                <div key={f.key}>
                  <p className={labelCls}>{f.label}</p>
                  <input
                    type="text"
                    value={profile?.[f.key] || ''}
                    onChange={e => onChange({ ...profile, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={`w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                  />
                </div>
              ))}
              <div>
                <p className={labelCls}>Notes / Terms (default)</p>
                <textarea
                  value={profile?.defaultNotes || ''}
                  onChange={e => onChange({ ...profile, defaultNotes: e.target.value })}
                  placeholder="Payment due within 30 days of invoice..."
                  rows={3}
                  className={`w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-all resize-none ${inputCls}`}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
