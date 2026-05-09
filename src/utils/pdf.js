import { formatCurrency } from './pricing.js';
import { REGIONS } from '../data/regions.js';

export async function generateQuotePDF(quote, state, profile) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = W - margin * 2;
  const { currency = 'USD', exchangeRates } = state;
  const fmt = (v) => formatCurrency(v, currency, exchangeRates);

  const colors = {
    charcoal:  [26, 26, 46],
    gold:      [212, 169, 65],
    mutedGold: [184, 142, 46],
    white:     [255, 255, 255],
    lightGray: [245, 245, 250],
    midGray:   [160, 160, 180],
    darkGray:  [80, 80, 100],
  };

  // ── Header Banner ──────────────────────────────────────────
  doc.setFillColor(...colors.charcoal);
  doc.rect(0, 0, W, 48, 'F');

  // Gold accent bar
  doc.setFillColor(...colors.gold);
  doc.rect(0, 44, W, 4, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...colors.white);
  doc.text(profile?.companyName || 'Your Production Company', margin, 20);

  // Tagline or doc title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...colors.gold);
  doc.text('PRODUCTION PRICING ESTIMATE', margin, 28);

  // Contact info (right side)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.midGray);
  const contactLines = [
    profile?.email || '',
    profile?.phone || '',
    profile?.website || '',
  ].filter(Boolean);
  let cy = 14;
  for (const line of contactLines) {
    doc.text(line, W - margin, cy, { align: 'right' });
    cy += 6;
  }

  // ── Quote Meta ─────────────────────────────────────────────
  let y = 58;

  // Date and quote number
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.darkGray);
  doc.text(`Date: ${today}`, margin, y);
  if (state.quoteNumber) {
    doc.text(`Quote #: ${state.quoteNumber}`, W - margin, y, { align: 'right' });
  }
  y += 6;

  // Client name
  if (state.clientName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.charcoal);
    doc.text(`Prepared for: ${state.clientName}`, margin, y);
    y += 5;
  }

  // Service type + region
  const region = REGIONS[state.regionKey];
  const serviceLabel = state.serviceId ? state.serviceId.charAt(0).toUpperCase() + state.serviceId.slice(1) : '';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.darkGray);
  doc.text(`Service: ${serviceLabel}  ·  Region: ${region?.name || ''}`, margin, y);
  y += 12;

  // ── Line Items Table ───────────────────────────────────────
  const tableBody = quote.lines.map(line => [
    line.label,
    line.rate != null ? fmt(line.rate) : '—',
    line.quantity != null ? `${line.quantity}${line.unit ? ' ' + line.unit : ''}` : '—',
    fmt(line.subtotal),
  ]);

  doc.autoTable({
    startY: y,
    head: [['Description', 'Rate', 'Qty', 'Amount']],
    body: tableBody,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: colors.charcoal,
      textColor: colors.gold,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: colors.darkGray },
    alternateRowStyles: { fillColor: colors.lightGray },
    columnStyles: {
      0: { cellWidth: contentW * 0.45 },
      1: { cellWidth: contentW * 0.18, halign: 'right' },
      2: { cellWidth: contentW * 0.18, halign: 'right' },
      3: { cellWidth: contentW * 0.19, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: () => {},
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Totals Block ───────────────────────────────────────────
  const totalsX = W - margin - 80;
  const totalsW = 80;

  const drawTotalRow = (label, value, bold = false, highlight = false) => {
    if (highlight) {
      doc.setFillColor(...colors.charcoal);
      doc.rect(totalsX - 4, y - 5, totalsW + 8, 9, 'F');
      doc.setTextColor(...colors.gold);
    } else {
      doc.setTextColor(...colors.darkGray);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 9);
    doc.text(label, totalsX, y);
    doc.text(value, totalsX + totalsW, y, { align: 'right' });
    y += 8;
  };

  // Check space
  if (y > H - 70) { doc.addPage(); y = margin; }

  drawTotalRow('Subtotal', fmt(quote.subtotalPreTax));
  if (quote.taxAmount > 0) {
    drawTotalRow(`Tax (${quote.taxRate}%)`, fmt(quote.taxAmount));
  }
  y += 2;
  drawTotalRow('TOTAL', fmt(quote.grandTotal), true, true);
  y += 4;

  // Currency note
  if (currency !== 'USD') {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.midGray);
    doc.text(`All amounts in ${currency}. Exchange rates are approximate.`, totalsX, y);
    y += 8;
  }

  // ── Revisions Note ─────────────────────────────────────────
  if (quote.revisionsNote) {
    if (y > H - 50) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.darkGray);
    doc.text(quote.revisionsNote, margin, y);
    y += 8;
  }

  // ── Terms & Notes ──────────────────────────────────────────
  if (state.notes) {
    if (y > H - 50) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...colors.charcoal);
    doc.text('Notes & Terms', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.darkGray);
    const splitNotes = doc.splitTextToSize(state.notes, contentW);
    doc.text(splitNotes, margin, y);
    y += splitNotes.length * 5 + 4;
  }

  // ── Footer ─────────────────────────────────────────────────
  const footerY = H - 14;
  doc.setFillColor(...colors.gold);
  doc.rect(0, footerY - 4, W, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.midGray);
  doc.text('Generated with CreatorBridge Rate Calculator', margin, footerY);
  doc.text(`Page 1`, W - margin, footerY, { align: 'right' });

  // ── Save ───────────────────────────────────────────────────
  const filename = `quote-${(profile?.companyName || 'estimate').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  doc.save(filename);
}
