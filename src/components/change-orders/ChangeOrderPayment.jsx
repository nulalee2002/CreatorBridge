import { useState } from 'react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { CreditCard, Loader2 } from 'lucide-react';
import { getStripe } from '../../lib/stripe.js';
import { supabase } from '../../lib/supabase.js';

function ChangeOrderPaymentForm({ order, phase, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pay() {
    setBusy(true); setError('');
    try {
      const { data, error: createError } = await supabase.functions.invoke('create-change-order-payment', { body: { changeOrderId: order.id, phase } });
      if (createError || !data?.clientSecret) throw createError || new Error('Payment could not be prepared');
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(data.clientSecret, { payment_method: { card } });
      if (result.error) throw result.error;
      if (result.paymentIntent?.status === 'succeeded') onPaid?.();
    } catch (err) { setError(err?.message || 'Added payment could not be completed.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-lg border border-gold-500/25 bg-gold-500/5 p-3">
      <p className="text-[11px] font-bold text-gold-300">{phase === 'retainer' ? 'New scope is not active until this payment succeeds.' : 'This is separate from the original project final.'}</p>
      <div className="mt-2 rounded-lg border border-white/10 bg-charcoal-950 p-3"><CardElement options={{ style: { base: { color:'#f3eadb',fontSize:'14px','::placeholder':{color:'#8a806e'} }, invalid:{color:'#fca5a5'} } }} /></div>
      <button type="button" onClick={pay} disabled={busy || !stripe} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 py-2 text-xs font-bold text-charcoal-950 disabled:opacity-45">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Pay added {phase}
      </button>
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

export function ChangeOrderPayment(props) {
  return <Elements stripe={getStripe()}><ChangeOrderPaymentForm {...props} /></Elements>;
}
