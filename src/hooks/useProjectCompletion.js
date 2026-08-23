import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

export function useProjectCompletion(projectId) {
  const [deliveries, setDeliveries] = useState([]);
  const [revisionState, setRevisionState] = useState(null);
  const [paymentState, setPaymentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !supabase || !projectId) {
      setDeliveries([]);
      setRevisionState(null);
      setPaymentState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [
        { data: deliveryRows, error: deliveryError },
        { data: revision, error: revisionError },
        { data: transaction, error: transactionError },
      ] = await Promise.all([
        supabase
          .from('project_deliveries')
          .select('*, project_delivery_items(*)')
          .eq('project_id', projectId)
          .neq('status', 'draft')
          .order('version', { ascending: false }),
        supabase.rpc('get_project_revision_state', { p_project_id: projectId }),
        supabase
          .from('transactions')
          .select('id, final_status, final_payment_error_code, final_payment_error_message, final_payment_requires_action, final_payment_attention_at, final_payment_attempt_count')
          .eq('project_id', projectId)
          .maybeSingle(),
      ]);
      if (deliveryError) throw deliveryError;
      if (revisionError) throw revisionError;
      if (transactionError) throw transactionError;
      setDeliveries(deliveryRows || []);
      setRevisionState(revision || null);
      setPaymentState(transaction || null);
    } catch (cause) {
      setError(cause?.message || 'Project delivery state could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const invoke = useCallback(async (functionName, body) => {
    const { data, error: functionError } = await supabase.functions.invoke(functionName, { body });
    if (functionError) throw functionError;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const createUploadReservation = useCallback((file, deliveryDraftId = null) => invoke('create-delivery-upload', {
    projectId,
    deliveryDraftId,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  }), [invoke, projectId]);

  const finalizeDelivery = useCallback(async ({ deliveryDraftId, note, externalItems, idempotencyKey }) => {
    const data = await invoke('finalize-project-delivery', {
      projectId,
      deliveryDraftId,
      note,
      externalItems,
      idempotencyKey,
    });
    await refresh();
    return data;
  }, [invoke, projectId, refresh]);

  const requestRevision = useCallback(async (deliveryId, instructions, idempotencyKey) => {
    const { data, error: requestError } = await supabase.rpc('request_project_revision', {
      p_project_id: projectId,
      p_delivery_id: deliveryId,
      p_instructions: instructions,
      p_idempotency_key: idempotencyKey,
    });
    if (requestError) throw requestError;
    await refresh();
    return data;
  }, [projectId, refresh]);

  const beginRevisionPurchase = useCallback((idempotencyKey) => invoke('create-revision-payment', {
    projectId,
    idempotencyKey,
  }), [invoke, projectId]);

  const approveDelivery = useCallback(async (deliveryId) => {
    const { data, error: approveError } = await supabase.rpc('approve_project_delivery', {
      p_project_id: projectId,
      p_delivery_id: deliveryId,
    });
    if (approveError) throw approveError;
    try {
      await invoke('process-final-payment', { projectId, recovery: false });
    } catch (cause) {
      setError('Delivery was approved and the final payment is safely queued. Automatic processing will retry shortly.');
    }
    await refresh();
    return data;
  }, [invoke, projectId, refresh]);

  const beginFinalPaymentRecovery = useCallback(() => invoke('process-final-payment', {
    projectId,
    recovery: true,
  }), [invoke, projectId]);

  const disputeDelivery = useCallback(async (deliveryId) => {
    const { data, error: disputeError } = await supabase.rpc('pause_delivery_for_dispute', {
      p_project_id: projectId,
      p_delivery_id: deliveryId,
    });
    if (disputeError) throw disputeError;
    await refresh();
    return data;
  }, [projectId, refresh]);

  const downloadItem = useCallback(async (deliveryItemId) => {
    const data = await invoke('create-delivery-download', { deliveryItemId });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    return data;
  }, [invoke]);

  return {
    deliveries,
    revisionState,
    paymentState,
    loading,
    error,
    refresh,
    createUploadReservation,
    finalizeDelivery,
    requestRevision,
    beginRevisionPurchase,
    approveDelivery,
    beginFinalPaymentRecovery,
    disputeDelivery,
    downloadItem,
  };
}
