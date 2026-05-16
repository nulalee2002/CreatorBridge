import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Check } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

// ── localStorage helpers ──────────────────────────────────────
export function availabilityKey(creatorId) {
  return `creator-availability-${creatorId}`;
}

export function loadAvailability(creatorId) {
  try {
    const current = localStorage.getItem(availabilityKey(creatorId));
    const legacy = localStorage.getItem(`availability-${creatorId}`);
    return JSON.parse(current || legacy || '{}');
  } catch { return {}; }
}

export function saveAvailability(creatorId, data) {
  localStorage.setItem(availabilityKey(creatorId), JSON.stringify(data));
}

function canUseSupabaseAvailability(creatorId) {
  return Boolean(
    supabaseConfigured &&
    supabase &&
    creatorId &&
    !String(creatorId).startsWith('seed-')
  );
}

function rowsToAvailability(rows = []) {
  return rows.reduce((acc, row) => {
    if (row.date && row.status) acc[row.date] = row.status;
    return acc;
  }, {});
}

export async function fetchAvailability(creatorId) {
  if (!canUseSupabaseAvailability(creatorId)) return loadAvailability(creatorId);

  const { data, error } = await supabase
    .from('availability')
    .select('date,status')
    .eq('listing_id', creatorId);

  if (error) {
    console.warn('CreatorBridge availability fetch failed, using local fallback:', error.message);
    return loadAvailability(creatorId);
  }

  const availability = rowsToAvailability(data || []);
  saveAvailability(creatorId, availability);
  return availability;
}

export async function persistAvailability(creatorId, data) {
  if (!canUseSupabaseAvailability(creatorId)) {
    saveAvailability(creatorId, data);
    return data;
  }

  const rows = Object.entries(data || {}).map(([date, status]) => ({
    listing_id: creatorId,
    date,
    status,
  }));

  const { error: deleteError } = await supabase
    .from('availability')
    .delete()
    .eq('listing_id', creatorId);

  if (deleteError) throw deleteError;

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('availability')
      .insert(rows);

    if (insertError) throw insertError;
  }

  saveAvailability(creatorId, data);
  return data;
}

export async function mergeAvailability(creatorId, updates) {
  const current = await fetchAvailability(creatorId);
  const merged = { ...current, ...updates };
  return persistAvailability(creatorId, merged);
}

// ── Date helpers ──────────────────────────────────────────────
function toKey(date) {
  return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STATUS_STYLES = {
  available:  { bg: 'bg-gold-500/20 text-gold-300 hover:bg-gold-500/30 border-gold-500/30', dot: 'bg-gold-400', label: 'Available' },
  booked:     { bg: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',     dot: 'bg-red-400',  label: 'Booked' },
  tentative:  { bg: 'bg-white/[0.06] text-charcoal-200 hover:bg-white/[0.09] border-white/[0.12]', dot: 'bg-charcoal-300', label: 'Tentative' },
};

// ── Mini calendar for clients (read-only) ────────────────────
export function AvailabilityMini({ creatorId, dark, onSelectDate, selectedDate }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [availability, setAvailability] = useState(() => loadAvailability(creatorId));

  useEffect(() => {
    let mounted = true;
    fetchAvailability(creatorId).then(data => {
      if (mounted) setAvailability(data);
    });
    return () => { mounted = false; };
  }, [creatorId]);

  const numDays  = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const todayKey = toKey(today);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <div className="flex gap-1">
          <button type="button" onClick={prevMonth}
            className={`p-1 rounded-lg transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={nextMonth}
            className={`p-1 rounded-lg transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className={`text-center text-[10px] font-medium py-1 ${textSub}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells before month starts */}
        {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}

        {Array.from({ length: numDays }).map((_, i) => {
          const day    = i + 1;
          const date   = new Date(viewYear, viewMonth, day);
          const key    = toKey(date);
          const status = availability[key];
          const isPast = key < todayKey;
          const isSelected = selectedDate === key;
          const isToday = key === todayKey;
          const isAvail = status === 'available';

          return (
            <button
              key={day}
              type="button"
              disabled={isPast || !isAvail}
              onClick={() => onSelectDate?.(key)}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all
                ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                ${isSelected
                  ? 'bg-gold-500 text-charcoal-900 font-bold shadow-lg scale-110'
                  : isAvail && !isPast
                    ? 'bg-gold-500/15 text-gold-300 hover:bg-gold-500/28 cursor-pointer border border-gold-500/30'
                    : status === 'booked'
                      ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed line-through'
                      : status === 'tentative'
                        ? 'bg-gold-500/10 text-gold-400/60 cursor-not-allowed'
                        : dark ? 'text-charcoal-300 hover:bg-white/[0.08]' : 'text-gray-500 hover:bg-gray-100'
                }
                ${isToday && !isSelected ? 'ring-1 ring-gold-500/50' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-3 mt-3 pt-3 border-t flex-wrap ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
        {[
          { status: 'available', label: 'Open' },
          { status: 'booked',   label: 'Booked' },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${STATUS_STYLES[status].dot}`} />
            <span className={`text-[10px] ${textSub}`}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full border border-gold-500/50" />
          <span className={`text-[10px] ${textSub}`}>Today</span>
        </div>
      </div>

      {Object.keys(availability).filter(k => availability[k] === 'available' && k >= todayKey).length === 0 && (
        <p className={`text-[10px] text-center mt-2 ${textSub}`}>
          No availability set yet - contact directly to schedule
        </p>
      )}
    </div>
  );
}

// ── Full editor calendar for creators ────────────────────────
export function AvailabilityEditor({ creatorId, dark }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [availability, setAvailability] = useState(() => loadAvailability(creatorId));
  const [paintStatus, setPaintStatus] = useState('available');
  const [saved, setSaved]             = useState(false);
  const [loading, setLoading]         = useState(false);
  const [saveError, setSaveError]     = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchAvailability(creatorId)
      .then(data => {
        if (mounted) setAvailability(data);
      })
      .catch(() => {
        if (mounted) setSaveError('Could not load saved availability. Local fallback is shown.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [creatorId]);

  const numDays  = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const todayKey = toKey(today);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function toggleDay(key) {
    if (key < todayKey) return;
    setAvailability(prev => {
      const updated = { ...prev };
      if (updated[key] === paintStatus) {
        delete updated[key]; // toggle off
      } else {
        updated[key] = paintStatus;
      }
      return updated;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaveError('');
    try {
      await persistAvailability(creatorId, availability);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError('Availability did not save. Please try again.');
      console.warn('CreatorBridge availability save failed:', error.message);
    }
  }

  function clearMonth() {
    const updated = { ...availability };
    for (let d = 1; d <= numDays; d++) {
      const key = toKey(new Date(viewYear, viewMonth, d));
      delete updated[key];
    }
    setAvailability(updated);
    setSaved(false);
  }

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  const openDaysThisMonth = Array.from({ length: numDays }).filter((_, i) => {
    const key = toKey(new Date(viewYear, viewMonth, i + 1));
    return availability[key] === 'available' && key >= todayKey;
  }).length;

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-display font-bold text-sm flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            <CalendarDays size={15} className="text-gold-400" /> Availability
          </h3>
          <p className={`text-[10px] mt-0.5 ${textSub}`}>
            {loading ? 'Loading saved availability...' : `${openDaysThisMonth} open day${openDaysThisMonth !== 1 ? 's' : ''} this month`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={clearMonth}
            className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}>
            Clear month
          </button>
          <button type="button" onClick={handleSave} disabled={loading}
            className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
              saved ? 'bg-gold-500 text-charcoal-900' : 'bg-gold-500 hover:bg-gold-600 text-charcoal-900'
            }`}>
            {saved ? <><Check size={10} /> Saved</> : 'Save'}
          </button>
        </div>
      </div>

      {/* Paint mode selector */}
      <div className="flex gap-1.5 mb-4">
        {Object.entries(STATUS_STYLES).map(([status, styles]) => (
          <button key={status} type="button" onClick={() => setPaintStatus(status)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-all ${
              paintStatus === status
                ? `${styles.bg} border-current`
                : dark ? 'border-white/[0.08] text-charcoal-300 hover:border-gold-500/30 hover:text-white' : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {styles.label}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth}
          className={`p-1 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
          <ChevronLeft size={14} />
        </button>
        <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <button type="button" onClick={nextMonth}
          className={`p-1 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className={`text-center text-[10px] font-medium py-1 ${textSub}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: numDays }).map((_, i) => {
          const day    = i + 1;
          const key    = toKey(new Date(viewYear, viewMonth, day));
          const status = availability[key];
          const isPast = key < todayKey;
          const isToday = key === toKey(today);
          const styles = status ? STATUS_STYLES[status] : null;

          return (
            <button key={day} type="button"
              disabled={isPast}
              onClick={() => toggleDay(key)}
              className={`
                aspect-square flex items-center justify-center rounded-xl text-xs font-medium transition-all border
                ${isPast
                  ? 'opacity-25 cursor-not-allowed ' + (dark ? 'text-charcoal-600 border-transparent' : 'text-gray-300 border-transparent')
                  : styles
                    ? `${styles.bg} cursor-pointer`
                    : dark
                      ? 'text-charcoal-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white cursor-pointer'
                      : 'text-gray-500 border-gray-100 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
                }
                ${isToday ? 'ring-1 ring-gold-500' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className={`text-[10px] mt-3 ${textSub}`}>
        Click a day to mark it. Click again to clear.
      </p>
      {saveError && <p className="text-[10px] mt-2 text-red-400">{saveError}</p>}
    </div>
  );
}
