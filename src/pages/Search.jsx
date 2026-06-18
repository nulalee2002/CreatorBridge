import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, MapPin, ExternalLink, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { SEO } from '../components/SEO.jsx';
import { getPillar, getSubNiche } from '../data/taxonomy.js';
import { CreatorAvatar } from '../components/CreatorAvatar.jsx';

const TIER_COLOURS = {
  Launch:    'bg-charcoal-800/60 text-charcoal-300  border-white/[0.08]',
  Proven:    'bg-gold-500/10    text-gold-400       border-gold-500/20',
  Elite:     'bg-gold-500/20    text-gold-300       border-gold-500/30',
  Signature: 'bg-gold-500/30    text-gold-200       border-gold-500/40',
};

function TierChip({ tier }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_COLOURS[tier] ?? TIER_COLOURS.Launch}`}>
      {tier ?? 'Launch'}
    </span>
  );
}

function CreatorCard({ creator, dark, onView }) {
  const cardBg = dark
    ? 'bg-charcoal-900/70 border-white/[0.07] hover:border-gold-500/25'
    : 'bg-white border-gray-200 hover:border-gold-400/50';

  const displayName = creator.name || creator.display_name || 'CreatorBridge Creator';
  const avatarUrl = creator.avatar || creator.avatar_url;
  const location = creator.location || [creator.city, creator.state].filter(Boolean).join(', ');
  const pillar = getPillar(creator.primary_pillar);
  const specialties = Array.isArray(creator.sub_niches)
    ? creator.sub_niches.map(id => getSubNiche(id)?.label || id).slice(0, 3)
    : Array.isArray(creator.specialties)
      ? creator.specialties.slice(0, 3)
      : [];

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors cursor-pointer ${cardBg}`}
      onClick={() => onView(creator.id)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/[0.08]">
              <CreatorAvatar src={avatarUrl} alt={displayName} fallback={displayName?.charAt(0) ?? '?'} />
            </div>
          ) : (
            <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${dark ? 'bg-charcoal-800 text-gold-400' : 'bg-gray-100 text-gray-600'}`}>
              {displayName?.charAt(0) ?? '?'}
            </div>
          )}
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {displayName}
            </p>
            {location && (
              <p className={`flex items-center gap-1 text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
                <MapPin size={10} />
                {location}
              </p>
            )}
          </div>
        </div>
        <TierChip tier={creator.tier} />
      </div>

      {pillar && (
        <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-gold-400' : 'text-gold-600'}`}>
          {pillar.name}
        </p>
      )}

      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {specialties.map(s => (
            <span
              key={s}
              className={`rounded-md border px-2 py-0.5 text-[10px] ${dark ? 'bg-white/[0.03] border-white/[0.07] text-charcoal-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {creator.bio && (
        <p className={`text-xs leading-relaxed mb-4 line-clamp-2 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
          {creator.bio}
        </p>
      )}

      <button
        type="button"
        onClick={e => { e.stopPropagation(); onView(creator.id); }}
        className="flex items-center gap-1.5 text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors"
      >
        <ExternalLink size={12} />
        View Profile
      </button>
    </article>
  );
}

export function Search({ dark }) {
  const navigate        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query,   setQuery]   = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Run search when query from URL on initial load
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) runSearch(q);
  }, []); // eslint-disable-line

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(val.trim() ? { q: val.trim() } : {}, { replace: true });
      runSearch(val.trim());
    }, 300);
  }

  async function runSearch(q) {
    if (!q) { setResults([]); setSearched(false); return; }

    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase.rpc('search_creators', { query: q });

    setLoading(false);
    if (error) {
      console.error('search_creators error:', error);
      setResults([]);
    } else {
      setResults(data ?? []);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    const q = query.trim();
    setSearchParams(q ? { q } : {}, { replace: true });
    runSearch(q);
  }

  const inputCls = `w-full bg-transparent py-3 px-4 text-sm focus:outline-none
    ${dark ? 'text-white placeholder-charcoal-500' : 'text-gray-900 placeholder-gray-400'}`;

  const containerBg = dark
    ? 'border-white/[0.08] bg-white/[0.02] focus-within:border-gold-500/40 focus-within:bg-white/[0.04]'
    : 'border-gray-200 bg-white focus-within:border-gold-400/60 shadow-sm';

  return (
    <>
      <SEO
        title="Search Creators"
        description="Search verified US creators by Video Production, Photography, Post Production, specialty, location, or keyword on CreatorBridge."
        url="https://www.creatorbridge.studio/search"
      />

      <main className={`min-h-screen px-5 sm:px-8 lg:px-12 py-10 ${dark ? '' : 'bg-gray-50'}`}>
        <div className="mx-auto max-w-3xl">

          {/* Heading */}
          <div className="mb-8">
            <p className={`text-[10px] font-bold tracking-[0.22em] uppercase mb-2 ${dark ? 'text-gold-500/70' : 'text-gold-600'}`}>
              Creator Search
            </p>
            <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              Find the right creator
            </h1>
            <p className={`mt-1.5 text-sm ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
              Search by name, pillar, specialty, location, or keyword.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className={`flex rounded-2xl border transition-all ${containerBg}`}>
              <div className={`flex items-center px-4 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                {loading
                  ? <Loader size={18} className="animate-spin text-gold-400" />
                  : <SearchIcon size={18} />
                }
              </div>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={handleChange}
                placeholder="Video Production, Product & Still Life, Phoenix..."
                aria-label="Search creators"
                className={inputCls}
              />
              <button
                type="submit"
                className="m-1.5 rounded-xl bg-gold-500 px-5 py-2 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600"
              >
                Search
              </button>
            </div>
          </form>

          {/* Results */}
          {!searched && (
            <p className={`text-center text-sm ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
              Start typing to search across verified creators.
            </p>
          )}

          {searched && !loading && results.length === 0 && (
            <div className={`rounded-2xl border py-14 text-center ${dark ? 'border-white/[0.07] bg-charcoal-900/40' : 'border-gray-200 bg-white'}`}>
              <SearchIcon size={28} className={`mx-auto mb-3 ${dark ? 'text-charcoal-600' : 'text-gray-300'}`} />
              <p className={`font-bold text-sm mb-1 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
                No creators found for "{query}"
              </p>
              <p className={`text-xs ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                Try a different keyword, location, or specialty.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <p className={`text-xs mb-4 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                {results.length} creator{results.length !== 1 ? 's' : ''} matched
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map(c => (
                  <CreatorCard
                    key={c.id}
                    creator={c}
                    dark={dark}
                    onView={id => navigate(`/creator/${id}`)}
                  />
                ))}
              </div>
            </>
          )}

        </div>
      </main>
    </>
  );
}
