import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateCollaborationFees } from '../src/config/collaborationFees.js';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sql = readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).map(f=>readFileSync(join(root,'supabase/migrations',f),'utf8')).join('\n').toLowerCase();
const fnPath = join(root,'supabase/functions/create-collaboration-payment/index.ts');
const fn = existsSync(fnPath) ? readFileSync(fnPath,'utf8') : '';
const webhook = readFileSync(join(root,'supabase/functions/stripe-webhook/index.ts'),'utf8');
const tests = [];
const ok=(n,p)=>tests.push([n,!!p]);
ok('10 percent tier',calculateCollaborationFees(100000,0).creatorFeePct===10);
ok('8 percent tier',calculateCollaborationFees(100000,10).creatorFeePct===8);
ok('6 percent tier',calculateCollaborationFees(100000,25).creatorFeePct===6);
ok('$5 fee floor',calculateCollaborationFees(25000,25).platformFeeCents>=500);
ok('zero buyer platform fee',calculateCollaborationFees(25000,0).buyerFeeCents===0);
ok('prime pays ACH cost',calculateCollaborationFees(25000,0).primeChargeCents>25000);
ok('ledger exists',sql.includes('create table if not exists public.collaboration_payments'));
ok('ACH only',fn.includes("payment_method_types: ['us_bank_account']"));
ok('trusted amount',fn.includes("from('creator_collaborations')")&&!fn.includes('amountCents } = await req.json'));
ok('settlement authoritative',webhook.includes('creator_collaborations')&&webhook.includes("status: 'funded'"));
ok('returns handled',webhook.includes('payment_intent.payment_failed')&&webhook.includes('collaboration_payments'));
ok('idempotency',sql.includes('stripe_payment_intent_id text unique'));
ok('no tier advancement',sql.includes('internal collaboration payments do not advance public loyalty'));
const failed=tests.filter(([,p])=>!p); if(failed.length){console.error('Collaboration payments incomplete:');failed.forEach(([n])=>console.error(`- ${n}`));process.exit(1)}
const cfg={url:process.env.VITE_SUPABASE_URL,anon:process.env.VITE_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY,email:process.env.CREATORBRIDGE_QA_CREATOR_EMAIL,password:process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD,stripe:process.env.STRIPE_SECRET_KEY};
let live=null;
if(Object.values(cfg).every(Boolean)){
 const opts={auth:{persistSession:false,autoRefreshToken:false}};const prime=createClient(cfg.url,cfg.anon,opts);const admin=createClient(cfg.url,cfg.service,opts);const stripe=new Stripe(cfg.stripe);
 const {data:auth,error:ae}=await prime.auth.signInWithPassword({email:cfg.email,password:cfg.password});if(ae)throw ae;
 let uid,lid,pid,cid,paymentId,intentId;
 try{
  const {data:source,error:se}=await admin.from('creator_listings').select('*').eq('user_id',auth.user.id).eq('review_status','approved').limit(1).single();if(se)throw se;if(!source.stripe_account_id)throw new Error('QA creator payout account required');
  const {data:u,error:ue}=await admin.auth.admin.createUser({email:`qa-pay-${crypto.randomUUID()}@example.invalid`,email_confirm:true,user_metadata:{role:'creator',full_name:'QA Payee'}});if(ue)throw ue;uid=u.user.id;
  const copy={...source};for(const k of ['id','created_at','updated_at','search_vector'])delete copy[k];Object.assign(copy,{user_id:uid,name:'QA Payee',business_name:'QA Payee',email:`qa-${uid}@example.invalid`,review_status:'approved'});
  const {data:l,error:le}=await admin.from('creator_listings').insert(copy).select('id').single();if(le)throw le;lid=l.id;
  const {data:p,error:pe}=await admin.from('projects').insert({title:'QA ACH collaboration',description:'Temporary payment verification.',status:'collaboration_draft'}).select('id').single();if(pe)throw pe;pid=p.id;
  await admin.from('project_participants').insert([{project_id:pid,user_id:auth.user.id,participant_role:'prime_contractor',creator_listing_id:source.id,status:'active'},{project_id:pid,user_id:uid,participant_role:'subcontractor',creator_listing_id:lid,status:'active'}]);
  const {data:c,error:ce}=await admin.from('creator_collaborations').insert({project_id:pid,prime_user_id:auth.user.id,prime_listing_id:source.id,collaborator_user_id:uid,collaborator_listing_id:lid,service_category:'Post Production',scope:'Temporary ACH payment verification collaboration scope.',amount_cents:25000,deadline:'2030-01-01',project_context:'standalone',status:'accepted'}).select('id').single();if(ce)throw ce;cid=c.id;
  const {data:created,error:fe}=await prime.functions.invoke('create-collaboration-payment',{body:{collaborationId:cid}});
  if(fe||created?.error){
    let detail=created?.error||fe?.message||'Collaboration payment function failed';
    if(fe?.context){try{detail += `: ${await fe.context.text()}`}catch{}}
    throw new Error(detail);
  }
  intentId=created.paymentIntentId;
  const pi=await stripe.paymentIntents.retrieve(intentId);if(!pi.payment_method_types.includes('us_bank_account'))throw new Error('Live intent was not ACH-only');
  const {data:pay}=await admin.from('collaboration_payments').select('id,buyer_platform_fee_cents,ach_processing_cost_cents,status').eq('stripe_payment_intent_id',intentId).single();paymentId=pay.id;if(pay.buyer_platform_fee_cents!==0||pay.ach_processing_cost_cents<=0)throw new Error('Live fee isolation failed');
  live={achOnly:true,buyerFeeWaived:true,processingCostAssignedToPrime:true,status:'processing'};
 }finally{
  if(intentId){try{await stripe.paymentIntents.cancel(intentId)}catch{}}
  if(paymentId)await admin.from('collaboration_payments').delete().eq('id',paymentId);if(cid)await admin.from('creator_collaborations').delete().eq('id',cid);if(pid)await admin.from('projects').delete().eq('id',pid);if(lid)await admin.from('creator_listings').delete().eq('id',lid);if(uid)await admin.auth.admin.deleteUser(uid);await prime.auth.signOut();
 }
}
console.log(JSON.stringify({ok:true,checks:tests.length,live},null,2));
