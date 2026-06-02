import { useState, useMemo, useEffect, useRef } from 'react';
import { getNewCreatorSpotlight } from '../utils/matchingAlgorithm.js';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, X, Plus, Trash2, ArrowRight, Filter, UserPlus, Heart, ExternalLink, BadgeCheck, AlertCircle } from 'lucide-react';
import { SERVICES, RATES, MARKETPLACE_CATEGORIES, getMarketplaceServiceIds, serviceMatchesMarketplaceCategory } from '../data/rates.js';
import { PILLARS, SUB_NICHES_BY_PILLAR, getPillar, getSubNiche, LEGACY_SERVICE_TO_PILLAR, MAX_SUB_NICHES } from '../data/taxonomy.js';
import { REGIONS } from '../data/regions.js';
import { SEED_CREATORS, initSeedData, SHOW_DEMO_CREATORS } from '../data/seedCreators.js';
import { zipToRegion, zipToCity } from '../data/zipCodes.js';
import { VerificationBadge } from './VerificationFlow.jsx';
import { LoyaltyBadge } from './LoyaltyBadge.jsx';
import { TierBadge } from './TierBadge.jsx';
import { FastMatch } from './FastMatch.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { uploadUserAsset } from '../utils/storage.js';
import { sendNotificationEmail } from '../lib/notifications.js';
import { HandoffPage } from './HandoffPage.jsx';
import { handoffPages } from '../data/handoffPages.js';

// Initialize seed data (version-gated — replaces stale seeds automatically)
initSeedData();

function parseYearsExperience(value) {
  if (value === '2 years') return 2;
  if (value === '3 to 5 years') return 3;
  if (value === '5 to 10 years') return 5;
  if (value === '10+ years') return 10;
  return 0;
}

function portfolioItemComplete(item) {
  return !!(
    item?.title?.trim() &&
    item?.description?.trim() &&
    (item?.subNicheId || item?.serviceId) &&
    item?.link?.trim()
  );
}

function isApprovedCreator(creator) {
  return !!(
    creator?.verified ||
    creator?.verification_status === 'verified' ||
    creator?.verification_status === 'pro_verified' ||
    creator?.id?.startsWith?.('seed-')
  );
}

// ── LocalStorage helpers ──────────────────────────────────────
function loadListings() {
  try { return JSON.parse(localStorage.getItem('creator-directory') || '[]'); } catch { return []; }
}
function saveListings(list) {
  localStorage.setItem('creator-directory', JSON.stringify(list));
}

function getRotatingPreviewCreators(allCreators) {
  const today = new Date().toISOString().split('T')[0];
  const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);

  const verified = allCreators.filter(c =>
    c.verified ||
    c.verification_status === 'verified' ||
    c.verification_status === 'pro_verified' ||
    c.id?.startsWith('seed-')
  );

  const byNiche = {};
  verified.forEach(c => {
    const niche = c.services?.[0]?.serviceId || c.services?.[0]?.service_id || 'video';
    if (!byNiche[niche]) byNiche[niche] = [];
    byNiche[niche].push(c);
  });

  const niches = Object.keys(byNiche);
  if (niches.length === 0) return verified.slice(0, 3);

  const startIndex = seed % niches.length;
  const todayNiches = [
    niches[startIndex % niches.length],
    niches[(startIndex + 1) % niches.length],
    niches[(startIndex + 2) % niches.length],
  ].filter(Boolean);

  return todayNiches.map(niche => {
    const group = byNiche[niche] || [];
    return group[seed % Math.max(group.length, 1)];
  }).filter(Boolean).slice(0, 3);
}

// ── Creator Card Helpers ─────────────────────────────────────
function getCreatorCoverImage(creator) {
  if (creator.cover) return creator.cover;
  const portfolioImage = (creator.portfolio || []).find(item => item.imageUrl || item.image_url);
  if (portfolioImage) return portfolioImage.imageUrl || portfolioImage.image_url;
  const subNiche = creator.sub_niches?.[0];
  if (subNiche) {
    if (subNiche.startsWith('ph_')) return '/images/creatorbridge/handoff/photo-1542038784456-1ea8e935640e.png';
    if (subNiche.startsWith('pp_')) return '/images/creatorbridge/handoff/photo-1574717024653-61fd2cf4d44d.png';
    return '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png';
  }
  const serviceId = creator.services?.[0]?.serviceId || creator.services?.[0]?.service_id || '';
  switch(serviceId) {
    case 'video':
      return '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png';
    case 'photography':
      return '/images/creatorbridge/handoff/photo-1542038784456-1ea8e935640e.png';
    case 'drone':
      return '/images/creatorbridge/handoff/photo-1506947411487-a56738267384.png';
    case 'podcast':
      return '/images/creatorbridge/handoff/photo-1590602847861-f357a9332bbc.png';
    case 'postProduction':
    case 'editor':
    case 'social':
      return '/images/creatorbridge/handoff/photo-1574717024653-61fd2cf4d44d.png';
    default:
      return '/images/creatorbridge/handoff/photo-1492691527719-9d1e07e534b4.png';
  }
}

function getLowestRate(creator) {
  let min = Infinity;
  const services = creator.services || [];
  services.forEach(svc => {
    const rates = svc.rates || {};
    Object.values(rates).forEach(rateVal => {
      const val = parseFloat(rateVal);
      if (!isNaN(val) && val > 0 && val < min) {
        min = val;
      }
    });
  });
  return min === Infinity ? null : min;
}

// ── Creator Profile Card ─────────────────────────────────────
function CreatorCard({ creator, dark, onDelete, onViewProfile }) {
  const navigate = useNavigate();

  const [isFav, setIsFav] = useState(() => {
    const favs = JSON.parse(localStorage.getItem('creator-favorites') || '[]');
    return favs.includes(creator.id);
  });
  function toggleFav(e) {
    e.stopPropagation();
    const favs = JSON.parse(localStorage.getItem('creator-favorites') || '[]');
    const updated = isFav ? favs.filter(f => f !== creator.id) : [...favs, creator.id];
    localStorage.setItem('creator-favorites', JSON.stringify(updated));
    setIsFav(f => !f);
  }

  const location = creator.location || {};
  const expLabel = { entry: '2-3 yrs', mid: '4-6 yrs', senior: '7+ yrs' }[creator.experience] || '';
  const locationStr = [location.city, location.state].filter(Boolean).join(', ');

  const coverImage = getCreatorCoverImage(creator);
  const lowestRate = getLowestRate(creator);
  const legacyServiceId = creator.services?.[0]?.serviceId || creator.services?.[0]?.service_id;
  const displayedPillar = getPillar(creator.primary_pillar)
    || getPillar(LEGACY_SERVICE_TO_PILLAR[legacyServiceId]?.pillar)
    || getPillar('video_production');
  const specialtyTags = creator.sub_niches?.length
    ? creator.sub_niches.map(id => getSubNiche(id)?.label).filter(Boolean)
    : (creator.tags || []);

  const handleCardClick = onViewProfile ?? (() => navigate(`/creator/${creator.id}`));

  return (
    <div 
      className="creator-card" 
      onClick={handleCardClick}
    >
      <div className="cover">
        <img src={coverImage} alt={creator.businessName || creator.name} loading="lazy" onError={(e)=>{ if(!e.currentTarget.dataset.fb){ e.currentTarget.dataset.fb='1'; e.currentTarget.src='/images/creatorbridge/backgrounds/09-fallback/fallback-default-cover.jpg'; } }} />

        {displayedPillar && (
          <span className="pillar-label">
            <span className="dot" />
            {displayedPillar.name}
          </span>
        )}
        
        {/* Tier Badges + Availability Overlay */}
        <div className="tier-chips">
          {creator.availability === 'available' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-semibold tracking-wider uppercase shadow-sm">
              Available
            </span>
          )}
          {creator.tier && creator.tier !== 'launch' && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/90 text-white font-semibold tracking-wider uppercase shadow-sm">
              {creator.tier}
            </span>
          )}
        </div>

        {/* Overlapping Avatar */}
        <div className="avatar">
          {creator.avatar?.startsWith('http') || (creator.avatar && creator.avatar.includes('/')) ? (
            <img src={creator.avatar} alt={creator.name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-charcoal-800 text-xl border-none">
              {creator.avatar || '🎬'}
            </div>
          )}
        </div>
      </div>

      <div className="body">
        {/* Title & Favorite Row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <h3 className={`font-display font-bold text-base leading-tight truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
              {creator.businessName || creator.name}
            </h3>
            {creator.businessName && creator.name && (
              <p className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'} truncate`}>{creator.name}</p>
            )}
          </div>
          <button 
            type="button" 
            onClick={toggleFav}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${isFav ? 'text-red-400' : dark ? 'text-charcoal-600 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`}
            title={isFav ? 'Remove from favorites' : 'Save to favorites'}
          >
            <Heart size={14} className={isFav ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Sub-header badges (Verification, Location, Experience) */}
        <div className="flex flex-wrap items-center gap-2 mb-3 mt-1">
          {creator.verification_status && creator.verification_status !== 'unverified' ? (
            <VerificationBadge status={creator.verification_status} />
          ) : creator.verified ? (
            <BadgeCheck size={13} className="text-gold-400 shrink-0" title="Verified creator" />
          ) : null}
          
          {locationStr && (
            <span className={`text-[11px] flex items-center gap-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
              <MapPin size={10} /> {locationStr}
            </span>
          )}
          {expLabel && (
            <span className={`text-[10px] px-1.5 py-0.25 rounded-full font-medium ${dark ? 'bg-charcoal-800 text-charcoal-400' : 'bg-gray-100 text-gray-500'}`}>
              {expLabel}
            </span>
          )}
        </div>

        {/* Bio (capped to 2 lines) */}
        <p className={`text-xs leading-relaxed line-clamp-2 mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          {creator.bio}
        </p>

        {/* Tags */}
        {specialtyTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4 mt-auto">
            {specialtyTags.slice(0, 3).map(tag => (
              <span key={tag} className="specialty-pill">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: Ratings + Price */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-auto">
          <div className="flex items-center gap-1">
            {creator.rating ? (
              <>
                <Star size={12} className="text-gold-400 fill-gold-400" />
                <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{creator.rating}</span>
                {creator.reviewCount && (
                  <span className={`text-[9px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>({creator.reviewCount})</span>
                )}
              </>
            ) : (
              <span className={`text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>New Creator</span>
            )}
          </div>
          
          <div className="text-right">
            {lowestRate ? (
              <span className={`text-xs font-bold ${dark ? 'text-gold-400' : 'text-gold-600'}`}>
                FROM <span className="text-sm font-extrabold">${lowestRate}</span>
              </span>
            ) : (
              <span className={`text-[10px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Rates on request</span>
            )}
          </div>
        </div>

        {/* Delete button (for admin/developer added listings) */}
        {onDelete && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onDelete(creator.id); }}
            className="mt-3 text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors justify-center w-full border border-red-500/10 hover:border-red-500/20 py-1 rounded-md bg-red-500/5"
          >
            <Trash2 size={10} /> Remove listing
          </button>
        )}
      </div>
    </div>
  );
}

// ── Register Form ────────────────────────────────────────────
function RegisterForm({ onSave, dark, onCancel, user }) {
  const navigate = useNavigate();

  // Check if user already has a profile
  const existingProfile = useMemo(() => {
    if (!user?.id) return null;
    const all = loadListings();
    return all.find(c => c.user_id === user.id) || null;
  }, [user?.id]);

  const [serviceLimit, setServiceLimit] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCreatorAgreementModal, setShowCreatorAgreementModal] = useState(false);
  const [form, setForm] = useState({
    name: '', businessName: '', bio: '', experience: 'mid',
    avatar: '', tags: '',
    location: { city: '', state: '', country: 'US', zip: '' },
    primary_pillar: '',
    sub_niches: [],
    portfolio: [],
    contact: { email: '', phone: '', website: '', instagram: '' },
    rating: '', reviewCount: '',
    yearsExperience: '',
    usBasedConfirm: false,
    ageConfirm: false,
    videoIntroUrl: '',
    insuranceAck: false,
    lockConfirm: false,
    reviewNoticeConfirm: false,
    tosAccepted: false,
    creatorAgreementAccepted: false,
    aiOriginalWorkConfirm: false,
    aiToolsDisclosure: [],
  });
  const [step, setStep] = useState(1);
  const [portfolioUploadState, setPortfolioUploadState] = useState({});

  const TOTAL_STEPS = 5;
  const BLOCKED_EXPERIENCE = ['Less than 1 year', '1 year'];

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setLocation = (field, val) => setForm(f => ({ ...f, location: { ...f.location, [field]: val } }));
  const setContact = (field, val) => setForm(f => ({ ...f, contact: { ...f.contact, [field]: val } }));

  const setPillar = (pillarId) => {
    // Selecting a new pillar resets sub-niches (they're scoped to a pillar)
    setForm(f => ({ ...f, primary_pillar: pillarId, sub_niches: [] }));
  };
  const toggleSubNiche = (subNicheId) => {
    setForm(f => {
      const has = f.sub_niches.includes(subNicheId);
      if (has) {
        return { ...f, sub_niches: f.sub_niches.filter(id => id !== subNicheId) };
      }
      if (f.sub_niches.length >= MAX_SUB_NICHES) {
        setServiceLimit(`CreatorBridge limits creators to ${MAX_SUB_NICHES} specialties within their primary pillar. Deselect one to add another.`);
        return f;
      }
      return { ...f, sub_niches: [...f.sub_niches, subNicheId] };
    });
  };
  const addPortfolio = () => {
    setForm(f => ({
      ...f,
      portfolio: [...f.portfolio, { title: '', description: '', subNicheId: f.sub_niches[0] || '' }],
    }));
  };
  const updatePortfolio = (idx, field, val) => {
    setForm(f => {
      const portfolio = [...f.portfolio];
      portfolio[idx] = { ...portfolio[idx], [field]: val };
      return { ...f, portfolio };
    });
  };
  const removePortfolio = (idx) => {
    setForm(f => ({ ...f, portfolio: f.portfolio.filter((_, i) => i !== idx) }));
  };
  const uploadPortfolioPreview = async (idx, file) => {
    if (!file) return;
    if (!supabaseConfigured || !user?.id) {
      setPortfolioUploadState(s => ({ ...s, [idx]: 'Sign in before uploading portfolio images.' }));
      return;
    }

    setPortfolioUploadState(s => ({ ...s, [idx]: 'Uploading preview image...' }));
    try {
      const imageRef = await uploadUserAsset({
        bucket: 'creator-portfolio',
        userId: user.id,
        folder: 'portfolio',
        file,
      });
      updatePortfolio(idx, 'imageUrl', imageRef);
      setPortfolioUploadState(s => ({ ...s, [idx]: 'Preview image uploaded.' }));
    } catch (error) {
      setPortfolioUploadState(s => ({
        ...s,
        [idx]: error?.message || 'Portfolio image could not be uploaded.',
      }));
    }
  };

  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.08] text-white placeholder-charcoal-600 focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const labelCls = `text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? 'text-charcoal-300' : 'text-gray-500'} mb-2`;
  const stepMeta = [
    { n: 1, label: 'About You', title: 'Start with the creator identity clients will see.', desc: 'Use clear professional details, location, and positioning that match the standard of work you want to book.' },
    { n: 2, label: 'Standards', title: 'Confirm the marketplace requirements.', desc: 'CreatorBridge is built around experienced, US-based professionals with reviewed profiles.' },
    { n: 3, label: 'Craft', title: 'Choose your craft and your specialties.', desc: 'Pick the pillar that matches your primary work, then choose up to 3 specialties within it. These show on your profile.' },
    { n: 4, label: 'Portfolio', title: 'Show proof of the work.', desc: 'Add your intro video and at least three portfolio samples from real client work.' },
    { n: 5, label: 'Submit', title: 'Review contact details and final acknowledgments.', desc: 'These confirmations protect clients, creators, and the quality of the marketplace.' },
  ];
  const currentStep = stepMeta[step - 1];

  // Derived validation state
  const bioLen = form.bio.length;
  const expBlocked = BLOCKED_EXPERIENCE.includes(form.yearsExperience);
  const completePortfolioCount = form.portfolio.filter(portfolioItemComplete).length;
  const portfolioMet = completePortfolioCount >= 3;
  const videoIntroMet = form.videoIntroUrl.trim().length > 0;
  const pillarSelected = !!form.primary_pillar
    && form.sub_niches.length >= 1
    && form.sub_niches.length <= MAX_SUB_NICHES
    && form.sub_niches.every(id => {
      const sn = getSubNiche(id);
      return sn && sn.pillar === form.primary_pillar;
    });
  const usLocationMet = form.location.country === 'US' && form.usBasedConfirm;

  const nextDisabled =
    (step === 1 && (!form.name || bioLen < 100 || form.location.country !== 'US')) ||
    (step === 2 && (!form.yearsExperience || expBlocked || !usLocationMet || !form.ageConfirm)) ||
    (step === 3 && !pillarSelected) ||
    (step === 4 && (!portfolioMet || !videoIntroMet));

	  const canPublish =
	    !!(form.name && form.contact.email &&
	    form.yearsExperience && !expBlocked &&
	    usLocationMet && form.ageConfirm &&
	    pillarSelected &&
	    videoIntroMet && bioLen >= 100 && portfolioMet &&
	    form.insuranceAck && form.lockConfirm && form.reviewNoticeConfirm &&
	    form.tosAccepted && form.creatorAgreementAccepted && form.aiOriginalWorkConfirm);

	  const publishChecks = [
	    { label: 'Creator identity', done: !!form.name && bioLen >= 100 },
	    { label: 'Marketplace standards', done: !!form.yearsExperience && !expBlocked && usLocationMet && form.ageConfirm },
	    { label: 'Craft + specialties', done: pillarSelected },
	    { label: 'Proof of work', done: videoIntroMet && portfolioMet },
	    { label: 'Contact email', done: !!form.contact.email },
	    { label: 'Final acknowledgments', done: form.insuranceAck && form.lockConfirm && form.reviewNoticeConfirm && form.tosAccepted && form.creatorAgreementAccepted && form.aiOriginalWorkConfirm },
	  ];

  const handleSubmit = () => {
    if (!canPublish) return;
    const regionKey = zipToRegion(form.location.zip) || 'us-tier2';
    const city = zipToCity(form.location.zip) || form.location.city;
    const listing = {
      ...form,
      id: Date.now().toString(),
      location: { ...form.location, city: city || form.location.city, regionKey },
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      primary_pillar: form.primary_pillar,
      sub_niches: form.sub_niches,
      aiToolsDisclosure: form.aiToolsDisclosure,
      rating: parseFloat(form.rating) || null,
      reviewCount: parseInt(form.reviewCount) || null,
      availability: 'available',
      verified: false,
      verification_status: 'pending',
      review_status: 'pending_review',
      years_experience: parseYearsExperience(form.yearsExperience),
      video_intro_url: form.videoIntroUrl.trim(),
      createdAt: new Date().toISOString(),
    };
    onSave(listing);
  };

  // If user already has a profile, show message instead of form
  if (existingProfile) {
    return (
      <div className={`rounded-2xl border p-6 text-center space-y-4 ${dark ? 'bg-charcoal-800 border-charcoal-700' : 'bg-white border-gray-200'}`}>
        <AlertCircle size={36} className="text-gold-400 mx-auto" />
        <h3 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>
          You already have a CreatorBridge profile.
        </h3>
        <p className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          Each creator can only have one profile on the platform. Click below to edit your existing profile.
        </p>
        <button type="button" onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold text-sm transition-all">
          Go to My Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Creator Standards notice box */}
      <div className={`relative overflow-hidden rounded-2xl border p-6 ${
        dark ? 'border-gold-500/25 bg-charcoal-950/55 shadow-[0_24px_80px_rgba(0,0,0,0.25)]' : 'border-gold-500/30 bg-gold-50'
      }`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent" />
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Creator Application
            </p>
            <h3 className={`font-display text-2xl font-bold leading-tight ${dark ? 'text-white' : 'text-gray-950'}`}>
              CreatorBridge Creator Standards
            </h3>
            <p className={`mt-3 text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              Every creator is manually reviewed before their profile goes live. To be approved, the application needs to meet all core marketplace standards.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              'US-based with 2+ years paid experience',
              '3 portfolio samples from real client work',
              'Service packages with real pricing',
              '60 to 90 second professional intro video',
              'Stripe identity verification with government ID',
              'Profile locked for 90 days after submission',
            ].map(item => (
              <div key={item} className={`flex items-start gap-2 rounded-xl border px-3 py-3 ${
                dark ? 'border-white/[0.07] bg-white/[0.035]' : 'border-gold-200 bg-white'
              }`}>
                <BadgeCheck size={14} className="mt-0.5 shrink-0 text-gold-400" />
                <span className={`text-xs leading-5 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className={`rounded-2xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/40' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex gap-1.5">
        {stepMeta.map(({ n, label }) => (
          <div key={n} className="flex items-center gap-1 flex-1">
            <button type="button" onClick={() => n < step && setStep(n)}
              className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all shrink-0 ${
                n <= step ? 'bg-gold-500 text-charcoal-950 shadow-[0_0_24px_rgba(212,169,65,0.2)]' : dark ? 'bg-white/[0.04] text-charcoal-500' : 'bg-gray-200 text-gray-400'
              }`}>{n}</button>
            <span className={`text-[10px] hidden sm:inline uppercase tracking-[0.14em] ${n === step ? 'text-gold-400 font-bold' : dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
              {label}
            </span>
            {n < TOTAL_STEPS && <div className={`flex-1 h-px ${n < step ? 'bg-gold-500/50' : dark ? 'bg-charcoal-700' : 'bg-gray-200'}`} />}
          </div>
        ))}
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${dark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-white'}`}>
        <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Step {currentStep.n} of {TOTAL_STEPS}
        </p>
        <h2 className={`font-display text-xl font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>
          {currentStep.title}
        </h2>
        <p className={`mt-2 text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          {currentStep.desc}
        </p>
      </div>

      {/* Step 1: About You */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Your Name *</p>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Marcus Chen"
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
            </div>
            <div>
              <p className={labelCls}>Business Name</p>
              <input type="text" value={form.businessName} onChange={e => set('businessName', e.target.value)} placeholder="e.g. Elevation Films"
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
            </div>
          </div>
          <div>
            <p className={labelCls}>Professional Bio *</p>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={4}
              placeholder="Tell clients what you specialize in, your style, and what makes you stand out..."
              className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all resize-none ${inputCls}`} />
            <p className={`text-xs mt-1 ${bioLen >= 100 ? 'text-gold-400' : dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
              {bioLen} / 100 characters minimum
            </p>
            {bioLen > 0 && bioLen < 100 && (
              <p className="text-xs text-red-400 mt-0.5">Your bio must be at least 100 characters.</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className={labelCls}>City</p>
              <input type="text" value={form.location.city} onChange={e => setLocation('city', e.target.value)} placeholder="Los Angeles"
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
            </div>
            <div>
              <p className={labelCls}>State / Region</p>
              <input type="text" value={form.location.state} onChange={e => setLocation('state', e.target.value)} placeholder="CA"
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
            </div>
            <div>
              <p className={labelCls}>ZIP Code</p>
              <input type="text" maxLength={5} value={form.location.zip} onChange={e => setLocation('zip', e.target.value.replace(/\D/g, ''))}
                placeholder="90028"
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
              {form.location.zip.length >= 3 && zipToCity(form.location.zip) && (
                <p className="text-[10px] text-gold-400 mt-1">{zipToCity(form.location.zip)}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Launch Market</p>
              <div className={`w-full px-4 py-3 text-sm rounded-xl border ${inputCls}`}>
                United States
              </div>
              <p className="mt-1 text-xs text-gold-400">
                CreatorBridge is US-only at launch.
              </p>
            </div>
            <div>
              <p className={labelCls}>Experience Level</p>
              <div className={`flex rounded-xl border overflow-hidden h-[42px] ${dark ? 'border-charcoal-600' : 'border-gray-200'}`}>
                {[['entry','2-3y'],['mid','4-6y'],['senior','7+y']].map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => set('experience', id)}
                    className={`flex-1 text-xs font-medium transition-colors ${
                      form.experience === id ? 'bg-gold-500 text-charcoal-900' : dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}>{lbl}</button>
                ))}
              </div>
              <p className={`mt-1.5 text-[11px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                CreatorBridge accepts creators with 2+ years of paid professional experience.
              </p>
            </div>
          </div>
          <div>
            <p className={labelCls}>Tags (comma-separated)</p>
            <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
              placeholder="Brand Films, Wedding Photography, Drone & Aerial Video, Short-Form Editing, Real Estate"
              className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
          </div>
        </div>
      )}

      {/* Step 2: Professional Standards */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className={labelCls}>Years of Experience *</p>
            <select value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)}
              className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`}>
              <option value="">Select your experience level...</option>
              <option value="Less than 1 year">Less than 1 year</option>
              <option value="1 year">1 year</option>
              <option value="2 years">2 years</option>
              <option value="3 to 5 years">3 to 5 years</option>
              <option value="5 to 10 years">5 to 10 years</option>
              <option value="10+ years">10+ years</option>
            </select>
            {expBlocked && (
              <p className="text-xs text-red-400 mt-1">
                CreatorBridge requires a minimum of 2 years of paid professional experience.
              </p>
            )}
          </div>

          <div className={`rounded-xl border p-4 space-y-3 ${dark ? 'border-charcoal-700 bg-charcoal-900/40' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Confirmations Required *</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.usBasedConfirm}
                onChange={e => set('usBasedConfirm', e.target.checked)}
                className="mt-0.5 accent-gold-500"
              />
              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                I confirm I am based in the United States
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ageConfirm}
                onChange={e => set('ageConfirm', e.target.checked)}
                className="mt-0.5 accent-gold-500"
              />
              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
                I confirm I am 18 years of age or older
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Step 3: Pillar + Specialties */}
      {step === 3 && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/20 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
            <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
              Your craft, your specialties
            </p>
            <p className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
              Pick the pillar that matches your primary work, then choose 1 to {MAX_SUB_NICHES} specialties within it. Specialties show on your profile and help clients find you faster. You can refine your rates later in your dashboard.
            </p>
          </div>

          {/* Pillar picker */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-3 ${dark ? 'text-gold-400' : 'text-gold-600'}`}>
              Step 1 · Pick your primary pillar
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(PILLARS).map(pillar => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setPillar(pillar.id)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    form.primary_pillar === pillar.id
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400 shadow-lg shadow-gold-500/5'
                      : dark
                        ? 'border-white/[0.08] bg-charcoal-950/55 text-charcoal-300 hover:border-gold-500/40'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className="text-2xl block mb-2">{pillar.icon}</span>
                  <span className="block text-sm font-bold mb-1">{pillar.name}</span>
                  <span className={`block text-[10px] leading-4 ${form.primary_pillar === pillar.id ? 'text-gold-300' : dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                    {pillar.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-niche picker (only shows after a pillar is picked) */}
          {form.primary_pillar && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? 'text-gold-400' : 'text-gold-600'}`}>
                  Step 2 · Pick up to {MAX_SUB_NICHES} specialties
                </p>
                <span className={`text-[10px] font-semibold ${form.sub_niches.length === MAX_SUB_NICHES ? 'text-gold-400' : dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                  {form.sub_niches.length} / {MAX_SUB_NICHES} selected
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {(SUB_NICHES_BY_PILLAR[form.primary_pillar] || []).map(sn => {
                  const isSelected = form.sub_niches.includes(sn.id);
                  const isMaxed = form.sub_niches.length >= MAX_SUB_NICHES && !isSelected;
                  return (
                    <button
                      key={sn.id}
                      type="button"
                      disabled={isMaxed}
                      onClick={() => toggleSubNiche(sn.id)}
                      className={`rounded-xl border p-3 text-xs font-medium text-left transition-all ${
                        isSelected
                          ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                          : isMaxed
                            ? 'opacity-30 cursor-not-allowed border-white/[0.04] bg-transparent'
                            : dark
                              ? 'border-white/[0.06] bg-charcoal-950/40 text-charcoal-300 hover:border-gold-500/30'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="mr-1">{isSelected ? '✓' : '+'}</span>
                      {sn.label}
                    </button>
                  );
                })}
              </div>
              {form.sub_niches.length === MAX_SUB_NICHES && (
                <p className="text-[10px] text-gold-400 mt-3 font-medium">
                  Maximum reached. Deselect a specialty to add a different one.
                </p>
              )}
            </div>
          )}

          {serviceLimit && (
            <div className={`rounded-xl border p-3 text-xs ${dark ? 'border-gold-500/25 bg-gold-500/10 text-gold-300' : 'border-gold-300 bg-gold-50 text-gold-700'}`}>
              {serviceLimit}
            </div>
          )}
        </div>
      )}

	      {/* Step 4: Portfolio + Video Intro */}
	      {step === 4 && (
	        <div className="space-y-4">
	          <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/20 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
	            <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
	              Proof of work
	            </p>
	            <p className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
	              This is the trust layer of your profile. Clients should be able to understand your voice, your real client experience, and the kind of production work you can repeat.
	            </p>
	          </div>
	          {/* Video intro URL */}
	          <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
	              <div>
	                <div className="flex items-center justify-between gap-3 mb-3">
	                  <div>
	                    <p className={labelCls}>Professional Video Intro *</p>
	                    <p className={`text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	                      Link a 60 to 90 second intro that shows who clients will be hiring.
	                    </p>
	                  </div>
	                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${videoIntroMet ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.06] text-charcoal-400 ring-1 ring-white/[0.08]' : 'bg-gray-100 text-gray-500'}`}>
	                    {videoIntroMet ? 'Added' : 'Required'}
	                  </span>
	                </div>
	                <input
	                  type="url"
	                  value={form.videoIntroUrl}
	                  onChange={e => set('videoIntroUrl', e.target.value)}
	                  placeholder="Paste your intro video link from YouTube, Vimeo, or Loom"
	                  className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`}
	                />
	              </div>
	              <div className={`rounded-xl border p-3 ${dark ? 'border-gold-500/15 bg-gold-500/[0.06]' : 'border-gold-200 bg-white'}`}>
	                <p className={`text-xs font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>What to cover</p>
	                <div className={`space-y-1.5 text-[11px] leading-5 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
	                  <p>- Who you are and where you work</p>
	                  <p>- Your strongest production specialty</p>
	                  <p>- What clients can expect from you</p>
	                  <p>- A quick mention of real client work</p>
	                </div>
	              </div>
	            </div>
	          </div>

	          {/* Portfolio items */}
	          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
	            <div>
	              <p className={labelCls}>Portfolio Samples *</p>
	              <p className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	                Add at least 3 real client projects. Use titles and short descriptions that prove scope, not vague labels.
	              </p>
	            </div>
	            <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${portfolioMet ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.06] text-charcoal-400 ring-1 ring-white/[0.08]' : 'bg-gray-100 text-gray-500'}`}>
	              {completePortfolioCount}/3 complete
	            </div>
	          </div>
	          {form.portfolio.map((item, i) => (
	            <div key={i} className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	              <div className="flex items-start justify-between gap-3 mb-3">
	                <div>
	                  <p className="text-gold-400" style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
	                    Sample {i + 1}
	                  </p>
	                  <p className={`mt-1 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	                    Real client work, campaign, event, production, or published project.
	                  </p>
	                </div>
	                <button type="button" onClick={() => removePortfolio(i)}
	                  className="rounded-lg p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
	              </div>
	              <div className="grid gap-3 md:grid-cols-[1fr_220px] mb-3">
	                <input type="text" value={item.title} onChange={e => updatePortfolio(i, 'title', e.target.value)}
	                  placeholder="Project title, e.g. Product launch campaign"
	                  className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	                <select value={item.subNicheId || ''} onChange={e => updatePortfolio(i, 'subNicheId', e.target.value)}
	                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ${inputCls}`}>
	                  <option value="">Tag a specialty</option>
	                  {form.sub_niches.map(snId => {
	                    const sn = getSubNiche(snId);
	                    return sn ? <option key={snId} value={snId}>{sn.label}</option> : null;
	                  })}
	                </select>
	              </div>
	              <textarea value={item.description} onChange={e => updatePortfolio(i, 'description', e.target.value)}
	                rows={2}
	                placeholder="Briefly describe the client, scope, deliverables, or result."
	                className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all resize-none ${inputCls}`} />
	              <input type="url" value={item.link || ''} onChange={e => updatePortfolio(i, 'link', e.target.value)}
	                placeholder="Portfolio link, e.g. YouTube, Vimeo, website, Drive, or published project URL"
	                className={`mt-3 w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	              <input type="url" value={item.imageUrl || ''} onChange={e => updatePortfolio(i, 'imageUrl', e.target.value)}
	                placeholder="Optional preview image URL, e.g. approved project still, thumbnail, or portfolio image"
	                className={`mt-3 w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	              <div className={`mt-3 rounded-xl border border-dashed p-3 ${dark ? 'border-white/[0.08] bg-charcoal-950/35' : 'border-gray-300 bg-gray-50'}`}>
	                <label className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
	                  Upload preview image
	                </label>
	                <p className={`mt-1 text-xs ${dark ? 'text-charcoal-500' : 'text-gray-500'}`}>
	                  Optional. Use a real project still or approved client-safe thumbnail. JPG, PNG, or WEBP under 8 MB.
	                </p>
	                <input
	                  type="file"
	                  accept="image/png,image/jpeg,image/webp"
	                  onChange={e => uploadPortfolioPreview(i, e.target.files?.[0])}
	                  className={`mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-xs file:font-bold file:bg-gold-500 file:text-charcoal-900 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}
	                />
	                {portfolioUploadState[i] && (
	                  <p className={`mt-2 text-xs ${portfolioUploadState[i].includes('uploaded') ? 'text-gold-400' : 'text-red-400'}`}>
	                    {portfolioUploadState[i]}
	                  </p>
	                )}
	              </div>
	            </div>
	          ))}
          <button type="button" onClick={addPortfolio}
            className={`w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              dark ? 'border-charcoal-600 text-charcoal-400 hover:border-gold-500/50 hover:text-gold-400' : 'border-gray-300 text-gray-500 hover:border-gold-500/50 hover:text-gold-500'
            }`}>
            <Plus size={14} /> Add Portfolio Item
          </button>
          {completePortfolioCount < 3 && (
            <p className="text-xs text-gold-400 mt-1">
              Please add at least 3 complete portfolio samples with title, description, service, and link before submitting.
            </p>
          )}
        </div>
      )}

	      {/* Step 5: Contact + Acknowledgments */}
	      {step === 5 && (
	        <div className="space-y-4">
	          <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/20 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
	            <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
	              Final review
	            </p>
	            <p className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
	              Confirm the contact details and platform rules before your profile goes into review. This protects clients, creators, and the quality of the marketplace.
	            </p>
	          </div>

	          <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	            <div className="flex items-center justify-between gap-3 mb-4">
	              <div>
	                <p className={labelCls}>Contact Details</p>
	                <p className={`text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	                  Direct contact stays protected until booking rules allow it, but CreatorBridge needs accurate details for review and account support.
	                </p>
	              </div>
	              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${form.contact.email ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.06] text-charcoal-400 ring-1 ring-white/[0.08]' : 'bg-gray-100 text-gray-500'}`}>
	                {form.contact.email ? 'Email added' : 'Email required'}
	              </span>
	            </div>
	            <div className="grid gap-3 md:grid-cols-2">
	              {[
	                { key: 'email',     label: 'Email *',          placeholder: 'hello@yourstudio.com',  type: 'email' },
	                { key: 'phone',     label: 'Phone',            placeholder: '(555) 000-0000',        type: 'tel' },
	                { key: 'website',   label: 'Website',          placeholder: 'yourstudio.com',        type: 'text' },
	                { key: 'instagram', label: 'Instagram Handle', placeholder: '@yourstudio',           type: 'text' },
	              ].map(({ key, label, placeholder, type }) => (
	                <div key={key}>
	                  <p className={labelCls}>{label}</p>
	                  <input type={type} value={form.contact[key]} onChange={e => setContact(key, e.target.value)} placeholder={placeholder}
	                    className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	                </div>
	              ))}
	            </div>
	          </div>

	          <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	            <p className={labelCls}>Optional reputation signals</p>
	            <p className={`text-xs leading-5 mb-3 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	              Add existing rating and review count only if they reflect real public client history.
	            </p>
	            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	              <div>
	                <p className={labelCls}>Your Rating (optional)</p>
	                <input type="number" min={0} max={5} step={0.1} value={form.rating} onChange={e => set('rating', e.target.value)} placeholder="4.8"
	                  className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	              </div>
	              <div>
	                <p className={labelCls}># of Reviews (optional)</p>
	                <input type="number" min={0} value={form.reviewCount} onChange={e => set('reviewCount', e.target.value)} placeholder="47"
	                  className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	              </div>
	            </div>
	          </div>

	          {/* Insurance and liability */}
	          <div className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${dark ? 'border-gold-500/25 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
	            <p className={`text-xs font-semibold ${dark ? 'text-gold-300' : 'text-gold-700'}`}>Acknowledgments Required</p>
	            <p className={`text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	              CreatorBridge does not require insurance, but many clients, especially for on-site work, will ask about your coverage.
	            </p>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.insuranceAck} onChange={e => set('insuranceAck', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I understand that CreatorBridge does not verify or require insurance. I am responsible for disclosing my coverage to clients who ask, and I acknowledge I may be required to show proof of insurance before some bookings.
	              </span>
	            </label>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.lockConfirm} onChange={e => set('lockConfirm', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I understand that my profile information cannot be changed for 90 days after submission. I have reviewed all details and confirm everything is accurate.
	              </span>
	            </label>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.reviewNoticeConfirm} onChange={e => set('reviewNoticeConfirm', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I understand my profile will be reviewed by the CreatorBridge team before going live. I will receive an email with the decision within 3 to 5 business days.
	              </span>
	            </label>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.tosAccepted} onChange={e => set('tosAccepted', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I have read and agree to the{' '}
                <button type="button"
                  onClick={e => { e.preventDefault(); setShowTermsModal(true); }}
                  className="text-gold-400 hover:text-gold-300 underline font-medium">
                  Terms of Service
                </button>
	                {' '}and platform policies.
	              </span>
	            </label>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.creatorAgreementAccepted} onChange={e => set('creatorAgreementAccepted', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I have read and agree to the{' '}
                <button type="button"
                  onClick={e => { e.preventDefault(); setShowCreatorAgreementModal(true); }}
                  className="text-gold-400 hover:text-gold-300 underline font-medium">
                  Creator Agreement
                </button>
	                {' '}governing my professional services on the platform.
	              </span>
	            </label>
	            <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/35' : 'border-gold-200 bg-white'}`}>
	              <input type="checkbox" checked={form.aiOriginalWorkConfirm} onChange={e => set('aiOriginalWorkConfirm', e.target.checked)} className="mt-0.5 accent-gold-500" />
	              <span className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
	                I confirm that all portfolio samples and work shown on my profile are original work created by me and do not contain AI generated content. I understand that submitting AI generated content as my own work is grounds for immediate account removal.
	              </span>
	            </label>
	          </div>

	          <div className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	            <div className="flex items-center justify-between gap-3 mb-3">
	              <p className={labelCls}>Submission readiness</p>
	              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${canPublish ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.06] text-charcoal-400 ring-1 ring-white/[0.08]' : 'bg-gray-100 text-gray-500'}`}>
	                {publishChecks.filter(c => c.done).length}/{publishChecks.length} ready
	              </span>
	            </div>
	            <div className="grid gap-2 sm:grid-cols-2">
	              {publishChecks.map(check => (
	                <div key={check.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${check.done ? 'bg-gold-500/10 text-gold-400' : dark ? 'bg-white/[0.035] text-charcoal-400' : 'bg-white text-gray-500'}`}>
	                  <BadgeCheck size={13} />
	                  <span className="text-xs font-medium">{check.label}</span>
	                </div>
	              ))}
	            </div>
	          </div>
	        </div>
	      )}

      {/* Navigation */}
      <div className="flex gap-2">
        {step > 1 && (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark ? 'border-charcoal-600 text-charcoal-300 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={() => setStep(s => s + 1)}
            disabled={nextDisabled}
            className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-1.5">
            Next <ArrowRight size={12} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit}
            disabled={!canPublish}
            className="flex-1 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold disabled:opacity-40 transition-all">
            Publish My Profile
          </button>
        )}
      </div>

      {/* Inline Terms of Service modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="cb-modal-backdrop" onClick={() => setShowTermsModal(false)} />
          <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl ${
            dark ? 'bg-charcoal-900 border-charcoal-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-charcoal-700' : 'border-gray-200'} shrink-0`}>
              <h2 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>
                CreatorBridge Terms of Service
              </h2>
              <button type="button" onClick={() => setShowTermsModal(false)}
                className={`p-2 rounded-xl transition-colors ${dark ? 'text-charcoal-400 hover:text-white hover:bg-charcoal-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {[
                {
                  title: 'Section 1 — Platform Use',
                  body: 'CreatorBridge is a US-only professional marketplace connecting verified media creators with clients. By creating an account you agree to use the platform lawfully and professionally.',
                },
                {
                  title: 'Section 2 — Creator Standards',
                  body: 'Creators must have a minimum of 2 years paid professional experience, maintain accurate profile information, deliver work as agreed, and communicate professionally with clients at all times.',
                },
                {
                  title: 'Section 3 — Payments',
                  body: 'All payments are processed through Stripe. Clients pay a 50% retainer upfront. The remaining 50% releases upon delivery approval or automatically after 72 hours. CreatorBridge charges creators a platform fee starting at 10%, dropping as you complete more projects.',
                },
                {
                  title: 'Section 4 — Cancellations',
                  body: 'If a client cancels before work begins, the creator keeps 25% as a cancellation fee. If a client cancels after work starts, the creator keeps the full 50% retainer. No refunds after delivery.',
                },
                {
                  title: 'Section 5 — Conduct',
                  body: 'Users must not share contact information to work off-platform, post fake reviews, harass other users, or attempt to bypass platform fees. Violations result in account suspension.',
                },
                {
                  title: 'Section 6 — Profile Lock',
                  body: 'Creator profile information is locked for 90 days after submission to protect platform integrity.',
                },
                {
                  title: 'Section 7 — Disputes',
                  body: 'Clients have 72 hours after delivery to open a dispute. After 72 hours with no action, payment releases automatically.',
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h3 className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                  <p className={`text-xs leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{body}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-end px-6 py-4 border-t ${dark ? 'border-charcoal-700' : 'border-gray-200'} shrink-0`}>
              <button type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Creator Agreement modal */}
      {showCreatorAgreementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="cb-modal-backdrop" onClick={() => setShowCreatorAgreementModal(false)} />
          <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl ${
            dark ? 'bg-charcoal-900 border-charcoal-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? 'border-charcoal-700' : 'border-gray-200'} shrink-0`}>
              <h2 className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>
                CreatorBridge Creator Agreement
              </h2>
              <button type="button" onClick={() => setShowCreatorAgreementModal(false)}
                className={`p-2 rounded-xl transition-colors ${dark ? 'text-charcoal-400 hover:text-white hover:bg-charcoal-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {[
                {
                  title: 'Section 1 — Introduction & Scope',
                  body: 'This agreement details your rights and duties regarding payments, fees, client bookings, profile locks, and general operational standards on the CreatorBridge platform.',
                },
                {
                  title: 'Section 2 — Platform Fee Structure & Tiers',
                  body: 'Our platform fee percentage decreases as you complete more projects: Launch Tier (10%), Proven Tier (8%), Elite Tier (6%), and Signature Tier (5%).',
                },
                {
                  title: 'Section 3 — Payments & Stripe Connect',
                  body: 'You must onboard with Stripe Connect. Payments use an escrow-like structure: a 50% retainer paid upfront before work starts, and the remaining 50% final payout released upon delivery approval or 72-hour auto-approval.',
                },
                {
                  title: 'Section 4 — Non-Circumvention',
                  body: 'All communications, bookings, and payments with clients introduced on CreatorBridge must stay on the platform. Exclusivity is required for 24 months. Off-platform activity is grounds for account removal.',
                },
                {
                  title: 'Section 5 — 90-Day Profile Lock',
                  body: 'To prevent rapid changes to bypass reviews, critical identity details (business name, full name, location) are locked for 90 days after profile approval.',
                },
                {
                  title: 'Section 6 — Violations (Three-Strike Rule)',
                  body: 'Infractions result in a warning (Strike 1), visibility/bidding restrictions (Strike 2), and profile suspension (Strike 3).',
                },
                {
                  title: 'Section 7 — Term and Termination',
                  body: 'Either party may close the account, but you must complete any active bookings, and the 24-month non-circumvention rule remains active for prior introductions.',
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h3 className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                  <p className={`text-xs leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{body}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-end px-6 py-4 border-t ${dark ? 'border-charcoal-700' : 'border-gray-200'} shrink-0`}>
              <button type="button"
                onClick={() => setShowCreatorAgreementModal(false)}
                className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function CreatorDirectory({ dark = true, mode = 'search', onSwitchToRegister, onSwitchToSearch }) {
  const { user } = useAuth();
  const [listings, setListings] = useState(loadListings);
  const availabilityLoadedFor = useRef('');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all'); // DEPRECATED: kept for legacy refs, do not use in new code
  const [pillarFilter, setPillarFilter] = useState('all'); // 'all' | pillar id
  const [subNicheFilter, setSubNicheFilter] = useState('all'); // 'all' | sub_niche id
  const [budget, setBudget] = useState('');
  const [zip, setZip] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  const [tierFilter, setTierFilter] = useState('all');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [availFilter, setAvailFilter] = useState('all');

  const isGuest = !user;
  const approvedListingCount = listings.filter(isApprovedCreator).length;

  useEffect(() => {
    if (!supabaseConfigured || !supabase || listings.length === 0) return;

    const listingIds = listings
      .map(item => item.id)
      .filter(id => id && !String(id).startsWith('seed-'))
      .sort();
    const loadKey = listingIds.join('|');

    if (!loadKey || availabilityLoadedFor.current === loadKey) return;
    availabilityLoadedFor.current = loadKey;

    let active = true;
    supabase
      .from('availability')
      .select('listing_id,date,status')
      .in('listing_id', listingIds)
      .then(({ data, error }) => {
        if (!active || error) return;

        const byListing = (data || []).reduce((acc, row) => {
          if (!row.listing_id || !row.date || !row.status) return acc;
          acc[row.listing_id] = acc[row.listing_id] || {};
          acc[row.listing_id][row.date] = row.status;
          return acc;
        }, {});

        setListings(prev => prev.map(item => (
          byListing[item.id] ? { ...item, availabilityMap: byListing[item.id] } : item
        )));
      });

    return () => { active = false; };
  }, [listings]);

  const budgetNum = parseFloat(budget) || 0;
  const zipRegion = zip.length >= 3 ? zipToRegion(zip) : null;
  const zipCity = zip.length >= 3 ? zipToCity(zip) : null;

  // Filter and sort creators
  const filtered = useMemo(() => {
    let list = listings.filter(creator => isApprovedCreator(creator) || creator.user_id === user?.id);
    const PILLAR_TO_LEGACY = { video_production: 'video', photography: 'photography', post_production: 'postProduction' };
    const creatorMatchesPillar = (creator, pillarId) => {
      if (pillarId === 'all') return true;
      if (creator.primary_pillar === pillarId) return true;
      // Legacy fallback for any creator whose row predates backfill
      const legacyServiceId = PILLAR_TO_LEGACY[pillarId];
      if (!legacyServiceId) return false;
      return (creator.services || []).some(s => (s.serviceId || s.service_id) === legacyServiceId);
    };
    const creatorMatchesSubNiche = (creator, subNicheId) => {
      if (subNicheId === 'all') return true;
      return (creator.sub_niches || []).includes(subNicheId);
    };
    const findMatchingService = (creator) => {
      const services = creator.services || [];
      return services[0];
    };

    // Pillar filter
    if (pillarFilter !== 'all') {
      list = list.filter(c => creatorMatchesPillar(c, pillarFilter));
    }
    // Sub-niche filter (only meaningful when a pillar is selected, but works either way)
    if (subNicheFilter !== 'all') {
      list = list.filter(c => creatorMatchesSubNiche(c, subNicheFilter));
    }

    // Text search (name, bio, tags, location)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => {
        const searchable = [
          c.name, c.businessName, c.bio,
          ...(c.tags || []),
          c.location?.city, c.location?.state, c.location?.country,
          ...(c.services?.flatMap(s => [
            SERVICES[s.serviceId]?.name,
            ...(s.subtypes || []),
          ]) || []),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }

    // ZIP/region filter
    if (zipRegion) {
      const tier = REGIONS[zipRegion]?.tier;
      list = list.filter(c => {
        const cRegion = c.location?.regionKey;
        const cTier = REGIONS[cRegion]?.tier;
        return Math.abs((cTier || 0) - (tier || 0)) <= 1;
      });
    }

    // Budget filter from query input
    if (budgetNum > 0 && pillarFilter !== 'all') {
      list = list.filter(c => {
        const svc = findMatchingService(c);
        if (!svc?.rates) return true;
        const rates = Object.values(svc.rates).filter(Boolean);
        if (rates.length === 0) return true;
        const min = Math.min(...rates);
        return min <= budgetNum * 2.5;
      });
    }

    // Tier Filter
    if (tierFilter !== 'all') {
      list = list.filter(c => c.tier === tierFilter);
    }

    // Budget Categories Filter (Chips)
    if (budgetFilter !== 'all') {
      list = list.filter(c => {
        const lowestRate = getLowestRate(c);
        if (!lowestRate) return false;
        if (budgetFilter === 'under1000') return lowestRate < 1000;
        if (budgetFilter === 'under2500') return lowestRate < 2500;
        if (budgetFilter === 'over2500') return lowestRate >= 2500;
        return true;
      });
    }

    // Availability Filter
    if (availFilter === 'available') {
      list = list.filter(c => c.availability === 'available');
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'reviews':
        list.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'price_asc': {
        const getMin = (c) => {
          const svc = findMatchingService(c);
          const rates = Object.values(svc?.rates || {}).filter(Boolean);
          return rates.length > 0 ? Math.min(...rates) : Infinity;
        };
        list.sort((a, b) => getMin(a) - getMin(b));
        break;
      }
      case 'price_desc': {
        const getMax = (c) => {
          const svc = findMatchingService(c);
          const rates = Object.values(svc?.rates || {}).filter(Boolean);
          return rates.length > 0 ? Math.max(...rates) : 0;
        };
        list.sort((a, b) => getMax(b) - getMax(a));
        break;
      }
      case 'match':
        if (budgetNum > 0 && pillarFilter !== 'all') {
          list.sort((a, b) => {
            const aRate = Object.values(findMatchingService(a)?.rates || {});
            const bRate = Object.values(findMatchingService(b)?.rates || {});
            const aDist = aRate.length ? Math.min(...aRate.map(r => Math.abs(r - budgetNum))) : Infinity;
            const bDist = bRate.length ? Math.min(...bRate.map(r => Math.abs(r - budgetNum))) : Infinity;
            return aDist - bDist;
          });
        }
        break;
    }

    // Apply verification ranking boost on top of all sorts:
    // Pro Verified > Verified > Unverified, then by rating, then by completed_projects
    const verificationRank = (c) => {
      if (c.verification_status === 'pro_verified') return 2;
      if (c.verification_status === 'verified') return 1;
      return 0;
    };
    list.sort((a, b) => {
      const vDiff = verificationRank(b) - verificationRank(a);
      if (vDiff !== 0) return vDiff;
      const rDiff = (b.rating || 0) - (a.rating || 0);
      if (rDiff !== 0) return rDiff;
      return (b.completed_projects || 0) - (a.completed_projects || 0);
    });

    return list;
  }, [listings, pillarFilter, subNicheFilter, searchQuery, budgetNum, zipRegion, sortBy, user?.id, tierFilter, budgetFilter, availFilter]);

  const displayListings = isGuest ? getRotatingPreviewCreators(filtered) : filtered;

  // 5D. New creator spotlight — recently verified with no bookings, rotated weekly
  const spotlightCreators = useMemo(() => getNewCreatorSpotlight(listings, 3), [listings]);

  const handleSaveListing = async (listing) => {
    // Attach user_id to the listing if a user is logged in
    const enriched = { ...listing, user_id: user?.id || null };
    let savedListing = enriched;
    if (supabaseConfigured && user) {
      try {
        const { data: row, error } = await supabase
          .from('creator_listings')
          .insert({
            user_id: user.id,
            name: enriched.name,
            business_name: enriched.businessName || null,
            avatar: enriched.avatar || '🎬',
            bio: enriched.bio,
            experience: enriched.experience,
            years_experience: enriched.years_experience,
            tags: enriched.tags,
            availability: enriched.availability,
            verified: false,
            verification_status: 'pending',
            city: enriched.location?.city || null,
            state: enriched.location?.state || null,
            country: 'US',
            zip: enriched.location?.zip || null,
            region_key: enriched.location?.regionKey || 'us-tier2',
            email: enriched.contact?.email || null,
            phone: enriched.contact?.phone || null,
            website: enriched.contact?.website || null,
            instagram: enriched.contact?.instagram || null,
            rating: enriched.rating,
            review_count: enriched.reviewCount,
            video_intro_url: enriched.video_intro_url || enriched.videoIntroUrl || null,
            primary_pillar: enriched.primary_pillar,
            sub_niches: enriched.sub_niches || [],
          })
          .select()
          .single();
        if (error) throw error;

        savedListing = { ...enriched, id: row.id, createdAt: row.created_at };

        // creator_services is deprecated under the 3-pillar model.
        // primary_pillar + sub_niches live directly on creator_listings.

        const portfolioRows = savedListing.portfolio.map((item, index) => ({
          listing_id: row.id,
          // portfolio_items.service_id column is reused to store sub_niche IDs
          // until a follow-up migration renames it to sub_niche_id.
          service_id: item.subNicheId || item.serviceId || null,
          title: item.title,
          description: item.description,
          link: item.link,
          image_url: item.imageUrl || item.image_url || null,
          display_order: index,
        }));
        if (portfolioRows.length) await supabase.from('portfolio_items').insert(portfolioRows);

        // Record creator agreement acceptance
        await supabase
          .from('legal_acceptances')
          .insert({
            user_id: user.id,
            document_type: 'creator_agreement',
            document_version: '1.0'
          });

        // Trigger welcome creator email
        sendNotificationEmail(enriched.contact?.email || user.email, 'welcome_creator', {
          creator_name: enriched.name
        });
      } catch (err) {
        console.error('Error inserting creator directory data:', err);
        savedListing = enriched;
      }
    }
    const updated = [savedListing, ...listings.filter(item => item.user_id !== user?.id)];
    setListings(updated);
    saveListings(updated);
    if (onSwitchToSearch) onSwitchToSearch();
  };

  const handleDelete = (id) => {
    const updated = listings.filter(l => l.id !== id);
    setListings(updated);
    saveListings(updated);
  };

  const textSub = dark ? 'text-charcoal-400' : 'text-gray-500';
  const inputCls = dark
    ? 'bg-charcoal-900 border-charcoal-600 text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';

  // ── Register mode ──
  if (mode === 'register') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <p className="text-gold-400 mb-4" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Verified creative talent only
          </p>
          <h1 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Join <span className="text-gradient-gold">CreatorBridge</span>
          </h1>
          <p className={`text-sm md:text-base leading-7 ${textSub} max-w-2xl mx-auto`}>
            Apply to claim one primary pillar, set professional rates, and get reviewed for a curated marketplace built for US-based media creators.
          </p>
        </div>

        <div className={`relative overflow-hidden rounded-[28px] border p-5 md:p-8 ${
          dark ? 'bg-charcoal-900/72 border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.35)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <RegisterForm onSave={handleSaveListing} dark={dark} user={user} />
        </div>

        {/* Stats */}
        <div className={`mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center`}>
          {[
            { n: listings.filter(isApprovedCreator).length, label: 'Approved creators' },
            { n: Object.keys(PILLARS).length, label: 'Primary pillars' },
            { n: MAX_SUB_NICHES, label: 'Specialties max' },
          ].map(({ n, label }) => (
            <div key={label} className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
              <p className="font-display text-xl font-bold text-gradient-gold">{n}</p>
              <p className={`text-[10px] ${textSub}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Search mode (default) ──
  return (
    <div className="relative w-full min-h-screen">
      <div className="cb-home-wide relative z-0 mx-auto w-full px-5 sm:px-8 lg:px-14 2xl:px-16 py-10 md:py-14">
        <div className="mb-4 flex items-center gap-2 text-[11px] text-charcoal-500">
          <button type="button" onClick={() => navigate('/')} className="transition-colors hover:text-white">Home</button>
          <span className="opacity-40">/</span>
          <span className="text-charcoal-200">Find Creators</span>
        </div>

        <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.08]">
          <img src="/images/creatorbridge/backgrounds/06-page-headers/header-findcreators-onset-crew.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.6, filter: 'brightness(0.8) saturate(1.05)' }} loading="lazy" />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(13,13,15,0.94) 0%, rgba(13,13,15,0.8) 40%, rgba(13,13,15,0.5) 74%, rgba(13,13,15,0.32) 100%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,13,15,0.2) 0%, rgba(13,13,15,0.08) 55%, rgba(13,13,15,0.55) 100%)' }} />
          <div className="relative z-10 grid gap-6 p-6 md:p-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-2">
              Browse the network · US-only
            </p>
            <h1 className="serif text-4xl md:text-5xl font-medium leading-[1.05] text-white">
              Verified creators, <span className="gold-text">sorted by what matters</span>.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Filter by primary pillar — Video Production, Photography, or Post Production — then narrow by specialty. Every creator commits to one pillar and 1–3 specialties.
            </p>
          </div>
          
          <div className="relative z-10 lg:col-span-5">
            <div className="liquid-glass flex items-center gap-2 rounded-xl p-1.5">
              <Search size={16} className="ml-2 text-charcoal-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, studio, specialty, city"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-charcoal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="rounded-lg p-2 text-charcoal-500 transition-colors hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
              <button type="button" className="btn-gold text-[11px]" style={{ padding: '0.5rem 1rem' }}>
                Search
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              <div className="relative flex items-center">
              <MapPin size={14} className="absolute left-3 pointer-events-none text-charcoal-400" />
              <input 
                type="text" 
                maxLength={5} 
                value={zip} 
                onChange={e => setZip(e.target.value.replace(/\D/g,''))}
                placeholder="ZIP Code..."
                className="w-32 rounded-xl border border-white/[0.08] bg-charcoal-950/70 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder-charcoal-500 focus:border-gold-500" 
              />
            </div>
            
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-charcoal-950/70 px-3 py-2 text-xs text-white outline-none focus:border-gold-500"
            >
              <option value="rating">Top Rated</option>
              <option value="reviews">Most Reviews</option>
              <option value="match">Best Budget Match</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
            </div>
          </div>
          </div>
        </div>

        {/* Mobile-only Filters toggle. On phones the filter sidebar is long
            and pushes creator cards far down the page. Collapse it by default
            and let the user reveal it on demand. Desktop always shows the
            sidebar via the lg:block override below. */}
        <button
          type="button"
          onClick={() => setShowFilters(s => !s)}
          className="lg:hidden mt-6 w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.08] bg-charcoal-950/60 text-white text-xs font-semibold"
        >
          <span className="flex items-center gap-2">
            <span className="text-gold-400">{showFilters ? '×' : '＋'}</span>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-charcoal-400">
            {pillarFilter !== 'all' || subNicheFilter !== 'all' || tierFilter !== 'all' || budgetFilter !== 'all' || availFilter !== 'all' || zip ? 'Active' : ''}
          </span>
        </button>

        {/* Main Grid: Sidebar Filters + Creator Cards */}
        <div className="mt-4 lg:mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[280px_1fr]">

          {/* Left Column: Sticky Filters Sidebar */}
          <aside className={`liquid-glass space-y-5 rounded-2xl p-5 lg:sticky lg:top-24 ${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="eyebrow">Filters</div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setServiceFilter('all');
                  setPillarFilter('all');
                  setSubNicheFilter('all');
                  setTierFilter('all');
                  setBudgetFilter('all');
                  setAvailFilter('all');
                  setZip('');
                }}
                className="text-[10px] uppercase tracking-wider text-charcoal-500 transition-colors hover:text-gold-400"
              >
                Reset
              </button>
            </div>
            <div>
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-charcoal-500">Primary pillar</h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => { setPillarFilter('all'); setSubNicheFilter('all'); }}
                  className={`filter-chip ${pillarFilter === 'all' ? 'active' : ''}`}
                >
                  <span>Any pillar</span>
                  <span className="count">
                    {approvedListingCount}
                  </span>
                </button>
                {Object.values(PILLARS).map(pillar => {
                  const count = listings.filter(creator => {
                    if (!isApprovedCreator(creator) && creator.user_id !== user?.id) return false;
                    if (creator.primary_pillar === pillar.id) return true;
                    const PILLAR_TO_LEGACY = { video_production: 'video', photography: 'photography', post_production: 'postProduction' };
                    const legacy = PILLAR_TO_LEGACY[pillar.id];
                    return legacy && (creator.services || []).some(s => (s.serviceId || s.service_id) === legacy);
                  }).length;
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      onClick={() => { setPillarFilter(pillar.id); setSubNicheFilter('all'); }}
                      className={`filter-chip ${pillarFilter === pillar.id ? 'active' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-display text-[11px] text-gold-400/80">{`0${Object.values(PILLARS).findIndex(item => item.id === pillar.id) + 1}`}</span>
                        <span>{pillar.name}</span>
                      </span>
                      <span className="count">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-niche secondary filter: only shows when a pillar is selected */}
              {pillarFilter !== 'all' && (
                <div className="specialty-list">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setSubNicheFilter('all')}
                      className={`filter-chip text-[11px] ${subNicheFilter === 'all' ? 'active' : ''}`}
                    >
                      <span>All specialties</span>
                    </button>
                    {(SUB_NICHES_BY_PILLAR[pillarFilter] || []).map(sn => {
                      const count = listings.filter(c => (c.sub_niches || []).includes(sn.id)).length;
                      return (
                        <button
                          key={sn.id}
                          type="button"
                          onClick={() => setSubNicheFilter(sn.id)}
                          className={`filter-chip text-[11px] ${subNicheFilter === sn.id ? 'active' : ''}`}
                        >
                          <span>{sn.label}</span>
                          {count > 0 && <span className="count">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-charcoal-500">Tier</h3>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'Any tier' },
                  { id: 'signature', label: 'Elite' },
                  { id: 'pro', label: 'Proven' },
                  { id: 'launch', label: 'Verified' }
                ].map(tier => {
                  const count = listings.filter(c => {
                    const approved = isApprovedCreator(c) || c.user_id === user?.id;
                    if (!approved) return false;
                    return tier.id === 'all' || c.tier === tier.id;
                  }).length;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setTierFilter(tier.id)}
                      className={`filter-chip ${tierFilter === tier.id ? 'active' : ''}`}
                    >
                      <span>{tier.label}</span>
                      <span className="count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-charcoal-500">Budget · USD</h3>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'Any budget' },
                  { id: 'under1000', label: 'Under $1,000' },
                  { id: 'under2500', label: 'Under $2,500' },
                  { id: 'over2500', label: 'Over $2,500' }
                ].map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetFilter(b.id)}
                    className={`filter-chip ${budgetFilter === b.id ? 'active' : ''}`}
                  >
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-charcoal-500">Availability</h3>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'Any availability' },
                  { id: 'available', label: 'Open now' }
                ].map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvailFilter(a.id)}
                    className={`filter-chip ${availFilter === a.id ? 'active' : ''}`}
                  >
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Quick guided discovery match widget inside sidebar */}
            <div className="border-t border-white/[0.06] pt-5">
              <h3 className="mb-3 text-[10px] uppercase tracking-[0.2em] text-charcoal-500">Guided Discovery</h3>
              <FastMatch dark={dark} />
            </div>
          </aside>

          {/* Right Column: Results Grid */}
          <main className="space-y-6">
            {/* Guest Promo Notice */}
            {isGuest && (
              <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="max-w-md">
                  <p className="text-xs font-bold text-gold-400 mb-0.5">Daily Curated Preview</p>
                  <p className="text-[11px] text-charcoal-400 leading-normal">
                    Guests see a limited selection of 3 verified creators each day. Create a free account to browse the full national directory, view active rates, packages, and book instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'signup' } }))}
                  className="shrink-0 px-3.5 py-1.5 bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold rounded-lg transition-all"
                >
                  Create Free Account
                </button>
              </div>
            )}

            {/* Results Header Info */}
            <div className="flex items-center justify-between text-xs text-charcoal-400">
              <p>
                Showing {displayListings.length} creator{displayListings.length !== 1 ? 's' : ''} 
                {pillarFilter !== 'all' && ` in ${PILLARS[pillarFilter]?.name || ''}`}
                {subNicheFilter !== 'all' && ` · ${getSubNiche(subNicheFilter)?.label || ''}`}
                {zipCity && ` near ${zipCity}`}
                <span className="text-charcoal-600"> · {approvedListingCount} verified in network</span>
              </p>
            </div>

            {/* Cards Grid */}
            {displayListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                {displayListings.map(creator => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    dark={dark}
                    onViewProfile={isGuest && !creator.id?.startsWith('seed-') ? () => setShowGuestGate(true) : undefined}
                    onDelete={!isGuest && !creator.id?.startsWith('seed-') ? () => handleDelete(creator.id) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-white/[0.08] rounded-2xl p-12 text-center bg-charcoal-900/30">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-sm font-semibold text-white">
                  No creators found
                </p>
                <p className="text-xs text-charcoal-400 mt-1 max-w-sm mx-auto">
                  Try selecting another pillar, clearing the specialty filter, or widening your search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setServiceFilter('all');
                    setPillarFilter('all');
                    setSubNicheFilter('all');
                    setTierFilter('all');
                    setBudgetFilter('all');
                    setAvailFilter('all');
                    setZip('');
                  }}
                  className="mt-4 px-4 py-2 border border-gold-500/20 hover:border-gold-500/40 text-gold-400 text-xs font-bold rounded-lg transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            )}
            
            {/* Join CTA for creators if they scroll to bottom */}
            <div className="rounded-2xl border border-white/[0.06] bg-charcoal-900/40 p-6 md:p-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-gold-400 mb-1" style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Are you a content creator?
                </p>
                <h3 className="font-display text-xl font-bold text-white mb-1">
                  Claim your primary pillar and set your rates
                </h3>
                <p className="text-xs text-charcoal-400 max-w-xl">
                  CreatorBridge matches verified video production, photography, and post-production specialists with serious client projects. Keep 90% of your earnings.
                </p>
              </div>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="shrink-0 bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold px-5 py-2.5 rounded-lg transition-all flex items-center gap-1.5"
              >
                <UserPlus size={13} /> Join as Creator
              </button>
            </div>
          </main>

        </div>
      </div>

      {/* Guest gate modal */}
      {showGuestGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="cb-modal-backdrop" onClick={() => setShowGuestGate(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-charcoal-700 bg-charcoal-900 p-8 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-gold-500/15 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <h2 className="font-display font-bold text-xl text-white mb-2">
              Join CreatorBridge to continue
            </h2>
            <p className="text-sm text-charcoal-400 mb-6 leading-relaxed">
              CreatorBridge is a verified professional marketplace. Create a free account to view full creator profiles, packages, rates, and submit project requests. It takes less than 2 minutes.
            </p>
            <button type="button"
              onClick={() => {
                setShowGuestGate(false);
                window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'signup' } }));
              }}
              className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold text-sm mb-3 transition-all">
              Create Free Account
            </button>
            <button type="button"
              onClick={() => {
                setShowGuestGate(false);
                window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login' } }));
              }}
              className="text-sm text-charcoal-400 hover:text-white transition-colors">
              Already have an account? Sign in
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
