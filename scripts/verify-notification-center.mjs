import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLIENT_EMAIL = process.env.CREATORBRIDGE_QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const CLIENT_PASSWORD = process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD || 'CB-Client-L8pN43sX!26';
const CREATOR_EMAIL = process.env.CREATORBRIDGE_QA_CREATOR_EMAIL || 'drl33+creator@creatorbridge.studio';
const CREATOR_PASSWORD = process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD || 'CB-Creator-K7mQ92rV!26';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeClient() {
  assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
  assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function signIn(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

const clientSupabase = makeClient();
const creatorSupabase = makeClient();
const adminSupabase = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
let messageId = null;
let notificationId = null;

try {
  const clientUser = await signIn(clientSupabase, CLIENT_EMAIL, CLIENT_PASSWORD);
  const creatorUser = await signIn(creatorSupabase, CREATOR_EMAIL, CREATOR_PASSWORD);

  const conversationId = crypto.randomUUID();
  const token = Date.now();
  const { data: message, error: messageError } = await clientSupabase.rpc('send_creatorbridge_message', {
    p_recipient_id: creatorUser.id,
    p_body: `Codex notification QA ${token}`,
    p_conversation_id: conversationId,
    p_listing_id: null,
  });
  if (messageError) throw messageError;
  messageId = message.id;

  const { data: notifications, error: notificationError } = await creatorSupabase
    .from('notifications')
    .select('id, type, title, body, read, response_due_at, metadata')
    .eq('type', 'direct_message_received')
    .eq('metadata->>message_id', messageId)
    .limit(1);
  if (notificationError) throw notificationError;

  const notification = notifications?.[0];
  assert(notification?.id, 'Creator notification was not created');
  notificationId = notification.id;
  assert(notification.read === false, 'New notification should start unread');
  assert(Boolean(notification.response_due_at), 'Notification response_due_at was not set');

  const dueMs = new Date(notification.response_due_at).getTime() - Date.now();
  assert(dueMs > 23 * 60 * 60 * 1000 && dueMs <= 25 * 60 * 60 * 1000, 'Response due date is not approximately 24 hours');

  const { data: blockedRead, error: blockedReadError } = await clientSupabase
    .from('notifications')
    .select('id')
    .eq('id', notificationId)
    .maybeSingle();
  if (blockedReadError) throw blockedReadError;
  assert(!blockedRead, 'RLS failed: client could read creator notification');

  const { error: markReadError } = await creatorSupabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (markReadError) throw markReadError;

  const unauthEmailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: 'nobody@example.com', template: 'support_ticket_opened', data: {} }),
  });
  assert(unauthEmailResponse.status === 401, `Unauthenticated email call should be blocked with 401, got ${unauthEmailResponse.status}`);

  console.log(JSON.stringify({
    ok: true,
    messageInserted: true,
    notificationCreated: true,
    responseDueHours: Math.round(dueMs / 3600000),
    rlsBlockedWrongUser: true,
    markReadWorked: true,
    unauthenticatedEmailBlocked: true,
  }, null, 2));
} finally {
  if (adminSupabase && notificationId) {
    await adminSupabase.from('notifications').delete().eq('id', notificationId);
  }
  if (adminSupabase && messageId) {
    await adminSupabase.from('messages').delete().eq('id', messageId);
  }
}
