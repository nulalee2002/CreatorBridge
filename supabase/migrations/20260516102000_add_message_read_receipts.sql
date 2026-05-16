-- Allow participants to mark only their received messages as read.
-- This avoids a broad UPDATE policy on messages that could let users edit bodies.

create index if not exists idx_messages_conversation_recipient
  on public.messages(conversation_id, recipient_id, read);

create or replace function public.mark_conversation_messages_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.messages
  set read = true
  where conversation_id = p_conversation_id
    and recipient_id = auth.uid()
    and read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_conversation_messages_read(uuid) from public, anon;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;
