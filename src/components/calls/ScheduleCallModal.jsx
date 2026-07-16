import { useState } from 'react';
import { CalendarDays, Loader2, Video, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { AvailabilityMini } from '../AvailabilityCalendar.jsx';

const TIME_SLOTS = [];
for (let hour = 8; hour <= 19; hour += 1) {
  for (const minutes of ['00', '30']) {
    TIME_SLOTS.push(`${String(hour).padStart(2, '0')}:${minutes}`);
  }
}

function slotLabel(slot) {
  const [hour, minutes] = slot.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function ScheduleCallModal({ project, contract, isClient, rescheduleCall, onClose, onScheduled }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit() {
    if (!selectedDate || !selectedTime) {
      setError('Pick a date and a time for the call.');
      return;
    }
    setBusy(true);
    setError('');
    // Local date + time, stored as UTC, shown local everywhere.
    const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`);
    try {
      const { data, error: rpcError } = rescheduleCall
        ? await supabase.rpc('reschedule_project_call', {
            p_call_id: rescheduleCall.id,
            p_scheduled_at: scheduledAt.toISOString(),
          })
        : await supabase.rpc('schedule_project_call', {
            p_project_id: project.id,
            p_scheduled_at: scheduledAt.toISOString(),
          });
      if (rpcError) throw rpcError;
      onScheduled?.(data);
      onClose();
    } catch (err) {
      setError(err?.message || 'The call could not be scheduled. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className="liquid-glass relative w-full max-w-lg rounded-t-2xl bg-charcoal-950/95 p-5 sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Video size={16} className="text-gold-400" />
              {rescheduleCall ? 'Reschedule the call' : 'Schedule a video call'}
            </h3>
            <p className="mt-1 text-xs leading-5 text-charcoal-300">
              Calls run up to 60 minutes, are recorded audio only and transcribed, and stay inside CreatorBridge.
              Times shown in {timezone}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-charcoal-300 hover:bg-white/[0.08] hover:text-white">
            <X size={16} />
          </button>
        </div>

        {isClient ? (
          <AvailabilityMini
            creatorId={contract?.creator_id}
            dark
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal-900/72 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white">
              <CalendarDays size={13} className="text-gold-400" /> Pick a day
            </p>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
              className="w-full rounded-lg border border-white/[0.09] bg-charcoal-900 px-3 py-2 text-xs text-white focus:border-gold-500/50 focus:outline-none"
            />
            <p className="mt-2 text-[10px] leading-4 text-charcoal-300">
              Clients book from your published availability. As the creator you can propose any future time.
            </p>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-charcoal-300">Time</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TIME_SLOTS.map(slot => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all ${
                  selectedTime === slot
                    ? 'border-gold-500/60 bg-gold-500/20 text-gold-300'
                    : 'border-white/[0.08] text-charcoal-300 hover:border-gold-500/30 hover:text-white'
                }`}
              >
                {slotLabel(slot)}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs leading-5 text-red-300">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !selectedDate || !selectedTime} className="btn-gold flex-1">
            {busy ? <Loader2 size={14} className="animate-spin" /> : rescheduleCall ? 'Move the call' : 'Schedule the call'}
          </button>
        </div>
      </div>
    </div>
  );
}
