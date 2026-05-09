import { AlertTriangle, XCircle, ShieldOff } from 'lucide-react';

/**
 * Displays the user's current violation/strike status on their dashboard.
 *
 * Props:
 *   violations: array of violation objects { id, violation_type, description, strike_number, status, created_at }
 *   dark: boolean
 */
export function ViolationBanner({ violations = [], dark }) {
  const active = violations.filter(v => v.status === 'active');
  if (active.length === 0) return null;

  const highestStrike = Math.max(...active.map(v => v.strike_number));

  if (highestStrike >= 3) {
    return (
      <div className="mb-4 p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-start gap-3">
        <ShieldOff size={18} className="text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-sm text-red-400">Account Suspended</p>
          <p className="text-xs text-red-300 mt-1 leading-snug">
            Your account has been suspended due to repeated violations of our platform policies.
            Your profile is not visible to clients and you cannot send messages or accept projects.
            {/* TODO: Update to support@creatorbridge.studio once domain email is active */}
            To appeal, contact <a href="mailto:drl33@creatorbridge.studio" className="underline">drl33@creatorbridge.studio</a>.
          </p>
          <p className="text-[10px] text-red-400/70 mt-2">Strike 3 of 3 active</p>
        </div>
      </div>
    );
  }

  if (highestStrike === 2) {
    return (
      <div className="mb-4 p-4 rounded-2xl border border-gold-500/40 bg-gold-500/10 flex items-start gap-3">
        <AlertTriangle size={18} className="text-gold-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-sm text-gold-400">Account Under Review</p>
          <p className="text-xs text-gold-300 mt-1 leading-snug">
            Your account has received a second violation. For 30 days, your profile will be deprioritized
            in search results and you will have reduced access to posting new projects.
            Continued violations may result in suspension.
          </p>
          <p className="text-[10px] text-gold-400/70 mt-2">Strike 2 of 3 active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 rounded-2xl border border-gold-500/30 bg-gold-500/10 flex items-start gap-3">
      <AlertTriangle size={18} className="text-gold-400 mt-0.5 shrink-0" />
      <div>
        <p className="font-bold text-sm text-gold-400">Platform Warning</p>
        <p className="text-xs text-gold-300 mt-1 leading-snug">
          Your account has received a warning for a policy violation.
          Repeated violations may result in suspension.
          Please review our{' '}
          <a href="/terms" className="underline hover:text-gold-200">platform policies</a>.
        </p>
        {active[0]?.description && (
          <p className="text-[10px] text-gold-400/70 mt-1">Reason: {active[0].description}</p>
        )}
        <p className="text-[10px] text-gold-400/60 mt-1">Strike 1 of 3</p>
      </div>
    </div>
  );
}

/**
 * Load violation data for a given user.
 * Returns array of violation objects.
 */
export async function loadViolations(userId, supabase, supabaseConfigured) {
  if (!userId) return [];
  try {
    if (supabaseConfigured && supabase) {
      const { data } = await supabase
        .from('violations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      return data || [];
    }
    const all = JSON.parse(localStorage.getItem('cm-violations') || '[]');
    return all.filter(v => v.userId === userId && v.status === 'active');
  } catch { return []; }
}

/**
 * Small badge shown on a creator's public profile if they are under review (strike 2).
 */
export function UnderReviewBadge() {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 text-[10px] font-bold ring-1 ring-gold-500/25">
      <AlertTriangle size={9} /> Under Review
    </span>
  );
}
