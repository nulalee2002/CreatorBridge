export const SUPPORTED_EMAIL_TEMPLATES = new Set([
  'welcome_creator',
  'welcome_client',
  'application_received',
  'application_accepted',
  'quote_request_received',
  'retainer_paid',
  'delivery_submitted',
  'delivery_review_48h',
  'delivery_review_24h',
  'delivery_auto_approved',
  'revision_purchase_succeeded',
  'revision_purchase_failed',
  'revision_requested',
  'final_payment_attention',
  'final_paid',
  'support_ticket_opened',
  'support_ticket_admin_alert',
]);

const SELF_EMAIL_TEMPLATES = new Set([
  'welcome_creator',
  'welcome_client',
  'application_received',
  'support_ticket_opened',
]);

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function classifyAuthenticatedEmailRequest({
  callerEmail,
  to,
  template,
  data,
  supportEmail,
  verifyOnly = false,
}) {
  if (verifyOnly) return { allowed: true, kind: 'verify' };
  if (!SUPPORTED_EMAIL_TEMPLATES.has(template)) return { allowed: false, kind: 'unsupported' };

  const caller = normalizeEmail(callerEmail);
  const recipient = normalizeEmail(to);
  if (!caller || !recipient) return { allowed: false, kind: 'invalid_recipient' };

  if (SELF_EMAIL_TEMPLATES.has(template)) {
    return { allowed: caller === recipient, kind: 'self' };
  }

  if (template === 'support_ticket_admin_alert') {
    const submitter = normalizeEmail(data?.submitter_email);
    const support = normalizeEmail(supportEmail);
    return {
      allowed: Boolean(support) && recipient === support && submitter === caller,
      kind: 'support',
    };
  }

  if (template === 'application_accepted') {
    return {
      allowed: Boolean(data?.project_id),
      kind: 'project_application_accepted',
    };
  }

  return { allowed: false, kind: 'service_only' };
}
