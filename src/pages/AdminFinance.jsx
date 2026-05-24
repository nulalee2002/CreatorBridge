import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Clock, Briefcase, Download, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { centsToDisplay, PLATFORM_FEES } from '../config/fees.js';
import { exportCsv } from '../utils/exportCsv.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a raw transactions row.
 * platformRevenue = creator_fee_amount + (project_amount × client_fee_pct / 100)
 */
function normalizeRow(t) {
  const projectAmount    = t.project_amount    ?? 0;
  const creatorFeeAmount = t.creator_fee_amount ?? 0;
  const clientFeePct     = t.client_fee_pct     ?? PLATFORM_FEES.clientFeePct;
  const clientFeeAmount  = Math.round(projectAmount * clientFeePct / 100);

  return {
    id:              t.id,
    projectId:       t.project_id,
    creatorId:       t.creator_id,
    clientId:        t.client_id,
    projectAmount,
    creatorFeeAmount,
    clientFeeAmount,
    platformRevenue: creatorFeeAmount + clientFeeAmount,
    creatorNet:      projectAmount - creatorFeeAmount,
    retainerStatus:  t.retainer_status  || 'pending',
    finalStatus:     t.final_status     || 'pending',
    retainerPaidAt:  t.retainer_paid_at,
    finalPaidAt:     t.final_paid_at,
    finalReleasedAt: t.final_released_at,
    createdAt:       t.created_at,
  };
}

function txnStatusLabel(retainerStatus, finalStatus) {
  if (finalStatus === 'released') return 'Released';
  if (finalStatus === 'paid')     return 'Held';
  if (retainerStatus === 'paid')  return 'Active';
  return 'Pending';
}

function statusDot(retainerStatus, finalStatus) {
  if (finalStatus === 'released') return 'bg-emerald-400';
  if (finalStatus === 'paid')     return 'bg-gold-400/60';
  if (retainerStatus === 'paid')  return 'bg-gold-400';
  return 'bg-charcoal-500';
}

function fmt(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function shortId(uuid) {
  return uuid ? uuid.slice(0, 8).toUpperCase() : '-';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, sub, dark }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${
      dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={16} className="text-gold-400" />
        <span className={`text-[10px] font-bold tracking-widest uppercase ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
      <p className={`font-display text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}

const STATUS_OPTIONS = ['all', 'pending', 'active', 'held', 'released'];

// ── Main component ────────────────────────────────────────────────────────────

export function AdminFinance({ dark }) {
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [authError,   setAuthError]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  // ── Admin guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function guard() {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error || !data) { setAuthError(true); setLoading(false); }
    }
    guard();
  }, []);

  // ── Fetch transactions ───────────────────────────────────────────────────────
  useEffect(() => {
    if (authError) return;
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error('AdminFinance fetch error:', error);
      setRows((data || []).map(normalizeRow));
      setLoading(false);
    }
    fetchData();
  }, [authError]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = rows.filter(t => {
    // Status filter
    if (statusFilter !== 'all') {
      const label = txnStatusLabel(t.retainerStatus, t.finalStatus).toLowerCase();
      if (label !== statusFilter) return false;
    }
    // Date range filter
    if (dateFrom && new Date(t.createdAt) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(t.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  // ── Summary stats (all rows, not filtered) ───────────────────────────────────
  const totalRevenue   = rows.reduce((s, t) => s + t.platformRevenue, 0);
  const totalHeld      = rows.filter(t => t.finalStatus === 'paid')
                             .reduce((s, t) => s + t.creatorNet, 0);
  const totalReleased  = rows.filter(t => t.finalStatus === 'released')
                             .reduce((s, t) => s + t.creatorNet, 0);
  const activeJobs     = rows.filter(t => t.retainerStatus === 'paid' && t.finalStatus === 'pending').length;

  // ── CSV export ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const csvRows = filtered.map(t => ({
      Date:             fmt(t.createdAt),
      'Project Ref':    shortId(t.projectId),
      'Creator Ref':    shortId(t.creatorId),
      'Client Ref':     shortId(t.clientId),
      'Gross ($)':      (t.projectAmount    / 100).toFixed(2),
      'Creator Fee ($)': (t.creatorFeeAmount / 100).toFixed(2),
      'Client Fee ($)': (t.clientFeeAmount  / 100).toFixed(2),
      'Platform Revenue ($)': (t.platformRevenue / 100).toFixed(2),
      'Creator Net ($)': (t.creatorNet      / 100).toFixed(2),
      'Retainer Status': t.retainerStatus,
      'Final Status':    t.finalStatus,
    }));
    exportCsv(csvRows, `creatorbridge-finance-${new Date().toISOString().slice(0, 10)}`);
  }, [filtered]);

  // ── UI states ────────────────────────────────────────────────────────────────
  const thCls    = `px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-charcoal-400' : 'text-gray-400'}`;
  const tdCls    = `px-4 py-3 text-xs tabular-nums ${dark ? 'text-charcoal-300' : 'text-gray-600'}`;
  const inputCls = `rounded-xl border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gold-500/40 ${
    dark ? 'bg-charcoal-800 border-white/[0.08] text-white placeholder-charcoal-500'
         : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`;
  const cardCls  = `rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className={`text-sm ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
          Access denied — platform admin only.
        </p>
      </main>
    );
  }

  return (
    <main className={`min-h-screen px-5 sm:px-8 lg:px-12 py-10 ${dark ? '' : 'bg-gray-50'}`}>
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Heading */}
        <div>
          <p className={`text-[10px] font-bold tracking-[0.22em] uppercase mb-1 ${dark ? 'text-gold-500/70' : 'text-gold-600'}`}>
            Admin
          </p>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            Finance Overview
          </h1>
          <p className={`mt-1 text-sm ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
            Platform revenue, transaction ledger, and payouts.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={TrendingUp} label="Total Platform Revenue" dark={dark}
            value={centsToDisplay(totalRevenue)}
            sub="Creator + client fees"
          />
          <SummaryCard
            icon={Clock} label="Held — Awaiting Release" dark={dark}
            value={centsToDisplay(totalHeld)}
            sub="Inside 3-day approval window"
          />
          <SummaryCard
            icon={DollarSign} label="Total Released to Creators" dark={dark}
            value={centsToDisplay(totalReleased)}
            sub="Successfully paid out"
          />
          <SummaryCard
            icon={Briefcase} label="Active Jobs" dark={dark}
            value={String(activeJobs)}
            sub="Retainer paid, delivery pending"
          />
        </div>

        {/* Toolbar */}
        <div className={`${cardCls} px-5 py-4 flex flex-wrap items-center gap-3`}>
          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`appearance-none pr-8 ${inputCls}`}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <ChevronDown size={12} className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`} />
          </div>

          {/* Date range */}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} placeholder="From" />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={inputCls} placeholder="To" />

          <div className="flex-1" />

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>

        {/* Transaction ledger */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className={`px-5 py-4 border-b flex items-center justify-between ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
            <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
              Transaction Ledger
            </h2>
            <span className={`text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
              {filtered.length} of {rows.length} transactions
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className={`py-14 text-center ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
              <DollarSign size={28} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No transactions match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`border-b ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Project</th>
                    <th className={thCls}>Creator</th>
                    <th className={thCls}>Client</th>
                    <th className={thCls}>Gross</th>
                    <th className={thCls}>Creator Fee</th>
                    <th className={thCls}>Client Fee</th>
                    <th className={thCls}>Platform Rev</th>
                    <th className={thCls}>Creator Net</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id || i} className={`border-b last:border-0 transition-colors ${
                      dark ? 'border-white/[0.06] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                      <td className={`${tdCls} ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
                        {fmt(t.createdAt)}
                      </td>
                      <td className={`px-4 py-3 font-mono text-[11px] ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                        {shortId(t.projectId)}
                      </td>
                      <td className={`px-4 py-3 font-mono text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
                        {shortId(t.creatorId)}
                      </td>
                      <td className={`px-4 py-3 font-mono text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
                        {shortId(t.clientId)}
                      </td>
                      <td className={tdCls}>{centsToDisplay(t.projectAmount)}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-gold-400/70">
                        -{centsToDisplay(t.creatorFeeAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-gold-400/70">
                        -{centsToDisplay(t.clientFeeAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums font-bold text-gold-400">
                        {centsToDisplay(t.platformRevenue)}
                      </td>
                      <td className={tdCls}>{centsToDisplay(t.creatorNet)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(t.retainerStatus, t.finalStatus)}`} />
                          <span className={`text-[10px] font-bold ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                            {txnStatusLabel(t.retainerStatus, t.finalStatus)}
                          </span>
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
    </main>
  );
}
