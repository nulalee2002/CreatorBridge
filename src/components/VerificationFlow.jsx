import { useState } from 'react';
import { Check, BadgeCheck, Upload, Video } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

/**
 * Returns the verification status badge for a creator.
 * Used in directory cards and profile headers.
 */
export function VerificationBadge({ status }) {
  if (!status || status === 'unverified') return null;

  if (status === 'pro_verified') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-500/20 text-forest-100 text-[10px] font-bold ring-1 ring-forest-300/35">
        <BadgeCheck size={10} /> Pro Verified
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-500/15 text-forest-100 text-[10px] font-bold ring-1 ring-forest-300/25">
      <BadgeCheck size={10} /> Verified
    </span>
  );
}

function StepRow({ number, title, description, status, children, dark }) {
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  const icon =
    status === 'done' ? (
      <div className="w-7 h-7 rounded-full bg-forest-500/20 ring-1 ring-forest-300/25 flex items-center justify-center shrink-0">
        <Check size={13} className="text-forest-100" />
      </div>
    ) : status === 'partial' ? (
      <div className="w-7 h-7 rounded-full bg-gold-500/10 ring-1 ring-gold-500/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gold-300">{number}</span>
      </div>
    ) : (
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.08]' : 'bg-gray-100'}`}>
        <span className={`text-[10px] font-bold ${textSub}`}>{number}</span>
      </div>
    );

  return (
    <div className={`rounded-xl border p-4 ${
      status === 'done'
        ? 'border-gold-500/25 bg-gold-500/[0.06]'
        : status === 'partial'
        ? 'border-gold-500/20 bg-gold-500/[0.04]'
        : dark ? 'border-white/[0.07] bg-charcoal-950/45' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
          <p className={`text-xs mt-0.5 ${textSub}`}>{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Full verification flow for the Creator Dashboard.
 * Props: creator (object), dark (bool), onUpdate (fn called after save)
 */
export function VerificationFlow({ creator, dark, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [credentialNote, setCredentialNote] = useState('');
  const [credSaved, setCredSaved] = useState(false);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  // Step 1: Identity — auto-verified if Stripe is connected
  const identityDone = creator?.stripe_onboarded === true;

  // Step 2: Portfolio — need 3+ CreatorBridge-hosted media items
  const portfolioItems = creator?.portfolio || creator?.portfolio_items || [];
  const hostedPortfolio = portfolioItems.filter(p => (
    p.bunny_video_id ||
    p.videoRef ||
    p.imageUrl ||
    p.image_url
  ));
  const portfolioDone = hostedPortfolio.length >= 3;

  // Step 3: Required Bunny intro
  const introDone = String(creator?.video_intro_url || creator?.videoIntroUrl || '').startsWith('bunny:');

  // Step 4: Credentials (optional)
  const steps = creator?.verification_steps || {};
  const credentialsDone = steps.credentials_submitted === true;

  // Overall status
  const allCoreComplete = identityDone && portfolioDone && introDone;
  const currentStatus = allCoreComplete && credentialsDone ? 'pro_verified'
    : allCoreComplete ? 'verified'
    : 'unverified';

  async function submitCredential() {
    if (!credentialNote.trim()) return;
    setSaving(true);
    const newSteps = { ...(creator?.verification_steps || {}), credentials_submitted: true, credential_note: credentialNote };
    if (supabaseConfigured && creator?.id) {
      await supabase.from('creator_listings').update({ verification_steps: newSteps }).eq('id', creator.id);
    } else {
      try {
        const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
        const idx = all.findIndex(c => c.id === creator?.id);
        if (idx !== -1) {
          all[idx] = { ...all[idx], verification_steps: newSteps };
          localStorage.setItem('creator-directory', JSON.stringify(all));
        }
      } catch {}
    }
    setCredSaved(true);
    onUpdate?.({ verification_steps: newSteps });
    setSaving(false);
  }

  const statusLabel = { unverified: 'Unverified', verified: 'Verified', pro_verified: 'Pro Verified' }[currentStatus];

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${textSub}`}>Verification</p>
          <p className={`text-base font-bold mt-0.5 ${dark ? 'text-white' : 'text-gray-900'}`}>
            {statusLabel}
            {currentStatus !== 'unverified' && <VerificationBadge status={currentStatus} />}
          </p>
        </div>
        {currentStatus !== 'unverified' && (
          <div className="flex items-center gap-2">
            <VerificationBadge status={currentStatus} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Step 1: Identity */}
        <StepRow
          number={1}
          title="Identity Verification"
          description="Verified automatically when you connect your Stripe payment account."
          status={identityDone ? 'done' : 'pending'}
          dark={dark}
        >
          {!identityDone && (
            <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              Connect your payment account from the Payments tab to verify your identity.
            </p>
          )}
        </StepRow>

        {/* Step 2: Portfolio */}
        <StepRow
          number={2}
          title="Portfolio Verification"
          description="Add at least 3 CreatorBridge-hosted portfolio photos or Bunny videos."
          status={portfolioDone ? 'done' : hostedPortfolio.length > 0 ? 'partial' : 'pending'}
          dark={dark}
        >
          <div className="flex items-center gap-2">
            {[0,1,2].map(i => (
              <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center ${
                hostedPortfolio.length > i ? 'bg-gold-500/20 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.08]' : 'bg-gray-200'
              }`}>
                {hostedPortfolio.length > i
                  ? <Check size={10} className="text-gold-400" />
                  : <span className={`text-[9px] ${textSub}`}>{i+1}</span>
                }
              </div>
            ))}
            <span className={`text-xs ${textSub}`}>
              {hostedPortfolio.length} / 3 hosted portfolio items
            </span>
          </div>
        </StepRow>

        {/* Step 3: Intro Video */}
        <StepRow
          number={3}
          title="Intro Video"
          description="Upload your required Bunny-hosted intro from the Video Intro tab."
          status={introDone ? 'done' : 'pending'}
          dark={dark}
        >
          <p className={`text-xs flex items-center gap-2 ${introDone ? 'text-gold-300' : textSub}`}>
            <Video size={12} /> {introDone ? 'Intro video is attached.' : 'Intro video is required before verification.'}
          </p>
        </StepRow>

        {/* Step 4: Credentials (optional) */}
        <StepRow
          number={4}
          title="Professional Credentials"
          description="Optional: Submit proof of certifications (FAA Part 107, business license, insurance). Admin reviews manually."
          status={credentialsDone ? 'done' : 'pending'}
          dark={dark}
        >
          {credentialsDone || credSaved ? (
            <p className="text-xs text-gold-300 flex items-center gap-1"><Check size={11} /> Credentials submitted for admin review</p>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={credentialNote}
                onChange={e => setCredentialNote(e.target.value)}
                placeholder="Describe your credentials (e.g. FAA Part 107 certified, licensed LLC, insured up to $1M)..."
                className={`${inputCls} resize-none text-xs`}
              />
              <button type="button" onClick={submitCredential} disabled={saving || !credentialNote.trim()}
                className="px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-xs font-bold transition-all flex items-center gap-1">
                <Upload size={11} /> Submit for Review
              </button>
            </div>
          )}
        </StepRow>
      </div>
    </div>
  );
}
