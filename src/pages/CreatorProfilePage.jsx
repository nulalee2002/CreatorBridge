import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Globe, Mail, Phone, Instagram, Heart, Share2, Check, ExternalLink, MessageSquare, FileText, BadgeCheck, X, Search } from 'lucide-react';
import { VerificationBadge } from '../components/VerificationFlow.jsx';
import { LoyaltyBadge } from '../components/LoyaltyBadge.jsx';
import { TierBadge } from '../components/TierBadge.jsx';
import { SERVICES, RATES } from '../data/rates.js';
import { REGIONS } from '../data/regions.js';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { RequestQuoteModal } from '../components/RequestQuoteModal.jsx';
import { ReviewsSection } from '../components/ReviewsSection.jsx';
import { AvailabilityMini, AvailabilityEditor } from '../components/AvailabilityCalendar.jsx';
import { SimilarCreators } from '../components/SimilarCreators.jsx';

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
  const [showVideoModal, setShowVideoModal]   = useState(false);
  const [showContactGate, setShowContactGate] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  const isOwnProfile = user && creator && creator.user_id === user.id;

  useEffect(() => {
    loadCreator();
    checkFavorite();
  }, [id]);

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
        // Normalize to same shape as localStorage format
        const normalized = {
          ...data,
          location: { city: data.city, state: data.state, country: data.country, zip: data.zip, regionKey: data.region_key },
          contact: { email: data.email, phone: data.phone, website: data.website, instagram: data.instagram },
          services: data.creator_services?.map(s => ({ ...s, serviceId: s.service_id, rates: s.rates || {} })) || [],
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
        <button type="button" onClick={() => navigate('/')}
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
          <button type="button" onClick={() => navigate('/')}
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

  function getServiceDisplayName(serviceId) {
    const names = {
      video:            'Video Production',
      video_production: 'Video Production',
      photography:      'Photography',
      drone:            'Drone / Aerial',
      drone_aerial:     'Drone / Aerial',
      podcast:          'Podcast Production',
      social:           'Brand & Short-Form Content',
      social_media:     'Brand & Short-Form Content',
      post:             'Editing & Post',
      post_production:  'Editing & Post',
      events:           'Live Event Coverage',
      live_events:      'Live Event Coverage',
    };
    return names[serviceId] || serviceId || 'Services';
  }
  const region = REGIONS[location.regionKey];
  const expLabel = { entry: '2-3 yrs', mid: '4-6 yrs', senior: '7+ yrs' }[creator.experience] || '';

  const textSub = dark ? 'text-charcoal-400' : 'text-gray-500';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200 shadow-sm'}`;

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
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
            <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
              <div className="relative shrink-0">
                <div
                  className={`w-24 h-24 rounded-[1.35rem] border flex items-center justify-center text-5xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] ${dark ? 'bg-white/[0.04] border-gold-500/22' : 'bg-gray-100 border-gray-200'} ${creator.video_intro_url ? 'cursor-pointer' : ''}`}
                  onClick={() => creator.video_intro_url && setShowVideoModal(true)}
                >
                  {creator.avatar || '🎬'}
                </div>
                {creator.video_intro_url && (
                  <button
                    type="button"
                    onClick={() => setShowVideoModal(true)}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gold-500 hover:bg-gold-600 flex items-center justify-center shadow-lg transition-colors"
                    title="Watch intro video"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-charcoal-900 ml-0.5">
                      <polygon points="2,1 9,5 2,9" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                      Verified production specialist
                    </p>
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
                      {creator.availability === 'available' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 font-medium ring-1 ring-gold-500/15">
                          Available Now
                        </span>
                      )}
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
                { label: 'Service types', value: services.length || 0 },
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
            {creator.tags?.length > 0 && (
              <div className="relative flex flex-wrap gap-2 mt-5">
                {creator.tags.map(tag => (
                  <span key={tag} className={`text-xs px-3 py-1 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-600'}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Video intro */}
          {creator.video_intro_url && (
            <div className={`${cardCls} p-5 sm:p-6`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🎬</span>
              <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Video Introduction</h2>
              </div>
              <div className="rounded-2xl overflow-hidden aspect-video bg-black ring-1 ring-gold-500/18">
                <iframe
                  src={creator.video_intro_url}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                  title={`${creator.businessName || creator.name} intro video`}
                />
              </div>
            </div>
          )}

          {/* Services and Packages */}
          {(creator.services || []).length > 0 && (
            <div className={`${cardCls} p-5 sm:p-6`}>
              <h2 className={`font-display font-bold text-xl mb-1
                ${dark ? 'text-white' : 'text-gray-900'}`}>
                Service Offers
              </h2>
              <p className={`text-sm mb-5 ${textSub}`}>Review the creator's strongest service lanes, pricing structure, and included deliverables before requesting a quote.</p>

              {/* Niche tab buttons - service names only */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(creator.services || []).slice(0, 3).map((svc, i) => {
                  const sid = svc.serviceId || svc.service_id || '';
                  const name = getServiceDisplayName(sid);
                  const isActive = activeNiche === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveNiche(i)}
                      className={`px-4 py-2 rounded-full text-xs font-bold uppercase
                        tracking-widest transition-all border
                        ${isActive
                          ? 'border-gold-500/55 bg-gold-500/12 text-gold-400 shadow-[0_0_24px_rgba(212,169,65,0.1)]'
                          : `
                            ${dark
                              ? 'border-white/[0.07] text-charcoal-300 hover:text-white hover:border-gold-500/24'
                              : 'border-gray-200 text-gray-500 hover:text-gray-900'
                            }`
                        }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Package cards for active niche only */}
              {(() => {
                const svcList = (creator.services || []).slice(0, 3);
                const activeSvc = svcList[activeNiche];
                if (!activeSvc) return null;

                const sid = activeSvc.serviceId || activeSvc.service_id;
                const serviceDef = SERVICES[sid] || {};

                // Try structured packages first
                const pkgs = (creator.packages || []).filter(
                  p => (p.serviceId || p.service_id) === sid
                );

                if (pkgs.length > 0) {
                  return (
                    <div className="space-y-4">
                      {(serviceDef.description || activeSvc.description || activeSvc.subtypes?.length > 0) && (
                        <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/18 bg-gold-500/[0.055]' : 'border-gold-200 bg-gold-50'}`}>
                          <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Active service lane
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
                          <div key={pi} className={`rounded-2xl border p-5
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
                              {pkg.deliveryDays && `${pkg.deliveryDays} day delivery`}
                              {pkg.revisions && ` · ${pkg.revisions} revision${
                                pkg.revisions !== 1 ? 's' : ''} included`}
                            </p>
                            {(pkg.features || pkg.deliverables || []).length > 0 && (
                              <ul className="space-y-1.5 mb-4">
                                {(pkg.features || pkg.deliverables || [])
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
                    Pricing is reviewed through a custom quote for this service lane.
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
                  <div className="space-y-4">
                    {tiers.map((tier) => {
                      const minPrice = Math.min(
                        ...tier.rates.map(([,v]) => Number(v))
                      );
                      return (
                        <div key={tier.name}
                          className={`rounded-2xl border p-5
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
                            {tier.rates.map(([key, val]) => {
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
                {portfolio.map((item, i) => {
                  const def = SERVICES[item.serviceId || item.service_id];
                  return (
                    <div key={i} className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-charcoal-950/42' : 'border-gray-200 bg-gray-50'}`}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title}
                          className="w-full h-36 object-cover rounded-2xl mb-3" />
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${dark ? 'bg-gold-500/10 ring-1 ring-gold-500/18' : 'bg-white ring-1 ring-gray-200'}`}>{def?.icon || '🎬'}</span>
                        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                      </div>
                      {def?.name && (
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold-400">{def.name}</p>
                      )}
                      <p className={`text-xs ${textSub}`}>{item.description}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer"
                          className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors`}>
                          <ExternalLink size={10} /> View project
                        </a>
                      )}
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
                  { label: 'Services', value: `${services.length} service type${services.length !== 1 ? 's' : ''}` },
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowContactGate(false)} />
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

      {/* Video intro modal */}
      {showVideoModal && creator.video_intro_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowVideoModal(false)} />
          <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${dark ? 'bg-charcoal-900 border-charcoal-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-charcoal-700' : 'border-gray-200'}`}>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                Meet {creator.businessName || creator.name} - 1 to 2 minute intro
              </p>
              <button type="button" onClick={() => setShowVideoModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-charcoal-400 hover:text-white hover:bg-charcoal-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
                </svg>
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={toEmbedUrl(creator.video_intro_url)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                title={`Meet ${creator.businessName || creator.name}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
