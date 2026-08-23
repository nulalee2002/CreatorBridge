import { useMemo, useRef, useState } from 'react';
import * as tus from 'tus-js-client';
import { Link2, Pause, Play, Plus, Send, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { DELIVERY_DIRECT_LIMIT_BYTES } from '../../config/projectCompletion.js';
import { directDeliveryBytes, normalizeDeliveryUrl, validateDirectDelivery } from '../../utils/projectDelivery.js';

function formatBytes(bytes) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(0, bytes / 1_000).toFixed(0)} KB`;
}

export function DeliveryComposer({ completion, projectId, dark }) {
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([{ id: crypto.randomUUID(), label: '', url: '' }]);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [deliveryDraftId, setDeliveryDraftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const uploads = useRef(new Map());
  const totalBytes = useMemo(() => directDeliveryBytes(files.map(entry => entry.file)), [files]);
  const card = dark ? 'border-white/[0.08] bg-charcoal-900/55 text-white' : 'border-gray-200 bg-white text-gray-900';

  function addFiles(event) {
    const incoming = [...event.target.files];
    const result = validateDirectDelivery([...files.map(entry => entry.file), ...incoming]);
    if (!result.ok) {
      setError(result.code === 'DIRECT_SIZE_LIMIT' ? 'Direct uploads have a combined 5 GB limit.' : result.message);
      return;
    }
    setError('');
    setFiles(current => [...current, ...incoming.map(file => ({ id: crypto.randomUUID(), file, progress: 0, status: 'ready' }))]);
    event.target.value = '';
  }

  function updateFile(id, patch) {
    setFiles(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  }

  async function uploadFile(entry, currentDraftId) {
    updateFile(entry.id, { status: 'reserving' });
    const reservation = await completion.createUploadReservation(entry.file, currentDraftId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session expired. Sign in again before uploading.');
    setDeliveryDraftId(reservation.deliveryDraftId);

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(entry.file, {
        endpoint: reservation.tusEndpoint,
        retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { authorization: `Bearer ${session.access_token}` },
        metadata: {
          bucketName: reservation.bucket,
          objectName: reservation.objectPath,
          contentType: entry.file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError: (cause) => {
          updateFile(entry.id, { status: 'failed', error: cause.message });
          reject(cause);
        },
        onProgress: (uploaded, total) => updateFile(entry.id, {
          status: 'uploading',
          progress: total ? Math.round(uploaded / total * 100) : 0,
        }),
        onSuccess: () => {
          updateFile(entry.id, { status: 'uploaded', progress: 100, reservation });
          resolve(reservation.deliveryDraftId);
        },
      });
      uploads.current.set(entry.id, upload);
      upload.findPreviousUploads().then(previous => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(reject);
    });
  }

  async function submit() {
    const externalItems = links
      .map(link => ({ label: link.label.trim(), url: normalizeDeliveryUrl(link.url) }))
      .filter(link => link.label || link.url);
    if (externalItems.some(link => !link.label || !link.url)) return setError('Every shared link needs a label and a secure HTTPS URL.');
    if (!files.length && !externalItems.length) return setError('Add at least one finished deliverable or shared folder link.');
    if (!confirmed) return setError('Confirm that you kept your own copy before formal submission.');

    setSubmitting(true);
    setError('');
    try {
      let activeDraftId = deliveryDraftId;
      for (const entry of files) {
        if (entry.status === 'uploaded') {
          activeDraftId ||= entry.reservation?.deliveryDraftId;
          continue;
        }
        activeDraftId = await uploadFile(entry, activeDraftId);
      }
      await completion.finalizeDelivery({
        deliveryDraftId: activeDraftId,
        note,
        externalItems,
        idempotencyKey: crypto.randomUUID(),
      });
      setFiles([]);
      setLinks([{ id: crypto.randomUUID(), label: '', url: '' }]);
      setNote('');
      setConfirmed(false);
      setDeliveryDraftId(null);
    } catch (cause) {
      setError(cause?.message || 'Delivery could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`rounded-2xl border p-4 ${card}`} data-project-id={projectId}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400">Formal final delivery</p>
      <h3 className="mt-1 font-display text-lg font-bold">Submit finished deliverables</h3>
      <p className="mt-1 text-xs leading-5 text-charcoal-300">Upload final photos, videos, audio, PDFs, or ZIP files, and add Google Drive or Dropbox links in the same submission. Raw working files stay with the creator.</p>

      <div className="mt-4 rounded-xl border border-dashed border-gold-500/30 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span>{formatBytes(totalBytes)} of 5 GB direct storage</span>
          <span className="text-charcoal-400">External links do not count</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold-500" style={{ width: `${Math.min(100, totalBytes / DELIVERY_DIRECT_LIMIT_BYTES * 100)}%` }} /></div>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gold-500 px-3 py-2 text-xs font-bold text-charcoal-950">
          <Upload size={14} /> Add finished files
          <input className="hidden" type="file" multiple onChange={addFiles} />
        </label>
      </div>

      {files.map(entry => (
        <div key={entry.id} className="mt-2 rounded-lg border border-white/10 p-2 text-xs">
          <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{entry.file.name}</span><span>{entry.progress}%</span>
            {entry.status === 'uploading' && <button type="button" aria-label="Pause upload" onClick={() => { uploads.current.get(entry.id)?.abort(false); updateFile(entry.id, { status: 'paused' }); }}><Pause size={13} /></button>}
            {entry.status === 'paused' && <button type="button" aria-label="Resume upload" onClick={() => { uploads.current.get(entry.id)?.start(); updateFile(entry.id, { status: 'uploading' }); }}><Play size={13} /></button>}
            {!['uploading', 'uploaded'].includes(entry.status) && <button type="button" aria-label="Remove file" onClick={() => setFiles(current => current.filter(file => file.id !== entry.id))}><Trash2 size={13} /></button>}
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold-500" style={{ width: `${entry.progress}%` }} /></div>
          {entry.error && <p className="mt-1 text-red-300">{entry.error}</p>}
        </div>
      ))}

      <div className="mt-4 space-y-2">
        {links.map(link => <div key={link.id} className="grid gap-2 sm:grid-cols-[0.8fr_1.5fr_auto]">
          <input value={link.label} onChange={e => setLinks(current => current.map(item => item.id === link.id ? { ...item, label: e.target.value } : item))} placeholder="Folder label" className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs" />
          <input value={link.url} onChange={e => setLinks(current => current.map(item => item.id === link.id ? { ...item, url: e.target.value } : item))} placeholder="https://drive.google.com or Dropbox link" className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs" />
          <button type="button" aria-label="Remove external link" onClick={() => setLinks(current => current.filter(item => item.id !== link.id))}><Trash2 size={14} /></button>
        </div>)}
        <button type="button" onClick={() => setLinks(current => [...current, { id: crypto.randomUUID(), label: '', url: '' }])} className="flex items-center gap-1 text-xs font-semibold text-gold-400"><Plus size={13} /> Add external link</button>
      </div>

      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={5000} rows={3} placeholder="Delivery notes for the client" className="mt-4 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs" />
      <label className="mt-3 flex items-start gap-2 text-xs text-charcoal-300"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-gold-500" /> I kept my own copy. CreatorBridge-hosted files are retained for seven days after approval unless a revision or dispute requires a hold.</label>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      <button type="button" disabled={submitting} onClick={submit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-sm font-bold text-charcoal-950 disabled:opacity-50"><Send size={14} /> {submitting ? 'Uploading and submitting…' : 'Submit final delivery'}</button>
    </section>
  );
}
