import { useState } from 'react';
import { Repeat, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

export function CollaborationReviewActions({ collaboration, userId, onChanged }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [scope, setScope] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const canReview = ['approved', 'completed'].includes(collaboration?.status);
  const canRehire = canReview && collaboration?.prime_user_id === userId;

  async function submitReview() {
    setSaving(true);
    setMessage('');
    const { error } = await supabase.rpc('submit_collaboration_review', {
      p_collaboration_id: collaboration.id,
      p_rating: Number(rating),
      p_comment: comment,
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setComment('');
    setMessage('Verified Creator Collaboration review recorded. It will not affect public rating, loyalty, or tiers.');
    onChanged?.();
  }

  async function rehire() {
    const amountCents = Math.round(Number(amount) * 100);
    if (!scope.trim() || !deadline || !Number.isFinite(amountCents)) {
      setMessage('Add a fresh scope, price, and deadline before rehiring.');
      return;
    }
    setSaving(true);
    setMessage('');
    const { error } = await supabase.rpc('rehire_creator_collaborator', {
      p_previous_collaboration_id: collaboration.id,
      p_project_id: null,
      p_scope: scope,
      p_amount_cents: amountCents,
      p_deadline: deadline,
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setScope('');
    setAmount('');
    setDeadline('');
    setMessage('Rehire invitation sent with fresh scope, price, and deadline.');
    onChanged?.();
  }

  if (!canReview) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
      <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400">Verified Creator Collaboration</p>
      <h4 className="mt-1 font-display text-lg font-bold">Collaboration feedback</h4>
      <p className="mt-2 text-xs leading-5 text-charcoal-300">
        Internal collaboration reviews are labeled separately and excluded from public ratings, loyalty counts, and tier movement during this phase.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[130px_1fr_auto]">
        <select value={rating} onChange={(event) => setRating(event.target.value)} className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm">
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
        </select>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Private collaboration note" className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500" />
        <button type="button" onClick={submitReview} disabled={saving} className="btn-gold justify-center text-xs">
          <Star size={14} /> Save review
        </button>
      </div>

      {canRehire && (
        <div className="mt-5 rounded-2xl border border-gold-500/15 bg-gold-500/5 p-4">
          <p className="text-xs font-bold text-gold-200">Rehire this collaborator</p>
          <p className="mt-1 text-[11px] leading-5 text-charcoal-300">CreatorBridge copies the relationship only. You must enter a new scope, price, and deadline.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_150px_auto]">
            <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Fresh scope" className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500" />
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="$ amount" inputMode="decimal" className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500" />
            <input value={deadline} onChange={(event) => setDeadline(event.target.value)} type="date" className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none" />
            <button type="button" onClick={rehire} disabled={saving} className="btn-ghost justify-center text-xs">
              <Repeat size={14} /> Rehire
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-charcoal-200">{message}</p>}
    </section>
  );
}
