import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Zap, ChevronRight, MessageSquare, Search } from 'lucide-react';
import { matchCreators, loadAllCreatorsForMatching, parseBudgetRange } from '../utils/matchingAlgorithm.js';
import { SERVICES, normalizeServiceId } from '../data/rates.js';
import { REGIONS } from '../data/regions.js';
import { TierBadge } from '../components/TierBadge.jsx';
import { VerificationBadge } from '../components/VerificationFlow.jsx';
import { LoyaltyBadge } from '../components/LoyaltyBadge.jsx';

function loadProject(projectId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
    return all.find(p => p.id === projectId) || null;
  } catch { return null; }
}

function MatchPct({ pct, dark }) {
  const color = pct >= 75 ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-600';
  return (
    <div className={`flex flex-col items-center rounded-2xl border px-3 py-2 ${
      dark ? 'bg-gold-500/10 border-gold-500/20' : 'bg-gold-50 border-gold-200'
    }`}>
      <span className={`font-display text-2xl font-bold leading-none ${color}`}>{pct}%</span>
      <span className={`mt-1 text-[9px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>match</span>
    </div>
  );
}

function MatchCard({ match, dark, onViewProfile, onRequestQuote }) {
  const { creator, matchPct, rateRange } = match;
  const location = creator.location || {};
  const locationStr = [location.city, location.state].filter(Boolean).join(', ');
  const region = REGIONS[location.regionKey];
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg ${
      dark ? 'bg-charcoal-900/74 border-white/[0.07] hover:border-gold-500/35 shadow-[0_24px_80px_rgba(0,0,0,0.22)]' : 'bg-white border-gray-200 hover:border-gold-300'
    }`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/45 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${dark ? 'bg-white/[0.04] ring-1 ring-white/[0.07] group-hover:ring-gold-500/20' : 'bg-gray-100'}`}>
            {creator.avatar || '🎬'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`font-display font-bold text-lg leading-tight truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {creator.businessName || creator.name}
                </h3>
                {creator.businessName && creator.name && (
                  <p className={`text-xs truncate ${textSub}`}>{creator.name}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={`text-xs flex items-center gap-1 ${textSub}`}>
                    <MapPin size={10} />{locationStr}{region && ` ${region.flag}`}
                  </span>
                </div>
              </div>
              <MatchPct pct={matchPct} dark={dark} />
            </div>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {creator.verification_status && creator.verification_status !== 'unverified' && (
            <VerificationBadge status={creator.verification_status} />
          )}
          {creator.tier && creator.tier !== 'launch' && (
            <TierBadge tierId={creator.tier} />
          )}
          {creator.completed_projects > 0 && (
            <LoyaltyBadge completedProjects={creator.completed_projects} />
          )}
        </div>

        {/* Rating */}
        {creator.rating && (
          <div className="flex items-center gap-1.5 mt-3">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={12}
                  className={s <= Math.round(creator.rating) ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'} />
              ))}
            </div>
            <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{creator.rating}</span>
            <span className={`text-xs ${textSub}`}>({creator.reviewCount || creator.review_count || 0})</span>
          </div>
        )}

        {/* Rate range */}
        {rateRange && (
          <div className={`mt-4 pt-4 border-t ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
            <p className={`text-xs ${textSub}`}>
              Rate range:{' '}
              <span className="font-bold text-gold-400">
                ${rateRange.min.toLocaleString()} – ${rateRange.max.toLocaleString()}
              </span>
            </p>
          </div>
        )}

        {/* Tags */}
        {creator.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {creator.tags.slice(0, 4).map(tag => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={`flex gap-2 p-4 pt-0`}>
        <button type="button" onClick={() => onViewProfile(creator.id)}
          className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
            dark ? 'border-white/[0.09] text-charcoal-200 hover:text-white hover:border-gold-500/35' : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}>
          View Profile
        </button>
        <button type="button" onClick={() => onRequestQuote(creator)}
          className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
          <MessageSquare size={12} /> Request Quote
        </button>
      </div>
    </div>
  );
}

export function MatchResultsPage({ dark }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  useEffect(() => {
    const proj = loadProject(projectId);
    setProject(proj);

    if (proj) {
      const creators = loadAllCreatorsForMatching();
      const serviceId = normalizeServiceId(proj.serviceId || proj.service || proj.serviceType);
      const parsedBudget = parseBudgetRange(proj.budgetRange);
      const brief = {
        serviceId,
        service: proj.service,
        serviceType: proj.serviceType,
        budgetRange: proj.budgetRange,
        budgetMin: proj.budgetMin ?? proj.budget_min ?? parsedBudget.budgetMin,
        budgetMax: proj.budgetMax ?? proj.budget_max ?? parsedBudget.budgetMax,
        location: proj.location,
        city: proj.city,
        state: proj.state,
        country: proj.country || 'US',
        locationPreference: proj.locationPreference || proj.location_preference || (proj.remote ? 'remote' : 'either'),
        remote: proj.remote,
        projectDate: proj.projectDate || proj.project_date || proj.deadline || proj.timeline,
        timeline: proj.timeline,
        description: proj.description,
      };
      const results = matchCreators(creators, brief);
      setMatches(results);
    }
    setLoading(false);
  }, [projectId]);

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
        <div className="relative w-16 h-16">
          <div className="animate-spin w-16 h-16 border-2 border-gold-500/20 border-t-gold-500 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={20} className="text-gold-500" />
          </div>
        </div>
        <p className={`text-sm font-medium ${textSub}`}>Finding your best matches...</p>
      </div>
    );
  }

  const normalizedServiceId = normalizeServiceId(project?.serviceId || project?.service || project?.serviceType);
  const serviceLabel = normalizedServiceId
    ? (SERVICES[normalizedServiceId]?.name || normalizedServiceId)
    : 'your project';

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Back */}
        <button type="button" onClick={() => navigate('/projects')}
          className={`flex items-center gap-2 text-sm mb-6 transition-colors ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <ArrowLeft size={15} /> Back to projects
        </button>

        {/* Header */}
        <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 mb-8 ${
          dark ? 'bg-charcoal-900/72 border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <div className="grid gap-6 md:grid-cols-[1fr_0.42fr] md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-500/15 text-gold-400 text-xs font-bold mb-5 border border-gold-500/20">
                <Zap size={12} /> Smart Match
              </div>
              <h1 className={`font-display text-4xl md:text-5xl font-bold mb-4 leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                We found your best creator matches.
              </h1>
              <p className={`text-sm md:text-base leading-7 max-w-2xl ${textSub}`}>
                Based on your project needs, budget, and timeline, curated for {serviceLabel}.
              </p>
              {project?.title && (
                <p className={`text-xs mt-4 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                  Project: <span className={dark ? 'text-white' : 'text-gray-900'}>{project.title}</span>
                </p>
              )}
            </div>
            <div className={`rounded-2xl border p-5 ${dark ? 'bg-white/[0.035] border-white/[0.07]' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                Match Set
              </p>
              <p className={`font-display text-4xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {matches.length}
              </p>
              <p className={`text-xs mt-1 ${textSub}`}>
                vetted creator{matches.length === 1 ? '' : 's'} ranked for this brief
              </p>
            </div>
          </div>
        </div>

        {/* Match cards */}
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {matches.map((match, i) => (
              <div key={match.creator.id} className="relative">
                {i === 0 && (
                  <div className="absolute -top-2.5 left-4 z-10 px-2.5 py-0.5 rounded-full bg-gold-500 text-charcoal-900 text-[10px] font-bold">
                    Best Match
                  </div>
                )}
                <MatchCard
                  match={match}
                  dark={dark}
                  onViewProfile={id => navigate(`/creator/${id}`)}
                  onRequestQuote={creator => navigate(`/creator/${creator.id}`)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-16 rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200'}`}>
            <Search size={34} className={`mx-auto mb-3 ${dark ? 'text-gold-400' : 'text-gold-600'}`} />
            <p className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>No exact matches found</p>
            <p className={`text-sm ${textSub} mb-4`}>Try expanding your budget or choosing "remote" for location.</p>
            <Link to="/find" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-500 text-charcoal-900 text-sm font-bold">
              Browse all creators <ChevronRight size={14} />
            </Link>
          </div>
        )}

        {/* Browse all link */}
        {matches.length > 0 && (
          <div className="text-center">
            <Link to="/find"
              className={`inline-flex items-center gap-1 text-sm transition-colors ${dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
              Browse all creators <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
