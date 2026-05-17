import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, CreditCard, Database, Eye, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

const EMPTY_SUMMARY = {
  totalCreators: 0,
  pendingCreators: 0,
  approvedCreators: 0,
  clientProfiles: 0,
  openProjects: 0,
  activeProjects: 0,
  quoteRequests: 0,
  projectApplications: 0,
  paymentRecords: 0,
  paymentEvents: 0,
  disputes: 0,
  violations: 0,
  filterEvents: 0,
};

function Shell({ dark, children }) {
  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-[1700px] px-4 py-8 sm:px-6 lg:px-10">
      {children}
    </main>
  );
}

function Panel({ dark, className = '', children }) {
  return (
    <section className={`rounded-[28px] border ${dark ? 'border-white/[0.08] bg-charcoal-950/58 shadow-[0_32px_120px_rgba(0,0,0,0.34)]' : 'border-gray-200 bg-white shadow-sm'} ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({ dark, icon: Icon, label, value, note }) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-gray-50'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Icon size={17} className="text-gold-400" />
        <p className={`text-[10px] font-bold uppercase tracking-[3px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{label}</p>
      </div>
      <p className={`text-3xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>{value}</p>
      {note && <p className={`mt-2 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{note}</p>}
    </div>
  );
}

function AccessState({ dark, title, copy }) {
  return (
    <Shell dark={dark}>
      <Panel dark={dark} className="mx-auto max-w-2xl p-7 text-center">
        <ShieldCheck className="mx-auto mb-4 text-gold-400" size={28} />
        <h1 className={`text-3xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>{title}</h1>
        <p className={`mx-auto mt-3 max-w-lg text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{copy}</p>
      </Panel>
    </Shell>
  );
}

export function AdminDashboard({ dark }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [queue, setQueue] = useState([]);

  const riskCounts = useMemo(() => ({
    disputesAndViolations: Number(summary.disputes || 0) + Number(summary.violations || 0),
    communicationFlags: Number(summary.filterEvents || 0),
  }), [summary]);

  async function loadAdminData({ quiet = false } = {}) {
    if (!supabaseConfigured || !supabase) {
      setError('Supabase is not configured for this environment.');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('Sign in with the CreatorBridge owner account to view admin controls.');
      setLoading(false);
      return;
    }

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_platform_admin');
    if (adminError || !isAdmin) {
      setAuthorized(false);
      setError('Admin access required. This page only opens for accounts listed in the platform admin roster.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAuthorized(true);
    const [summaryResult, queueResult] = await Promise.all([
      supabase.rpc('get_admin_platform_summary'),
      supabase.rpc('get_admin_creator_review_queue'),
    ]);

    if (summaryResult.error || queueResult.error) {
      setError(summaryResult.error?.message || queueResult.error?.message || 'Could not load admin data.');
    } else {
      setSummary({ ...EMPTY_SUMMARY, ...(summaryResult.data || {}) });
      setQueue(Array.isArray(queueResult.data) ? queueResult.data : []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    let active = true;
    const run = async () => {
      await loadAdminData();
      if (!active) return;
    };
    run();
    return () => { active = false; };
  }, [user?.id]);

  if (loading) {
    return <AccessState dark={dark} title="Loading admin visibility." copy="Checking the locked CreatorBridge admin roster before loading platform data." />;
  }

  if (error && !authorized) {
    return <AccessState dark={dark} title="Admin access required." copy={error} />;
  }

  return (
    <Shell dark={dark}>
      <Panel dark={dark} className="overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="mb-3 text-gold-400" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Admin Control Hub
            </p>
            <h1 className={`max-w-4xl text-4xl font-black leading-tight md:text-6xl ${dark ? 'text-white' : 'text-gray-950'}`}>
              Platform operations without risky buttons.
            </h1>
            <p className={`mt-4 max-w-2xl text-sm leading-7 md:text-base ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              Read-only operations visibility for creator reviews, project movement, payment records, disputes, and communication flags before owner action controls are added.
            </p>
          </div>
          <div className={`rounded-2xl border p-5 ${dark ? 'border-gold-500/18 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-gold-400" size={22} />
              <div>
                <p className={`text-sm font-black ${dark ? 'text-white' : 'text-gray-950'}`}>Read-only operations visibility</p>
                <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                  Signed in as {user?.email || 'admin user'}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadAdminData({ quiet: true })}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3 text-sm font-black text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-60"
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Refresh visibility
            </button>
          </div>
        </div>
      </Panel>

      {error && (
        <div className={`mt-5 rounded-2xl border p-4 text-sm ${dark ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard dark={dark} icon={UserCheck} label="Pending reviews" value={summary.pendingCreators} note={`${summary.approvedCreators} approved creators`} />
        <MetricCard dark={dark} icon={ClipboardCheck} label="Projects" value={summary.activeProjects} note={`${summary.openProjects} open project briefs`} />
        <MetricCard dark={dark} icon={CreditCard} label="Payment records" value={summary.paymentRecords} note={`${summary.paymentEvents} Stripe event records`} />
        <MetricCard dark={dark} icon={AlertTriangle} label="Risk signals" value={riskCounts.disputesAndViolations} note={`${riskCounts.communicationFlags} contact filter events`} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel dark={dark} className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                Creator review queue
              </p>
              <h2 className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>Profiles waiting on owner review</h2>
            </div>
            <p className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{queue.length} visible records</p>
          </div>

          {queue.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center ${dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-gray-50'}`}>
              <Eye className="mx-auto mb-3 text-gold-400" size={24} />
              <p className={`font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>No pending creator reviews found.</p>
              <p className={`mt-2 text-sm ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>The next pass can add owner approval controls after this visibility layer is tested.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(item => {
                const missing = [
                  !item.video_intro_url && 'intro video',
                  Number(item.portfolio_count || 0) < 3 && 'portfolio proof',
                  Number(item.package_count || 0) < 1 && 'packages',
                  Number(item.service_count || 0) < 1 && 'services',
                ].filter(Boolean);

                return (
                  <article key={item.listing_id} className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className={`text-lg font-black ${dark ? 'text-white' : 'text-gray-950'}`}>{item.business_name || item.creator_name || 'Unnamed creator'}</p>
                        <p className={`mt-1 text-sm ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                          {item.creator_name || 'Creator'} · {item.city || 'City pending'}, {item.state || 'State pending'} · {item.years_experience || 0}+ yrs
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-gold-500/20 bg-gold-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[1.8px] text-gold-300">
                        {item.review_status || 'pending_review'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className={`rounded-xl px-3 py-2 text-xs ${dark ? 'bg-charcoal-900/70 text-charcoal-300' : 'bg-white text-gray-600'}`}>Portfolio: {item.portfolio_count || 0}</div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${dark ? 'bg-charcoal-900/70 text-charcoal-300' : 'bg-white text-gray-600'}`}>Packages: {item.package_count || 0}</div>
                      <div className={`rounded-xl px-3 py-2 text-xs ${dark ? 'bg-charcoal-900/70 text-charcoal-300' : 'bg-white text-gray-600'}`}>Services: {item.service_count || 0}</div>
                    </div>
                    <p className={`mt-3 text-xs leading-5 ${missing.length ? 'text-gold-300' : dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                      {missing.length ? `Needs review attention: ${missing.join(', ')}.` : 'Meets the visible review proof checks.'}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel dark={dark} className="p-5 md:p-6">
          <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            What this pass does
          </p>
          <h2 className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>Owner visibility first.</h2>
          <div className={`mt-5 space-y-4 text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
            <p>This view confirms whether the platform can safely show operational records to the owner without relying on editable profile metadata.</p>
            <p>No approval, deletion, refund, payout, or profile mutation controls are exposed here yet.</p>
            <p>The next admin pass should add audited actions one by one, starting with creator review decisions.</p>
          </div>
          <div className={`mt-6 rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-gray-50'}`}>
            <Database className="mb-3 text-gold-400" size={20} />
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>Admin source of truth</p>
            <p className={`mt-2 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
              Admin access is controlled by the platform admin roster in Supabase, not user-editable profile fields.
            </p>
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
