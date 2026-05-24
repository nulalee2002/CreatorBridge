#!/usr/bin/env node
/**
 * generate-sitemap.js
 * Queries Supabase for all public creator slugs and writes public/sitemap.xml.
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 * to be available in the environment (or in a .env file at project root).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dotenv dependency required)
try {
  const { readFileSync } = await import('fs');
  const envPath = resolve(__dirname, '../.env');
  const lines   = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.trim().split('=');
    if (key && !key.startsWith('#') && rest.length) {
      process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '');
    }
  }
} catch { /* .env optional — rely on shell env */ }

const SITE_URL      = 'https://www.creatorbridge.studio';
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
                   || process.env.VITE_SUPABASE_ANON_KEY
                   || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Static routes ─────────────────────────────────────────────────────────────
const STATIC_ROUTES = [
  { path: '/',                 changefreq: 'daily',   priority: '1.0' },
  { path: '/find',             changefreq: 'daily',   priority: '0.9' },
  { path: '/join-as-creator',  changefreq: 'weekly',  priority: '0.8' },
  { path: '/terms-of-service', changefreq: 'monthly', priority: '0.4' },
  { path: '/creator-agreement',changefreq: 'monthly', priority: '0.4' },
  { path: '/dispute-policy',   changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy',          changefreq: 'monthly', priority: '0.3' },
];

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod    ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority   ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);

  // ── Fetch public creator profiles ─────────────────────────────────────────
  const { data: creators, error } = await supabase
    .from('creator_listings')
    .select('id, display_name, updated_at')
    .eq('review_status', 'approved')
    .eq('verified', true)
    .eq('is_suspended', false);   // exclude suspended creators

  if (error) {
    console.warn('Could not fetch creators:', error.message);
  }

  const creatorEntries = (creators || []).map(c => {
    const lastmod = c.updated_at ? c.updated_at.slice(0, 10) : today;
    return urlEntry({
      loc:        `${SITE_URL}/creator/${c.id}`,
      lastmod,
      changefreq: 'weekly',
      priority:   '0.7',
    });
  });

  const staticEntries = STATIC_ROUTES.map(r =>
    urlEntry({ loc: `${SITE_URL}${r.path}`, lastmod: today, ...r })
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...creatorEntries,
    '</urlset>',
  ].join('\n');

  const outPath = resolve(__dirname, '../public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf8');

  console.log(`Sitemap written to ${outPath}`);
  console.log(`  Static routes:   ${staticEntries.length}`);
  console.log(`  Creator profiles: ${creatorEntries.length}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
