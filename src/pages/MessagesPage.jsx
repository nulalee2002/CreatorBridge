import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare, Send, Search, ArrowLeft, MoreVertical,
  User, Check, CheckCheck, Circle, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { SERVICES } from '../data/rates.js';
import { sanitizeLongText, sanitizePlainText } from '../utils/inputSecurity.js';
import { checkMessage, logFilterEvent } from '../utils/messageFilter.js';
import { ClientReputationBadge, loadClientReputation } from '../components/ClientReputationBadge.jsx';
import { CreatorAvatar } from '../components/CreatorAvatar.jsx';

// ── localStorage helpers ────────────────────────────────────────
const LOCAL_MESSAGE_KEY = 'cm-messages';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

function makeLocalMessageId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeConversationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`.replace('.', '-');
}

function buildThreads(messages, userId) {
  const map = {};
  messages.forEach(msg => {
    if (msg.senderId !== userId && msg.recipientId !== userId) return;
    // Group by participant pair so repeat conversations with the same person
    // collapse into one inbox thread instead of one thread per conversation id.
    const tid = (msg.senderId && msg.recipientId)
      ? [msg.senderId, msg.recipientId].sort().join('_')
      : (msg.threadId || msg.remoteConversationId);
    if (!map[tid]) map[tid] = { threadId: tid, remoteConversationId: msg.remoteConversationId || null, messages: [], otherUserId: null, otherName: null, otherAvatar: null };
    map[tid].messages.push(msg);
    if (msg.remoteConversationId && !map[tid].remoteConversationId) map[tid].remoteConversationId = msg.remoteConversationId;
    if (msg.senderId === userId) {
      map[tid].otherUserId   = msg.recipientId;
      map[tid].otherName     = msg.recipientName || 'Unknown';
      map[tid].otherAvatar   = msg.recipientAvatar || null;
      map[tid].otherIsCreator = msg.recipientIsCreator || false;
    } else {
      map[tid].otherUserId   = msg.senderId;
      map[tid].otherName     = msg.senderName || 'Unknown';
      map[tid].otherAvatar   = msg.senderAvatar || null;
      map[tid].otherIsCreator = msg.senderIsCreator || false;
    }
  });
  return Object.values(map).map(t => {
    const messagesByTime = [...t.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const lastMessage = messagesByTime.at(-1);
    // Continue the most recent server conversation when sending from a merged thread.
    const latestConversationId = [...messagesByTime].reverse().find(m => m.remoteConversationId)?.remoteConversationId || t.remoteConversationId;
    const conversationIds = [...new Set(messagesByTime.map(m => m.remoteConversationId).filter(Boolean))];
    return { ...t, messages: messagesByTime, lastMessage, remoteConversationId: latestConversationId, conversationIds };
  }).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
}

function loadLocalMessages(userId) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MESSAGE_KEY) || '[]')
      .filter(msg => msg.senderId === userId || msg.recipientId === userId);
  } catch { return []; }
}

function loadThreads(userId) {
  return buildThreads(loadLocalMessages(userId), userId);
}

function saveMessage(msg) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_MESSAGE_KEY) || '[]');
    if (all.some(existing => existing.id === msg.id || (msg.remoteId && existing.remoteId === msg.remoteId))) return;
    all.push(msg);
    localStorage.setItem(LOCAL_MESSAGE_KEY, JSON.stringify(all));
  } catch {}
}

function markMessagesRead(threadId, userId) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_MESSAGE_KEY) || '[]');
    const updated = all.map(m => {
      const pairKey = (m.senderId && m.recipientId) ? [m.senderId, m.recipientId].sort().join('_') : null;
      const inThread = m.threadId === threadId || m.remoteConversationId === threadId || pairKey === threadId;
      return inThread && m.recipientId === userId ? { ...m, read: true } : m;
    });
    localStorage.setItem(LOCAL_MESSAGE_KEY, JSON.stringify(updated));
  } catch {}
}

async function markRemoteMessagesRead(thread, userId) {
  if (!supabaseConfigured || !supabase || !isUuid(userId)) return;
  // Merged threads can span multiple server conversations — mark them all read.
  const fallback = thread?.remoteConversationId || (isUuid(thread?.threadId) ? thread.threadId : null);
  const conversationIds = (thread?.conversationIds?.length ? thread.conversationIds : [fallback]).filter(Boolean);
  for (const conversationId of conversationIds) {
    try {
      const { error } = await supabase.rpc('mark_conversation_messages_read', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    } catch (error) {
      console.warn('CreatorBridge message read receipt update failed:', error?.message || error);
    }
  }
}

function mergeMessages(localMessages, remoteMessages) {
  const map = new Map();
  [...localMessages, ...remoteMessages].forEach(msg => {
    const key = msg.remoteId || `${msg.senderId}-${msg.recipientId}-${msg.createdAt}-${msg.text}`;
    const existing = map.get(key);
    map.set(key, { ...existing, ...msg, read: !!(existing?.read || msg.read) });
  });
  return [...map.values()];
}

function profileName(profile, fallback = 'Unknown') {
  return profile?.full_name || profile?.display_name || profile?.email || fallback;
}

function remoteMessageToLocal(row, currentUserId, profilesById = {}) {
  const senderProfile = profilesById[row.sender_id];
  const recipientProfile = profilesById[row.recipient_id];
  const otherId = row.sender_id === currentUserId ? row.recipient_id : row.sender_id;
  return {
    id: `remote-${row.id}`,
    remoteId: row.id,
    remoteConversationId: row.conversation_id,
    threadId: row.conversation_id,
    senderId: row.sender_id,
    senderName: profileName(senderProfile, row.sender_id === currentUserId ? 'Me' : 'CreatorBridge user'),
    senderAvatar: senderProfile?.avatar_url || null,
    recipientId: row.recipient_id,
    recipientName: profileName(recipientProfile, row.recipient_id === currentUserId ? 'Me' : 'CreatorBridge user'),
    recipientAvatar: recipientProfile?.avatar_url || null,
    text: row.body,
    read: !!row.read,
    createdAt: row.created_at,
    otherUserId: otherId,
  };
}

async function hasActiveMessageBooking(currentUserId, otherUserId) {
  if (!supabaseConfigured || !supabase || !isUuid(currentUserId) || !isUuid(otherUserId)) return false;

  try {
    const { data: creatorRows, error: creatorError } = await supabase
      .from('creator_listings')
      .select('id, user_id')
      .in('user_id', [currentUserId, otherUserId]);
    if (creatorError) throw creatorError;

    const otherCreator = (creatorRows || []).find(row => row.user_id === otherUserId);
    if (otherCreator) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('client_id', currentUserId)
        .eq('creator_id', otherCreator.id)
        .or('retainer_status.in.(paid,released),final_status.in.(paid,released)')
        .limit(1);
      if (error) throw error;
      if (data?.length) return true;
    }

    const myCreator = (creatorRows || []).find(row => row.user_id === currentUserId);
    if (myCreator) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('client_id', otherUserId)
        .eq('creator_id', myCreator.id)
        .or('retainer_status.in.(paid,released),final_status.in.(paid,released)')
        .limit(1);
      if (error) throw error;
      if (data?.length) return true;
    }
  } catch (error) {
    console.warn('CreatorBridge active booking check failed:', error?.message || error);
  }

  return false;
}

function isApprovedCreator(creator) {
  return !!(
    creator?.verified ||
    creator?.verification_status === 'verified' ||
    creator?.verification_status === 'pro_verified' ||
    creator?.id?.startsWith?.('seed-')
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Thread list item ─────────────────────────────────────────────
function ThreadItem({ thread, active, dark, onClick }) {
  const last   = thread.lastMessage;
  const unread = thread.messages.filter(m => m.recipientId === thread.myId && !m.read).length;
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-xl ${
        active
          ? dark ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-gold-50 border border-gold-200'
          : dark ? 'hover:bg-white/[0.04] border border-transparent' : 'hover:bg-gray-50 border border-transparent'
      }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${dark ? 'bg-white/[0.04] ring-1 ring-white/[0.07]' : 'bg-gray-200'}`}>
        {thread.otherAvatar || '👤'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{thread.otherName}</p>
          <span className={`text-[10px] shrink-0 ${textSub}`}>{formatTime(last?.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className={`text-xs truncate ${unread ? (dark ? 'text-charcoal-300 font-medium' : 'text-gray-700 font-medium') : textSub}`}>
            {last?.text || 'No messages yet'}
          </p>
          {unread > 0 && (
            <span className="shrink-0 w-4 h-4 rounded-full bg-gold-500 text-charcoal-900 text-[9px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────
function Bubble({ msg, isMine, dark }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-sm ${
        isMine
          ? 'bg-gold-500 text-charcoal-900 rounded-br-md'
          : dark ? 'bg-white/[0.055] text-white rounded-bl-md ring-1 ring-white/[0.07]' : 'bg-gray-100 text-gray-900 rounded-bl-md'
      }`}>
        <p className="leading-relaxed break-words">{msg.text}</p>
        <p className={`text-[10px] mt-0.5 text-right ${isMine ? 'text-charcoal-700/70' : dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
          {formatTime(msg.createdAt)}
          {isMine && <span className="ml-1">{msg.read ? <CheckCheck size={9} className="inline" /> : <Check size={9} className="inline" />}</span>}
        </p>
      </div>
    </div>
  );
}

// ── New conversation modal ────────────────────────────────────────
function NewConversationModal({ dark, onClose, onStart, myUser, myProfile }) {
  const [recipientId, setRecipientId]     = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage]             = useState('');
  const [searching, setSearching]         = useState(false);
  const [results, setResults]             = useState([]);
  const [error, setError]                 = useState('');

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  function searchCreators(query) {
    setSearching(true);
    try {
      const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
      const q = query.toLowerCase();
      setResults(all.filter(c =>
        isApprovedCreator(c) &&
        c.id !== myUser?.id &&
        (c.businessName?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q))
      ).slice(0, 5));
    } catch {}
    setSearching(false);
  }

  function selectCreator(c) {
    setRecipientId(c.user_id || c.id);
    setRecipientName(c.businessName || c.name);
    setResults([]);
    setError('');
  }

  async function handleStart() {
    const cleanMessage = sanitizeLongText(message, 1500);
    const cleanRecipientName = sanitizePlainText(recipientName, 80);
    if (!recipientId || !cleanMessage) return;

    const { blocked, patternType } = checkMessage(cleanMessage);
    const contactAllowed = blocked ? await hasActiveMessageBooking(myUser.id, recipientId) : false;
    if (blocked && !contactAllowed) {
      setError('Contact details must stay inside CreatorBridge until a booking is active.');
      logFilterEvent(myUser.id, patternType, supabase, supabaseConfigured);
      return;
    }

    setError('');
    onStart({
      recipientId,
      recipientName: cleanRecipientName || 'Creator',
      text: cleanMessage,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="cb-modal-backdrop" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 ${dark ? 'bg-charcoal-900 border-white/[0.08]' : 'bg-white border-gray-200'}`}>
        <p className="text-gold-400 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Secure Message
        </p>
        <h3 className={`font-display font-bold text-lg mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
          New Conversation
        </h3>

        {/* Recipient search */}
        <div className="mb-4 relative">
          <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Search Creator</p>
          <input
            type="text"
            value={recipientName}
            onChange={e => { setRecipientName(e.target.value); setRecipientId(''); setError(''); searchCreators(e.target.value); }}
            placeholder="Search by name..."
            className={inputCls}
          />
          {results.length > 0 && (
            <div className={`absolute z-10 top-full mt-1 w-full rounded-xl border shadow-lg overflow-hidden ${dark ? 'bg-charcoal-900 border-white/[0.09]' : 'bg-white border-gray-200'}`}>
              {results.map(c => (
                <button key={c.id} type="button" onClick={() => selectCreator(c)}
                  className={`w-full flex items-center gap-2 p-3 text-left hover:bg-gold-500/10 transition-colors`}>
                  <span className="h-8 w-8 overflow-hidden rounded-lg bg-white/[0.06] text-base">
                    <CreatorAvatar src={c.avatar} alt={c.businessName || c.name || 'Creator'} />
                  </span>
                  <span className={`text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>{c.businessName || c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message */}
        <div className="mb-4">
          <p className={`text-xs font-medium mb-1.5 ${textSub}`}>Message</p>
          <textarea
            rows={3}
            value={message}
            onChange={e => { setMessage(e.target.value); setError(''); }}
            placeholder="Introduce yourself and describe your project..."
            className={`${inputCls} resize-none`}
          />
        </div>
        {error && (
          <p className="mb-4 rounded-xl border border-gold-500/25 bg-gold-500/10 px-3 py-2 text-xs leading-relaxed text-gold-300">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all ${dark ? 'border-white/[0.09] text-charcoal-200 hover:text-white hover:border-gold-500/35' : 'border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            Cancel
          </button>
          <button type="button" onClick={handleStart}
            disabled={!recipientId || !message.trim()}
            className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
            <Send size={13} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main MessagesPage ─────────────────────────────────────────────
export function MessagesPage({ dark }) {
  const { user, profile: authProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [threads, setThreads]           = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [text, setText]                 = useState('');
  const [search, setSearch]             = useState('');
  const [showNew, setShowNew]           = useState(false);
  const [otherMetrics, setOtherMetrics] = useState(null);
  const [mobileView, setMobileView]   = useState('list'); // 'list' | 'thread'
  const [filterWarning, setFilterWarning] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  const textSub  = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls  = `rounded-[28px] border ${dark ? 'bg-charcoal-900/72 border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'}`;

  const myName   = authProfile?.full_name || user?.email?.split('@')[0] || 'Me';
  const myAvatar = authProfile?.avatar_url || null;

  async function refreshThreads() {
    if (!user) return [];

    const localMessages = loadLocalMessages(user.id);
    let remoteMessages = [];

    if (supabaseConfigured && supabase && isUuid(user.id)) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, recipient_id, listing_id, body, read, created_at')
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const participantIds = [...new Set((data || []).flatMap(row => [row.sender_id, row.recipient_id]).filter(isUuid))];
        let profilesById = {};
        if (participantIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', participantIds);
          profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));
        }

        remoteMessages = (data || []).map(row => remoteMessageToLocal(row, user.id, profilesById));
      } catch (error) {
        console.warn('CreatorBridge messages Supabase load failed, using local fallback:', error?.message || error);
      }
    }

    const loaded = buildThreads(mergeMessages(localMessages, remoteMessages), user.id)
      .map(t => ({ ...t, myId: user.id }));

    setThreads(loaded);
    setActiveThread(current => {
      if (!current) return current;
      return loaded.find(t => t.threadId === current.threadId || t.remoteConversationId === current.remoteConversationId) || current;
    });
    return loaded;
  }

  async function persistRemoteMessage(message) {
    if (!supabaseConfigured || !supabase || !isUuid(user?.id) || !isUuid(message.recipientId)) return null;

    const conversationId = message.remoteConversationId || (isUuid(message.threadId) ? message.threadId : makeConversationId());
    try {
      const { data, error } = await supabase
        .rpc('send_creatorbridge_message', {
          p_recipient_id: message.recipientId,
          p_body: message.text,
          p_conversation_id: conversationId,
          p_listing_id: message.listingId || null,
        });

      if (error) throw error;
      return remoteMessageToLocal(data, user.id, {
        [user.id]: { id: user.id, full_name: myName },
        [message.recipientId]: { id: message.recipientId, full_name: message.recipientName },
      });
    } catch (error) {
      console.warn('CreatorBridge messages Supabase save failed:', error?.message || error);
      throw error;
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    refreshThreads().then(loaded => {
      if (cancelled) return;
      const with_ = searchParams.get('with');
      if (with_) {
        const existing = loaded.find(t => t.otherUserId === with_);
        if (existing) { setActiveThread(existing); setMobileView('thread'); }
        else { setShowNew(true); }
      }
    });
    return () => { cancelled = true; };
  }, [user, searchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  function openThread(thread) {
    setActiveThread({ ...thread, myId: user.id });
    setMobileView('thread');
    setOtherMetrics(null);
    if (!thread.otherIsCreator && thread.otherUserId) {
      loadClientReputation(thread.otherUserId).then(setOtherMetrics);
    }
    markMessagesRead(thread.threadId, user.id);
    markRemoteMessagesRead(thread, user.id);
    setThreads(prev => prev.map(t =>
      t.threadId === thread.threadId
        ? { ...t, messages: t.messages.map(m => m.recipientId === user.id ? { ...m, read: true } : m) }
        : t
    ));
  }

  async function sendMessage() {
    const cleanText = sanitizeLongText(text, 1500);
    if (!cleanText || !activeThread) return;
    setSendError('');

    // Check for contact info violations
    const { blocked, patternType } = checkMessage(cleanText);
    const contactAllowed = blocked ? await hasActiveMessageBooking(user.id, activeThread.otherUserId) : false;
    if (blocked && !contactAllowed) {
      setFilterWarning(true);
      logFilterEvent(user.id, patternType, supabase, supabaseConfigured);
      return;
    }
    setFilterWarning(false);

    const msg = {
      id:             makeLocalMessageId(),
      threadId:       activeThread.threadId,
      remoteConversationId: activeThread.remoteConversationId || (isUuid(activeThread.threadId) ? activeThread.threadId : null),
      senderId:       user.id,
      senderName:     myName,
      senderAvatar:   myAvatar,
      recipientId:    activeThread.otherUserId,
      recipientName:  activeThread.otherName,
      recipientAvatar:activeThread.otherAvatar,
      text:           cleanText,
      read:           false,
      createdAt:      new Date().toISOString(),
    };
    let remoteMessage = null;
    try {
      remoteMessage = await persistRemoteMessage(msg);
    } catch (error) {
      setSendError(error?.message || 'Message could not be saved. Please try again.');
      return;
    }
    const finalMessage = remoteMessage ? {
      ...msg,
      ...remoteMessage,
      recipientName: activeThread.otherName,
      recipientAvatar: activeThread.otherAvatar,
    } : msg;

    saveMessage(finalMessage);
    const updated = {
      ...activeThread,
      threadId: finalMessage.threadId,
      remoteConversationId: finalMessage.remoteConversationId || activeThread.remoteConversationId,
      messages: [...activeThread.messages, finalMessage],
      lastMessage: finalMessage,
    };
    setActiveThread(updated);
    setThreads(prev => {
      const existing = prev.find(t => t.threadId === activeThread.threadId);
      if (existing) return prev.map(t => t.threadId === activeThread.threadId ? updated : t);
      return [updated, ...prev];
    });
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function startNewConversation({ recipientId, recipientName, text: initText }) {
    const cleanText = sanitizeLongText(initText, 1500);
    const cleanRecipientName = sanitizePlainText(recipientName, 80) || 'Creator';
    if (!recipientId || !cleanText) return;
    setSendError('');

    const { blocked, patternType } = checkMessage(cleanText);
    const contactAllowed = blocked ? await hasActiveMessageBooking(user.id, recipientId) : false;
    if (blocked && !contactAllowed) {
      setFilterWarning(true);
      logFilterEvent(user.id, patternType, supabase, supabaseConfigured);
      return;
    }
    setFilterWarning(false);

    const threadId = isUuid(user.id) && isUuid(recipientId) ? makeConversationId() : [user.id, recipientId].sort().join('_');
    const msg = {
      id:            makeLocalMessageId(),
      threadId,
      remoteConversationId: isUuid(threadId) ? threadId : null,
      senderId:      user.id,
      senderName:    myName,
      senderAvatar:  myAvatar,
      recipientId,
      recipientName: cleanRecipientName,
      text:          cleanText,
      read:          false,
      createdAt:     new Date().toISOString(),
    };
    let remoteMessage = null;
    try {
      remoteMessage = await persistRemoteMessage(msg);
    } catch (error) {
      setSendError(error?.message || 'Message could not be saved. Please try again.');
      return;
    }
    const finalMessage = remoteMessage ? {
      ...msg,
      ...remoteMessage,
      recipientName: cleanRecipientName,
    } : msg;

    saveMessage(finalMessage);
    const newThread = {
      threadId: finalMessage.threadId,
      remoteConversationId: finalMessage.remoteConversationId || (isUuid(threadId) ? threadId : null),
      myId: user.id,
      otherUserId: recipientId, otherName: cleanRecipientName, otherAvatar: null,
      messages: [finalMessage], lastMessage: finalMessage,
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThread(newThread);
    setMobileView('thread');
    setShowNew(false);
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dark ? 'bg-transparent text-white' : 'bg-gray-50 text-gray-900'}`}>
        <MessageSquare size={40} className="text-gold-400" />
        <h2 className="font-display text-xl font-bold">Sign in to view messages</h2>
        <button type="button" onClick={() => navigate('/find')}
          className="px-5 py-2.5 rounded-xl bg-gold-500 text-charcoal-900 font-bold text-sm">Go Home</button>
      </div>
    );
  }

  const filteredThreads = threads.filter(t =>
    !search || t.otherName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${dark ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Protected Communication
          </p>
          <h1 className={`font-display text-4xl md:text-5xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            Messages
          </h1>
          <p className={`mt-3 text-sm md:text-base leading-7 max-w-2xl ${textSub}`}>
            Keep client and creator conversations inside CreatorBridge so project details, booking context, and payment protection stay connected.
          </p>
        </div>
        <div className={`${cardCls} overflow-hidden relative`} style={{ height: 'calc(100vh - 230px)', minHeight: 560 }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/55 to-transparent" />
          <div className="flex h-full">

            {/* ── Thread list ── */}
            <div className={`flex flex-col w-full sm:w-72 lg:w-80 shrink-0 border-r ${dark ? 'border-white/[0.07]' : 'border-gray-200'} ${mobileView === 'thread' ? 'hidden sm:flex' : 'flex'}`}>

              {/* Header */}
              <div className={`p-4 border-b ${dark ? 'border-white/[0.07] bg-charcoal-950/35' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Messages</h2>
                  <button type="button" onClick={() => setShowNew(true)}
                    className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg bg-gold-500 text-charcoal-900 transition-all hover:bg-gold-600">
                    <MessageSquare size={13} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search conversations..."
                    className={`w-full min-h-[34px] pl-8 pr-3 py-2 text-xs rounded-xl border outline-none transition-all ${
                      dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                           : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                    }`} />
                </div>
              </div>

              {/* Thread list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredThreads.length === 0 ? (
                  <div className={`m-3 rounded-2xl border px-4 py-10 text-center ${dark ? 'border-white/[0.07] bg-charcoal-950/42' : 'border-gray-200 bg-gray-50'} ${textSub}`}>
                    <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${dark ? 'bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20' : 'bg-white text-gold-600 ring-1 ring-gray-200'}`}>
                      <MessageSquare size={18} />
                    </div>
                    <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>No conversations yet</p>
                    <p className="mx-auto mt-1 max-w-[13rem] text-xs leading-5">Start a thread from a creator profile, project, or quote request.</p>
                    <button type="button" onClick={() => setShowNew(true)}
                      className="mt-4 min-h-[34px] rounded-xl bg-gold-500 px-4 py-2 text-xs font-bold text-charcoal-900 hover:bg-gold-600 transition-colors">
                      New Message
                    </button>
                  </div>
                ) : (
                  filteredThreads.map(t => (
                    <ThreadItem
                      key={t.threadId}
                      thread={{ ...t, myId: user.id }}
                      active={activeThread?.threadId === t.threadId}
                      dark={dark}
                      onClick={() => openThread(t)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ── Message pane ── */}
            <div className={`flex flex-col flex-1 min-w-0 ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}`}>
              {!activeThread ? (
                <div className={`flex-1 flex flex-col items-center justify-center ${textSub}`}>
                  <MessageSquare size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">Select a conversation</p>
                  <p className="text-xs mt-1 opacity-70">or start a new one</p>
                  <button type="button" onClick={() => setShowNew(true)}
                    className="mt-4 min-h-[34px] px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all">
                    New Message
                  </button>
                </div>
              ) : (
                <>
                  {/* Thread header */}
                  <div className={`flex items-center gap-3 px-4 py-3 border-b ${dark ? 'border-white/[0.07] bg-charcoal-950/30' : 'border-gray-200'}`}>
                    <button type="button" onClick={() => setMobileView('list')}
                      className={`sm:hidden p-1.5 rounded-lg ${dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                      <ArrowLeft size={16} />
                    </button>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${dark ? 'bg-white/[0.04] ring-1 ring-white/[0.07]' : 'bg-gray-200'}`}>
                      {activeThread.otherAvatar || '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{activeThread.otherName}</p>
                        {otherMetrics && <ClientReputationBadge metrics={otherMetrics} dark={dark} size="sm" />}
                      </div>
                      <p className={`text-[10px] ${textSub}`}>Active recently</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {activeThread.messages.map(msg => (
                      <Bubble key={msg.id} msg={msg} isMine={msg.senderId === user.id} dark={dark} />
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div className={`p-3 border-t ${dark ? 'border-white/[0.07] bg-charcoal-950/30' : 'border-gray-200'}`}>
                    {filterWarning && (
                      <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl bg-gold-500/12 border border-gold-500/25">
                        <AlertTriangle size={13} className="text-gold-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gold-300 leading-snug">
                          Contact information stays inside CreatorBridge until a booking is active.
                        </p>
                      </div>
                    )}
                    {sendError && (
                      <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl bg-red-500/12 border border-red-500/25">
                        <AlertTriangle size={13} className="text-red-300 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-200 leading-snug">{sendError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={text}
                        onChange={e => { setText(e.target.value); if (filterWarning) setFilterWarning(false); if (sendError) setSendError(''); }}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Type a message..."
                        className={`flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-all ${
                          dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                               : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                        }`}
                      />
                      <button type="button" onClick={sendMessage} disabled={!text.trim()}
                        className="p-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 transition-all">
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNew && (
        <NewConversationModal
          dark={dark}
          onClose={() => setShowNew(false)}
          onStart={startNewConversation}
          myUser={user}
          myProfile={authProfile}
        />
      )}
    </div>
  );
}
