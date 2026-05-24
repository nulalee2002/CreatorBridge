import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle, Minus } from 'lucide-react';
import { centsToDisplay, PLATFORM_FEES } from '../config/fees.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

function loadTransactions(creatorId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-transactions') || '[]');
    return all.filter(t => t.creatorId === creatorId || t.projectId).map(normalizeTransaction);
  } catch { return []; }
}

/**
 * Normalise a raw DB row to consistent camelCase fields.
 * DB schema: project_amount (cents), creator_fee_amount (cents),
 *            client_fee_pct (percentage), retainer_status, final_status
 *
 * Formulas (per Prompt 2 spec):
 *   creatorNet      = project_amount − creator_fee_amount
 *   platformRevenue = creator_fee_amount + (project_amount × client_fee_pct / 100)
 */
function normalizeTransaction(t) {
  const projectAmount    = t.project_amount    ?? t.projectAmount    ?? 0; // cents
  const creatorFeeAmount = t.creator_fee_amount ?? t.creatorFeeAmount ?? 0; // cents
  const clientFeePct     = t.client_fee_pct     ?? t.clientFeePct     ?? 0; // e.g. 5
  const clientFeeAmount  = Math.round(projectAmount * clientFeePct / 100);  // cents

  return {
    id:              t.id,
    projectId:       t.project_id    || t.projectId,
    creatorId:       t.creator_id    || t.creatorId,
    clientId:        t.client_id     || t.clientId,
    projectAmount,
    creatorFeeAmount,
    clientFeeAmount,
    platformRevenue: creatorFeeAmount + clientFeeAmount,
    creatorNet:      projectAmount - creatorFeeAmount,
    retainerStatus:  t.retainer_status  || t.retainerStatus  || 'pending',
    finalStatus:     t.final_status     || t.finalStatus     || 'pending',
    retainerPaidAt:  t.retainer_paid_at || t.retainerPaidAt,
    finalPaidAt:     t.final_paid_at    || t.finalPaidAt,
    finalReleasedAt: t.final_released_at || t.finalReleasedAt,
    createdAt:       t.created_at       || t.createdAt,
  };
}

/**
 * Badge colour for a transaction row.
 *  released → subtle green (money is in creator's account)
 *  paid     → muted gold  (held — awaiting auto-approve window)
 *  paid/in-progress → gold (retainer secured, work ongoing)
 *  pending  → dim charcoal
 */
function txnBadge(retainerStatus, finalStatus, dark) {
  if (finalStatus === 'released')
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (finalStatus === 'paid')
    return 'bg-gold-500/08 text-gold-500/60 border border-gold-500/15';
  if (retainerStatus === 'paid')
    return 'bg-gold-500/15 text-gold-400 border border-gold-500/20';
  return dark
    ? 'bg-charcoal-800/60 text-charcoal-400 border border-white/[0.07]'
    : 'bg-gray-100 text-gray-500 border border-gray-200';
}

function txnStatusLabel(retainerStatus, finalStatus) {
  if (finalStatus === 'released') return 'Paid Out';
  if (finalStatus === 'paid')     return 'Awaiting Release';
  if (retainerStatus === 'paid')  return 'In Progress';
  return 'Pending';
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-gold-400', dark }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={color} />
        <span className={`text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>{label}</span>
      </div>
      <p className={`font-display text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}

export function EarningsTab({ creator, dark }) {
  const [txns, setTxns] = useState([]);
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  useEffect(() => {
    if (!creator) return;
    if (supabaseConfigured) {
      supabase
        .from('transactions')
        .select('*')
        .eq('creator_id', creator.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setTxns((data || []).map(normalizeTransaction)));
    } else {
      setTxns(loadTransactions(creator.id));
    }
  }, [creator?.id]);

  // ── Stats (all values in cents) ────────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Money that has been fully released to the creator's Stripe account.
  const totalEarned = txns
    .filter(t => t.finalStatus === 'released')
    .reduce((s, t) => s + t.creatorNet, 0);

  // Money paid by the client but not yet released (inside the 3-day auto-approve window).
  const pending = txns
    .filter(t => t.finalStatus === 'paid')
    .reduce((s, t) => s + t.creatorNet, 0);

  // Earnings for transactions that started in the current / previous calendar months.
  const thisMonth = txns
    .filter(t => new Date(t.createdAt) >= monthStart && t.finalStatus !== 'pending')
    .reduce((s, t) => s + t.creatorNet, 0);

  const lastMonth = txns
    .filter(t => {
      const d = new Date(t.createdAt);
      return d >= lastStart && d < monthStart && t.finalStatus !== 'pending';
    })
    .reduce((s, t) => s + t.creatorNet, 0);

  const monthDiff = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : null;

  // Total platform fees the creator has paid across all active transactions.
  const totalFeesPaid = txns
    .filter(t => t.retainerStatus === 'paid')
    .reduce((s, t) => s + t.creatorFeeAmount, 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign} label="Total Earned" dark={dark} color="text-gold-400"
          value={centsToDisplay(totalEarned)} sub="After platform fees"
        />
        <StatCard
          icon={Clock} label="Pending Release" dark={dark} color="text-gold-400"
          value={centsToDisplay(pending)} sub="Awaiting delivery approval"
        />
        <StatCard
          icon={TrendingUp} label="This Month" dark={dark} color="text-gold-300"
          value={centsToDisplay(thisMonth)}
          sub={monthDiff !== null ? `${monthDiff >= 0 ? '+' : ''}${monthDiff}% vs last month` : 'First month'}
        />
        <StatCard
          icon={Minus} label="Platform Fees Paid" dark={dark} color="text-charcoal-400"
          value={centsToDisplay(totalFeesPaid)} sub={`${PLATFORM_FEES.creatorFeePct}% platform fee`}
        />
      </div>

      {/* Platform fee reminder */}
      <div className={`${cardCls} p-4 flex items-start gap-3`}>
        <CheckCircle size={16} className="text-gold-400 shrink-0 mt-0.5" />
        <p className={`text-xs leading-relaxed ${textSub}`}>
          CreatorBridge takes a {PLATFORM_FEES.creatorFeePct}% platform fee from your earnings.
          Clients are also charged a {PLATFORM_FEES.clientFeePct}% booking fee on top of your rate.
          Payments are released after client approval or auto-approved after {PLATFORM_FEES.autoApproveDays} days.
        </p>
      </div>

      {/* Transaction history */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
          <h3 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
            Transaction History
          </h3>
        </div>
        {txns.length === 0 ? (
          <div className={`text-center py-12 ${textSub}`}>
            <DollarSign size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-xs mt-1 opacity-70">
              Completed bookings will appear here. Connect Stripe to start accepting payments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${dark ? 'border-white/[0.07] text-charcoal-400' : 'border-gray-200 text-gray-400'}`}>
                  {['Date', 'Project', 'Gross', 'Fee', 'Net', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={t.id || i} className={`border-b last:border-0 transition-colors ${
                    dark ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                    <td className={`px-4 py-3 ${textSub}`}>
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                        : '-'}
                    </td>
                    {/* Show first 8 chars of project UUID as a short reference */}
                    <td className={`px-4 py-3 font-mono text-[11px] ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                      {t.projectId ? t.projectId.slice(0, 8).toUpperCase() : '-'}
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                      {centsToDisplay(t.projectAmount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gold-400/70">
                      -{centsToDisplay(t.creatorFeeAmount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold text-gold-400">
                      {centsToDisplay(t.creatorNet)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${txnBadge(t.retainerStatus, t.finalStatus, dark)}`}>
                        {txnStatusLabel(t.retainerStatus, t.finalStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
