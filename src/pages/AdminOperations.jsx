import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronUp, Filter,
  Loader, Plus, RefreshCw, Search, ShieldCheck, Users, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { getPillar } from '../data/taxonomy.js';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return '—';
  return `${Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)}d`;
}

function ReviewBadge({ status }) {
  const s = {
    pending_review: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    approved:       'bg-emerald-900/30 text-emerald-400 border-emerald-700/40',
    rejected:       'bg-red-900/30 text-red-400 border-red-700/40',
    suspended:      'bg-red-900/50 text-red-300 border-red-600/50',
  };
  const l = { pending_review: 'Pending', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s[status] ?? s.pending_review}`}>
      {l[status] ?? status}
    </span>
  );
}

function ViolationBadge({ status }) {
  const s = {
    under_review: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    confirmed:    'bg-red-900/30 text-red-400 border-red-700/40',
    dismissed:    'bg-white/[0.05] text-charcoal-400 border-white/[0.07]',
  };
  const l = { under_review: 'Under Review', confirmed: 'Confirmed', dismissed: 'Dismissed' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s[status] ?? s.under_review}`}>
      {l[status] ?? status}
    </span>
  );
}

const VIOLATION_TYPES = [
  { value: 'off_platform_contact', label: 'Off-platform contact' },
  { value: 'payment_bypass',       label: 'Payment bypass' },
  { value: 'fake_credentials',     label: 'Fake credentials' },
  { value: 'harassment',           label: 'Harassment' },
  { value: 'other',                label: 'Other' },
];

// ── Creator Review tab ────────────────────────────────────────────────────────

function CreatorReviewTab({ dark }) {
  const [creators, setCreators] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fetchErr, setFetchErr] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [working,  setWorking]  = useState(null);  // listing_id being acted on
  const [actionErr, setActionErr] = useState('');
  const [reasonMap, setReasonMap] = useState({});   // { [listing_id]: reasonText }

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const divider  = dark ? 'border-white/[0.07]' : 'border-gray-100';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 transition-colors resize-none ${
    dark ? 'bg-charcoal-900/60 border-white/[0.1] text-white placeholder-charcoal-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  async function load() {
    setLoading(true);
    setFetchErr('');
    const { data, error } = await supabase.rpc('get_admin_creator_review_queue');
    if (error) setFetchErr(error.message);
    else setCreators(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(listingId) {
    const reason = (reasonMap[listingId] || '').trim();
    if (!reason) { setActionErr('Please enter an approval reason before approving.'); return; }
    setWorking(listingId);
    setActionErr('');
    const { error } = await supabase.rpc('admin_approve_creator_noted', {
      p_listing_id: listingId,
      p_notes:      reason,
    });
    if (error) { setActionErr(error.message); }
    else { setCreators(prev => prev.filter(c => c.listing_id !== listingId)); setExpanded(null); }
    setWorking(null);
  }

  async function reject(listingId) {
    setWorking(listingId);
    setActionErr('');
    const { error } = await supabase.rpc('admin_reject_creator', { p_listing_id: listingId });
    if (error) { setActionErr(error.message); }
    else { setCreators(prev => prev.filter(c => c.listing_id !== listingId)); setExpanded(null); }
    setWorking(null);
  }

  if (loading) return <p className={`py-10 text-center text-sm ${textSub}`}>Loading review queue…</p>;
  if (fetchErr) return <p className="py-6 text-center text-xs text-red-400">{fetchErr}</p>;
  if (creators.length === 0) return (
    <div className={`py-12 text-center text-sm ${textSub}`}>
      No creators pending review. Queue is clear.
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className={`text-xs ${textSub}`}>{creators.length} pending</p>
        <button type="button" onClick={load} className={`flex items-center gap-1 text-xs font-bold transition-colors ${dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {actionErr && <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">{actionErr}</p>}

      {/* Column headers */}
      <div className={`hidden sm:grid sm:grid-cols-[1fr_140px_80px_100px_80px_28px] gap-3 border-b px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${dark ? `${divider} text-charcoal-500` : 'border-gray-100 text-gray-400'}`}>
        <span>Creator</span><span>Location</span><span>Portfolio</span><span>Status</span><span>Age</span><span />
      </div>

      {creators.map(c => {
        const isOpen = expanded === c.listing_id;
        return (
          <div key={c.listing_id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : c.listing_id)}
              className={`w-full border-b text-left transition-colors ${divider} ${dark ? `hover:bg-white/[0.03] ${isOpen ? 'bg-white/[0.04]' : ''}` : `hover:bg-gray-50 ${isOpen ? 'bg-gold-50/20' : ''}`}`}
            >
              <div className="hidden sm:grid sm:grid-cols-[1fr_140px_80px_100px_80px_28px] items-center gap-3 px-4 py-3.5">
                <div>
                  <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{c.creator_name || '—'}</p>
                  {c.business_name && <p className={`text-[10px] ${textSub}`}>{c.business_name}</p>}
                </div>
                <span className={`text-xs ${textSub}`}>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</span>
                <span className={`text-xs ${textSub}`}>{c.portfolio_count ?? 0} items</span>
                <ReviewBadge status={c.review_status} />
                <span className={`font-mono text-xs ${textSub}`}>{daysSince(c.submitted_at || c.created_at)}</span>
                {isOpen ? <ChevronUp size={13} className="text-gold-400" /> : <ChevronDown size={13} className={textSub} />}
              </div>
              {/* Mobile */}
              <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:hidden">
                <div>
                  <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{c.creator_name || '—'}</p>
                  <p className={`text-xs ${textSub}`}>{[c.city, c.state].filter(Boolean).join(', ') || '—'} · {c.portfolio_count ?? 0} portfolio items</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ReviewBadge status={c.review_status} />
                  {isOpen ? <ChevronUp size={13} className="text-gold-400" /> : <ChevronDown size={13} className={textSub} />}
                </div>
              </div>
            </button>

            {isOpen && (
              <div className={`border-b px-4 py-5 ${divider} ${dark ? 'bg-charcoal-950/40' : 'bg-gray-50/70'}`}>
                <div className="mb-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                  <div><p className={`mb-0.5 font-bold ${textSub}`}>Experience</p><p className={dark ? 'text-white' : 'text-gray-900'}>{c.years_experience ?? '—'} yrs</p></div>
                  <div><p className={`mb-0.5 font-bold ${textSub}`}>Packages</p><p className={dark ? 'text-white' : 'text-gray-900'}>{c.package_count ?? 0}</p></div>
                  <div><p className={`mb-0.5 font-bold ${textSub}`}>Services</p><p className={dark ? 'text-white' : 'text-gray-900'}>{c.service_count ?? 0}</p></div>
                  <div>
                    <p className={`mb-0.5 font-bold ${textSub}`}>Intro video</p>
                    {c.video_intro_url
                      ? <a href={c.video_intro_url} target="_blank" rel="noreferrer" className="text-gold-400 underline">View</a>
                      : <span className={textSub}>None</span>}
                  </div>
                </div>
                <div className="mb-3">
                  <label className={`mb-1.5 block text-xs font-bold ${textSub}`}>
                    Approval reason <span className="font-normal">(required to approve — logged to profile)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter reason for approval decision…"
                    value={reasonMap[c.listing_id] || ''}
                    onChange={e => setReasonMap(prev => ({ ...prev, [c.listing_id]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => reject(c.listing_id)}
                    disabled={working === c.listing_id}
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      dark ? 'border-red-700/50 text-red-400 hover:bg-red-900/20' : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {working === c.listing_id ? 'Working…' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(c.listing_id)}
                    disabled={working === c.listing_id}
                    className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-50"
                  >
                    {working === c.listing_id ? 'Working…' : 'Approve'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Violations tab ────────────────────────────────────────────────────────────

function ViolationsTab({ dark }) {
  const { user } = useAuth();
  const [violations,  setViolations]  = useState([]);
  const [creators,    setCreators]    = useState([]);  // for log-new dropdown
  const [loading,     setLoading]     = useState(false);
  const [fetchErr,    setFetchErr]    = useState('');
  const [expanded,    setExpanded]    = useState(null);
  const [saving,      setSaving]      = useState(null);
  const [saveErr,     setSaveErr]     = useState('');
  const [editMap,     setEditMap]     = useState({});
  const [filterStatus,setFilterStatus]= useState('');
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({
    creator_id: '', violation_type: 'off_platform_contact',
    description: '', strike_number: '1',
  });
  const [logging, setLogging] = useState(false);
  const [logErr,  setLogErr]  = useState('');

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const divider  = dark ? 'border-white/[0.07]' : 'border-gray-100';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 transition-colors ${
    dark ? 'bg-charcoal-900/60 border-white/[0.1] text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const selectCls = `rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 transition-colors ${
    dark ? 'bg-charcoal-900/60 border-white/[0.1] text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  // Creator name lookup: creator_id (auth.users.id) → name
  const creatorNameMap = useMemo(() => {
    const m = {};
    creators.forEach(c => { m[c.user_id] = c.name || c.business_name || c.user_id?.slice(0, 8); });
    return m;
  }, [creators]);

  async function load() {
    setLoading(true);
    setFetchErr('');
    const [vRes, cRes] = await Promise.all([
      supabase.from('violations').select('*').order('created_at', { ascending: false }),
      supabase.from('creator_listings').select('id, user_id, name, business_name').limit(500),
    ]);
    if (vRes.error) { setFetchErr(vRes.error.message); }
    else {
      const data = vRes.data ?? [];
      setViolations(data);
      setEditMap(prev => {
        const next = { ...prev };
        data.forEach(v => { if (!next[v.id]) next[v.id] = { status: v.status, admin_notes: v.admin_notes ?? '' }; });
        return next;
      });
    }
    setCreators(cRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveViolation(id) {
    setSaving(id);
    setSaveErr('');
    const edit = editMap[id];
    const { error } = await supabase.from('violations').update({
      status:      edit.status,
      admin_notes: edit.admin_notes || null,
    }).eq('id', id);
    if (error) setSaveErr(error.message);
    else setViolations(prev => prev.map(v => v.id === id ? { ...v, ...edit } : v));
    setSaving(null);
  }

  async function suspendCreator(violation) {
    // Resolve creator listing_id from creator_id (user_id)
    const { data: listing, error } = await supabase
      .from('creator_listings')
      .select('id')
      .eq('user_id', violation.creator_id)
      .maybeSingle();
    if (error || !listing) { setSaveErr('Could not find creator listing to suspend.'); return; }
    setSaving(violation.id);
    const { error: suspErr } = await supabase.rpc('admin_suspend_creator', { p_listing_id: listing.id });
    if (suspErr) setSaveErr(suspErr.message);
    else await load();
    setSaving(null);
  }

  async function logViolation(e) {
    e.preventDefault();
    setLogErr('');
    if (!logForm.creator_id.trim()) { setLogErr('Creator ID is required.'); return; }
    if (!logForm.description.trim()) { setLogErr('Description is required.'); return; }
    setLogging(true);
    const { error } = await supabase.from('violations').insert({
      creator_id:     logForm.creator_id.trim(),
      reported_by:    user?.id ?? null,
      violation_type: logForm.violation_type,
      description:    logForm.description.trim(),
      strike_number:  parseInt(logForm.strike_number, 10),
    });
    if (error) { setLogErr(error.message); }
    else {
      setLogForm({ creator_id: '', violation_type: 'off_platform_contact', description: '', strike_number: '1' });
      setShowLogForm(false);
      await load();
    }
    setLogging(false);
  }

  const displayed = useMemo(() =>
    violations.filter(v => !filterStatus || v.status === filterStatus),
    [violations, filterStatus]
  );

  if (loading) return <p className={`py-10 text-center text-sm ${textSub}`}>Loading violations…</p>;
  if (fetchErr) return <p className="py-6 text-center text-xs text-red-400">{fetchErr}</p>;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="under_review">Under Review</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <span className={`text-xs ${textSub}`}>{displayed.length} shown</span>
        <button
          type="button"
          onClick={() => setShowLogForm(v => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600"
        >
          <Plus size={12} /> Log Violation
        </button>
      </div>

      {saveErr && <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">{saveErr}</p>}

      {/* Log violation form */}
      {showLogForm && (
        <div className={`mb-5 rounded-2xl border p-5 ${dark ? 'border-white/[0.08] bg-charcoal-900/50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Log New Violation</h3>
            <button type="button" onClick={() => setShowLogForm(false)} className={textSub}><X size={14} /></button>
          </div>
          <form onSubmit={logViolation} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`mb-1 block text-xs font-bold ${textSub}`}>Creator user ID</label>
              <input type="text" placeholder="UUID from creator_listings.user_id"
                value={logForm.creator_id}
                onChange={e => setLogForm(f => ({ ...f, creator_id: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-bold ${textSub}`}>Violation type</label>
              <select value={logForm.violation_type}
                onChange={e => setLogForm(f => ({ ...f, violation_type: e.target.value }))}
                className={`${inputCls} w-full`}>
                {VIOLATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`mb-1 block text-xs font-bold ${textSub}`}>Strike number</label>
              <select value={logForm.strike_number}
                onChange={e => setLogForm(f => ({ ...f, strike_number: e.target.value }))}
                className={`${inputCls} w-full`}>
                <option value="1">Strike 1</option>
                <option value="2">Strike 2</option>
                <option value="3">Strike 3 (final)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={`mb-1 block text-xs font-bold ${textSub}`}>Description</label>
              <textarea rows={3} placeholder="Describe the violation…"
                value={logForm.description}
                onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            {logErr && <p className="text-xs text-red-400 sm:col-span-2">{logErr}</p>}
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={() => setShowLogForm(false)} className={`text-xs font-bold ${textSub}`}>Cancel</button>
              <button type="submit" disabled={logging}
                className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-bold text-charcoal-950 hover:bg-gold-600 disabled:opacity-50">
                {logging ? 'Saving…' : 'Log Violation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {displayed.length === 0 && !showLogForm && (
        <div className={`py-12 text-center text-sm ${textSub}`}>No violations on record.</div>
      )}

      {/* Column headers */}
      {displayed.length > 0 && (
        <div className={`hidden sm:grid sm:grid-cols-[120px_1fr_140px_60px_110px_28px] gap-3 border-b px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${dark ? `${divider} text-charcoal-500` : 'border-gray-100 text-gray-400'}`}>
          <span>Date</span><span>Creator</span><span>Type</span><span>Strike</span><span>Status</span><span />
        </div>
      )}

      {displayed.map(v => {
        const isOpen  = expanded === v.id;
        const edit    = editMap[v.id] ?? { status: v.status, admin_notes: v.admin_notes ?? '' };
        const canSuspend = edit.status === 'confirmed' && v.strike_number === 3;
        const dateStr = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const creatorName = creatorNameMap[v.creator_id] ?? v.creator_id?.slice(0, 8) ?? '—';

        return (
          <div key={v.id}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : v.id)}
              className={`w-full border-b text-left transition-colors ${divider} ${dark ? `hover:bg-white/[0.03] ${isOpen ? 'bg-white/[0.04]' : ''}` : `hover:bg-gray-50 ${isOpen ? 'bg-gold-50/20' : ''}`}`}
            >
              <div className="hidden sm:grid sm:grid-cols-[120px_1fr_140px_60px_110px_28px] items-center gap-3 px-4 py-3.5">
                <span className={`font-mono text-xs ${textSub}`}>{dateStr}</span>
                <span className={`truncate text-xs font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{creatorName}</span>
                <span className={`text-xs capitalize ${textSub}`}>{v.violation_type.replace(/_/g, ' ')}</span>
                <span className={`text-xs font-bold ${v.strike_number === 3 ? 'text-red-400' : dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                  #{v.strike_number}
                </span>
                <ViolationBadge status={v.status} />
                {isOpen ? <ChevronUp size={13} className="text-gold-400" /> : <ChevronDown size={13} className={textSub} />}
              </div>
              {/* Mobile */}
              <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:hidden">
                <div>
                  <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{creatorName}</p>
                  <p className={`text-xs ${textSub}`}>{v.violation_type.replace(/_/g, ' ')} · Strike #{v.strike_number} · {dateStr}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ViolationBadge status={v.status} />
                  {isOpen ? <ChevronUp size={13} className="text-gold-400" /> : <ChevronDown size={13} className={textSub} />}
                </div>
              </div>
            </button>

            {isOpen && (
              <div className={`border-b px-4 py-5 ${divider} ${dark ? 'bg-charcoal-950/40' : 'bg-gray-50/70'}`}>
                <p className={`mb-1 text-xs font-bold ${textSub}`}>Description</p>
                <p className={`mb-4 text-sm leading-relaxed ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{v.description}</p>

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`mb-1.5 block text-xs font-bold ${textSub}`}>Status</label>
                    <select value={edit.status}
                      onChange={e => setEditMap(prev => ({ ...prev, [v.id]: { ...edit, status: e.target.value } }))}
                      className={`${inputCls} w-full`}>
                      <option value="under_review">Under Review</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                  <div>
                    <label className={`mb-1.5 block text-xs font-bold ${textSub}`}>Reference</label>
                    <p className={`pt-2 font-mono text-xs ${textSub}`}>#{v.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className={`mb-1.5 block text-xs font-bold ${textSub}`}>Admin notes</label>
                  <textarea rows={2} placeholder="Internal notes…"
                    value={edit.admin_notes}
                    onChange={e => setEditMap(prev => ({ ...prev, [v.id]: { ...edit, admin_notes: e.target.value } }))}
                    className={`${inputCls} resize-none`} />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {canSuspend && (
                    <button type="button"
                      onClick={() => suspendCreator(v)}
                      disabled={saving === v.id}
                      className="rounded-full border border-red-600/50 bg-red-900/20 px-4 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50">
                      {saving === v.id ? 'Suspending…' : 'Suspend Account'}
                    </button>
                  )}
                  <button type="button" onClick={() => setExpanded(null)}
                    className={`text-xs font-bold transition-colors ${dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                    Collapse
                  </button>
                  <button type="button"
                    onClick={() => saveViolation(v.id)}
                    disabled={saving === v.id}
                    className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-50">
                    {saving === v.id ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Admin Global Search ────────────────────────────────────────────────────────

function AdminGlobalSearch({ dark }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null);  // null = not searched yet
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardBg  = dark ? 'bg-charcoal-900/50 border-white/[0.07]' : 'bg-white border-gray-200';
  const inputBg = dark
    ? 'border-white/[0.08] bg-white/[0.02] focus-within:border-gold-500/40 focus-within:bg-white/[0.04]'
    : 'border-gray-200 bg-white focus-within:border-gold-400/60 shadow-sm';

  async function runSearch(q) {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);

    const term = `%${q.toLowerCase()}%`;

    const [creatorsRes, ticketsRes, violationsRes] = await Promise.all([
      supabase
        .from('creator_listings')
        .select('id, name, business_name, tier, city, state, review_status, primary_pillar')
        .or(`name.ilike.${term},business_name.ilike.${term},bio.ilike.${term},city.ilike.${term},state.ilike.${term},primary_pillar.ilike.${term}`)
        .limit(8),
      supabase
        .from('support_tickets')
        .select('id, subject, category, status, created_at')
        .or(`subject.ilike.${term},description.ilike.${term}`)
        .limit(8),
      supabase
        .from('violations')
        .select('id, violation_type, status, strike_number, created_at, creator_id')
        .or(`description.ilike.${term},admin_notes.ilike.${term}`)
        .limit(8),
    ]);

    setResults({
      creators:   creatorsRes.data  ?? [],
      tickets:    ticketsRes.data   ?? [],
      violations: violationsRes.data ?? [],
    });
    setLoading(false);
  }

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    runSearch(query);
  }

  const totalHits = results
    ? results.creators.length + results.tickets.length + results.violations.length
    : 0;

  return (
    <div className={`rounded-2xl border mb-6 p-5 ${cardBg}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
        Global Search
      </p>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className={`flex rounded-xl border transition-all ${inputBg}`}>
          <div className={`flex items-center px-3 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
            {loading ? <Loader size={16} className="animate-spin text-gold-400" /> : <Search size={16} />}
          </div>
          <input
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Search creators, tickets, violations…"
            aria-label="Admin global search"
            className={`flex-1 bg-transparent py-2.5 text-sm focus:outline-none ${dark ? 'text-white placeholder-charcoal-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
          <button type="submit" className="m-1 rounded-lg bg-gold-500 px-4 py-1.5 text-xs font-bold text-charcoal-950 hover:bg-gold-600 transition-colors">
            Search
          </button>
        </div>
      </form>

      {results && !loading && (
        <div className="space-y-4">
          {totalHits === 0 && (
            <p className={`text-xs text-center py-4 ${textSub}`}>No results for "{query}"</p>
          )}

          {/* Creators */}
          {results.creators.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dark ? 'text-gold-500/60' : 'text-gold-600'}`}>
                Creators ({results.creators.length})
              </p>
              <div className="space-y-1">
                {results.creators.map(c => {
                  const displayName = c.business_name || c.name || 'Creator listing';
                  const location = [c.city, c.state].filter(Boolean).join(', ');
                  const pillar = getPillar(c.primary_pillar)?.name;
                  return (
                  <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${dark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                    <span className={`font-medium ${dark ? 'text-charcoal-100' : 'text-gray-800'}`}>{displayName}</span>
                    <div className="flex items-center gap-2">
                      {(pillar || location) && <span className={textSub}>{[pillar, location].filter(Boolean).join(' · ')}</span>}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dark ? 'bg-charcoal-800 text-charcoal-300' : 'bg-gray-100 text-gray-500'}`}>{c.review_status}</span>
                    </div>
                  </div>
                );})}
              </div>
            </div>
          )}

          {/* Support Tickets */}
          {results.tickets.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dark ? 'text-gold-500/60' : 'text-gold-600'}`}>
                Support Tickets ({results.tickets.length})
              </p>
              <div className="space-y-1">
                {results.tickets.map(t => (
                  <div key={t.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${dark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                    <span className={`font-medium truncate max-w-[60%] ${dark ? 'text-charcoal-100' : 'text-gray-800'}`}>{t.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className={textSub}>{t.category}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dark ? 'bg-charcoal-800 text-charcoal-300' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Violations */}
          {results.violations.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dark ? 'text-gold-500/60' : 'text-gold-600'}`}>
                Violations ({results.violations.length})
              </p>
              <div className="space-y-1">
                {results.violations.map(v => (
                  <div key={v.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${dark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                    <span className={`font-medium ${dark ? 'text-charcoal-100' : 'text-gray-800'}`}>{v.violation_type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className={textSub}>Strike {v.strike_number}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dark ? 'bg-charcoal-800 text-charcoal-300' : 'bg-gray-100 text-gray-500'}`}>{v.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminOperations({ dark }) {
  const { user } = useAuth();
  const [checking,   setChecking]   = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState('review');

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardBg  = dark ? 'bg-charcoal-950/58 border-white/[0.08]' : 'bg-white border-gray-200';

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      setAuthorized(!error && !!data);
      setChecking(false);
    });
  }, [user]);

  if (checking) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className={`text-sm ${textSub}`}>Checking admin access…</p>
      </main>
    );
  }

  if (!user || !authorized) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className={`rounded-2xl border p-8 shadow-sm ${cardBg}`}>
          <ShieldCheck className="mx-auto mb-4 text-gold-400" size={28} />
          <h1 className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>Admin Access Required</h1>
          <p className={`mt-3 text-sm ${textSub}`}>Sign in with the CreatorBridge owner account to access operations.</p>
        </div>
      </main>
    );
  }

  const tabs = [
    { id: 'review',     label: 'Creator Review', icon: Users },
    { id: 'violations', label: 'Violations',      icon: AlertTriangle },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <h1 className={`mb-6 text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>Admin Operations</h1>

      {/* Global search across creators, tickets, violations */}
      <AdminGlobalSearch dark={dark} />

      {/* Tab bar */}
      <div className={`mb-6 flex gap-1 rounded-xl border p-1 ${dark ? 'border-white/[0.08] bg-charcoal-900/40' : 'border-gray-200 bg-gray-100'}`}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'bg-gold-500 text-charcoal-950'
                  : dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg} shadow-sm`}>
        <div className="p-0">
          {tab === 'review'     && <CreatorReviewTab dark={dark} />}
          {tab === 'violations' && <ViolationsTab dark={dark} />}
        </div>
      </div>
    </main>
  );
}
