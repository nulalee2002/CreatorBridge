import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

function timeAgo(iso) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(delta / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function dueText(iso) {
  if (!iso) return null;
  const hours = Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000);
  if (hours <= 0) return 'Response due now';
  if (hours <= 24) return `Respond within ${hours}h`;
  return 'Respond within 24h';
}

export function NotificationBell({ user, dark, navigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const unread = items.filter(item => !item.read).length;

  async function loadNotifications() {
    if (!user || !supabaseConfigured) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, action_url, read, response_due_at, created_at')
      .order('created_at', { ascending: false })
      .limit(12);
    if (!error) setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    function onClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAllRead() {
    const unreadIds = items.filter(item => !item.read).map(item => item.id);
    if (!unreadIds.length) return;
    setItems(prev => prev.map(item => ({ ...item, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }

  async function openNotification(item) {
    setOpen(false);
    if (!item.read) {
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, read: true } : row));
      await supabase.from('notifications').update({ read: true }).eq('id', item.id);
    }
    if (item.action_url) navigate(item.action_url);
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(value => !value); if (!open) loadNotifications(); }}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className={`relative inline-flex min-h-[34px] min-w-[34px] items-center justify-center p-2 rounded-xl transition-colors ${
          dark ? 'text-charcoal-400 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-black text-charcoal-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-2xl ${
          dark ? 'border-white/[0.09] bg-charcoal-950/96' : 'border-gray-200 bg-white'
        }`}>
          <div className={`flex items-center justify-between border-b px-4 py-3 ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
            <div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Notifications</p>
              <p className={`text-[11px] ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>CreatorBridge contact and booking updates</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unread}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-gold-400 disabled:opacity-40"
            >
              <CheckCheck size={13} className="inline" /> Read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className={`px-4 py-6 text-center text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Loading notifications...</p>
            )}

            {!loading && items.length === 0 && (
              <p className={`px-4 py-8 text-center text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>No notifications yet.</p>
            )}

            {!loading && items.map(item => {
              const due = dueText(item.response_due_at);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`block w-full border-b px-4 py-3 text-left transition-colors last:border-b-0 ${
                    dark
                      ? `border-white/[0.06] hover:bg-white/[0.04] ${item.read ? '' : 'bg-gold-500/[0.055]'}`
                      : `border-gray-100 hover:bg-gray-50 ${item.read ? '' : 'bg-gold-50'}`
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                    <span className={`shrink-0 text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>{timeAgo(item.created_at)}</span>
                  </div>
                  <p className={`mt-1 text-[11px] leading-5 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{item.body}</p>
                  {due && (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-400">{due}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
