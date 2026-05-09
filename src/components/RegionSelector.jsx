import { useState } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import { REGIONS, REGION_GROUPS } from '../data/regions.js';
import { zipToRegion, zipToCity } from '../data/zipCodes.js';

export function RegionSelector({ value, onChange, dark = true }) {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState('browse'); // 'browse' | 'zip'
  const [zip, setZip]         = useState('');
  const [zipResult, setZipResult] = useState(null); // { region, city } | 'not_found'

  const current = REGIONS[value];

  const handleZipChange = (raw) => {
    const val = raw.replace(/\D/g, '').slice(0, 5);
    setZip(val);
    if (val.length >= 3) {
      const region = zipToRegion(val);
      const city   = zipToCity(val);
      setZipResult(region ? { region, city } : 'not_found');
    } else {
      setZipResult(null);
    }
  };

  const applyZip = (regionKey) => {
    onChange(regionKey);
    setOpen(false);
  };

  const grouped = REGION_GROUPS.map(group => ({
    group,
    regions: Object.entries(REGIONS).filter(([, r]) => r.group === group),
  }));

  const bg       = dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200';
  const dropBg   = dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.36)]' : 'bg-white border-gray-200';
  const hoverRow = dark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const groupLbl = dark ? 'text-charcoal-300 border-white/[0.07]' : 'text-gray-400 border-gray-100';
  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border ${bg} ${textMain} transition-all hover:border-gold-500/50 focus:outline-none focus:border-gold-500`}
      >
        <MapPin size={16} className="text-gold-400 shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-semibold truncate">
            {current ? `${current.flag} ${current.name}` : 'Select region…'}
          </div>
          {current?.cities && (
            <div className={`text-[11px] truncate ${textSub}`}>{current.cities}</div>
          )}
        </div>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${textSub}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border shadow-2xl ${dropBg} overflow-hidden animate-slide-up`}>

            {/* Tab switcher */}
            <div className={`flex border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              {[
                { id: 'browse', label: '🗺 Browse Regions' },
                { id: 'zip',    label: '🔍 Search by ZIP' },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-gold-500/10 text-gold-400 border-b-2 border-gold-500'
                      : `${textSub} hover:${dark ? 'text-white' : 'text-gray-900'}`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ZIP tab */}
            {tab === 'zip' && (
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub} pointer-events-none`} />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={zip}
                    onChange={e => handleZipChange(e.target.value)}
                    placeholder="Enter ZIP code (e.g. 90210)"
                    autoFocus
                    className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                  />
                  {zip && (
                    <button type="button" onClick={() => { setZip(''); setZipResult(null); }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSub} hover:text-red-400 transition-colors`}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Result */}
                {zipResult === 'not_found' && zip.length >= 3 && (
                  <div className={`rounded-xl px-4 py-3 border ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
                    <p className={`text-sm font-medium ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                      ZIP {zip} not found in our database.
                    </p>
                    <p className={`text-xs mt-1 ${textSub}`}>Try browsing regions manually above, or use a nearby ZIP.</p>
                  </div>
                )}

                {zipResult && zipResult !== 'not_found' && (
                  <div className={`rounded-xl border overflow-hidden ${dark ? 'border-gold-500/40' : 'border-gold-400/40'}`}>
                    <div className={`px-4 py-2 ${dark ? 'bg-gold-500/10' : 'bg-gold-50'}`}>
                      <p className="text-xs font-bold text-gold-400 uppercase tracking-wider">Match Found</p>
                    </div>
                    <div className={`px-4 py-3 ${dark ? 'bg-charcoal-950/55' : 'bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          {zipResult.city && (
                            <p className={`text-sm font-semibold ${textMain}`}>{zipResult.city}</p>
                          )}
                          <p className={`text-xs mt-0.5 ${textSub}`}>
                            {REGIONS[zipResult.region]?.flag} {REGIONS[zipResult.region]?.name}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
                            {REGIONS[zipResult.region]?.cities}
                          </p>
                        </div>
                        <button type="button" onClick={() => applyZip(zipResult.region)}
                          className="ml-3 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all shrink-0">
                          Use This Region
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className={`text-[10px] text-center ${dark ? 'text-charcoal-300' : 'text-gray-300'}`}>
                  Rates auto-fill based on matched market tier
                </p>
              </div>
            )}

            {/* Browse tab */}
            {tab === 'browse' && (
              <div className="max-h-80 overflow-y-auto">
                {grouped.map(({ group, regions }) => (
                  <div key={group}>
                    <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${groupLbl}`}>
                      {group}
                    </div>
                    {regions.map(([key, region]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { onChange(key); setOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${hoverRow} ${
                          value === key
                            ? (dark ? 'bg-gold-500/10 text-gold-400' : 'bg-gold-50 text-gold-600')
                            : textMain
                        }`}
                      >
                        <span className="text-base leading-none">{region.flag}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-tight">{region.name}</div>
                          <div className={`text-[11px] truncate ${value === key ? (dark ? 'text-gold-500/70' : 'text-gold-500') : textSub}`}>
                            {region.cities}
                          </div>
                        </div>
                        <div className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${
                          dark ? 'bg-white/[0.08] text-charcoal-300' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {region.nativeCurrency}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
