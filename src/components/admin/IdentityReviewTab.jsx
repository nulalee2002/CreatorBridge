import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

const ACTIONS = {
  manual_review: [
    ['request_secure_retry', 'Request secure retry'],
    ['clear_false_positive', 'Clear false positive'],
    ['confirm_duplicate', 'Confirm duplicate'],
    ['reject_verification', 'Reject verification'],
  ],
  retry_required: [
    ['request_secure_retry', 'Keep retry available'],
    ['reject_verification', 'Reject verification'],
  ],
  rejected: [
    ['request_secure_retry', 'Request secure retry'],
    ['confirm_duplicate', 'Confirm duplicate'],
    ['restore_original_account', 'Restore original account'],
  ],
  reverification_required: [
    ['restore_original_account', 'Restore original account'],
  ],
};

const ADVERSE_ACTIONS = new Set(['confirm_duplicate', 'reject_verification']);

function statusLabel(status) {
  return String(status || 'unknown').replace(/_/g, ' ');
}

export function IdentityReviewTab({ dark }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [working, setWorking] = useState(null);
  const [forms, setForms] = useState({});

  const text = dark ? 'text-charcoal-200' : 'text-gray-700';
  const subtext = dark ? 'text-charcoal-400' : 'text-gray-500';
  const border = dark ? 'border-white/[0.08]' : 'border-gray-200';
  const field = `w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gold-500/40 ${
    dark ? 'border-white/[0.1] bg-charcoal-900 text-white' : 'border-gray-300 bg-white text-gray-900'
  }`;

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('get_admin_identity_review_queue');
    if (loadError) setError(loadError.message);
    else setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const visibleRows = useMemo(
    () => rows.filter(row => filter === 'all' || row.status === filter),
    [filter, rows],
  );

  function updateForm(id, patch) {
    setForms(current => ({
      ...current,
      [id]: { action: '', reason: '', originalUserId: '', ...current[id], ...patch },
    }));
  }

  async function resolve(row) {
    const form = forms[row.verification_id] || {};
    const action = form.action || '';
    const reason = String(form.reason || '').trim();
    if (!action) {
      setError('Choose a review action.');
      return;
    }
    if (reason.length < 3) {
      setError('Enter a specific review reason before continuing.');
      return;
    }
    if (action === 'confirm_duplicate' && !String(form.originalUserId || '').trim()) {
      setError('Enter the verified original account user ID.');
      return;
    }
    if (ADVERSE_ACTIONS.has(action) && !window.confirm('Confirm this adverse identity decision. The reason will be permanently audited.')) {
      return;
    }

    setWorking(row.verification_id);
    setError('');
    const { error: actionError } = await supabase.rpc('admin_resolve_identity_review', {
      p_verification_id: row.verification_id,
      p_action: action,
      p_reason: reason,
      p_original_user_id: action === 'confirm_duplicate' ? form.originalUserId.trim() : null,
    });
    if (actionError) setError(actionError.message);
    else {
      setExpanded(null);
      await load();
    }
    setWorking(null);
  }

  if (loading) return <p className={`py-12 text-center text-sm ${subtext}`}>Loading identity review queue...</p>;

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-3 border-b p-4 ${border}`}>
        <div>
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>Human identity review</p>
          <p className={`mt-1 text-xs ${subtext}`}>Only reduced provider results are stored here. Review evidence stays in Stripe.</p>
        </div>
        <select value={filter} onChange={event => setFilter(event.target.value)} className={`${field} ml-auto w-auto`}>
          <option value="all">All review states</option>
          <option value="manual_review">Manual review</option>
          <option value="retry_required">Retry required</option>
          <option value="duplicate_restricted">Duplicate restricted</option>
          <option value="rejected">Rejected</option>
          <option value="reverification_required">Reverification required</option>
        </select>
        <button type="button" onClick={load} className={`flex items-center gap-1.5 text-xs font-bold ${subtext}`}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <p className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</p>}
      {visibleRows.length === 0 && (
        <div className={`py-14 text-center text-sm ${subtext}`}>No identity cases need attention.</div>
      )}

      {visibleRows.map(row => {
        const isOpen = expanded === row.verification_id;
        const form = forms[row.verification_id] || {};
        const actions = ACTIONS[row.status] || [];
        const stripeUrl = `https://dashboard.stripe.com/identity/verification-sessions/${encodeURIComponent(row.provider_session_id)}`;
        return (
          <div key={row.verification_id} className={`border-b ${border}`}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : row.verification_id)}
              className={`grid w-full grid-cols-1 gap-2 px-4 py-4 text-left sm:grid-cols-[1.4fr_1fr_1fr_90px] ${
                dark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'
              }`}
            >
              <div>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>{row.member_name || 'CreatorBridge member'}</p>
                <p className={`font-mono text-[10px] ${subtext}`}>{row.target_user_id}</p>
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${subtext}`}>Review state</p>
                <p className={`mt-1 text-xs font-bold capitalize ${row.status === 'duplicate_restricted' ? 'text-red-400' : 'text-gold-400'}`}>
                  {statusLabel(row.status)}
                </p>
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${subtext}`}>Capabilities</p>
                <p className={`mt-1 text-xs ${text}`}>{row.member_role || 'member'} · {row.phone_verified ? 'phone verified' : 'phone unverified'}</p>
              </div>
              <p className={`text-right text-xs ${subtext}`}>{row.attempt_count} attempt{row.attempt_count === 1 ? '' : 's'}</p>
            </button>

            {isOpen && (
              <div className={`border-t px-4 py-5 ${border} ${dark ? 'bg-charcoal-950/50' : 'bg-gray-50'}`}>
                <div className="grid gap-4 text-xs sm:grid-cols-3">
                  <div><p className={`font-bold ${subtext}`}>Provider checks</p><p className={`mt-1 ${text}`}>Adult: {String(row.adult_verified)} · Document: {row.document_status || 'not complete'} · Selfie: {row.selfie_status || 'not complete'}</p></div>
                  <div><p className={`font-bold ${subtext}`}>Account context</p><p className={`mt-1 ${text}`}>{row.has_creator_listing ? 'Creator listing' : 'No creator listing'} · {row.creator_approved ? 'approved' : 'not approved'} · {row.project_count} projects</p></div>
                  <div><p className={`font-bold ${subtext}`}>Risk context</p><p className={`mt-1 ${text}`}>{statusLabel(row.risk_label || 'none')}</p></div>
                </div>

                <div className={`mt-4 rounded-xl border p-3 ${border}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert size={14} className="text-gold-400" />
                    <span className={`text-xs font-bold ${text}`}>Stripe session reference</span>
                    <code className={`break-all text-[10px] ${subtext}`}>{row.provider_session_id}</code>
                    <a href={stripeUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs font-bold text-gold-400">
                      Open secured provider review <ExternalLink size={12} />
                    </a>
                  </div>
                  {row.review_reason && <p className={`mt-2 text-xs ${subtext}`}>Current reason: {row.review_reason}</p>}
                  {row.linked_original_user_id && <p className={`mt-1 font-mono text-[10px] ${subtext}`}>Original account: {row.linked_original_user_id}</p>}
                </div>

                {actions.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <select value={form.action || ''} onChange={event => updateForm(row.verification_id, { action: event.target.value })} className={field}>
                      <option value="">Choose review action</option>
                      {actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {form.action === 'confirm_duplicate' && (
                      <input
                        value={form.originalUserId || ''}
                        onChange={event => updateForm(row.verification_id, { originalUserId: event.target.value })}
                        placeholder="Verified original account user ID"
                        className={field}
                      />
                    )}
                    <textarea
                      rows={3}
                      value={form.reason || ''}
                      onChange={event => updateForm(row.verification_id, { reason: event.target.value })}
                      placeholder="Required audit reason"
                      className={`${field} resize-none sm:col-span-2`}
                    />
                    <button
                      type="button"
                      onClick={() => resolve(row)}
                      disabled={working === row.verification_id}
                      className="justify-self-end rounded-full bg-gold-500 px-5 py-2 text-xs font-bold text-charcoal-950 disabled:opacity-50 sm:col-span-2"
                    >
                      {working === row.verification_id ? 'Saving decision...' : 'Save audited decision'}
                    </button>
                  </div>
                ) : (
                  <p className={`mt-4 text-xs ${subtext}`}>This restriction is preserved for recovery history. Restore the verified original account instead of enabling this duplicate.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
