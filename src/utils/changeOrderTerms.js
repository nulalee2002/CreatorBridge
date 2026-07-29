function requiredText(value, label, max = 4000) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} is too long`);
  return text;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

export function splitChangeOrderAmount(priceDeltaCents) {
  const cents = Number(priceDeltaCents);
  if (!Number.isSafeInteger(cents)) throw new Error('Price change must use whole cents');
  if (cents < 0) throw new Error('Price reductions, refunds, and credits are handled by CreatorBridge support');
  const retainerCents = Math.ceil(cents / 2);
  return { retainerCents, finalCents: cents - retainerCents };
}

export function changeOrderHasProjectEffect(status) {
  return status === 'active';
}

export function buildChangeOrderTerms(source) {
  const { retainerCents, finalCents } = splitChangeOrderAmount(source?.priceDeltaCents);
  const before = stableValue(source?.beforeTerms || {});
  const after = stableValue(source?.afterTerms || {});
  if (!Object.keys(before).length || !Object.keys(after).length) {
    throw new Error('Before and after terms are required');
  }
  const responsibilities = Array.isArray(source?.responsibilities)
    ? source.responsibilities.map(item => requiredText(item, 'Responsibility', 500))
    : [];
  return {
    document: {
      number: requiredText(source.documentNumber, 'Document number', 80),
      version: 'change-order-v1',
      sequence: Number(source.sequenceNumber),
      generated_at: new Date(requiredText(source.generatedAt, 'Generation timestamp')).toISOString(),
    },
    original_agreement: {
      contract_id: requiredText(source.originalContractId, 'Original agreement ID', 80),
      document_number: requiredText(source.originalDocumentNumber, 'Original agreement number', 80),
    },
    project_id: requiredText(source.projectId, 'Project ID', 80),
    reason: requiredText(source.reason, 'Change reason', 2000),
    source_summary_id: source.sourceSummaryId || null,
    changes: { before, after },
    responsibilities,
    pricing: {
      currency: 'USD',
      price_delta_cents: Number(source.priceDeltaCents),
      added_retainer_cents: retainerCents,
      added_final_cents: finalCents,
    },
    unchanged_terms: 'Every term in the original agreement remains in effect unless this signed change order explicitly replaces it.',
  };
}

export function canonicalizeChangeOrderTerms(terms) {
  return JSON.stringify(stableValue(terms));
}

export async function hashChangeOrderTerms(terms) {
  const bytes = new TextEncoder().encode(canonicalizeChangeOrderTerms(terms));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
