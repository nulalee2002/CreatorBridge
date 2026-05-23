import { supabase, supabaseConfigured } from './supabase.js';

/**
 * Invokes the send-notification-email Edge Function to send an email via Resend.
 * This function fails silently (logs to console) to ensure best-effort delivery.
 * 
 * @param {string} to - Recipient email address
 * @param {string} template - Name of the email template
 * @param {object} data - Dynamic variables for the template
 */
export async function sendNotificationEmail(to, template, data) {
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
