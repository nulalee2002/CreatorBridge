import { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export function ProjectDocuments({ projectId }) {
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!projectId) return;
    supabase.rpc('get_project_documents', { p_project_id: projectId }).then(({ data }) => setDocuments(data || []));
  }, [projectId]);
  async function open(document) {
    if (!document.file_ref) return;
    setBusy(document.document_id);
    const { data } = await supabase.functions.invoke('create-storage-signed-url', { body: { ref: document.file_ref, expiresIn: 600 } });
    setBusy('');
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }
  return (
    <section className="rounded-xl border border-white/[0.07] bg-charcoal-900/55 p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-white"><FileText size={13} className="text-gold-400" /> Project documents</p>
      <p className="mt-1 text-[10px] leading-4 text-charcoal-400">Both parties retain access to the original agreement, signed changes, and agreed call records.</p>
      <div className="mt-3 space-y-2">
        {documents.map(document => (
          <div key={`${document.document_type}-${document.document_id}`} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-charcoal-100">{document.document_number || document.document_type}</p><p className="text-[9px] capitalize text-charcoal-400">{document.document_type.replaceAll('_',' ')} · {document.document_status}</p></div>
            {document.file_ref && <button onClick={() => open(document)} disabled={busy === document.document_id} className="text-gold-300">{busy === document.document_id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}</button>}
          </div>
        ))}
        {!documents.length && <p className="text-[11px] text-charcoal-400">Project records appear after the agreement is generated.</p>}
      </div>
    </section>
  );
}
