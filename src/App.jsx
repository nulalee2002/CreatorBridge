import { lazy, Suspense, useReducer, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { formatCurrency } from './utils/pricing.js';
import { Moon, Sun, Zap, RotateCcw, Search, UserPlus, LogIn, LogOut, User, MessageSquare, Briefcase, LayoutDashboard, Users } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAuth } from './contexts/AuthContext.jsx';
import { AuthModal } from './components/auth/AuthModal.jsx';
import { SupportTicketForm } from './components/SupportTicketForm.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { TermsModal } from './components/TermsModal.jsx';
import { PrivacyModal } from './components/PrivacyModal.jsx';
import { captureReferralCode } from './components/ReferralSection.jsx';
import { SupportChatbot } from './components/SupportChatbot.jsx';
import { HandoffPage } from './components/HandoffPage.jsx';
import { handoffPages } from './data/handoffPages.js';
import { NotificationBell } from './components/NotificationBell.jsx';

import { SERVICES, RATES, PACKAGE_TIERS } from './data/rates.js';
import { DEFAULT_EXCHANGE_RATES } from './data/regions.js';
import { getRegionRates, buildQuote, getRate } from './utils/pricing.js';

import { CreatorDirectory }    from './components/CreatorDirectory.jsx';

const StateCitySelector = lazy(() => import('./components/StateCitySelector.jsx').then(m => ({ default: m.StateCitySelector })));
const ServiceSelector = lazy(() => import('./components/ServiceSelector.jsx').then(m => ({ default: m.ServiceSelector })));
const LineItemBuilder = lazy(() => import('./components/LineItemBuilder.jsx').then(m => ({ default: m.LineItemBuilder })));
const QuoteOutput = lazy(() => import('./components/QuoteOutput.jsx').then(m => ({ default: m.QuoteOutput })));
const RateComparisonChart = lazy(() => import('./components/RateComparisonChart.jsx').then(m => ({ default: m.RateComparisonChart })));
const HealthWidget = lazy(() => import('./components/HealthWidget.jsx').then(m => ({ default: m.HealthWidget })));
const PackageComparison = lazy(() => import('./components/PackageComparison.jsx').then(m => ({ default: m.PackageComparison })));
const SeasonalDemand = lazy(() => import('./components/SeasonalDemand.jsx').then(m => ({ default: m.SeasonalDemand })));
const PresetManager = lazy(() => import('./components/PresetManager.jsx').then(m => ({ default: m.PresetManager })));
const ProfileSettings = lazy(() => import('./components/ProfileSettings.jsx').then(m => ({ default: m.ProfileSettings })));
const CreatorProfilePage = lazy(() => import('./pages/CreatorProfilePage.jsx').then(m => ({ default: m.CreatorProfilePage })));
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard.jsx').then(m => ({ default: m.CreatorDashboard })));
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx').then(m => ({ default: m.MessagesPage })));
const ProjectBoard = lazy(() => import('./pages/ProjectBoard.jsx').then(m => ({ default: m.ProjectBoard })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx').then(m => ({ default: m.CheckoutPage })));
const MatchResultsPage = lazy(() => import('./pages/MatchResultsPage.jsx').then(m => ({ default: m.MatchResultsPage })));
const NetworkingPage = lazy(() => import('./pages/NetworkingPage.jsx').then(m => ({ default: m.NetworkingPage })));
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage.jsx').then(m => ({ default: m.ClientProfilePage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx').then(m => ({ default: m.AdminDashboard })));
const AdminSupport     = lazy(() => import('./pages/AdminSupport.jsx').then(m => ({ default: m.AdminSupport })));
const AdminOperations  = lazy(() => import('./pages/AdminOperations.jsx').then(m => ({ default: m.AdminOperations })));
const AdminFinance     = lazy(() => import('./pages/AdminFinance.jsx').then(m => ({ default: m.AdminFinance })));
const AdminAnalytics   = lazy(() => import('./pages/AdminAnalytics.jsx').then(m => ({ default: m.AdminAnalytics })));
const SearchPage       = lazy(() => import('./pages/Search.jsx').then(m => ({ default: m.Search })));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx').then(m => ({ default: m.TermsPage })));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx').then(m => ({ default: m.TermsOfService })));
const CreatorAgreement = lazy(() => import('./pages/CreatorAgreement.jsx').then(m => ({ default: m.CreatorAgreement })));
const DisputePolicy = lazy(() => import('./pages/DisputePolicy.jsx').then(m => ({ default: m.DisputePolicy })));
const JoinAsCreator = lazy(() => import('./pages/JoinAsCreator.jsx').then(m => ({ default: m.JoinAsCreator })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx').then(m => ({ default: m.ResetPasswordPage })));
const QuickQuoteMode = lazy(() => import('./components/QuickQuoteMode.jsx').then(m => ({ default: m.QuickQuoteMode })));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx').then(m => ({ default: m.LandingPage })));

function RouteLoading({ dark }) {
  return (
    <main className="min-h-[55vh] grid place-items-center px-6">
      <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
        dark ? 'bg-charcoal-900/72 border-gold-500/18 text-charcoal-200' : 'bg-white border-gray-200 text-gray-700'
      }`}>
        Loading CreatorBridge...
      </div>
    </main>
  );
}

function LazyRoute({ dark, children }) {
  return <Suspense fallback={<RouteLoading dark={dark} />}>{children}</Suspense>;
}

function CreatorBridgeChromeEffects() {
  const ringRef = useRef(null);
  const dotRef = useRef(null);
  const glowRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    const glow = glowRef.current;
    const progress = progressRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 768;

    if (!ring || !dot || isMobile || reducedMotion) {
      if (!progress) return undefined;
      const handleProgressOnly = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      };
      window.addEventListener('scroll', handleProgressOnly, { passive: true });
      handleProgressOnly();
      return () => window.removeEventListener('scroll', handleProgressOnly);
    }

    ring.style.display = 'block';
    dot.style.display = 'block';

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let glowX = mouseX;
    let glowY = mouseY;
    let frameId = 0;

    const markHoverTargets = () => {
      const targets = document.querySelectorAll('a, button, input, textarea, select, [role="button"], .liquid-glass, .lane-card, .pillar-card');
      const addHover = () => ring.classList.add('hover');
      const removeHover = () => ring.classList.remove('hover');
      targets.forEach(target => {
        target.addEventListener('mouseenter', addHover);
        target.addEventListener('mouseleave', removeHover);
      });
      return () => {
        targets.forEach(target => {
          target.removeEventListener('mouseenter', addHover);
          target.removeEventListener('mouseleave', removeHover);
        });
      };
    };

    let cleanupHoverTargets = markHoverTargets();
    const observer = new MutationObserver(() => {
      cleanupHoverTargets?.();
      cleanupHoverTargets = markHoverTargets();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleMouseMove = event => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      document.body.classList.add('mouse-active');
      document.body.style.setProperty('--mx', `${(mouseX / window.innerWidth) * 100}%`);
      document.body.style.setProperty('--my', `${(mouseY / window.innerHeight) * 100}%`);
    };

    const handleMouseLeave = () => {
      document.body.classList.remove('mouse-active');
      ring.classList.remove('hover');
    };

    const handleScroll = () => {
      if (!progress) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };

    const tick = () => {
      ringX += (mouseX - ringX) * 0.38;
      ringY += (mouseY - ringY) * 0.38;
      glowX += (mouseX - glowX) * 0.28;
      glowY += (mouseY - glowY) * 0.28;

      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      if (glow) {
        glow.style.left = `${glowX}px`;
        glow.style.top = `${glowY}px`;
      }
      frameId = requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      cleanupHoverTargets?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      document.body.classList.remove('mouse-active');
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} />
      <div className="cursor-ring" ref={ringRef} style={{ display: 'none' }} />
      <div className="cursor-dot" ref={dotRef} style={{ display: 'none' }} />
      <div className="mouse-glow" ref={glowRef} />
    </>
  );
}

function AuthRequired({ dark, user, loading, role = 'client', title, copy, children }) {
  if (loading) return <RouteLoading dark={dark} />;
  if (user) return children;

  return (
    <main className="min-h-[62vh] grid place-items-center px-5 py-14">
      <section className={`w-full max-w-xl rounded-[28px] border p-7 text-center ${
        dark ? 'bg-charcoal-900/76 border-gold-500/18 shadow-[0_30px_100px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Account required
        </p>
        <h1 className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h1>
        <p className={`mx-auto mt-3 max-w-md text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
          {copy}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login', role } }))}
            className="rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-charcoal-900 transition-colors hover:bg-gold-600"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'signup', role } }))}
            className={`rounded-xl border px-5 py-3 text-sm font-bold transition-colors ${
              dark ? 'border-white/[0.09] text-charcoal-200 hover:text-white hover:border-gold-500/35' : 'border-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            Create Account
          </button>
        </div>
      </section>
    </main>
  );
}

// ── Initial State ────────────────────────────────────────────
const DEFAULT_STATE = {
  serviceId:              null,
  regionKey:              'us-tier1',
  experienceLevel:        'mid',
  lineItems:              [],
  equipment:              [],
  travelType:             'none',
  travelMiles:            0,
  travelMileRate:         0.67,
  travelFee:              0,
  assistants:             0,
  assistantRate:          0,
  locationFee:            0,
  revisions:              2,
  additionalRevisionRate: 0,
  turnaround:             'standard',
  customTurnaroundPct:    25,
  licensingId:            'personal',
  taxEnabled:             false,
  taxRate:                8.5,
  currency:               'USD',
  exchangeRates:          DEFAULT_EXCHANGE_RATES,
  notes:                  '',
  clientName:             '',
  quoteNumber:            '',
  costInputs:             [],
};

// ── Reducer ───────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'SET_SERVICE': {
      if (action.value === state.serviceId) return state;
      const regionRates = getRegionRates(action.value, state.regionKey, state.experienceLevel);
      const service = SERVICES[action.value];
      const allRateKeys = [...(service.primaryRates || []), ...(service.packageRates || [])];
      const lineItems = allRateKeys.map(rateKey => {
        const rateMeta = RATES[action.value]?.[rateKey];
        if (!rateMeta) return null;
        const regionRate = regionRates[rateKey];
        return {
          id: uuid(),
          rateKey,
          label: rateMeta.label,
          unit: rateMeta.unit,
          active: false,
          value: regionRate?.current ?? 0,
          quantity: 1,
          isCustom: false,
        };
      }).filter(Boolean);
      return { ...state, serviceId: action.value, lineItems, equipment: [] };
    }

    case 'SET_REGION': {
      if (action.value === state.regionKey) return state;
      const newState = { ...state, regionKey: action.value };
      if (state.serviceId) {
        const regionRates = getRegionRates(state.serviceId, action.value, state.experienceLevel);
        newState.lineItems = state.lineItems.map(item => {
          if (item.isCustom) return item;
          const regionRate = regionRates[item.rateKey];
          return { ...item, value: regionRate?.current ?? item.value };
        });
      }
      return newState;
    }

    case 'SET_EXPERIENCE': {
      const newState = { ...state, experienceLevel: action.value };
      if (state.serviceId) {
        const regionRates = getRegionRates(state.serviceId, state.regionKey, action.value);
        newState.lineItems = state.lineItems.map(item => {
          if (item.isCustom) return item;
          const regionRate = regionRates[item.rateKey];
          return { ...item, value: regionRate?.current ?? item.value };
        });
      }
      return newState;
    }

    case 'SET_LINE_ITEM': {
      const exists = state.lineItems.find(l => l.rateKey === action.rateKey);
      if (exists) {
        return {
          ...state,
          lineItems: state.lineItems.map(l =>
            l.rateKey === action.rateKey ? { ...l, [action.field]: action.value } : l
          ),
        };
      }
      return {
        ...state,
        lineItems: [
          ...state.lineItems,
          {
            id: uuid(),
            rateKey: action.rateKey,
            label: action.rateMeta?.label || action.rateKey,
            unit: action.rateMeta?.unit || '',
            active: action.field === 'active' ? action.value : false,
            value: action.field === 'value' ? action.value : (action.regionRate?.current ?? 0),
            quantity: 1,
            isCustom: false,
          },
        ],
      };
    }

    case 'ADD_CUSTOM_LINE':
      return {
        ...state,
        lineItems: [
          ...state.lineItems,
          { id: uuid(), rateKey: null, label: '', unit: '', active: true, value: 0, quantity: 1, isCustom: true },
        ],
      };

    case 'SET_CUSTOM_LINE':
      return {
        ...state,
        lineItems: state.lineItems.map(l =>
          l.id === action.id ? { ...l, [action.field]: action.value } : l
        ),
      };

    case 'REMOVE_CUSTOM_LINE':
      return { ...state, lineItems: state.lineItems.filter(l => l.id !== action.id) };

    case 'SET_EQUIPMENT': {
      const exists = state.equipment.find(e => e.id === action.id);
      if (exists) {
        return {
          ...state,
          equipment: state.equipment.map(e =>
            e.id === action.id ? { ...e, [action.field]: action.value } : e
          ),
        };
      }
      return {
        ...state,
        equipment: [
          ...state.equipment,
          { id: action.id, active: action.field === 'active' ? action.value : false, price: action.defaultPrice || 0, days: 1 },
        ],
      };
    }

    case 'APPLY_PACKAGE': {
      if (!state.serviceId) return state;
      const tierDef = PACKAGE_TIERS[state.serviceId]?.[action.tierKey];
      if (!tierDef) return state;
      const regionRates = getRegionRates(state.serviceId, state.regionKey, state.experienceLevel);
      const service = SERVICES[state.serviceId];
      const allRateKeys = [...(service.primaryRates || []), ...(service.packageRates || [])];
      const packageRateKeys = new Set((tierDef.items || []).map(i => i.rateKey));
      const lineItems = allRateKeys.map(rateKey => {
        const rateMeta = RATES[state.serviceId]?.[rateKey];
        if (!rateMeta) return null;
        const regionRate = regionRates[rateKey];
        const pkgItem = tierDef.items?.find(i => i.rateKey === rateKey);
        return {
          id: uuid(),
          rateKey,
          label: rateMeta.label,
          unit: rateMeta.unit,
          active: packageRateKeys.has(rateKey),
          value: regionRate?.current ?? 0,
          quantity: pkgItem?.quantity ?? 1,
          isCustom: false,
        };
      }).filter(Boolean);
      return { ...state, lineItems };
    }

    case 'LOAD_PRESET':
      return { ...state, ...action.preset };

    case 'RESET':
      return { ...DEFAULT_STATE, currency: state.currency, exchangeRates: state.exchangeRates };

    default:
      return state;
  }
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const { user, profile: authProfile, loading: authLoading, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE, (init) => {
    try {
      const saved = JSON.parse(localStorage.getItem('creator-calc-state') || 'null');
      return saved ? { ...init, ...saved } : init;
    } catch { return init; }
  });

  const [dark, setDark] = useState(() => {
    try { return JSON.parse(localStorage.getItem('creator-calc-dark') ?? 'true'); } catch { return true; }
  });
  const [showAuth, setShowAuth]             = useState(false);
  const [authTab, setAuthTab]               = useState('login');
  const [authRole, setAuthRole]             = useState('client');
  const [quickMode, setQuickMode]           = useState(false);
  const [showTerms, setShowTerms]               = useState(false);
  const [showPrivacy, setShowPrivacy]           = useState(false);
  const [showSupportTicket, setShowSupportTicket] = useState(false);
  const [showJoinDropdown, setShowJoinDropdown] = useState(false);
  const joinDropdownRef = useRef(null);
  const [calcLocation, setCalcLocation] = useState(null); // { state, city, regionKey }
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('creator-calc-profile') || '{}'); } catch { return {}; }
  });

  // Derive active tab from URL
  const activeTab = location.pathname.startsWith('/register')   ? 'register'
    : location.pathname.startsWith('/calculator') ? 'calculator'
    : location.pathname.startsWith('/dashboard')  ? 'dashboard'
    : location.pathname.startsWith('/client')     ? 'client'
    : location.pathname.startsWith('/messages')   ? 'messages'
    : location.pathname.startsWith('/projects')   ? 'projects'
    : location.pathname.startsWith('/network')    ? 'network'
    : location.pathname.startsWith('/find')       ? 'directory'
    : location.pathname.startsWith('/search')     ? 'search'
    : '';

  // Persist state
  useEffect(() => {
    localStorage.setItem('creator-calc-state', JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    localStorage.setItem('creator-calc-dark', JSON.stringify(dark));
  }, [dark]);
  useEffect(() => {
    localStorage.setItem('creator-calc-profile', JSON.stringify(profile));
  }, [profile]);

  // Apply dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Capture referral code from URL on first load
  useEffect(() => { captureReferralCode(); }, []);

  // Close Join dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (joinDropdownRef.current && !joinDropdownRef.current.contains(e.target)) {
        setShowJoinDropdown(false);
      }
    }
    if (showJoinDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showJoinDropdown]);

  // Listen for open-auth custom event dispatched by guest gate / banners
  useEffect(() => {
    function handleOpenAuth(e) {
      setAuthTab(e.detail?.tab || 'signup');
      if (e.detail?.role) setAuthRole(e.detail.role);
      setShowAuth(true);
    }
    window.addEventListener('open-auth', handleOpenAuth);
    return () => window.removeEventListener('open-auth', handleOpenAuth);
  }, []);

  function openAuth(tab = 'login') { setAuthTab(tab); setShowAuth(true); }

  const quote = useMemo(() => buildQuote(state), [state]);

  const handleExportPDF = useCallback(async () => {
    const { generateQuotePDF } = await import('./utils/pdf.js');
    await generateQuotePDF(quote, state, profile);
  }, [quote, state, profile]);

  const handleLoadPreset = useCallback((preset) => {
    dispatch({ type: 'LOAD_PRESET', preset });
  }, []);

  const handleSelectPackage = useCallback((tierKey, tierDef) => {
    dispatch({ type: 'APPLY_PACKAGE', tierKey });
  }, []);

  if (quickMode) {
    return (
      <Suspense fallback={<RouteLoading dark={dark} />}>
        <QuickQuoteMode dark={dark} onFullMode={() => setQuickMode(false)} />
      </Suspense>
    );
  }

  const bgMain = dark ? '' : 'bg-gray-50';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07] shadow-[0_22px_70px_rgba(0,0,0,0.18)]' : 'bg-white border-gray-200'}`;
  return (
    <>
    {/* Skip to main content — visible only on keyboard focus */}
    <a href="#cb-main-content" className="cb-skip-link">Skip to main content</a>

    <div className={`min-h-screen ${bgMain} font-body transition-colors duration-200`} style={{ position: 'relative', zIndex: 1 }}>
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-signals" aria-hidden="true">
        <span className="sig h1" />
        <span className="sig h2" />
        <span className="sig h3" />
        <span className="sig h4" />
        <span className="sig v1" />
        <span className="sig v2" />
        <span className="sig v3" />
        <span className="sig d1" />
        <span className="sig d2" />
      </div>
      <CreatorBridgeChromeEffects />

      {/* ── Top Nav ── */}
      <header className="nav">
        <div className="nav-inner">

          {/* Logo */}
          <button type="button" className="logo-mark" onClick={() => navigate('/')} aria-label="CreatorBridge home">
            <img src="/images/creatorbridge/handoff/logo.png" alt="CreatorBridge — Verified Media Marketplace" className="logo-img" />
          </button>

          {/* Main tab switcher */}
          <nav className="nav-links" aria-label="Primary navigation">
            {[
              { path: '/find',       id: 'directory',  label: 'Find Creators' },
              { path: '/projects',   id: 'projects',   label: 'Project Board' },
              { path: '/network',    id: 'network',    label: 'Network' },
              { path: '/calculator', id: 'calculator', label: 'Rate Calculator' },
            ].map(({ path, id, label }) => (
              <button key={id} type="button" onClick={() => navigate(path)}
                className={`nav-link ${activeTab === id ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Join dropdown */}
          {!user && (
          <div className="relative" ref={joinDropdownRef}>
            <button
              type="button"
              onClick={() => setShowJoinDropdown(d => !d)}
              className="btn-ghost"
            >
              Join
            </button>
            {showJoinDropdown && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl z-50 overflow-hidden ${
                dark ? 'bg-charcoal-950/75 border-white/[0.07]' : 'bg-white border-gray-200'
              }`}>
                <button
                  type="button"
                  onClick={() => { navigate('/join-as-creator'); setShowJoinDropdown(false); }}
                  className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 transition-colors text-left ${
                    dark ? 'hover:bg-charcoal-900/72' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold text-gold-400`}>Creator Benefits</span>
                  <span className={`text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Tiers, splits (90/10) & earnings</span>
                </button>
                <div className={`border-t ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`} />
                <button
                  type="button"
                  onClick={() => { navigate('/register'); setShowJoinDropdown(false); }}
                  className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 transition-colors text-left ${
                    dark ? 'hover:bg-charcoal-900/72' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>I am a Creator</span>
                  <span className={`text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>List your services and get hired</span>
                </button>
                <div className={`border-t ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`} />
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('signup');
                    setAuthRole('client');
                    setShowAuth(true);
                    setShowJoinDropdown(false);
                  }}
                  className={`w-full flex flex-col items-start gap-0.5 px-4 py-3 transition-colors text-left ${
                    dark ? 'hover:bg-charcoal-900/72' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>I am a Client</span>
                  <span className={`text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Find and hire verified creators</span>
                </button>
              </div>
            )}
          </div>
          )}

          {/* Calculator tools (only when on calculator tab) */}
          {false && activeTab === 'calculator' && (
            <Suspense fallback={null}>
              <button type="button" onClick={() => setQuickMode(true)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  dark ? 'border-white/[0.09] text-charcoal-300 hover:text-white hover:border-charcoal-500' : 'border-gray-200 text-gray-500 hover:text-gray-900'
                }`}
              >
              <Zap size={12} className="text-gold-400" /> Quick Quote
              </button>
              <ProfileSettings profile={profile} onChange={setProfile} dark={dark} />
              <PresetManager currentState={state} onLoad={handleLoadPreset} dark={dark} />
              <button type="button" onClick={() => dispatch({ type: 'RESET' })}
                className={`p-2 rounded-xl transition-colors ${dark ? 'text-charcoal-500 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                title="Reset calculator"
              >
                <RotateCcw size={14} />
              </button>
            </Suspense>
          )}

          {/* Auth buttons */}
          {user ? (
            <div className="flex items-center gap-1">
              <NotificationBell user={user} dark={dark} navigate={navigate} />
              <button type="button" onClick={() => navigate('/messages')}
                aria-label="Messages"
                className={`p-3 md:p-2 rounded-xl transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-gold-500/20 text-gold-400'
                    : dark ? 'text-charcoal-400 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                }`}>
                <MessageSquare size={14} />
              </button>
              {/* Role-gated nav: creators see creator dashboard, clients see client profile */}
              {authProfile?.role === 'creator' ? (
                <button type="button" onClick={() => navigate('/dashboard')}
                  aria-label="Creator Dashboard"
                  className={`p-3 md:p-2 rounded-xl transition-colors ${
                    activeTab === 'dashboard'
                      ? 'bg-gold-500/20 text-gold-400'
                      : dark ? 'text-charcoal-400 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                  }`}>
                  <LayoutDashboard size={14} />
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/client')}
                  aria-label="My Profile"
                  className={`p-3 md:p-2 rounded-xl transition-colors ${
                    activeTab === 'client'
                      ? 'bg-gold-500/20 text-gold-400'
                      : dark ? 'text-charcoal-400 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                  }`}>
                  <User size={14} />
                </button>
              )}
              {/* Avatar — clickable, shows photo if available. w-11 h-11 is exactly 44x44px. */}
              <button
                type="button"
                onClick={() => navigate(authProfile?.role === 'creator' ? '/dashboard' : '/client')}
                aria-label="Go to my profile"
                className={`w-11 h-11 md:w-7 md:h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-80 ${dark ? 'bg-gold-500/20 text-gold-400' : 'bg-gold-100 text-gold-600'}`}
              >
                {authProfile?.avatar_url ? (
                  <img src={authProfile.avatar_url} alt={`${authProfile?.full_name ?? 'Your'} avatar`} className="w-full h-full object-cover" />
                ) : (
                  (authProfile?.full_name || user.email || 'U')[0].toUpperCase()
                )}
              </button>
              <button type="button" onClick={signOut}
                aria-label="Sign out"
                className="btn-gold">
                Sign Out
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => openAuth('login')}
              className="btn-gold">
              Sign In
            </button>
          )}
          </div>

        </div>
      </header>

      {/* ── Routes ── */}
      <main id="cb-main-content" tabIndex={-1} style={{ outline: 'none' }}>
      <Routes>
        <Route path="/" element={<LandingPage dark={dark} />} />
        <Route path="/find" element={<CreatorDirectory dark={dark} mode="search" onSwitchToRegister={() => navigate('/register')} />} />
        <Route path="/search" element={<LazyRoute dark={dark}><SearchPage dark={dark} /></LazyRoute>} />
        <Route path="/register" element={<CreatorDirectory dark={dark} mode="register" onSwitchToSearch={() => navigate('/find')} />} />
        <Route path="/creator/:id" element={<LazyRoute dark={dark}><CreatorProfilePage dark={dark} /></LazyRoute>} />
        <Route path="/dashboard" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="creator" title="Sign in to manage your creator account." copy="Creator tools, Stripe setup, packages, availability, earnings, and verification need an authenticated account.">
            <LazyRoute dark={dark}><CreatorDashboard dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/client" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to manage your client profile." copy="Your booking identity, saved creators, project pipeline, and client trust signals belong behind your account.">
            <LazyRoute dark={dark}><ClientProfilePage dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/messages" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to view messages." copy="CreatorBridge keeps project conversations attached to verified accounts so contact and booking history stay protected.">
            <LazyRoute dark={dark}><MessagesPage dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/projects" element={<ErrorBoundary dark={dark} fallbackMessage="Could not load the Project Board"><LazyRoute dark={dark}><ProjectBoard dark={dark} /></LazyRoute></ErrorBoundary>} />
        <Route path="/checkout/:projectId" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in before payment." copy="Payments require a verified client session before CreatorBridge can create a protected Stripe payment.">
            <LazyRoute dark={dark}><CheckoutPage dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/matches/:projectId" element={<LazyRoute dark={dark}><MatchResultsPage dark={dark} /></LazyRoute>} />
        <Route path="/network" element={<LazyRoute dark={dark}><NetworkingPage dark={dark} user={user} profile={authProfile} /></LazyRoute>} />
        <Route path="/admin" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to view admin controls." copy="CreatorBridge admin visibility requires an authenticated owner account.">
            <LazyRoute dark={dark}><AdminDashboard dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/admin/support" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to view support tickets." copy="CreatorBridge admin visibility requires an authenticated owner account.">
            <LazyRoute dark={dark}><AdminSupport dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/admin/operations" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to access admin operations." copy="CreatorBridge admin visibility requires an authenticated owner account.">
            <LazyRoute dark={dark}><AdminOperations dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/admin/finance" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to access finance." copy="CreatorBridge admin visibility requires an authenticated owner account.">
            <LazyRoute dark={dark}><AdminFinance dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/admin/analytics" element={
          <AuthRequired dark={dark} user={user} loading={authLoading} role="client" title="Sign in to view analytics." copy="CreatorBridge admin visibility requires an authenticated owner account.">
            <LazyRoute dark={dark}><AdminAnalytics dark={dark} /></LazyRoute>
          </AuthRequired>
        } />
        <Route path="/terms" element={<LazyRoute dark={dark}><TermsOfService dark={dark} /></LazyRoute>} />
        <Route path="/terms-of-service" element={<LazyRoute dark={dark}><TermsOfService dark={dark} /></LazyRoute>} />
        <Route path="/creator-agreement" element={<LazyRoute dark={dark}><CreatorAgreement dark={dark} /></LazyRoute>} />
        <Route path="/dispute-policy" element={<LazyRoute dark={dark}><DisputePolicy dark={dark} /></LazyRoute>} />
        <Route path="/join-as-creator" element={<LazyRoute dark={dark}><JoinAsCreator dark={dark} /></LazyRoute>} />
        <Route path="/privacy" element={<LazyRoute dark={dark}><TermsPage dark={dark} /></LazyRoute>} />
        <Route path="/reset-password" element={<LazyRoute dark={dark}><ResetPasswordPage dark={dark} /></LazyRoute>} />
        <Route path="/calculator" element={<HandoffPage page={handoffPages.rateCalculator} />} />
      </Routes>
      </main>

      {/* ── Calculator (rendered outside Routes to preserve state) ── */}
      {false && activeTab === 'calculator' && (
      <Suspense fallback={<RouteLoading dark={dark} />}>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

        {/* ── Calculator purpose label ── */}
        <div className="col-span-full">
          <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 liquid-glass ${
            dark ? 'border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
          }`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-stretch">
              <div>
                <p className={`mb-5 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                  <Link to="/" className="hover:text-gold-300 transition-colors">Home</Link>
                  <span className="mx-2 text-gold-500/70">/</span>
                  <span className={dark ? 'text-white' : 'text-gray-900'}>Rate Calculator</span>
                </p>
                <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  Creator pricing tool · US markets
                </p>
                <h1 className={`font-display font-bold text-4xl md:text-6xl leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Build rates with <span className="gold-text">professional confidence</span>.
                </h1>
                <p className={`mt-4 text-sm md:text-base leading-7 max-w-2xl ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                  Calibrate scope, US market, and experience into a USD quote that holds up. Pick your primary pillar first, then build the quote around real production work.
                </p>
                <div className={`mt-6 max-w-md rounded-2xl border p-4 ${dark ? 'bg-gold-500/10 border-gold-500/20' : 'bg-gold-50 border-gold-200'}`}>
                  <Zap size={18} className="text-gold-400 mb-3" />
                  <p className={`text-xs leading-5 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
                    This calculator is for creator pricing strategy, not the public client booking flow.
                  </p>
                </div>
              </div>
              <div className={`relative hidden min-h-[230px] overflow-hidden rounded-2xl border lg:block ${dark ? 'border-gold-500/18 bg-charcoal-950/70' : 'border-gray-200 bg-gray-50'}`}>
                <img
                  src="/images/creatorbridge/rate-calculator-desk.jpg"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/92 via-charcoal-950/35 to-charcoal-950/10" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-gold-300 mb-2" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                    Quote discipline
                  </p>
                  <p className="max-w-sm text-sm font-bold leading-6 text-white">
                    Build packages around the work, not guesses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── LEFT: Config panel ── */}
        <div className="space-y-4 min-w-0">

          {/* Region + Experience row */}
          <div className={`${cardCls} p-5 liquid-glass`}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                  US market
                </p>
                <StateCitySelector
                  value={calcLocation}
                  onChange={loc => {
                    setCalcLocation(loc);
                    dispatch({ type: 'SET_REGION', value: loc.regionKey });
                  }}
                  dark={dark}
                />
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                  Experience
                </p>
                <div className={`flex rounded-xl border overflow-hidden ${dark ? 'border-white/[0.09]' : 'border-gray-200'}`}>
                  {[
                    { id: 'entry',  label: '2-3 yrs' },
                    { id: 'mid',    label: '4-6 yrs' },
                    { id: 'senior', label: '7+ yrs'  },
                  ].map(({ id, label }) => (
                    <button key={id} type="button"
                      onClick={() => dispatch({ type: 'SET_EXPERIENCE', value: id })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${
                        state.experienceLevel === id
                          ? 'bg-gold-500 text-charcoal-900'
                          : dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Service selector */}
          <div className={`${cardCls} p-5 liquid-glass`}>
            <div className="mb-4">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                Primary pillar
              </p>
              <p className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                Choose one. This sets the available rate structure for your quote.
              </p>
            </div>
            <ServiceSelector
              value={state.serviceId}
              onChange={v => dispatch({ type: 'SET_SERVICE', value: v })}
              dark={dark}
            />
          </div>

          {/* Line Item Builder */}
          {state.serviceId && (
            <div className={`${cardCls} p-5 liquid-glass`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                Scope of work
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className={`text-xs font-medium mb-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Client Name</p>
                  <input
                    type="text"
                    value={state.clientName}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'clientName', value: e.target.value })}
                    placeholder="Client or Project Name"
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${
                      dark
                        ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                    }`}
                  />
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Quote #</p>
                  <input
                    type="text"
                    value={state.quoteNumber}
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'quoteNumber', value: e.target.value })}
                    placeholder="e.g. Q-2026-001"
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${
                      dark
                        ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                    }`}
                  />
                </div>
              </div>

              <LineItemBuilder state={state} dispatch={dispatch} dark={dark} />

              <div className={`mt-4 border-t pt-4 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
                <p className={`text-xs font-medium mb-1 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Notes / Terms</p>
                <textarea
                  value={state.notes}
                  onChange={e => dispatch({ type: 'SET_FIELD', field: 'notes', value: e.target.value })}
                  placeholder={profile?.defaultNotes || 'Add any terms, notes, or special conditions...'}
                  rows={3}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all resize-none ${
                    dark
                      ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                  }`}
                />
              </div>

              {/* Cost inputs */}
              <div className={`mt-4 border-t pt-4 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-medium ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Your Actual Costs (for margin calc)</p>
                  <button type="button"
                    onClick={() => dispatch({ type: 'SET_FIELD', field: 'costInputs', value: [...state.costInputs, { id: uuid(), label: '', value: 0 }] })}
                    className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                  >
                    + Add cost
                  </button>
                </div>
                <div className="space-y-2">
                  {state.costInputs.map((cost) => (
                    <div key={cost.id} className="flex gap-2">
                      <input type="text" value={cost.label} placeholder="Cost label"
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'costInputs', value: state.costInputs.map(c => c.id === cost.id ? { ...c, label: e.target.value } : c) })}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none transition-all ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'}`}
                      />
                      <div className="relative flex items-center w-28">
                        <span className={`absolute left-2 text-xs pointer-events-none ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>$</span>
                        <input type="number" min={0} value={cost.value || ''}
                          onChange={e => dispatch({ type: 'SET_FIELD', field: 'costInputs', value: state.costInputs.map(c => c.id === cost.id ? { ...c, value: parseFloat(e.target.value) || 0 } : c) })}
                          className={`w-full pl-5 pr-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white focus:border-gold-500' : 'bg-white border-gray-300 text-gray-900 focus:border-gold-500'}`}
                        />
                      </div>
                      <button type="button"
                        onClick={() => dispatch({ type: 'SET_FIELD', field: 'costInputs', value: state.costInputs.filter(c => c.id !== cost.id) })}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {state.serviceId && (
            <PackageComparison
              serviceId={state.serviceId}
              regionKey={state.regionKey}
              currency={state.currency}
              exchangeRates={state.exchangeRates}
              dark={dark}
              onSelectPackage={handleSelectPackage}
            />
          )}

          {state.serviceId && (
            <RateComparisonChart
              serviceId={state.serviceId}
              regionKey={state.regionKey}
              lineItems={state.lineItems}
              dark={dark}
            />
          )}

          {state.serviceId && (
            <SeasonalDemand serviceId={state.serviceId} dark={dark} />
          )}
        </div>

        {/* ── RIGHT: Quote panel ── */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className={`${cardCls} p-5`}>
              <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '2.4px', textTransform: 'uppercase' }}>
                Pricing guardrails
              </p>
              <h2 className={`font-display text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                Keep the quote tied to real production work.
              </h2>
              <div className="mt-5 space-y-3">
                {[
                  ['Scope first', 'Define the shoot, edit, delivery, and revision needs before pricing.'],
                  ['Cost visibility', 'Track crew, rental, travel, and post-production costs before margin.'],
                  ['Package fit', 'Compare basic, standard, and premium lanes without guessing.'],
                ].map(([label, copy]) => (
                  <div key={label} className={`rounded-2xl border p-3 ${dark ? 'border-white/[0.07] bg-charcoal-950/48' : 'border-gray-200 bg-gray-50'}`}>
                    <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                    <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            {quote.grandTotal > 0 && (
              <div className={`${cardCls} p-4 glow-gold`}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>Total Estimate</p>
                    <p className="font-display text-4xl font-bold text-gradient-gold">
                      {formatCurrency(quote.grandTotal, state.currency, state.exchangeRates)}
                    </p>
                  </div>
                  {quote.profitMargin !== null && (
                    <div className="text-right">
                      <p className={`text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>Margin</p>
                      <p className={`text-xl font-bold ${quote.profitMargin >= 50 ? 'text-gold-400' : quote.profitMargin >= 25 ? 'text-gold-400' : 'text-red-400'}`}>
                        {quote.profitMargin}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <QuoteOutput
              quote={quote}
              state={state}
              onExportPDF={handleExportPDF}
              dark={dark}
              creatorMode={true}
            />

            {/* Post-calculator signup prompt for guests */}
            {!user && quote.grandTotal > 0 && (
              <div className={`${cardCls} p-5 text-center`}>
                <p className={`font-display font-bold text-sm mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
                  Ready to put these rates to work?
                </p>
                <p className={`text-xs mb-4 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
                  Create a free profile and start getting matched with clients looking for your services.
                </p>
                <button type="button"
                  onClick={() => setShowAuth(true)}
                  className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
                  Join as a Creator - It's Free
                </button>
                <p className={`text-[10px] mt-2 ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                  No subscription. Creators keep 90% of every project.
                </p>
              </div>
            )}

            {state.serviceId && (
              <HealthWidget
                serviceId={state.serviceId}
                regionKey={state.regionKey}
                lineItems={state.lineItems}
                experienceLevel={state.experienceLevel}
                dark={dark}
              />
            )}
          </div>
        </div>
      </main>
      </Suspense>
      )}

      {/* ── Footer ── */}
      {activeTab !== 'calculator' && location.pathname.startsWith('/creator') ? null : (
        <footer className="site">
          <div className="inner">
            <div className="grid">
              <div className="brand-col">
                <button type="button" onClick={() => navigate('/')} className="logo-mark" style={{ marginBottom: '1.25rem' }}>
                  <img src="/images/creatorbridge/handoff/logo.png" alt="CreatorBridge" className="logo-img" />
                </button>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: '24rem', lineHeight: 1.6 }}>
                  The verified US marketplace connecting brands with professional media specialists across three production pillars — without building an internal media department.
                </p>
                <div className="footer-pillar-row">
                  <span className="footer-pill">Video Production</span>
                  <span className="footer-pill">Photography</span>
                  <span className="footer-pill">Post Production</span>
                </div>
              </div>
              <div>
                <h4>Platform</h4>
                <button type="button" onClick={() => navigate('/find')}>Find Creators</button>
                <button type="button" onClick={() => navigate('/projects')}>Project Board</button>
                <button type="button" onClick={() => navigate('/network')}>Creator Network</button>
                <button type="button" onClick={() => navigate('/calculator')}>Rate Calculator</button>
              </div>
              <div>
                <h4>For Creators</h4>
                <button type="button" onClick={() => navigate('/creator/demo')}>Sample profile</button>
                <button type="button" onClick={() => navigate('/join-as-creator')}>Apply to join</button>
                <button type="button" onClick={() => navigate('/creator-agreement')}>Creator Agreement</button>
                <button type="button" onClick={() => navigate('/dispute-policy')}>Dispute Policy</button>
              </div>
              <div>
                <h4>Company</h4>
                <button type="button" onClick={() => navigate('/terms')}>Terms</button>
                <button type="button" onClick={() => navigate('/privacy')}>Privacy</button>
                <button type="button" onClick={() => user ? setShowSupportTicket(true) : setShowAuth(true)}>Contact Support</button>
              </div>
            </div>
            <div className="bottom">
              <div>© 2026 CreatorBridge · US-only verified media marketplace · All bookings in USD.</div>
              <div className="bottom-links">
                <button type="button" onClick={() => navigate('/terms')}>Terms</button>
                <button type="button" onClick={() => navigate('/privacy')}>Privacy</button>
                <button type="button" onClick={() => user ? setShowSupportTicket(true) : setShowAuth(true)}>Support</button>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          dark={dark}
          defaultTab={authTab}
          defaultRole={authRole}
          onClose={() => setShowAuth(false)}
          onOpenTerms={() => { setShowTerms(true); }}
          onOpenCreatorRegistration={() => { setShowAuth(false); navigate('/register'); }}
        />
      )}

      {/* Support ticket modal */}
      {showSupportTicket && (
        <SupportTicketForm dark={dark} onClose={() => setShowSupportTicket(false)} />
      )}

      {/* Terms modal */}
      {showTerms && (
        <TermsModal dark={dark} onClose={() => setShowTerms(false)} />
      )}

      {/* Privacy modal */}
      {showPrivacy && (
        <PrivacyModal dark={dark} onClose={() => setShowPrivacy(false)} />
      )}

    </div>
    <SupportChatbot dark={dark} />
    </>
  );
}
