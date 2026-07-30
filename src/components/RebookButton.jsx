import { useEffect, useState } from 'react';
import { AlertCircle, CalendarPlus, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

function isoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function RebookButton({ project, creatorName = 'this creator', className = '', onCreated }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', timeline: '', location: '', budget: '' });

  useEffect(() => {
    setForm({
      title: project?.title || '',
      description: project?.description || '',
      timeline: '',
      location: typeof project?.location === 'string' ? project.location : '',
      budget: String(project?.acceptedProposalRate || project?.budgetMax || project?.budget_max || project?.budgetMin || project?.budget_min || ''),
    });
  }, [project]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !submitting) setOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, submitting]);

  async function sendRebooking() {
    if (!project?.id || !form.title.trim() || !form.description.trim() || !form.timeline || Number(form.budget) <= 0) return;
    setSubmitting(true);
    setError('');
    try {
      if (!supabaseConfigured) throw new Error('Rebooking needs a connected CreatorBridge account.');
      const { data: draft, error: draftError } = await supabase.rpc('rebook_project', { p_prior_project_id: project.id });
      if (draftError || !draft?.id) throw draftError || new Error('Rebooking draft could not be created');

      if (draft.status !== 'rebook_draft') {
        onCreated?.(draft);
        setOpen(false);
        navigate('/projects');
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from('projects')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          timeline: form.timeline,
          location: form.location.trim() || null,
          budget_min: Number(form.budget),
          budget_max: Number(form.budget),
        })
        .eq('id', draft.id)
        .eq('status', 'rebook_draft')
        .select('*')
        .maybeSingle();
      if (updateError || !updated) throw updateError || new Error('Rebooking details could not be saved');

      const { data: sent, error: submitError } = await supabase.rpc('submit_rebook_project', { p_project_id: draft.id });
      if (submitError) throw submitError;
      onCreated?.(sent);
      setOpen(false);
      navigate('/projects');
    } catch (submitError) {
      setError(submitError?.message || 'Rebooking could not be sent.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={event => { event.stopPropagation(); setOpen(true); }} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#9c4a33] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#b85a3e] ${className}`}>
        <CalendarPlus size={14} /> Rebook
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" onClick={event => event.stopPropagation()}>
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close rebooking" onClick={() => !submitting && setOpen(false)} />
          <div className="relative max-h-[100dvh] w-full overflow-y-auto border border-[#c9a15e]/30 bg-[#151009] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.7)] sm:max-w-xl sm:rounded-lg sm:p-8">
            <button type="button" onClick={() => setOpen(false)} disabled={submitting} title="Close" aria-label="Close rebooking" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center text-[#8a806e] hover:text-[#f3eadb]"><X size={18} /></button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c9a15e]">Repeat booking</p>
            <h2 className="mt-3 pr-10 font-display text-3xl font-semibold text-[#f3eadb]">Rebook {creatorName}</h2>
            <p className="mt-2 text-sm leading-6 text-[#b3a892]">Prior scope and package are reused. Add the new timing and review the details before sending. A fresh agreement and both signatures are still required.</p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3a892]">Project title</span>
                <input value={form.title} maxLength={120} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="h-12 w-full rounded-md border border-[#c9a15e]/35 bg-[#0d0906] px-3 text-sm text-[#f3eadb] outline-none focus:border-[#c9a15e]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3a892]">Updated scope</span>
                <textarea value={form.description} maxLength={4000} rows={4} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-md border border-[#c9a15e]/35 bg-[#0d0906] px-3 py-3 text-sm leading-6 text-[#f3eadb] outline-none focus:border-[#c9a15e]" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3a892]">New project date</span>
                  <input type="date" min={isoDate(new Date())} value={form.timeline} onChange={event => setForm(current => ({ ...current, timeline: event.target.value }))} className="h-12 w-full rounded-md border border-[#c9a15e]/35 bg-[#0d0906] px-3 text-sm text-[#f3eadb] outline-none focus:border-[#c9a15e]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3a892]">Project total</span>
                  <input type="number" min="250" step="1" value={form.budget} onChange={event => setForm(current => ({ ...current, budget: event.target.value }))} className="h-12 w-full rounded-md border border-[#c9a15e]/35 bg-[#0d0906] px-3 text-sm text-[#f3eadb] outline-none focus:border-[#c9a15e]" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3a892]">Location</span>
                <input value={form.location} maxLength={160} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} className="h-12 w-full rounded-md border border-[#c9a15e]/35 bg-[#0d0906] px-3 text-sm text-[#f3eadb] outline-none focus:border-[#c9a15e]" />
              </label>
            </div>

            {error && <p className="mt-5 flex items-start gap-2 rounded-md border border-[#9b2c30]/45 bg-[#5a1012]/35 p-3 text-xs leading-5 text-[#e4b8b8]"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={submitting} className="btn-ghost min-h-11 px-5 text-xs">Cancel</button>
              <button type="button" onClick={sendRebooking} disabled={submitting || !form.title.trim() || !form.description.trim() || !form.timeline || Number(form.budget) < 250} className="btn-gold flex min-h-11 items-center justify-center gap-2 px-5 text-xs disabled:opacity-35">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} Send rebooking
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
