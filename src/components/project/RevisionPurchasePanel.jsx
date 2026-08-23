import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CreditCard, LockKeyhole } from 'lucide-react';
import { getStripe, stripeConfigured } from '../../lib/stripe.js';

function RevisionPaymentForm({ completion, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pay(event) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (result.error) setError(result.error.message || 'Payment could not be completed.');
    else {
      await completion.refresh();
      onPaid?.();
    }
    setBusy(false);
  }

  return <form onSubmit={pay} className="mt-3 space-y-3"><PaymentElement options={{ layout: 'tabs' }} />{error && <p className="text-xs text-red-300">{error}</p>}<button disabled={!stripe || busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-sm font-bold text-charcoal-950 disabled:opacity-50"><CreditCard size={14} />{busy ? 'Confirming…' : 'Pay $50.00 and unlock one revision'}</button></form>;
}

export function RevisionPurchasePanel({ completion }) {
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    if (!stripeConfigured) return setError('Secure revision checkout is not configured. Contact CreatorBridge support.');
    setBusy(true);
    setError('');
    try {
      setPayment(await completion.beginRevisionPurchase(crypto.randomUUID()));
    } catch (cause) {
      setError(cause?.message || 'Revision checkout could not be prepared.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-xl border border-gold-500/25 bg-gold-500/10 p-4"><div className="flex items-start gap-3"><LockKeyhole size={16} className="mt-0.5 text-gold-400" /><div><p className="text-sm font-bold text-gold-300">Additional revision required</p><p className="mt-1 text-xs leading-5 text-charcoal-300">Both included revisions have been used. Pay exactly $50.00 to unlock one additional revision request. You can purchase another whenever needed.</p></div></div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}{payment?.clientSecret ? <Elements stripe={getStripe()} options={{ clientSecret: payment.clientSecret, appearance: { theme: 'night' } }}><RevisionPaymentForm completion={completion} onPaid={() => setPayment(null)} /></Elements> : <button type="button" disabled={busy} onClick={begin} className="mt-3 w-full rounded-xl bg-gold-500 py-2.5 text-xs font-bold text-charcoal-950 disabled:opacity-50">{busy ? 'Preparing secure payment…' : 'Purchase one revision for $50.00'}</button>}</div>;
}
