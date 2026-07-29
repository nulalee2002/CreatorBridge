function text(value, fallback = 'Not provided') {
  return String(value ?? '').trim() || fallback;
}

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents || 0) / 100);
}

export async function createChangeOrderPdf({ terms, signatures = [], contentHash, logoDataUrl, modules }) {
  if (!terms?.document?.number || !contentHash || !logoDataUrl) throw new Error('Complete change-order evidence is required');
  const jsPDFModule = modules?.jsPDF ? modules : await import('jspdf');
  const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const margin = 20;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 18;
  const write = (value, size = 10, style = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text(value), width);
    if (y + lines.length * 5 > 275) { doc.addPage(); y = 20; }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 3;
  };
  doc.addImage(logoDataUrl, 'PNG', margin, y, 57, 14, undefined, 'FAST');
  y += 25;
  write('PROJECT CHANGE ORDER', 20, 'bold');
  write(`Document ${terms.document.number}`, 11, 'bold');
  write(`Original agreement ${terms.original_agreement?.document_number}`, 9);
  write(`Reason: ${terms.reason}`, 11, 'bold');
  write('Before', 12, 'bold');
  write(JSON.stringify(terms.changes?.before || {}, null, 2), 9);
  write('After', 12, 'bold');
  write(JSON.stringify(terms.changes?.after || {}, null, 2), 9);
  write(`Added project price: ${money(terms.pricing?.price_delta_cents)}`, 11, 'bold');
  write(`Added retainer before activation: ${money(terms.pricing?.added_retainer_cents)}`);
  write(`Added final at delivery: ${money(terms.pricing?.added_final_cents)}`);
  write(terms.unchanged_terms, 9);
  write('Signatures', 12, 'bold');
  for (const signature of signatures) {
    write(`${signature.signer_role}: ${signature.signer_name} · ${signature.signed_at}`, 9);
  }
  write(`Content hash: ${contentHash}`, 7);
  return { bytes: new Uint8Array(doc.output('arraybuffer')) };
}
