import { calcFees, PLATFORM_FEES } from '../config/fees.js';

/**
 * FeeBreakdown
 * Props:
 *   projectAmount   — number (dollars)
 *   viewMode        — 'client' | 'creator'
 *   dark            — boolean
 *   creatorFeePct   — number (optional, overrides default 10% for loyalty tiers)
 *   clientFeePct    — number (optional, overrides default 5% for referral rewards)
 */
export function FeeBreakdown({ projectAmount, viewMode = 'client', dark, creatorFeePct, clientFeePct }) {
  const f = calcFees(projectAmount || 0, creatorFeePct, clientFeePct);
  const displayedClientFeePct = clientFeePct ?? PLATFORM_FEES.clientFeePct;

  const cardCls  = `rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const divider  = `border-t my-3 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`;

  function fmt(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Mono-spaced row: label on left, amount on right
  function Row({ label, amount, sign = '', highlight = false, sub = false, bold = false, accent = '' }) {
    const labelCls = sub
      ? `text-xs pl-4 ${textSub}`
      : bold
      ? `text-sm font-bold ${accent || textMain}`
      : `text-sm ${textMain}`;
    const amountCls = bold
      ? `text-sm font-bold tabular-nums ${accent || textMain}`
      : sub
      ? `text-xs tabular-nums ${textSub}`
      : `text-sm tabular-nums ${textMain}`;

    const signColor = sign === '+' ? 'text-gold-400' : sign === '-' ? 'text-red-400' : '';

    return (
      <div className={`flex items-baseline justify-between gap-2 py-0.5 ${highlight ? (dark ? 'rounded-lg px-2 -mx-2 bg-gold-500/10' : 'rounded-lg px-2 -mx-2 bg-gold-50') : ''}`}>
        <span className={labelCls}>{label}</span>
        <span className={`${amountCls} shrink-0`}>
          {sign && <span className={`${signColor} mr-0.5`}>{sign}</span>}
          ${fmt(amount)}
        </span>
      </div>
    );
  }

  function SectionLabel({ children }) {
    return (
      <p className={`text-[10px] font-bold uppercase tracking-wider mt-4 mb-2 ${textSub}`}>{children}</p>
    );
  }

  return (
    <div className={cardCls}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-4 ${textSub}`}>Fee Breakdown</p>

      {/* Project total */}
      <Row label="Project Total" amount={f.projectTotal} bold />
      <div className={divider} />

      {viewMode === 'client' ? (
        <>
          <SectionLabel>Retainer fee (50% due now)</SectionLabel>
          <Row label="Retainer fee (50%)" amount={f.retainerAmount} />
          <Row label={`Booking fee (${displayedClientFeePct}%)`} amount={f.clientFeeRetainer} sign="+" sub />
          <Row label="Retainer due now" amount={f.retainerClientOwes} bold highlight accent="text-gold-400" />

          <SectionLabel>On Delivery (50%)</SectionLabel>
          <Row label="Final payment (50%)" amount={f.finalAmount} />
          <Row label={`Booking fee (${displayedClientFeePct}%)`} amount={f.clientFeeFinal} sign="+" sub />
          <Row label="Due on completion" amount={f.finalClientOwes} bold />

          <div className={divider} />
          <Row label="Total You Pay" amount={f.totalClientPays} bold accent="text-white" />
          <p className={`text-[10px] mt-2 ${textSub}`}>
            The {displayedClientFeePct}% booking fee is non-refundable once payment is processed.
          </p>
        </>
      ) : (
        <>
          <SectionLabel>Retainer Payment</SectionLabel>
          <Row label="Retainer payment (50%)" amount={f.retainerAmount} />
          <Row label={`Platform fee (${creatorFeePct ?? PLATFORM_FEES.creatorFeePct}%)`} amount={f.creatorFeeRetainer} sign="-" sub />
          <Row label="You receive" amount={f.retainerCreatorGets} bold highlight accent="text-gold-400" />

          <SectionLabel>Final Payment</SectionLabel>
          <Row label="Final payment (50%)" amount={f.finalAmount} />
          <Row label={`Platform fee (${creatorFeePct ?? PLATFORM_FEES.creatorFeePct}%)`} amount={f.creatorFeeFinal} sign="-" sub />
          <Row label="You receive" amount={f.finalCreatorGets} bold />

          <div className={divider} />
          <Row label="Total You Receive" amount={f.totalCreatorReceives} bold accent="text-gold-400" />
          <p className={`text-[10px] mt-2 ${textSub}`}>
            Funds are released after client approval or after {PLATFORM_FEES.autoApproveDays} days with no response.
          </p>
        </>
      )}
    </div>
  );
}
