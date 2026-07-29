import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { renderAndStoreChangeOrderPdf } from '../_shared/changeOrderPdfStorage.ts';
const headers = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json' };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  const limited=checkRateLimit(req,{maxRequests:10,windowMs:60000});if(limited)return limited;
  try{
    const {changeOrderId}=await req.json();
    const admin=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
    const token=(req.headers.get('Authorization')||'').replace('Bearer ','');
    const {data:auth}=await admin.auth.getUser(token);if(!auth.user)return reply({error:'Authentication required'},401);
    const {data:order}=await admin.from('contract_change_orders').select('id,client_id,creator_user_id,status').eq('id',changeOrderId).maybeSingle();
    if(!order)return reply({error:'Change order not found'},404);
    if(![order.client_id,order.creator_user_id].includes(auth.user.id))return reply({error:'Project party access required'},403);
    if(order.status!=='draft')return reply({error:'Only a draft document can be generated'},409);
    return reply({changeOrder:await renderAndStoreChangeOrderPdf(admin,req,order.id)});
  }catch(error){console.error('generate-change-order error:',error);return reply({error:error.message||'Change-order generation failed'},500)}
});
