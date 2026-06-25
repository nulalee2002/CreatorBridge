import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '../lib/stripe.js';
import { supabase } from '../lib/supabase.js';

function ACHForm({ summary }) {
  const stripe = useStripe(); const elements = useElements(); const navigate = useNavigate();
  const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  const submit=async(e)=>{e.preventDefault();setSaving(true);const result=await stripe.confirmPayment({elements,confirmParams:{return_url:`${window.location.origin}/dashboard?collaboration=processing`},redirect:'if_required'});setSaving(false);if(result.error)setError(result.error.message);else navigate('/dashboard?collaboration=processing');};
  return <form onSubmit={submit} className="space-y-5"><div className="rounded-xl border border-gold-500/20 bg-gold-500/10 p-4 text-sm"><div className="flex justify-between"><span>Collaboration</span><strong>${(summary.baseAmountCents/100).toFixed(2)}</strong></div><div className="mt-2 flex justify-between"><span>ACH processing cost</span><strong>${(summary.processingCostCents/100).toFixed(2)}</strong></div><div className="mt-3 flex justify-between border-t border-gold-500/20 pt-3"><span>Total bank debit</span><strong>${(summary.primeChargeCents/100).toFixed(2)}</strong></div><p className="mt-3 text-xs text-charcoal-300">Buyer platform fee: $0. The collaborator pays their earned {summary.creatorFeePct}% creator fee. Do not begin work until funded.</p></div><PaymentElement options={{ layout:'tabs' }}/>{error&&<p className="text-sm text-red-300">{error}</p>}<button disabled={!stripe||saving} className="btn-gold w-full justify-center py-3">{saving?'Confirming ACH…':'Fund collaboration by ACH'}</button></form>;
}

export function CollaborationCheckoutPage() {
  const { collaborationId }=useParams(); const [secret,setSecret]=useState(''); const [summary,setSummary]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{supabase.functions.invoke('create-collaboration-payment',{body:{collaborationId}}).then(({data,error:e})=>{if(e||data?.error)setError(data?.error||e.message);else{setSecret(data.clientSecret);setSummary(data);}})},[collaborationId]);
  return <main className="mx-auto max-w-2xl px-5 py-12 text-white"><p className="text-[10px] uppercase tracking-[.25em] text-gold-400">Protected creator payment</p><h1 className="mt-2 font-display text-4xl font-bold">Fund your collaborator</h1><p className="mt-3 mb-7 text-sm text-charcoal-300">ACH settlement can take several business days. The private production workspace stays locked until Stripe confirms settlement.</p>{error?<p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">{error}</p>:secret&&summary?<Elements stripe={getStripe()} options={{clientSecret:secret,appearance:{theme:'night'}}}><ACHForm summary={summary}/></Elements>:<p>Preparing secure ACH payment…</p>}</main>;
}
