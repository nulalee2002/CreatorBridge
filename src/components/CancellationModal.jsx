import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { getCancellationFee, getCancellationRule, CANCELLATION_RULES } from '../config/fees.js';

/**
 * CancellationModal — shown when a client wants to cancel a project.
 * Props: project, dark, onClose, onConfirm(project, reason)
 *
 * Cancellation policy (3 rules):
 *  Rule 1 — Before work begins:  creator keeps 25%
 *  Rule 2 — After work begins:   creator keeps 50%
 *  Rule 3 — After delivery:      no refund (creator keeps 100%)
 */
export function CancellationModal({ project, dark, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason]       = useState('');

  const projectTotal = Number(project?.budgetMax || project?.budgetMin || 0);
  const { rule, feePct, creatorKeepsDollars, clientRefundDollars } = getCancellationFee(projectTotal, project?.status);
  const currentRule = getCancellationRule(project?.status);

  const fmt = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border overflow-hidden ${dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200 shadow-2xl'}`}>
        <div className="h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Cancel Project</h3>
              <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>{project?.title}</p>
            </div>
          </div>

          {/* Policy rules */}
          <div className={`rounded-xl border p-4 mb-4 ${dark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
              Cancellation Policy
            </p>
            <div className="space-y-2 mb-4">
              {CANCELLATION_RULES.map((r, i) => {
                const isCurrent = r.id === currentRule.id;
                return (
                  <div key={r.id} className={`rounded-xl px-3 py-2.5 border transition-all ${
                    isCurrent
                      ? dark ? 'bg-red-500/15 border-red-500/40' : 'bg-red-50 border-red-200'
                      : dark ? 'border-white/[0.07]' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? 'bg-red-500 text-white'
                            : dark ? 'bg-white/[0.07] text-charcoal-300' : 'bg-gray-200 text-gray-500'
                        }`}>Rule {i + 1}</span>
                        <span className={`text-xs font-semibold ${isCurrent ? 'text-red-400' : dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                          {r.label}
                        </span>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${
                        r.keepPct === 100 ? 'text-red-400'
                        : r.keepPct === 0 ? 'text-gold-400'
                        : isCurrent ? 'text-red-400' : dark ? 'text-charcoal-300' : 'text-gray-500'
                      }`}>
                        Creator keeps {r.keepPct}%
                      </span>
                    </div>
                    {isCurrent && (
                      <p className={`text-[11px] mt-1 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>{r.description}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current outcome */}
            {projectTotal > 0 ? (
              <div className={`rounded-lg p-3 ${dark ? 'bg-charcoal-950/70 border border-white/[0.07]' : 'bg-white border border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>Creator retains ({feePct}%)</span>
                  <span className="text-sm font-bold text-red-400">{fmt(creatorKeepsDollars)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>Your refund</span>
                  <span className="text-sm font-bold text-gold-400">{fmt(clientRefundDollars)}</span>
                </div>
              </div>
            ) : (
              <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-400'} italic`}>
                Final amounts calculated at payment time based on the rule above.
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="mb-5">
            <label className={`text-xs font-medium block mb-1.5 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
              Reason for cancellation (optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Let the creator know why you're cancelling..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Warning */}
          <div className={`flex items-start gap-2 p-3 rounded-xl mb-5 ${dark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-gold-50 border border-gold-200'}`}>
            <AlertTriangle size={13} className="text-gold-400 mt-0.5 shrink-0" />
            <p className={`text-xs leading-snug ${dark ? 'text-gold-300' : 'text-gold-800'}`}>
              Cancellations are final. Repeated cancellations may affect your account standing on CreatorBridge.
            </p>
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-2 mb-5 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-gold-500" />
            <span className={`text-xs leading-snug ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              I understand this cancellation cannot be undone.
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              Keep Project
            </button>
            <button type="button"
              disabled={!confirmed}
              onClick={() => onConfirm?.(project, reason)}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold transition-all">
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
