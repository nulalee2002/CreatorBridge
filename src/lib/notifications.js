import { supabase, supabaseConfigured } from './supabase.js';

const BLOCKED_TEST_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'invalid.test']);

export function isDeliverableEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split('@').pop();
  return Boolean(domain) && !BLOCKED_TEST_DOMAINS.has(domain);
}

/**
 * Invokes the send-notification-email Edge Function to send an email via Resend.
 * This function fails silently (logs to console) to ensure best-effort delivery.
 * 
 * @param {string} to - Recipient email address
 * @param {string} template - Name of the email template
 * @param {object} data - Dynamic variables for the template
 */
export async function sendNotificationEmail(to, template, data) {
  if (!isDeliverableEmail(to)) {
    console.warn(`Skipped ${template} email because the recipient address is missing or not deliverable.`);
    return;
  }

  if (!supabaseConfigured || !supabase) {
    console.warn(`[Notification Mock] Email to ${to} (${template}):`, data);
    return;
  }
  try {
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: { to, template, data }
    });
    if (error) {
      console.error(`Failed to send email to ${to} using template ${template}:`, error);
    } else {
      console.log(`Email successfully triggered for ${to} using template ${template}`);
    }
  } catch (err) {
    console.error(`Network error invoking send-notification-email for ${to}:`, err);
  }
}
