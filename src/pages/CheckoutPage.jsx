import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ArrowLeft, Check, CreditCard, Loader, Shield, AlertCircle, Briefcase,
} from 'lucide-react';
import { getStripe, stripeConfigured } from '../lib/stripe.js';
import { calcFees, dollarsToDisplay, PLATFORM_FEES, getLoyaltyTier } from '../config/fees.js';
import { FeeBreakdown } from '../components/FeeBreakdown.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { SERVICES, normalizeServiceId } from '../data/rates.js';

// ── Helpers ──────────────────────────────────────────────────────
function loadProject(projectId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-projects') || '[]');
    return all.find(p => p.id === projectId) || null;
  } catch { return null; }
}
function loadCreatorForProject(project) {
  try {
    const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
    const projectServiceId = normalizeServiceId(project.serviceId || project.service || project.serviceType);
    // Match by application acceptance or just return first matching service
    return all.find(c =>
      c.id === project.acceptedCreatorId ||
      (c.services || []).some(s => normalizeServiceId(s.serviceId || s.service_id || s.name) === projectServiceId)
    ) || null;
  } catch { return null; }
}

function saveLocalPaymentRecord({ project, creator, fees, userId, paymentType, paymentIntentId }) {
  const all = JSON.parse(localStorage.getItem('cm-transactions') || '[]');
  const existing = all.find(t => t.projectId === project.id && (t.creatorId === creator?.id || !t.creatorId));
  const now = new Date().toISOString();
  const base = existing || {
    id: Date.now().toString(),
    projectId:    project.id,
    projectTitle: project.title,
    creatorId:    creator?.id,
    creatorName:  creator?.businessName || creator?.name,
    clientId:     userId,
    projectAmount: fees.projectTotal * 100,
    retainerAmount: fees.retainerAmountCents,
    finalAmount:   fees.finalAmountCents,
    creatorFeeAmount: fees.creatorFeeRetainerCents,
    clientFeeAmount:  fees.clientFeeRetainerCents,
    platformRevenue:  fees.retainerAppFeeCents,
    retainerStatus: 'pending',
    finalStatus:    'pending',
    createdAt:      now,
  };

  const updated = {
    ...base,
    ...(paymentType === 'final'
      ? { finalStatus: 'paid', finalPaidAt: now, finalPaymentIntent: paymentIntentId }
      : { retainerStatus: 'paid', retainerPaidAt: now, retainerPaymentIntent: paymentIntentId }),
  };

  const next = existing
    ? all.map(t => t === existing ? updated : t)
    : [updated, ...all];
  localStorage.setItem('cm-transactions', JSON.stringify(next));

  const nextStatus = paymentType === 'final' ? 'final_paid' : 'retainer_paid';
  const projs = JSON.parse(localStorage.getItem('cm-projects') || '[]');
  localStorage.setItem('cm-projects', JSON.stringify(
    projs.map(p => p.id === project.id ? { ...p, status: nextStatus } : p)
  ));

  if (paymentType === 'retainer' && userId && fees.clientFeeRetainerCents === 0) {
    const key = `cm-profile-${userId}`;
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({
      ...profile,
      first_booking_fee_waived: false,
      next_booking_fee_waived: false,
    }));
  }
}

// ── Step indicator ────────────────────────────────────────────────
function StepBar({ step, dark }) {
  const steps = ['Review', 'Payment', 'Confirmed'];
  const textSub = dark ? 'text-charcoal-400' : 'text-gray-400';
  return (
    <div className={`flex items-center justify-center gap-0 mb-8 rounded-2xl border px-4 py-5 ${
      dark ? 'bg-charcoal-950/50 border-white/[0.07]' : 'bg-white border-gray-200'
    }`}>
      {steps.map((label, i) => {
        const idx      = i + 1;
        const done     = step > idx;
        const active   = step === idx;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? 'bg-gold-500 text-charcoal-950'
                : active ? 'bg-gold-500 text-charcoal-900'
                : dark ? 'bg-white/[0.04] text-charcoal-500' : 'bg-gray-200 text-gray-400'
              }`}>
                {done ? <Check size={14} /> : idx}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${active ? (dark ? 'text-white' : 'text-gray-900') : textSub}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 sm:w-24 h-px mx-2 mb-4 transition-all ${
                step > idx ? 'bg-gold-500/70' : dark ? 'bg-white/[0.08]' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Review ────────────────────────────────────────────────
function ReviewStep({ project, creator, fees, dark, paymentType, creatorFeePct, clientFeePct, onNext }) {
  const svc     = SERVICES[project?.serviceId];
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const isFinal = paymentType === 'final';

  return (
    <div className="space-y-4">
      {/* Creator info */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${dark ? 'bg-white/[0.04] ring-1 ring-white/[0.07]' : 'bg-gray-100'}`}>
            {creator?.avatar || svc?.icon || '🎬'}
          </div>
          <div>
            <p className={`font-bold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
              {creator?.businessName || creator?.name || 'Creator'}
            </p>
            <p className={`text-xs ${textSub}`}>{svc?.name || 'Creative Service'}</p>
          </div>
        </div>
        <div className={`rounded-xl p-3 ${dark ? 'bg-charcoal-950/65 border border-white/[0.07]' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{project?.title}</p>
          <p className={`text-xs leading-relaxed ${textSub}`}>{project?.description}</p>
        </div>
      </div>

      {/* Fee breakdown */}
      <FeeBreakdown
        projectAmount={(project?.budgetMax || project?.budgetMin || 0)}
        viewMode="client"
        dark={dark}
        creatorFeePct={creatorFeePct}
        clientFeePct={clientFeePct}
      />

      {clientFeePct === 0 && (
        <div className={`${cardCls} p-4 flex items-start gap-3`}>
          <Shield size={16} className="text-gold-400 shrink-0 mt-0.5" />
          <p className={`text-xs leading-relaxed ${textSub}`}>
            Referral reward applied. Your 5% client booking fee is waived on this booking.
          </p>
        </div>
      )}

      {/* Insurance disclaimer */}
      <div className={`${cardCls} p-4 flex items-start gap-3`}>
        <AlertCircle size={16} className="text-gold-400 shrink-0 mt-0.5" />
        <p className={`text-xs leading-relaxed ${textSub}`}>
          <span className={`font-semibold ${dark ? 'text-gold-300' : 'text-gold-700'}`}>Insurance notice: </span>
          CreatorBridge does not verify creator insurance coverage. If your project requires on-site work, confirm insurance details directly with your creator before this booking is confirmed.
        </p>
      </div>

      {/* Consent */}
      <div className={`${cardCls} p-4 flex items-start gap-3`}>
        <Shield size={16} className="text-gold-400 shrink-0 mt-0.5" />
        <p className={`text-xs leading-relaxed ${textSub}`}>
          {isFinal
            ? 'By proceeding, you agree to pay the remaining 50% project balance after delivery approval.'
            : `By proceeding, you agree to pay a 50% retainer to secure your booking. The remaining 50% is due upon delivery and approval. Retainer fees are refundable before work begins, minus a ${PLATFORM_FEES.cancellationFeePct}% cancellation fee.`}
        </p>
      </div>

      <button type="button" onClick={onNext}
        className="w-full py-3.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold text-sm transition-all flex items-center justify-center gap-2">
        <CreditCard size={15} /> Continue to {isFinal ? 'Final Payment' : 'Payment'}
      </button>
    </div>
  );
}

// ── Card form (inner, needs stripe context) ───────────────────────
function CardForm({ fees, project, creator, dark, paymentType, creatorFeePct, clientFeePct, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const isFinal = paymentType === 'final';
  const amountDue = isFinal ? fees.finalClientOwes : fees.retainerClientOwes;
  const amountDueCents = isFinal ? fees.finalClientOwesCents : fees.retainerClientOwesCents;

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');

    try {
      if (supabaseConfigured && !user?.id) {
        throw new Error('Please sign in as the client before making a payment.');
      }
      let clientSecret = null;

      if (supabaseConfigured) {
        // Call edge function to create PaymentIntent
        const { data, error: fnErr } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            projectId: project.id,
            creatorId: creator?.id,
            clientId: user?.id,
            paymentType,
          },
        });
        if (fnErr) throw fnErr;
        clientSecret = data?.clientSecret;
      } else {
        // In test/demo mode (no Supabase), simulate success
        await new Promise(r => setTimeout(r, 1500));
        const paymentIntentId = 'demo_' + Date.now();
        saveLocalPaymentRecord({ project, creator, fees, userId: user?.id, paymentType, paymentIntentId });
        onSuccess({ paymentIntentId, amount: amountDueCents });
        return;
      }

      const cardElement = elements.getElement(CardElement);
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeErr) throw new Error(stripeErr.message);
      if (paymentIntent.status === 'succeeded') {
        saveLocalPaymentRecord({ project, creator, fees, userId: user?.id, paymentType, paymentIntentId: paymentIntent.id });
        onSuccess({ paymentIntentId: paymentIntent.id, amount: paymentIntent.amount });
      }
    } catch (e) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    base: {
      fontSize:   '15px',
      color:      dark ? '#e5e7eb' : '#111827',
      fontFamily: 'DM Sans, sans-serif',
      '::placeholder': { color: dark ? '#6b7280' : '#9ca3af' },
    },
    invalid: { color: '#f87171' },
  };

  return (
    <div className="space-y-4">
      {/* Amount summary */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <div>
          <p className={`text-xs ${textSub}`}>{isFinal ? 'Final balance due now' : 'Retainer due now'}</p>
          <p className={`font-display font-bold text-2xl ${dark ? 'text-white' : 'text-gray-900'}`}>
            {dollarsToDisplay(amountDue)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[10px] ${textSub}`}>{isFinal ? 'Retainer already secured' : 'Remaining on delivery'}</p>
          <p className={`font-bold text-sm ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
            {isFinal ? dollarsToDisplay(fees.retainerClientOwes) : dollarsToDisplay(fees.finalClientOwes)}
          </p>
        </div>
      </div>

      {/* Card input */}
      <div className={`rounded-2xl border p-5 ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <p className={`text-xs font-medium mb-3 ${textSub}`}>Card details</p>
        <div className={`p-3 rounded-xl border transition-all ${dark ? 'bg-charcoal-950/75 border-white/[0.09]' : 'bg-gray-50 border-gray-300'}`}>
          <CardElement options={{ style: cardStyle, hidePostalCode: false }} />
        </div>
        <p className={`text-[10px] mt-3 flex items-center gap-1.5 ${textSub}`}>
          <Shield size={10} className="text-gold-400" />
          Secured by Stripe. Use test card: 4242 4242 4242 4242
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button type="button" onClick={handlePay} disabled={loading || !stripe}
        className="w-full py-3.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 font-bold text-sm transition-all flex items-center justify-center gap-2">
        {loading ? <Loader size={15} className="animate-spin" /> : <CreditCard size={15} />}
        {loading ? 'Processing...' : `Pay ${dollarsToDisplay(amountDue)} ${isFinal ? 'Final Balance' : 'Retainer'}`}
      </button>
    </div>
  );
}

// ── Step 2: Payment ───────────────────────────────────────────────
function PaymentStep({ fees, project, creator, dark, paymentType, creatorFeePct, clientFeePct, onSuccess }) {
  const stripePromise = getStripe();

  if (!stripeConfigured) {
    // Demo mode — show mock form that simulates success
    return (
      <DemoPaymentStep fees={fees} project={project} creator={creator} dark={dark} paymentType={paymentType} onSuccess={onSuccess} />
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CardForm
        fees={fees}
        project={project}
        creator={creator}
        dark={dark}
        paymentType={paymentType}
        creatorFeePct={creatorFeePct}
        clientFeePct={clientFeePct}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}

// Demo payment step for when Stripe keys are not configured
function DemoPaymentStep({ fees, project, creator, dark, paymentType, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const isFinal = paymentType === 'final';
  const amountDue = isFinal ? fees.finalClientOwes : fees.retainerClientOwes;
  const amountDueCents = isFinal ? fees.finalClientOwesCents : fees.retainerClientOwesCents;

  async function handleDemo() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    const paymentIntentId = 'demo_' + Date.now();
    saveLocalPaymentRecord({ project, creator, fees, paymentType, paymentIntentId });
    onSuccess({ paymentIntentId, amount: amountDueCents });
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 flex items-center justify-between ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <div>
          <p className={`text-xs ${textSub}`}>{isFinal ? 'Final balance due now' : 'Retainer due now'}</p>
          <p className={`font-display font-bold text-2xl ${dark ? 'text-white' : 'text-gray-900'}`}>
            {dollarsToDisplay(amountDue)}
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 space-y-3 ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center gap-2 p-3 rounded-xl ${dark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-gold-50 border border-gold-200'}`}>
          <AlertCircle size={14} className="text-gold-400 shrink-0" />
          <p className="text-xs text-gold-400">Demo mode: Add VITE_STRIPE_PUBLISHABLE_KEY to .env to enable real payments.</p>
        </div>
        <p className={`text-xs ${textSub}`}>Simulated card: 4242 4242 4242 4242 | Any future date | Any CVC</p>
        <div className={`p-3 rounded-xl border ${dark ? 'bg-charcoal-950/75 border-white/[0.09]' : 'bg-gray-50 border-gray-300'}`}>
          <p className={`text-sm font-mono ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>4242 4242 4242 4242</p>
        </div>
      </div>

      <button type="button" onClick={handleDemo} disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 font-bold text-sm transition-all flex items-center justify-center gap-2">
        {loading ? <Loader size={15} className="animate-spin" /> : <CreditCard size={15} />}
        {loading ? 'Processing...' : `Simulate Payment of ${dollarsToDisplay(amountDue)}`}
      </button>
    </div>
  );
}

// ── Step 3: Confirmation ──────────────────────────────────────────
function ConfirmationStep({ project, creator, fees, dark, paymentResult }) {
  const navigate = useNavigate();
  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls  = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const isFinal = paymentResult?.paymentType === 'final';

  return (
    <div className="space-y-4 text-center">
      {/* Animated check */}
      <div className="flex justify-center py-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gold-500/15 flex items-center justify-center animate-pulse ring-1 ring-gold-500/25">
            <div className="w-14 h-14 rounded-full bg-gold-500/25 flex items-center justify-center">
              <Check size={28} className="text-gold-400" strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className={`font-display font-bold text-2xl ${dark ? 'text-white' : 'text-gray-900'}`}>Booking confirmed!</h2>
        <p className={`text-sm mt-1 ${textSub}`}>
          Your {isFinal ? 'final payment' : 'retainer'} of {dollarsToDisplay(isFinal ? fees.finalClientOwes : fees.retainerClientOwes)} has been received.
        </p>
      </div>

      {/* Summary card */}
      <div className={`${cardCls} p-5 text-left`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>Booking Summary</p>
        {[
          { label: 'Project',          value: project?.title },
          { label: 'Creator',          value: creator?.businessName || creator?.name || 'Creator' },
          { label: 'Retainer paid',    value: dollarsToDisplay(fees.retainerClientOwes) },
          { label: 'Due on delivery',  value: isFinal ? '$0.00' : dollarsToDisplay(fees.finalClientOwes) },
          { label: 'Auto-approval in', value: `${PLATFORM_FEES.autoApproveDays} days after delivery` },
        ].map(({ label, value }) => (
          <div key={label} className={`flex justify-between items-center py-2 border-b last:border-0 ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
            <span className={`text-xs ${textSub}`}>{label}</span>
            <span className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => navigate('/projects')}
          className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${dark ? 'border-white/[0.09] text-charcoal-200 hover:text-white hover:border-gold-500/35' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
          View Projects
        </button>
        <button type="button" onClick={() => navigate('/messages')}
          className="flex-1 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
          Message Creator
        </button>
      </div>
    </div>
  );
}

// ── Main CheckoutPage ─────────────────────────────────────────────
export function CheckoutPage({ dark }) {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const [step, setStep]             = useState(1);
  const [project, setProject]       = useState(null);
  const [creator, setCreator]       = useState(null);
  const [paymentResult, setPayment] = useState(null);
  const [loading, setLoading]       = useState(true);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const paymentType = searchParams.get('payment') === 'final' ? 'final' : 'retainer';

  useEffect(() => {
    const p = loadProject(projectId);
    if (p) {
      setProject(p);
      setCreator(loadCreatorForProject(p));
    }
    setLoading(false);
  }, [projectId]);

  const projectAmount = project?.budgetMax || project?.budgetMin || 0;
  const loyaltyFeePct = getLoyaltyTier(creator?.completed_projects || creator?.completedProjects || 0).feePct;
  const referralFeePct = creator?.next_project_fee_pct ?? creator?.nextProjectFeePct;
  const creatorFeePct = referralFeePct != null
    ? Math.min(Number(referralFeePct), loyaltyFeePct)
    : loyaltyFeePct;
  const clientFeePct = (profile?.first_booking_fee_waived || profile?.next_booking_fee_waived) ? 0 : PLATFORM_FEES.clientFeePct;
  const fees          = calcFees(projectAmount, creatorFeePct, clientFeePct);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
        <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <Briefcase size={40} className="text-gold-400" />
        <h2 className="font-display text-xl font-bold">Project not found</h2>
        <button type="button" onClick={() => navigate('/projects')}
          className="px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Back button */}
        {step < 3 && (
          <button type="button"
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/projects')}
            className={`flex items-center gap-2 text-sm font-medium mb-6 transition-colors ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            <ArrowLeft size={16} /> {step > 1 ? 'Back' : 'Back to Projects'}
          </button>
        )}

        <div className={`relative overflow-hidden rounded-[28px] border p-5 md:p-8 ${
          dark ? 'bg-charcoal-900/72 border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <p className="text-gold-400 mb-3 text-center" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Secure Booking
          </p>
          <h1 className={`font-display text-3xl md:text-4xl font-bold text-center mb-6 ${dark ? 'text-white' : 'text-gray-900'}`}>
            {paymentType === 'final' ? 'Pay the remaining project balance.' : 'Confirm your CreatorBridge booking.'}
          </h1>

          <StepBar step={step} dark={dark} />

          {step === 1 && (
            <ReviewStep
              project={project}
              creator={creator}
              fees={fees}
              dark={dark}
              paymentType={paymentType}
              creatorFeePct={creatorFeePct}
              clientFeePct={clientFeePct}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <PaymentStep
              fees={fees}
              project={project}
              creator={creator}
              dark={dark}
              paymentType={paymentType}
              creatorFeePct={creatorFeePct}
              clientFeePct={clientFeePct}
              onSuccess={(result) => { setPayment({ ...result, paymentType }); setStep(3); }}
            />
          )}
          {step === 3 && (
            <ConfirmationStep project={project} creator={creator} fees={fees} dark={dark} paymentResult={paymentResult} />
          )}
        </div>
      </div>
    </div>
  );
}
