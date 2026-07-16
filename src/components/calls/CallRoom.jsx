import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff } from 'lucide-react';

// Embedded Zoom Video SDK call room. The SDK is imported dynamically so the
// main bundle stays lean. Recording and transcription are enabled server side
// in the session JWT; nothing here can turn them off. Renders full screen on
// mobile and as a large panel on desktop (works in desktop Chrome, iOS
// Safari, and Android Chrome via the web SDK).

const WARNING_SECONDS = 5 * 60;

function formatClock(totalSeconds) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function CallRoom({ session, onLeft }) {
  const containerRef = useRef(null);
  const clientRef = useRef(null);
  const zoomRef = useRef(null);
  const attachedRef = useRef(new Map());
  const [phase, setPhase] = useState('connecting');
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [remaining, setRemaining] = useState(null);
  const leaveRef = useRef(false);

  // Hard 60 minute cap: countdown from the scheduled start (or now if joined
  // late), warn in the last five minutes, leave at zero.
  useEffect(() => {
    const startMs = Math.max(new Date(session.scheduledAt).getTime(), Date.now() - 1000);
    const endMs = startMs + Number(session.durationMinutes || 60) * 60_000;
    const tick = setInterval(() => {
      const secondsLeft = Math.round((endMs - Date.now()) / 1000);
      setRemaining(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(tick);
        leaveCall();
      }
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.scheduledAt, session.durationMinutes]);

  useEffect(() => {
    let cancelled = false;

    async function attachUser(stream, userId) {
      if (attachedRef.current.has(userId) || !containerRef.current) return;
      try {
        const element = await stream.attachVideo(userId, 2);
        if (cancelled || !containerRef.current) return;
        element.classList.add('cb-call-tile');
        containerRef.current.appendChild(element);
        attachedRef.current.set(userId, element);
      } catch (attachError) {
        console.warn('CreatorBridge call: video attach failed', attachError);
      }
    }

    async function detachUser(stream, userId) {
      const element = attachedRef.current.get(userId);
      if (!element) return;
      try { await stream.detachVideo(userId); } catch { /* already detached */ }
      element.remove();
      attachedRef.current.delete(userId);
    }

    async function connect() {
      try {
        const { default: ZoomVideo } = await import('@zoom/videosdk');
        if (cancelled) return;
        zoomRef.current = ZoomVideo;
        const client = ZoomVideo.createClient();
        clientRef.current = client;
        await client.init('en-US', 'Global', { patchJsMedia: true });
        await client.join(session.sessionName, session.token, session.displayName);
        if (cancelled) return;
        const stream = client.getMediaStream();

        try { await stream.startAudio(); } catch { setMicOn(false); }
        try { await stream.startVideo(); } catch { setCameraOn(false); }

        const renderAll = () => {
          for (const participant of client.getAllUser()) {
            if (participant.bVideoOn) attachUser(stream, participant.userId);
          }
        };
        renderAll();

        client.on('peer-video-state-change', ({ action, userId }) => {
          if (action === 'Start') attachUser(stream, userId);
          else detachUser(stream, userId);
        });
        client.on('user-added', renderAll);
        client.on('user-removed', (payload) => {
          for (const gone of Array.isArray(payload) ? payload : [payload]) {
            if (gone?.userId) detachUser(stream, gone.userId);
          }
        });
        client.on('connection-change', (payload) => {
          if (payload?.state === 'Closed' && !leaveRef.current) {
            finishLeave();
          }
        });

        // Render self video once it starts.
        const selfId = client.getCurrentUserInfo()?.userId;
        if (selfId) attachUser(stream, selfId);

        setPhase('live');
      } catch (connectError) {
        console.error('CreatorBridge call: join failed', connectError);
        setError('The call could not connect. Check your camera and microphone permissions and try again.');
        setPhase('error');
      }
    }

    connect();
    return () => {
      cancelled = true;
      cleanupClient();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, session.sessionName]);

  function cleanupClient() {
    const client = clientRef.current;
    const ZoomVideo = zoomRef.current;
    attachedRef.current.forEach(element => element.remove());
    attachedRef.current.clear();
    if (client) {
      client.leave().catch(() => {});
      clientRef.current = null;
    }
    if (ZoomVideo) {
      try { ZoomVideo.destroyClient(); } catch { /* already destroyed */ }
      zoomRef.current = null;
    }
  }

  function finishLeave() {
    if (leaveRef.current) return;
    leaveRef.current = true;
    cleanupClient();
    onLeft?.();
  }

  async function leaveCall() {
    finishLeave();
  }

  async function toggleMic() {
    const stream = clientRef.current?.getMediaStream();
    if (!stream) return;
    try {
      if (micOn) { await stream.muteAudio(); } else { await stream.unmuteAudio(); }
      setMicOn(!micOn);
    } catch (micError) {
      console.warn('CreatorBridge call: mic toggle failed', micError);
    }
  }

  async function toggleCamera() {
    const stream = clientRef.current?.getMediaStream();
    if (!stream) return;
    try {
      if (cameraOn) { await stream.stopVideo(); } else { await stream.startVideo(); }
      setCameraOn(!cameraOn);
    } catch (cameraError) {
      console.warn('CreatorBridge call: camera toggle failed', cameraError);
    }
  }

  const showWarning = remaining !== null && remaining <= WARNING_SECONDS && remaining > 0;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-charcoal-950">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
          <p className="text-xs font-bold text-white">Recorded CreatorBridge call</p>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span className={`flex items-center gap-1 text-xs font-bold ${showWarning ? 'text-red-300' : 'text-charcoal-300'}`}>
              <Clock size={12} /> {formatClock(remaining)}
            </span>
          )}
        </div>
      </div>

      {showWarning && (
        <div className="flex items-center gap-2 bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-200">
          <AlertCircle size={13} /> This call ends in {formatClock(remaining)}. Wrap up or note anything left in the summary afterward.
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {phase === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={26} className="animate-spin text-gold-400" />
            <p className="text-xs text-charcoal-300">Connecting your call...</p>
          </div>
        )}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle size={26} className="text-red-300" />
            <p className="max-w-sm text-xs leading-5 text-charcoal-200">{error}</p>
            <button type="button" onClick={leaveCall} className="btn-ghost">Back to the project</button>
          </div>
        )}
        <div
          ref={containerRef}
          className="grid h-full w-full grid-cols-1 gap-2 p-2 sm:grid-cols-2 [&_.cb-call-tile]:h-full [&_.cb-call-tile]:w-full [&_.cb-call-tile]:overflow-hidden [&_.cb-call-tile]:rounded-xl"
        />
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/[0.07] px-4 py-4">
        <button
          type="button"
          onClick={toggleMic}
          disabled={phase !== 'live'}
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
            micOn ? 'border-white/[0.12] bg-white/[0.06] text-white' : 'border-red-500/40 bg-red-500/15 text-red-300'
          } disabled:opacity-40`}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <Mic size={17} /> : <MicOff size={17} />}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          disabled={phase !== 'live'}
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
            cameraOn ? 'border-white/[0.12] bg-white/[0.06] text-white' : 'border-red-500/40 bg-red-500/15 text-red-300'
          } disabled:opacity-40`}
          aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {cameraOn ? <VideoIcon size={17} /> : <VideoOff size={17} />}
        </button>
        <button
          type="button"
          onClick={leaveCall}
          className="flex h-11 items-center gap-2 rounded-full bg-red-500/85 px-5 text-xs font-bold text-white transition hover:bg-red-500"
        >
          <PhoneOff size={15} /> Leave
        </button>
      </div>
    </div>
  );
}
