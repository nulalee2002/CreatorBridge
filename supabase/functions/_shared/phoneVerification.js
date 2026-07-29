export function normalizePhoneE164(input) {
  const raw = String(input || '').trim();
  const cleaned = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : raw.replace(/\D/g, '');
  const normalized = cleaned.startsWith('+')
    ? cleaned
    : cleaned.length === 10
      ? `+1${cleaned}`
      : `+${cleaned}`;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Enter a valid phone number with country code.');
  }
  return normalized;
}

export function normalizeVerificationCode(input) {
  const code = String(input || '').trim();
  if (!/^\d{4,10}$/.test(code)) {
    throw new Error('Enter the verification code sent by SMS.');
  }
  return code;
}
