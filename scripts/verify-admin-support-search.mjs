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

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
assert(SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY');

function makeAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

const anon = makeAnonClient();
const client = makeAnonClient();
const creator = makeAnonClient();
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ticketId = null;

try {
  const clientUser = await signIn(client, CLIENT_EMAIL, CLIENT_PASSWORD);
  await signIn(creator, CREATOR_EMAIL, CREATOR_PASSWORD);

  const token = Date.now();
  const { data: ticket, error: ticketError } = await client
    .from('support_tickets')
    .insert({
      user_id: clientUser.id,
      user_type: 'client',
      category: 'technical',
      subject: `Codex support QA ${token}`,
      description: `Codex support QA description ${token}`,
    })
    .select('id, status, priority, user_id')
    .single();
  if (ticketError) throw ticketError;
  ticketId = ticket.id;

  assert(ticket.user_id === clientUser.id, 'Support ticket was not owned by the submitting client');
  assert(ticket.status === 'open', 'Support ticket should default to open');
  assert(ticket.priority === 'normal', 'Support ticket should default to normal priority');

  const { data: ownTicket, error: ownReadError } = await client
    .from('support_tickets')
    .select('id')
    .eq('id', ticketId)
    .maybeSingle();
  if (ownReadError) throw ownReadError;
  assert(ownTicket?.id === ticketId, 'Submitting client could not read their own support ticket');

  const { data: blockedTicket, error: blockedReadError } = await creator
    .from('support_tickets')
    .select('id')
    .eq('id', ticketId)
    .maybeSingle();
  if (blockedReadError) throw blockedReadError;
  assert(!blockedTicket, 'Unrelated creator could read a client support ticket');

  const { data: clientUpdateRows, error: clientUpdateError } = await client
    .from('support_tickets')
    .update({ status: 'resolved', admin_notes: 'client should not be able to write admin notes' })
    .eq('id', ticketId)
    .select('id');
  assert(
    Boolean(clientUpdateError) || clientUpdateRows.length === 0,
    'Non-admin client was able to update support ticket admin fields'
  );

  const { data: storedTicket, error: storedTicketError } = await admin
    .from('support_tickets')
    .select('id, status, admin_notes')
    .eq('id', ticketId)
    .single();
  if (storedTicketError) throw storedTicketError;
  assert(storedTicket.status === 'open', 'Support ticket status changed after blocked client update');
  assert(!storedTicket.admin_notes, 'Support ticket admin_notes changed after blocked client update');

  const { data: clientIsAdmin, error: clientAdminError } = await client.rpc('is_platform_admin');
  if (clientAdminError) throw clientAdminError;
  assert(clientIsAdmin === false, 'Client test account should not be a platform admin');

  const { error: summaryError } = await client.rpc('get_admin_platform_summary');
  assert(Boolean(summaryError), 'Non-admin client could read admin platform summary');
  assert(/Admin access required/i.test(summaryError.message || ''), `Unexpected admin summary error: ${summaryError.message}`);

  const { error: queueError } = await client.rpc('get_admin_creator_review_queue');
  assert(Boolean(queueError), 'Non-admin client could read admin creator review queue');
  assert(/Admin access required/i.test(queueError.message || ''), `Unexpected admin queue error: ${queueError.message}`);

  const { data: searchResults, error: searchError } = await anon.rpc('search_creators', { query: 'video' });
  if (searchError) throw searchError;
  assert(Array.isArray(searchResults), 'search_creators did not return an array');
  assert(searchResults.length > 0, 'search_creators returned no approved creators for "video"');
  const firstSearchResult = searchResults[0];
  assert('primary_pillar' in firstSearchResult, 'search_creators results are missing primary_pillar');
  assert('sub_niches' in firstSearchResult, 'search_creators results are missing sub_niches');

  const [financeRows, analyticsCreators, analyticsTickets] = await Promise.all([
    admin.from('transactions').select('id, project_amount, creator_fee_amount, client_fee_pct, retainer_status, final_status').limit(5),
    admin.from('creator_listings').select('id, review_status, verified, tier, primary_pillar, sub_niches').limit(5),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  if (financeRows.error) throw financeRows.error;
  if (analyticsCreators.error) throw analyticsCreators.error;
  if (analyticsTickets.error) throw analyticsTickets.error;

  assert(Array.isArray(financeRows.data), 'Admin finance transaction source query failed');
  assert(Array.isArray(analyticsCreators.data), 'Admin analytics creator source query failed');

  console.log(JSON.stringify({
    ok: true,
    supportTicketCreated: true,
    supportTicketOwnerCanRead: true,
    unrelatedCreatorBlockedFromTicket: true,
    nonAdminTicketUpdateBlocked: true,
    nonAdminSummaryBlocked: true,
    nonAdminReviewQueueBlocked: true,
    platformSearchReturnedPillarFields: true,
    adminFinanceSourceReachable: true,
    adminAnalyticsSourceReachable: true,
    openSupportTicketCount: analyticsTickets.count ?? null,
  }, null, 2));
} finally {
  if (ticketId) {
    await admin.from('support_tickets').delete().eq('id', ticketId);
  }
}
