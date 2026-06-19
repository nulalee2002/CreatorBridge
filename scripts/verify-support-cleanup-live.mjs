import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('Live support cleanup verification requires Supabase environment variables');

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const endpoint = `${url}/functions/v1/cleanup-support-screenshots`;
const fileName = `${crypto.randomUUID()}.jpg`;
const screenshotPath = `qa-retention/${fileName}`;
let ticketId = null;

try {
  const unauthorized = await fetch(endpoint, { method: 'POST' });
  if (unauthorized.status !== 401) throw new Error(`Cleanup endpoint accepted an unauthenticated call (${unauthorized.status})`);

  const { data: config, error: configError } = await supabase
    .from('support_report_config')
    .select('cleanup_token,retention_days,delete_row_after_resolve')
    .eq('id', true)
    .single();
  if (configError) throw configError;
  if (config.delete_row_after_resolve) throw new Error('Full support-ticket deletion must remain disabled');

  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==', 'base64');
  const { error: uploadError } = await supabase.storage
    .from('support-screenshots')
    .upload(screenshotPath, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const resolvedAt = new Date(Date.now() - (Number(config.retention_days) + 1) * 86_400_000).toISOString();
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      user_type: 'client',
      category: 'technical',
      subject: 'QA retention cleanup verification',
      description: 'Temporary automated verification row.',
      status: 'resolved',
      updated_at: resolvedAt,
      screenshot_path: screenshotPath,
    })
    .select('id')
    .single();
  if (ticketError) throw ticketError;
  ticketId = ticket.id;

  const cleanupResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-cleanup-token': config.cleanup_token },
  });
  const cleanupBody = await cleanupResponse.json();
  if (!cleanupResponse.ok) throw new Error(`Cleanup request failed: ${cleanupBody.error || cleanupResponse.status}`);

  const { data: retainedTicket, error: retainedError } = await supabase
    .from('support_tickets')
    .select('id,screenshot_path')
    .eq('id', ticketId)
    .single();
  if (retainedError) throw retainedError;
  if (retainedTicket.screenshot_path !== null) throw new Error('Cleanup did not clear the stored screenshot path');

  const { data: remainingFiles, error: listError } = await supabase.storage
    .from('support-screenshots')
    .list('qa-retention', { search: fileName });
  if (listError) throw listError;
  if ((remainingFiles || []).some(file => file.name === fileName)) throw new Error('Cleanup left the screenshot in Storage');

  console.log(JSON.stringify({
    ok: true,
    unauthorizedCallBlocked: true,
    screenshotRemoved: true,
    ticketRowRetained: true,
    deleteRowsByDefault: false,
  }, null, 2));
} finally {
  if (ticketId) await supabase.from('support_tickets').delete().eq('id', ticketId);
  await supabase.storage.from('support-screenshots').remove([screenshotPath]);
}
