import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Send, Flag, Heart, MessageSquare, ChevronDown, Users, Lock } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { sanitizeLongText, sanitizePlainText } from '../utils/inputSecurity.js';
import { checkMessage, logFilterEvent } from '../utils/messageFilter.js';
import { HandoffPage } from '../components/HandoffPage.jsx';
import { handoffPages } from '../data/handoffPages.js';
import { CreatorAvatar } from '../components/CreatorAvatar.jsx';

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

const MOCK_STATES = [
  { abbr: "CA", name: "California",   creators: 142, posts: 18, active: 23, hot: true },
  { abbr: "NY", name: "New York",     creators: 118, posts: 14, active: 19, hot: true },
  { abbr: "TX", name: "Texas",        creators: 89,  posts: 11, active: 12, hot: true },
  { abbr: "FL", name: "Florida",      creators: 76,  posts: 9,  active: 14, hot: true },
  { abbr: "IL", name: "Illinois",     creators: 54,  posts: 5,  active: 7,  hot: false },
  { abbr: "GA", name: "Georgia",      creators: 47,  posts: 6,  active: 8,  hot: true },
  { abbr: "AZ", name: "Arizona",      creators: 38,  posts: 7,  active: 9,  hot: true },
  { abbr: "WA", name: "Washington",   creators: 41,  posts: 4,  active: 6,  hot: false },
  { abbr: "MA", name: "Massachusetts",creators: 32,  posts: 3,  active: 4,  hot: false },
  { abbr: "CO", name: "Colorado",     creators: 28,  posts: 4,  active: 5,  hot: false },
  { abbr: "PA", name: "Pennsylvania", creators: 31,  posts: 2,  active: 3,  hot: false },
  { abbr: "NC", name: "N. Carolina",  creators: 26,  posts: 3,  active: 4,  hot: false },
  { abbr: "OR", name: "Oregon",       creators: 22,  posts: 2,  active: 3,  hot: false },
  { abbr: "MI", name: "Michigan",     creators: 20,  posts: 1,  active: 2,  hot: false },
  { abbr: "OH", name: "Ohio",         creators: 19,  posts: 1,  active: 2,  hot: false },
  { abbr: "MN", name: "Minnesota",    creators: 17,  posts: 1,  active: 2,  hot: false },
  { abbr: "NV", name: "Nevada",       creators: 21,  posts: 2,  active: 3,  hot: false },
  { abbr: "UT", name: "Utah",         creators: 15,  posts: 1,  active: 2,  hot: false },
  { abbr: "TN", name: "Tennessee",    creators: 23,  posts: 3,  active: 4,  hot: false },
  { abbr: "VA", name: "Virginia",     creators: 18,  posts: 1,  active: 2,  hot: false },
  { abbr: "OK", name: "Oklahoma",     creators: 9,   posts: 0,  active: 1,  hot: false },
  { abbr: "WI", name: "Wisconsin",    creators: 11,  posts: 1,  active: 1,  hot: false },
  { abbr: "MO", name: "Missouri",     creators: 13,  posts: 1,  active: 2,  hot: false },
  { abbr: "LA", name: "Louisiana",    creators: 16,  posts: 2,  active: 3,  hot: false }
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
    user_primary_service: 'Video Production',
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
    user_primary_service: 'Video Production',
    post_type: 'general',
    content: 'FAA just updated the Part 107 LAANC authorization zones around PHX Sky Harbor. If you are flying commercial jobs near the airport make sure your authorizations are current before your next shoot.',
    likes_count: 9,
    reply_count: 1,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_CHAT = {
  general: [
    { id: 'm-seed-1', name: "Naomi G.", time: "10:32", avatar: "/images/creatorbridge/handoff/photo-1531746020798-e6953c6e8e04.jpg", text: "Good morning ☕️ shooting a brand piece in Venice today, weather's perfect" },
    { id: 'm-seed-2', name: "Aria V.", time: "10:35", avatar: "/images/creatorbridge/handoff/photo-1494790108377-be9c29b29330.jpg", text: "Jealous. Miami's humid AF. Crew suiting up for an indoor shoot all day" },
    { id: 'm-seed-3', name: "David P.", time: "10:38", avatar: "/images/creatorbridge/handoff/photo-1438761681033-6461ffad8d80.jpg", text: "Anyone tried the new Sony Burano on a real job? Considering renting for next week" },
    { id: 'm-seed-4', name: "Mateo R.", time: "10:41", avatar: "/images/creatorbridge/handoff/photo-1500648767791-00dcc994a43e.jpg", text: "Cleared for Part 107 recertification today — back in the air next week" },
    { id: 'm-seed-5', name: "Jordan M.", time: "10:44", avatar: "/images/creatorbridge/handoff/photo-1507003211169-0a1dd7228f2d.jpg", text: "Booked 4 podcast clients off the project board in May. CB scoring better than any cold outbound I've ever done" },
    { id: 'm-seed-6', name: "Sofia P.", time: "10:48", avatar: "/images/creatorbridge/handoff/photo-1487412720507-e7ab37603c6f.jpg", text: "Lighting test shots from yesterday — full client approval before we even broke for lunch" }
  ],
  referrals: [
    { id: 'm-seed-7', name: "Aria V.", time: "9:14", avatar: "/images/creatorbridge/handoff/photo-1494790108377-be9c29b29330.jpg", text: "Boutique hotel rebrand looking for video — anyone California-based with hospitality reel?" },
    { id: 'm-seed-8', name: "Naomi G.", time: "9:18", avatar: "/images/creatorbridge/handoff/photo-1531746020798-e6953c6e8e04.jpg", text: "I'll bite — DMing now" },
    { id: 'm-seed-9', name: "David P.", time: "9:22", avatar: "/images/creatorbridge/handoff/photo-1438761681033-6461ffad8d80.jpg", text: "Aria solid pick, his Standard Hotels work was 10/10" }
  ],
  gear: [
    { id: 'm-seed-10', name: "David P.", time: "8:52", avatar: "/images/creatorbridge/handoff/photo-1438761681033-6461ffad8d80.jpg", text: "Selling FX6, see today's main feed for details" },
    { id: 'm-seed-11', name: "Sofia P.", time: "9:01", avatar: "/images/creatorbridge/handoff/photo-1487412720507-e7ab37603c6f.jpg", text: "Renting Profoto B10 Plus duo · $80/day · Manhattan" },
    { id: 'm-seed-12', name: "Mateo R.", time: "9:11", avatar: "/images/creatorbridge/handoff/photo-1500648767791-00dcc994a43e.jpg", text: "Anyone got an extra ND filter set in 4×5.65? Mine fell into Lake Travis on Saturday 🪦" }
  ],
  leads: [
    { id: 'm-seed-13', name: "Aria V.", time: "11:02", avatar: "/images/creatorbridge/handoff/photo-1494790108377-be9c29b29330.jpg", text: "Routing 2 commercial photo briefs to FL/CA — see today's main feed" },
    { id: 'm-seed-14', name: "Dre W.", time: "11:08", avatar: "/images/creatorbridge/handoff/photo-1607746882042-944635dfe10e.jpg", text: "Atlanta tech conf needs 2nd shooter, June 14-15. Posted to project board, applying via CB" }
  ]
};

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
  return sanitizePlainText(name || '?', 80).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="inline-flex min-h-[34px] items-center text-gold-400 underline break-all">{part}</a>
      : part
  );
}

function getSeedAvatar(id) {
  const seedAvatars = {
    'net-seed-1': '/images/creatorbridge/handoff/photo-1507003211169-0a1dd7228f2d.jpg',
    'net-seed-2': '/images/creatorbridge/handoff/photo-1531746020798-e6953c6e8e04.jpg',
    'net-seed-3': '/images/creatorbridge/handoff/photo-1438761681033-6461ffad8d80.jpg',
    'net-seed-4': '/images/creatorbridge/handoff/photo-1544005313-94ddf0286df2.jpg',
    'net-seed-5': '/images/creatorbridge/handoff/photo-1502823403499-6ccfcf4fb453.jpg'
  };
  return seedAvatars[id] || null;
}

function getPostTypeLabel(type) {
  switch (type) {
    case 'looking_for_creator': return 'Gig Lead';
    case 'general': return 'Gear swap';
    case 'collab': return 'Collab';
    case 'portfolio': return 'Referral';
    case 'industry_news': return 'Industry News';
    default: return 'General';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function dedupeById(items) {
  const seen = new Map();
  for (const item of items || []) {
    if (item?.id && !seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

function getUserDisplayName(user, profile = null) {
  return sanitizePlainText(
    profile?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member',
    80
  );
}

function getUserVerificationStatus(user, profile = null) {
  return sanitizePlainText(
    profile?.verification_status || user?.verification_status || user?.user_metadata?.verification_status || (user?.email_confirmed_at ? 'verified' : 'unverified'),
    40
  );
}

function getUserPrimaryService(user, profile = null) {
  return sanitizePlainText(
    profile?.primary_service || user?.primary_service || user?.user_metadata?.primary_service || user?.user_metadata?.service || '',
    80
  );
}

function mapReply(row) {
  return {
    ...row,
    content: sanitizeLongText(row?.content || '', 280),
    user_display_name: sanitizePlainText(row?.user_display_name || 'Member', 80),
    user_verification_status: sanitizePlainText(row?.user_verification_status || 'verified', 40),
    user_primary_service: sanitizePlainText(row?.user_primary_service || '', 80),
    created_at: row?.created_at || new Date().toISOString(),
  };
}

function withSafeReplies(post) {
  return {
    ...post,
    replies: Array.isArray(post?.replies) ? post.replies.map(mapReply) : [],
  };
}

function loadLocalPosts(stateCode) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-network-posts') || '[]');
    const seeds = SEED_NETWORK_POSTS.filter(p => p.state_code === stateCode).map(withSafeReplies);
    const local = all.filter(p => p.state_code === stateCode).map(withSafeReplies);
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

function saveLocalReply(stateCode, postId, reply) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-network-posts') || '[]');
    const next = all.map(post => {
      if (post.id !== postId || post.state_code !== stateCode) return post;
      const replies = dedupeById([...(post.replies || []), reply]);
      return { ...post, replies, reply_count: Math.max(post.reply_count || 0, replies.length) };
    });
    localStorage.setItem('cm-network-posts', JSON.stringify(next));
  } catch {}
}

const encodeChannelMessage = (channel, text) => {
  if (channel === 'general') return text;
  return `[${channel}] ${text}`;
};

const decodeChannelMessage = (text) => {
  const match = text.match(/^\[(general|referrals|gear|leads)\]\s*(.*)$/);
  if (match) {
    return { channel: match[1], message: match[2] };
  }
  return { channel: 'general', message: text };
};

function loadLocalChat(stateCode) {
  const list = [];
  Object.keys(MOCK_CHAT).forEach(channel => {
    MOCK_CHAT[channel].forEach(m => {
      list.push({
        id: m.id,
        state_code: stateCode,
        user_display_name: m.name,
        user_verification_status: 'verified',
        user_primary_service: '',
        message: channel === 'general' ? m.text : `[${channel}] ${m.text}`,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      });
    });
  });
  return list;
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
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gold-500/15 text-gold-400 text-[8px] font-bold ml-1" title="Verified Creator">
      ✓
    </span>
  );
}

function PostCard({ post, dark, isVerified, onLike, onReport, onReply }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState(post.replies || []);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes_count || 0);

  const visibleReplyCount = Math.max(post.reply_count || 0, replies.length || 0);

  useEffect(() => {
    setReplies(post.replies || []);
    setLocalLikes(post.likes_count || 0);
    setLiked(false);
  }, [post.id, post.likes_count, post.replies]);

  function handleLike() {
    if (liked) return;
    setLiked(true);
    setLocalLikes(n => n + 1);
    onLike && onLike(post.id);
  }

  async function handleReplySubmit(e) {
    e.preventDefault();
    const cleanReply = sanitizeLongText(replyText, 280);
    if (!cleanReply || !isVerified) return;
    const { blocked, patternType } = checkMessage(cleanReply);
    if (containsBlockedContent(cleanReply) || containsContactInfo(cleanReply) || blocked) {
      logFilterEvent(post.user_id || post.id || 'network-reply', patternType || 'blocked_network_reply', supabase, supabaseConfigured);
      alert('Your reply contains disallowed content. Please keep all communication professional and avoid contact info or job board references.');
      return;
    }
    const savedReply = await onReply?.(post.id, cleanReply);
    if (!savedReply) return;
    setReplies(prev => dedupeById([...prev, savedReply]));
    setReplyText('');
  }

  const avatarUrl = post.avatar_url || (post.id && post.id.startsWith('net-seed-') ? getSeedAvatar(post.id) : null);

  return (
    <div className="post-card">
      <div className="post-meta">
        {avatarUrl ? (
          <div className="post-avatar">
            <CreatorAvatar src={avatarUrl} alt={post.user_display_name} fallback={getInitials(post.user_display_name)} />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-[10px] bg-gold-500/20 text-gold-400 flex items-center justify-center text-xs font-bold shrink-0 border border-white/[0.08]">
            {getInitials(post.user_display_name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {post.user_display_name}
            </span>
            <VerificationDot status={post.user_verification_status} />
            <span className="tag-gold">
              {getPostTypeLabel(post.post_type)}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)]">
            {post.user_primary_service || 'Media Professional'} · {timeAgo(post.created_at)}
          </div>
        </div>
        <button
          onClick={() => onReport && onReport(post.id)}
          className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors"
          title="Report post"
        >
          <Flag size={14} />
        </button>
      </div>

      <p className="text-sm text-[var(--text)]/90 leading-relaxed mb-4">
        {linkifyText(post.content)}
      </p>

      <div className="flex items-center gap-4 text-[11px] text-[var(--text-dim)] pt-3 border-t border-[var(--border)]">
        <button
          onClick={() => handleLike()}
          className={`flex min-h-[34px] items-center gap-1.5 transition-colors ${liked ? 'text-red-400 animate-pulse' : 'hover:text-[var(--gold)]'}`}
        >
          <Heart size={14} className={liked ? 'fill-current' : ''} /> {localLikes} Likes
        </button>
        <button
          onClick={() => setShowReplies(v => !v)}
          className="flex min-h-[34px] items-center gap-1.5 hover:text-[var(--gold)] transition-colors"
        >
          <MessageSquare size={14} /> {visibleReplyCount} replies
        </button>
        <button
          onClick={() => setShowReplies(v => !v)}
          className="flex min-h-[34px] items-center gap-1.5 hover:text-[var(--gold)] transition-colors ml-auto font-medium"
        >
          Reply <span className="text-[10px] ml-0.5">→</span>
        </button>
      </div>

      {showReplies && (
        <div className="mt-4 space-y-3 pl-3 border-l-2 border-gold-500/25">
          {replies.map(r => (
            <div key={r.id} className="text-xs">
              <span className="font-semibold text-charcoal-200">{r.user_display_name}</span>
              <span className="ml-2 text-charcoal-300">{linkifyText(r.content)}</span>
              <span className="ml-2 text-charcoal-600">{timeAgo(r.created_at)}</span>
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
                className="flex-1 text-xs rounded-lg px-3 py-1.5 border outline-none focus:border-gold-500 bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500"
              />
              <button type="submit" className="min-h-[34px] text-xs px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-charcoal-900 font-bold transition-all">
                Reply
              </button>
            </form>
          ) : (
            <p className="text-xs italic mt-1 text-charcoal-600">Verify your account to reply.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function NetworkingPage({ dark, user, profile }) {
  const [selectedState, setSelectedState] = useState('CA');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [filterType, setFilterType] = useState('all');
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

  const postComposerRef = useRef(null);
  const chatInputRef = useRef(null);

  const isVerified = !!user?.id && (
    profile?.role === 'client' ||
    ['verified', 'pro_verified', 'approved'].includes(profile?.verification_status) ||
    (user?.verification_status && user.verification_status !== 'unverified') ||
    !!user?.verified ||
    !!user?.email_confirmed_at
  );

  const displayStates = useMemo(() => {
    const list = [...MOCK_STATES];
    if (selectedState && !list.some(s => s.abbr === selectedState)) {
      const fullState = US_STATES.find(s => s.code === selectedState);
      list.push({
        abbr: selectedState,
        name: fullState ? fullState.name : selectedState,
        creators: 14,
        posts: 2,
        active: 3,
        hot: false
      });
    }
    return list;
  }, [selectedState]);

  const activeStateObj = useMemo(() => {
    return displayStates.find(s => s.abbr === selectedState) || {
      abbr: selectedState,
      name: US_STATES.find(s => s.code === selectedState)?.name || selectedState,
      creators: 12,
      posts: 2,
      active: 4,
      hot: false
    };
  }, [displayStates, selectedState]);

  useEffect(() => {
    if (!selectedState) return;
    loadPosts();
    loadChat();
    return () => { channelRef.current?.unsubscribe(); };
  }, [selectedState]);

  useEffect(() => {
    // Scroll only the chat's own message list to the newest message.
    // scrollIntoView scrolled every ancestor too, yanking the whole page
    // down to the chat panel every time the Network page opened.
    const marker = chatBottomRef.current;
    const scroller = marker?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, selectedChannel]);

  async function loadPosts() {
    setLoadingPosts(true);
    setPostError('');
    if (supabaseConfigured) {
      const { data, error } = await supabase
        .from('network_posts')
        .select('*')
        .eq('state_code', selectedState)
        .eq('is_flagged', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        setPostError('Network posts could not be loaded. Showing local fallback content.');
        setPosts(loadLocalPosts(selectedState));
      } else {
        const remotePostIds = (data || []).map(p => p.id).filter(isUuid);
        const repliesByPost = new Map();
        if (remotePostIds.length > 0) {
          const { data: replyRows, error: replyError } = await supabase
            .from('network_replies')
            .select('*')
            .in('post_id', remotePostIds)
            .eq('is_flagged', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: true });
          if (!replyError) {
            for (const reply of replyRows || []) {
              const group = repliesByPost.get(reply.post_id) || [];
              group.push(mapReply(reply));
              repliesByPost.set(reply.post_id, group);
            }
          }
        }
        const remotePosts = (data || []).map(post => withSafeReplies({ ...post, replies: repliesByPost.get(post.id) || [] }));
        setPosts(remotePosts.length ? remotePosts : loadLocalPosts(selectedState));
      }
    } else {
      setPosts(loadLocalPosts(selectedState));
    }
    setLoadingPosts(false);
  }

  async function loadChat() {
    setChatError('');
    let msgs = [];
    if (supabaseConfigured) {
      const { data, error } = await supabase
        .from('state_chat_messages')
        .select('*')
        .eq('state_code', selectedState)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) {
        setChatError('Live chat could not be loaded. Showing local fallback content.');
        msgs = loadLocalChat(selectedState);
      } else {
        msgs = data || loadLocalChat(selectedState);
      }

      channelRef.current?.unsubscribe();
      channelRef.current = supabase
        .channel(`state-chat-${selectedState}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'state_chat_messages',
          filter: `state_code=eq.${selectedState}`,
        }, (payload) => {
          setMessages(prev => dedupeById([...prev, payload.new]));
        })
        .subscribe();
    } else {
      msgs = loadLocalChat(selectedState);
    }
    setMessages(msgs);
  }

  async function handleSubmitPost(e) {
    e.preventDefault();
    const cleanContent = sanitizeLongText(postContent, 500);
    if (!cleanContent || !isVerified) return;
    if (containsBlockedContent(cleanContent)) {
      setPostError('Your post mentions job board content which is not allowed in state networks. Please keep posts professional and relevant to media production.');
      return;
    }
    const { blocked, patternType } = checkMessage(cleanContent);
    if (containsContactInfo(cleanContent) || blocked) {
      logFilterEvent(user?.id || 'network-post', patternType || 'contact_info', supabase, supabaseConfigured);
      setPostError('Please do not include contact information such as email, phone, or social handles in posts.');
      return;
    }
    setPostError('');

    const newPost = {
      id: `post-${Date.now()}`,
      state_code: selectedState,
      user_id: user?.id,
      user_display_name: getUserDisplayName(user, profile),
      user_verification_status: getUserVerificationStatus(user, profile),
      user_primary_service: getUserPrimaryService(user, profile),
      post_type: postType,
      content: cleanContent,
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
        content: cleanContent,
        post_type: postType,
        user_display_name: newPost.user_display_name,
        user_verification_status: newPost.user_verification_status,
        user_primary_service: newPost.user_primary_service,
      }).select().single();
      if (error || !data) {
        setPostError('Network post could not be saved. Please try again.');
        return;
      }
      setPosts(prev => [withSafeReplies({ ...newPost, ...data, replies: [] }), ...prev]);
    } else {
      saveLocalPost(newPost);
      setPosts(prev => [withSafeReplies(newPost), ...prev]);
    }
    setPostContent('');
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const cleanMessage = sanitizeLongText(chatInput, 300);
    if (!cleanMessage || !isVerified) return;
    const { blocked, patternType } = checkMessage(cleanMessage);
    if (containsBlockedContent(cleanMessage) || containsContactInfo(cleanMessage) || blocked) {
      logFilterEvent(user?.id || 'network-chat', patternType || 'blocked_network_chat', supabase, supabaseConfigured);
      setChatError('Message contains disallowed content. Keep chat professional and avoid contact info or job board references.');
      return;
    }
    setChatError('');

    const encodedMsg = encodeChannelMessage(selectedChannel, cleanMessage);

    const msg = {
      id: `msg-${Date.now()}`,
      state_code: selectedState,
      user_id: user?.id,
      user_display_name: getUserDisplayName(user, profile),
      user_verification_status: getUserVerificationStatus(user, profile),
      user_primary_service: getUserPrimaryService(user, profile),
      message: encodedMsg,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (supabaseConfigured) {
      const { data, error } = await supabase.from('state_chat_messages').insert({
        state_code: selectedState,
        user_id: user.id,
        message: encodedMsg,
        user_display_name: msg.user_display_name,
        user_verification_status: msg.user_verification_status,
        user_primary_service: msg.user_primary_service,
      }).select().single();
      if (error || !data) {
        setChatError('Message could not be saved. Please try again.');
        return;
      }
      setMessages(prev => dedupeById([...prev, data]));
    } else {
      saveLocalMessage(selectedState, msg);
      setMessages(prev => dedupeById([...prev, msg]));
    }
    setChatInput('');
  }

  function handleLike(postId) {
    if (supabaseConfigured && user?.id && isUuid(postId)) {
      supabase
        .from('network_post_likes')
        .upsert({ post_id: postId, user_id: user.id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
        .then(() => {});
    }
  }

  async function handleReply(postId, cleanReply) {
    if (!isVerified || !user?.id) return null;
    const savedReply = {
      id: `reply-${Date.now()}`,
      post_id: postId,
      user_id: user.id,
      user_display_name: getUserDisplayName(user, profile),
      user_verification_status: getUserVerificationStatus(user, profile),
      user_primary_service: getUserPrimaryService(user, profile),
      content: cleanReply,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    let finalReply = savedReply;

    if (supabaseConfigured && isUuid(postId)) {
      const { data, error } = await supabase.from('network_replies').insert({
        post_id: postId,
        user_id: user.id,
        content: cleanReply,
        user_display_name: savedReply.user_display_name,
        user_verification_status: savedReply.user_verification_status,
        user_primary_service: savedReply.user_primary_service,
      }).select().single();
      if (error || !data) {
        setPostError('Network reply could not be saved. Please try again.');
        return null;
      }
      finalReply = mapReply(data);
    } else {
      saveLocalReply(selectedState, postId, finalReply);
    }

    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      const replies = dedupeById([...(post.replies || []), finalReply]);
      return { ...post, replies, reply_count: Math.max((post.reply_count || 0) + 1, replies.length) };
    }));
    return finalReply;
  }

  function handleReport(postId) {
    if (window.confirm('Report this post as inappropriate?')) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
  }

  const scrollToPostComposer = () => {
    postComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    postComposerRef.current?.focus();
  };

  const focusChatInput = () => {
    chatInputRef.current?.focus();
    chatInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterType === 'all') return true;
      return post.post_type === filterType;
    });
  }, [posts, filterType]);

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      const decoded = decodeChannelMessage(msg.message);
      return decoded.channel === selectedChannel;
    });
  }, [messages, selectedChannel]);

  const activeInStateStats = useMemo(() => {
    // Verified creators count is based on state stats or actual posts count
    const creatorsCount = activeStateObj?.creators || 12;
    // Posts this week: count posts in list
    const postsCount = posts.length || 0;
    return {
      creators: creatorsCount,
      postsWeek: Math.max(activeStateObj?.posts || 0, postsCount)
    };
  }, [activeStateObj, posts]);

  const recentUsers = useMemo(() => {
    const list = [];
    const seen = new Set();
    // Add creators from posts first
    posts.forEach(p => {
      if (!seen.has(p.user_display_name)) {
        seen.add(p.user_display_name);
        list.push({
          name: p.user_display_name,
          service: p.user_primary_service,
          initials: getInitials(p.user_display_name)
        });
      }
    });
    // Add default if list too short
    const fallbackUsers = [
      { name: 'Naomi Greene', service: 'Video Director', initials: 'NG' },
      { name: 'David Park', service: 'Cinematographer', initials: 'DP' },
      { name: 'Aria Vasquez', service: 'Editor', initials: 'AV' },
      { name: 'Sofia Pellizzari', service: 'Colorist', initials: 'SP' }
    ];
    fallbackUsers.forEach(u => {
      if (list.length < 4 && !seen.has(u.name)) {
        list.push(u);
      }
    });
    return list.slice(0, 4);
  }, [posts]);

  return (
    <div className="min-h-screen text-[var(--text)] relative z-10 pb-20">
      <div className="cb-home-wide mx-auto w-full px-5 sm:px-8 lg:px-14 2xl:px-16 pt-24">
        
        {/* ===== BREADCRUMB + PAGE HEADER ===== */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] mb-4">
            <a href="/" className="inline-flex min-h-[34px] items-center hover:text-[var(--text)] transition-colors">Home</a>
            <span className="opacity-40">/</span>
            <span className="text-[var(--text)] font-medium">Creator Network</span>
          </div>
          
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08]">
          <img src="/images/creatorbridge/backgrounds/03-featured-work/featured-warehouse-film-set.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5, filter: 'brightness(0.78) saturate(1.05)' }} loading="lazy" />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(13,13,15,0.92) 0%, rgba(13,13,15,0.78) 45%, rgba(13,13,15,0.5) 100%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,13,15,0.15) 0%, rgba(13,13,15,0.08) 55%, rgba(13,13,15,0.55) 100%)' }} />
          <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-end p-6 md:p-10">
            <div className="lg:col-span-7">
              <div className="eyebrow mb-2">State creator networks</div>
              <h1 className="text-4xl md:text-5xl font-display font-medium leading-[1.05] serif">
                A trusted local circuit. <span className="gold-text">Verified only.</span>
              </h1>
              <p className="text-sm text-[var(--text-secondary)] max-w-xl mt-4 leading-relaxed">
                Referrals, gear swaps, collab requests, and gig leads — organized by state so the conversation stays local. No DM scraping, no contact poaching, no general-marketplace noise.
              </p>
            </div>
            
            {/* Header statistics block */}
            <div className="lg:col-span-5 grid grid-cols-3 gap-3">
              <div className="liquid-glass rounded-xl p-3 text-center">
                <div className="text-2xl font-serif gold-text leading-none">{activeStateObj?.creators || '—'}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] mt-1">Creators</div>
              </div>
              <div className="liquid-glass rounded-xl p-3 text-center">
                <div className="text-2xl font-serif gold-text leading-none">{activeStateObj?.posts || '—'}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] mt-1">Posts today</div>
              </div>
              <div className="liquid-glass rounded-xl p-3 text-center">
                <div className="text-2xl font-serif gold-text leading-none">{activeStateObj?.active || '—'}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] mt-1">Active now</div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* ===== STATE PICKER GRID ===== */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] font-medium">Choose your state</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active networks pulse green
            </div>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {displayStates.map(st => (
              <button
                key={st.abbr}
                onClick={() => setSelectedState(st.abbr)}
                className={`state-tile ${st.hot ? 'hot' : ''} ${selectedState === st.abbr ? 'active' : ''}`}
              >
                <div className="abbr">{st.abbr}</div>
                <div className="name truncate">{st.name}</div>
                <div className="count truncate">{st.creators} verified</div>
              </button>
            ))}

            {/* "+ More States" elegant dropdown card */}
            <div className="state-tile relative flex flex-col justify-center items-center">
              <select
                value=""
                onChange={e => {
                  const code = e.target.value;
                  if (code) setSelectedState(code);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              >
                <option value="">+ Other State...</option>
                {US_STATES.filter(s => !displayStates.some(ds => ds.abbr === s.code)).map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <div className="abbr font-serif text-[18px] text-[var(--text-secondary)]">+ More</div>
              <div className="name text-[9px] text-[var(--text-dim)]">Select State</div>
            </div>
          </div>
        </div>

        {/* ===== ACTIVE STATE BANNER ===== */}
        <div className="liquid-glass rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
              <span className="serif text-3xl gold-text font-semibold">{activeStateObj?.abbr}</span>
              <span className="serif text-2xl text-white font-medium">{activeStateObj?.name} Network</span>
              <span className="tag-green">Verified creators only</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {activeStateObj?.creators} verified creators · join the local conversation and build trusted relationships.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={scrollToPostComposer}
              className="btn-ghost min-h-[34px] text-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14M5 12h14M5 19h14"/>
              </svg>
              Compose post
            </button>
            <button
              onClick={focusChatInput}
              className="btn-gold min-h-[34px] text-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Join chat
            </button>
          </div>
        </div>

        {/* ===== MAIN CONTAINER (FEED + SIDEBAR) ===== */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Feed Column */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Filter pills */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
              >
                All posts
              </button>
              <button
                onClick={() => setFilterType('portfolio')}
                className={`filter-pill ${filterType === 'portfolio' ? 'active' : ''}`}
              >
                Referrals
              </button>
              <button
                onClick={() => setFilterType('general')}
                className={`filter-pill ${filterType === 'general' ? 'active' : ''}`}
              >
                Gear swap
              </button>
              <button
                onClick={() => setFilterType('collab')}
                className={`filter-pill ${filterType === 'collab' ? 'active' : ''}`}
              >
                Collabs
              </button>
              <button
                onClick={() => setFilterType('looking_for_creator')}
                className={`filter-pill ${filterType === 'looking_for_creator' ? 'active' : ''}`}
              >
                Gig leads
              </button>
            </div>

            {/* Post composer */}
            <div className="liquid-glass rounded-2xl p-5">
              <div className="rounded-xl p-3 mb-4 text-xs bg-charcoal-950/75 text-charcoal-400 border border-white/[0.07] leading-relaxed">
                Keep all posts professional and relevant to media production. Mentioning job postings from the Project Board is not allowed here. Violations result in strikes against your account.
              </div>

              {isVerified ? (
                <form onSubmit={handleSubmitPost}>
                  <textarea
                    ref={postComposerRef}
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={`Share something with the ${activeStateObj.name} community...`}
                    className="w-full rounded-xl border p-3 text-sm outline-none focus:border-gold-500 resize-none bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 transition-colors"
                  />
                  <div className="flex items-center justify-between mt-1.5 mb-3">
                    <span className="text-xs text-[var(--text-dim)]">{postContent.length}/500</span>
                  </div>

                  {/* Post type pills for creator choice */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    {[
                      { id: 'general', label: 'Gear swap' },
                      { id: 'collab', label: 'Collab' },
                      { id: 'looking_for_creator', label: 'Gig lead' },
                      { id: 'portfolio', label: 'Referral' },
                      { id: 'industry_news', label: 'Industry News' }
                    ].map(pt => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setPostType(pt.id)}
                        className={`min-h-[34px] text-xs px-3 py-1.5 rounded-full font-semibold border transition-all cursor-pointer ${
                          postType === pt.id
                            ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                            : 'border-white/[0.09] text-charcoal-400 hover:border-charcoal-500 hover:text-white'
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
                    className="min-h-[34px] w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-900 text-sm font-bold transition-all cursor-pointer"
                  >
                    Post to {activeStateObj.name} Network
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-charcoal-950/75 border border-white/[0.07]">
                  <Lock size={18} className="text-[var(--text-dim)]" />
                  <div>
                    <p className="text-sm font-semibold text-white">Verify your account to post in state networks.</p>
                    <p className="text-xs mt-0.5 text-[var(--text-dim)]">Browsing is open to everyone.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Posts Feed */}
            {loadingPosts ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-10 text-center">
                <p className="text-sm text-[var(--text-dim)]">No posts found in this lane for {activeStateObj.name}. Be the first to share something.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    dark={dark}
                    isVerified={isVerified}
                    onLike={handleLike}
                    onReport={handleReport}
                    onReply={handleReply}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Chat Column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Live Chat Panel */}
            {/* Sticky on desktop only — sticky inside the stacked mobile flow
                made this panel slide over the sections below while scrolling. */}
            <div className="liquid-glass rounded-2xl overflow-hidden flex flex-col cb-chat-sticky">
              
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="eyebrow mb-0.5">Live chat</div>
                  <div className="text-sm font-medium text-white">{activeStateObj.name}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{activeStateObj?.active || '1'} online</span>
                </div>
              </div>

              {/* Channels Selector Tab Block */}
              <div className="flex gap-1 px-4 py-3 border-b border-[var(--border)] flex-wrap bg-charcoal-950/20">
                <button
                  onClick={() => setSelectedChannel('general')}
                  className={`chat-channel min-h-[34px] cursor-pointer ${selectedChannel === 'general' ? 'active' : ''}`}
                >
                  <span className="hash mr-0.5 font-serif font-medium text-[13px]">#</span>general
                </button>
                <button
                  onClick={() => setSelectedChannel('referrals')}
                  className={`chat-channel min-h-[34px] cursor-pointer ${selectedChannel === 'referrals' ? 'active' : ''}`}
                >
                  <span className="hash mr-0.5 font-serif font-medium text-[13px]">#</span>referrals
                </button>
                <button
                  onClick={() => setSelectedChannel('gear')}
                  className={`chat-channel min-h-[34px] cursor-pointer ${selectedChannel === 'gear' ? 'active' : ''}`}
                >
                  <span className="hash mr-0.5 font-serif font-medium text-[13px]">#</span>gear-swap
                </button>
                <button
                  onClick={() => setSelectedChannel('leads')}
                  className={`chat-channel min-h-[34px] cursor-pointer ${selectedChannel === 'leads' ? 'active' : ''}`}
                >
                  <span className="hash mr-0.5 font-serif font-medium text-[13px]">#</span>gig-leads
                </button>
              </div>

              {/* Chat Message Stream */}
              <div className="px-3 py-3 space-y-1.5 max-h-[420px] min-h-[300px] overflow-y-auto bg-charcoal-950/10">
                {filteredMessages.length === 0 ? (
                  <p className="text-xs text-center py-10 text-[var(--text-dim)]">No messages in #{selectedChannel} yet. Start the conversation.</p>
                ) : (
                  filteredMessages.map(msg => {
                    const decoded = decodeChannelMessage(msg.message);
                    return (
                      <div key={msg.id} className="chat-msg">
                        <div className="w-7 h-7 rounded-full bg-gold-500/15 text-gold-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/[0.05]">
                          {getInitials(msg.user_display_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-semibold text-charcoal-200 truncate">
                              {msg.user_display_name}
                            </span>
                            <VerificationDot status={msg.user_verification_status} />
                            <span className="text-[9px] text-[var(--text-dim)] ml-auto shrink-0">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-[12px] text-charcoal-300 mt-0.5 leading-relaxed break-words">
                            {decoded.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Field */}
              <div className="border-t border-[var(--border)] p-3 bg-charcoal-950/40">
                {chatError && <p className="text-xs text-red-400 mb-2">{chatError}</p>}
                {isVerified ? (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      maxLength={300}
                      placeholder={`Message #${selectedChannel}…`}
                      className="flex-1 text-xs rounded-xl px-3 py-2 border outline-none focus:border-gold-500 bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 transition-colors"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}}
                    />
                    <button type="submit" className="min-h-[34px] min-w-[34px] p-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 transition-all cursor-pointer">
                      <Send size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-charcoal-950/75 text-charcoal-600">
                    <Lock size={12} /> Verify your account to join the chat
                  </div>
                )}
              </div>
            </div>

            {/* Network Rules Card */}
            <div className="liquid-glass rounded-2xl p-5">
              <div className="eyebrow mb-3">Network rules</div>
              <ul className="space-y-3 text-xs text-[var(--text-secondary)]">
                <li className="flex gap-2 items-start">
                  <svg className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Verified accounts only · no off-platform contact sharing.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <svg className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Job leads route through the Project Board, not DMs.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <svg className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Client invites create credits only after completed projects.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <svg className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Be local. State conversations stay state-specific.</span>
                </li>
              </ul>
            </div>

            {/* Sidebar Stats and Recently Active Panel */}
            <div className="liquid-glass rounded-2xl p-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                Active in {activeStateObj.name}
              </p>
              
              <div className="space-y-2 border-b border-white/[0.05] pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Verified creators</span>
                  <span className="text-xs font-bold text-white">
                    {activeInStateStats.creators}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Posts this week</span>
                  <span className="text-xs font-bold text-white">
                    {activeInStateStats.postsWeek}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-3">Recently Active</p>
                <div className="space-y-3">
                  {recentUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/[0.05]">
                        {u.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-charcoal-200 truncate">{u.name}</p>
                        <p className="text-[9px] text-[var(--text-dim)] truncate">{u.service || 'Media Professional'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
