import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { RATES, SERVICES, EQUIPMENT_ITEMS, LICENSING_OPTIONS, TURNAROUND_OPTIONS } from '../data/rates.js';
import { getRegionRates } from '../utils/pricing.js';
import { CurrencyInput } from './CurrencyInput.jsx';
import { Tooltip } from './Tooltip.jsx';

const getUnitMax = (unit) => {
  switch (unit) {
    case 'hr': return 16;
    case 'day': return 10;
    case 'session': return 5;
    case 'project': return 5;
    default: return 100;
  }
};


// Hours options for hourly rates
const PHOTO_HOURS = [2, 4, 6, 8, 10, 12];
const VIDEO_HOURS = [
  { value: 4,  label: 'Half Day (4 hrs)' },
  { value: 8,  label: 'Full Day (8 hrs)' },
  { value: 10, label: 'Extended Day (10 hrs)' },
  { value: 12, label: 'Double Day (12 hrs)' },
];
const HOURLY_PHOTO_RATES = ['hourlyEvent', 'editHourly'];
const HOURLY_VIDEO_RATES = ['hourlyShoot', 'editHourly', 'equipmentHourly'];

// Default "What's included" descriptions for common rate types
const RATE_DESCRIPTIONS = {
  'video.hourlyShoot':      'Includes on-site filming, camera operation, and basic on-set audio monitoring.',
  'video.halfDay':          'Includes up to 5 hours on-site filming, camera/lens package, and basic color correction.',
  'video.fullDay':          'Includes up to 10 hours filming, full camera package, on-set audio, and basic color correction.',
  'video.editHourly':       'Includes rough cut, pacing, music sync, color grade, and delivery in requested format.',
  'video.weddingPackage':   'Includes ceremony + reception coverage, highlight film (3–5 min), full-length edit, online gallery, and print release.',
  'video.corporateProject': 'Includes pre-production planning, filming (1–2 days), editing, color grade, and 2 rounds of revisions.',
  'video.musicVideoProject':'Includes concept development, full shoot day, editing, color grade, and 2 rounds of revisions.',
  'photography.hourlyEvent':        'Includes on-location shooting, same-day file backup, and delivery of edited JPEGs via online gallery.',
  'photography.headshotsSession':   'Includes studio or on-location session, 2–3 looks/outfits, 20 fully retouched final images, and commercial license.',
  'photography.weddingPackage':     'Includes 8 hours of coverage, 400+ edited images, private online gallery, print release, and digital downloads.',
  'photography.dayRateCommercial':  'Includes full-day shoot (8 hrs), art direction, 80+ edited images, and commercial usage license.',
  'photography.realEstatePerListing':'Includes interior, exterior, and detail shots. 20–30 delivered images, HDR-processed and ready for MLS.',
  'photography.productPerImage':    'Includes white-background or lifestyle setup, retouching, color correction, and web/print-ready files.',
  'podcast.basicEditPerEp':         'Includes noise reduction, leveling, normalization, intro/outro insertion, and MP3 delivery.',
  'podcast.fullProductionPerEp':    'Includes recording session, full audio edit, show notes (300–500 words), transcript, and 2 social audiogram clips.',
  'podcast.monthlyRetainer4Eps':    'Includes 4 episodes/month, recording, full editing, mastering, show notes, transcripts, and social clips.',
  'podcast.recordingSession':       'Includes remote or in-studio recording, raw file export, and basic cleanup pass.',
  'drone.hourlyPhoto':              'Includes one FAA Part 107 licensed pilot, drone operations, and delivered aerial stills (color-corrected JPEGs).',
  'drone.hourlyVideo':              'Includes one FAA Part 107 licensed pilot, drone videography, and color-corrected footage delivered in requested format.',
  'drone.halfDay':                  'Includes up to 4 hours of flight operations, equipment, and footage/stills delivered within 3 business days.',
  'drone.fullDay':                  'Includes up to 8 flight hours, full equipment, FAA compliance documentation, and footage delivered within 5 business days.',
  'drone.realEstatePerProperty':    'Includes exterior aerial stills and a 1-minute walk-around video clip. Delivered within 48 hours.',
  'drone.mappingPerAcre':           'Includes orthomosaic map, DSM, and raw GeoTIFF data. FAA waivers and site permissions are client responsibility.',
  'drone.editingHourly':            'Includes color grading, stabilization, and sync of aerial footage for delivery in H.264 or ProRes.',
  'social.singleReelTikTok':        'Includes filming, editing, music licensing, captions, and one round of revisions. Delivered in 9:16 vertical format.',
  'social.contentDay':              'Includes a full shoot day producing 8–15 platform-ready pieces. Includes scripting, filming, editing, and caption copy.',
  'social.monthlyBasic':            'Includes 4–8 pieces of content per month, platform-specific formatting, and scheduling.',
  'social.monthlyStandard':         'Includes 12–20 pieces/month, content calendar, analytics review, and strategy session.',
  'social.monthlyPremium':          'Includes 25–40 pieces/month, full content strategy, paid ad creative, and monthly performance report.',
  'social.ugcPerVideo':             'Includes UGC-style filming, editing, and captions. Delivered raw (unbranded) for use in paid ads.',
  'social.brandCampaignProject':    'Includes campaign strategy, content creation, ad asset production, and post-campaign analytics summary.',
  'postProduction.videoEditingHourly':   'Includes rough cut through picture lock: cuts, transitions, titles, and lower thirds.',
  'postProduction.colorGradingHourly':   'Includes professional color correction and grading using DaVinci Resolve or equivalent. LUT available on request.',
  'postProduction.audioMixPerEp':        'Includes audio leveling, EQ, compression, noise reduction, and loudness mastering to platform specs.',
  'postProduction.motionGraphicsHourly': 'Includes animated titles, lower thirds, transitions, and branded graphics in After Effects or Premiere.',
  'postProduction.photoRetouchingPerImg':'Includes skin retouching, color correction, background cleanup, and object removal as needed.',
  'postProduction.shortProject':         'Includes full edit up to 3 minutes: assembly, music, titles, color, and one round of revisions.',
  'postProduction.mediumProject':        'Includes full edit 3–10 minutes: assembly, b-roll, music sync, graphics, color, and 2 revision rounds.',
  'postProduction.largeProject':         'Includes full edit 10+ minutes or complex deliverables: assembly, graphics, color, audio mix, and 3 revision rounds.',
  'liveevents.halfDayEvent':         'Includes up to 4 hours of on-site coverage, multi-camera operation, and same-day file backup.',
  'liveevents.fullDayEvent':         'Includes 8 hours on-site, multi-camera setup, live monitoring, and footage delivered within 5 business days.',
  'liveevents.multiDayEvent':        'Per-day rate includes full coverage day, equipment, and crew. Travel and accommodation billed at cost.',
  'liveevents.streamingSetup':       'Includes encoder configuration, multi-camera switching, platform broadcast, and post-event archive download.',
  'liveevents.highlightEdit':        'Includes 2–5 minute highlight reel: assembly, music, titles, color grade, and one revision round.',
  'liveevents.photographyEvent':     'Includes on-site photography, same-day culling, and delivery of edited selects within 48 hours.',
};

function SectionHeader({ title, open, onToggle, dark }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between py-2.5 border-b ${dark ? 'border-white/[0.07] text-white' : 'border-gray-200 text-gray-900'} font-semibold text-sm`}
    >
      {title}
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}

export function LineItemBuilder({ state, dispatch, dark = true }) {
  const {
    serviceId, regionKey, lineItems, equipment, travelType, travelMiles, travelMileRate,
    travelFee, assistants, assistantRate, locationFee, revisions, additionalRevisionRate,
    turnaround, customTurnaroundPct, licensingId, taxEnabled, taxRate,
    experienceLevel,
  } = state;

  const [sections, setSections] = useState({
    rates: true, equipment: false, travel: false,
    crew: false, turnaround: false, licensing: false, tax: false,
  });

  const toggleSection = (key) => setSections(s => ({ ...s, [key]: !s[key] }));

  const service = SERVICES[serviceId];
  const regionRates = serviceId && regionKey ? getRegionRates(serviceId, regionKey, experienceLevel) : {};
  const serviceRateConfig = serviceId ? RATES[serviceId] : {};
  const sym = '$';

  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const labelCls = `text-xs font-medium ${dark ? 'text-charcoal-300' : 'text-gray-500'}`;

  if (!serviceId) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-3 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
        <span className="text-4xl">👆</span>
        <p className="text-sm">Select a service type to start building your quote</p>
      </div>
    );
  }

  const allRateKeys = [
    ...(service.primaryRates || []),
    ...(service.packageRates || []),
  ];

  return (
    <div className="space-y-1">
      {/* ── Rates / Line Items ─── */}
      <SectionHeader title="Service Rates" open={sections.rates} onToggle={() => toggleSection('rates')} dark={dark} />
      {sections.rates && (
        <div className="py-3 space-y-4">
          {allRateKeys.map(rateKey => {
            const rateMeta = serviceRateConfig[rateKey];
            if (!rateMeta) return null;
            const regionRate = regionRates[rateKey];
            const item = lineItems.find(l => l.rateKey === rateKey);
            const active = item?.active ?? false;
            const currentVal = item?.value ?? regionRate?.current ?? 0;
            const qty = item?.quantity ?? 1;

            return (
              <div key={rateKey} className={`rounded-xl border p-3 transition-all ${
                active
                  ? dark ? 'border-gold-500/40 bg-charcoal-900/60' : 'border-gold-500/40 bg-gold-50/30'
                  : dark ? 'border-white/[0.08] bg-white/[0.03] opacity-70' : 'border-gray-200 bg-gray-50/50 opacity-60'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'active', value: e.target.checked, rateMeta, regionRate })}
                    className="accent-gold-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <span className={`text-sm font-medium flex-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {rateMeta.label}
                  </span>
                  <Tooltip content={rateMeta.tooltip} position="left">
                    <span />
                  </Tooltip>
                </div>
                {active && (() => {
                  const isHourly = rateMeta.unit === 'hr';
                  const isPhotoHourly = serviceId === 'photography' && isHourly && HOURLY_PHOTO_RATES.includes(rateKey);
                  const isVideoHourly = serviceId === 'video' && isHourly && HOURLY_VIDEO_RATES.includes(rateKey);
                  const showHoursSelect = isPhotoHourly || isVideoHourly;
                  const lineTotal = currentVal * qty;

                  return (
                    <div className="mt-1 space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <CurrencyInput
                          label="Rate per hr"
                          unit={rateMeta.unit}
                          value={currentVal}
                          range={regionRate}
                          dark={dark}
                          currencySymbol={sym}
                          onChange={v => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'value', value: v, rateMeta, regionRate })}
                        />
                        <div className="flex flex-col gap-1">
                          <label className={labelCls}>{showHoursSelect ? 'Hours' : 'Quantity'}</label>
                          {isPhotoHourly ? (
                            <select
                              value={qty}
                              onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'quantity', value: Number(e.target.value), rateMeta, regionRate })}
                              className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                            >
                              {PHOTO_HOURS.map(h => (
                                <option key={h} value={h}>{h} hours</option>
                              ))}
                            </select>
                          ) : isVideoHourly ? (
                            <select
                              value={qty}
                              onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'quantity', value: Number(e.target.value), rateMeta, regionRate })}
                              className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                            >
                              {VIDEO_HOURS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex flex-col gap-2 mt-1 w-full">
                              <input
                                type="range"
                                min={1}
                                max={getUnitMax(rateMeta.unit)}
                                value={qty}
                                onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'quantity', value: parseFloat(e.target.value) || 1, rateMeta, regionRate })}
                                className="tweak-slider w-full"
                                style={{
                                  '--p': `${((qty - 1) / (getUnitMax(rateMeta.unit) - 1)) * 100}%`
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>Qty:</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={qty}
                                  onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'quantity', value: parseFloat(e.target.value) || 1, rateMeta, regionRate })}
                                  className={`w-16 px-2 py-0.5 text-xs rounded border outline-none transition-all ${inputCls}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {showHoursSelect && (
                        <div className={`text-xs px-3 py-1.5 rounded-lg ${dark ? 'bg-charcoal-900/60 text-charcoal-300' : 'bg-gray-100 text-gray-500'}`}>
                          {qty} hrs × {sym}{currentVal.toLocaleString()}/hr = <span className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{sym}{lineTotal.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className={labelCls}>What's included</label>
                        <textarea
                          rows={2}
                          value={item?.description ?? (RATE_DESCRIPTIONS[`${serviceId}.${rateKey}`] || '')}
                          onChange={e => dispatch({ type: 'SET_LINE_ITEM', rateKey, field: 'description', value: e.target.value, rateMeta, regionRate })}
                          placeholder="Describe what's included at this rate (e.g. number of images, hours of coverage, revisions)..."
                          className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-all resize-none ${inputCls}`}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* Custom line item */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_CUSTOM_LINE' })}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-sm transition-colors ${
              dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/50 hover:text-gold-400' : 'border-gray-300 text-gray-400 hover:border-gold-500/50 hover:text-gold-500'
            }`}
          >
            <Plus size={14} /> Add Custom Line Item
          </button>

          {lineItems.filter(l => l.isCustom).map((item, idx) => (
            <div key={item.id} className={`rounded-xl border p-3 ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-white'}`}>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.label || ''}
                  onChange={e => dispatch({ type: 'SET_CUSTOM_LINE', id: item.id, field: 'label', value: e.target.value })}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                />
                <button type="button" onClick={() => dispatch({ type: 'REMOVE_CUSTOM_LINE', id: item.id })}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput label="Rate" value={item.value} dark={dark} currencySymbol={sym}
                  onChange={v => dispatch({ type: 'SET_CUSTOM_LINE', id: item.id, field: 'value', value: v })} />
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Quantity</label>
                  <input type="number" min={0} value={item.quantity || 1}
                    onChange={e => dispatch({ type: 'SET_CUSTOM_LINE', id: item.id, field: 'quantity', value: parseFloat(e.target.value) || 1 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Equipment ─── */}
      <SectionHeader title="Equipment & Gear" open={sections.equipment} onToggle={() => toggleSection('equipment')} dark={dark} />
      {sections.equipment && (
        <div className="py-3 space-y-2">
          {EQUIPMENT_ITEMS.map(eq => {
            const item = equipment.find(e => e.id === eq.id);
            const active = item?.active ?? false;
            const price = item?.price ?? eq.defaultPrice;
            const days = item?.days ?? 1;
            return (
              <div key={eq.id} className={`rounded-xl border px-3 py-2.5 transition-all ${
                active
                  ? dark ? 'border-gold-500/40 bg-charcoal-950/55' : 'border-gold-500/40 bg-gold-50/30'
                  : dark ? 'border-white/[0.08] opacity-70' : 'border-gray-200 opacity-60'
              }`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={active}
                    onChange={e => dispatch({ type: 'SET_EQUIPMENT', id: eq.id, field: 'active', value: e.target.checked, defaultPrice: eq.defaultPrice })}
                    className="accent-gold-500 w-4 h-4 cursor-pointer" />
                  <span className="text-sm">{eq.icon}</span>
                  <span className={`flex-1 text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>{eq.label}</span>
                  {active && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center">
                        <span className={`absolute left-2 text-xs pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{sym}</span>
                        <input type="number" min={0} value={price}
                          onChange={e => dispatch({ type: 'SET_EQUIPMENT', id: eq.id, field: 'price', value: parseFloat(e.target.value) || 0 })}
                          className={`w-24 pl-5 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`} />
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <input type="range" min={1} max={14} value={days}
                          onChange={e => dispatch({ type: 'SET_EQUIPMENT', id: eq.id, field: 'days', value: parseInt(e.target.value) || 1 })}
                          className="tweak-slider w-20"
                          style={{ '--p': `${((days - 1) / 13) * 100}%` }}
                        />
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} value={days}
                            onChange={e => dispatch({ type: 'SET_EQUIPMENT', id: eq.id, field: 'days', value: parseInt(e.target.value) || 1 })}
                            className={`w-10 px-1 py-0.5 text-xs rounded border outline-none transition-all text-center ${inputCls}`} />
                          <span className={`text-[10px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>days</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Travel ─── */}
      <SectionHeader title="Travel" open={sections.travel} onToggle={() => toggleSection('travel')} dark={dark} />
      {sections.travel && (
        <div className="py-3 space-y-3">
          <div className="flex gap-2">
            {['mileage', 'flat', 'none'].map(t => (
              <button key={t} type="button"
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'travelType', value: t })}
                className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-all ${
                  travelType === t
                    ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                    : dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t === 'mileage' ? '🚗 Mileage' : t === 'flat' ? '💵 Flat Fee' : '✕ None'}
              </button>
            ))}
          </div>
          {travelType === 'mileage' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Miles</label>
                <div className="flex flex-col gap-2 mt-1">
                  <input type="range" min={0} max={200} value={travelMiles || 0}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'travelMiles', value: parseFloat(e.target.value) || 0 })}
                    className="tweak-slider w-full"
                    style={{ '--p': `${(travelMiles / 200) * 100}%` }}
                  />
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={travelMiles || ''}
                      onChange={e => dispatch({ type: 'SET_FIELD', field: 'travelMiles', value: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className={`w-20 px-2 py-0.5 text-xs rounded border outline-none transition-all ${inputCls}`} />
                    <span className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>miles</span>
                  </div>
                </div>
              </div>
              <CurrencyInput label="Rate per mile" value={travelMileRate || 0.67} dark={dark} currencySymbol={sym}
                onChange={v => dispatch({ type: 'SET_FIELD', field: 'travelMileRate', value: v })} />
            </div>
          )}
          {travelType === 'flat' && (
            <CurrencyInput label="Flat travel fee" value={travelFee || 0} dark={dark} currencySymbol={sym}
              onChange={v => dispatch({ type: 'SET_FIELD', field: 'travelFee', value: v })} />
          )}
        </div>
      )}

      {/* ── Crew ─── */}
      <SectionHeader title="Crew & Location" open={sections.crew} onToggle={() => toggleSection('crew')} dark={dark} />
      {sections.crew && (
        <div className="py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Assistants / 2nd Shooters</label>
              <div className="flex flex-col gap-2 mt-1">
                <input type="range" min={0} max={5} value={assistants || 0}
                  onChange={e => dispatch({ type: 'SET_FIELD', field: 'assistants', value: parseInt(e.target.value) || 0 })}
                  className="tweak-slider w-full"
                  style={{ '--p': `${(assistants / 5) * 100}%` }}
                />
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={assistants || ''}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'assistants', value: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className={`w-16 px-2 py-0.5 text-xs rounded border outline-none transition-all ${inputCls}`} />
                  <span className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>assistants</span>
                </div>
              </div>
            </div>
            <CurrencyInput label="Rate per person/day" value={assistantRate || 0} dark={dark} currencySymbol={sym}
              onChange={v => dispatch({ type: 'SET_FIELD', field: 'assistantRate', value: v })} />
          </div>
          <CurrencyInput label="Location / Permit Fee (flat)" value={locationFee || 0} dark={dark} currencySymbol={sym}
            onChange={v => dispatch({ type: 'SET_FIELD', field: 'locationFee', value: v })} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Revisions included</label>
              <div className="flex flex-col gap-2 mt-1">
                <input type="range" min={0} max={10} value={revisions ?? 2}
                  onChange={e => dispatch({ type: 'SET_FIELD', field: 'revisions', value: parseInt(e.target.value) || 0 })}
                  className="tweak-slider w-full"
                  style={{ '--p': `${((revisions ?? 2) / 10) * 100}%` }}
                />
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={revisions ?? 2}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'revisions', value: parseInt(e.target.value) || 0 })}
                    className={`w-16 px-2 py-0.5 text-xs rounded border outline-none transition-all ${inputCls}`} />
                  <span className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>revisions</span>
                </div>
              </div>
            </div>
            <CurrencyInput label="Cost per extra revision" value={additionalRevisionRate || 0} dark={dark} currencySymbol={sym}
              onChange={v => dispatch({ type: 'SET_FIELD', field: 'additionalRevisionRate', value: v })} />
          </div>
        </div>
      )}

      {/* ── Turnaround ─── */}
      <SectionHeader title="Turnaround" open={sections.turnaround} onToggle={() => toggleSection('turnaround')} dark={dark} />
      {sections.turnaround && (
        <div className="py-3 space-y-2">
          {TURNAROUND_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'turnaround', value: opt.id })}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${
                turnaround === opt.id
                  ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                  : dark ? 'border-white/[0.08] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div>
                <span className="font-medium">{opt.label}</span>
                <span className={`ml-2 text-xs ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{opt.days}</span>
              </div>
              <span className={`text-xs font-semibold ${turnaround === opt.id ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
                {opt.description}
              </span>
            </button>
          ))}
          {turnaround === 'custom' && (
            <div className="flex flex-col gap-1 mt-2">
              <label className={labelCls}>Custom rush % (added to subtotal)</label>
              <div className="relative flex items-center">
                <input type="number" min={0} max={200} value={customTurnaroundPct || ''}
                  onChange={e => dispatch({ type: 'SET_FIELD', field: 'customTurnaroundPct', value: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className={`w-full pl-3 pr-8 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`} />
                <span className={`absolute right-3 text-xs pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Licensing ─── */}
      <SectionHeader title="Licensing / Usage Rights" open={sections.licensing} onToggle={() => toggleSection('licensing')} dark={dark} />
      {sections.licensing && (
        <div className="py-3 space-y-2">
          {LICENSING_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'licensingId', value: opt.id })}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${
                licensingId === opt.id
                  ? 'border-gold-500/60 bg-gold-500/10 text-gold-400'
                  : dark ? 'border-white/[0.08] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div>
                <span className="font-medium">{opt.label}</span>
                <span className={`ml-2 text-xs ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{opt.description}</span>
              </div>
              <span className={`text-xs font-bold ${licensingId === opt.id ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
                ×{opt.multiplier.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Tax ─── */}
      <SectionHeader title="Tax" open={sections.tax} onToggle={() => toggleSection('tax')} dark={dark} />
      {sections.tax && (
        <div className="py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>Apply sales tax / VAT</span>
            <button type="button"
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'taxEnabled', value: !taxEnabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${taxEnabled ? 'bg-gold-500' : dark ? 'bg-white/[0.09]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${taxEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {taxEnabled && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Tax rate (%)</label>
              <div className="relative flex items-center">
                <input type="number" min={0} max={50} step={0.1} value={taxRate || ''}
                  onChange={e => dispatch({ type: 'SET_FIELD', field: 'taxRate', value: parseFloat(e.target.value) || 0 })}
                  placeholder="8.5"
                  className={`w-full pl-3 pr-8 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`} />
                <span className={`absolute right-3 text-xs pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
