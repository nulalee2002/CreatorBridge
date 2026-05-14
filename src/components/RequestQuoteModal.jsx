import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { TurnstileWidget, turnstileConfigured } from './TurnstileWidget.jsx';
import { normalizeServiceId, SERVICE_TYPE_OPTIONS } from '../data/rates.js';
import { fromSupabaseProject, toSupabaseProject, upsertLocalProject } from '../utils/projectStorage.js';
import { sanitizeLongText, sanitizePlainText } from '../utils/inputSecurity.js';
import { parseBudgetRange } from '../utils/matchingAlgorithm.js';

// ── Static option sets ───────────────────────────────────────

const SERVICE_TYPES = SERVICE_TYPE_OPTIONS;

const PROJECT_SUBTYPES = {
  'Video Production':       ['Corporate', 'Wedding', 'Documentary', 'Music Video', 'Brand Commercial', 'Brand & Short-Form Content', 'Podcast', 'Birthday/Celebration', 'Anniversary', 'Graduation', 'Concert', 'Sports', 'Real Estate Tour', 'Other'],
  'Photography':            ['Real Estate', 'Headshots', 'Wedding', 'Commercial', 'Event', 'Product', 'Brand', 'Birthday/Celebration', 'Anniversary', 'Graduation', 'Concert', 'Sports', 'Family Portrait', 'Maternity', 'Other'],
  'Drone / Aerial':         ['Real Estate Aerial', 'Event Aerial', 'Mapping', 'Film/Video Support', 'Construction Progress', 'Other'],
  'Brand & Short-Form Content': ['Reels/TikTok', 'YouTube', 'Brand Campaign', 'UGC', 'Behind the Scenes', 'Other'],
  'Editing & Post':         ['Video Editing', 'Color Grading', 'Audio Mixing', 'Motion Graphics', 'Podcast Editing', 'Other'],
  'Live Event Coverage':    ['Concert/Music', 'Sports', 'Corporate Event', 'Conference', 'Festival', 'Birthday/Celebration', 'Wedding Reception', 'Other'],
  'Corporate Events':       ['Conference Coverage', 'Product Launch', 'Award Ceremony', 'Trade Show', 'Company Retreat', 'Executive Portraits at Events', 'Investor Presentation', 'Town Hall / All-Hands', 'Other'],
  'Podcast Production':     ['Audio Only', 'Video Podcast', 'Remote Recording', 'In-Studio Recording', 'Show Launch Package', 'Monthly Retainer', 'Other'],
};

const TIME_OPTIONS = [
  'Early Morning (before 8am)',
  'Morning (8am to 12pm)',
  'Afternoon (12pm to 5pm)',
  'Evening (5pm to 9pm)',
  'Night (after 9pm)',
  'Flexible/TBD',
];

const HOURS_OPTIONS = [
  '1 hour', '2 hours', '3 hours', '4 hours', '5 hours',
  '6 hours', '8 hours', '10 hours', '12 hours',
  'Full day (8+ hrs)', 'Multi-day (contact to discuss)',
];

const DELIVERABLE_OPTIONS = [
  '1','2','3','4','5','6','8','10','15','20','20+',
];

const BUDGET_OPTIONS = [
  'Under $500',
  '$500 to $1,500',
  '$1,500 to $5,000',
  '$5,000 to $10,000',
  '$10,000+',
];

const LOCATION_PREF_OPTIONS = [
  'Local only',
  'Remote OK',
  'Either works',
];

const VENUE_TYPES = ['Indoor', 'Outdoor', 'Studio', 'Remote/Virtual'];

const today = new Date().toISOString().split('T')[0];

function saveLocalQuoteRequest(quote) {
  try {
    const all = JSON.parse(localStorage.getItem('quote-requests') || '[]');
    const exists = all.some(item => item.id === quote.id);
    const next = exists
      ? all.map(item => item.id === quote.id ? { ...item, ...quote } : item)
      : [quote, ...all];
    localStorage.setItem('quote-requests', JSON.stringify(next));
  } catch {}
}

// ── Client reputation ────────────────────────────────────────
const CLIENT_REPUTATION_LEVELS = [
  { min: 90, max: 100, label: 'Excellent Client', color: 'text-gold-400',  bg: 'bg-gold-500/15',  border: 'border-gold-500/30'  },
  { min: 75, max: 89,  label: 'Good Client',      color: 'text-gold-400', bg: 'bg-gold-500/15', border: 'border-gold-500/30' },
  { min: 60, max: 74,  label: 'New Client',        color: 'text-gold-400', bg: 'bg-gold-500/15', border: 'border-gold-500/30' },
  { min: 0,  max: 59,  label: 'Review History',    color: 'text-red-400',   bg: 'bg-red-500/15',   border: 'border-red-500/40'   },
];

function getClientReputation(score) {
  const s = typeof score === 'number' ? score : 100;
  return CLIENT_REPUTATION_LEVELS.find(l => s >= l.min && s <= l.max) || CLIENT_REPUTATION_LEVELS[0];
}

// ── Main component ───────────────────────────────────────────

export function RequestQuoteModal({ creator, dark, onClose, initialDate = '' }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [form, setForm] = useState({
    projectTitle:        '',
    serviceType:         '',
    projectType:         '',
    otherProjectType:    '',
    projectDate:         initialDate,
    projectTime:         '',
    venueAddress:        '',
    venueCity:           '',
    venueState:          '',
    venueType:           '',
    hoursNeeded:         '',
    deliverables:        '',
    description:         '',
    budgetRange:         '',
    locationPreference:  '',
  });

  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quoteHp, setQuoteHp]   = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('cm-client-onboarded') !== 'true'
  );
  const [onboardingAnswers, setOnboardingAnswers] = useState({
    projectType: '', contentType: '', budget: '', source: '',
  });

  const onboardingComplete = !!(
    onboardingAnswers.projectType && onboardingAnswers.contentType &&
    onboardingAnswers.budget && onboardingAnswers.source
  );

  function handleOnboardingContinue() {
    localStorage.setItem('cm-client-onboarding-answers', JSON.stringify(onboardingAnswers));
    localStorage.setItem('cm-client-onboarded', 'true');
    setShowOnboarding(false);
  }

  const repScore = (() => {
    const v = parseInt(localStorage.getItem('cm-client-reputation-score') ?? '100', 10);
    return isNaN(v) ? 100 : v;
  })();
  const rep = getClientReputation(repScore);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'serviceType') { next.projectType = ''; next.otherProjectType = ''; }
      if (k === 'projectType') next.otherProjectType = '';
      return next;
    });
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const inputCls = (field) => `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    errors[field]
      ? 'border-red-500 bg-red-500/5'
      : dark
        ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  const selectCls = (field) => `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    errors[field]
      ? 'border-red-500 bg-red-500/5'
      : dark
        ? 'bg-charcoal-950/75 border-white/[0.09] text-white focus:border-gold-500'
        : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gold-500'
  }`;

  const labelCls = `text-[11px] font-semibold uppercase tracking-[0.14em] block mb-2 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`;
  const errorMsg = (field) => errors[field] ? (
    <p className="text-xs text-red-400 mt-1">{errors[field]}</p>
  ) : null;

  const descLen = form.description.length;

  function validate() {
    const e = {};
    const isRemoteProject = form.venueType === 'Remote/Virtual';
    const cleanTitle = sanitizePlainText(form.projectTitle, 120);
    const cleanDescription = sanitizeLongText(form.description, 4000);
    if (!cleanTitle)                     e.projectTitle       = 'Give your project a clear title so creators understand what this is.';
    if (!form.serviceType)               e.serviceType        = 'Select the type of production service you need.';
    if (!form.projectType)               e.projectType        = 'Select the specific type of project within your chosen service.';
    if (form.projectType === 'Other' && !form.otherProjectType.trim()) e.otherProjectType = 'Please describe your specific project type.';
    if (!form.projectDate)               e.projectDate        = 'Creators need to know when to show up or when this is due.';
    else if (form.projectDate <= today)  e.projectDate        = 'Project date must be in the future.';
    if (!form.projectTime)               e.projectTime        = 'Time of day affects lighting, crew scheduling, and availability.';
    if (!form.venueType)                 e.venueType          = 'Select Indoor, Outdoor, Studio, or Remote/Virtual.';
    if (!isRemoteProject && !form.venueAddress.trim()) e.venueAddress = 'Creators need to know exactly where to show up.';
    if (!isRemoteProject && !form.venueCity.trim())    e.venueCity    = 'Please enter the city.';
    if (!isRemoteProject && !form.venueState.trim())   e.venueState   = 'Please enter the state.';
    if (!form.hoursNeeded)               e.hoursNeeded        = 'How long do you need the creator on site or working on your project?';
    if (!form.deliverables)              e.deliverables       = 'This helps creators estimate the editing time and scope.';
    if (cleanDescription.length < 100)   e.description        = 'Please provide at least 100 characters so creators understand your vision.';
    if (!form.budgetRange)               e.budgetRange        = 'Selecting a budget range helps match you with creators who fit your project.';
    if (!form.locationPreference)        e.locationPreference = 'Let creators know if they need to be in your area.';
    return e;
  }

  function buildCleanQuoteForm() {
    return {
      projectTitle: sanitizePlainText(form.projectTitle, 120),
      serviceType: sanitizePlainText(form.serviceType, 80),
      projectType: sanitizePlainText(form.projectType, 120),
      otherProjectType: sanitizePlainText(form.otherProjectType, 120),
      projectDate: sanitizePlainText(form.projectDate, 40),
      projectTime: sanitizePlainText(form.projectTime, 80),
      venueAddress: sanitizePlainText(form.venueAddress, 180),
      venueCity: sanitizePlainText(form.venueCity, 80),
      venueState: sanitizePlainText(form.venueState, 80),
      venueType: sanitizePlainText(form.venueType, 80),
      hoursNeeded: sanitizePlainText(form.hoursNeeded, 80),
      deliverables: sanitizePlainText(form.deliverables, 80),
      description: sanitizeLongText(form.description, 4000),
      budgetRange: sanitizePlainText(form.budgetRange, 80),
      locationPreference: sanitizePlainText(form.locationPreference, 80),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Honeypot: silently drop submissions from bots
    if (quoteHp) return;
    // Turnstile check
    if (turnstileConfigured() && !turnstileToken) {
      setErrors(er => ({ ...er, _turnstile: 'Please complete the security check.' }));
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Scroll to top of modal
      document.getElementById('quote-modal-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    const cleanForm = buildCleanQuoteForm();
    const serviceId = normalizeServiceId(cleanForm.serviceType);
    const budget = parseBudgetRange(cleanForm.budgetRange);
    const isRemoteProject = cleanForm.venueType === 'Remote/Virtual' || cleanForm.locationPreference === 'Remote OK';
    const createdAt = new Date().toISOString();
    const projectType = cleanForm.projectType === 'Other' ? (cleanForm.otherProjectType || 'Other') : cleanForm.projectType;

    const project = {
      id:                 Date.now().toString() + Math.random(),
      title:              cleanForm.projectTitle,
      serviceId,
      serviceType:        cleanForm.serviceType,
      projectType,
      projectDate:        cleanForm.projectDate,
      projectTime:        cleanForm.projectTime,
      location: {
        address:          cleanForm.venueAddress,
        city:             cleanForm.venueCity,
        state:            cleanForm.venueState,
        country:          'US',
        venueType:        cleanForm.venueType,
      },
      remote:             isRemoteProject,
      hoursNeeded:        cleanForm.hoursNeeded,
      deliverables:       cleanForm.deliverables,
      description:        cleanForm.description,
      budgetRange:        cleanForm.budgetRange,
      budgetMin:          budget.budgetMin,
      budgetMax:          budget.budgetMax,
      locationPreference: cleanForm.locationPreference,
      creatorId:          creator?.id || null,
      creatorName:        creator ? (creator.businessName || creator.name) : null,
      clientId:           user?.id || 'guest-' + Date.now(),
      clientName:         profile?.full_name || user?.email?.split('@')[0] || 'Client',
      status:             'open',
      createdAt,
    };

    let savedProject = project;
    let savedQuote = {
      id: `quote-${project.id}`,
      creatorId: creator?.id || null,
      listing_id: creator?.id || null,
      clientId: project.clientId,
      client_id: user?.id || null,
      clientName: project.clientName,
      client_name: project.clientName,
      clientEmail: user?.email || '',
      client_email: user?.email || '',
      projectTitle: project.title,
      project_title: project.title,
      serviceId,
      service_id: serviceId,
      description: project.description,
      timeline: cleanForm.projectDate,
      projectDate: cleanForm.projectDate,
      projectType: project.projectType,
      project_type: project.projectType,
      projectTime: cleanForm.projectTime,
      project_time: cleanForm.projectTime,
      venueAddress: cleanForm.venueAddress,
      venue_address: cleanForm.venueAddress,
      venueCity: cleanForm.venueCity,
      venue_city: cleanForm.venueCity,
      venueState: cleanForm.venueState,
      venue_state: cleanForm.venueState,
      venueType: cleanForm.venueType,
      venue_type: cleanForm.venueType,
      hoursNeeded: cleanForm.hoursNeeded,
      hours_needed: cleanForm.hoursNeeded,
      deliverables: cleanForm.deliverables,
      budgetRange: cleanForm.budgetRange,
      budget_range: cleanForm.budgetRange,
      budget: budget.budgetMax === 999999 ? budget.budgetMin : budget.budgetMax,
      locationPreference: cleanForm.locationPreference,
      location_preference: cleanForm.locationPreference,
      status: 'pending',
      read: false,
      createdAt,
      created_at: createdAt,
    };

    // Save to Supabase if configured
    if (supabaseConfigured && user) {
      try {
        const { data: projectRow } = await supabase
          .from('projects')
          .insert(toSupabaseProject(project, user.id))
          .select()
          .single();
        if (projectRow) {
          savedProject = { ...project, ...fromSupabaseProject(projectRow), clientName: project.clientName };
        }

        const { data: quoteRow, error: quoteError } = await supabase.from('quote_requests').insert({
          listing_id:          creator?.id || null,
          client_id:           user.id,
          client_name:         project.clientName,
          client_email:        user.email || '',
          service_id:          serviceId || cleanForm.serviceType,
          description:         cleanForm.description,
          timeline:            cleanForm.projectDate,
          budget:              savedQuote.budget,
          project_title:       cleanForm.projectTitle,
          project_type:        project.projectType,
          project_time:        cleanForm.projectTime,
          venue_address:       cleanForm.venueAddress,
          venue_city:          cleanForm.venueCity,
          venue_state:         cleanForm.venueState,
          venue_type:          cleanForm.venueType,
          hours_needed:        cleanForm.hoursNeeded,
          deliverables:        cleanForm.deliverables,
          budget_range:        cleanForm.budgetRange,
          location_preference: cleanForm.locationPreference,
        }).select().single();
        if (quoteError) throw quoteError;
        if (quoteRow) savedQuote = { ...savedQuote, ...quoteRow, id: quoteRow.id };
      } catch (err) {
        console.warn('Quote request Supabase save failed. Local fallback preserved.', err);
      }
    }

    // Save locally after Supabase so matching uses the final project id when available.
    try {
      upsertLocalProject(savedProject);
      saveLocalQuoteRequest(savedQuote);
    } catch {}

    setSubmitted(true);
    setLoading(false);

    // Redirect to Smart Match results after short delay
    setTimeout(() => {
      onClose?.();
      navigate(`/matches/${savedProject.id}`);
    }, 1500);
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="cb-modal-backdrop" />
        <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl p-8 text-center ${dark ? 'bg-charcoal-950/90 border-white/[0.08]' : 'bg-white border-gray-200'}`}>
          <div className="text-4xl mb-4 animate-pulse text-gold-400">🔍</div>
          <h3 className={`font-display font-bold text-lg mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Finding your best matches...
          </h3>
          <p className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            Analyzing your project brief and matching with available creators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-[28px] border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${dark ? 'bg-charcoal-950/92 border-white/[0.08]' : 'bg-white border-gray-200'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
          <div>
            {creator && (
              <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                Requesting from {creator.businessName || creator.name}
              </p>
            )}
            <h3 className={`font-display font-bold text-2xl ${dark ? 'text-white' : 'text-gray-900'}`}>
              Request a Quote
            </h3>
            {!showOnboarding && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold mt-1 ${rep.bg} ${rep.border} ${rep.color}`}>
                {rep.label === 'Review History' && <span>🚩</span>}
                {rep.label}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div id="quote-modal-scroll" className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Onboarding screen ── */}
          {showOnboarding && (
            <div className="space-y-5">
              <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${dark ? 'border-white/[0.07] bg-charcoal-900/50 text-charcoal-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                Welcome to CreatorBridge. You are joining a professional marketplace where every creator is verified and vetted. To maintain quality for both sides, we ask a few quick questions before you start browsing. This takes about 2 minutes.
              </div>

              {/* Q1 */}
              <div>
                <label className={labelCls}>What type of project are you hiring for? *</label>
                <select
                  value={onboardingAnswers.projectType}
                  onChange={e => setOnboardingAnswers(a => ({ ...a, projectType: e.target.value }))}
                  className={selectCls('')}>
                  <option value="">Select...</option>
                  {['Video Production','Photography','Drone and Aerial','Brand & Short-Form Content','Editing & Post','Live Event Coverage','Corporate Events','Podcast Production','Not sure yet'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Q2 */}
              <div>
                <label className={labelCls}>What best describes your content needs? *</label>
                <select
                  value={onboardingAnswers.contentType}
                  onChange={e => setOnboardingAnswers(a => ({ ...a, contentType: e.target.value }))}
                  className={selectCls('')}>
                  <option value="">Select...</option>
                  {['Commercial and Advertising','Wedding and Events','Real Estate','Brand & Short-Form Content','Brand Films','Podcast','Live Event Coverage','Personal Projects','Other'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Q3 */}
              <div>
                <label className={labelCls}>What is your typical project budget? *</label>
                <select
                  value={onboardingAnswers.budget}
                  onChange={e => setOnboardingAnswers(a => ({ ...a, budget: e.target.value }))}
                  className={selectCls('')}>
                  <option value="">Select...</option>
                  {['Under $500','$500 to $2,000','$2,000 to $5,000','$5,000 to $10,000','$10,000+'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Q4 */}
              <div>
                <label className={labelCls}>How did you hear about CreatorBridge? *</label>
                <select
                  value={onboardingAnswers.source}
                  onChange={e => setOnboardingAnswers(a => ({ ...a, source: e.target.value }))}
                  className={selectCls('')}>
                  <option value="">Select...</option>
                  {['Google search','Instagram','TikTok','Referral from a creator','Referral from a friend','LinkedIn','Other'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Quote form ── */}
          {!showOnboarding && (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* 1. Project Title */}
            <div>
              <label className={labelCls}>Project Title *</label>
              <input
                type="text"
                value={form.projectTitle}
                onChange={e => set('projectTitle', e.target.value)}
                placeholder="e.g. Brand video for product launch, Real estate listing at 123 Main St."
                className={inputCls('projectTitle')}
              />
              {errorMsg('projectTitle')}
            </div>

            {/* 2. Service Type */}
            <div>
              <label className={labelCls}>Service Type *</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map(svc => (
                  <button key={svc} type="button" onClick={() => set('serviceType', svc)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      form.serviceType === svc
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : errors.serviceType
                          ? 'border-red-500/50 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {svc}
                  </button>
                ))}
              </div>
              {errorMsg('serviceType')}
            </div>

            {/* 3. Project Type (conditional) */}
            {form.serviceType && (
              <div>
                <label className={labelCls}>Project Type *</label>
                <select value={form.projectType} onChange={e => set('projectType', e.target.value)} className={selectCls('projectType')}>
                  <option value="">Select project type...</option>
                  {(PROJECT_SUBTYPES[form.serviceType] || []).map(pt => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
                {errorMsg('projectType')}
                {form.projectType === 'Other' && (
                  <input
                    type="text"
                    value={form.otherProjectType}
                    onChange={e => set('otherProjectType', e.target.value)}
                    placeholder="Describe your specific project type..."
                    className={`mt-2 ${inputCls('otherProjectType')}`}
                  />
                )}
                {errorMsg('otherProjectType')}
              </div>
            )}

            {/* 4. Project Date */}
            <div>
              <label className={labelCls}>Event or Project Date *</label>
              <input
                type="date"
                value={form.projectDate}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={e => set('projectDate', e.target.value)}
                className={inputCls('projectDate')}
              />
              {errorMsg('projectDate')}
            </div>

            {/* 5. Project Time */}
            <div>
              <label className={labelCls}>Project Time *</label>
              <select value={form.projectTime} onChange={e => set('projectTime', e.target.value)} className={selectCls('projectTime')}>
                <option value="">Select time of day...</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errorMsg('projectTime')}
            </div>

            {/* 6. Location */}
            <div>
              <label className={labelCls}>Location *</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.venueAddress}
                  onChange={e => set('venueAddress', e.target.value)}
                  placeholder="Street address or venue name"
                  className={inputCls('venueAddress')}
                />
                {errorMsg('venueAddress')}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={form.venueCity}
                      onChange={e => set('venueCity', e.target.value)}
                      placeholder="City"
                      className={inputCls('venueCity')}
                    />
                    {errorMsg('venueCity')}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={form.venueState}
                      onChange={e => set('venueState', e.target.value)}
                      placeholder="State"
                      className={inputCls('venueState')}
                    />
                    {errorMsg('venueState')}
                  </div>
                </div>
                {/* Venue type toggle */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {VENUE_TYPES.map(vt => (
                    <button key={vt} type="button" onClick={() => set('venueType', vt)}
                      className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all ${
                        form.venueType === vt
                          ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                          : errors.venueType
                            ? 'border-red-500/50 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                            : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {vt}
                    </button>
                  ))}
                </div>
                {errorMsg('venueType')}
              </div>
            </div>

            {/* 7. Hours Needed */}
            <div>
              <label className={labelCls}>Hours Needed *</label>
              <select value={form.hoursNeeded} onChange={e => set('hoursNeeded', e.target.value)} className={selectCls('hoursNeeded')}>
                <option value="">Select duration...</option>
                {HOURS_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              {errorMsg('hoursNeeded')}
            </div>

            {/* 8. Number of Deliverables */}
            <div>
              <label className={labelCls}>How many final edited photos, videos, or deliverables do you expect? *</label>
              <select value={form.deliverables} onChange={e => set('deliverables', e.target.value)} className={selectCls('deliverables')}>
                <option value="">Select quantity...</option>
                {DELIVERABLE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {errorMsg('deliverables')}
            </div>

            {/* 9. Project Description */}
            <div>
              <label className={labelCls}>
                Describe your project and share a reference link *
                <span className={`ml-2 font-normal ${descLen >= 100 ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
                  ({descLen}/100 min)
                </span>
              </label>
              <textarea
                rows={5}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe what needs to be filmed or created. Include the style or mood you want, any specific shots or deliverables, and important details the creator needs to know. Feel free to paste a link to a YouTube, Instagram, TikTok, or any video that captures the look or vibe you are going for. The more detail you share, the better your matches will be."
                className={`${inputCls('description')} resize-none`}
              />
              {errorMsg('description')}
            </div>

            {/* 10. Budget Range */}
            <div>
              <label className={labelCls}>Budget Range *</label>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map(b => (
                  <button key={b} type="button" onClick={() => set('budgetRange', b)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      form.budgetRange === b
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : errors.budgetRange
                          ? 'border-red-500/50 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {b}
                  </button>
                ))}
              </div>
              {errorMsg('budgetRange')}
            </div>

            {/* 11. Location Preference */}
            <div>
              <label className={labelCls}>Location Preference *</label>
              <div className="flex flex-wrap gap-2">
                {LOCATION_PREF_OPTIONS.map(lp => (
                  <button key={lp} type="button" onClick={() => set('locationPreference', lp)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      form.locationPreference === lp
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : errors.locationPreference
                          ? 'border-red-500/50 ' + (dark ? 'text-charcoal-300' : 'text-gray-500')
                          : dark ? 'border-white/[0.07] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {lp}
                  </button>
                ))}
              </div>
              {errorMsg('locationPreference')}
            </div>

          {/* Honeypot field */}
          <input
            type="text"
            name="website_url"
            value={quoteHp}
            onChange={e => setQuoteHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
          />
          </form>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t shrink-0 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
          {showOnboarding ? (
            <>
              <button
                type="button"
                onClick={handleOnboardingContinue}
                disabled={!onboardingComplete}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-900 text-sm font-bold transition-all">
                Continue
              </button>
              <p className={`text-center text-[10px] mt-2 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
                Answer all 4 questions to continue.
              </p>
            </>
          ) : (
            <>
              <TurnstileWidget
                dark={dark}
                onVerify={token => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
              />
              {errors._turnstile && (
                <p className="text-xs text-red-400 mt-1 mb-2">{errors._turnstile}</p>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2 mt-2">
                <Send size={14} /> {loading ? 'Submitting...' : 'Submit Quote Request'}
              </button>
              <p className={`text-center text-[10px] mt-2 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
                No payment required to request a quote. The creator will review your brief and respond.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
