import { useState } from 'react';
import { Download, Eye, List, Copy, Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { formatCurrency, getRate } from '../utils/pricing.js';
import { REGIONS } from '../data/regions.js';
import { SERVICES, RATES } from '../data/rates.js';

// ── Helpers ───────────────────────────────────────────────────
const CATEGORY_META = {
  service:   { icon: '🎬', label: 'Service',   color: 'text-white' },
  equipment: { icon: '🔧', label: 'Equipment', color: 'text-gold-400' },
  travel:    { icon: '🚗', label: 'Travel',    color: 'text-gold-400' },
  crew:      { icon: '👥', label: 'Crew',      color: 'text-gold-400' },
  location:  { icon: '📍', label: 'Location',  color: 'text-gold-400' },
  licensing: { icon: '📋', label: 'Licensing', color: 'text-gold-400' },
  rush:      { icon: '⚡', label: 'Rush Fee',  color: 'text-gold-400' },
};

const RATE_JUSTIFICATIONS = {
  service: (range, experienceLevel, regionName) =>
    `Based on ${experienceLevel || 'mid-level'} market rates for ${regionName}. ` +
    (range ? `Market range for this region: ${range.low?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} – ${range.high?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.` : ''),
  equipment: () => 'Standard equipment rental fee charged separately to cover gear depreciation, maintenance, and insurance.',
  travel:    () => 'Covers fuel, time, and wear for travel to the shoot location.',
  crew:      () => 'Industry-standard assistant/second shooter rate. Additional crew enables faster turnaround and higher production quality.',
  location:  () => 'Permit costs, studio rental, or location access fees passed through at cost.',
  licensing: (_, __, ___, opt) => `Usage rights premium: you are purchasing a ${opt?.label || 'usage'} license. Broader usage rights command higher fees to reflect commercial value of the content.`,
  rush:      (_a, _b, _c, _d, pct) => `Rush surcharge of ${pct}% applied to expedited timeline. This covers overtime, rescheduled personal commitments, and priority workflow.`,
};

function RangePill({ value, range, dark }) {
  if (!range || !value) return null;
  const { low, high, mid } = range;
  const span = high - low;
  const pct = span > 0 ? Math.max(4, Math.min(96, ((value - low) / span) * 100)) : 50;

  let status, color;
  if (value < low * 0.85)       { status = 'Below market'; color = 'text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/15'; }
  else if (value < low)         { status = 'Slightly low';  color = 'text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/15'; }
  else if (value > high * 1.1)  { status = 'Premium';       color = 'text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/15'; }
  else                          { status = 'Market rate';   color = 'text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/15'; }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className={`${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
          Market: ${low?.toLocaleString()} – ${high?.toLocaleString()}
          <span className={`ml-2 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>(mid: ${mid?.toLocaleString()})</span>
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${color}`}>{status}</span>
      </div>
      <div className={`relative h-1.5 rounded-full ${dark ? 'bg-white/[0.04]' : 'bg-gray-200'} overflow-hidden`}>
        <div className="absolute top-0 bottom-0 bg-white/[0.08] rounded-full"
          style={{ left: 0, width: '100%' }} />
        <div className="absolute top-0 bottom-0 bg-[#c9a84c]/30 rounded-full"
          style={{ left: `${0}%`, width: `${100}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#c9a84c] ring-2 ring-[#0d0d0f] transition-all"
          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }} />
      </div>
    </div>
  );
}

function LineItemRow({ line, serviceId, regionKey, experienceLevel, regionName, dark, isCreator }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[line.category] || CATEGORY_META.service;

  // Try to get market range for this line item
  const rateRange = line.rateKey && serviceId ? getRate(serviceId, line.rateKey, regionKey) : null;

  const expLabel = { entry: 'Qualified (2-3 yrs)', mid: 'Established (4-6 yrs)', senior: 'Senior/Expert (7+ yrs)' }[experienceLevel] || 'Established';

  const justification = (() => {
    const fn = RATE_JUSTIFICATIONS[line.category];
    if (!fn) return null;
    return fn(rateRange, expLabel, regionName, line._licensingOpt, line._rushPct);
  })();

  return (
    <div className={`rounded-xl border transition-all ${
      expanded
        ? dark ? 'border-[#c9a84c]/30 bg-white/[0.02]' : 'border-[#c9a84c]/30 bg-gold-50/30'
        : dark ? 'border-white/[0.07] bg-white/[0.01]' : 'border-gray-100 bg-white'
    }`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="text-base leading-none mt-0.5 shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'} leading-snug`}>{line.label}</p>
          {line.note && (
            <p className={`text-[11px] mt-0.5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{line.note}</p>
          )}
          {/* Quantity × rate */}
          {line.rate != null && line.quantity != null && (
            <p className={`text-[11px] mt-0.5 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
              ${line.rate?.toLocaleString()} × {line.quantity}{line.unit ? ` ${line.unit}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-bold serif ${dark ? 'text-white' : 'text-gray-900'}`}>
            ${line.subtotal?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          {/* Expand button */}
          {(rateRange || justification) && (
            <button type="button" onClick={() => setExpanded(e => !e)}
              className={`p-1 rounded-md transition-colors ${
                dark ? 'text-charcoal-500 hover:text-[#c9a84c] hover:bg-white/[0.04]' : 'text-gray-400 hover:text-[#c9a84c] hover:bg-gray-100'
              }`}
              title="Show pricing detail"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`px-3.5 pb-3.5 border-t ${dark ? 'border-white/[0.07]' : 'border-gray-155'} pt-2.5 space-y-2`}>
          {/* Justification text */}
          {justification && (
            <div className={`flex gap-2 text-xs leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              <Info size={12} className="text-[#c9a84c] shrink-0 mt-0.5" />
              <p>{justification}</p>
            </div>
          )}

          {/* Rate range chart */}
          {rateRange && isCreator && (
            <RangePill value={line.rate} range={rateRange} dark={dark} />
          )}

          {/* Experience level note */}
          {line.category === 'service' && (
            <p className={`text-[10px] ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
              Experience modifier applied: <span className={`font-semibold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{expLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Simple (client-facing) view ───────────────────────────────
function QuoteSimple({ quote, state, dark }) {
  const { currency = 'USD', exchangeRates } = state;
  const fmt = (v) => formatCurrency(v, currency, exchangeRates);
  const region  = REGIONS[state.regionKey];
  const service = SERVICES[state.serviceId];
  const today   = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const deliveryDays = { standard: 14, rush: 5, 'same-day': 1, custom: state.customTurnaroundDays || 7 };
  const days = deliveryDays[state.turnaround] || 14;
  const deliveryDate = new Date(Date.now() + days * 86400000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className={`liquid-glass rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-5 border-b ${dark ? 'border-white/[0.07] bg-charcoal-950/40' : 'border-gray-100 bg-gray-50'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Production Estimate</p>
            <h2 className="text-4xl sm:text-5xl font-bold serif gold-text leading-none mt-2">
              {fmt(quote.grandTotal)}
            </h2>
            {state.clientName && (
              <p className={`text-xs mt-2.5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                For <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{state.clientName}</span>
              </p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{today}</p>
            {state.quoteNumber && <p className={`text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'} mt-0.5`}>#{state.quoteNumber}</p>}
            {service && <p className={`text-sm mt-2 font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>{service.icon} {service.name}</p>}
            {region  && <p className={`text-xs mt-0.5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{region.flag} {region.name}</p>}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Totals grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Services',  value: fmt(quote.servicesSubtotal) },
            { label: 'Tax',       value: quote.taxAmount > 0 ? fmt(quote.taxAmount) : '-' },
            { label: 'Total Due', value: fmt(quote.grandTotal), highlight: true },
          ].map(item => (
            <div key={item.label} className={`rounded-xl px-3 py-3.5 text-center border ${
              item.highlight
                ? 'bg-[#c9a84c]/10 border-[#c9a84c]/20'
                : dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${dark ? 'text-charcoal-400' : 'text-gray-455'}`}>{item.label}</p>
              <p className={`text-sm font-bold ${item.highlight ? 'text-[#c9a84c] serif text-base' : dark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* What's included */}
        {quote.lines.filter(l => ['service','equipment'].includes(l.category)).length > 0 && (
          <div className={`rounded-xl px-4 py-3 border ${dark ? 'bg-white/[0.01] border-white/[0.06]' : 'bg-gray-50 border-gray-150'}`}>
            <p className="eyebrow mb-2">What's Included</p>
            <div className="space-y-1.5 mt-2">
              {quote.lines.filter(l => ['service','equipment'].includes(l.category)).slice(0, 8).map(line => (
                <div key={line.id} className="flex justify-between items-baseline gap-2">
                  <span className={`text-xs truncate ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{line.label}</span>
                  <span className={`text-xs font-semibold shrink-0 serif ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{fmt(line.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery + revisions */}
        <div className="flex gap-3 text-sm">
          <div className={`flex-1 rounded-xl px-3 py-2.5 border ${dark ? 'bg-white/[0.01] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>Est. Delivery</p>
            <p className={`text-xs font-semibold serif ${dark ? 'text-white' : 'text-gray-900'}`}>{deliveryDate}</p>
          </div>
          {quote.revisionsNote && (
            <div className={`flex-1 rounded-xl px-3 py-2.5 border ${dark ? 'bg-white/[0.01] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>Revisions</p>
              <p className={`text-xs leading-relaxed ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{quote.revisionsNote}</p>
            </div>
          )}
        </div>

        {/* 50/50 Escrow Box */}
        <div className={`p-4 rounded-xl border ${dark ? 'bg-[#c9a84c]/[0.02] border-[#c9a84c]/15' : 'bg-gold-50/20 border-gold-200/50'}`}>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[#c9a84c] font-bold mb-2">50/50 escrow split</div>
          <div className="flex justify-between text-xs py-1">
            <span className={`${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Held on booking (50%)</span>
            <span className="serif text-[#c9a84c] font-bold">{fmt(quote.grandTotal / 2)}</span>
          </div>
          <div className="flex justify-between text-xs py-1">
            <span className={`${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Released on delivery (50%)</span>
            <span className="serif text-[#c9a84c] font-bold">{fmt(quote.grandTotal / 2)}</span>
          </div>
        </div>

        {/* Notes */}
        {state.notes && (
          <div className={`rounded-xl px-4 py-3 border-l-2 border-[#c9a84c]/50 ${dark ? 'bg-white/[0.02]' : 'bg-gold-50/50'}`}>
            <p className="eyebrow mb-1">Notes & Terms</p>
            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{state.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Itemized view ─────────────────────────────────────────────
function QuoteItemized({ quote, state, dark, creatorMode }) {
  const { currency = 'USD', exchangeRates } = state;
  const fmt        = (v) => formatCurrency(v, currency, exchangeRates);
  const region     = REGIONS[state.regionKey];
  const regionName = region ? `${region.flag} ${region.name}` : '';

  const expLabel = {
    entry:  'Qualified (2-3 yrs)',
    mid:    'Established (4-6 yrs)',
    senior: 'Senior/Expert (7+ yrs)',
  }[state.experienceLevel] || 'Established';

  // Enrich lines with extra metadata for tooltips
  const enrichedLines = quote.lines.map(line => {
    const rateRange = line.rateKey && state.serviceId
      ? getRate(state.serviceId, line.rateKey, state.regionKey)
      : null;
    return { ...line, rateRange, _expLabel: expLabel };
  });

  const grouped = {
    service:   enrichedLines.filter(l => l.category === 'service'),
    equipment: enrichedLines.filter(l => l.category === 'equipment'),
    other:     enrichedLines.filter(l => !['service','equipment'].includes(l.category)),
  };

  const SectionHead = ({ icon, title, count }) => (
    <div className={`flex items-center gap-2 py-2 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'} mb-2`}>
      <span className="text-sm">{icon}</span>
      <span className="eyebrow">{title}</span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${dark ? 'bg-white/[0.04] text-charcoal-400' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
    </div>
  );

  return (
    <div className={`liquid-glass rounded-2xl overflow-hidden`}>
      {/* Header strip */}
      <div className={`px-5 py-4 border-b ${dark ? 'border-white/[0.07] bg-charcoal-950/40' : 'border-gray-200 bg-gray-50'}`}>
        <div>
          <h3 className={`font-display font-semibold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Itemized Breakdown</h3>
          <p className={`text-[10px] mt-1.5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
            {regionName} · {expLabel} · Click any line for pricing details
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Service lines */}
        {grouped.service.length > 0 && (
          <div>
            <SectionHead icon="🎬" title="Service Items" count={grouped.service.length} />
            <div className="space-y-1.5">
              {grouped.service.map((line, i) => (
                <LineItemRow key={line.id || i} line={line}
                  serviceId={state.serviceId} regionKey={state.regionKey}
                  experienceLevel={state.experienceLevel} regionName={regionName}
                  dark={dark} isCreator={creatorMode} />
              ))}
            </div>
          </div>
        )}

        {/* Equipment lines */}
        {grouped.equipment.length > 0 && (
          <div>
            <SectionHead icon="🔧" title="Equipment & Gear" count={grouped.equipment.length} />
            <div className="space-y-1.5">
              {grouped.equipment.map((line, i) => (
                <LineItemRow key={line.id || i} line={line}
                  serviceId={state.serviceId} regionKey={state.regionKey}
                  experienceLevel={state.experienceLevel} regionName={regionName}
                  dark={dark} isCreator={creatorMode} />
              ))}
            </div>
          </div>
        )}

        {/* Other (travel, crew, licensing, rush, etc.) */}
        {grouped.other.length > 0 && (
          <div>
            <SectionHead icon="➕" title="Additional Fees" count={grouped.other.length} />
            <div className="space-y-1.5">
              {grouped.other.map((line, i) => (
                <LineItemRow key={line.id || i} line={line}
                  serviceId={state.serviceId} regionKey={state.regionKey}
                  experienceLevel={state.experienceLevel} regionName={regionName}
                  dark={dark} isCreator={creatorMode} />
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className={`rounded-xl border ${dark ? 'bg-white/[0.01] border-white/[0.06]' : 'bg-gray-50 border-gray-200'} overflow-hidden`}>
          <div className="divide-y divide-white/[0.06] px-4">
            <div className="flex justify-between py-2.5 text-xs">
              <span className={dark ? 'text-charcoal-300' : 'text-gray-600'}>Subtotal</span>
              <span className={`serif font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{fmt(quote.subtotalPreTax)}</span>
            </div>
            {quote.taxAmount > 0 && (
              <div className="flex justify-between py-2.5 text-xs">
                <span className={dark ? 'text-charcoal-300' : 'text-gray-600'}>
                  Tax ({quote.taxRate}%)
                  <span className={`ml-1 text-[9px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>(VAT / sales tax)</span>
                </span>
                <span className={`serif font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{fmt(quote.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3.5">
              <span className="eyebrow text-sm font-bold pt-1">TOTAL DUE</span>
              <span className="font-bold text-gradient-gold text-2xl serif leading-none">{fmt(quote.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Profit margin – creator only */}
        {creatorMode && quote.profitMargin !== null && (
          <div className={`rounded-xl border px-4 py-3.5 ${dark ? 'bg-[#c9a84c]/[0.02] border-[#c9a84c]/15' : 'bg-gold-50/20 border-gold-250/50'}`}>
            <p className="eyebrow mb-2">Profit Analysis</p>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              {[
                { label: 'Revenue', value: fmt(quote.grandTotal) },
                { label: 'Costs',   value: fmt(quote.totalCost) },
                { label: 'Margin',  value: `${quote.profitMargin}%`, highlight: true },
              ].map(item => (
                <div key={item.label}>
                  <p className={`text-[10px] uppercase font-semibold ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>{item.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${item.highlight ? 'text-[#c9a84c] serif' : dark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full transition-all bg-[#c9a84c]"
                style={{ width: `${Math.max(2, Math.min(100, quote.profitMargin))}%` }}
              />
            </div>
            <p className={`text-[10px] leading-relaxed mt-2 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
              {quote.profitMargin >= 60 ? 'Excellent margin - well-priced for your costs.' :
               quote.profitMargin >= 40 ? 'Healthy margin. Room to absorb unexpected expenses.' :
               quote.profitMargin >= 20 ? 'Slim margin. Consider adjusting rates or reducing costs.' :
               'Low margin. You may be undercharging relative to your costs.'}
            </p>
          </div>
        )}

        {/* 50/50 Escrow Box */}
        <div className={`p-4 rounded-xl border ${dark ? 'bg-[#c9a84c]/[0.02] border-[#c9a84c]/15' : 'bg-gold-50/20 border-gold-200/50'}`}>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[#c9a84c] font-bold mb-2">50/50 escrow split</div>
          <div className="flex justify-between text-xs py-1">
            <span className={`${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Held on booking (50%)</span>
            <span className="serif text-[#c9a84c] font-bold">{fmt(quote.grandTotal / 2)}</span>
          </div>
          <div className="flex justify-between text-xs py-1">
            <span className={`${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Released on delivery (50%)</span>
            <span className="serif text-[#c9a84c] font-bold">{fmt(quote.grandTotal / 2)}</span>
          </div>
        </div>

        {/* Revisions note */}
        {quote.revisionsNote && (
          <p className={`text-xs px-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{quote.revisionsNote}</p>
        )}

        {/* Notes */}
        {state.notes && (
          <div className={`rounded-xl px-4 py-3 border-l-2 border-[#c9a84c]/40 ${dark ? 'bg-white/[0.02]' : 'bg-gold-50/30'}`}>
            <p className="eyebrow mb-1">Notes & Terms</p>
            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{state.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export function QuoteOutput({ quote, state, onExportPDF, dark = true, creatorMode = true }) {
  const [view, setView]     = useState('simple');
  const [copied, setCopied] = useState(false);

  const { currency = 'USD', exchangeRates } = state;
  const fmt = (v) => formatCurrency(v, currency, exchangeRates);

  const copyToClipboard = () => {
    const text =
      `Production Estimate${state.clientName ? ` for ${state.clientName}` : ''}\n` +
      `${new Date().toLocaleDateString()}\n\n` +
      quote.lines.map(l => `${l.label}: ${fmt(l.subtotal)}`).join('\n') +
      `\n\nTotal: ${fmt(quote.grandTotal)}` +
      (state.notes ? `\n\nNotes: ${state.notes}` : '');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!quote || quote.grandTotal === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border ${dark ? 'border-white/[0.07] text-charcoal-500' : 'border-gray-200 text-gray-400'}`}>
        <span className="text-4xl">💰</span>
        <p className="text-sm text-center px-6">Enable line items in the builder to see your quote</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex rounded-xl border overflow-hidden ${dark ? 'border-white/[0.09]' : 'border-gray-200'}`}>
          {[
            { id: 'simple',   icon: Eye,  label: 'Client View' },
            { id: 'itemized', icon: List, label: 'Itemized' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                view === id
                  ? 'bg-[#c9a84c] text-[#0d0d0f]'
                  : dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={copyToClipboard}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              dark ? 'border-white/[0.09] text-charcoal-300 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'
            }`}
          >
            {copied ? <Check size={12} className="text-[#c9a84c]" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button type="button" onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#c9a84c] hover:bg-[#ddb96a] text-[#0d0d0f] text-xs font-bold transition-all"
          >
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      {view === 'simple'
        ? <QuoteSimple   quote={quote} state={state} dark={dark} />
        : <QuoteItemized quote={quote} state={state} dark={dark} creatorMode={creatorMode} />
      }
    </div>
  );
}
