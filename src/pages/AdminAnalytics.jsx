import { useState, useEffect } from 'react';
import {
  Users, DollarSign, Briefcase, MessageSquare,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { centsToDisplay, PLATFORM_FEES } from '../config/fees.js';

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** ISO date string for the Monday of the week containing `dateStr`. */
function weekMonday(dateStr) {
  const d   = new Date(dateStr);
  const day = d.getDay();                        // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;        // offset back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shortDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** % share, rounded to nearest integer.  Safe against zero-division. */
function pct(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

/** Month-over-month % change, or null when there's no prior-month data. */
function mom(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Platform revenue (cents) for a single raw transaction row. */
function rowRevenue(t) {
  const proj     = t.project_amount    ?? 0;
  const crFee    = t.creator_fee_amount ?? 0;
  const clFeePct = t.client_fee_pct    ?? PLATFORM_FEES.clientFeePct;
  return crFee + Math.round(proj * clFeePct / 100);
}

function normalizeTier(tier) {
  const raw = String(tier || 'launch').toLowerCase();
  if (raw === 'signature') return 'Signature';
  if (raw === 'elite') return 'Elite';
  if (raw === 'proven') return 'Proven';
  return 'Launch';
}

// ── Mini chart: vertical bar ──────────────────────────────────────────────────

function BarChart({ data, formatValue, dark }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <div className="w-full flex items-end" style={{ height: 88 }}>
            <div
              title={formatValue ? formatValue(d.value) : d.value}
              className="w-full rounded-t-sm bg-gold-500/50 hover:bg-gold-500/80 transition-colors"
              style={{ height: Math.max(2, (d.value / max) * 88) }}
            />
          </div>
          <span className={`text-[9px] truncate w-full text-center leading-none ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Mini chart: horizontal bar ────────────────────────────────────────────────

function HorizBar({ label, value, total, colorCls, dark }) {
  const width = pct(value, total);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className={`text-xs font-medium ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          {label}
        </span>
        <span className={`text-[11px] tabular-nums shrink-0 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
          {value.toLocaleString()} <span className="opacity-50">({width}%)</span>
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-charcoal-800' : 'bg-gray-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorCls}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, change, sub, dark }) {
  const up   = change > 0;
  const down = change < 0;
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${
      dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={16} className="text-gold-400" />
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${
            up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-charcoal-400'
          }`}>
            {up ? <TrendingUp size={10} /> : down ? <TrendingDown size={10} /> : <Minus size={10} />}
            {up ? '+' : ''}{change}% MoM
          </span>
        )}
      </div>
      <p className={`font-display text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-xs mt-1 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>{sub}</p>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, sub, dark, children }) {
  return (
    <div className={`rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] overflow-hidden ${
      dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'
    }`}>
      <div className={`px-5 py-4 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
        <h2 className={`font-display font-bold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h2>
        {sub && (
          <p className={`text-[11px] mt-0.5 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>{sub}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminAnalytics({ dark }) {
  const [authError,    setAuthError]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [creators,     setCreators]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openTickets,  setOpenTickets]  = useState(0);

  // ── Admin guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (error || !data) { setAuthError(true); setLoading(false); }
    });
  }, []);

  // ── Fetch (parallel) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authError) return;
    async function fetch() {
      setLoading(true);
      const [crRes, txRes, tkRes] = await Promise.all([
        supabase
          .from('creator_listings')
          .select('tier, review_status, verified, is_suspended, created_at'),
        supabase
          .from('transactions')
          .select('project_amount, creator_fee_amount, client_fee_pct, retainer_status, final_status, created_at'),
        supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
      ]);
      setCreators(crRes.data     || []);
      setTransactions(txRes.data || []);
      setOpenTickets(tkRes.count  || 0);
      setLoading(false);
    }
    fetch();
  }, [authError]);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const eightWksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  // Creators
  const approvedCreators    = creators.filter(c => c.review_status === 'approved' && c.verified && !c.is_suspended);
  const pendingCreators     = creators.filter(c => c.review_status === 'pending_review');
  const newThisMonth        = creators.filter(c => new Date(c.created_at) >= monthStart).length;
  const newLastMonth        = creators.filter(c => {
    const d = new Date(c.created_at);
    return d >= lastStart && d < monthStart;
  }).length;

  // Tier distribution (all listings, regardless of review status)
  const TIERS      = ['Launch', 'Proven', 'Elite', 'Signature'];
  const TIER_COLORS = ['bg-charcoal-600', 'bg-gold-500/40', 'bg-gold-500/65', 'bg-gold-400'];
  const tierCounts = TIERS.map((tier, i) => ({
    label:    tier,
    value:    creators.filter(c => normalizeTier(c.tier) === tier).length,
    colorCls: TIER_COLORS[i],
  }));

  // Review funnel
  const funnel = [
    { label: 'Pending Review', value: pendingCreators.length,                                  colorCls: 'bg-gold-400/60' },
    { label: 'Approved',       value: creators.filter(c => c.review_status === 'approved').length, colorCls: 'bg-emerald-500/60' },
    { label: 'Rejected',       value: creators.filter(c => c.review_status === 'rejected').length, colorCls: 'bg-red-500/50' },
  ];

  // Revenue
  const revenueThisMonth = transactions
    .filter(t => new Date(t.created_at) >= monthStart && t.retainer_status === 'paid')
    .reduce((s, t) => s + rowRevenue(t), 0);

  const revenueLastMonth = transactions
    .filter(t => {
      const d = new Date(t.created_at);
      return d >= lastStart && d < monthStart && t.retainer_status === 'paid';
    })
    .reduce((s, t) => s + rowRevenue(t), 0);

  // Weekly revenue (last 8 full weeks)
  const weekMap = {};
  transactions
    .filter(t => new Date(t.created_at) >= eightWksAgo && t.retainer_status === 'paid')
    .forEach(t => {
      const key = weekMonday(t.created_at);
      weekMap[key] = (weekMap[key] || 0) + rowRevenue(t);
    });

  // Build a contiguous 8-week array, filling gaps with 0
  const weeklyBars = Array.from({ length: 8 }, (_, i) => {
    const d    = new Date(eightWksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const key  = weekMonday(d.toISOString());
    return { label: shortDate(key), value: weekMap[key] || 0 };
  });

  // Transaction health
  const totalTxns  = transactions.length;
  const txHealth = [
    { label: 'Released to Creator',   value: transactions.filter(t => t.final_status === 'released').length,                              colorCls: 'bg-emerald-500/60' },
    { label: 'Held — Awaiting Release', value: transactions.filter(t => t.final_status === 'paid').length,                                colorCls: 'bg-gold-500/60' },
    { label: 'Active — Delivery Pending', value: transactions.filter(t => t.retainer_status === 'paid' && t.final_status === 'pending').length, colorCls: 'bg-gold-400/40' },
    { label: 'Pending — No Retainer', value: transactions.filter(t => t.retainer_status === 'pending').length,                            colorCls: 'bg-charcoal-600' },
  ];

  const activeJobs = txHealth[2].value;
  const revChange  = mom(revenueThisMonth, revenueLastMonth);

  // ── Render ───────────────────────────────────────────────────────────────────
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
            Platform Analytics
          </h1>
          <p className={`mt-1 text-sm ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
            Real-time health metrics — creators, revenue, and transactions.
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Users}
                label="Active Creators"
                value={approvedCreators.length.toLocaleString()}
                change={mom(newThisMonth, newLastMonth)}
                sub={`${pendingCreators.length} pending review`}
                dark={dark}
              />
              <KpiCard
                icon={DollarSign}
                label="Revenue This Month"
                value={centsToDisplay(revenueThisMonth)}
                change={revChange}
                sub="Creator + client fees"
                dark={dark}
              />
              <KpiCard
                icon={Briefcase}
                label="Active Projects"
                value={activeJobs.toLocaleString()}
                sub="Retainer paid, delivery pending"
                dark={dark}
              />
              <KpiCard
                icon={MessageSquare}
                label="Open Tickets"
                value={openTickets.toLocaleString()}
                sub="Support tickets awaiting response"
                dark={dark}
              />
            </div>

            {/* Charts row 1 */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Section
                title="Platform Revenue — Last 8 Weeks"
                sub="Creator fees + client booking fees, by week of transaction creation."
                dark={dark}
              >
                <BarChart
                  data={weeklyBars}
                  formatValue={v => centsToDisplay(v)}
                  dark={dark}
                />
              </Section>

              <Section
                title="Creator Tier Distribution"
                sub={`All ${creators.length.toLocaleString()} listings, regardless of review status.`}
                dark={dark}
              >
                <div className="space-y-3">
                  {tierCounts.map(t => (
                    <HorizBar
                      key={t.label}
                      label={t.label}
                      value={t.value}
                      total={creators.length || 1}
                      colorCls={t.colorCls}
                      dark={dark}
                    />
                  ))}
                </div>
              </Section>
            </div>

            {/* Charts row 2 */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Section
                title="Creator Review Funnel"
                sub={`Approval pipeline across ${creators.length.toLocaleString()} total listings.`}
                dark={dark}
              >
                <div className="space-y-3">
                  {funnel.map(f => (
                    <HorizBar
                      key={f.label}
                      label={f.label}
                      value={f.value}
                      total={creators.length || 1}
                      colorCls={f.colorCls}
                      dark={dark}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Transaction Status Breakdown"
                sub={`${totalTxns.toLocaleString()} all-time transactions.`}
                dark={dark}
              >
                <div className="space-y-3">
                  {txHealth.map(h => (
                    <HorizBar
                      key={h.label}
                      label={h.label}
                      value={h.value}
                      total={totalTxns || 1}
                      colorCls={h.colorCls}
                      dark={dark}
                    />
                  ))}
                </div>
              </Section>
            </div>

            {/* Revenue MoM strip */}
            <div className={`rounded-2xl border p-5 flex flex-wrap gap-6 items-center ${
              dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'
            }`}>
              {[
                { label: 'This Month',       value: centsToDisplay(revenueThisMonth), cls: 'text-gold-400' },
                { label: 'Last Month',       value: centsToDisplay(revenueLastMonth), cls: dark ? 'text-charcoal-300' : 'text-gray-600' },
                {
                  label: 'MoM Change',
                  value: revChange !== null
                    ? `${revChange >= 0 ? '+' : ''}${revChange}%`
                    : '—',
                  cls: revChange === null
                    ? (dark ? 'text-charcoal-500' : 'text-gray-300')
                    : revChange >= 0 ? 'text-emerald-400' : 'text-red-400',
                },
                { label: 'Creator Fee Rate',  value: `${PLATFORM_FEES.creatorFeePct}%`,  cls: dark ? 'text-white' : 'text-gray-900' },
                { label: 'Client Booking Fee', value: `${PLATFORM_FEES.clientFeePct}%`,  cls: dark ? 'text-white' : 'text-gray-900' },
                { label: 'Total Transactions', value: totalTxns.toLocaleString(),          cls: dark ? 'text-white' : 'text-gray-900' },
              ].map((item, i, arr) => (
                <>
                  <div key={item.label}>
                    <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
                      {item.label}
                    </p>
                    <p className={`text-xl font-bold ${item.cls}`}>{item.value}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div key={`divider-${i}`} className={`hidden sm:block w-px h-10 ${dark ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
                  )}
                </>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
