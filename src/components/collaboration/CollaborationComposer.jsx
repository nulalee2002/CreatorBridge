import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { recordDirectionalEvent } from '../../lib/platformIntelligence.js';

export function CollaborationComposer({ open, creator, initialProjectId, onClose, onCreated }) {
  const [path, setPath] = useState(initialProjectId ? 'existing' : 'standalone');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [scope, setScope] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [service, setService] = useState(creator?.pillar?.label || 'Post Production');
  const [provider, setProvider] = useState('frame_io');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    recordDirectionalEvent({ name: 'collaboration.composer_started', version: 1, entityType: 'creator_listing', entityId: creator?.listingId, surface: 'creator_profile', properties: { source_surface: 'creator_profile', project_context: initialProjectId ? 'existing_project' : 'unselected', service_category: service } });
    supabase.from('project_participants').select('project_id,projects(id,title,status)').eq('participant_role', 'prime_contractor').eq('status', 'active')
      .then(({ data }) => setProjects((data || []).map((row) => row.projects).filter(Boolean)));
  }, [open, creator?.listingId, initialProjectId]);

  if (!open) return null;
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const cents = Math.round(Number(amount) * 100);
    if (cents < 25000) {
      setError('Creator collaborations have a $250 minimum. Bundle smaller tasks into a professional scope.');
      await recordDirectionalEvent({ name: 'collaboration.sub_floor_attempted', version: 1, entityType: 'creator_listing', entityId: creator.listingId, surface: 'collaboration_composer', properties: { amount_band: 'under_250', service_category: service, exit_point: 'amount_validation' } });
      return;
    }
    if (path === 'existing' && !projectId) return setError('Choose an active project.');
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('create_creator_collaboration', {
      p_collaborator_listing_id: creator.listingId,
      p_project_id: path === 'existing' ? projectId : null,
      p_scope: scope,
      p_amount_cents: cents,
      p_deadline: deadline,
      p_service_category: service,
      p_workspace_provider: provider,
    });
    setSaving(false);
    if (rpcError) return setError(rpcError.message);
    onCreated?.(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[230] flex justify-end bg-black/75 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="h-full w-full max-w-2xl overflow-y-auto border-l border-gold-500/20 bg-charcoal-950 p-6 text-white sm:p-8">
        <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.25em] text-gold-400">Private creator collaboration</p><h2 className="mt-1 font-display text-3xl font-bold">Hire {creator?.studio}</h2></div><button type="button" onClick={onClose} aria-label="Close collaboration form"><X/></button></div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setPath('existing')} className={`rounded-xl border p-4 text-left ${path === 'existing' ? 'border-gold-500 bg-gold-500/10' : 'border-white/10'}`}><strong>Attach to an existing project</strong><span className="mt-1 block text-xs text-charcoal-300">Reuse the active project context.</span></button>
          <button type="button" onClick={() => setPath('standalone')} className={`rounded-xl border p-4 text-left ${path === 'standalone' ? 'border-gold-500 bg-gold-500/10' : 'border-white/10'}`}><strong>Create a standalone collaboration</strong><span className="mt-1 block text-xs text-charcoal-300">Start private work without an outside client.</span></button>
        </div>
        {path === 'existing' && <label className="mt-5 block text-xs">Active project<select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3"><option value="">Choose a project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs">Service category<input value={service} onChange={(e) => setService(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3" required/></label>
          <label className="text-xs">Deadline<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3" required/></label>
          <label className="text-xs">Collaboration price<input type="number" min="250" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3" placeholder="$250 minimum" required/></label>
          <label className="text-xs">Workspace<select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3"><option value="frame_io">Frame.io</option><option value="blackmagic_cloud">Blackmagic Cloud</option><option value="masv">MASV</option><option value="google_drive">Google Drive</option><option value="dropbox">Dropbox</option></select></label>
        </div>
        <label className="mt-4 block text-xs">Scope<textarea value={scope} onChange={(e) => setScope(e.target.value)} minLength={20} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-900 p-3" placeholder="Deliverables, revision expectations, and handoff details" required/></label>
        <div className="mt-5 rounded-xl border border-gold-500/20 bg-gold-500/10 p-4 text-xs leading-6 text-charcoal-200"><strong className="text-gold-400">Before you invite:</strong> $250 minimum · ACH payment only · disclosed processing cost · private team workspace. The outside client will not see the subcontractor or the production-team workspace.</div>
        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={saving} className="btn-gold mt-6 w-full justify-center py-3">{saving ? 'Sending invitation…' : 'Send collaboration invitation'}</button>
      </form>
    </div>
  );
}
