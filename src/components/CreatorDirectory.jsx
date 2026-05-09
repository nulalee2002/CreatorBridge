import { useState, useMemo } from 'react';
import { getNewCreatorSpotlight } from '../utils/matchingAlgorithm.js';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, X, Plus, Trash2, ArrowRight, Filter, UserPlus, Heart, ExternalLink, BadgeCheck, AlertCircle } from 'lucide-react';
import { SERVICES, RATES, MARKETPLACE_CATEGORIES, getMarketplaceServiceIds, serviceMatchesMarketplaceCategory } from '../data/rates.js';
import { REGIONS } from '../data/regions.js';
import { SEED_CREATORS, initSeedData, SHOW_DEMO_CREATORS } from '../data/seedCreators.js';
import { zipToRegion, zipToCity } from '../data/zipCodes.js';
import { VerificationBadge } from './VerificationFlow.jsx';
import { LoyaltyBadge } from './LoyaltyBadge.jsx';
import { TierBadge } from './TierBadge.jsx';
import { FastMatch } from './FastMatch.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

// Initialize seed data (version-gated — replaces stale seeds automatically)
initSeedData();

function parseYearsExperience(value) {
  if (value === '2 years') return 2;
  if (value === '3 to 5 years') return 3;
  if (value === '5 to 10 years') return 5;
  if (value === '10+ years') return 10;
  return 0;
}

function serviceHasRates(service) {
  return Object.values(service?.rates || {}).some(value => Number(value) > 0);
}

function portfolioItemComplete(item) {
  return !!(
    item?.title?.trim() &&
    item?.description?.trim() &&
    item?.serviceId &&
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
  const locationStr = [location.city, location.state, location.country].filter(Boolean).join(', ');

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      dark ? 'bg-charcoal-800 border-charcoal-700 hover:border-charcoal-500' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
    }`}>
      <div className="p-5">
        {/* Top row: Avatar + Name/Badges + Fav */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${dark ? 'bg-charcoal-700' : 'bg-gray-100'}`}>
            {creator.avatar || '🎬'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className={`font-display font-bold text-base leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                {creator.businessName || creator.name}
              </h3>
              {creator.verification_status && creator.verification_status !== 'unverified' ? (
                <VerificationBadge status={creator.verification_status} />
              ) : creator.verified ? (
                <BadgeCheck size={14} className="text-gold-400 shrink-0 mt-0.5" title="Verified creator" />
              ) : null}
              {creator.tier && creator.tier !== 'launch' && <TierBadge tierId={creator.tier} />}
              {creator.completed_projects > 0 && <LoyaltyBadge completedProjects={creator.completed_projects} />}
            </div>
            {creator.businessName && creator.name && (
              <p className={`text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{creator.name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {locationStr && (
                <span className={`text-xs flex items-center gap-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                  <MapPin size={10} /> {locationStr}
                </span>
              )}
              {expLabel && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-charcoal-700 text-charcoal-400' : 'bg-gray-100 text-gray-500'}`}>
                  {expLabel}
                </span>
              )}
              {creator.availability === 'available' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-500/10 text-gold-300 font-medium ring-1 ring-gold-500/15">
                  Available
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={toggleFav}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${isFav ? 'text-red-400' : dark ? 'text-charcoal-600 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`}
            title={isFav ? 'Remove from favorites' : 'Save to favorites'}>
            <Heart size={14} className={isFav ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Bio: always 2 lines max */}
        <p className={`text-xs leading-relaxed line-clamp-2 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          {creator.bio}
        </p>

        {/* Tags: max 4, no expand */}
        {creator.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {creator.tags.slice(0, 4).map(tag => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-charcoal-700 text-charcoal-300' : 'bg-gray-100 text-gray-600'}`}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: rating left, View Profile right */}
        <div className="flex items-center justify-between mt-3">
          <div>
            {creator.rating ? (
              <div className="flex items-center gap-1">
                <Star size={12} className="text-gold-400 fill-gold-400" />
                <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{creator.rating}</span>
                {creator.reviewCount && (
                  <span className={`text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>({creator.reviewCount})</span>
                )}
              </div>
            ) : <span />}
          </div>
          <button
            type="button"
            onClick={onViewProfile ?? (() => navigate(`/creator/${creator.id}`))}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold transition-all"
          >
            <ExternalLink size={11} /> View Profile
          </button>
        </div>

        {/* Delete for user-added listings */}
        {onDelete && (
          <button type="button" onClick={() => onDelete(creator.id)}
            className="mt-2 text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
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
  const [form, setForm] = useState({
    name: '', businessName: '', bio: '', experience: 'mid',
    avatar: '', tags: '',
    location: { city: '', state: '', country: 'US', zip: '' },
    services: [{ serviceId: 'photography', subtypes: '', rates: {}, description: '' }],
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
    aiOriginalWorkConfirm: false,
    aiToolsDisclosure: [],
  });
  const [step, setStep] = useState(1);

  const TOTAL_STEPS = 5;
  const BLOCKED_EXPERIENCE = ['Less than 1 year', '1 year'];

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setLocation = (field, val) => setForm(f => ({ ...f, location: { ...f.location, [field]: val } }));
  const setContact = (field, val) => setForm(f => ({ ...f, contact: { ...f.contact, [field]: val } }));

	  const updateService = (idx, field, val) => {
	    setForm(f => {
	      const services = [...f.services];
	      services[idx] = {
	        ...services[idx],
	        [field]: val,
	        ...(field === 'serviceId' ? { rates: {}, subtypes: '', description: '' } : {}),
	      };
	      return { ...f, services };
	    });
	  };
  const setServiceRate = (idx, key, val) => {
    setForm(f => {
      const services = [...f.services];
      services[idx] = { ...services[idx], rates: { ...services[idx].rates, [key]: parseFloat(val) || 0 } };
      return { ...f, services };
    });
  };
  const addService = () => {
    setForm(f => {
      if (f.services.length >= 3) {
        setServiceLimit('CreatorBridge encourages creators to focus on their strongest services. You can list a maximum of 3 service specialties. This helps clients find the right creator faster and helps you stand out in your strongest areas.');
        return f;
      }
      return {
        ...f,
        services: [...f.services, { serviceId: 'video', subtypes: '', rates: {}, description: '' }],
      };
    });
  };
  const removeService = (idx) => {
    setForm(f => ({ ...f, services: f.services.filter((_, i) => i !== idx) }));
  };
  const addPortfolio = () => {
    setForm(f => ({
      ...f,
      portfolio: [...f.portfolio, { title: '', description: '', serviceId: f.services[0]?.serviceId || 'photography' }],
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

  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.08] text-white placeholder-charcoal-600 focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500';
  const labelCls = `text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? 'text-charcoal-300' : 'text-gray-500'} mb-2`;
  const stepMeta = [
    { n: 1, label: 'About You', title: 'Start with the creator identity clients will see.', desc: 'Use clear professional details, location, and positioning that match the standard of work you want to book.' },
    { n: 2, label: 'Standards', title: 'Confirm the marketplace requirements.', desc: 'CreatorBridge is built around experienced, US-based professionals with reviewed profiles.' },
    { n: 3, label: 'Services', title: 'Build real service packages and rates.', desc: 'Add the production services you want clients to book, with transparent pricing attached.' },
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
  const serviceOffersMet = form.services.length > 0 && form.services.every(serviceHasRates);
  const usLocationMet = form.location.country === 'US' && form.usBasedConfirm;

  const nextDisabled =
    (step === 1 && (!form.name || bioLen < 100 || form.location.country !== 'US')) ||
    (step === 2 && (!form.yearsExperience || expBlocked || !usLocationMet || !form.ageConfirm)) ||
    (step === 3 && !serviceOffersMet) ||
    (step === 4 && (!portfolioMet || !videoIntroMet));

	  const canPublish =
	    !!(form.name && form.contact.email &&
	    form.yearsExperience && !expBlocked &&
	    usLocationMet && form.ageConfirm &&
	    serviceOffersMet &&
	    videoIntroMet && bioLen >= 100 && portfolioMet &&
	    form.insuranceAck && form.lockConfirm && form.reviewNoticeConfirm &&
	    form.tosAccepted && form.aiOriginalWorkConfirm);

	  const publishChecks = [
	    { label: 'Creator identity', done: !!form.name && bioLen >= 100 },
	    { label: 'Marketplace standards', done: !!form.yearsExperience && !expBlocked && usLocationMet && form.ageConfirm },
	    { label: 'Service offers', done: serviceOffersMet },
	    { label: 'Proof of work', done: videoIntroMet && portfolioMet },
	    { label: 'Contact email', done: !!form.contact.email },
	    { label: 'Final acknowledgments', done: form.insuranceAck && form.lockConfirm && form.reviewNoticeConfirm && form.tosAccepted && form.aiOriginalWorkConfirm },
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
      services: form.services.map(s => ({
        ...s,
        subtypes: typeof s.subtypes === 'string' ? s.subtypes.split(',').map(t => t.trim()).filter(Boolean) : s.subtypes,
      })),
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
              <p className={labelCls}>Country</p>
              <select value={form.location.country} onChange={e => setLocation('country', e.target.value)}
                className={`w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${inputCls}`}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="SE">Scandinavia</option>
                <option value="NL">Netherlands</option>
              </select>
              {form.location.country !== 'US' && (
                <p className="mt-1 text-xs text-red-400">
                  CreatorBridge is US-only at launch. Canada and Europe are later expansion markets.
                </p>
              )}
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
              placeholder="Corporate, Wedding, Drone, UGC, Real Estate"
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

	      {/* Step 3: Services & Rates */}
	      {step === 3 && (
	        <div className="space-y-4">
	          <div className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/20 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
	            <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.2px', textTransform: 'uppercase' }}>
	              Service positioning
	            </p>
	            <p className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
	              Choose up to 3 focused specialties. CreatorBridge is not built for every possible gig, so your strongest services, clear package language, and real rates matter more than a long menu.
	            </p>
	          </div>
	          {form.services.map((svc, sIdx) => {
	            const serviceDef = SERVICES[svc.serviceId];
	            const serviceRates = RATES[svc.serviceId] || {};
	            const allRateKeys = serviceDef ? [...(serviceDef.primaryRates || []), ...(serviceDef.packageRates || [])] : [];
	            const ratesEntered = allRateKeys.filter(key => Number(svc.rates[key]) > 0).length;
	            return (
	              <div key={sIdx} className={`rounded-2xl border p-4 sm:p-5 ${dark ? 'border-white/[0.07] bg-charcoal-950/55' : 'border-gray-200 bg-gray-50'}`}>
	                <div className="flex items-start justify-between gap-3 mb-4">
	                  <div>
	                    <p className="text-gold-400 mb-1" style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
	                      Service {sIdx + 1}
	                    </p>
	                    <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
	                      {serviceDef?.name || 'Choose a service'}
	                    </p>
	                    <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
	                      {serviceDef?.description || 'Select the production category that best matches this offer.'}
	                    </p>
	                  </div>
	                  {form.services.length > 1 && (
	                    <button type="button" onClick={() => removeService(sIdx)}
	                      className="rounded-lg p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
	                  )}
	                </div>
	                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
	                  {Object.values(SERVICES).map(s => (
	                    <button key={s.id} type="button" onClick={() => updateService(sIdx, 'serviceId', s.id)}
	                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
	                        svc.serviceId === s.id
	                          ? 'border-gold-500 bg-gold-500/10 text-gold-400'
	                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35 hover:bg-white/[0.035]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
	                      }`}>
	                      <span className="text-xl leading-none">{s.icon}</span>
	                      <span>
	                        <span className="block text-xs font-bold leading-tight">{s.name}</span>
	                        <span className={`mt-1 block text-[10px] leading-4 ${svc.serviceId === s.id ? 'text-gold-300' : dark ? 'text-charcoal-500' : 'text-gray-400'}`}>{s.description}</span>
	                      </span>
	                    </button>
	                  ))}
	                </div>
	                <div className="grid gap-3 md:grid-cols-2 mb-4">
	                <div>
	                  <p className={labelCls}>Specialties (comma-separated)</p>
	                  <input type="text" value={svc.subtypes} onChange={e => updateService(sIdx, 'subtypes', e.target.value)}
	                    placeholder={serviceDef?.subtypes?.join(', ')}
	                    className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
	                </div>
	                <div>
	                  <p className={labelCls}>Description</p>
	                  <textarea value={svc.description} onChange={e => updateService(sIdx, 'description', e.target.value)} rows={2}
	                    placeholder="Describe what clients receive, your style, and what is included..."
	                    className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all resize-none ${inputCls}`} />
	                </div>
	                </div>
	                <div className="flex items-center justify-between gap-3 mb-3">
	                  <p className={labelCls}>Your Rates ($)</p>
	                  <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${ratesEntered ? 'text-gold-400' : dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
	                    {ratesEntered}/{allRateKeys.length} entered
	                  </span>
	                </div>
	                <div className="grid gap-2 md:grid-cols-2">
	                  {allRateKeys.map(key => {
	                    const meta = serviceRates[key];
	                    if (!meta) return null;
	                    return (
	                      <div key={key} className={`rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-charcoal-950/45' : 'border-gray-200 bg-white'}`}>
	                        <div className="flex items-center gap-3">
	                        <span className={`text-xs flex-1 leading-4 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{meta.label}</span>
	                        <div className="relative flex items-center w-32 shrink-0">
	                          <span className={`absolute left-2 text-xs pointer-events-none ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>$</span>
	                          <input type="number" min={0} value={svc.rates[key] || ''}
	                            onChange={e => setServiceRate(sIdx, key, e.target.value)} placeholder="0"
	                            className={`w-full pl-5 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`} />
	                        </div>
	                        </div>
	                        {meta.tooltip && (
	                          <p className={`mt-2 text-[10px] leading-4 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>{meta.tooltip}</p>
	                        )}
	                      </div>
	                    );
	                  })}
	                </div>
	                {ratesEntered === 0 && (
	                  <p className="text-xs text-gold-400 mt-3">
	                    Add at least one realistic rate so clients can understand your pricing.
	                  </p>
	                )}
	              </div>
	            );
	          })}
          {serviceLimit && (
            <div className={`rounded-xl border p-3 text-xs ${dark ? 'border-gold-500/25 bg-gold-500/10 text-gold-300' : 'border-gold-300 bg-gold-50 text-gold-700'}`}>
              {serviceLimit}
            </div>
          )}
          {form.services.length < 3 && (
            <button type="button" onClick={addService}
              className={`w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                dark ? 'border-charcoal-600 text-charcoal-400 hover:border-gold-500/50 hover:text-gold-400' : 'border-gray-300 text-gray-500 hover:border-gold-500/50 hover:text-gold-500'
              }`}>
              <Plus size={14} /> Add Another Service
            </button>
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
	                <select value={item.serviceId} onChange={e => updatePortfolio(i, 'serviceId', e.target.value)}
	                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ${inputCls}`}>
	                  {form.services.map((s, si) => (
	                    <option key={si} value={s.serviceId}>{SERVICES[s.serviceId]?.icon} {SERVICES[s.serviceId]?.name}</option>
	                  ))}
	                </select>
	              </div>
	              <textarea value={item.description} onChange={e => updatePortfolio(i, 'description', e.target.value)}
	                rows={2}
	                placeholder="Briefly describe the client, scope, deliverables, or result."
	                className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all resize-none ${inputCls}`} />
	              <input type="url" value={item.link || ''} onChange={e => updatePortfolio(i, 'link', e.target.value)}
	                placeholder="Portfolio link, e.g. YouTube, Vimeo, website, Drive, or published project URL"
	                className={`mt-3 w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowTermsModal(false)} />
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
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function CreatorDirectory({ dark = true, mode = 'search', onSwitchToRegister, onSwitchToSearch }) {
  const { user } = useAuth();
  const [listings, setListings] = useState(loadListings);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [budget, setBudget] = useState('');
  const [zip, setZip] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  const isGuest = !user;

  const budgetNum = parseFloat(budget) || 0;
  const zipRegion = zip.length >= 3 ? zipToRegion(zip) : null;
  const zipCity = zip.length >= 3 ? zipToCity(zip) : null;

  // Filter and sort creators
  const filtered = useMemo(() => {
    let list = listings.filter(creator => isApprovedCreator(creator) || creator.user_id === user?.id);
    const serviceIds = getMarketplaceServiceIds(serviceFilter);
    const findMatchingService = (creator) => {
      const services = creator.services || [];
      return serviceFilter === 'all'
        ? services[0]
        : services.find(s => serviceMatchesMarketplaceCategory(s.serviceId, serviceFilter));
    };

    // Service filter
    if (serviceFilter !== 'all') {
      list = list.filter(c =>
        c.services?.some(s => serviceIds.includes(s.serviceId))
      );
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

    // Budget filter
    if (budgetNum > 0 && serviceFilter !== 'all') {
      list = list.filter(c => {
        const svc = findMatchingService(c);
        if (!svc?.rates) return true;
        const rates = Object.values(svc.rates).filter(Boolean);
        if (rates.length === 0) return true;
        const min = Math.min(...rates);
        return min <= budgetNum * 2.5;
      });
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
        if (budgetNum > 0 && serviceFilter !== 'all') {
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
  }, [listings, serviceFilter, searchQuery, budgetNum, zipRegion, sortBy, user?.id]);

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
          })
          .select()
          .single();
        if (error) throw error;

        savedListing = { ...enriched, id: row.id, createdAt: row.created_at };

        const serviceRows = savedListing.services.map(service => ({
          listing_id: row.id,
          service_id: service.serviceId,
          subtypes: service.subtypes || [],
          description: service.description || null,
          rates: service.rates || {},
        }));
        if (serviceRows.length) await supabase.from('creator_services').insert(serviceRows);

        const portfolioRows = savedListing.portfolio.map((item, index) => ({
          listing_id: row.id,
          service_id: item.serviceId,
          title: item.title,
          description: item.description,
          link: item.link,
          display_order: index,
        }));
        if (portfolioRows.length) await supabase.from('portfolio_items').insert(portfolioRows);
      } catch {
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
            Apply to list your services, set professional rates, and get reviewed for a curated marketplace built for US-based media creators.
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
            { n: Object.keys(SERVICES).length, label: 'Service types' },
            { n: new Set(listings.map(l => l.location?.country).filter(Boolean)).size, label: 'Countries' },
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

  const MARKETPLACE_PROOFS = [
    { label: 'Creator review', value: 'Manual', detail: 'Profiles are checked before they publish.' },
    { label: 'Payment rhythm', value: '50 / 50', detail: 'Retainer upfront, final payment on delivery.' },
    { label: 'Creator fee', value: '10% to 6%', detail: 'Fees drop as completed work grows.' },
  ];

  const VALUE_PILLARS = [
    { headline: 'Curated media professionals', desc: 'CreatorBridge is built for video, photo, podcast, drone, events, and content production work, not general gig listings.' },
    { headline: 'Cleaner client decisions', desc: 'Brands can review focused creator profiles, service fit, availability, and reputation before starting a project.' },
    { headline: 'A marketplace with standards', desc: 'Creator profiles are gated by experience, portfolio, verification, and platform rules before they can go live.' },
  ];

  const PROCESS_STEPS = [
    { step: '01', title: 'Define the production need', copy: 'Choose the service type, market, budget range, and delivery expectations.' },
    { step: '02', title: 'Review curated creator fit', copy: 'Browse verified media specialists instead of sorting through general gig profiles.' },
    { step: '03', title: 'Book with protected payments', copy: 'Use the 50% retainer and 50% delivery structure to keep both sides accountable.' },
  ];

  const COMPARISON_ROWS = [
    { label: 'Creator fee', creatorbridge: '10% to 6%', alternative: 'Often up to 20%' },
    { label: 'Client booking fee', creatorbridge: '5%', alternative: 'Often higher or unclear' },
    { label: 'Media-only focus', creatorbridge: 'Yes', alternative: 'Usually broad categories' },
    { label: 'Verified creator standards', creatorbridge: 'Required', alternative: 'Mixed or self-managed' },
    { label: 'Protected payment structure', creatorbridge: '50 / 50', alternative: 'Varies by platform' },
  ];

  const TAB_STYLE_BASE = {
    padding: '10px 14px',
    fontSize: '11px',
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(212,169,65,0.1)',
    borderRadius: '999px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s',
  };

  return (
    <div className="w-full overflow-hidden">

      {/* 1. Service filter bar */}
      <div
        className="w-full overflow-x-auto no-scrollbar"
        style={{
          borderBottom: dark ? '1px solid rgba(212,169,65,0.16)' : '1px solid rgba(0,0,0,0.08)',
          background: dark ? 'linear-gradient(90deg, rgba(13,13,24,0.92), rgba(22,22,42,0.7), rgba(13,13,24,0.92))' : 'rgba(255,255,255,0.86)',
        }}
      >
        <div className="mx-auto flex min-w-max max-w-[1520px] items-center gap-3 px-5 py-3 sm:px-8 lg:px-12">
          <div className="hidden xl:flex mr-2 items-center gap-3 pr-4 border-r border-gold-500/14">
            <span className="h-2 w-2 rounded-full bg-gold-400 shadow-[0_0_16px_rgba(212,169,65,0.55)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-400">Production categories</span>
          </div>
          {[
            ...MARKETPLACE_CATEGORIES,
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceFilter(s.id)}
              className={serviceFilter === s.id ? 'text-gold-400' : 'text-charcoal-200 hover:text-white'}
              style={{
                ...TAB_STYLE_BASE,
                borderColor: serviceFilter === s.id ? 'rgba(212,169,65,0.55)' : 'rgba(212,169,65,0.1)',
                background: serviceFilter === s.id ? 'rgba(212,169,65,0.13)' : 'rgba(255,255,255,0.025)',
                boxShadow: serviceFilter === s.id ? '0 0 24px rgba(212,169,65,0.12)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <span>{s.icon}</span><span>{s.name}</span>
            </button>
          ))}
          <div className="hidden 2xl:flex ml-auto items-center gap-2 pl-4 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-300">
            <span className="h-px w-12 bg-gold-500/35" />
            Verified creators only
          </div>
        </div>
      </div>

      {/* Page content wrapper */}
      <div className="mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12">

        {/* 2. Editorial hero */}
        <section className="relative py-12 sm:py-16 lg:py-20">
          <div
            className="absolute inset-x-0 top-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,169,65,0.45), transparent)' }}
          />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)] gap-10 lg:gap-14 items-center">

            {/* Left column */}
            <div className="relative z-10 max-w-5xl">
              <div className="mb-7 flex flex-wrap items-center gap-3">
                <span
                  className="text-gold-400"
                  style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}
                >
                  Curated media production marketplace
                </span>
                <span className="hidden sm:block h-px w-20 bg-gold-500/35" />
                <span className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} text-[11px] font-semibold uppercase tracking-[0.18em]`}>
                  Phoenix built, national reach
                </span>
              </div>
              <h1
                className={`max-w-5xl leading-[0.96] ${dark ? 'text-white' : 'text-gray-950'}`}
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: 400, fontSize: 'clamp(42px, 7.6vw, 118px)' }}
              >
                Verified creative talent for brands that need the work done right.
              </h1>
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_auto] gap-6 lg:gap-10 items-end">
                <p className={`${dark ? 'text-charcoal-200' : 'text-gray-700'} text-base sm:text-lg leading-8`}>
                  CreatorBridge connects brands with reviewed videographers, photographers, podcast producers, drone operators, event crews, and content specialists who are built for professional production work.
                </p>
                <div className="flex gap-3 flex-wrap lg:justify-end">
                  <button
                    type="button"
                    onClick={() => document.getElementById('creator-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold transition-all inline-flex items-center gap-2"
                    style={{ padding: '15px 26px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: 8, border: 'none', cursor: 'pointer', boxShadow: '0 18px 42px rgba(212,169,65,0.18)' }}
                  >
                    Find Creators <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className={`font-bold transition-all ${dark ? 'text-white hover:text-gold-400' : 'text-gray-900 hover:text-gold-500'}`}
                    style={{ padding: '15px 24px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: dark ? '1px solid rgba(212,169,65,0.28)' : '1px solid rgba(0,0,0,0.18)', cursor: 'pointer' }}
                  >
                    Join as Creator
                  </button>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="relative">
              <div
                className="absolute -inset-8 opacity-70"
                style={{ background: 'radial-gradient(circle at 50% 30%, rgba(212,169,65,0.12), transparent 62%)' }}
              />
              <div
                className={`relative overflow-hidden rounded-lg border p-5 sm:p-6 ${dark ? 'bg-charcoal-950/80 border-gold-500/25' : 'bg-white/90 border-gold-500/20'}`}
                style={{ boxShadow: dark ? '0 28px 90px rgba(0,0,0,0.36)' : '0 24px 80px rgba(0,0,0,0.12)' }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(212,169,65,0.85), transparent)' }}
                />
                <p className="text-gold-400 mb-5" style={{ fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
                  Marketplace standards
                </p>
                <div className="space-y-3">
                  {MARKETPLACE_PROOFS.map(({ label, value, detail }) => (
                    <div
                      key={label}
                      className={`rounded-lg border p-4 ${dark ? 'bg-white/[0.035] border-white/[0.07]' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`${dark ? 'text-charcoal-300' : 'text-gray-500'} text-[10px] font-bold uppercase tracking-[0.18em]`}>{label}</p>
                          <p className={`${dark ? 'text-white' : 'text-gray-950'} mt-1 text-sm font-semibold`}>{detail}</p>
                        </div>
                        <p className="shrink-0 text-right font-display text-xl font-bold text-gold-400">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-5 rounded-lg border px-4 py-3 ${dark ? 'bg-gold-500/10 border-gold-500/25' : 'bg-gold-50 border-gold-200'}`}>
                  <p className={`${dark ? 'text-gold-200' : 'text-gold-800'} text-sm font-bold`}>Built for serious production work</p>
                  <p className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} mt-1 text-xs leading-5`}>
                    Profiles, packages, booking flow, and payment structure are designed around media projects that need trust before the first invoice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Curation strip */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6 items-stretch">
          <div className={`rounded-lg border p-5 flex flex-col justify-between ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
            <div>
              <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                Guided discovery
              </p>
              <p className={`${dark ? 'text-white' : 'text-gray-950'} font-display text-2xl font-bold leading-tight`}>
                Start with fit, not endless scrolling.
              </p>
            </div>
            <div className="mt-5">
              <FastMatch dark={dark} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PROCESS_STEPS.map(({ step, title, copy }) => (
              <div key={step} className={`rounded-lg border p-5 ${dark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-gray-200'}`}>
                <p className="text-gold-400 font-display text-xl font-bold">{step}</p>
                <p className={`${dark ? 'text-white' : 'text-gray-950'} mt-3 text-sm font-bold`}>{title}</p>
                <p className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} mt-2 text-xs leading-5`}>{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Search bar (logged-in only) / Guest banner */}
        {isGuest ? (
          <div id="creator-search" className="rounded-lg border border-gold-500/35 bg-gold-500/10 p-5 mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-gold-400 mb-1">Daily curated preview</p>
              <p className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} text-xs leading-5`}>
                Guests see 3 verified creators each day. Create a free account to browse full profiles, packages, rates, and project requests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'signup' } }))}
              className="shrink-0 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold rounded-xl transition-all">
              Create Free Account
            </button>
          </div>
        ) : (
          <>
            <div
              id="creator-search"
              className={`flex overflow-hidden mb-3 shadow-sm rounded-lg ${dark ? 'bg-charcoal-950/80' : 'bg-white'}`}
              style={{ border: dark ? '1px solid rgba(212,169,65,0.22)' : '1px solid rgba(0,0,0,0.12)' }}
            >
              <div className="relative flex-1 flex items-center">
                <Search size={16} className={`absolute left-4 pointer-events-none ${dark ? 'text-charcoal-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, service, location, or specialty..."
                  className={`w-full pl-11 pr-4 py-4 text-sm bg-transparent outline-none ${dark ? 'text-white placeholder-charcoal-400' : 'text-gray-900 placeholder-gray-400'}`}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(f => !f)}
                className={`px-4 flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  showFilters
                    ? 'bg-gold-500 text-charcoal-900'
                    : dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
                style={{ borderLeft: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}
              >
                <Filter size={12} /> Filters
              </button>
            </div>

            {showFilters && (
              <div className={`mb-3 p-4 ${dark ? 'bg-charcoal-800 border-charcoal-700' : 'bg-white border-gray-200'}`} style={{ border: '1px solid', borderColor: dark ? '#2a2a45' : '#e5e7eb' }}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className={`text-xs font-medium mb-1 ${textSub}`}>Budget</p>
                    <div className="relative flex items-center">
                      <span className={`absolute left-3 text-sm pointer-events-none ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>$</span>
                      <input type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)}
                        placeholder="e.g. 500"
                        className={`w-full pl-7 pr-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs font-medium mb-1 ${textSub}`}>Your ZIP Code</p>
                    <div className="relative flex items-center">
                      <MapPin size={14} className={`absolute left-3 pointer-events-none ${dark ? 'text-charcoal-400' : 'text-gray-400'}`} />
                      <input type="text" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/\D/g,''))}
                        placeholder="e.g. 90210"
                        className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`} />
                    </div>
                    {zipCity && <p className="text-[10px] text-gold-400 mt-1">{zipCity}</p>}
                  </div>
                  <div>
                    <p className={`text-xs font-medium mb-1 ${textSub}`}>Sort By</p>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                      className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${inputCls}`}>
                      <option value="rating">Top Rated</option>
                      <option value="reviews">Most Reviews</option>
                      <option value="match">Best Budget Match</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 5. Spotlight */}
        {spotlightCreators.length > 0 && (
          <section className="mt-8 mb-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BadgeCheck size={15} className="text-gold-400" />
                  <h2 className={`font-display font-bold text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>
                    Recently verified creators
                  </h2>
                </div>
                <p className={`text-sm ${textSub}`}>A rotating look at fresh professional talent ready for real production work.</p>
              </div>
              <p className="text-gold-400 text-[10px] font-bold uppercase tracking-[0.2em]">Curated preview</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              {spotlightCreators.map(creator => (
                <CreatorCard key={creator.id} creator={creator} dark={dark} />
              ))}
            </div>
          </section>
        )}

        {/* Results count (logged-in only) */}
        {!isGuest && (
          <div className="flex items-center justify-between mt-2 mb-3">
            <p className={`text-xs ${textSub}`}>
              {filtered.length} creator{filtered.length !== 1 ? 's' : ''} found
              {budgetNum > 0 && ` matching ~$${budgetNum.toLocaleString()} budget`}
              {zipCity && ` near ${zipCity}`}
            </p>
          </div>
        )}

        {/* 6. Creator cards grid */}
        {displayListings.length > 0 ? (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {displayListings.map(creator => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                dark={dark}
                onViewProfile={isGuest && !creator.id?.startsWith('seed-') ? () => setShowGuestGate(true) : undefined}
                onDelete={!isGuest && !creator.id?.startsWith('seed-') ? () => handleDelete(creator.id) : undefined}
              />
            ))}
          </section>
        ) : (
          <div className={`border p-10 text-center ${dark ? 'border-charcoal-700 text-charcoal-500' : 'border-gray-200 text-gray-400'}`}>
            <p className="text-4xl mb-2">{searchQuery ? '🔍' : '🎬'}</p>
            <p className={`text-sm font-medium ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              No creators found for these filters.
            </p>
            <p className={`text-xs mt-1 ${textSub}`}>
              Try adjusting your search, service type, or budget range.
            </p>
          </div>
        )}

        {/* 7. CTA */}
        <div className={`mt-10 rounded-lg border p-7 sm:p-8 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                For working creators
              </p>
              <p className={`font-display text-2xl font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
                Bring your best work into a marketplace with standards.
              </p>
              <p className={`text-sm ${textSub} max-w-2xl`}>
                List focused services, show proof of experience, and meet clients who need professional media production.
              </p>
            </div>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center gap-2 justify-center"
            style={{ padding: '14px 24px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            <UserPlus size={14} /> Join as Creator
          </button>
          </div>
        </div>

      </div>

      {/* Guest gate modal */}
      {showGuestGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowGuestGate(false)} />
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

      {/* 8. Bottom value section */}
      <section
        className="mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12 py-14"
        style={{ borderTop: '1px solid rgba(212,169,65,0.14)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-8 lg:gap-12 items-start">
          <div>
            <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Why CreatorBridge
            </p>
            <h2
              className={`${dark ? 'text-white' : 'text-gray-950'} max-w-xl leading-tight`}
              style={{ fontFamily: "'Georgia','Times New Roman',serif", fontWeight: 400, fontSize: 'clamp(30px, 4vw, 58px)' }}
            >
              A more disciplined way to find creative production talent.
            </h2>
            <p className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} mt-5 max-w-lg text-sm leading-7`}>
              CreatorBridge gives clients a cleaner path to vetted media specialists while giving creators a platform that respects professional standards and protected payment structure.
            </p>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {VALUE_PILLARS.map(({ headline, desc }) => (
                <div key={headline} className={`rounded-lg border p-5 ${dark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-gray-200'}`}>
                  <div className="mb-5 h-px w-14 bg-gold-500/65" />
                  <p className={`${dark ? 'text-white' : 'text-gray-950'} text-sm font-bold leading-5`}>{headline}</p>
                  <p className={`${dark ? 'text-charcoal-300' : 'text-gray-600'} mt-3 text-xs leading-5`}>{desc}</p>
                </div>
              ))}
            </div>

            <div className={`rounded-lg border overflow-hidden ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
              <div className={`grid grid-cols-1 md:grid-cols-[1fr_0.8fr_0.9fr] gap-0 ${dark ? 'border-b border-gold-500/14' : 'border-b border-gray-200'}`}>
                <div className="p-5">
                  <p className="text-gold-400 mb-1" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                    Fee comparison
                  </p>
                  <p className={`${dark ? 'text-white' : 'text-gray-950'} text-lg font-display font-bold`}>
                    Built to cost less and feel more focused.
                  </p>
                </div>
                <div className="hidden md:flex items-end p-5">
                  <p className="text-gold-400 text-[10px] font-bold uppercase tracking-[0.18em]">CreatorBridge</p>
                </div>
                <div className="hidden md:flex items-end p-5">
                  <p className={`${dark ? 'text-charcoal-400' : 'text-gray-500'} text-[10px] font-bold uppercase tracking-[0.18em]`}>General marketplaces</p>
                </div>
              </div>

              {COMPARISON_ROWS.map(({ label, creatorbridge, alternative }) => (
                <div
                  key={label}
                  className={`grid grid-cols-1 md:grid-cols-[1fr_0.8fr_0.9fr] gap-2 md:gap-0 px-5 py-4 ${dark ? 'border-b border-white/[0.06]' : 'border-b border-gray-100'} last:border-b-0`}
                >
                  <p className={`${dark ? 'text-charcoal-200' : 'text-gray-700'} text-sm font-semibold`}>{label}</p>
                  <p className="text-gold-400 text-sm font-bold">{creatorbridge}</p>
                  <p className={`${dark ? 'text-charcoal-400' : 'text-gray-500'} text-sm`}>{alternative}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
