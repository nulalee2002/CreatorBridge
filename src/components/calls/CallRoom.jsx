import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Loader2, Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff } from 'lucide-react';

// Embedded Zoom Video SDK call room. The SDK is imported dynamically so the
// main bundle stays lean. The server JWT permits cloud recording, then the
// creator host must start it before either party's microphone or camera is
// enabled. Renders full screen on
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

  // Hard cap: every participant receives the same server-recorded start time.
  // The creator ends the Zoom session for everyone when the deadline lands.
  useEffect(() => {
    const startMs = new Date(session.startedAt || session.scheduledAt).getTime();
    const endMs = startMs + Number(session.durationMinutes || 60) * 60_000;
    const updateCountdown = () => {
      const secondsLeft = Math.ceil((endMs - Date.now()) / 1000);
      setRemaining(secondsLeft);
      if (secondsLeft <= 0) {
        leaveCall(true);
      }
    };
    updateCountdown();
    const tick = setInterval(updateCountdown, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.startedAt, session.scheduledAt, session.durationMinutes]);

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
        setPhase('securing-recording');

        const recording = client.getRecordingClient();
        if (recording.getCloudRecordingStatus() !== 'Recording') {
          await new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              client.off('recording-change', onRecordingChange);
              callback(value);
            };
            const onRecordingChange = ({ state }) => {
              if (state === 'Recording') finish(resolve);
              if (state === 'Stopped') finish(reject, new Error('Required recording stopped before the call began'));
            };
            const timeout = setTimeout(
              () => finish(reject, new Error('Required recording did not start in time')),
              30_000,
            );
            client.on('recording-change', onRecordingChange);

            if (session.role === 'creator') {
              if (!recording.canStartRecording()) {
                finish(reject, new Error('Cloud recording is not enabled for this Zoom session'));
                return;
              }
              recording.startCloudRecording()
                .then(result => {
                  if (result instanceof Error) finish(reject, result);
                  else if (recording.getCloudRecordingStatus() === 'Recording') finish(resolve);
                })
                .catch(recordingError => finish(reject, recordingError));
            }
          });
        }
        if (cancelled) return;
        let recordingFailed = false;
        client.on('recording-change', ({ state }) => {
          if (recordingFailed || leaveRef.current) return;
          if (state === 'Paused' || state === 'Stopped') {
            recordingFailed = true;
            setError('The required audio recording stopped, so the call was closed. No unrecorded conversation can continue here.');
            setPhase('error');
            void cleanupClient(session.role === 'creator');
          }
        });
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
          if (payload?.state === 'Closed' && !leaveRef.current && clientRef.current === client) {
            finishLeave();
          }
        });

        // Render self video once it starts.
        const selfId = client.getCurrentUserInfo()?.userId;
        if (selfId) attachUser(stream, selfId);

        setPhase('live');
      } catch (connectError) {
        console.error('CreatorBridge call: join failed', connectError);
        await cleanupClient(false);
        setError('The recorded call could not start. No microphone or camera was enabled. Check permissions and try again.');
        setPhase('error');
      }
    }

    connect();
    return () => {
      cancelled = true;
      void cleanupClient(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, session.sessionName]);

  async function cleanupClient(endSession) {
    const client = clientRef.current;
    const ZoomVideo = zoomRef.current;
    clientRef.current = null;
    zoomRef.current = null;
    attachedRef.current.forEach(element => element.remove());
    attachedRef.current.clear();
    if (client) {
      try {
        if (endSession && session.role === 'creator') await client.leave(true);
        else await client.leave();
      } catch { /* already disconnected */ }
    }
    if (ZoomVideo) {
      try { await ZoomVideo.destroyClient(); } catch { /* already destroyed */ }
    }
  }

  async function finishLeave(endSession = false) {
    if (leaveRef.current) return;
    leaveRef.current = true;
    await cleanupClient(endSession);
    onLeft?.();
  }

  async function leaveCall(endSession = false) {
    await finishLeave(endSession);
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
          <p className="text-xs font-bold text-white">
            {phase === 'live' ? 'CreatorBridge call, audio recording on' : 'CreatorBridge call, recording required'}
          </p>
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
        {phase === 'securing-recording' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 size={26} className="animate-spin text-gold-400" />
            <p className="text-xs text-charcoal-300">Starting the required audio recording...</p>
          </div>
        )}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle size={26} className="text-red-300" />
            <p className="max-w-sm text-xs leading-5 text-charcoal-200">{error}</p>
            <button type="button" onClick={() => leaveCall(false)} className="btn-ghost">Back to the project</button>
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
          onClick={() => leaveCall(false)}
          className="flex h-11 items-center gap-2 rounded-full bg-red-500/85 px-5 text-xs font-bold text-white transition hover:bg-red-500"
        >
          <PhoneOff size={15} /> Leave
        </button>
      </div>
    </div>
  );
}
