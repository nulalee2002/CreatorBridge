const REVERIFICATION_TRIGGERS = new Set([
  'provider_requested',
  'suspicious_recovery',
  'serious_fraud_signal',
  'qualifying_suspension_return',
  'legal_identity_changed',
]);

export function identityAllowsTrustedAction(status) {
  return status === 'verified';
}

export function phoneAllowsContact(state) {
  return state?.phoneVerified === true;
}

export function nextIdentityState(currentStatus, trigger) {
  if (currentStatus === 'verified' && REVERIFICATION_TRIGGERS.has(trigger)) {
    return 'reverification_required';
  }
  return currentStatus;
}
