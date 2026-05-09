import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// ── Scoring helpers ─────────────────────────────────────────────

/**
 * Calculate reputation label and color from raw metrics.
 * @param {{ completionRate: number, avgRating: number }} metrics
 * @returns {{ label: string, color: string, textColor: string, bgColor: string }}
 */
export function getReputationScore(metrics = {}) {
  const { completionRate = 100, avgRating = 0, totalProjects = 0 } = metrics;

  // New clients with no history get a neutral "New Client" label
  if (totalProjects === 0) {
    return { label: 'New Client', color: 'neutral', textColor: 'text-charcoal-300', bgColor: 'bg-white/[0.08] ring-white/[0.12]' };
  }

  if (completionRate >= 90 && avgRating >= 4.5) {
    return { label: 'Excellent', color: 'gold', textColor: 'text-gold-400', bgColor: 'bg-gold-500/15 ring-gold-500/25' };
  }
  if (completionRate >= 75 && avgRating >= 4.0) {
    return { label: 'Good', color: 'gold', textColor: 'text-gold-300', bgColor: 'bg-gold-500/10 ring-gold-500/20' };
  }
  if (completionRate >= 60 && avgRating >= 3.0) {
    return { label: 'Fair', color: 'gold', textColor: 'text-gold-300', bgColor: 'bg-gold-500/10 ring-gold-500/20' };
  }
  return { label: 'Caution', color: 'red', textColor: 'text-red-400', bgColor: 'bg-red-500/15 ring-red-500/20' };
}

/**
 * Load client reputation data from localStorage or Supabase.
 */
export async function loadClientReputation(clientId) {
  if (!clientId) return null;
  try {
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('client_profiles')
        .select('avg_rating, total_projects_completed, cancellation_rate, total_reviews, spam_score')
        .eq('user_id', clientId)
        .single();
      if (data) return {
        avgRating:        data.avg_rating || 0,
        totalProjects:    data.total_projects_completed || 0,
        completionRate:   data.cancellation_rate != null ? Math.round(100 - data.cancellation_rate) : 100,
        totalReviews:     data.total_reviews || 0,
      };
    }
    const all = JSON.parse(localStorage.getItem('cm-client-profiles') || '[]');
    const p = all.find(c => c.userId === clientId || c.user_id === clientId);
    if (!p) return null;
    return {
      avgRating:      p.avgRating || p.avg_rating || 0,
      totalProjects:  p.totalProjectsCompleted || p.total_projects_completed || 0,
      completionRate: p.cancellationRate != null ? Math.round(100 - p.cancellationRate) : 100,
      totalReviews:   p.totalReviews || p.total_reviews || 0,
    };
  } catch { return null; }
}

/**
 * Inline badge shown on project cards and message headers.
 * Props: clientId, metrics (optional pre-loaded), dark, size ('sm'|'md')
 */
export function ClientReputationBadge({ metrics, dark, size = 'sm' }) {
  if (!metrics) return null;
  const rep = getReputationScore(metrics);
  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';
  const px = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ring-1 ${textSize} ${px} ${rep.textColor} ${rep.bgColor}`}>
      {rep.label}
    </span>
  );
}

/**
 * Detailed reputation block — shown in project detail or message header.
 */
export function ClientReputationCard({ clientName, metrics, dark }) {
  const rep = getReputationScore(metrics || {});
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-xl border p-3 ${dark ? 'bg-charcoal-950/55 border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`;

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
          {clientName || 'Client'}
        </p>
        <ClientReputationBadge metrics={metrics} dark={dark} size="sm" />
      </div>
      {metrics && metrics.totalProjects > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className={`text-[11px] ${textSub}`}>Completed projects</span>
            <span className={`text-[11px] font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{metrics.totalProjects}</span>
          </div>
          {metrics.completionRate < 100 && (
            <div className="flex justify-between">
              <span className={`text-[11px] ${textSub}`}>Completion rate</span>
              <span className={`text-[11px] font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{metrics.completionRate}%</span>
            </div>
          )}
          {metrics.avgRating > 0 && (
            <div className="flex justify-between items-center">
              <span className={`text-[11px] ${textSub}`}>Creator rating</span>
              <span className={`text-[11px] font-medium flex items-center gap-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
                <Star size={9} className="text-gold-400 fill-gold-400" /> {metrics.avgRating.toFixed(1)}
                <span className={`font-normal ${textSub}`}>({metrics.totalReviews})</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rate This Client modal ──────────────────────────────────────
/**
 * Modal for creators to rate a client after project completion.
 * Props: clientId, clientName, projectId, dark, onClose, onSubmitted
 */
export function RateClientModal({ clientId, clientName, projectId, dark, onClose, onSubmitted }) {
  const { user } = useAuth();
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  async function submit() {
    if (!rating) return;
    setSaving(true);
    const review = {
      id:         Date.now().toString(),
      clientId,
      projectId,
      rating,
      comment:    comment.trim(),
      createdAt:  new Date().toISOString(),
    };

    if (supabaseConfigured) {
      await supabase.from('client_reviews').insert({
        client_id:  clientId,
        reviewer_id: user?.id,
        project_id: projectId,
        rating,
        comment: comment.trim() || null,
      });
    } else {
      const all = JSON.parse(localStorage.getItem('cm-client-reviews') || '[]');
      localStorage.setItem('cm-client-reviews', JSON.stringify([review, ...all]));
    }

    setSaving(false);
    setDone(true);
    onSubmitted?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-sm rounded-2xl border overflow-hidden p-6 ${dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200 shadow-2xl'}`}>
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>

        {done ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">⭐</p>
            <p className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Thanks for your feedback!</p>
            <p className={`text-xs mt-1 ${textSub}`}>Your review helps creators on the platform.</p>
          </div>
        ) : (
          <>
            <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Rate this client</h3>
            <p className={`text-xs mb-4 ${textSub}`}>How was it working with {clientName || 'this client'}?</p>

            {/* Star selector */}
            <div className="flex items-center gap-2 justify-center mb-5">
              {[1,2,3,4,5].map(s => (
                <button key={s} type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-1 transition-transform hover:scale-110">
                  <Star size={28}
                    className={(hovered || rating) >= s ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>

            <div className="mb-4">
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Optional: share what made this client great (or challenging) to work with..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <button type="button" onClick={submit} disabled={!rating || saving}
              className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all">
              {saving ? 'Submitting...' : 'Submit Review'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
