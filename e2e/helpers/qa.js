import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const AUTH_DIR = join(process.cwd(), 'e2e/.auth');
export const authFile = role => join(AUTH_DIR, `${role}.json`);

export function qaEnvironment() {
  return {
    url: process.env.VITE_SUPABASE_URL || '',
    anon: process.env.VITE_SUPABASE_ANON_KEY || '',
    service: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    creatorEmail: process.env.CREATORBRIDGE_QA_CREATOR_EMAIL || '',
    creatorPassword: process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD || '',
    clientEmail: process.env.CREATORBRIDGE_QA_CLIENT_EMAIL || '',
    clientPassword: process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD || '',
    adminEmail: process.env.CREATORBRIDGE_QA_ADMIN_EMAIL || '',
    adminPassword: process.env.CREATORBRIDGE_QA_ADMIN_PASSWORD || '',
  };
}

export function requireQaEnvironment({ service = false } = {}) {
  const env = qaEnvironment();
  const values = [env.url, env.anon, env.creatorEmail, env.creatorPassword, env.clientEmail, env.clientPassword, env.adminEmail, env.adminPassword];
  if (service) values.push(env.service);
  if (values.some(value => !value)) {
    throw new Error('Dedicated CreatorBridge QA credentials are required for provider-backed browser tests.');
  }
  return env;
}

export function addStoredSession(page, role) {
  const path = authFile(role);
  if (!existsSync(path)) throw new Error(`Missing ${role} browser session. Run the auth-setup project first.`);
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const items = state.origins?.find(origin => origin.origin === 'http://127.0.0.1:4174')?.localStorage || [];
  return page.addInitScript(entries => {
    for (const entry of entries) localStorage.setItem(entry.name, entry.value);
  }, items);
}

export function serviceClient() {
  const env = requireQaEnvironment({ service: true });
  return createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function signInQa(role) {
  const env = requireQaEnvironment();
  const client = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const credentials = role === 'creator'
    ? { email: env.creatorEmail, password: env.creatorPassword }
    : role === 'admin'
      ? { email: env.adminEmail, password: env.adminPassword }
      : { email: env.clientEmail, password: env.clientPassword };
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.session || !data.user) throw error || new Error(`${role} QA account did not return a session`);
  return { client, session: data.session, user: data.user };
}

export async function cleanupQaProjects(admin, projectIds) {
  if (!projectIds.length) return;
  const { data: transactions } = await admin.from('transactions').select('id').in('project_id', projectIds);
  const transactionIds = (transactions || []).map(row => row.id);
  if (transactionIds.length) {
    await admin.from('disputes').delete().in('transaction_id', transactionIds);
    await admin.from('payment_events').delete().in('transaction_id', transactionIds);
    await admin.from('project_final_payment_jobs').delete().in('transaction_id', transactionIds);
  }
  const { data: deliveries } = await admin.from('project_deliveries').select('id').in('project_id', projectIds);
  const deliveryIds = (deliveries || []).map(row => row.id);
  await admin.from('project_revision_purchases').update({ consumed_request_id: null }).in('project_id', projectIds);
  if (deliveryIds.length) {
    await admin.from('project_delivery_holds').delete().in('delivery_id', deliveryIds);
    await admin.from('project_delivery_events').delete().in('delivery_id', deliveryIds);
    await admin.from('project_revision_requests').delete().in('delivery_id', deliveryIds);
    await admin.from('messages').delete().in('delivery_id', deliveryIds);
    await admin.from('project_delivery_items').delete().in('delivery_id', deliveryIds);
    await admin.from('project_deliveries').delete().in('id', deliveryIds);
  }
  await admin.from('project_revision_purchases').delete().in('project_id', projectIds);
  await admin.from('messages').delete().in('project_id', projectIds);
  await admin.from('project_conversations').delete().in('project_id', projectIds);
  await admin.from('project_applications').delete().in('project_id', projectIds);
  await admin.from('transactions').delete().in('project_id', projectIds);
  await admin.from('projects').delete().in('id', projectIds);
}

export async function seedCompletionProjects() {
  const admin = serviceClient();
  const [{ user: creator }, { user: client }] = await Promise.all([signInQa('creator'), signInQa('client')]);
  const { data: listing, error: listingError } = await admin
    .from('creator_listings')
    .select('id,user_id')
    .eq('user_id', creator.id)
    .eq('review_status', 'approved')
    .limit(1)
    .maybeSingle();
  if (listingError || !listing) throw listingError || new Error('Approved creator QA listing is required');

  const marker = `CB-E2E-${Date.now()}`;
  const rows = [1, 2].map(number => ({
    client_id: client.id,
    title: `${marker} Project ${number}`,
    service_id: 'photography',
    description: `Dedicated CreatorBridge project completion browser test ${number}. This disposable brief verifies that separate projects between the same parties never share delivery or review state.`,
    budget_min: 500,
    budget_max: 1000,
    location: 'Phoenix, AZ',
    timeline: 'Within 30 days',
    status: 'in_progress',
    accepted_creator_id: listing.id,
    applications: 1,
  }));
  const { data: projects, error: projectError } = await admin.from('projects').insert(rows).select('*');
  if (projectError || projects?.length !== 2) throw projectError || new Error('Two QA projects were not created');

  const transactions = projects.map(project => ({
    project_id: project.id,
    creator_id: listing.id,
    client_id: client.id,
    project_amount: 100000,
    retainer_amount: 50000,
    final_amount: 50000,
    creator_fee_pct: 10,
    client_fee_pct: 5,
    creator_fee_amount: 10000,
    client_fee_amount: 5000,
    platform_revenue: 15000,
    retainer_status: 'paid',
    final_status: 'pending',
  }));
  const { error: transactionError } = await admin.from('transactions').insert(transactions);
  if (transactionError) {
    await cleanupQaProjects(admin, projects.map(project => project.id));
    throw transactionError;
  }
  return { admin, projects, projectIds: projects.map(project => project.id), marker };
}
