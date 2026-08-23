import { DeliveryComposer } from './DeliveryComposer.jsx';
import { DeliveryHistory } from './DeliveryHistory.jsx';
import { DeliveryReviewPanel } from './DeliveryReviewPanel.jsx';
import { FinalPaymentAttention } from './FinalPaymentAttention.jsx';
import { useProjectCompletion } from '../../hooks/useProjectCompletion.js';

export function ProjectCompletionPanel({ project, isClient, isCreator, dark, onOpenDispute }) {
  const completion = useProjectCompletion(project.id);
  if (completion.loading) return <div className="rounded-xl border border-white/10 p-4 text-xs text-charcoal-400">Loading project delivery…</div>;
  return <div className="space-y-3">{completion.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{completion.error}</p>}{isClient && <FinalPaymentAttention completion={completion} dark={dark} />}{isCreator && ['retainer_paid', 'in_progress', 'revision', 'delivered'].includes(project.status) && <DeliveryComposer projectId={project.id} completion={completion} dark={dark} />}{isClient && <DeliveryReviewPanel completion={completion} onOpenDispute={onOpenDispute} dark={dark} />}<DeliveryHistory deliveries={completion.deliveries} downloadItem={completion.downloadItem} dark={dark} /></div>;
}
