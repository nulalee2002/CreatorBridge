import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { normalizeServiceId, SERVICE_TYPE_OPTIONS } from '../data/rates.js';

// ── Static option sets (shared with RequestQuoteModal) ────────

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

const DELIVERABLE_OPTIONS = ['1','2','3','4','5','6','8','10','15','20','20+'];

const BUDGET_OPTIONS = [
  'Under $500',
  '$500 to $1,500',
  '$1,500 to $5,000',
  '$5,000 to $10,000',
  '$10,000+',
];

const LOCATION_PREF_OPTIONS = ['Local only', 'Remote OK', 'Either works'];
const VENUE_TYPES = ['Indoor', 'Outdoor', 'Studio', 'Remote/Virtual'];

const today = new Date().toISOString().split('T')[0];

/**
 * IntentGate — shown when a client wants to find creators via Smart Match.
 * Collects the full 11-field project brief before running matching.
 *
 * Props:
 *   dark         — boolean
 *   onClose      — fn (called when user dismisses)
 *   prefillService — optional service type string to pre-select
 *   mode         — 'modal' (default) | 'inline'
 */
export function IntentGate({ dark, onClose, prefillService, mode = 'modal' }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    projectTitle:        '',
    serviceType:         prefillService || '',
    projectType:         '',
    otherProjectType:    '',
    projectDate:         '',
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

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'serviceType') { next.projectType = ''; next.otherProjectType = ''; }
      if (k === 'projectType') next.otherProjectType = '';
      return next;
    });
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const labelCls = `text-xs font-medium block mb-1.5 ${textSub}`;

  const inputCls = (field) => `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    errors[field]
      ? 'border-red-500 bg-red-500/5'
      : dark
        ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  const selectCls = (field) => `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    errors[field]
      ? 'border-red-500 bg-red-500/5'
      : dark
        ? 'bg-charcoal-950/70 border-white/[0.09] text-white focus:border-gold-500'
        : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gold-500'
  }`;

  const chipCls = (active, hasError) => `px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
    active
      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
      : hasError
        ? 'border-red-500/50 ' + textSub
        : dark ? 'border-white/[0.08] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
  }`;

  const errorMsg = (field) => errors[field] ? (
    <p className="text-xs text-red-400 mt-1">{errors[field]}</p>
  ) : null;

  const descLen = form.description.length;

  function validate() {
    const e = {};
    if (!form.projectTitle.trim())       e.projectTitle       = 'Give your project a clear title so creators understand what this is.';
    if (!form.serviceType)               e.serviceType        = 'Select the type of production service you need.';
    if (!form.projectType)               e.projectType        = 'Select the specific type of project within your chosen service.';
    if (form.projectType === 'Other' && !form.otherProjectType.trim()) e.otherProjectType = 'Please describe your specific project type.';
    if (!form.projectDate)               e.projectDate        = 'Creators need to know when to show up or when this is due.';
    else if (form.projectDate <= today)  e.projectDate        = 'Project date must be in the future.';
    if (!form.projectTime)               e.projectTime        = 'Time of day affects lighting, crew scheduling, and availability.';
    if (!form.venueAddress.trim())       e.venueAddress       = 'Creators need to know exactly where to show up.';
    if (!form.venueCity.trim())          e.venueCity          = 'Please enter the city.';
    if (!form.venueState.trim())         e.venueState         = 'Please enter the state.';
    if (!form.venueType)                 e.venueType          = 'Select Indoor, Outdoor, Studio, or Remote/Virtual.';
    if (!form.hoursNeeded)               e.hoursNeeded        = 'How long do you need the creator on site or working on your project?';
    if (!form.deliverables)              e.deliverables       = 'This helps creators estimate the editing time and scope.';
    if (descLen < 100)                   e.description        = 'Please provide at least 100 characters so creators understand your vision.';
    if (!form.budgetRange)               e.budgetRange        = 'Selecting a budget range helps match you with creators who fit your project.';
    if (!form.locationPreference)        e.locationPreference = 'Let creators know if they need to be in your area.';
    return e;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    const serviceId = normalizeServiceId(form.serviceType);

    const project = {
      id:                 Date.now().toString() + Math.random(),
      title:              form.projectTitle.trim(),
      serviceId,
      serviceType:        form.serviceType,
      projectType:        form.projectType === 'Other' ? (form.otherProjectType.trim() || 'Other') : form.projectType,
      projectDate:        form.projectDate,
      projectTime:        form.projectTime,
      location: {
        address:          form.venueAddress.trim(),
        city:             form.venueCity.trim(),
        state:            form.venueState.trim(),
        venueType:        form.venueType,
      },
      hoursNeeded:        form.hoursNeeded,
      deliverables:       form.deliverables,
      description:        form.description.trim(),
      budgetRange:        form.budgetRange,
      locationPreference: form.locationPreference,
      status:             'open',
      clientId:           'intent-' + Date.now(),
      clientName:         'Client',
      createdAt:          new Date().toISOString(),
    };

    try {
      const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
      localStorage.setItem('cm-projects', JSON.stringify([project, ...all]));
    } catch {}

    onClose?.();
    navigate(`/matches/${project.id}`);
  }

  const inner = (
    <div className={mode === 'modal' ? 'p-5' : ''}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gold-500/20 flex items-center justify-center">
            <Zap size={15} className="text-gold-400" />
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${textSub}`}>Smart Match</p>
        </div>
        <h3 className={`font-display font-bold text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>
          Tell us about your project
        </h3>
        <p className={`text-sm mt-1 ${textSub}`}>
          Fill in the details below and we will match you with available creators.
        </p>
      </div>

      <div className="space-y-4">

        {/* 1. Project Title */}
        <div>
          <label className={labelCls}>Project Title *</label>
          <input type="text" value={form.projectTitle} onChange={e => set('projectTitle', e.target.value)}
            placeholder="e.g. Brand video for product launch, Real estate listing at 123 Main St."
            className={inputCls('projectTitle')} />
          {errorMsg('projectTitle')}
        </div>

        {/* 2. Service Type */}
        <div>
          <label className={labelCls}>Service Type *</label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPES.map(svc => (
              <button key={svc} type="button" onClick={() => set('serviceType', svc)}
                className={chipCls(form.serviceType === svc, !!errors.serviceType)}>
                {svc}
              </button>
            ))}
          </div>
          {errorMsg('serviceType')}
        </div>

        {/* 3. Project Type */}
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
          <input type="date" value={form.projectDate}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            onChange={e => set('projectDate', e.target.value)}
            className={inputCls('projectDate')} />
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
            <input type="text" value={form.venueAddress} onChange={e => set('venueAddress', e.target.value)}
              placeholder="Street address or venue name" className={inputCls('venueAddress')} />
            {errorMsg('venueAddress')}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input type="text" value={form.venueCity} onChange={e => set('venueCity', e.target.value)}
                  placeholder="City" className={inputCls('venueCity')} />
                {errorMsg('venueCity')}
              </div>
              <div>
                <input type="text" value={form.venueState} onChange={e => set('venueState', e.target.value)}
                  placeholder="State" className={inputCls('venueState')} />
                {errorMsg('venueState')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {VENUE_TYPES.map(vt => (
                <button key={vt} type="button" onClick={() => set('venueType', vt)}
                  className={chipCls(form.venueType === vt, !!errors.venueType)}>
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
          <label className={labelCls}>How many final deliverables do you expect? *</label>
          <select value={form.deliverables} onChange={e => set('deliverables', e.target.value)} className={selectCls('deliverables')}>
            <option value="">Select quantity...</option>
            {DELIVERABLE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errorMsg('deliverables')}
        </div>

        {/* 9. Description */}
        <div>
          <label className={labelCls}>
            Describe your project and share a reference link *
            <span className={`ml-2 font-normal ${descLen >= 100 ? 'text-gold-400' : textSub}`}>
              ({descLen}/100 min)
            </span>
          </label>
          <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Describe what needs to be filmed or created. Include the style or mood you want, any specific shots or deliverables, and important details the creator needs to know. Feel free to paste a link to a YouTube, Instagram, TikTok, or any video that captures the look or vibe you are going for. The more detail you share, the better your matches will be."
            className={`${inputCls('description')} resize-none`} />
          {errorMsg('description')}
        </div>

        {/* 10. Budget Range */}
        <div>
          <label className={labelCls}>Budget Range *</label>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map(b => (
              <button key={b} type="button" onClick={() => set('budgetRange', b)}
                className={chipCls(form.budgetRange === b, !!errors.budgetRange)}>
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
                className={chipCls(form.locationPreference === lp, !!errors.locationPreference)}>
                {lp}
              </button>
            ))}
          </div>
          {errorMsg('locationPreference')}
        </div>

      </div>

      <div className="flex gap-2 mt-6">
        {onClose && mode === 'modal' && (
          <button type="button" onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            Cancel
          </button>
        )}
        <button type="button" onClick={handleSubmit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
          <Zap size={14} /> {loading ? 'Finding matches...' : 'Find My Creators'}
        </button>
      </div>
    </div>
  );

  if (mode === 'inline') return inner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full max-w-xl rounded-2xl border max-h-[90vh] overflow-y-auto ${dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200 shadow-2xl'}`}>
        <div className="h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
        {onClose && (
          <button type="button" onClick={onClose}
            className={`absolute top-4 right-4 p-1.5 rounded-lg z-10 ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X size={16} />
          </button>
        )}
        {inner}
      </div>
    </div>
  );
}
