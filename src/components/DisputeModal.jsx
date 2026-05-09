import { useState } from 'react';
import { X, AlertTriangle, Send, Loader, Shield } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PLATFORM_FEES } from '../config/fees.js';

const DISPUTE_REASONS = [
  { id: 'not_as_described',  label: 'Work not as described'               },
  { id: 'brief_not_followed',label: 'Creator did not follow brief'         },
  { id: 'quality_issue',     label: 'Technical quality issues'            },
  { id: 'other',             label: 'Other'                               },
];

/**
 * DisputeModal
 * Props:
 *   project       — the project object
 *   dark          — boolean
 *   onClose       — () => void
 *   onSubmitted   — () => void  (called after successful dispute creation)
 */
export function DisputeModal({ project, dark, onClose, onSubmitted }) {
  const { user } = useAuth();
  const [reason, setReason]   = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-red-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-red-400'
  }`;

  async function handleSubmit() {
    if (!reason || details.trim().length < 100) {
      setError(!reason ? 'Please select a reason.' : 'Please provide at least 100 characters describing the issue.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (supabaseConfigured) {
        // Find the transaction for this project
        const { data: txn } = await supabase
          .from('transactions')
          .select('id')
          .eq('project_id', project.id)
          .single();

        if (txn) {
          await supabase.from('disputes').insert({
            transaction_id:   txn.id,
            raised_by:        user.id,
            reason:           `${reason}: ${details.trim()}`,
            status:           'open',
          });
        }
      } else {
        // localStorage fallback
        const all = JSON.parse(localStorage.getItem('cm-disputes') || '[]');
        all.push({
          id:           Date.now().toString(),
          projectId:    project.id,
          projectTitle: project.title,
          raisedBy:     user?.id || 'anon',
          reason:       `${reason}: ${details.trim()}`,
          status:       'open',
          createdAt:    new Date().toISOString(),
        });
        localStorage.setItem('cm-disputes', JSON.stringify(all));
      }

      setDone(true);
    } catch (e) {
      setError(e.message || 'Failed to submit dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={!done ? onClose : undefined} />
      <div className={`relative w-full max-w-md rounded-2xl border overflow-hidden ${dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200 shadow-2xl'}`}>
        <div className={`h-px bg-gradient-to-r from-transparent ${done ? 'via-gold-400/70' : 'via-red-400/70'} to-transparent`} />
        {!done && (
          <button type="button" onClick={onClose}
            className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X size={16} />
          </button>
        )}

        <div className="p-6">
          {done ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-gold-500/15 ring-1 ring-gold-500/25 flex items-center justify-center mx-auto mb-4">
                <Shield size={28} className="text-gold-400" />
              </div>
              <h3 className={`font-display font-bold text-lg mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
                Dispute Submitted
              </h3>
              <p className={`text-sm leading-relaxed mb-6 ${textSub}`}>
                Your dispute has been logged. Our team will review it within 2 business days and
                contact both parties. Payments are held until the dispute is resolved.
              </p>
              <button type="button" onClick={onSubmitted}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold text-sm transition-all">
                Done
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
                    Open a Dispute
                  </h3>
                  <p className={`text-xs mt-0.5 ${textSub}`}>{project.title}</p>
                </div>
              </div>

              {/* Warning */}
              <div className={`p-3 rounded-xl mb-4 ${dark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-xs text-red-400 leading-relaxed">
                  Disputes pause all payments until resolved. Our team reviews disputes within 2 business days.
                  For minor issues, consider messaging the creator first.
                </p>
              </div>

              <div className="space-y-4">
                {/* Reason selector */}
                <div>
                  <p className={`text-xs font-medium mb-2 ${textSub}`}>Reason for dispute</p>
                  <div className="space-y-1.5">
                    {DISPUTE_REASONS.map(r => (
                      <button key={r.id} type="button" onClick={() => setReason(r.id)}
                        className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          reason === r.id
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : dark ? 'border-white/[0.08] text-charcoal-300 hover:border-red-500/40 hover:text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          reason === r.id ? 'border-red-400 bg-red-400' : dark ? 'border-white/[0.16]' : 'border-gray-300'
                        }`}>
                          {reason === r.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div>
                  <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Additional details</p>
                  <textarea rows={4} value={details} onChange={e => setDetails(e.target.value)}
                    placeholder="Describe the issue in detail. Include dates, what was agreed, and what went wrong..."
                    className={`${inputCls} resize-none`} />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 mt-3">{error}</p>
              )}

              <div className="flex gap-2 mt-5">
                <button type="button" onClick={onClose}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit}
                  disabled={!reason || !details.trim() || loading}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader size={14} className="animate-spin" /> : <Send size={13} />}
                  {loading ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
