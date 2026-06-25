import { useState } from 'react';
import { MessageSquareHeart } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

export function CollaborationSurvey({ collaboration, userId, onSubmitted }) {
  const [answers, setAnswers] = useState({
    easier_than_doing_it_yourself: 'yes',
    floor_changed_scope: 'no',
    file_access_worked: 'yes',
    note: '',
  });
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  if (!['approved', 'completed'].includes(collaboration?.status)) return null;

  function setField(key, value) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    setStatus('');
    const { error } = await supabase.from('collaboration_surveys').insert({
      collaboration_id: collaboration.id,
      respondent_id: userId,
      ...answers,
    });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus('Survey recorded. This helps tune collaboration pricing and workflow without reading private messages.');
    onSubmitted?.();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
      <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400">Three-question survey</p>
      <h4 className="mt-1 font-display text-lg font-bold">Help tune creator collaboration</h4>
      <p className="mt-2 text-xs leading-5 text-charcoal-300">These answers become platform-wide analytics only. They do not include DM contents or creative files.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-charcoal-300">Was this easier than doing it yourself?
          <select value={answers.easier_than_doing_it_yourself} onChange={(event) => setField('easier_than_doing_it_yourself', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm">
            <option value="yes">Yes</option>
            <option value="somewhat">Somewhat</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="text-xs text-charcoal-300">Did the $250 floor change scope?
          <select value={answers.floor_changed_scope} onChange={(event) => setField('floor_changed_scope', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm">
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="not_sure">Not sure</option>
          </select>
        </label>
        <label className="text-xs text-charcoal-300">Did file access work?
          <select value={answers.file_access_worked} onChange={(event) => setField('file_access_worked', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm">
            <option value="yes">Yes</option>
            <option value="minor_issue">Minor issue</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
      <textarea value={answers.note} onChange={(event) => setField('note', event.target.value)} placeholder="Optional short note" className="mt-3 min-h-[90px] w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500" />
      <button type="button" onClick={submit} disabled={saving} className="btn-gold mt-3 text-xs">
        <MessageSquareHeart size={14} /> {saving ? 'Saving…' : 'Submit survey'}
      </button>
      {status && <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-charcoal-200">{status}</p>}
    </section>
  );
}
