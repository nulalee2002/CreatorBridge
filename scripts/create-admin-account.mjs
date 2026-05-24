import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      if (env[key]) continue;
      env[key] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing environment variables. The script requires:');
  console.error('- SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminEmail    = env.QA_ADMIN_EMAIL || 'drl33@creatorbridge.studio';
const adminPassword = env.QA_ADMIN_PASS;
if (!adminPassword) {
  console.error('Error: QA_ADMIN_PASS must be set in .env');
  process.exit(1);
}

async function createAdmin() {
  console.log(`Creating Admin Account: ${adminEmail}...`);
  
  const created = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Platform Admin',
      role: 'admin',
    },
  });

  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) {
      console.log(`- Account already exists in Auth. Ensuring it has admin role...`);
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = data.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
      if (existingUser) {
        await linkAdmin(existingUser.id);
      }
      return;
    }
    throw created.error;
  }

  const userId = created.data.user.id;
  console.log(`- Auth user created successfully. ID: ${userId}`);
  await linkAdmin(userId);
}

async function linkAdmin(userId) {
  console.log(`Linking profile and platform admin tables...`);

  // 1. Upsert profile
  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    role: 'admin',
    full_name: 'Platform Admin',
    referral_code: userId.replaceAll('-', '').slice(0, 8).toUpperCase(),
    updated_at: new Date().toISOString(),
  });
  if (profileErr) throw profileErr;
  console.log(`- Profile linked successfully.`);

  // 2. Insert into platform_admins
  const { error: adminErr } = await admin.from('platform_admins').upsert({
    user_id: userId,
    note: 'CreatorBridge owner admin',
  });
  if (adminErr) throw adminErr;
  console.log(`- Platform admin access granted successfully.`);
  
  console.log('\n==================================================');
  console.log('SUCCESS: Admin Account Setup Complete!');
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log('==================================================');
}

createAdmin().catch(err => {
  console.error('Fatal admin creation error:', err.message);
  process.exit(1);
});
