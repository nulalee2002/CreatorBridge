import { useState, useEffect, useRef } from 'react';
import { MapPin, Send, Flag, Heart, MessageSquare, ChevronDown, Users, Lock } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const POST_TYPES = [
  { id: 'general', label: 'General', color: 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' },
  { id: 'collab', label: 'Creator Looking for Collab', color: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/20' },
  { id: 'looking_for_creator', label: 'Client Looking for Creator', color: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/20' },
  { id: 'industry_news', label: 'Industry News', color: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/20' },
  { id: 'portfolio', label: 'Portfolio Share', color: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/20' },
];

const SEED_NETWORK_POSTS = [
  {
    id: 'net-seed-1',
    state_code: 'AZ',
    user_display_name: 'Phoenix Media Co.',
    user_verification_status: 'verified',
    user_primary_service: 'Video Production',
    post_type: 'collab',
    content: 'Looking for a drone operator in the Phoenix area for an upcoming real estate project in Scottsdale. Dates are flexible in May. Drop a reply if interested.',
    likes_count: 4,
    reply_count: 2,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'net-seed-2',
    state_code: 'CA',
    user_display_name: 'Elevation Films',
    user_verification_status: 'pro_verified',
    user_primary_service: 'Video Production',
    post_type: 'portfolio',
    content: 'Just wrapped a 3-day brand film shoot for a fintech startup in LA. Really proud of how the color grade turned out. Link to the final cut: https://vimeo.com/example',
    likes_count: 12,
    reply_count: 5,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'net-seed-3',
    state_code: 'NY',
    user_display_name: 'SoundWave Podcast',
    user_verification_status: 'verified',
    user_primary_service: 'Podcast Production',
    post_type: 'industry_news',
    content: 'Spotify just released their 2026 podcast trends report. Short-form video podcasts are up 340% year over year. If you are not already offering a video podcast package to clients, now is the time.',
    likes_count: 8,
    reply_count: 3,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'net-seed-4',
    state_code: 'TX',
    user_display_name: 'Lone Star Visuals',
    user_verification_status: 'verified',
    user_primary_service: 'Photography',
    post_type: 'looking_for_creator',
    content: 'We are a Houston-based marketing agency looking for a verified headshot photographer for a quarterly executive portrait session. Professional studio preferred. Reply here if you match.',
    likes_count: 6,
    reply_count: 4,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'net-seed-5',
    state_code: 'AZ',
    user_display_name: 'Desert Sky Media',
    user_verification_status: 'verified',
    user_primary_service: 'Drone / Aerial',
    post_type: 'general',
    content: 'FAA just updated the Part 107 LAANC authorization zones around PHX Sky Harbor. If you are flying commercial jobs near the airport make sure your authorizations are current before your next shoot.',
    likes_count: 9,
    reply_count: 1,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

const BLOCKED_PHRASES = [
  'project board', 'job posting', 'i posted a job', 'check the board',
  'apply on the board',
];

const CONTACT_PATTERNS = [
  /@[a-zA-Z0-9_.]{2,}/,
  /\b[\w.-]+@[\w.-]+\.\w{2,}\b/,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

function containsBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKED_PHRASES.some(p => lower.includes(p));
}

function containsContactInfo(text) {
  return CONTACT_PATTERNS.some(p => p.test(text));
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-gold-400 underline break-all">{part}</a>
      : part
  );
}

function getPostTypeStyle(type) {
  return POST_TYPES.find(t => t.id === type)?.color || 'bg-white/[0.04] text-charcoal-300';
}

function getPostTypeLabel(type) {
  return POST_TYPES.find(t => t.id === type)?.label || 'General';
}

function loadLocalPosts(stateCode) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-network-posts') || '[]');
    const seeds = SEED_NETWORK_POSTS.filter(p => p.state_code === stateCode);
    const local = all.filter(p => p.state_code === stateCode);
    const seedIds = seeds.map(s => s.id);
    const merged = [...seeds, ...local.filter(p => !seedIds.includes(p.id))];
    return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch { return []; }
}

function saveLocalPost(post) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-network-posts') || '[]');
    all.unshift(post);
    localStorage.setItem('cm-network-posts', JSON.stringify(all));
  } catch {}
}

function loadLocalChat(stateCode) {
  try {
    return JSON.parse(localStorage.getItem(`cm-state-chat-${stateCode}`) || '[]');
  } catch { return []; }
}

function saveLocalMessage(stateCode, msg) {
  try {
    const all = JSON.parse(localStorage.getItem(`cm-state-chat-${stateCode}`) || '[]');
    all.push(msg);
    localStorage.setItem(`cm-state-chat-${stateCode}`, JSON.stringify(all));
  } catch {}
}

function VerificationDot({ status }) {
  if (!status || status === 'unverified') return null;
  return (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gold-500/15 text-gold-400 text-[8px] font-bold ml-1">
      ✓
    </span>
  );
}

function PostCard({ post, dark, isVerified, onLike, onReport }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes_count || 0);

  const cardBg = dark ? 'bg-charcoal-900/72 border-white/[0.07] shadow-[0_22px_70px_rgba(0,0,0,0.18)]' : 'bg-white border-gray-200';

  function handleLike() {
    if (liked) return;
    setLiked(true);
    setLocalLikes(n => n + 1);
    onLike && onLike(post.id);
  }

  function handleReplySubmit(e) {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || !isVerified) return;
    if (containsBlockedContent(trimmed) || containsContactInfo(trimmed)) {
      alert('Your reply contains disallowed content. Please keep all communication professional and avoid contact info or job board references.');
      return;
    }
    const newReply = {
      id: `reply-${Date.now()}`,
      post_id: post.id,
      user_display_name: 'You',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setReplies(prev => [...prev, newReply]);
    setReplyText('');
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all ${cardBg}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center text-xs font-bold shrink-0">
          {getInitials(post.user_display_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap mb-1">
            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {post.user_display_name}
            </span>
            <VerificationDot status={post.user_verification_status} />
            {post.user_primary_service && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
                {post.user_primary_service}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
              <MapPin size={9} className="inline mr-0.5" />{post.state_code}
            </span>
          </div>
          <div className="mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getPostTypeStyle(post.post_type)}`}>
              {getPostTypeLabel(post.post_type)}
            </span>
          </div>
          <p className={`text-sm leading-relaxed ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
            {linkifyText(post.content)}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <button
              type="button"
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? 'text-red-400' : dark ? 'text-charcoal-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}
            >
              <Heart size={13} className={liked ? 'fill-current' : ''} /> {localLikes}
            </button>
            <button
              type="button"
              onClick={() => setShowReplies(v => !v)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${dark ? 'text-charcoal-500 hover:text-charcoal-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <MessageSquare size={13} /> {post.reply_count || replies.length || 0} {showReplies ? 'Hide' : 'Reply'}
            </button>
            <span className={`text-xs ml-auto ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
              {timeAgo(post.created_at)}
            </span>
            <button
              type="button"
              onClick={() => onReport && onReport(post.id)}
              className={`text-[10px] transition-colors ${dark ? 'text-charcoal-700 hover:text-charcoal-500' : 'text-gray-300 hover:text-gray-400'}`}
              title="Report post"
            >
              <Flag size={11} />
            </button>
          </div>

          {showReplies && (
            <div className={`mt-3 space-y-2 pl-3 border-l-2 ${dark ? 'border-gold-500/25' : 'border-gold-200'}`}>
              {replies.map(r => (
                <div key={r.id} className="text-xs">
                  <span className={`font-semibold ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>{r.user_display_name}</span>
                  <span className={`ml-2 ${dark ? 'text-charcoal-400' : 'text-gray-600'}`}>{r.content}</span>
                  <span className={`ml-2 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>{timeAgo(r.created_at)}</span>
                </div>
              ))}
              {isVerified ? (
                <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    maxLength={280}
                    placeholder="Write a reply..."
                    className={`flex-1 text-xs rounded-lg px-3 py-1.5 border outline-none focus:border-gold-500 ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                  />
                  <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold transition-all">
                    Reply
                  </button>
                </form>
              ) : (
                <p className={`text-xs italic mt-1 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>Verify your account to reply.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NetworkingPage({ dark, user }) {
  const [selectedState, setSelectedState] = useState('');
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [chatInput, setChatInput] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postError, setPostError] = useState('');
  const [chatError, setChatError] = useState('');
  const chatBottomRef = useRef(null);
  const channelRef = useRef(null);

  const isVerified = !!(user?.verification_status && user.verification_status !== 'unverified') || !!(user?.verified);
  const stateName = US_STATES.find(s => s.code === selectedState)?.name || selectedState;

  const activePosts = [
    { code: 'AZ', count: SEED_NETWORK_POSTS.filter(p => p.state_code === 'AZ').length },
    { code: 'CA', count: SEED_NETWORK_POSTS.filter(p => p.state_code === 'CA').length },
    { code: 'TX', count: SEED_NETWORK_POSTS.filter(p => p.state_code === 'TX').length },
    { code: 'NY', count: SEED_NETWORK_POSTS.filter(p => p.state_code === 'NY').length },
    { code: 'FL', count: 0 },
  ].sort((a, b) => b.count - a.count).slice(0, 5);

  useEffect(() => {
    if (!selectedState) return;
    loadPosts();
    loadChat();
    return () => { channelRef.current?.unsubscribe(); };
  }, [selectedState]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadPosts() {
    setLoadingPosts(true);
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('network_posts')
        .select('*')
        .eq('state_code', selectedState)
        .eq('is_flagged', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      setPosts(data || loadLocalPosts(selectedState));
    } else {
      setPosts(loadLocalPosts(selectedState));
    }
    setLoadingPosts(false);
  }

  async function loadChat() {
    let msgs = [];
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('state_chat_messages')
        .select('*')
        .eq('state_code', selectedState)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(50);
      msgs = data || loadLocalChat(selectedState);

      channelRef.current?.unsubscribe();
      channelRef.current = supabase
        .channel(`state-chat-${selectedState}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'state_chat_messages',
          filter: `state_code=eq.${selectedState}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();
    } else {
      msgs = loadLocalChat(selectedState);
    }
    setMessages(msgs);
  }

  async function handleSubmitPost(e) {
    e.preventDefault();
    const trimmed = postContent.trim();
    if (!trimmed || !isVerified) return;
    if (containsBlockedContent(trimmed)) {
      setPostError('Your post mentions job board content which is not allowed in state networks. Please keep posts professional and relevant to media production.');
      return;
    }
    if (containsContactInfo(trimmed)) {
      setPostError('Please do not include contact information such as email, phone, or social handles in posts.');
      return;
    }
    setPostError('');

    const newPost = {
      id: `post-${Date.now()}`,
      state_code: selectedState,
      user_id: user?.id,
      user_display_name: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Member',
      user_verification_status: user?.verification_status || 'verified',
      user_primary_service: user?.user_metadata?.primary_service || '',
      post_type: postType,
      content: trimmed,
      likes_count: 0,
      reply_count: 0,
      is_flagged: false,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (supabaseConfigured) {
      const { data, error } = await supabase.from('network_posts').insert({
        state_code: selectedState,
        user_id: user.id,
        content: trimmed,
        post_type: postType,
      }).select().single();
      if (!error && data) {
        setPosts(prev => [{ ...newPost, ...data }, ...prev]);
      }
    } else {
      saveLocalPost(newPost);
      setPosts(prev => [newPost, ...prev]);
    }
    setPostContent('');
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !isVerified) return;
    if (containsBlockedContent(trimmed) || containsContactInfo(trimmed)) {
      setChatError('Message contains disallowed content. Keep chat professional and avoid contact info or job board references.');
      return;
    }
    setChatError('');

    const msg = {
      id: `msg-${Date.now()}`,
      state_code: selectedState,
      user_id: user?.id,
      user_display_name: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Member',
      user_verification_status: user?.verification_status || 'verified',
      user_primary_service: user?.user_metadata?.primary_service || '',
      message: trimmed,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (supabaseConfigured) {
      await supabase.from('state_chat_messages').insert({
        state_code: selectedState,
        user_id: user.id,
        message: trimmed,
        user_display_name: msg.user_display_name,
        user_verification_status: msg.user_verification_status,
        user_primary_service: msg.user_primary_service,
      });
    } else {
      saveLocalMessage(selectedState, msg);
      setMessages(prev => [...prev, msg]);
    }
    setChatInput('');
  }

  function handleLike(postId) {
    if (supabaseConfigured && user) {
      supabase.from('network_post_likes').insert({ post_id: postId, user_id: user.id }).catch(() => {});
    }
  }

  function handleReport(postId) {
    if (window.confirm('Report this post as inappropriate?')) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
  }

  const bg = dark ? 'bg-transparent' : 'bg-gray-50';
  const cardCls = `rounded-2xl border ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Page header */}
        <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-8 mb-6 ${
          dark ? 'bg-charcoal-900/72 border-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.28)]' : 'bg-white border-gray-200'
        }`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
          <p className="text-gold-400 mb-3" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            State Creator Network
          </p>
          <h1 className={`font-display font-bold text-4xl md:text-5xl mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Creator Network
          </h1>
          <p className={`text-sm md:text-base leading-7 max-w-2xl ${textSub}`}>
            Connect with verified media professionals in your area while keeping opportunities, referrals, and production conversations inside CreatorBridge.
          </p>
        </div>

        {/* State selector */}
        <div className={`${cardCls} p-5 mb-6`}>
          <div className="flex items-center gap-4 flex-wrap">
            <MapPin size={16} className="text-gold-400 shrink-0" />
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>Choose a state network</p>
              <p className={`text-xs mt-1 ${textSub}`}>Posts and live chat are organized by state.</p>
            </div>
            <div className="relative">
              <select
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                className={`appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm font-medium outline-none focus:border-gold-500 cursor-pointer ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
              >
                <option value="">Select your state...</option>
                {US_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
            </div>
          </div>

          {/* Active state bubbles */}
          <div className="flex gap-2 flex-wrap mt-4">
            <span className={`text-xs ${textSub}`}>Most active:</span>
            {activePosts.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => setSelectedState(s.code)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                  selectedState === s.code
                    ? 'bg-gold-500 text-charcoal-900 border-gold-500'
                    : dark
                      ? 'border-white/[0.09] text-charcoal-400 hover:border-gold-500 hover:text-gold-400'
                      : 'border-gray-200 text-gray-500 hover:border-gold-500 hover:text-gold-500'
                }`}
              >
                {s.code} {s.count > 0 && <span className="opacity-60">({s.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {!selectedState ? (
          <div className={`${cardCls} p-12 text-center`}>
            <MapPin size={32} className={`mx-auto mb-3 ${textSub}`} />
            <p className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Select a state to get started</p>
            <p className={`text-sm mt-1 ${textSub}`}>Browse posts and join live chat from creators in your area.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Feed column */}
            <div className="space-y-4 lg:col-span-2">

              {/* Post composer */}
              <div className={`${cardCls} p-5`}>
                {/* Warning banner */}
                <div className={`rounded-xl p-3 mb-4 text-xs ${dark ? 'bg-charcoal-950/75 text-charcoal-400 border border-white/[0.07]' : 'bg-gold-50 text-gold-800 border border-gold-200'}`}>
                  Keep all posts professional and relevant to media production. Mentioning job postings from the Project Board is not allowed here. Violations result in strikes against your account.
                </div>

                {isVerified ? (
                  <form onSubmit={handleSubmitPost}>
                    <textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder={`Share something with the ${stateName} community...`}
                      className={`w-full rounded-xl border p-3 text-sm outline-none focus:border-gold-500 resize-none ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    />
                    <div className="flex items-center justify-between mt-1 mb-3">
                      <span className={`text-xs ${textSub}`}>{postContent.length}/500</span>
                    </div>

                    {/* Post type pills */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      {POST_TYPES.map(pt => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => setPostType(pt.id)}
                          className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                            postType === pt.id
                              ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                              : dark
                                ? 'border-white/[0.09] text-charcoal-400 hover:border-charcoal-500'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {pt.label}
                        </button>
                      ))}
                    </div>

                    {postError && (
                      <p className="text-xs text-red-400 mb-3">{postError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={!postContent.trim()}
                      className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all"
                    >
                      Post to {stateName} Network
                    </button>
                  </form>
                ) : (
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${dark ? 'bg-charcoal-950/75 border border-white/[0.07]' : 'bg-gray-50 border border-gray-200'}`}>
                    <Lock size={18} className={textSub} />
                    <div>
                      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Verify your account to post in state networks.</p>
                      <p className={`text-xs mt-0.5 ${textSub}`}>Browsing is open to everyone.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Posts */}
              {loadingPosts ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full" />
                </div>
              ) : posts.length === 0 ? (
                <div className={`${cardCls} p-10 text-center`}>
                  <p className={`text-sm ${textSub}`}>No posts yet in {stateName}. Be the first to share something.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      dark={dark}
                      isVerified={isVerified}
                      onLike={handleLike}
                      onReport={handleReport}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Chat sidebar */}
            <div className="space-y-4 lg:col-span-1">
              <div className={`${cardCls} flex flex-col`} style={{ height: '520px' }}>
                {/* Chat header */}
                <div className={`p-4 border-b flex items-center gap-2 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
                  <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                  <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {stateName} Live Chat
                  </span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-white/[0.04] text-charcoal-300 ring-1 ring-white/[0.06]' : 'bg-gray-100 text-gray-500'}`}>
                    <Users size={10} className="inline mr-1" />
                    Live
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className={`text-xs text-center pt-4 ${textSub}`}>No messages yet. Start the conversation.</p>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-gold-500/15 text-gold-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {getInitials(msg.user_display_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xs font-semibold ${dark ? 'text-charcoal-200' : 'text-gray-800'}`}>
                              {msg.user_display_name}
                            </span>
                            <VerificationDot status={msg.user_verification_status} />
                            <span className={`text-[10px] ml-auto shrink-0 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat input */}
                <div className={`p-3 border-t ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
                  {chatError && <p className="text-xs text-red-400 mb-2">{chatError}</p>}
                  {isVerified ? (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        maxLength={300}
                        placeholder={`Message ${stateName} chat...`}
                        className={`flex-1 text-xs rounded-xl px-3 py-2 border outline-none focus:border-gold-500 ${dark ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}}
                      />
                      <button type="submit" className="p-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 transition-all">
                        <Send size={14} />
                      </button>
                    </form>
                  ) : (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${dark ? 'bg-charcoal-950/75 text-charcoal-600' : 'bg-gray-100 text-gray-400'}`} title="Verify your account to join the chat">
                      <Lock size={12} /> Verify your account to join the chat
                    </div>
                  )}
                </div>
              </div>

              {/* Stats card */}
              <div className={`${cardCls} p-4`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>
                  Active in {stateName}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textSub}`}>Verified creators</span>
                    <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {posts.filter(p => p.user_verification_status && p.user_verification_status !== 'unverified').length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textSub}`}>Posts this week</span>
                    <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {posts.filter(p => Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length}
                    </span>
                  </div>
                </div>
                {posts.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-[10px] uppercase tracking-wider mb-2 ${textSub}`}>Recently Active</p>
                    <div className="space-y-2">
                      {posts.slice(0, 4).map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {getInitials(p.user_display_name)}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>{p.user_display_name}</p>
                            {p.user_primary_service && (
                              <p className={`text-[10px] truncate ${textSub}`}>{p.user_primary_service}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
