import { useState, useEffect } from 'react';
import { Copy, Check, Users, Gift, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

// ── Referral helpers ──────────────────────────────────────────

function getReferralCode(userId) {
  // Use first 8 chars of user ID as the referral code
  return userId ? userId.replace(/-/g, '').slice(0, 8).toUpperCase() : 'LOADING';
}

function getReferralLink(userId, creatorListingId) {
  const path = creatorListingId ? `/creator/${creatorListingId}` : '/find';
  return `https://www.creatormatch.studio${path}?ref=${getReferralCode(userId)}`;
}

function loadLocalReferralStats(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-referrals') || '[]');
    const mine = all.filter(r => r.referrerId === userId);
    return {
      sent:        mine.length,
      signedUp:    mine.filter(r => r.status !== 'pending').length,
      completed:   mine.filter(r => r.status === 'completed').length,
      rewards:     mine.filter(r => r.rewardIssued).length,
    };
  } catch { return { sent: 0, signedUp: 0, completed: 0, rewards: 0 }; }
}

async function loadReferralStats(userId) {
  if (!userId) return { sent: 0, signedUp: 0, completed: 0, rewards: 0 };

  if (supabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('referrals')
      .select('status, reward_issued')
      .eq('referrer_id', userId);

    if (!error && Array.isArray(data)) {
      return {
        sent:      data.length,
        signedUp:  data.filter(r => r.status !== 'pending').length,
        completed: data.filter(r => r.status === 'completed').length,
        rewards:   data.filter(r => r.reward_issued).length,
      };
    }
  }

  return loadLocalReferralStats(userId);
}

/**
 * Checks the URL on mount for a ?ref= parameter and records it.
 * Called during signup - exported so auth flow can call it.
 */
export function captureReferralCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      sessionStorage.setItem('cm-referral-code', ref);
    }
    return ref;
  } catch { return null; }
}

export function applyReferralOnSignup(newUserId, referralCode) {
  if (!referralCode) return;
  try {
    const all = JSON.parse(localStorage.getItem('cm-referrals') || '[]');
    const referrerEntry = all.find(r => r.referralCode === referralCode);
    all.push({
      id:            Date.now().toString(),
      referralCode,
      referrerId:    referrerEntry?.referrerId || referralCode, // best effort
      referredId:    newUserId,
      status:        'signed_up',
      rewardIssued:  false,
      createdAt:     new Date().toISOString(),
    });
    localStorage.setItem('cm-referrals', JSON.stringify(all));
    // Set first_booking_fee_waived flag for the new user
    const profile = JSON.parse(localStorage.getItem(`cm-profile-${newUserId}`) || '{}');
    profile.first_booking_fee_waived = true;
    localStorage.setItem(`cm-profile-${newUserId}`, JSON.stringify(profile));
    sessionStorage.removeItem('cm-referral-code');
  } catch {}
}

/**
 * ReferralSection — shown in both Creator and Client dashboards.
 *
 * Props:
 *   dark — boolean
 *   userType — 'creator' | 'client'
 */
export function ReferralSection({ dark, userType = 'creator' }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [stats, setStats]   = useState({ sent: 0, signedUp: 0, completed: 0, rewards: 0 });
  const [creatorListingId, setCreatorListingId] = useState(null);

  useEffect(() => {
    let alive = true;
    if (user) {
      loadReferralStats(user.id).then(nextStats => {
        if (alive) setStats(nextStats);
      });
    }
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    let alive = true;
    async function loadCreatorListingId() {
      if (!user?.id || userType !== 'creator' || !supabaseConfigured || !supabase) return;
      const { data } = await supabase
        .from('creator_listings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (alive) setCreatorListingId(data?.id || null);
    }
    loadCreatorListingId();
    return () => { alive = false; };
  }, [user?.id, userType]);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  const referralLink = user ? getReferralLink(user.id, creatorListingId) : '';

  function copyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const policyLine = 'CreatorBridge does not pay rewards for signups, referrals of other creators, or recruiting activity. Credits are tied only to completed client projects.';
  const inviteCopy = 'Invite new clients to book through CreatorBridge. New clients may receive a first-booking credit, and creators may receive a platform credit after a completed project.';

  const rewards = userType === 'creator'
    ? [
        {
          title: 'New client books through your link',
          trigger: 'Their first paid project is completed and released',
          reward: 'A small platform credit may be added to offset your future creator fee.',
        },
      ]
    : [
        {
          title: 'New client joins through a creator link',
          trigger: 'They book their first project on CreatorBridge',
          reward: 'Their first client booking fee may be credited on that booking.',
        },
      ];

  return (
    <div className="space-y-4">
      <div className={cardCls + ' p-5'}>
        <div className="flex items-center gap-2 mb-4">
          <Gift size={18} className="text-gold-400" />
          <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Referral Program</h2>
        </div>

        <p className={`text-sm mb-4 ${textSub}`}>{inviteCopy}</p>

        {/* Referral link */}
        <div>
          <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Your Referral Link</p>
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${dark ? 'border-white/[0.09] bg-charcoal-950/60' : 'border-gray-200 bg-gray-50'}`}>
            <span className={`flex-1 text-xs font-mono truncate ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              {referralLink}
            </span>
            <button type="button" onClick={copyLink}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                copied ? 'text-gold-300' : 'text-gold-400 hover:text-gold-300'
              }`}>
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Links Shared', value: stats.sent,      icon: Users,      color: 'text-gold-400' },
          { label: 'Signed Up',    value: stats.signedUp,  icon: TrendingUp, color: 'text-gold-300' },
          { label: 'Completed',    value: stats.completed, icon: Check,      color: 'text-gold-400' },
          { label: 'Rewards',      value: stats.rewards,   icon: Gift,       color: 'text-gold-300' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${cardCls} p-4`}>
            <Icon size={14} className={color + ' mb-2'} />
            <p className={`font-bold text-2xl ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            <p className={`text-xs mt-0.5 ${textSub}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Reward rules */}
      <div className={cardCls + ' p-5'}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${textSub}`}>How Rewards Work</p>
        <div className="space-y-3">
          {rewards.map((r, i) => (
            <div key={i} className={`rounded-xl border p-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/45' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{r.title}</p>
              <p className={`text-xs mt-1 ${textSub}`}>
                <span className="font-medium">Trigger:</span> {r.trigger}
              </p>
              <p className={`text-xs mt-0.5 text-gold-400 font-medium`}>
                Your reward: {r.reward}
              </p>
            </div>
          ))}
          <div className={`rounded-xl border p-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/45' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>People who join through your link</p>
            <p className={`text-xs mt-1 text-gold-300 font-medium`}>
              Their reward: First client booking fee waived (the 5% booking fee is removed on their very first project)
            </p>
          </div>
          <p className={`text-[10px] ${textSub}`}>{policyLine}</p>
        </div>
      </div>
    </div>
  );
}
