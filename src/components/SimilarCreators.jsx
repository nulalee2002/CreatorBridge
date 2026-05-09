import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Star, ArrowRight } from 'lucide-react';
import { SERVICES } from '../data/rates.js';
import { REGIONS } from '../data/regions.js';

function loadListings() {
  try { return JSON.parse(localStorage.getItem('creator-directory') || '[]'); } catch { return []; }
}

export function SimilarCreators({ creator, dark }) {
  const navigate = useNavigate();

  const similar = useMemo(() => {
    if (!creator) return [];
    const all = loadListings();
    const creatorServiceIds = new Set((creator.services || []).map(s => s.serviceId));
    const creatorRegion = creator.location?.regionKey || creator.regionKey;

    return all
      .filter(c => {
        if (c.id === creator.id) return false;
        // Must share at least one service type
        const cServices = new Set((c.services || []).map(s => s.serviceId));
        const sharedServices = [...creatorServiceIds].some(id => cServices.has(id));
        return sharedServices;
      })
      .map(c => {
        let score = 0;
        // Same region = higher score
        const cRegion = c.location?.regionKey || c.regionKey;
        if (cRegion === creatorRegion) score += 3;
        else if (REGIONS[cRegion]?.group === REGIONS[creatorRegion]?.group) score += 1;
        // Higher rating = higher score
        if (c.rating) score += c.rating;
        return { ...c, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);
  }, [creator]);

  if (similar.length === 0) return null;

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <h2 className={`font-display font-bold text-base mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Similar Creators
      </h2>
      <div className="space-y-3">
        {similar.map(c => {
          const location = c.location || {};
          const locationStr = [location.city, location.state, location.country].filter(Boolean).join(', ') || c.city || c.zip;
          const services = c.services || [];
          const primaryService = SERVICES[services[0]?.serviceId];

          return (
            <div key={c.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                dark ? 'border-white/[0.08] bg-charcoal-950/45 hover:border-gold-500/35' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
              onClick={() => navigate(`/creator/${c.id}`)}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${dark ? 'bg-white/[0.08]' : 'bg-gray-200'}`}>
                {c.avatar || primaryService?.icon || '🎬'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {c.businessName || c.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {locationStr && (
                    <span className={`text-[11px] flex items-center gap-1 ${textSub}`}>
                      <MapPin size={9} /> {locationStr}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-white/[0.08] text-charcoal-300' : 'bg-gray-200 text-gray-500'}`}>
                    {services.map(s => SERVICES[s.serviceId]?.icon).filter(Boolean).join(' ')}
                  </span>
                </div>
              </div>

              {/* Rating + arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {c.rating && (
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-gold-400 fill-gold-400" />
                    <span className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{c.rating}</span>
                  </div>
                )}
                <ArrowRight size={13} className={textSub} />
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => navigate('/')}
        className={`mt-3 w-full py-2 rounded-xl border text-xs font-semibold transition-all ${
          dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'
        }`}>
        Browse all creators
      </button>
    </div>
  );
}
