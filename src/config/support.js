const configuredSupportEmail = import.meta.env?.VITE_SUPPORT_EMAIL?.trim();

// This fallback is the existing CreatorBridge mailbox. VITE_SUPPORT_EMAIL may
// point to a future verified support alias without changing product copy.
export const SUPPORT_EMAIL = configuredSupportEmail || 'drl33@creatorbridge.studio';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export function supportEmailText(prefix = '') {
  return `${prefix}${SUPPORT_EMAIL}`;
}
