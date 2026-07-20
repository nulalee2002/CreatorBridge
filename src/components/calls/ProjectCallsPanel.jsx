import { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, Video } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { ScheduleCallModal } from './ScheduleCallModal.jsx';
import { CallConsent } from './CallConsent.jsx';
import { CallRoom } from './CallRoom.jsx';
import { CallSummary } from './CallSummary.jsx';

const UNLOCKED_STATUSES = new Set([
  'retainer_paid', 'in_progress', 'revision', 'delivered', 'approved', 'completed', 'final_paid',
]);
const INCLUDED_CALLS = 3;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function callTimeLabel(call) {
  return new Date(call.scheduled_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_CHIPS = {
  scheduled: { label: 'Scheduled', className: 'bg-gold-500/15 text-gold-300 ring-gold-500/25' },
  in_progress: { label: 'Live now', className: 'bg-forest-500/20 text-forest-100 ring-forest-300/30' },
  completed: { label: 'Completed', className: 'bg-white/[0.06] text-charcoal-200 ring-white/[0.12]' },
  no_show: { label: 'No show', className: 'bg-red-500/15 text-red-300 ring-red-500/25' },
  cancelled: { label: 'Cancelled', className: 'bg-white/[0.05] text-charcoal-400 ring-white/[0.09]' },
};

// Project workspace surface for video calls: gated scheduling, the consent
// screen, the embedded call room, and the shared editable summary.
export function ProjectCallsPanel({ project, user, isClient }) {
  const [contract, setContract] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [rescheduleCall, setRescheduleCall] = useState(null);
  const [consentCall, setConsentCall] = useState(null);
  const [liveSession, setLiveSession] = useState(null);
  const [busyCallId, setBusyCallId] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const unlocked = UNLOCKED_STATUSES.has(project?.status) && contract?.status === 'countersigned';

  async function loadCalls() {
    const { data } = await supabase
      .from('project_calls')
      .select('*')
      .eq('project_id', project.id)
      .order('scheduled_at', { ascending: false });
    setCalls(data || []);
  }

  useEffect(() => {
    if (!supabaseConfigured || !isUuid(project?.id) || !user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data: contractRow } = await supabase
        .from('contracts')
        .select('id, status, creator_id, creator_user_id, client_id')
        .eq('project_id', project.id)
        .maybeSingle();
      if (!active) return;
      setContract(contractRow || null);
      if (contractRow?.status === 'countersigned' && UNLOCKED_STATUSES.has(project?.status)) {
        await loadCalls();
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.status, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !unlocked) return null;

  const usedCalls = calls.filter(call => ['scheduled', 'in_progress', 'completed'].includes(call.status)).length;
  const atCap = usedCalls >= INCLUDED_CALLS;
  function updateCall(updated) {
    if (!updated?.id) { loadCalls(); return; }
    setCalls(previous => {
      const exists = previous.some(call => call.id === updated.id);
      return exists
        ? previous.map(call => (call.id === updated.id ? updated : call))
        : [updated, ...previous];
    });
  }

  async function cancelCall(call) {
    setBusyCallId(call.id);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_project_call', {
        p_call_id: call.id,
        p_reason: null,
      });
      if (rpcError) throw rpcError;
      updateCall(data);
    } catch (err) {
      setError(err?.message || 'The call could not be cancelled.');
    } finally {
      setBusyCallId('');
    }
  }

  async function markNoShow(call) {
    setBusyCallId(call.id);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('mark_call_no_show', { p_call_id: call.id });
      if (rpcError) throw rpcError;
      updateCall(data);
    } catch (err) {
      setError(err?.message || 'The no show could not be recorded.');
    } finally {
      setBusyCallId('');
    }
  }

  async function requestAnotherCall() {
    setRequestBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('request_additional_call', {
        p_project_id: project.id,
        p_note: null,
      });
      if (rpcError) throw rpcError;
      setRequestSent(true);
    } catch (err) {
      setError(err?.message || 'The request could not be sent.');
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-charcoal-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-charcoal-300">
          <Video size={12} className="text-gold-400" /> Video calls
        </p>
        <span className="text-[10px] text-charcoal-400">{usedCalls} of {INCLUDED_CALLS} included calls used</span>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-charcoal-400">
        Calls are recorded, audio only, and transcribed with both parties' consent, run up to 60 minutes, and stay inside CreatorBridge.
      </p>

      <div className="mt-3 space-y-2">
        {calls.length === 0 && (
          <p className="rounded-lg border border-white/[0.05] bg-charcoal-950/50 p-3 text-[11px] text-charcoal-300">
            No calls yet. Schedule the kickoff call when you are ready.
          </p>
        )}
        {calls.map(call => {
          const chip = STATUS_CHIPS[call.status] || STATUS_CHIPS.scheduled;
          const scheduledMs = new Date(call.scheduled_at).getTime();
          const joinable = ['scheduled', 'in_progress'].includes(call.status)
            && now >= scheduledMs - 15 * 60_000
            && now <= scheduledMs + Number(call.duration_minutes || 60) * 60_000 + 30 * 60_000;
          const canMarkNoShow = ['scheduled', 'in_progress'].includes(call.status)
            && now > scheduledMs + 10 * 60_000;
          const canReschedule = !isClient && call.status === 'scheduled' && now < scheduledMs;
          return (
            <div key={call.id} className="rounded-lg border border-white/[0.06] bg-charcoal-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">{callTimeLabel(call)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${chip.className}`}>{chip.label}</span>
              </div>
              {call.late_reschedule && (
                <p className="mt-1 text-[9px] text-charcoal-400">Includes a late reschedule (inside 12 hours).</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {joinable && (
                  <button type="button" onClick={() => setConsentCall(call)} className="btn-gold !min-h-0 !px-3 !py-1.5 !text-[11px]">
                    <Video size={12} /> Join call
                  </button>
                )}
                {canReschedule && (
                  <button
                    type="button"
                    onClick={() => { setRescheduleCall(call); setShowSchedule(true); }}
                    className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-200 transition hover:border-gold-500/35 hover:text-white"
                  >
                    Reschedule
                  </button>
                )}
                {['scheduled', 'in_progress'].includes(call.status) && (
                  <button
                    type="button"
                    onClick={() => cancelCall(call)}
                    disabled={busyCallId === call.id}
                    className="rounded-lg border border-red-500/25 px-3 py-1.5 text-[11px] font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-45"
                  >
                    {busyCallId === call.id ? <Loader2 size={12} className="animate-spin" /> : 'Cancel'}
                  </button>
                )}
                {canMarkNoShow && (
                  <button
                    type="button"
                    onClick={() => markNoShow(call)}
                    disabled={busyCallId === call.id}
                    className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-300 transition hover:border-red-500/35 hover:text-red-300 disabled:opacity-45"
                  >
                    Mark no show
                  </button>
                )}
              </div>
              {['completed', 'no_show'].includes(call.status) && (
                <div className="mt-3">
                  <CallSummary call={call} user={user} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        {!atCap ? (
          <button type="button" onClick={() => { setRescheduleCall(null); setShowSchedule(true); }} className="btn-ghost w-full !text-[11px]">
            <CalendarPlus size={13} /> Schedule a call
          </button>
        ) : requestSent ? (
          <p className="rounded-lg border border-forest-300/25 bg-forest-500/10 p-2.5 text-center text-[11px] text-forest-100">
            Request sent. If the other party agrees, they can schedule the additional call.
          </p>
        ) : (
          <button type="button" onClick={requestAnotherCall} disabled={requestBusy} className="btn-ghost w-full !text-[11px]">
            {requestBusy ? <Loader2 size={13} className="animate-spin" /> : <><CalendarPlus size={13} /> Request another call</>}
          </button>
        )}
        {atCap && !requestSent && (
          <p className="mt-1.5 text-center text-[9px] leading-4 text-charcoal-400">
            This project used its {INCLUDED_CALLS} included calls. Extra calls unlock when one party requests and the other schedules.
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] leading-4 text-red-300">{error}</p>}

      {showSchedule && (
        <ScheduleCallModal
          project={project}
          contract={contract}
          rescheduleCall={rescheduleCall}
          onClose={() => { setShowSchedule(false); setRescheduleCall(null); }}
          onScheduled={updateCall}
        />
      )}
      {consentCall && !liveSession && (
        <CallConsent
          call={consentCall}
          user={user}
          onClose={() => setConsentCall(null)}
          onCallChanged={updateCall}
          onJoined={session => setLiveSession(session)}
        />
      )}
      {liveSession && (
        <CallRoom
          session={liveSession}
          onLeft={() => {
            setLiveSession(null);
            setConsentCall(null);
            loadCalls();
          }}
        />
      )}
    </div>
  );
}
