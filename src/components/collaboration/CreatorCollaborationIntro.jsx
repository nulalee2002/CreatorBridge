import { Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { recordDirectionalEvent } from '../../lib/platformIntelligence.js';

export function CreatorCollaborationIntro({ open, onClose, onBuildTeam, dark = true }) {
  if (!open) return null;
  const dismiss = async () => {
    await recordDirectionalEvent({ name: 'onboarding.intro_dismissed', version: 1, entityType: 'creator_dashboard', surface: 'creator_dashboard', properties: { surface: 'creator_dashboard' } });
    await supabase?.rpc('mark_collaboration_intro_seen');
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="collaboration-intro-title">
      <div className={`relative w-full max-w-xl rounded-2xl border p-7 shadow-2xl ${dark ? 'border-gold-500/25 bg-charcoal-950 text-white' : 'border-gray-200 bg-white text-gray-950'}`}>
        <button type="button" onClick={dismiss} aria-label="Close collaboration introduction" className="absolute right-4 top-4 rounded-full border border-white/10 p-2"><X size={16}/></button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500 text-charcoal-950"><Users size={22}/></div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-gold-400">One professional account</p>
        <h2 id="collaboration-intro-title" className="font-display text-3xl font-bold">Offer your services. Build your team.</h2>
        <p className="mt-4 text-sm leading-6 text-charcoal-200">Your one account can offer services and hire collaborators. Bring verified editors, photographers, and production specialists into a private project workspace while you remain the only creator communicating with the outside client.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={async () => { await dismiss(); onBuildTeam(); }} className="btn-gold">Build Your Team</button>
          <button type="button" onClick={dismiss} className="btn-ghost">Explore later</button>
        </div>
      </div>
    </div>
  );
}
