import { useState } from 'react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { AlertTriangle, CreditCard, Loader } from 'lucide-react';
import { getStripe, stripeConfigured } from '../../lib/stripe.js';

function RecoveryForm({ completion, transaction, dark }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function recover(event) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    try {
      const prepared = await completion.beginFinalPaymentRecovery();
      if (!prepared?.clientSecret) throw new Error('Secure final payment could not be prepared.');
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(prepared.clientSecret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message || 'Final payment could not be confirmed.');
      setSubmitted(true);
      await completion.refresh();
    } catch (cause) {
      setError(cause?.message || 'Final payment could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return <p className="mt-3 rounded-xl border border-gold-500/25 bg-gold-500/10 p-3 text-xs leading-5 text-gold-200">Stripe received the payment confirmation. CreatorBridge is verifying the signed webhook now; funds are not released until Stripe confirms success.</p>;
  }

  const cardStyle = {
    base: {
      color: dark ? '#f3eadb' : '#111827',
      fontSize: '14px',
      '::placeholder': { color: dark ? '#8a806e' : '#9ca3af' },
    },
    invalid: { color: '#f87171' },
  };

  return <form onSubmit={recover} className="mt-4 space-y-3"><div className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-white'}`}><CardElement options={{ style: cardStyle, hidePostalCode: false }} /></div>{error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}<button type="submit" disabled={!stripe || busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-sm font-bold text-charcoal-950 disabled:opacity-50">{busy ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}{busy ? 'Confirming secure payment…' : 'Update card and complete final payment'}</button></form>;
}

export function FinalPaymentAttention({ completion, dark }) {
  const transaction = completion.paymentState;
  if (!transaction || !['attention', 'failed'].includes(transaction.final_status)) return null;

  return <section data-status="final_payment_attention" className={`rounded-2xl border p-4 ${dark ? 'border-red-500/30 bg-red-500/10 text-white' : 'border-red-200 bg-red-50 text-gray-900'}`}><div className="flex items-start gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" /><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Payment attention</p><h3 className="mt-1 font-display text-lg font-bold">Complete the final project payment</h3><p className={`mt-2 text-xs leading-5 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{transaction.final_payment_error_message || 'Stripe needs a current payment method before the final balance can be completed.'}</p><p className={`mt-2 text-xs leading-5 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>The delivery is approved, but payment is not marked paid and the creator payout is not released until Stripe confirms success through its signed webhook.</p></div></div>{stripeConfigured ? <Elements stripe={getStripe()}><RecoveryForm completion={completion} transaction={transaction} dark={dark} /></Elements> : <p className="mt-3 text-xs text-red-300">Secure Stripe checkout is temporarily unavailable. Contact CreatorBridge support.</p>}</section>;
}
