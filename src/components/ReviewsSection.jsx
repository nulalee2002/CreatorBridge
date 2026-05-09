import { useState, useEffect } from 'react';
import { Star, Plus } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}>
          <Star size={20}
            className={s <= (hover || value) ? 'text-gold-400 fill-gold-400' : 'text-charcoal-600'} />
        </button>
      ))}
    </div>
  );
}

export function ReviewsSection({ creator, dark }) {
  const { user } = useAuth();
  const [reviews, setReviews]     = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ rating: 5, comment: '', reviewerName: '' });

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  useEffect(() => {
    loadReviews();
  }, [creator?.id]);

  async function loadReviews() {
    const isSeed = creator.id?.startsWith('seed-');
    if (supabaseConfigured && !isSeed) {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', creator.id)
        .order('created_at', { ascending: false });
      setReviews(data || []);
    } else {
      // Seed creators and no-Supabase fallback: read from localStorage.
      // Seed reviews use listing_id; user-submitted ones use listingId.
      const all = JSON.parse(localStorage.getItem('creator-reviews') || '[]');
      setReviews(
        all
          .filter(r => r.listing_id === creator.id || r.listingId === creator.id)
          .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
      );
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setLoading(true);
    const review = {
      listing_id:    creator.id,
      reviewer_id:   user?.id || null,
      reviewer_name: form.reviewerName || user?.email?.split('@')[0] || 'Anonymous',
      rating:        form.rating,
      comment:       form.comment,
    };
    const isSeed = creator.id?.startsWith('seed-');
    if (supabaseConfigured && !isSeed) {
      await supabase.from('reviews').insert(review);
    } else {
      const all = JSON.parse(localStorage.getItem('creator-reviews') || '[]');
      all.unshift({ ...review, listingId: creator.id, id: Date.now().toString(), createdAt: new Date().toISOString() });
      localStorage.setItem('creator-reviews', JSON.stringify(all));
    }
    setForm({ rating: 5, comment: '', reviewerName: '' });
    setShowForm(false);
    setLoading(false);
    loadReviews();
  }

  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark
      ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className={`rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
            Reviews {reviews.length > 0 && <span className={`text-sm font-normal ${textSub}`}>({reviews.length})</span>}
          </h2>
          {avgRating && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={12}
                    className={s <= Math.round(avgRating) ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'} />
                ))}
              </div>
              <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{avgRating}</span>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 transition-all">
          <Plus size={12} /> Write a Review
        </button>
      </div>

      {/* Review form */}
      {showForm && (
        <form onSubmit={submitReview} className={`mb-4 p-4 rounded-xl border ${dark ? 'border-white/[0.08] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'} space-y-3`}>
          <div>
            <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Your Rating</p>
            <StarPicker value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
          </div>
          {!user && (
            <input type="text" placeholder="Your name" value={form.reviewerName}
              onChange={e => setForm(f => ({ ...f, reviewerName: e.target.value }))}
              className={inputCls} />
          )}
          <textarea placeholder="Share your experience working with this creator..." value={form.comment}
            onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
            rows={3} required className={`${inputCls} resize-none`} />
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold disabled:opacity-50 transition-all">
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className={`text-sm text-center py-6 ${textSub}`}>No reviews yet. Be the first to review!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className={`pb-4 border-b last:border-0 ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${dark ? 'bg-white/[0.08] text-charcoal-300' : 'bg-gray-100 text-gray-600'}`}>
                    {(r.reviewer_name || 'A')[0].toUpperCase()}
                  </div>
                  <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {r.reviewer_name || 'Anonymous'}
                  </span>
                  {r.verified_purchase && (
                    <span className="text-[9px] text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded-full">Verified</span>
                  )}
                </div>
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={11}
                      className={s <= r.rating ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'} />
                  ))}
                </div>
              </div>
              {r.comment && <p className={`text-xs mt-1.5 leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{r.comment}</p>}
              <p className={`text-[10px] mt-1.5 ${textSub}`}>
                {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
