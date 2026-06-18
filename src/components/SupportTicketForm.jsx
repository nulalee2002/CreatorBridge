import { useState } from 'react';
import { CheckCircle, Ticket, X, Paperclip } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { sendNotificationEmail } from '../lib/notifications.js';
import { sanitizeLongText, sanitizePlainText } from '../utils/inputSecurity.js';

const CATEGORIES = [
  { value: 'technical',        label: 'Technical Problem' },
  { value: 'payment',          label: 'Payment Issue' },
  { value: 'account',          label: 'Account & Profile' },
  { value: 'violation_report', label: 'Report a Violation' },
  { value: 'other',            label: 'Other' },
];

// Where new-report alerts are emailed. Backend cleanup reads its own copy from
// support_report_config; this is the front-end notify target.
const ADMIN_SUPPORT_EMAIL = 'drl33@creatorbridge.studio';
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // pre-compression guard

// Downscale + re-encode a screenshot to a small JPEG so storage stays cheap.
function compressImage(file, maxEdge = 1600, quality = 0.7) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          let { width, height } = img;
          if (width > maxEdge || height > maxEdge) {
            if (width >= height) { height = Math.round((height * maxEdge) / width); width = maxEdge; }
            else { width = Math.round((width * maxEdge) / height); height = maxEdge; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } catch {
      resolve(null);
    }
  });
}

export function SupportTicketForm({ dark, onClose }) {
  const { user, profile } = useAuth();

  const [form, setForm] = useState({ category: 'technical', subject: '', description: '' });
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [ticketRef, setTicketRef] = useState(null);

  const inputBase = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-gold-500/40 ${
    dark
      ? 'bg-charcoal-900/60 border-white/[0.1] text-white placeholder-charcoal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  function onPickScreenshot(e) {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_SCREENSHOT_BYTES) {
      setError('That image is too large. Please attach one under 8MB.');
      e.target.value = '';
      return;
    }
    setError('');
    setScreenshotFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.subject.trim())      { setError('Please enter a subject.'); return; }
    if (!form.description.trim())  { setError('Please describe your issue.'); return; }
    if (!user)                     { setError('You must be signed in to submit a ticket.'); return; }

    setLoading(true);

    const userType = profile?.role === 'creator' ? 'creator' : 'client';
    const cleanSubject = sanitizePlainText(form.subject, 120);
    const cleanDescription = sanitizeLongText(form.description, 3000);
    const categoryLabel = (CATEGORIES.find(c => c.value === form.category) || {}).label || form.category;

    // Auto-captured context so a one-line report is still actionable.
    const pagePath = `${window.location.pathname || ''}${window.location.hash || ''}`.slice(0, 300);
    const userAgent = (navigator.userAgent || '').slice(0, 500);
    const viewport = `${window.innerWidth}x${window.innerHeight}`;

    // Optional screenshot — compressed, uploaded to a private bucket. Best-effort:
    // a failed upload never blocks the report.
    let screenshotPath = null;
    if (screenshotFile) {
      try {
        const blob = await compressImage(screenshotFile, 1600, 0.7);
        if (blob) {
          const path = `${user.id}/${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase
            .storage
            .from('support-screenshots')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (!upErr) screenshotPath = path;
        }
      } catch {
        // ignore — submit the report without the screenshot
      }
    }

    const { data, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id:        user.id,
        user_type:      userType,
        category:       form.category,
        subject:        cleanSubject,
        description:    cleanDescription,
        page_path:      pagePath,
        user_agent:     userAgent,
        viewport:       viewport,
        screenshot_path: screenshotPath,
      })
      .select('id')
      .single();

    if (insertErr) {
      setError(insertErr.message || 'Could not submit your ticket. Please try again.');
      setLoading(false);
      return;
    }

    const ref = data.id.slice(0, 8).toUpperCase();
    setTicketRef(ref);

    // 7-day signed link for the screenshot, for the admin alert email.
    let screenshotUrl = null;
    if (screenshotPath) {
      try {
        const { data: signed } = await supabase
          .storage
          .from('support-screenshots')
          .createSignedUrl(screenshotPath, 604800);
        screenshotUrl = signed?.signedUrl || null;
      } catch {
        // ignore — admin can still open the screenshot from the dashboard
      }
    }

    // Admin alert to the support inbox — best-effort, does not block.
    sendNotificationEmail(ADMIN_SUPPORT_EMAIL, 'support_ticket_admin_alert', {
      ticket_reference: ref,
      category:         form.category,
      category_label:   categoryLabel,
      subject:          cleanSubject,
      description:      cleanDescription,
      submitter_name:   profile?.full_name || user.email,
      submitter_email:  user.email,
      user_type:        userType,
      page_path:        pagePath,
      viewport:         viewport,
      screenshot_url:   screenshotUrl,
    });

    // User confirmation — unchanged.
    sendNotificationEmail(user.email, 'support_ticket_opened', {
      user_name:        profile?.full_name || user.email,
      ticket_reference: ref,
    });

    setLoading(false);
  }

  const overlayBg = dark ? 'bg-charcoal-950/80' : 'bg-gray-900/50';
  const cardBg    = dark
    ? 'bg-charcoal-900 border-white/[0.08]'
    : 'bg-white border-gray-200';
  const divider   = dark ? 'border-white/[0.07]' : 'border-gray-100';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg} backdrop-blur-sm`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl ${cardBg}`}>

        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${divider}`}>
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-gold-400" />
            <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              Report an Issue
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-lg p-1.5 transition-colors ${
              dark ? 'text-charcoal-400 hover:bg-white/[0.07] hover:text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {ticketRef ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <CheckCircle size={40} className="text-gold-400" />
            <h3 className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              Report Submitted
            </h3>
            <p className={`max-w-xs text-sm leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
              Your reference number is{' '}
              <span className="font-mono font-bold text-gold-400">#{ticketRef}</span>.
              Our team will respond to your account email within 24 hours.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-gold-500 px-6 py-2 text-sm font-bold text-charcoal-950 transition-colors hover:bg-gold-600"
            >
              Close
            </button>
          </div>

        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">

            {/* Category */}
            <div>
              <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                Category
              </label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={inputBase}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                Subject
              </label>
              <input
                type="text"
                placeholder="Brief summary of your issue"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                maxLength={120}
                className={inputBase}
              />
            </div>

            {/* Description */}
            <div>
              <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                Description
              </label>
              <textarea
                placeholder="Describe the issue in as much detail as possible — include any error messages or steps to reproduce"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={5}
                className={`${inputBase} resize-none`}
              />
            </div>

            {/* Screenshot (optional) */}
            <div>
              <label className={`mb-1.5 block text-xs font-bold ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                Screenshot <span className="font-normal opacity-70">(optional)</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm transition-colors ${
                  dark
                    ? 'border-white/[0.15] text-charcoal-300 hover:border-gold-500/50 hover:text-white'
                    : 'border-gray-300 text-gray-500 hover:border-gold-500/60 hover:text-gray-800'
                }`}
              >
                <Paperclip size={16} className="text-gold-400" />
                <span className="truncate">
                  {screenshotFile ? screenshotFile.name : 'Attach a screenshot of the problem'}
                </span>
                <input type="file" accept="image/*" onChange={onPickScreenshot} className="hidden" />
              </label>
              {screenshotFile && (
                <button
                  type="button"
                  onClick={() => setScreenshotFile(null)}
                  className="mt-1 text-[11px] font-medium text-gold-400 hover:underline"
                >
                  Remove screenshot
                </button>
              )}
            </div>

            {error && (
              <p className="text-xs font-medium text-red-400">{error}</p>
            )}

            <div className={`flex items-center justify-end gap-3 border-t pt-4 ${divider}`}>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  dark ? 'text-charcoal-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-gold-500 px-5 py-2 text-xs font-bold text-charcoal-950 transition-colors hover:bg-gold-600 disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
