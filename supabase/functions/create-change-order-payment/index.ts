import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')||'',{apiVersion:'2024-06-20',httpClient:Stripe.createFetchHttpClient()});
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
function creatorFeePct(completed:number){return completed>=25?6:completed>=10?8:10}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});const limited=checkRateLimit(req,{maxRequests:10,windowMs:60000});if(limited)return limited;
 try{
  const {changeOrderId,phase}=await req.json();if(!changeOrderId||!['retainer','final'].includes(phase))return reply({error:'changeOrderId and valid phase are required'},400);
  const admin=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const token=(req.headers.get('Authorization')||'').replace('Bearer ','');const {data:auth}=await admin.auth.getUser(token);if(!auth.user)return reply({error:'Authentication required'},401);
  const {data:order}=await admin.from('contract_change_orders').select('*, project:projects(status), creator:creator_listings(completed_projects,stripe_account_id)').eq('id',changeOrderId).maybeSingle();
  if(!order)return reply({error:'Change order not found'},404);if(auth.user.id!==order.client_id)return reply({error:'Only the paying client can create this charge'},403);
  if(order.price_delta_cents<=0)return reply({error:'This no-cost change order does not require payment'},409);
  const {data:trustRows,error:trustError}=await admin.rpc('require_verified_project_parties',{p_project_id:order.project_id});const trust=Array.isArray(trustRows)?trustRows[0]:trustRows;
  if(trustError||!trust?.both_verified)return reply({error:'Both project parties must complete identity verification.',code:'IDENTITY_VERIFICATION_REQUIRED'},409);
  if(phase==='retainer'&&order.status!=='awaiting_additional_retainer')return reply({error:'Both signatures are required before the added retainer'},409);
  if(phase==='final'&&(order.status!=='active'||!['delivered','approved','completed','final_paid'].includes(order.project?.status)))return reply({error:'The added final is available after delivery'},409);
  const retainerAmountCents=Math.ceil(Number(order.price_delta_cents)/2);const finalAmountCents=Number(order.price_delta_cents)-retainerAmountCents;
  const feePct=creatorFeePct(Number(order.creator?.completed_projects||0));const clientFeePct=5;const clientFee=phase==='final'?Math.round(Number(order.price_delta_cents)*clientFeePct/100):0;
  const charge=phase==='retainer'?retainerAmountCents:finalAmountCents+clientFee;if(charge<50)return reply({error:'Added payment must meet Stripe minimum charge requirements'},409);
  let {data:ledger}=await admin.from('change_order_payments').select('*').eq('change_order_id',order.id).maybeSingle();
  const intentColumn=phase==='retainer'?'retainer_payment_intent':'final_payment_intent';const statusColumn=phase==='retainer'?'retainer_status':'final_status';
  if(['paid','released'].includes(ledger?.[statusColumn]))return reply({error:`Added ${phase} is already paid`},409);
  if(ledger?.[intentColumn]){
    const existing=await stripe.paymentIntents.retrieve(ledger[intentColumn]);
    if(existing.client_secret&&!['canceled','succeeded'].includes(existing.status))return reply({clientSecret:existing.client_secret,paymentIntentId:existing.id,amountCents:charge,reused:true});
  }
  const paymentIntent=await stripe.paymentIntents.create({
    amount:charge,currency:'usd',automatic_payment_methods:{enabled:true},
    metadata: {
      paymentFlow: 'change_order',
      paymentType:`change_order_${phase}`,
      changeOrderId:order.id,
      projectId:order.project_id,
    },
  },{idempotencyKey:`cb_change_order_${order.id}_${phase}`});
  const patch={change_order_id:order.id,project_id:order.project_id,client_id:order.client_id,creator_user_id:order.creator_user_id,creator_id:order.creator_id,added_amount_cents:order.price_delta_cents,retainer_amount_cents:retainerAmountCents,final_amount_cents:finalAmountCents,creator_fee_pct:feePct,client_fee_pct:clientFeePct,[intentColumn]:paymentIntent.id,[statusColumn]:'processing',updated_at:new Date().toISOString()};
  const {data:saved,error:saveError}=await admin.from('change_order_payments').upsert(patch,{onConflict:'change_order_id'}).select('*').single();if(saveError)throw saveError;
  return reply({clientSecret:paymentIntent.client_secret,paymentIntentId:paymentIntent.id,amountCents:charge,phase,ledgerId:saved.id});
 }catch(error){console.error('create-change-order-payment error:',error);return reply({error:error.message||'Added payment could not be created'},500)}
});
