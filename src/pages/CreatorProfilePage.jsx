import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Globe, Mail, Phone, Instagram, Heart, Share2, Check, ExternalLink, MessageSquare, FileText, BadgeCheck, X, Search } from 'lucide-react';
import { SEO } from '../components/SEO.jsx';
import { VerificationBadge } from '../components/VerificationFlow.jsx';
import { LoyaltyBadge } from '../components/LoyaltyBadge.jsx';
import { TierBadge } from '../components/TierBadge.jsx';
import { SERVICES, RATES } from '../data/rates.js';
import { getPillar, getSubNiche, LEGACY_SERVICE_TO_PILLAR } from '../data/taxonomy.js';
import { REGIONS } from '../data/regions.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { RequestQuoteModal } from '../components/RequestQuoteModal.jsx';
import { ReviewsSection } from '../components/ReviewsSection.jsx';
import { AvailabilityMini, AvailabilityEditor } from '../components/AvailabilityCalendar.jsx';
import { SimilarCreators } from '../components/SimilarCreators.jsx';
import { getStorageDisplayUrl, normalizeExternalUrl } from '../utils/storage.js';

function loadAllListings() {
  try { return JSON.parse(localStorage.getItem('creator-directory') || '[]'); } catch { return []; }
}

function isApprovedCreator(creator) {
  return !!(
    creator?.verified ||
    creator?.verification_status === 'verified' ||
    creator?.verification_status === 'pro_verified' ||
    creator?.id?.startsWith?.('seed-')
  );
}

function recordGuestProfileView(profileId) {
  try {
    const key = 'cb-guest-profile-views';
    const views = JSON.parse(localStorage.getItem(key) || '[]');
    const next = Array.from(new Set([...views, profileId])).slice(-3);
    localStorage.setItem(key, JSON.stringify(next));
    return views.includes(profileId) || views.length < 3;
  } catch {
    return true;
  }
}

/** Returns true if `clientId` has a paid retainer (or completed project) with `creatorId`. */
async function hasActiveBooking(clientId, creatorId) {
  if (!clientId || !creatorId) return false;
  try {
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('transactions')
        .select('id')
        .eq('client_id', clientId)
        .eq('creator_id', creatorId)
        .or('retainer_status.in.(paid,released),final_status.in.(paid,released)')
        .limit(1);
      if (data?.length > 0) return true;
    }
    // localStorage fallback
    const txns = JSON.parse(localStorage.getItem('cm-transactions') || '[]');
    return txns.some(t =>
      t.clientId === clientId &&
      t.creatorId === creatorId &&
      (
        ['paid', 'released'].includes(t.retainerStatus || t.retainer_status) ||
        ['paid', 'released'].includes(t.finalStatus || t.final_status) ||
        ['retainer', 'final'].includes(t.paymentType)
      )
    );
  } catch { return false; }
}

/** Converts share URLs to embed URLs for YouTube, Vimeo, and Loom. */
function toEmbedUrl(url) {
  if (!url) return null;
  if (url.includes('/embed/')) return url;
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Loom: loom.com/share/ID
  const loomMatch = url.match(/loom\.com\/share\/([A-Za-z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  return url;
}

function normalizeMediaUrl(url = '') {
  return normalizeExternalUrl(url);
}

export function CreatorProfilePage({ dark }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [creator, setCreator]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [isFav, setIsFav]               = useState(false);
  const [showQuote, setShowQuote]       = useState(false);
  const [copied, setCopied]             = useState(false);
  const [activeNiche, setActiveNiche] = useState(0);
  const [quoteDate, setQuoteDate]       = useState('');
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [showContactGate, setShowContactGate] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [resolvedCoverImage, setResolvedCoverImage] = useState('');
  const [resolvedPortfolio, setResolvedPortfolio] = useState([]);

  const isOwnProfile = user && creator && creator.user_id === user.id;

  useEffect(() => {
    loadCreator();
    checkFavorite();
  }, [id]);

  useEffect(() => {
    let active = true;

    async function resolveProfileMedia() {
      if (!creator) {
        setResolvedCoverImage('');
        setResolvedPortfolio([]);
        return;
      }

      const coverSource = creator.cover_image_url || creator.coverImageUrl || creator.banner_url || creator.bannerUrl || '';
      const nextCover = await getStorageDisplayUrl(coverSource);
      const nextPortfolio = await Promise.all((creator.portfolio || []).map(async (item) => {
        const rawImage = item.image_url || item.imageUrl || '';
        const rawLink = item.link || item.url || '';
        const [displayImageUrl, displayLink] = await Promise.all([
          getStorageDisplayUrl(rawImage),
          getStorageDisplayUrl(rawLink),
        ]);

        return {
          ...item,
          displayImageUrl,
          displayLink: displayLink || normalizeExternalUrl(rawLink),
        };
      }));

      if (!active) return;
      setResolvedCoverImage(nextCover || normalizeExternalUrl(coverSource));
      setResolvedPortfolio(nextPortfolio);
    }

    resolveProfileMedia();
    return () => { active = false; };
  }, [creator]);

  async function loadCreator() {
    setLoading(true);
    // Seed creators (id starts with "seed-") only exist in localStorage -
    // never query Supabase for them even when Supabase is configured.
    const isSeed = id.startsWith('seed-');
    if (supabaseConfigured && !isSeed) {
      const { data } = await supabase
        .from('creator_listings')
        .select(`*, creator_services(*), portfolio_items(*), packages(*), reviews(*)`)
        .eq('id', id)
        .single();
      if (data) {
        // Prefer the 3-pillar model on public profiles. Legacy creator_services
        // rows can still exist, but they must not render as multiple primary
        // lanes now that each creator owns one pillar and 1-3 specialties.
        const legacyFromCreatorServices = data.creator_services?.map(s => ({ ...s, serviceId: s.service_id, rates: s.rates || {} })) || [];
        const PILLAR_TO_LEGACY = { video_production: 'video', photography: 'photography', post_production: 'postProduction' };
        const pillar = getPillar(data.primary_pillar);
        const synthesizedFromPillar = data.primary_pillar
          ? [{
              serviceId: PILLAR_TO_LEGACY[data.primary_pillar] || 'video',
              service_id: PILLAR_TO_LEGACY[data.primary_pillar] || 'video',
              pillarId: data.primary_pillar,
              displayName: pillar?.name || 'Primary Pillar',
              rates: {},
              subtypes: (data.sub_niches || []).map(id => getSubNiche(id)?.label || id),
            }]
          : [];
        const services = synthesizedFromPillar.length > 0 ? synthesizedFromPillar : legacyFromCreatorServices;

        // Normalize to same shape as localStorage format
        const normalized = {
          ...data,
          location: { city: data.city, state: data.state, country: data.country, zip: data.zip, regionKey: data.region_key },
          contact: { email: data.email, phone: data.phone, website: data.website, instagram: data.instagram },
          primary_pillar: data.primary_pillar,
          sub_niches: data.sub_niches || [],
          services,
          portfolio: data.portfolio_items || [],
          tags: data.tags || [],
        };
        setCreator(normalized);
        if (!user && !recordGuestProfileView(normalized.id)) {
          setGuestLimitReached(true);
        }
        // Increment view count
        supabase.from('creator_listings').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
        // Check booking status
        if (user) {
          hasActiveBooking(user.id, id).then(setContactUnlocked);
        }
      }
    } else {
      // Seed creators or no Supabase - always use localStorage
      const all = loadAllListings();
      const found = all.find(c => c.id === id);
      setCreator(found || null);
      if (!user && found && !recordGuestProfileView(found.id)) {
        setGuestLimitReached(true);
      }
      if (user && found) {
        hasActiveBooking(user.id, id).then(setContactUnlocked);
      }
    }
    setLoading(false);
  }

  async function checkFavorite() {
    if (!user || !supabaseConfigured || id.startsWith('seed-')) {
      const favs = JSON.parse(localStorage.getItem('creator-favorites') || '[]');
      setIsFav(favs.includes(id));
      return;
    }
    const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('listing_id', id).single();
    setIsFav(!!data);
  }

  async function toggleFavorite() {
    if (supabaseConfigured && user && !id.startsWith('seed-')) {
      if (isFav) {
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', id);
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, listing_id: id });
      }
    } else {
      const favs = JSON.parse(localStorage.getItem('creator-favorites') || '[]');
      const updated = isFav ? favs.filter(f => f !== id) : [...favs, id];
      localStorage.setItem('creator-favorites', JSON.stringify(updated));
    }
    setIsFav(f => !f);
  }

  function hasActiveProject() {
    try {
      const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
      return all.some(p => p.clientId === user?.id && p.status === 'open');
    } catch { return false; }
  }

  function handleQuoteClick() {
    // Always open the direct quote form when on a creator's profile page.
    // IntentGate/SmartMatch is only for homepage/directory, never from a profile page.
    if (!user) {
      setShowContactGate(true);
      return;
    }
    if (!isOwnProfile) {
      setShowQuote(true);
    }
  }

  function openClientAuth(tab = 'signup') {
    setShowContactGate(false);
    window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab, role: 'client' } }));
  }

  function handleMessageClick() {
    if (!user) {
      setShowContactGate(true);
      return;
    }
    navigate(`/messages?with=${creator.user_id || creator.id}`);
  }

  function handleLockedContactClick() {
    setShowContactGate(true);
  }

  function shareProfile() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
        <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-5 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`w-full max-w-md rounded-2xl border p-8 text-center ${dark ? 'bg-charcoal-900/76 border-white/[0.08]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-gold-50 text-gold-600'}`}>
            <Search size={20} />
          </div>
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
            Profile unavailable
          </p>
          <h2 className="font-display text-xl font-bold mb-2">Creator not found</h2>
          <p className={`text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            This creator may be under review, hidden, or no longer listed.
          </p>
        <button type="button" onClick={() => navigate('/find')}
          className="mt-5 px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">
          Back to Directory
        </button>
        </div>
      </div>
    );
  }

  if (!isApprovedCreator(creator) && !isOwnProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-5 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`w-full max-w-md rounded-2xl border p-8 text-center ${dark ? 'bg-charcoal-900/76 border-white/[0.08]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-gold-50 text-gold-600'}`}>
            <Search size={20} />
          </div>
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
            Profile under review
          </p>
          <h2 className="font-display text-xl font-bold mb-2">This creator is not public yet</h2>
          <p className={`text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            CreatorBridge profiles are hidden until manual review is complete.
          </p>
          <button type="button" onClick={() => navigate('/find')}
            className="mt-5 px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  if (guestLimitReached && !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-5 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`w-full max-w-md rounded-2xl border p-8 text-center ${dark ? 'bg-charcoal-900/76 border-white/[0.08]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-gold-50 text-gold-600'}`}>
            <Search size={20} />
          </div>
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
            Guest preview complete
          </p>
          <h2 className="font-display text-xl font-bold mb-2">Create a free account to keep browsing.</h2>
          <p className={`text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            Guests can preview up to 3 creator profiles. Accounts unlock full browsing, saved creators, quotes, and project requests.
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => openClientAuth('signup')}
              className="rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-charcoal-900 hover:bg-gold-600 transition-colors">
              Create Account
            </button>
            <button type="button" onClick={() => openClientAuth('login')}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${dark ? 'border-gold-500/25 text-charcoal-200 hover:text-white hover:border-gold-500/45' : 'border-gray-200 text-gray-700 hover:text-gray-900'}`}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const location = creator.location || {};
  const contact  = creator.contact || {};
  const services = creator.services || [];
  const portfolio = creator.portfolio || [];
  const locationStr = [location.city, location.state, location.country].filter(Boolean).join(', ');

  function getServiceDisplayName(serviceId, service = null) {
    if (service?.displayName) return service.displayName;
    const names = {
      video:            'Video Production',
      video_production: 'Video Production',
      photography:      'Photography',
      drone:            'Video Production',
      drone_aerial:     'Video Production',
      podcast:          'Post Production',
      social:           'Video Production',
      social_media:     'Video Production',
      post:             'Post Production',
      post_production:  'Post Production',
      events:           'Video Production',
      live_events:      'Video Production',
    };
    return names[serviceId] || serviceId || 'Services';
  }
  const region = REGIONS[location.regionKey];
  const expLabel = { entry: '2-3 yrs', mid: '4-6 yrs', senior: '7+ yrs' }[creator.experience] || '';
  const creatorVisuals = {
    video: '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png',
    video_production: '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png',
    photography: '/images/creatorbridge/handoff/photo-1542038784456-1ea8e935640e.png',
    postProduction: '/images/creatorbridge/handoff/photo-1574717024653-61fd2cf4d44d.png',
    post_production: '/images/creatorbridge/handoff/photo-1574717024653-61fd2cf4d44d.png',
  };
  const primaryPillar = getPillar(creator.primary_pillar);
  const primaryServiceId = services[0]?.serviceId || services[0]?.service_id || 'video';
  const legacyPrimary = LEGACY_SERVICE_TO_PILLAR[primaryServiceId] || LEGACY_SERVICE_TO_PILLAR.video;
  const displayedPrimaryPillar = primaryPillar || getPillar(legacyPrimary?.pillar || 'video_production');
  const displayedSubNicheIds = (creator.sub_niches?.length ? creator.sub_niches : [legacyPrimary?.sub_niche]).filter(Boolean).slice(0, 3);
  const displayedSpecialties = displayedSubNicheIds.map(id => getSubNiche(id)).filter(Boolean);
  const displayedService = {
    ...(services[0] || {}),
    serviceId: primaryServiceId,
    service_id: primaryServiceId,
    pillarId: displayedPrimaryPillar?.id || legacyPrimary?.pillar || 'video_production',
    displayName: displayedPrimaryPillar?.name || getServiceDisplayName(primaryServiceId, services[0]),
    description: `${displayedPrimaryPillar?.name || 'Production'} specialist focused on ${displayedSpecialties.map(s => s.label).join(', ') || 'verified client work'}.`,
    subtypes: displayedSpecialties.map(s => s.label),
  };
  const visibleServices = displayedPrimaryPillar ? [displayedService] : [];
  const avatarUrl = normalizeExternalUrl(creator.avatar || creator.avatar_url || creator.logo_url || '');
  const customCoverImage = normalizeMediaUrl(
    creator.cover || creator.cover_image_url || creator.coverImageUrl || creator.banner_url || creator.bannerUrl
  );
  const profileVisual = resolvedCoverImage || customCoverImage || creatorVisuals[displayedPrimaryPillar?.id] || creatorVisuals[primaryServiceId] || creatorVisuals.video_production;
  const introEmbedUrl = toEmbedUrl(creator.video_intro_url);

  const textSub = dark ? 'text-charcoal-400' : 'text-gray-500';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200 shadow-sm'}`;

  // ── SEO + JSON-LD for this creator profile ──────────────────────────────
  const creatorPageUrl = `https://www.creatorbridge.studio/creator/${id}`;
  const creatorNameForMeta = creator?.businessName || creator?.business_name || creator?.display_name || creator?.name || 'Creator';
  const creatorLocationForMeta = locationStr || [creator?.city, creator?.state].filter(Boolean).join(', ');
  const creatorTitle   = creator
    ? `${creatorNameForMeta} — ${creator.tier || 'Creator'} on CreatorBridge`
    : 'Creator Profile | CreatorBridge';
  const creatorDesc    = creator
    ? `${creatorNameForMeta}${creatorLocationForMeta ? ` (${creatorLocationForMeta})` : ''} is a verified media creator on CreatorBridge. ${creator.bio ? creator.bio.slice(0, 140) : ''}`
    : 'View this verified creator profile on CreatorBridge.';
  const creatorJsonLd  = creator ? {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: creatorNameForMeta,
    url: creatorPageUrl,
    description: creator.bio || '',
    address: creatorLocationForMeta ? { '@type': 'PostalAddress', addressLocality: creatorLocationForMeta } : undefined,
    worksFor: { '@type': 'Organization', name: 'CreatorBridge', url: 'https://www.creatorbridge.studio' },
  } : null;

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      {creator && (
        <SEO
          title={creatorTitle}
          description={creatorDesc}
          url={creatorPageUrl}
          jsonLd={creatorJsonLd}
        />
      )}
      {/* Back button */}
      <div className="mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12 pt-5">
        <button type="button" onClick={() => navigate(-1)}
          className={`flex items-center gap-2 text-sm font-bold transition-colors ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <ArrowLeft size={16} /> Back to directory
        </button>
      </div>

      <div className="mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Profile header */}
          <div className={`${cardCls} relative overflow-hidden p-6 sm:p-8`} style={{ boxShadow: dark ? '0 28px 90px rgba(0,0,0,0.24)' : '0 22px 70px rgba(0,0,0,0.08)' }}>
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(212,169,65,0.85), transparent)' }}
            />
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-gold-500/10 blur-3xl" />
            <div className="relative grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="group relative aspect-[16/10] overflow-hidden rounded-[1.35rem] border border-gold-500/18 bg-charcoal-950/70 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:aspect-video xl:aspect-[9/16]">
                {introEmbedUrl ? (
                  <iframe
                    src={introEmbedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full bg-black"
                    title={`${creator.businessName || creator.name} intro video`}
                  />
                ) : (
                  <>
                    <img src={profileVisual} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl" />
                    <img src={profileVisual} alt="" className="absolute inset-0 h-full w-full object-contain p-2 opacity-90 transition-transform duration-700 group-hover:scale-[1.01]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />
                  </>
                )}
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-4 ${introEmbedUrl ? 'bg-gradient-to-t from-black/82 via-black/20 to-transparent' : ''}`}>
                  <p className="mb-2 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.6px', textTransform: 'uppercase' }}>
                    {introEmbedUrl ? 'Required creator intro' : 'Intro video fallback'}
                  </p>
                  <h2 className="font-display text-xl font-bold text-white">
                    {introEmbedUrl ? 'Meet the creator before booking.' : 'Creator intro video slot.'}
                  </h2>
                  {!introEmbedUrl && (
                    <p className="mt-2 text-xs leading-5 text-charcoal-200">
                      Once approved, this area should show the required 60 to 90 second intro video.
                    </p>
                  )}
                </div>
              </div>
              <div className="min-w-0">
            <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
              <div className="relative shrink-0">
                <div
                  className={`w-24 h-24 rounded-[1.35rem] border flex items-center justify-center text-5xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] ${dark ? 'bg-white/[0.04] border-gold-500/22' : 'bg-gray-100 border-gray-200'}`}
                  title="Creator logo or profile mark"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full rounded-[1.35rem] object-cover" />
                  ) : (
                    creator.avatar || '🎬'
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                      Verified production specialist
                    </p>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="primary-pillar-badge">
                        <span className="dot" />
                        <span className="label">Primary pillar</span>
                        <span className="value">{displayedPrimaryPillar?.name || 'Production'}</span>
                      </span>
                      {creator.availability === 'available' && (
                        <span className="inline-flex items-center rounded-full border border-green-400/18 bg-green-400/8 px-2.5 py-1 text-[11px] font-semibold text-green-300">
                          Available now
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className={`font-display font-bold text-3xl sm:text-4xl tracking-tight ${dark ? 'text-white' : 'text-gray-950'}`}>
                        {creator.businessName || creator.name}
                      </h1>
                      {creator.verification_status && creator.verification_status !== 'unverified' ? (
                        <VerificationBadge status={creator.verification_status} />
                      ) : creator.verified ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 text-[10px] font-bold ring-1 ring-gold-500/20">
                          <BadgeCheck size={11} /> Verified
                        </span>
                      ) : null}
                      {creator.tier && <TierBadge tierId={creator.tier} />}
                      {creator.completed_projects > 0 && (
                        <LoyaltyBadge completedProjects={creator.completed_projects} />
                      )}
                    </div>
                    {creator.businessName && creator.name && (
                      <p className={`text-sm ${textSub}`}>{creator.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`text-sm flex items-center gap-1 ${textSub}`}>
                        <MapPin size={13} /> {locationStr}
                        {region && <span className="ml-1">{region.flag}</span>}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
                        {expLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button type="button" onClick={toggleFavorite}
                      className={`p-2 rounded-xl border transition-all ${
                        isFav
                          ? 'border-gold-500/45 bg-gold-500/10 text-gold-400'
                          : dark ? 'border-charcoal-600 text-charcoal-400 hover:text-gold-400' : 'border-gray-200 text-gray-400 hover:text-gold-500'
                      }`} title={isFav ? 'Remove from favorites' : 'Save to favorites'}>
                      <Heart size={16} className={isFav ? 'fill-current' : ''} />
                    </button>
                    <button type="button" onClick={shareProfile}
                      className={`p-2 rounded-xl border transition-all ${dark ? 'border-charcoal-600 text-charcoal-400 hover:text-white' : 'border-gray-200 text-gray-400 hover:text-gray-900'}`}
                      title="Copy profile link">
                      {copied ? <Check size={16} className="text-gold-400" /> : <Share2 size={16} />}
                    </button>
                  </div>
                </div>

                {/* Rating */}
                {creator.rating && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={14}
                          className={s <= Math.round(creator.rating) ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'} />
                      ))}
                    </div>
                    <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{creator.rating}</span>
                    <span className={`text-sm ${textSub}`}>({creator.reviewCount || creator.review_count || 0} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            <p className={`relative mt-6 max-w-4xl text-base leading-8 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{creator.bio}</p>

            <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Primary pillar', value: displayedPrimaryPillar?.name || 'Production' },
                { label: 'Work samples', value: portfolio.length || 0 },
                { label: 'Experience', value: expLabel || 'Reviewed' },
                { label: 'Payment path', value: 'Protected' },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-2xl border px-4 py-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`text-[10px] uppercase tracking-widest ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>{label}</p>
                  <p className={`mt-1 text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Tags */}
            {displayedSpecialties.length > 0 && (
              <div className={`relative mt-5 border-t pt-4 ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                  Production Focus
                </p>
                <div className="flex flex-wrap gap-2">
                  {displayedSpecialties.map(specialty => (
                    <span key={specialty.id} className="specialty-chip-profile">
                      {specialty.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Services and Packages */}
          {visibleServices.length > 0 && (
            <div className={`${cardCls} p-5 sm:p-6`}>
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="mb-3 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                    Service offers
                  </p>
                  <h2 className={`font-display text-2xl font-semibold leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {displayedPrimaryPillar?.name || 'Production'} — {displayedSpecialties.length || 1} specialt{(displayedSpecialties.length || 1) === 1 ? 'y' : 'ies'}.
                  </h2>
                </div>
                <p className={`max-w-sm text-xs leading-5 ${textSub}`}>
                  One primary pillar per creator. Clients review focused specialties before opening a quote.
                </p>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                {(displayedSpecialties.length ? displayedSpecialties : [{ id: displayedPrimaryPillar?.id || 'pillar', label: displayedPrimaryPillar?.name || 'Production' }]).map((specialty, i) => (
                  <div key={specialty.id || specialty.label} className="service-offer-card">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-display text-sm text-gold-400">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-charcoal-500">{displayedPrimaryPillar?.name || 'Production'}</span>
                    </div>
                    <h3 className={`mb-2 font-display text-lg font-semibold leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {specialty.label}
                    </h3>
                    <p className={`text-xs leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                      Focused client work inside {displayedPrimaryPillar?.name || 'the creator’s pillar'}, scoped through CreatorBridge before payment moves.
                    </p>
                  </div>
                ))}
              </div>

              {/* Package cards for active niche only */}
              {(() => {
                const svcList = visibleServices;
                const activeSvc = svcList[activeNiche];
                if (!activeSvc) return null;

                const sid = activeSvc.serviceId || activeSvc.service_id;
                const serviceDef = SERVICES[sid] || {};

                // Try structured packages first
                const activePillarId = activeSvc.pillarId || creator.primary_pillar || LEGACY_SERVICE_TO_PILLAR[sid]?.pillar;
                const pkgs = (creator.packages || []).filter(p => {
                  const packageServiceId = p.serviceId || p.service_id;
                  if (!activePillarId) return packageServiceId === sid;
                  return LEGACY_SERVICE_TO_PILLAR[packageServiceId]?.pillar === activePillarId;
                });

                if (pkgs.length > 0) {
                  return (
                    <div className="grid gap-3 lg:grid-cols-3">
                      {(serviceDef.description || activeSvc.description || activeSvc.subtypes?.length > 0) && (
                        <div className={`rounded-2xl border p-4 lg:col-span-3 ${dark ? 'border-gold-500/18 bg-gold-500/[0.055]' : 'border-gold-200 bg-gold-50'}`}>
                          <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Selected specialties
                          </p>
                          <p className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
                            {activeSvc.description || serviceDef.description}
                          </p>
                          {activeSvc.subtypes?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {activeSvc.subtypes.slice(0, 8).map(subtype => (
                                <span key={subtype} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${dark ? 'bg-charcoal-950/65 text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}>
                                  {subtype}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {pkgs.map((pkg, pi) => {
                        const isStandard = pkg.tier === 'standard'
                          || pkg.name?.toLowerCase().includes('standard')
                          || pi === 1;
                        return (
                          <div key={pi} className={`rounded-2xl border p-4
                            ${isStandard
                              ? 'border-gold-500/38 '
                                + (dark
                                  ? 'bg-gold-500/10'
                                  : 'border-gray-200 bg-gold-50')
                              : dark
                                ? 'border-white/[0.07] bg-white/[0.025]'
                                : 'border-gray-200 bg-gray-50'
                            }`}>
                            {isStandard && (
                              <p className="text-[10px] font-bold text-gold-400
                                uppercase tracking-wider mb-1">
                                Most Popular
                              </p>
                            )}
                            <p className={`text-[10px] font-bold uppercase
                              tracking-wider mb-1
                              ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                              {pkg.tier || pkg.name || `Package ${pi + 1}`}
                            </p>
                            <p className="font-display text-2xl font-bold
                              text-gold-400 mb-1">
                              ${Number(pkg.price || 0).toLocaleString()}
                            </p>
                            <p className={`text-xs mb-3
                              ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                              {(pkg.deliveryDays || pkg.turnaroundDays || pkg.turnaround_days) && `${pkg.deliveryDays || pkg.turnaroundDays || pkg.turnaround_days} day delivery`}
                              {pkg.revisions && `${(pkg.deliveryDays || pkg.turnaroundDays || pkg.turnaround_days) ? ' · ' : ''}${pkg.revisions} revision${
                                pkg.revisions !== 1 ? 's' : ''} included`}
                            </p>
                            {(pkg.features || pkg.deliverables || []).length > 0 && (
                              <ul className="space-y-1.5 mb-4">
                                {(pkg.features || pkg.deliverables || []).slice(0, 3)
                                  .map((f, fi) => (
                                  <li key={fi} className={`flex items-start
                                    gap-2 text-xs
                                    ${dark
                                      ? 'text-charcoal-300'
                                      : 'text-gray-600'}`}>
                                    <span className="text-gold-400 mt-0.5
                                      shrink-0">
                                      <Check size={13} />
                                    </span>
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(pkg.features || pkg.deliverables || []).length > 3 && (
                              <p className={`mb-4 text-[11px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                                +{(pkg.features || pkg.deliverables || []).length - 3} more included
                              </p>
                            )}
                            {pkg.description && (
                              <p className={`text-xs italic mb-4
                                ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                                {pkg.description}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={handleQuoteClick}
                              className="w-full py-2.5 rounded-xl bg-gold-500
                                hover:bg-gold-600 text-charcoal-900 text-xs
                                font-bold transition-all">
                              Get This Package
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Fallback: build Basic/Standard/Premium from rates
                const rates = Object.entries(activeSvc.rates || {});
                if (rates.length === 0) return (
                  <div className={`rounded-2xl border p-5 text-sm ${dark
                    ? 'border-white/[0.07] bg-charcoal-950/45 text-charcoal-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    Pricing is reviewed through a custom quote for this pillar.
                  </div>
                );

                const sorted = rates.sort(([,a],[,b]) => Number(a) - Number(b));
                const third = Math.ceil(sorted.length / 3);
                const tiers = [
                  {
                    name: 'Basic',
                    rates: sorted.slice(0, third),
                    isStandard: false,
                  },
                  {
                    name: 'Standard',
                    rates: sorted.slice(third, third * 2),
                    isStandard: true,
                  },
                  {
                    name: 'Premium',
                    rates: sorted.slice(third * 2),
                    isStandard: false,
                  },
                ].filter(t => t.rates.length > 0);

                return (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {tiers.map((tier) => {
                      const minPrice = Math.min(
                        ...tier.rates.map(([,v]) => Number(v))
                      );
                      return (
                        <div key={tier.name}
                          className={`rounded-2xl border p-4
                          ${tier.isStandard
                            ? 'border-gold-500/38 '
                              + (dark
                                ? 'bg-gold-500/10'
                                : 'border-gray-200 bg-gold-50')
                            : dark
                              ? 'border-white/[0.07] bg-white/[0.025]'
                              : 'border-gray-200 bg-gray-50'
                          }`}>
                          {tier.isStandard && (
                            <p className="text-[10px] font-bold text-gold-400
                              uppercase tracking-wider mb-1">
                              Most Popular
                            </p>
                          )}
                          <p className={`text-[10px] font-bold uppercase
                            tracking-wider mb-1
                            ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                            {tier.name}
                          </p>
                          <p className="font-display text-2xl font-bold
                            text-gold-400 mb-3">
                            from ${minPrice.toLocaleString()}
                          </p>
                          <ul className="space-y-1.5 mb-4">
                            {tier.rates.slice(0, 4).map(([key, val]) => {
                              const meta = RATES[sid]?.[key];
                              return (
                                <li key={key}
                                  className={`flex items-center justify-between
                                  gap-4 text-xs
                                  ${dark
                                    ? 'text-charcoal-300'
                                    : 'text-gray-600'}`}>
                                  <span className="flex items-center gap-1.5">
                                    <Check size={13} className="text-gold-400 shrink-0" />
                                    {meta?.label || key}
                                    {meta?.unit && (
                                      <span className={dark
                                        ? 'text-charcoal-500'
                                        : 'text-gray-400'}>
                                        / {meta.unit}
                                      </span>
                                    )}
                                  </span>
                                  <span className={`font-semibold shrink-0
                                    ${dark ? 'text-white' : 'text-gray-900'}`}>
                                    ${Number(val).toLocaleString()}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {tier.rates.length > 4 && (
                            <p className={`mb-4 text-[11px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                              +{tier.rates.length - 4} more rate options
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={handleQuoteClick}
                            className="w-full py-2.5 rounded-xl bg-gold-500
                              hover:bg-gold-600 text-charcoal-900 text-xs
                              font-bold transition-all">
                            Get This Package
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <div className={`${cardCls} p-5 sm:p-6`}>
              <h2 className={`font-display font-bold text-xl mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Proof of Work</h2>
              <p className={`text-sm mb-5 ${textSub}`}>Selected samples clients can review before opening a project.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(resolvedPortfolio.length ? resolvedPortfolio : portfolio).map((item, i) => {
                  const def = SERVICES[item.serviceId || item.service_id];
                  const previewImage = item.displayImageUrl || normalizeExternalUrl(item.image_url || item.imageUrl || '');
                  const projectLink = item.displayLink || normalizeExternalUrl(item.link || item.url || '');
                  return (
                    <div key={i} className={`overflow-hidden rounded-2xl border ${dark ? 'border-white/[0.07] bg-charcoal-950/42' : 'border-gray-200 bg-gray-50'}`}>
                      {previewImage && (
                        <div className="relative aspect-video overflow-hidden bg-charcoal-950/70">
                          <img src={previewImage} alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        </div>
                      )}
                      <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${dark ? 'bg-gold-500/10 ring-1 ring-gold-500/18' : 'bg-white ring-1 ring-gray-200'}`}>{def?.icon || '🎬'}</span>
                        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                      </div>
                      {def?.name && (
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold-400">{def.name}</p>
                      )}
                      <p className={`text-xs ${textSub}`}>{item.description}</p>
                      {projectLink && (
                        <a href={projectLink} target="_blank" rel="noreferrer"
                          className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors`}>
                          <ExternalLink size={10} /> View project
                        </a>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reviews */}
          <ReviewsSection creator={creator} dark={dark} />

          {/* Similar Creators */}
          <SimilarCreators creator={creator} dark={dark} />
        </div>

        {/* ── RIGHT COLUMN (sticky) ── */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-20 space-y-4">

            {/* CTA card */}
            <div className={`${cardCls} relative overflow-hidden p-5`}>
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(212,169,65,0.8), transparent)' }}
              />
              <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
                Start a project
              </p>
              <button type="button" onClick={handleQuoteClick}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2 mb-2 shadow-[0_16px_38px_rgba(212,169,65,0.16)]">
                <FileText size={15} /> {quoteDate ? `Book for ${new Date(quoteDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Request a Quote'}
              </button>
              {!isOwnProfile && (
                <button type="button"
                  onClick={handleMessageClick}
                  className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 mb-3 ${
                    dark ? 'border-gold-500/20 text-charcoal-300 hover:border-gold-500/40 hover:text-white hover:bg-white/[0.035]' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900'
                  }`}>
                  <MessageSquare size={15} /> Message
                </button>
              )}
              <div className={`rounded-2xl border px-3 py-2 ${dark ? 'border-white/[0.06] bg-white/[0.025]' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-center text-[10px] ${textSub}`}>Free to request. No payment until you hire.</p>
                <p className={`text-center text-[10px] mt-1 ${textSub}`}>Confirm insurance directly when a project requires coverage.</p>
              </div>

              {/* Contact links */}
              <div className={`mt-4 border-t pt-4 space-y-2 ${dark ? 'border-charcoal-700' : 'border-gray-200'}`}>
                {/* Email: only visible after booking */}
                {contact.email && (isOwnProfile || contactUnlocked) ? (
                  <a href={`mailto:${contact.email}`}
                    className={`flex items-center gap-2 text-xs transition-colors ${dark ? 'text-charcoal-400 hover:text-gold-400' : 'text-gray-500 hover:text-gold-500'}`}>
                    <Mail size={13} /> {contact.email}
                  </a>
                ) : contact.email ? (
                  <button type="button" onClick={handleLockedContactClick}
                    className={`flex items-center gap-2 text-xs italic text-left ${dark ? 'text-charcoal-500 hover:text-gold-400' : 'text-gray-400 hover:text-gold-600'}`}>
                    <Mail size={13} /> {user ? 'Book through CreatorBridge to contact' : 'Sign in to contact'}
                  </button>
                ) : null}

                {/* Phone: only visible after booking */}
                {contact.phone && (isOwnProfile || contactUnlocked) ? (
                  <a href={`tel:${contact.phone}`}
                    className={`flex items-center gap-2 text-xs transition-colors ${dark ? 'text-charcoal-400 hover:text-gold-400' : 'text-gray-500 hover:text-gold-500'}`}>
                    <Phone size={13} /> {contact.phone}
                  </a>
                ) : contact.phone ? (
                  <button type="button" onClick={handleLockedContactClick}
                    className={`flex items-center gap-2 text-xs italic text-left ${dark ? 'text-charcoal-500 hover:text-gold-400' : 'text-gray-400 hover:text-gold-600'}`}>
                    <Phone size={13} /> {user ? 'Available after booking' : 'Sign in to contact'}
                  </button>
                ) : null}

                {/* Website: only visible after booking or own profile */}
                {contact.website && (isOwnProfile || contactUnlocked) ? (
                  <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                    target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-xs transition-colors ${dark ? 'text-charcoal-400 hover:text-gold-400' : 'text-gray-500 hover:text-gold-500'}`}>
                    <Globe size={13} /> {contact.website}
                  </a>
                ) : contact.website ? (
                  <button type="button" onClick={handleLockedContactClick}
                    className={`flex items-center gap-2 text-xs italic text-left ${dark ? 'text-charcoal-500 hover:text-gold-400' : 'text-gray-400 hover:text-gold-600'}`}>
                    <Globe size={13} /> {user ? 'Available after booking' : 'Sign in to contact'}
                  </button>
                ) : null}
                {/* Instagram: only visible after booking or own profile */}
                {contact.instagram && (isOwnProfile || contactUnlocked) ? (
                  <a href={`https://instagram.com/${contact.instagram.replace('@','')}`}
                    target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-xs transition-colors ${dark ? 'text-charcoal-400 hover:text-gold-400' : 'text-gray-500 hover:text-gold-500'}`}>
                    <Instagram size={13} /> {contact.instagram}
                  </a>
                ) : contact.instagram ? (
                  <button type="button" onClick={handleLockedContactClick}
                    className={`flex items-center gap-2 text-xs italic text-left ${dark ? 'text-charcoal-500 hover:text-gold-400' : 'text-gray-400 hover:text-gold-600'}`}>
                    <Instagram size={13} /> {user ? 'Available after booking' : 'Sign in to contact'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Availability calendar */}
            {isOwnProfile ? (
              <AvailabilityEditor creatorId={creator.id} dark={dark} />
            ) : (
              <AvailabilityMini
                creatorId={creator.id}
                dark={dark}
                selectedDate={quoteDate}
                onSelectDate={(d) => { setQuoteDate(d); setShowQuote(true); }}
              />
            )}

            {/* Quick stats */}
            <div className={`${cardCls} p-5`}>
              <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>Quick Stats</p>
              <div className="space-y-2">
                {[
                  { label: 'Experience', value: expLabel },
                  { label: 'Location', value: locationStr },
                  { label: 'Pillar', value: displayedPrimaryPillar?.name || 'Production' },
                  { label: 'Portfolio', value: `${portfolio.length} project${portfolio.length !== 1 ? 's' : ''}` },
                  ...(creator.view_count ? [{ label: 'Profile Views', value: creator.view_count.toLocaleString() }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className={`flex items-center justify-between rounded-2xl px-3 py-2 ${dark ? 'bg-white/[0.025]' : 'bg-gray-50'}`}>
                    <span className={`text-xs ${textSub}`}>{label}</span>
                    <span className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Quote modal */}
      {showQuote && <RequestQuoteModal creator={creator} dark={dark} initialDate={quoteDate} onClose={() => setShowQuote(false)} />}

      {showContactGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="cb-modal-backdrop" onClick={() => setShowContactGate(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${dark ? 'bg-charcoal-950/95 border-gold-500/20' : 'bg-white border-gray-200'}`}>
            <button type="button" onClick={() => setShowContactGate(false)}
              className={`absolute right-4 top-4 p-1.5 rounded-lg transition-colors ${dark ? 'text-charcoal-400 hover:text-white hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
              <X size={16} />
            </button>
            <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
              Creator contact is protected
            </p>
            <h3 className={`font-display text-2xl font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
              {user ? 'Book through CreatorBridge to unlock direct contact.' : 'Create a free client account to contact creators.'}
            </h3>
            <p className={`text-sm leading-6 mb-5 ${textSub}`}>
              {user
                ? 'Direct contact details unlock after a paid retainer or completed booking path. Until then, keep communication and quote requests inside CreatorBridge.'
                : 'Guests can review creator work, services, and availability. Messaging, quote requests, and direct contact details stay inside CreatorBridge until an account and booking path are in place.'}
            </p>
            {user ? (
              <button type="button" onClick={handleQuoteClick}
                className="w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-charcoal-900 hover:bg-gold-600 transition-colors">
                Request a Quote
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => openClientAuth('signup')}
                  className="rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-charcoal-900 hover:bg-gold-600 transition-colors">
                  Create Free Account
                </button>
                <button type="button" onClick={() => openClientAuth('login')}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${dark ? 'border-gold-500/25 text-charcoal-200 hover:text-white hover:border-gold-500/45' : 'border-gray-200 text-gray-700 hover:text-gray-900'}`}>
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
