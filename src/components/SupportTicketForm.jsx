import { useState } from 'react';
import { CheckCircle, Ticket, X } from 'lucide-react';
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

export function SupportTicketForm({ dark, onClose }) {
  const { user, profile } = useAuth();

  const [form, setForm] = useState({ category: 'technical', subject: '', description: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [ticketRef, setTicketRef] = useState(null);

  const inputBase = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-gold-500/40 ${
    dark
      ? 'bg-charcoal-900/60 border-white/[0.1] text-white placeholder-charcoal-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

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

    const { data, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id:     user.id,
        user_type:   userType,
        category:    form.category,
        subject:     cleanSubject,
        description: cleanDescription,
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

    // Best-effort email — does not block or show error if it fails
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
              Submit a Support Ticket
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
              Ticket Submitted
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
                {loading ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
