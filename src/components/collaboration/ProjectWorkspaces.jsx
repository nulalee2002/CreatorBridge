import { useEffect, useState } from 'react';
import { ExternalLink, Lock, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

const PROVIDER_LABELS = {
  google_drive: 'Google Drive',
  dropbox: 'Dropbox',
  frame_io: 'Frame.io',
  blackmagic_cloud: 'Blackmagic Cloud',
  masv: 'MASV',
};

function workspaceLabel(type) {
  return type === 'client_delivery' ? 'Client delivery' : 'Production team';
}

export function ProjectWorkspaces({ collaboration, userId, onChanged }) {
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [type, setType] = useState('production_team');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const canManageClientDelivery = userId && collaboration?.prime_user_id === userId;
  const isFunded = ['funded', 'in_progress', 'delivered', 'revision', 'approved', 'completed'].includes(collaboration?.status);

  async function loadLinks() {
    if (!collaboration?.id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('collaboration_workspace_links')
      .select('id,workspace_type,provider,normalized_url,version,active,created_at,revoked_at,created_by')
      .eq('collaboration_id', collaboration.id)
      .order('workspace_type')
      .order('version', { ascending: false });
    if (!loadError) setLinks(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaboration?.id]);

  async function save() {
    if (!url.trim()) {
      setError('Add an approved HTTPS workspace link first.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('save_collaboration_workspace_link', {
      p_collaboration_id: collaboration.id,
      p_workspace_type: type,
      p_url: url.trim(),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setUrl('');
    await loadLinks();
    onChanged?.();
  }

  async function revoke(linkId) {
    const { error: revokeError } = await supabase.rpc('revoke_collaboration_workspace_link', {
      p_workspace_link_id: linkId,
    });
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    await loadLinks();
    onChanged?.();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-charcoal-950/70 p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-gold-400">Private workspaces</p>
          <h3 className="mt-1 font-display text-xl font-bold">Project workspaces</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-charcoal-300">
            Use approved private links for Drive, Dropbox, Frame.io, Blackmagic Cloud, or MASV. You remain responsible for permissions, backups, copyright, and retention. CreatorBridge stores the link record and delivery evidence, but does not inspect external contents.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${isFunded ? 'border-green-400/30 bg-green-500/10 text-green-200' : 'border-gold-500/30 bg-gold-500/10 text-gold-200'}`}>
          <Lock size={12} /> {isFunded ? 'Workspace unlocked' : 'Unlocks after funding'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[190px_1fr_auto]">
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          disabled={!isFunded}
          className="rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none"
        >
          <option value="production_team">Production team</option>
          <option value="client_delivery" disabled={!canManageClientDelivery}>Client delivery</option>
        </select>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={!isFunded}
          placeholder="https://drive.google.com/…"
          className="min-w-0 rounded-xl border border-white/10 bg-charcoal-900 px-3 py-3 text-sm outline-none placeholder:text-charcoal-500"
        />
        <button type="button" onClick={save} disabled={!isFunded || saving} className="btn-gold justify-center">
          {saving ? 'Saving…' : 'Save link'}
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}

      <div className="mt-5 grid gap-3">
        {loading && <p className="text-xs text-charcoal-400">Loading workspace links…</p>}
        {!loading && links.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-charcoal-300">No workspace links have been added yet.</p>}
        {links.map((link) => (
          <article key={link.id} className={`rounded-xl border p-4 ${link.active ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">{workspaceLabel(link.workspace_type)} · {PROVIDER_LABELS[link.provider] || link.provider}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-charcoal-400">Version {link.version} · {link.active ? 'Active' : 'Revoked/replaced'}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={link.normalized_url} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">
                  <ExternalLink size={13} /> Open
                </a>
                {link.active && (
                  <button type="button" onClick={() => revoke(link.id)} className="btn-ghost px-3 py-2 text-xs">
                    <Trash2 size={13} /> Revoke
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-[11px] leading-5 text-charcoal-300 md:grid-cols-2">
        <p className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 text-gold-300" /> Production team links are private to the prime and collaborator.</p>
        <p className="flex gap-2"><RefreshCw size={14} className="mt-0.5 text-gold-300" /> Replacing a link keeps an immutable version and revocation history.</p>
      </div>
    </section>
  );
}
