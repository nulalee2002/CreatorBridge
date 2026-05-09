import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { centsToDisplay, statusBadgeClass, PROJECT_STATUSES, PLATFORM_FEES } from '../config/fees.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

function loadTransactions(creatorId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-transactions') || '[]');
    return all.filter(t => t.creatorId === creatorId || t.projectId).map(normalizeTransaction); // loose match in demo
  } catch { return []; }
}

function normalizeTransaction(t) {
  return {
    id: t.id,
    projectId: t.projectId || t.project_id,
    projectTitle: t.projectTitle || t.project_title || t.project_id || 'Project',
    creatorId: t.creatorId || t.creator_id,
    clientId: t.clientId || t.client_id,
    projectAmount: t.projectAmount ?? t.project_amount ?? 0,
    retainerAmount: t.retainerAmount ?? t.retainer_amount ?? 0,
    finalAmount: t.finalAmount ?? t.final_amount ?? 0,
    creatorFeeAmount: t.creatorFeeAmount ?? t.creator_fee_amount ?? 0,
    clientFeeAmount: t.clientFeeAmount ?? t.client_fee_amount ?? 0,
    platformRevenue: t.platformRevenue ?? t.platform_revenue ?? 0,
    retainerStatus: t.retainerStatus || t.retainer_status || 'pending',
    finalStatus: t.finalStatus || t.final_status || 'pending',
    retainerPaidAt: t.retainerPaidAt || t.retainer_paid_at,
    finalPaidAt: t.finalPaidAt || t.final_paid_at,
    createdAt: t.createdAt || t.created_at,
  };
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

  // Calculate stats (cents)
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const totalEarned = txns
    .filter(t => t.retainerStatus === 'paid' || t.finalStatus === 'paid')
    .reduce((sum, t) => {
      const retainer = t.retainerStatus === 'paid' ? (t.retainerAmount - t.creatorFeeAmount) : 0;
      const final    = t.finalStatus    === 'paid' ? (t.finalAmount    - t.creatorFeeAmount) : 0;
      return sum + retainer + final;
    }, 0);

  const pending = txns
    .filter(t => t.retainerStatus === 'paid' && t.finalStatus === 'pending')
    .reduce((sum, t) => sum + (t.finalAmount - (t.creatorFeeAmount || 0)), 0);

  const thisMonth = txns
    .filter(t => new Date(t.createdAt) >= monthStart)
    .reduce((sum, t) => sum + ((t.retainerAmount - (t.creatorFeeAmount || 0)) || 0), 0);

  const lastMonth = txns
    .filter(t => {
      const d = new Date(t.createdAt);
      return d >= lastStart && d < monthStart;
    })
    .reduce((sum, t) => sum + ((t.retainerAmount - (t.creatorFeeAmount || 0)) || 0), 0);

  const monthDiff = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                {txns.map((t, i) => {
                  const gross = (t.retainerAmount || 0) + (t.finalAmount || 0);
                  const fee   = (t.creatorFeeAmount || 0) * 2;
                  const net   = gross - fee;
                  const status = t.finalStatus === 'paid' ? 'completed'
                    : t.retainerStatus === 'paid' ? 'retainer_paid'
                    : 'pending';
                  return (
                    <tr key={t.id || i} className={`border-b last:border-0 transition-colors ${
                      dark ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                      <td className={`px-4 py-3 ${textSub}`}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                      </td>
                      <td className={`px-4 py-3 font-medium max-w-[140px] truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                        {t.projectTitle || t.projectId || 'Project'}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                        {centsToDisplay(gross)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gold-400">
                        -{centsToDisplay(fee)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold text-gold-400">
                        {centsToDisplay(net)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(status, dark)}`}>
                          {PROJECT_STATUSES[status]?.label || status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
