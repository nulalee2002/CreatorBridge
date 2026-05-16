import { useState, useEffect } from 'react';
import { Calendar, Check, AlertCircle, RefreshCw, Unlink } from 'lucide-react';
import { mergeAvailability } from './AvailabilityCalendar.jsx';

const CLIENT_ID      = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES         = 'https://www.googleapis.com/auth/calendar.readonly';
const REDIRECT_ORIGIN = window.location.origin;

// ── localStorage helpers ─────────────────────────────────────
function saveGCalToken(creatorId, token) {
  try {
    localStorage.setItem(`gcal-token-${creatorId}`, JSON.stringify({
      access_token: token.access_token,
      expires_at:   Date.now() + (token.expires_in || 3600) * 1000,
    }));
  } catch {}
}

function loadGCalToken(creatorId) {
  try {
    const raw = localStorage.getItem(`gcal-token-${creatorId}`);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (t.expires_at < Date.now()) {
      localStorage.removeItem(`gcal-token-${creatorId}`);
      return null;
    }
    return t;
  } catch { return null; }
}

function disconnectGCal(creatorId) {
  localStorage.removeItem(`gcal-token-${creatorId}`);
}

// ── Google OAuth helpers ─────────────────────────────────────
function buildOAuthUrl(creatorId) {
  if (!CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  `${REDIRECT_ORIGIN}/dashboard`,
    response_type: 'token',
    scope:         SCOPES,
    state:         `gcal-connect-${creatorId}`,
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Parse the #access_token=... hash fragment after Google OAuth redirect.
 * Returns the token object if present and state matches, otherwise null.
 */
export function parseGCalOAuthRedirect(creatorId) {
  try {
    const hash = window.location.hash;
    if (!hash) return null;
    const params = new URLSearchParams(hash.slice(1));
    const state = params.get('state');
    if (state !== `gcal-connect-${creatorId}`) return null;
    const token = {
      access_token: params.get('access_token'),
      expires_in:   parseInt(params.get('expires_in') || '3600', 10),
    };
    if (!token.access_token) return null;
    // Clean hash from URL
    window.history.replaceState(null, '', window.location.pathname);
    return token;
  } catch { return null; }
}

/**
 * Fetch busy periods from Google Calendar and mark those days as 'booked'
 * in the creator's CreatorBridge availability calendar.
 */
async function syncFromGCal(creatorId, accessToken) {
  const now      = new Date();
  const inSixty  = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const body = {
    timeMin: now.toISOString(),
    timeMax: inSixty.toISOString(),
    items:   [{ id: 'primary' }],
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('Failed to fetch calendar data');

  const data    = await res.json();
  const busy    = data.calendars?.primary?.busy || [];
  const updates = {};

  for (const period of busy) {
    const start = new Date(period.start);
    const end   = new Date(period.end);
    // Mark each day in the busy period as booked
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= end) {
      const key    = d.toISOString().split('T')[0];
      updates[key] = 'booked';
      d.setDate(d.getDate() + 1);
    }
  }

  await mergeAvailability(creatorId, updates);
  return busy.length;
}

// ── Main component ───────────────────────────────────────────
/**
 * GoogleCalendarConnect
 * Shows a button to connect Google Calendar.
 * When connected, syncs busy times to the CreatorBridge availability calendar.
 *
 * Props:
 *   creatorId - string
 *   dark      - boolean
 *   onSync    - callback() after sync completes (e.g., to refresh the calendar view)
 */
export function GoogleCalendarConnect({ creatorId, dark, onSync }) {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [error, setError]         = useState('');

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  useEffect(() => {
    if (!creatorId) return;

    // Check for OAuth redirect token in URL hash
    const token = parseGCalOAuthRedirect(creatorId);
    if (token) {
      saveGCalToken(creatorId, token);
      setConnected(true);
      handleSync(token.access_token);
      return;
    }

    // Check for existing saved token
    const saved = loadGCalToken(creatorId);
    if (saved) setConnected(true);
  }, [creatorId]);

  function handleConnect() {
    if (!CLIENT_ID) {
      setError('Google Calendar integration requires VITE_GOOGLE_CLIENT_ID to be configured.');
      return;
    }
    const url = buildOAuthUrl(creatorId);
    if (url) window.location.href = url;
  }

  async function handleSync(overrideToken) {
    const token = overrideToken || loadGCalToken(creatorId)?.access_token;
    if (!token) { setError('Session expired. Please reconnect.'); setConnected(false); return; }
    setSyncing(true);
    setError('');
    setSyncResult('');
    try {
      const count = await syncFromGCal(creatorId, token);
      setSyncResult(`Synced. ${count} busy period${count !== 1 ? 's' : ''} imported from Google Calendar.`);
      onSync?.();
    } catch (e) {
      setError('Sync failed. Your Google session may have expired. Please reconnect.');
      disconnectGCal(creatorId);
      setConnected(false);
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    disconnectGCal(creatorId);
    setConnected(false);
    setSyncResult('');
    setError('');
  }

  if (!CLIENT_ID) {
    return (
      <div className={`${cardCls} flex items-start gap-3`}>
        <AlertCircle size={16} className="text-gold-400 shrink-0 mt-0.5" />
        <div>
          <p className={`text-xs font-semibold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Google Calendar</p>
          <p className={`text-xs ${textSub}`}>
            Add <code className="text-gold-400">VITE_GOOGLE_CLIENT_ID</code> to your .env file to enable Google Calendar sync.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${connected ? 'bg-gold-500/15 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.08]' : 'bg-gray-100'}`}>
          <Calendar size={16} className={connected ? 'text-gold-400' : textSub} />
        </div>
        <div>
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Google Calendar</p>
          <p className={`text-xs ${textSub}`}>
            {connected ? 'Connected - busy times sync to CreatorBridge availability' : 'Auto-import your busy days from Google Calendar'}
          </p>
        </div>
        {connected && <Check size={14} className="text-gold-400 ml-auto shrink-0" />}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {syncResult && (
        <div className="mb-3 flex items-start gap-2 p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/25">
          <Check size={12} className="text-gold-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gold-300">{syncResult}</p>
        </div>
      )}

      <div className="flex gap-2">
        {!connected ? (
          <button type="button" onClick={handleConnect}
            className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
            <Calendar size={12} /> Connect Google Calendar
          </button>
        ) : (
          <>
            <button type="button" onClick={() => handleSync(null)} disabled={syncing}
              className="flex-1 py-2 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-gold-500/30">
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button type="button" onClick={handleDisconnect}
              className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}>
              <Unlink size={12} />
            </button>
          </>
        )}
      </div>
      <p className={`text-[10px] mt-2 ${textSub}`}>
        Only your free/busy status is imported. Event details are never stored.
      </p>
    </div>
  );
}
