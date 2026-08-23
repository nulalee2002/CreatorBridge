import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { parsePngDataUrl, parseStorageReference } from '../_shared/contractPdfStorage.ts';
import { renderAndStoreChangeOrderPdf } from '../_shared/changeOrderPdfStorage.ts';
const CONSENT_TEXT='By signing, I agree this electronic signature is legally binding and approves only the changes written in this change order.';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});const limited= await checkRateLimit(req,{maxRequests:8,windowMs:60000,failClosed:true});if(limited)return limited;
 try{
  const {changeOrderId,signerName,method,signatureDataUrl,savedSignatureId,signedContentHash,consentText}=await req.json();
  if(!changeOrderId||String(signerName||'').trim().length<2||!['drawn','typed','saved'].includes(method)||consentText!==CONSENT_TEXT)return reply({error:'Complete signature and consent are required'},400);
  const admin=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const token=(req.headers.get('Authorization')||'').replace('Bearer ','');const {data:auth}=await admin.auth.getUser(token);if(!auth.user)return reply({error:'Authentication required'},401);
  const {data:order}=await admin.from('contract_change_orders').select('*').eq('id',changeOrderId).maybeSingle();if(!order)return reply({error:'Change order not found'},404);
  const signerRole=auth.user.id===order.client_id?'client':auth.user.id===order.creator_user_id?'creator':null;if(!signerRole)return reply({error:'Only project parties can sign'},403);
  if(!['proposed','client_signed','creator_signed'].includes(order.status))return reply({error:'This change order is not open for signature'},409);
  if(signedContentHash!==order.content_hash)return reply({error:'The change order changed. Review the current document.'},409);
  const {data:trustRows,error:trustError}=await admin.rpc('require_verified_project_parties',{p_project_id:order.project_id});const trust=Array.isArray(trustRows)?trustRows[0]:trustRows;
  if(trustError||!trust?.both_verified)return reply({error:'Both project parties must complete identity verification.',code:'IDENTITY_VERIFICATION_REQUIRED'},409);
  const {data:existing}=await admin.from('change_order_signatures').select('*').eq('change_order_id',order.id).eq('signer_role',signerRole).maybeSingle();
  if(existing)return reply({signature:existing,changeOrder:await renderAndStoreChangeOrderPdf(admin,req,order.id),idempotent:true});
  let bytes:Uint8Array;
  if(method==='saved'){
    const {data:saved}=await admin.from('saved_signatures').select('signature_image_ref').eq('id',savedSignatureId).eq('user_id',auth.user.id).maybeSingle();
    const parsed=parseStorageReference(saved?.signature_image_ref||'');if(!parsed||parsed.bucket!=='signatures')return reply({error:'Saved signature not found'},404);
    const {data:file}=await admin.storage.from(parsed.bucket).download(parsed.path);if(!file)return reply({error:'Saved signature could not be loaded'},500);bytes=new Uint8Array(await file.arrayBuffer());
  }else bytes=parsePngDataUrl(String(signatureDataUrl||''));
  const path=`change-orders/${order.id}/${signerRole}.png`;const {error:uploadError}=await admin.storage.from('signatures').upload(path,bytes,{contentType:'image/png',upsert:true,cacheControl:'0'});if(uploadError)throw uploadError;
  const {data:signature,error:insertError}=await admin.from('change_order_signatures').insert({change_order_id:order.id,signer_user_id:auth.user.id,signer_role:signerRole,signer_name:String(signerName).trim(),method,signature_image_ref:`storage://signatures/${path}`,consent_text:CONSENT_TEXT,signed_content_hash:order.content_hash,user_agent:req.headers.get('user-agent')||null,ip_address:(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||null}).select('*').single();
  if(insertError)throw insertError;
  const {data:refreshed,error:refreshError}=await admin.rpc('refresh_change_order_signature_status',{p_change_order_id:order.id});if(refreshError)throw refreshError;
  await admin.rpc('create_platform_notification',{
    p_recipient_id:signerRole==='client'?order.creator_user_id:order.client_id,
    p_type:refreshed.status==='active'||refreshed.status==='awaiting_additional_retainer'?'contract_countersigned':'contract_signed',
    p_title:refreshed.status==='active'?'No-cost change order active':refreshed.status==='awaiting_additional_retainer'?'Change order signed, added retainer due':'The other party signed the change order',
    p_body:refreshed.status==='awaiting_additional_retainer'?'The client pays the added retainer before the new scope becomes active.':'Review the project change-order status inside CreatorBridge.',
    p_action_url:'/projects',p_metadata:{project_id:order.project_id,change_order_id:order.id},p_actor_id:auth.user.id,p_response_due_at:null,
  });
  return reply({signature,changeOrder:await renderAndStoreChangeOrderPdf(admin,req,refreshed.id)});
 }catch(error){console.error('sign-change-order error:',error);return reply({error:error.message||'Change-order signature failed'},500)}
});
export { CONSENT_TEXT };
