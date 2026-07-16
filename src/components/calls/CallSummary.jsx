import { useEffect, useState } from 'react';
import { Check, Download, FileText, History, Loader2, PencilLine } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { CALL_RETENTION_TEXT } from '../../lib/callLegal.js';

async function functionError(error, fallback) {
  try {
    const payload = await error?.context?.clone?.().json();
    return payload?.error || fallback;
  } catch {
    return error?.message || fallback;
  }
}

function statusChip(status) {
  if (status === 'agreed') return { label: 'Agreed by both parties', className: 'bg-forest-500/20 text-forest-100 ring-forest-300/30' };
  if (status === 'edited') return { label: 'Edited, pending agreement', className: 'bg-gold-500/15 text-gold-300 ring-gold-500/25' };
  return { label: 'Draft pending review', className: 'bg-white/[0.06] text-charcoal-200 ring-white/[0.12]' };
}

// Shared, versioned call summary. Both parties can edit; every edit is
// snapshotted and attributed; the creator is the accountable owner of its
// accuracy. The agree action stamps the version both sides accept.
export function CallSummary({ call, user }) {
  const [summary, setSummary] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [editorNames, setEditorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState('');
  const [error, setError] = useState('');

  const isCreator = user?.id === call.creator_id;
  const role = isCreator ? 'creator' : 'client';

  async function load() {
    const { data: summaryRow } = await supabase
      .from('call_summaries')
      .select('*')
      .eq('call_id', call.id)
      .maybeSingle();
    setSummary(summaryRow || null);
    if (summaryRow) {
      const { data: revisionRows } = await supabase
        .from('call_summary_revisions')
        .select('id, editor_user_id, body_snapshot, created_at')
        .eq('summary_id', summaryRow.id)
        .order('created_at', { ascending: false });
      setRevisions(revisionRows || []);
      const editorIds = [...new Set((revisionRows || []).map(row => row.editor_user_id).filter(Boolean))];
      if (editorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', editorIds);
        setEditorNames(Object.fromEntries((profiles || []).map(profile => [profile.id, profile.full_name || 'Project party'])));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  async function saveEdit() {
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('update_call_summary', {
        p_summary_id: summary.id,
        p_body: draftBody,
      });
      if (rpcError) throw rpcError;
      setEditing(false);
      await load();
    } catch (err) {
      setError(err?.message || 'The summary could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function agree() {
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('agree_call_summary', { p_summary_id: summary.id });
      if (rpcError) throw rpcError;
      await load();
    } catch (err) {
      setError(err?.message || 'Your agreement could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  async function download(ref, label) {
    setDownloadBusy(label);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('create-storage-signed-url', {
      body: { ref, expiresIn: 600 },
    });
    setDownloadBusy('');
    if (fnError || !data?.signedUrl) {
      setError(await functionError(fnError, 'The download link could not be created.'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (loading) return <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />;

  if (!summary) {
    if (call.status !== 'completed') return null;
    return (
      <div className="rounded-xl border border-white/[0.07] bg-charcoal-900/60 p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-white"><FileText size={13} className="text-gold-400" /> Call summary</p>
        <p className="mt-1 text-[11px] leading-5 text-charcoal-300">
          The recording is processing. The draft summary appears here shortly after the call ends.
        </p>
      </div>
    );
  }

  const chip = statusChip(summary.status);
  const alreadyAgreed = isCreator ? summary.agreed_by_creator : summary.agreed_by_client;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-charcoal-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-white">
          <FileText size={13} className="text-gold-400" /> Call summary
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${chip.className}`}>{chip.label}</span>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-charcoal-400">
        Shared record, editable by both parties. The creator is responsible for keeping it accurate.
      </p>

      {editing ? (
        <>
          <textarea
            value={draftBody}
            onChange={event => setDraftBody(event.target.value)}
            rows={10}
            className="mt-3 w-full rounded-lg border border-white/[0.09] bg-charcoal-950 px-3 py-2 text-xs leading-5 text-white focus:border-gold-500/50 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="button" onClick={saveEdit} disabled={busy} className="btn-gold flex-1">
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Save edit'}
            </button>
          </div>
        </>
      ) : (
        <>
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-charcoal-950/70 p-3 font-sans text-xs leading-6 text-charcoal-100">
            {summary.body}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setDraftBody(summary.body); setEditing(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-200 transition hover:border-gold-500/35 hover:text-white"
            >
              <PencilLine size={12} /> Edit
            </button>
            {!alreadyAgreed && (
              <button
                type="button"
                onClick={agree}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-forest-300/30 bg-forest-500/15 px-3 py-1.5 text-[11px] font-bold text-forest-100 transition hover:bg-forest-500/25 disabled:opacity-45"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} This is accurate
              </button>
            )}
            {alreadyAgreed && summary.status !== 'agreed' && (
              <span className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-charcoal-300">
                <Check size={11} className="text-forest-100" /> You marked this accurate. Waiting on the other party.
              </span>
            )}
            {revisions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-200 transition hover:border-gold-500/35 hover:text-white"
              >
                <History size={12} /> {showHistory ? 'Hide history' : `History (${revisions.length})`}
              </button>
            )}
          </div>
        </>
      )}

      {showHistory && !editing && (
        <div className="mt-3 space-y-2">
          {revisions.map(revision => (
            <div key={revision.id} className="rounded-lg border border-white/[0.06] bg-charcoal-950/60 p-3">
              <p className="text-[10px] font-bold text-charcoal-200">
                {revision.editor_user_id ? (editorNames[revision.editor_user_id] || 'Project party') : 'AI draft from the transcript'}
                <span className="ml-2 font-normal text-charcoal-400">
                  {new Date(revision.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </p>
              <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-5 text-charcoal-300">
                {revision.body_snapshot}
              </pre>
            </div>
          ))}
        </div>
      )}

      {(call.recording_ref || call.transcript_ref) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          {call.recording_ref && (
            <button
              type="button"
              onClick={() => download(call.recording_ref, 'recording')}
              disabled={downloadBusy === 'recording'}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-200 transition hover:border-gold-500/35 hover:text-white disabled:opacity-45"
            >
              {downloadBusy === 'recording' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Recording
            </button>
          )}
          {call.transcript_ref && (
            <button
              type="button"
              onClick={() => download(call.transcript_ref, 'transcript')}
              disabled={downloadBusy === 'transcript'}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-3 py-1.5 text-[11px] font-bold text-charcoal-200 transition hover:border-gold-500/35 hover:text-white disabled:opacity-45"
            >
              {downloadBusy === 'transcript' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Transcript
            </button>
          )}
          <span className="text-[9px] leading-4 text-charcoal-400">{CALL_RETENTION_TEXT}</span>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] leading-4 text-red-300">{error}</p>}
    </div>
  );
}
