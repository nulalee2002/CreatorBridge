import { Download, ExternalLink, File, Link2 } from 'lucide-react';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export function DeliveryHistory({ deliveries, downloadItem, dark }) {
  if (!deliveries.length) return null;
  return (
    <section className={`rounded-2xl border p-4 ${dark ? 'border-white/[0.08] bg-charcoal-900/55 text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
      <h3 className="font-display text-base font-bold">Delivery history</h3>
      <p className="mt-1 text-xs text-charcoal-400">Every formally submitted version remains in the project record.</p>
      <div className="mt-3 space-y-3">
        {deliveries.map(delivery => (
          <article key={delivery.id} className="rounded-xl border border-white/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-bold">Version {delivery.version}</p><p className="text-[10px] text-charcoal-400">{formatDate(delivery.submitted_at)}</p></div>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gold-400">{String(delivery.status).replaceAll('_', ' ')}</span>
            </div>
            {delivery.note && <p className="mt-2 text-xs leading-5 text-charcoal-300">{delivery.note}</p>}
            <div className="mt-2 space-y-1">
              {(delivery.project_delivery_items || []).map(item => (
                <button key={item.id} type="button" onClick={() => downloadItem(item.id)} className="flex w-full items-center gap-2 rounded-lg bg-black/15 px-2.5 py-2 text-left text-xs hover:bg-white/5">
                  {item.item_type === 'external' ? <Link2 size={13} className="text-gold-400" /> : <File size={13} className="text-gold-400" />}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.item_type === 'external' ? <ExternalLink size={12} /> : <Download size={12} />}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
