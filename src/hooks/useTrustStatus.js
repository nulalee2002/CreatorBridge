import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

const EMPTY_TRUST = Object.freeze({
  phoneStatus: 'unverified',
  phoneE164: null,
  phoneVerified: false,
  phoneVerifiedAt: null,
  identityStatus: 'consent_required',
  identityVerified: false,
  identityUpdatedAt: null,
  retryAllowed: false,
  reviewMessage: null,
});

function normalizeTrust(row) {
  if (!row) return { ...EMPTY_TRUST };
  return {
    phoneStatus: row.phone_status || 'unverified',
    phoneE164: row.phone_e164 || null,
    phoneVerified: row.phone_verified === true,
    phoneVerifiedAt: row.phone_verified_at || null,
    identityStatus: row.identity_status || 'consent_required',
    identityVerified: row.identity_verified === true,
    identityUpdatedAt: row.identity_updated_at || null,
    retryAllowed: row.retry_allowed === true,
    reviewMessage: row.review_message || null,
  };
}

export function useTrustStatus({ enabled = true } = {}) {
  const [trust, setTrust] = useState({ ...EMPTY_TRUST });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled || !supabaseConfigured) {
      setLoading(false);
      return { ...EMPTY_TRUST };
    }
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_my_trust_status');
    if (rpcError) {
      setError('Verification status could not be loaded.');
      setLoading(false);
      return null;
    }
    const next = normalizeTrust(Array.isArray(data) ? data[0] : data);
    setTrust(next);
    setLoading(false);
    return next;
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trust, loading, error, refresh };
}
