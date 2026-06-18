import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Eye, MessageSquare, Heart, Star, TrendingUp,
  Package, Edit3, ExternalLink, Check, Clock, ChevronRight,
  Plus, Trash2, AlertCircle, Bell, BarChart2, Calendar, DollarSign, BadgeCheck, Video, Link, Save, Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { SERVICES, normalizeServiceId } from '../data/rates.js';
import { PILLARS, LEGACY_SERVICE_TO_PILLAR, getPillar } from '../data/taxonomy.js';
import { PackageBuilder } from '../components/PackageBuilder.jsx';
import { AvailabilityEditor } from '../components/AvailabilityCalendar.jsx';
import { GoogleCalendarConnect } from '../components/GoogleCalendarConnect.jsx';
import { StripeOnboarding } from '../components/StripeOnboarding.jsx';
import { EarningsTab } from '../components/EarningsTab.jsx';
import { ViolationBanner, loadViolations } from '../components/ViolationBanner.jsx';
import { LoyaltyProgress } from '../components/LoyaltyBadge.jsx';
import { VerificationFlow } from '../components/VerificationFlow.jsx';
import { TierBadge, TierProgress, TierUpBanner } from '../components/TierBadge.jsx';
import { calculateTier } from '../config/tiers.js';
import { dollarsToDisplay, statusBadgeClass, PROJECT_STATUSES } from '../config/fees.js';
import { ReferralSection } from '../components/ReferralSection.jsx';
import { uploadVideoToBunny, isBunnyVideoRef } from '../utils/bunnyStream.js';
import { CreatorAvatar } from '../components/CreatorAvatar.jsx';

// ── Data helpers ────────────────────────────────────────────────
function loadMyListing(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
    return all.find(c => c.user_id === userId) || null;
  } catch { return null; }
}
function loadQuoteRequests(creatorId) {
  try {
    const all = JSON.parse(localStorage.getItem('quote-requests') || '[]');
    return all.filter(q => q.creatorId === creatorId || q.listing_id === creatorId).map(normalizeQuoteRequest);
  } catch { return []; }
}
function loadFavCount(creatorId) {
  try {
    const favs = JSON.parse(localStorage.getItem('creator-favorites') || '[]');
    return favs.filter(f => f === creatorId).length;
  } catch { return 0; }
}

function normalizeQuoteRequest(quote) {
  return {
    ...quote,
    id: quote.id,
    creatorId: quote.creatorId || quote.listing_id,
    clientName: quote.clientName || quote.client_name || 'Client',
    clientEmail: quote.clientEmail || quote.client_email || '',
    serviceId: normalizeServiceId(quote.serviceId || quote.service_id || quote.serviceType),
    projectTitle: quote.projectTitle || quote.project_title || 'Quote request',
    description: quote.description || '',
    budget: quote.budget,
    budgetRange: quote.budgetRange || quote.budget_range,
    preferredDate: quote.preferredDate || quote.projectDate || quote.timeline,
    createdAt: quote.createdAt || quote.created_at,
    read: quote.read ?? false,
  };
}

function normalizeCreatorListing(listing) {
  if (!listing) return listing;

  const services = Array.isArray(listing.creator_services)
    ? listing.creator_services.map(service => ({
        ...service,
        serviceId: service.serviceId || service.service_id,
        service_id: service.service_id || service.serviceId,
        subtypes: service.subtypes || [],
        description: service.description || '',
        rates: service.rates || {},
      }))
    : (listing.services || []);

  const portfolio = Array.isArray(listing.portfolio_items)
    ? [...listing.portfolio_items]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map(item => ({
          ...item,
          serviceId: item.serviceId || item.service_id,
          service_id: item.service_id || item.serviceId,
          imageUrl: item.imageUrl || item.image_url || '',
          image_url: item.image_url || item.imageUrl || '',
          mediaType: item.mediaType || item.media_type || (item.bunny_video_id ? 'video' : 'image'),
          media_type: item.media_type || item.mediaType || (item.bunny_video_id ? 'video' : 'image'),
          bunny_video_id: item.bunny_video_id || '',
          link: item.link || item.url || '',
          url: item.url || item.link || '',
        }))
    : (listing.portfolio || []);

  const packages = Array.isArray(listing.packages)
    ? [...listing.packages].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  return {
    ...listing,
    services,
    portfolio,
    packages,
    video_intro_url: listing.video_intro_url || listing.videoIntroUrl || '',
  };
}

function getPrimaryPillarName(value) {
  if (PILLARS[value]) return PILLARS[value].name;
  const pillarId = LEGACY_SERVICE_TO_PILLAR[normalizeServiceId(value)]?.pillar;
  return getPillar(pillarId)?.name || 'Video Production';
}

// ── Creator fee tiers ────────────────────────────────────────────
const CREATOR_TIERS = [
  {
    id: 'launch', label: 'Launch', icon: '🚀',
    color: 'text-charcoal-300', borderColor: 'border-white/[0.09]', bgColor: 'bg-charcoal-900/72',
    feePercent: 10, requirement: 0, description: 'New creators. 10% platform fee.',
  },
  {
    id: 'proven', label: 'Proven', icon: '⭐',
    color: 'text-gold-400', borderColor: 'border-gold-500/50', bgColor: 'bg-gold-500/10',
    feePercent: 8, requirement: 10, description: '10+ completed projects. Fee drops to 8%.',
  },
  {
    id: 'elite', label: 'Elite', icon: '💎',
    color: 'text-gold-400', borderColor: 'border-gold-500/50', bgColor: 'bg-gold-500/10',
    feePercent: 6, requirement: 25, description: '25+ completed projects. Fee drops to 6%.',
  },
  {
    id: 'signature', label: 'Signature', icon: '👑',
    color: 'text-gold-300', borderColor: 'border-gold-500/45', bgColor: 'bg-gold-500/10',
    feePercent: 5, requirement: 50, description: '50+ completed projects. Top tier, 5% fee.',
  },
];

function getCreatorTier(completedProjects) {
  const count = completedProjects || 0;
  if (count >= 50) return CREATOR_TIERS[3];
  if (count >= 25) return CREATOR_TIERS[2];
  if (count >= 10) return CREATOR_TIERS[1];
  return CREATOR_TIERS[0];
}

// ── Stat Card ───────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-gold-400', dark }) {
  return (
    <div className={`rounded-lg border p-4 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={color} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{label}</span>
      </div>
      <p className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}

// ── Quote request row ───────────────────────────────────────────
function QuoteRow({ quote, dark, onMarkRead }) {
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const normalized = normalizeQuoteRequest(quote);
  const svc = SERVICES[normalized.serviceId];
  const pillarName = getPrimaryPillarName(normalized.serviceId);
  const date = normalized.preferredDate
    ? new Date(normalized.preferredDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const budgetLabel = normalized.budgetRange || (normalized.budget ? `$${Number(normalized.budget).toLocaleString()}` : '');

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      !normalized.read
        ? dark ? 'border-gold-500/40 bg-gold-500/5' : 'border-gold-400/40 bg-gold-50'
        : dark ? 'border-white/[0.07] bg-charcoal-900/30' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${dark ? 'bg-white/[0.08]' : 'bg-gray-200'}`}>
        {svc?.icon || '📝'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{normalized.clientName}</p>
          {!normalized.read && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />}
          <span className={`text-xs ${textSub}`}>{pillarName}</span>
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${textSub}`}>{normalized.description}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {budgetLabel && (
            <span className="text-[11px] font-semibold text-gold-400">Budget: {budgetLabel}</span>
          )}
          {date && (
            <span className={`text-[11px] flex items-center gap-1 ${textSub}`}>
              <Calendar size={9} /> {date}
            </span>
          )}
          <span className={`text-[11px] ${textSub}`}>{normalized.clientEmail}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-[10px] ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
          {normalized.createdAt ? new Date(normalized.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
        {!normalized.read && (
          <button type="button" onClick={() => onMarkRead(normalized.id)}
            className="text-[10px] text-gold-400 hover:text-gold-300 transition-colors font-medium">
            Mark read
          </button>
        )}
        <a href={`mailto:${normalized.clientEmail}`}
          className="text-[10px] text-gold-400 hover:text-gold-300 transition-colors font-medium">
          Reply
        </a>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────
export function CreatorDashboard({ dark }) {
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [creator, setCreator]       = useState(null);
  const [quotes, setQuotes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('overview');
  const [violations, setViolations] = useState([]);
  const [tierUpBanner, setTierUpBanner] = useState(null);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  // Handle Stripe return from onboarding
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (stripeParam === 'success') setActiveTab('overview');
    if (stripeParam === 'refresh') setActiveTab('overview');
  }, [searchParams]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('creator_listings')
        .select('*, creator_services(*), portfolio_items(*), packages(*)')
        .eq('user_id', user.id)
        .order('review_status', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const normalizedCreator = normalizeCreatorListing(data);
        setCreator(normalizedCreator);
        const { data: qData } = await supabase
          .from('quote_requests')
          .select('*')
          .eq('listing_id', data.id)
          .order('created_at', { ascending: false });
        setQuotes((qData || []).map(normalizeQuoteRequest));
      } else {
        const found = loadMyListing(user.id);
        setCreator(normalizeCreatorListing(found));
        if (found) setQuotes(loadQuoteRequests(found.id));
      }
    } else {
      const found = loadMyListing(user.id);
      setCreator(normalizeCreatorListing(found));
      if (found) setQuotes(loadQuoteRequests(found.id));
    }
    // Load violation status
    loadViolations(user.id, supabase, supabaseConfigured).then(setViolations);
    setLoading(false);
  }

  async function markRead(quoteId) {
    const updated = quotes.map(q => q.id === quoteId ? { ...q, read: true } : q);
    setQuotes(updated);
    if (supabaseConfigured && quoteId) {
      const { error } = await supabase.rpc('mark_quote_request_read', { p_quote_id: quoteId });
      if (error) {
        setQuotes(quotes);
        return;
      }
    }
    // Persist to localStorage
    try {
      const all = JSON.parse(localStorage.getItem('quote-requests') || '[]');
      const patched = all.map(q => q.id === quoteId ? { ...q, read: true } : q);
      localStorage.setItem('quote-requests', JSON.stringify(patched));
    } catch {}
  }

  // Stats
  const unreadCount  = quotes.filter(q => !q.read).length;
  const favCount     = creator ? loadFavCount(creator.id) : 0;
  const viewCount    = creator?.view_count || 0;
  const avgRating    = creator?.rating || 0;

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
        <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <LayoutDashboard size={40} className="text-gold-400" />
        <h2 className="font-display text-xl font-bold">Sign in to access your Dashboard</h2>
        <p className={`text-sm ${textSub}`}>You need to be logged in to manage your creator profile.</p>
        <button type="button" onClick={() => navigate('/find')}
          className="px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">
          Go Home
        </button>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <Package size={40} className="text-gold-400" />
        <h2 className="font-display text-xl font-bold">No Listing Found</h2>
        <p className={`text-sm ${textSub} text-center max-w-xs`}>
          You haven't created a creator listing yet. Join as a creator to start receiving quote requests.
        </p>
        <button type="button" onClick={() => navigate('/register')}
          className="px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm flex items-center gap-2">
          <Plus size={14} /> Create Your Listing
        </button>
        <button type="button" onClick={() => navigate('/client')}
          className={`px-5 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 ${dark ? 'border-gold-500/25 text-charcoal-200 hover:text-white hover:border-gold-500/45' : 'border-gray-200 text-gray-700 hover:text-gray-900'}`}>
          Open Client Profile
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview',      label: 'Overview',     icon: BarChart2 },
    { id: 'quotes',        label: `Quotes${unreadCount ? ` (${unreadCount})` : ''}`, icon: MessageSquare },
    { id: 'packages',      label: 'Packages',     icon: Package },
    { id: 'availability',  label: 'Availability', icon: Calendar },
    { id: 'earnings',      label: 'Earnings',     icon: DollarSign },
    { id: 'referral',      label: 'Referrals',    icon: Link },
    { id: 'verification',  label: 'Verification', icon: BadgeCheck },
    { id: 'video',         label: 'Video Intro',  icon: Video },
  ];

  const serviceIds = (creator.services || []).map(s => s.serviceId || s.service_id).filter(Boolean);
  const dashboardVisual = '/images/creatorbridge/backgrounds/02-pillars/pillar-video-arri-autumn.jpg';
  const productionMathVisual = '/images/creatorbridge/backgrounds/08-sitewide/bg-audio-workstation.jpg';

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className="mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12 py-6">

        {/* Header */}
        <div className={`relative overflow-hidden rounded-lg border p-6 sm:p-7 mb-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}
          style={{ boxShadow: dark ? '0 28px 90px rgba(0,0,0,0.22)' : '0 22px 70px rgba(0,0,0,0.08)' }}>
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,169,65,0.85), transparent)' }}
          />
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl overflow-hidden border flex items-center justify-center text-3xl ${dark ? 'bg-white/[0.035] border-gold-500/20' : 'bg-white border-gray-200'}`}>
              <CreatorAvatar src={creator.avatar} alt={creator.businessName || creator.name || 'Creator'} />
            </div>
            <div>
              <p className="text-gold-400 mb-1" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                Creator operations
              </p>
              <h1 className={`font-display font-bold text-3xl tracking-tight ${dark ? 'text-white' : 'text-gray-950'}`}>
                {creator.businessName || creator.name}
              </h1>
              <p className={`text-sm mt-1 ${textSub}`}>Manage your profile, quote requests, bookings, and creator growth.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500/15 text-gold-400 text-xs font-bold">
                <Bell size={12} /> {unreadCount} new {unreadCount === 1 ? 'request' : 'requests'}
              </span>
            )}
            <button type="button" onClick={() => navigate(`/creator/${creator.id}`)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                dark ? 'border-gold-500/20 text-charcoal-300 hover:border-gold-500/40 hover:text-white hover:bg-white/[0.035]' : 'border-gray-200 text-gray-600 hover:text-gray-900'
              }`}>
              <ExternalLink size={12} /> View Profile
            </button>
            <button type="button" onClick={() => navigate('/register')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all">
              <Edit3 size={12} /> Edit Listing
            </button>
          </div>
          </div>
        </div>

        <section className="mb-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-gold-500/18 bg-charcoal-950/72">
            <img src={dashboardVisual} alt="" className="absolute inset-0 h-full w-full object-cover opacity-72" onError={(e)=>{ if(!e.currentTarget.dataset.fb){ e.currentTarget.dataset.fb='1'; e.currentTarget.src='/images/creatorbridge/backgrounds/09-fallback/fallback-default-cover.jpg'; } }}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/22 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="font-display text-2xl font-bold text-white">Creator identity</h2>
              <p className="mt-2 text-sm leading-6 text-charcoal-200">Profile, proof, packages, availability, and intro video stay tied to one professional listing.</p>
            </div>
          </div>
          <div className={`rounded-2xl border p-5 ${dark ? 'border-white/[0.08] bg-charcoal-900/72' : 'border-gray-200 bg-white'}`}>
            <p className="mb-3 text-gold-400" style={{ fontSize: '10px', letterSpacing: '2.6px', textTransform: 'uppercase' }}>
              Studio Desk OS
            </p>
            <h2 className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Build rates with professional confidence.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                ['Profile', `${creator.portfolio?.length || 0} samples`],
                ['Requests', `${quotes.length} total`],
                ['Views', viewCount || 0],
                ['Tier', getCreatorTier(creator.completedProjects || creator.completed_projects || 0).label],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.07] bg-charcoal-950/54' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{label}</p>
                  <p className="mt-2 text-xl font-black text-gold-400">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-gold-500/18 bg-charcoal-950/72">
            <img src={productionMathVisual} alt="" className="absolute inset-0 h-full w-full object-cover opacity-68" onError={(e)=>{ if(!e.currentTarget.dataset.fb){ e.currentTarget.dataset.fb='1'; e.currentTarget.src='/images/creatorbridge/backgrounds/09-fallback/fallback-default-cover.jpg'; } }}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/22 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="font-display text-2xl font-bold text-white">Production math</h2>
              <p className="mt-2 text-sm leading-6 text-charcoal-200">Rates, costs, margins, quote requests, and delivery terms stay visible.</p>
            </div>
          </div>
        </section>

        {/* Tab bar */}
        <div className={`flex gap-1.5 p-1.5 rounded-2xl border mb-6 w-full overflow-x-auto no-scrollbar ${dark ? 'bg-charcoal-950/72 border-gold-500/14' : 'bg-gray-100 border-gray-200'}`}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gold-500 text-charcoal-900 shadow-[0_8px_24px_rgba(212,169,65,0.14)]'
                  : dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.035]' : 'text-gray-500 hover:text-gray-900'
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tier Up Banner ── */}
        {tierUpBanner && (
          <TierUpBanner newTierId={tierUpBanner} dark={dark} onDismiss={() => setTierUpBanner(null)} />
        )}

        {/* ── Violation Banner ── */}
        <ViolationBanner violations={violations} dark={dark} />

        {/* ── Stripe Onboarding Banner ── */}
        <div className="mb-5">
          <StripeOnboarding
            creator={creator}
            dark={dark}
            onStatusChange={(update) => setCreator(prev => ({ ...prev, ...update }))}
          />
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Profile identity message */}
            <div className={`rounded-lg border px-4 py-3 text-sm ${dark ? 'border-gold-500/20 bg-gold-500/10 text-charcoal-200' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
              Your CreatorBridge profile is your professional identity on the platform. Keep it focused and up to date.
            </div>

            {/* 90-day profile lock notice */}
            {(creator.submitted_at ||
              ['verified', 'pro_verified', 'pending'].includes(creator.verification_status)) && (
              <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-lg shrink-0">🔒</span>
                  <div>
                    <p className="text-sm font-bold text-gold-400 mb-1">Profile Locked for 90 Days</p>
                    <p className="text-xs text-charcoal-300 leading-relaxed">
                      Your profile information is locked for 90 days from your submission date. This protects the integrity of creator profiles on CreatorBridge. If you need to make a correction, email support at drl33@creatorbridge.studio with the subject line "Profile Correction Request".
                    </p>
                  </div>
                </div>
                {/* Read-only profile summary */}
                <div className={`rounded-lg border p-4 ${dark ? 'bg-charcoal-950/70 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>Submitted Profile Summary</p>
                  <div className="space-y-0">
                    {[
                      { label: 'Business Name', value: creator.businessName || creator.business_name || creator.name || '—' },
                      {
                        label: 'Primary Pillar',
                        value: (() => {
                          const pillarId = creator.primary_pillar;
                          const svcId = creator.services?.[0]?.serviceId || creator.services?.[0]?.service_id;
                          return getPrimaryPillarName(pillarId || svcId);
                        })(),
                      },
                      {
                        label: 'Bio',
                        value: creator.bio
                          ? creator.bio.length > 120 ? creator.bio.slice(0, 120) + '…' : creator.bio
                          : '—',
                      },
                      ...(creator.video_intro_url || creator.videoIntroUrl
                        ? [{ label: 'Video Intro', value: creator.video_intro_url || creator.videoIntroUrl }]
                        : []),
                      { label: 'Portfolio Items', value: `${creator.portfolio?.length || 0} item${(creator.portfolio?.length || 0) !== 1 ? 's' : ''}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-charcoal-800 last:border-0">
                        <span className="text-xs text-charcoal-300 shrink-0 w-32">{label}</span>
                        <span className="text-xs text-charcoal-300 text-right break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Creator fee tier badge */}
            {(() => {
              const completedCount = creator.completedProjects || creator.completed_projects || 0;
              const currentTier = getCreatorTier(completedCount);
              const nextTier = CREATOR_TIERS[CREATOR_TIERS.indexOf(currentTier) + 1] || null;
              const progressToNext = nextTier
                ? Math.min((completedCount / nextTier.requirement) * 100, 100)
                : 100;
              return (
                <div className={`rounded-lg border p-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{currentTier.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gold-400">{currentTier.label} Creator</p>
                        <p className="text-xs text-charcoal-300">{currentTier.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gold-400">{currentTier.feePercent}%</p>
                      <p className="text-xs text-charcoal-300">platform fee</p>
                    </div>
                  </div>
                  {nextTier && (
                    <div>
                      <div className="flex justify-between text-xs text-charcoal-300 mb-1">
                        <span>{completedCount} projects completed</span>
                        <span>{nextTier.requirement - completedCount} more to reach {nextTier.label}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.08]">
                        <div className="h-1.5 rounded-full bg-gold-500 transition-all" style={{ width: `${progressToNext}%` }} />
                      </div>
                    </div>
                  )}
                  {!nextTier && (
                    <p className="text-xs text-charcoal-300">You have reached the highest creator tier.</p>
                  )}
                </div>
              );
            })()}

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Eye}          label="Profile Views"   value={viewCount || '-'}  sub="All time"              color="text-gold-400"   dark={dark} />
              <StatCard icon={MessageSquare} label="Quote Requests"  value={quotes.length}      sub={`${unreadCount} unread`} color="text-gold-400"   dark={dark} />
              <StatCard icon={Heart}         label="Saved by Clients" value={favCount || '-'}  sub="In shortlists"          color="text-gold-400"    dark={dark} />
              <StatCard icon={Star}          label="Avg Rating"      value={avgRating || '-'}   sub={`${creator.review_count || 0} reviews`} color="text-gold-400" dark={dark} />
            </div>

            {/* Tier progress */}
            <TierProgress creator={creator} dark={dark} />

            {/* Loyalty progress */}
            <LoyaltyProgress completedProjects={creator.completed_projects || 0} dark={dark} />

            {/* Profile completion */}
            <ProfileCompletion creator={creator} dark={dark} navigate={navigate} />

            {/* Recent quote requests */}
            <div className={`rounded-lg border p-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Recent Quote Requests
                </h2>
                {quotes.length > 3 && (
                  <button type="button" onClick={() => setActiveTab('quotes')}
                    className={`text-xs font-medium flex items-center gap-1 ${dark ? 'text-gold-400' : 'text-gold-600'}`}>
                    View all <ChevronRight size={12} />
                  </button>
                )}
              </div>
              {quotes.length === 0 ? (
                <div className={`text-center py-8 ${textSub}`}>
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No quote requests yet.</p>
                  <p className="text-xs mt-1 opacity-70">Share your profile to start getting inquiries.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {quotes.slice(0, 3).map(q => (
                    <QuoteRow key={q.id} quote={q} dark={dark} onMarkRead={markRead} />
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className={`rounded-lg border p-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
              <h2 className={`font-display font-bold text-base mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Package,  label: 'Manage Packages',   sub: 'Edit your Basic/Standard/Premium tiers',  tab: 'packages'     },
                  { icon: Calendar, label: 'Set Availability',  sub: 'Mark days you are available for bookings', tab: 'availability' },
                  { icon: Edit3,    label: 'Edit Listing',      sub: 'Update bio, primary pillar, portfolio',    path: '/register'   },
                  { icon: ExternalLink, label: 'View Public Profile', sub: 'See how clients see you',            profile: true       },
                ].map(({ icon: Icon, label, sub, tab, path, profile: isProfile }) => (
                  <button key={label} type="button"
                    onClick={() => tab ? setActiveTab(tab) : isProfile ? navigate(`/creator/${creator.id}`) : navigate(path)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      dark ? 'border-white/[0.07] hover:border-gold-500/28 bg-white/[0.025]' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}>
                    <Icon size={16} className="text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                      <p className={`text-xs mt-0.5 ${textSub}`}>{sub}</p>
                    </div>
                    <ChevronRight size={14} className={`${textSub} ml-auto shrink-0 mt-0.5`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Quotes Tab ── */}
        {activeTab === 'quotes' && (
          <div className={`rounded-lg border p-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
                All Quote Requests
              </h2>
              <span className={`text-xs px-2 py-1 rounded-full ${dark ? 'bg-white/[0.08] text-charcoal-300' : 'bg-gray-100 text-gray-500'}`}>
                {quotes.length} total
              </span>
            </div>
            {quotes.length === 0 ? (
              <div className={`text-center py-12 ${textSub}`}>
                <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No quote requests yet</p>
                <p className="text-xs mt-1 opacity-70">Share your profile link to start receiving inquiries</p>
                <button type="button"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/creator/${creator.id}`); }}
                  className="mt-4 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all">
                  Copy Profile Link
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map(q => <QuoteRow key={q.id} quote={q} dark={dark} onMarkRead={markRead} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Packages Tab ── */}
        {activeTab === 'packages' && (
          <PackageBuilder
            creatorId={creator.id}
            dark={dark}
            serviceIds={serviceIds.length > 0 ? serviceIds : ['photography']}
          />
        )}

        {/* ── Availability Tab ── */}
        {activeTab === 'availability' && (
          <div className="space-y-4">
            <GoogleCalendarConnect
              creatorId={creator.id}
              dark={dark}
              onSync={() => setAvailabilityRefreshKey(key => key + 1)}
            />
            <AvailabilityEditor key={`${creator.id}-${availabilityRefreshKey}`} creatorId={creator.id} dark={dark} />
          </div>
        )}

        {/* ── Earnings Tab ── */}
        {activeTab === 'earnings' && (
          <EarningsTab creator={creator} dark={dark} />
        )}

        {/* ── Referral Tab ── */}
        {activeTab === 'referral' && (
          <ReferralSection dark={dark} userType="creator" />
        )}

        {/* ── Verification Tab ── */}
        {activeTab === 'verification' && (
          <VerificationFlow
            creator={creator}
            dark={dark}
            onUpdate={(update) => setCreator(prev => ({ ...prev, ...update }))}
          />
        )}

        {/* ── Video Intro Tab ── */}
        {activeTab === 'video' && (
          <VideoIntroTab creator={creator} dark={dark} onUpdate={(update) => setCreator(prev => ({ ...prev, ...update }))} />
        )}

      </div>
    </div>
  );
}

// ── Profile Completion widget ───────────────────────────────────
function ProfileCompletion({ creator, dark, navigate }) {
  const checks = [
    { label: 'Profile photo / avatar',      done: !!creator.avatar },
    { label: 'Bio written',                  done: !!(creator.bio?.length > 20) },
    { label: 'Primary pillar selected',       done: !!(creator.primary_pillar || creator.services?.length) },
    { label: 'Intro video uploaded',         done: String(creator.video_intro_url || creator.videoIntroUrl || '').startsWith('bunny:') },
    { label: 'Portfolio media added',        done: (creator.portfolio || []).some(item => item.bunny_video_id || item.imageUrl || item.image_url) },
    { label: 'Availability set',             done: false }, // would need to check localStorage
  ];
  const score = checks.filter(c => c.done).length;
  const pct   = Math.round((score / checks.length) * 100);
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-lg border p-5 ${dark ? 'bg-charcoal-950/80 border-gold-500/20' : 'bg-white border-gray-200'}`;

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
          Profile Strength
        </h2>
        <span className="text-sm font-bold text-gold-400">
          {pct}%
        </span>
      </div>
      {/* Progress bar */}
      <div className={`h-2 rounded-full mb-4 ${dark ? 'bg-white/[0.08]' : 'bg-gray-200'}`}>
        <div
          className="h-2 rounded-full bg-gold-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {checks.map(({ label, done }) => (
          <div key={label} className={`flex items-center gap-2 text-xs ${done ? (dark ? 'text-charcoal-300' : 'text-gray-600') : textSub}`}>
            {done
              ? <Check size={12} className="text-gold-400 shrink-0" />
              : <AlertCircle size={12} className="text-charcoal-600 shrink-0" />
            }
            <span className={done ? '' : 'opacity-60'}>{label}</span>
          </div>
        ))}
      </div>
      {pct < 100 && (
        <button type="button" onClick={() => navigate('/register')}
          className="mt-4 w-full py-2 rounded-xl border-2 border-dashed text-xs font-semibold transition-all border-gold-500/40 text-gold-400 hover:border-gold-500 hover:bg-gold-500/10">
          Complete Your Profile
        </button>
      )}
    </div>
  );
}

// ── Video Intro Tab ──────────────────────────────────────────────
function VideoIntroTab({ creator, dark, onUpdate }) {
  const [videoRef, setVideoRef] = useState(creator.video_intro_url || '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadState, setUploadState] = useState('');
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls  = `rounded-2xl border p-5 ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  async function handleUpload(file) {
    if (!file) return;
    setError('');
    setSaved(false);
    setUploadState('Uploading intro video...');
    try {
      const uploaded = await uploadVideoToBunny({
        file,
        purpose: 'intro',
        title: `${creator?.business_name || creator?.businessName || creator?.name || 'Creator'} intro`,
        onProgress: pct => setUploadState(`Uploading intro video... ${pct}%`),
      });
      setVideoRef(uploaded.videoRef);
      setPreviewUrl(uploaded.embedUrl || '');
      setUploadState('Intro video uploaded. Save it to attach it to your profile.');
    } catch (uploadError) {
      setUploadState('');
      setError(uploadError?.message || 'Could not upload this intro video.');
    }
  }

  async function handleSave() {
    setError('');
    const finalUrl = videoRef.trim();
    if (!isBunnyVideoRef(finalUrl)) {
      setError('Upload a CreatorBridge intro video before saving.');
      return;
    }
    setSaving(true);
    if (supabaseConfigured && creator?.id) {
      const { error: saveError } = await supabase
        .from('creator_listings')
        .update({ video_intro_url: finalUrl })
        .eq('id', creator.id);
      if (saveError) {
        setSaving(false);
        setError('Could not save this video intro. Try again.');
        return;
      }
    }
    // Persist to localStorage
    try {
      const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
      const updated = all.map(c =>
        (c.id === creator.id || c.user_id === creator.user_id)
          ? { ...c, video_intro_url: finalUrl }
          : c
      );
      localStorage.setItem('creator-directory', JSON.stringify(updated));
    } catch {}
    onUpdate?.({ video_intro_url: finalUrl });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-1">
          <Video size={16} className="text-gold-400" />
          <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Video Introduction</h2>
        </div>
        <p className={`text-xs mb-5 ${textSub}`}>
          Upload a required 60 second intro through CreatorBridge. Bunny Stream handles playback; outside video links are not shown on public profiles.
        </p>

        <div className="mb-4">
          <label className={`text-xs font-medium block mb-1.5 ${textSub}`}>
            <Upload size={11} className="inline -mt-0.5 mr-0.5" /> Intro video
          </label>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={e => handleUpload(e.target.files?.[0])}
            className={`block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-xs file:font-bold file:bg-gold-500 file:text-charcoal-900 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          {uploadState && (
            <p className={`text-xs mt-1 ${uploadState.includes('uploaded') ? 'text-gold-400' : 'text-charcoal-300'}`}>{uploadState}</p>
          )}
          {isBunnyVideoRef(videoRef) && !error && (
            <p className="text-xs mt-1 text-gold-400">CreatorBridge intro video attached.</p>
          )}
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="mb-4">
            <p className={`text-xs font-medium mb-2 ${textSub}`}>Preview</p>
            <div className="rounded-xl overflow-hidden aspect-video bg-black">
              <iframe
                src={previewUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                title="Video intro preview"
              />
            </div>
          </div>
        )}

        <button type="button" onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            saved ? 'bg-gold-500 text-charcoal-900' : 'bg-gold-500 hover:bg-gold-600 text-charcoal-900 disabled:opacity-60 disabled:cursor-not-allowed'
          }`}>
          <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Video Intro'}
        </button>
      </div>

      <div className={`${cardCls} ${dark ? 'bg-charcoal-900/50' : 'bg-gray-50'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>Tips for a great intro</p>
        <ul className={`space-y-1.5 text-xs ${textSub}`}>
          {[
            'Keep it around 60 seconds - clients watch short intros more often',
            'Introduce yourself, your specialty, and your style',
            'Show examples of your work or a behind-the-scenes clip',
            'Record in a well-lit space with good audio',
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2">
              <span className="text-gold-400 mt-0.5">•</span> {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
