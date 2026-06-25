import { useState } from 'react';
import { FileCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

function parseCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseSizes(value) {
  return parseCsv(value).map((item) => Number.parseInt(item, 10)).filter((item) => Number.isFinite(item) && item >= 0);
}

function parseChecksums(value) {
  return parseCsv(value).reduce((acc, item) => {
    const [name, checksum] = item.split(':').map((part) => part?.trim()).filter(Boolean);
    if (name && checksum) acc[name] = checksum;
    return acc;
  }, {});
}

export function DeliveryAnchorForm({ collaboration, onSubmitted }) {
  const [note, setNote] = useState('');
  const [files, setFiles] = useState('');
  const [sizes, setSizes] = useState('');
  const [checksums, setChecksums] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = ['in_progress', 'revision'].includes(collaboration?.status);

  async function submit() {
    setError('');
    const filenames = parseCsv(files);
    if (filenames.length === 0 && !preview.trim()) {
      setError('Add filenames or a private preview reference so there is proof of delivery.');
      return;
    }
    setSaving(true);
    const { error: submitError } = await supabase.rpc('submit_collaboration_delivery', {
      p_collaboration_id: collaboration.id,
      p_note: note,
      p_filenames: filenames,
      p_sizes_bytes: parseSizes(sizes),
      p_checksums: parseChecksums(checksums),
      p_preview_reference: preview.trim() || null,
    });
    setSaving(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setNote('');
    setFiles('');
    setSizes('');
    setChecksums('');
    setPreview('');
    onSubmitted?.();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-charcoal-950/70 p-5 text-white">
      <p className="text-[10px] uppercase tracking-[0.24em] text-gold-400">Proof of delivery</p>
      <h3 className="mt-1 font-display text-xl font-bold">Submit delivery evidence</h3>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-charcoal-300">
        Record a timestamped manifest for the final handoff. Large working files stay in your approved workspace; this creates the anchor CreatorBridge can rely on if there is a revision or dispute.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <input
          value={files}
          onChange={(event) => setFiles(event.target.value)}
          disabled={!canSubmit}
          placeholder="Filenames, separated by commas"
          className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500"
        />
        <input
          value={sizes}
          onChange={(event) => setSizes(event.target.value)}
          disabled={!canSubmit}
          placeholder="Sizes in bytes, separated by commas"
          className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500"
        />
        <input
          value={checksums}
          onChange={(event) => setChecksums(event.target.value)}
          disabled={!canSubmit}
          placeholder="Checksums, example file.mov:sha256..."
          className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500 md:col-span-2"
        />
        <input
          value={preview}
          onChange={(event) => setPreview(event.target.value)}
          disabled={!canSubmit}
          placeholder="Optional Bunny/private preview reference"
          className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500 md:col-span-2"
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!canSubmit}
          placeholder="Delivery note"
          className="min-h-[110px] rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500 md:col-span-2"
        />
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex max-w-2xl gap-2 text-[11px] leading-5 text-charcoal-300">
          <ShieldCheck size={14} className="mt-0.5 text-gold-300" /> The delivery anchor stores metadata only. It does not copy your creative files or inspect your external workspace.
        </p>
        <button type="button" onClick={submit} disabled={!canSubmit || saving} className="btn-gold">
          <FileCheck size={15} /> {saving ? 'Submitting…' : 'Submit delivery evidence'}
        </button>
      </div>
    </section>
  );
}
