import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Zap, Calendar, FileText, Package } from 'lucide-react';
import { SERVICES, PACKAGE_TIERS } from '../data/rates.js';
import { PILLARS, getSubNichesForPillar } from '../data/taxonomy.js';
import { getRate, formatCurrency } from '../utils/pricing.js';
import { PILLAR_TO_LEGACY_SERVICE } from './ServiceSelector.jsx';
import { StateCitySelector } from './StateCitySelector.jsx';

const STEPS = ['Pillar', 'Project Details', 'Review & Submit'];

const HOURS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40];
const DELIVERABLE_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20];

function saveQuote(quote) {
  try {
    const all = JSON.parse(localStorage.getItem('client-quotes') || '[]');
    all.unshift(quote);
    localStorage.setItem('client-quotes', JSON.stringify(all.slice(0, 50)));
  } catch {}
}

export function QuickQuoteMode({ dark = true, onFullMode }) {
  const navigate = useNavigate();

  // Step 0: service
  const [serviceId, setServiceId] = useState(null);

  // Step 1: project details
  const [location, setLocation]     = useState(null); // { state, city, regionKey }
  const [projectType, setProjectType] = useState('');
  const [hours, setHours]           = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [eventDate, setEventDate]   = useState('');
  const [notes, setNotes]           = useState('');
  const [notesError, setNotesError] = useState('');
  const [tier, setTier]             = useState('standard');

  // Step 2: submit
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [projectId, setProjectId]   = useState(null);

  const [step, setStep] = useState(0);

  const selectedPillar = Object.values(PILLARS).find(pillar => PILLAR_TO_LEGACY_SERVICE[pillar.id] === serviceId) || null;
  const service     = selectedPillar ? { ...selectedPillar, name: selectedPillar.name } : SERVICES[serviceId];
  const tiers       = serviceId ? PACKAGE_TIERS[serviceId] : null;
  const regionKey   = location?.regionKey || 'us-tier1';
  const subtypes    = selectedPillar ? getSubNichesForPillar(selectedPillar.id).map(sn => sn.label) : [];

  const calcTierTotal = (tierKey) => {
    const tierDef = tiers?.[tierKey];
    if (!tierDef || !serviceId) return 0;
    return (tierDef.items || []).reduce((sum, item) => {
      const range = getRate(serviceId, item.rateKey, regionKey);
      return range ? sum + range.mid * item.quantity : sum;
    }, 0);
  };
  const total = calcTierTotal(tier);
  const fmt   = (v) => formatCurrency(v, 'USD');

  const bg       = dark ? 'bg-charcoal-950/75' : 'bg-gray-50';
  const card     = dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark
      ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;
  const labelCls = `text-xs font-medium ${textSub} mb-1`;

  function validateAndNext() {
    if (step === 1) {
      if (notes.trim().length > 0 && notes.trim().length < 50) {
        setNotesError('Project notes must be at least 50 characters if provided.');
        return;
      }
      setNotesError('');
    }
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    if (notes.trim().length > 0 && notes.trim().length < 50) {
      setNotesError('Project notes must be at least 50 characters if provided.');
      return;
    }
    setSubmitting(true);
    const id = `quote-${Date.now()}`;
    const quote = {
      id,
      serviceId,
      primaryPillar: selectedPillar?.id || serviceId,
      serviceName: service?.name,
      projectType,
      location,
      hours,
      deliverables,
      eventDate,
      notes,
      tier,
      estimatedTotal: total,
      createdAt: new Date().toISOString(),
    };
    saveQuote(quote);
    setProjectId(id);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => navigate(`/matches/${id}`), 1200);
    }, 900);
  }

  const step1Complete = !!location;
  const canNext = (step === 0 && !!serviceId) || (step === 1 && step1Complete) || step === 2;

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      {/* Header */}
      <div className={`px-4 py-4 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-200'} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-gold-400" />
          <span className={`font-display font-bold text-sm ${textMain}`}>Quick Quote</span>
        </div>
        <button type="button" onClick={onFullMode} className={`text-xs ${textSub} hover:text-gold-400 transition-colors`}>
          Full Rate Calculator →
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
              i < step ? 'bg-gold-500 text-charcoal-900' :
              i === step ? 'bg-gold-500 text-charcoal-900' :
              dark ? 'bg-white/[0.04] text-charcoal-300' : 'bg-gray-200 text-gray-400'
            }`}>{i < step ? '✓' : i + 1}</div>
            <span className={`text-[11px] font-medium hidden sm:inline ${i === step ? 'text-gold-400' : textSub}`}>{s}</span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? 'bg-gold-500/50' : dark ? 'bg-white/[0.04]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">

        {/* Step 0: Service */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className={`font-display font-bold text-xl ${textMain}`}>Choose one primary pillar</h2>
            <p className={`text-xs leading-5 ${textSub}`}>
              Start with the main type of work, then narrow the request by specialty.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.values(PILLARS).map(pillar => {
                const legacyId = PILLAR_TO_LEGACY_SERVICE[pillar.id];
                return (
                <button key={pillar.id} type="button" onClick={() => setServiceId(legacyId)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all ${
                    serviceId === legacyId
                      ? 'border-gold-500 bg-gold-500/10'
                      : dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-2xl">{pillar.icon}</span>
                  <span className={`text-sm font-semibold ${serviceId === legacyId ? 'text-gold-400' : textMain}`}>{pillar.name}</span>
                  <span className={`text-[11px] leading-tight ${textSub}`}>{pillar.description}</span>
                </button>
              );})}
            </div>
          </div>
        )}

        {/* Step 1: Project Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className={`font-display font-bold text-xl ${textMain}`}>Tell us about your project</h2>

            {/* Location */}
            <div>
              <p className={`${labelCls}`}>Your Location *</p>
              <StateCitySelector value={location} onChange={setLocation} dark={dark} />
            </div>

            {/* Project type / subtype */}
            {subtypes.length > 0 && (
              <div>
                <p className={labelCls}>Specialty</p>
                <div className="flex flex-wrap gap-2">
                  {subtypes.map(st => (
                    <button key={st} type="button" onClick={() => setProjectType(st === projectType ? '' : st)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        projectType === st
                          ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                          : dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >{st}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Hours + Deliverables */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Hours Needed</p>
                <select value={hours} onChange={e => setHours(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {HOURS_OPTIONS.map(h => <option key={h} value={h}>{h} hr{h !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <p className={labelCls}>Deliverables</p>
                <select value={deliverables} onChange={e => setDeliverables(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {DELIVERABLE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Event date */}
            <div>
              <p className={labelCls}>
                <Calendar size={12} className="inline mr-1" />
                Event / Project Date
              </p>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={inputCls}
              />
            </div>

            {/* Package tier */}
            {tiers && (
              <div>
                <p className={labelCls}>
                  <Package size={12} className="inline mr-1" />
                  Budget Tier
                </p>
                <div className="space-y-2">
                  {Object.entries(tiers).map(([key, def]) => {
                    const tierTotal = calcTierTotal(key);
                    return (
                      <button key={key} type="button" onClick={() => setTier(key)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                          tier === key
                            ? 'border-gold-500 bg-gold-500/10'
                            : dark ? 'border-white/[0.07] bg-charcoal-900/72' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${tier === key ? 'text-gold-400' : textMain}`}>{def.name}</p>
                          <p className={`text-xs ${textSub}`}>{def.description}</p>
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${tier === key ? 'text-gold-400' : textMain}`}>{fmt(tierTotal)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Project notes */}
            <div>
              <p className={labelCls}>
                <FileText size={12} className="inline mr-1" />
                Project Notes
              </p>
              <textarea
                rows={4}
                value={notes}
                onChange={e => { setNotes(e.target.value); if (notesError) setNotesError(''); }}
                placeholder="Describe your project: vision, style, any specific requirements, timeline constraints... (50 characters minimum if provided)"
                className={`${inputCls} resize-none`}
              />
              <div className="flex items-center justify-between mt-1">
                {notesError
                  ? <p className="text-xs text-red-400">{notesError}</p>
                  : <p className={`text-[10px] ${textSub}`}>Min 50 chars if provided. More detail = better matches.</p>
                }
                <span className={`text-[10px] shrink-0 ml-2 ${notes.length >= 50 ? 'text-gold-400' : textSub}`}>{notes.length} chars</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review & Submit */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className={`font-display font-bold text-xl ${textMain}`}>
              {submitted ? 'Finding your matches…' : 'Review your request'}
            </h2>

            {!submitted && (
              <div className={`rounded-2xl border p-5 space-y-3 ${card}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{service?.icon}</span>
                  <div>
                    <p className={`font-bold text-base ${textMain}`}>{service?.name}</p>
                    {projectType && <p className={`text-xs ${textSub}`}>{projectType}</p>}
                  </div>
                </div>

                <div className={`divide-y ${dark ? 'divide-charcoal-700' : 'divide-gray-100'}`}>
                  {location && (
                    <div className="flex justify-between py-2">
                      <span className={`text-xs ${textSub}`}>Location</span>
                      <span className={`text-xs font-medium ${textMain}`}>{location.city}, {location.state}</span>
                    </div>
                  )}
                  {hours && (
                    <div className="flex justify-between py-2">
                      <span className={`text-xs ${textSub}`}>Hours needed</span>
                      <span className={`text-xs font-medium ${textMain}`}>{hours} hrs</span>
                    </div>
                  )}
                  {deliverables && (
                    <div className="flex justify-between py-2">
                      <span className={`text-xs ${textSub}`}>Deliverables</span>
                      <span className={`text-xs font-medium ${textMain}`}>{deliverables}</span>
                    </div>
                  )}
                  {eventDate && (
                    <div className="flex justify-between py-2">
                      <span className={`text-xs ${textSub}`}>Date</span>
                      <span className={`text-xs font-medium ${textMain}`}>{new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  {tiers?.[tier] && (
                    <div className="flex justify-between py-2">
                      <span className={`text-xs ${textSub}`}>Budget tier</span>
                      <span className={`text-xs font-medium ${textMain}`}>{tiers[tier].name} (~{fmt(total)})</span>
                    </div>
                  )}
                </div>

                {notes && (
                  <div className={`rounded-xl p-3 text-xs ${dark ? 'bg-charcoal-950/60 text-charcoal-300' : 'bg-gray-50 text-gray-600'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${textSub}`}>Project Notes</p>
                    {notes}
                  </div>
                )}

                <div className={`rounded-xl p-4 ${dark ? 'bg-charcoal-950/60' : 'bg-gray-50'}`}>
                  <p className={`text-xs ${textSub}`}>Estimated budget</p>
                  <p className="font-display text-3xl font-bold text-gradient-gold">{fmt(total)}</p>
                  <p className={`text-[11px] mt-1 ${textSub}`}>Mid-market rate estimate. Final price depends on your creator.</p>
                </div>
              </div>
            )}

            {submitted && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-gold-500/15 flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <p className={`text-sm font-semibold ${textMain}`}>Quote saved!</p>
                <p className={`text-xs ${textSub}`}>Redirecting to your creator matches…</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className={`px-4 py-4 border-t ${dark ? 'border-white/[0.07]' : 'border-gray-200'} flex gap-3`}>
        {step > 0 && !submitted && (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${dark ? 'border-white/[0.09] text-charcoal-300' : 'border-gray-200 text-gray-600'} text-sm font-medium transition-all`}>
            <ArrowLeft size={14} /> Back
          </button>
        )}
        {step < 2 && (
          <button type="button" onClick={validateAndNext} disabled={!canNext}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-40 transition-all">
            Next <ArrowRight size={14} />
          </button>
        )}
        {step === 2 && !submitted && (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all">
            {submitting ? 'Finding matches…' : 'Find My Matches →'}
          </button>
        )}
      </div>
    </div>
  );
}
