import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

// ── Small display helpers ──────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    open:        'bg-gold-500/20 text-gold-400 border-gold-500/30',
    in_progress: 'bg-white/[0.06] text-charcoal-300 border-white/[0.08]',
    resolved:    'bg-emerald-900/30 text-emerald-400 border-emerald-700/40',
  };
  const labels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] ?? map.open}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    low:    'text-charcoal-500',
    normal: 'text-charcoal-300',
    high:   'text-amber-400',
    urgent: 'text-red-400 font-black',
  };
  return (
    <span className={`text-xs font-bold capitalize ${map[priority] ?? map.normal}`}>
      {priority}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export function AdminSupport({ dark }) {
  const { user } = useAuth();

  const [checking,   setChecking]   = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tickets,    setTickets]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [fetchErr,   setFetchErr]   = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [saving,     setSaving]     = useState(null);   // ticket id currently being saved
  const [saveErr,    setSaveErr]    = useState('');

  // Per-ticket draft edits: { [id]: { status, priority, admin_notes } }
  const [editMap, setEditMap] = useState({});

  // Filter controls
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardBg   = dark ? 'bg-charcoal-950/58 border-white/[0.08]' : 'bg-white border-gray-200';
  const divider  = dark ? 'border-white/[0.07]' : 'border-gray-100';
  const inputCls = `w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 transition-colors ${
    dark ? 'bg-charcoal-900/60 border-white/[0.1] text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;
  const selectCls = `rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 transition-colors ${
    dark ? 'bg-charcoal-900/60 border-white/[0.1] text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  // ── Admin check ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      setAuthorized(!error && !!data);
      setChecking(false);
    });
  }, [user]);

  // ── Fetch tickets ──────────────────────────────────────────────
  async function fetchTickets() {
    setLoading(true);
    setFetchErr('');
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setFetchErr(error.message);
    } else {
      setTickets(data ?? []);
      // Seed editMap for any tickets not yet tracked
      setEditMap(prev => {
        const next = { ...prev };
        (data ?? []).forEach(t => {
          if (!next[t.id]) {
            next[t.id] = { status: t.status, priority: t.priority, admin_notes: t.admin_notes ?? '' };
          }
        });
        return next;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) fetchTickets();
  }, [authorized]);

  // ── Save a ticket's edits ──────────────────────────────────────
  async function saveTicket(ticketId) {
    setSaving(ticketId);
    setSaveErr('');
    const edit = editMap[ticketId];
    const { error } = await supabase
      .from('support_tickets')
      .update({
        status:      edit.status,
        priority:    edit.priority,
        admin_notes: edit.admin_notes || null,
      })
      .eq('id', ticketId);

    if (error) {
      setSaveErr(error.message);
    } else {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...edit } : t));
    }
    setSaving(null);
  }

  // ── Filtered view ──────────────────────────────────────────────
  const displayTickets = useMemo(() => tickets.filter(t => {
    if (filterStatus   && t.status   !== filterStatus)   return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  }), [tickets, filterStatus, filterCategory]);

  // ── Guard states ───────────────────────────────────────────────
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
          <h1 className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>
            Admin Access Required
          </h1>
          <p className={`mt-3 text-sm leading-relaxed ${textSub}`}>
            Sign in with the CreatorBridge owner account to manage support tickets.
          </p>
        </div>
      </main>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Ticket size={22} className="text-gold-400" />
          <div>
            <h1 className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-950'}`}>
              Support Tickets
            </h1>
            <p className={`text-xs ${textSub}`}>{tickets.length} total</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchTickets}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
            dark
              ? 'border-white/[0.1] text-charcoal-300 hover:border-white/20 hover:text-white'
              : 'border-gray-300 text-gray-600 hover:border-gray-400'
          }`}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
        dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'
      }`}>
        <Filter size={13} className="text-gold-400 shrink-0" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectCls}>
          <option value="">All categories</option>
          <option value="payment">Payment</option>
          <option value="account">Account</option>
          <option value="violation_report">Violation Report</option>
          <option value="technical">Technical</option>
          <option value="other">Other</option>
        </select>
        {(filterStatus || filterCategory) && (
          <button
            type="button"
            onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
            className={`text-xs font-bold transition-colors ${
              dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Clear filters
          </button>
        )}
        <span className={`ml-auto text-[11px] ${textSub}`}>{displayTickets.length} shown</span>
      </div>

      {fetchErr && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {fetchErr}
        </p>
      )}

      {saveErr && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {saveErr}
        </p>
      )}

      {/* Ticket table */}
      <div className={`overflow-hidden rounded-2xl border shadow-sm ${cardBg}`}>

        {/* Column headers */}
        <div className={`hidden sm:grid sm:grid-cols-[140px_70px_110px_1fr_70px_100px_28px] items-center gap-3 border-b px-5 py-3 text-[10px] font-bold uppercase tracking-widest ${
          dark ? `${divider} text-charcoal-500` : 'border-gray-100 text-gray-400'
        }`}>
          <span>Date</span>
          <span>Type</span>
          <span>Category</span>
          <span>Subject</span>
          <span>Priority</span>
          <span>Status</span>
          <span />
        </div>

        {loading && (
          <div className={`px-5 py-10 text-center text-sm ${textSub}`}>Loading tickets…</div>
        )}

        {!loading && displayTickets.length === 0 && (
          <div className={`px-5 py-12 text-center text-sm ${textSub}`}>
            No tickets match the current filters.
          </div>
        )}

        {!loading && displayTickets.map(ticket => {
          const isExpanded = expandedId === ticket.id;
          const edit       = editMap[ticket.id] ?? { status: ticket.status, priority: ticket.priority, admin_notes: ticket.admin_notes ?? '' };
          const dateStr    = new Date(ticket.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });

          return (
            <div key={ticket.id}>
              {/* Ticket row — clickable to expand */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                className={`w-full border-b text-left transition-colors ${divider} ${
                  dark
                    ? `hover:bg-white/[0.03] ${isExpanded ? 'bg-white/[0.04]' : ''}`
                    : `hover:bg-gray-50 ${isExpanded ? 'bg-gold-50/20' : ''}`
                }`}
              >
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[140px_70px_110px_1fr_70px_100px_28px] items-center gap-3 px-5 py-3.5">
                  <span className={`font-mono text-xs ${textSub}`}>{dateStr}</span>
                  <span className={`text-xs capitalize ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                    {ticket.user_type}
                  </span>
                  <span className={`text-xs capitalize ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                    {ticket.category.replace('_', ' ')}
                  </span>
                  <span className={`truncate text-xs font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {ticket.subject}
                  </span>
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                  {isExpanded
                    ? <ChevronUp  size={14} className="text-gold-400" />
                    : <ChevronDown size={14} className={textSub} />
                  }
                </div>

                {/* Mobile row (stacked) */}
                <div className="flex items-start justify-between gap-3 px-4 py-4 sm:hidden">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {ticket.subject}
                    </p>
                    <p className={`mt-0.5 text-xs ${textSub}`}>
                      {ticket.category.replace('_', ' ')} · {dateStr}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    {isExpanded ? <ChevronUp size={14} className="text-gold-400" /> : <ChevronDown size={14} className={textSub} />}
                  </div>
                </div>
              </button>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className={`border-b px-5 py-5 ${divider} ${
                  dark ? 'bg-charcoal-950/40' : 'bg-gray-50/70'
                }`}>

                  {/* User's description */}
                  <p className={`mb-1 text-xs font-bold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                    User description
                  </p>
                  <p className={`mb-5 text-sm leading-relaxed ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
                    {ticket.description}
                  </p>

                  {/* Admin controls */}
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                        Status
                      </label>
                      <select
                        value={edit.status}
                        onChange={e => setEditMap(prev => ({ ...prev, [ticket.id]: { ...edit, status: e.target.value } }))}
                        className={inputCls}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    <div>
                      <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                        Priority
                      </label>
                      <select
                        value={edit.priority}
                        onChange={e => setEditMap(prev => ({ ...prev, [ticket.id]: { ...edit, priority: e.target.value } }))}
                        className={inputCls}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                        Reference
                      </label>
                      <p className={`pt-2 font-mono text-xs ${textSub}`}>
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Admin notes */}
                  <div className="mb-4">
                    <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                      Admin notes <span className={`font-normal ${textSub}`}>(internal — not visible to user)</span>
                    </label>
                    <textarea
                      value={edit.admin_notes}
                      onChange={e => setEditMap(prev => ({ ...prev, [ticket.id]: { ...edit, admin_notes: e.target.value } }))}
                      rows={3}
                      placeholder="Internal notes about this ticket…"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(null)}
                      className={`text-xs font-bold transition-colors ${
                        dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Collapse
                    </button>
                    <button
                      type="button"
                      onClick={() => saveTicket(ticket.id)}
                      disabled={saving === ticket.id}
                      className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-50"
                    >
                      {saving === ticket.id ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
