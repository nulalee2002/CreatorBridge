-- The chatbot Edge Function validates the caller's JWT, then invokes this RPC
-- with the service-role client. Browser sessions must not be able to bypass
-- that boundary, choose another user id, or supply their own quota limit.
revoke all on function public.consume_chatbot_ai_quota(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.consume_chatbot_ai_quota(uuid, integer)
  to service_role;

comment on function public.consume_chatbot_ai_quota(uuid, integer) is
  'Service-role-only atomic daily quota counter for the authenticated chatbot Edge Function.';
