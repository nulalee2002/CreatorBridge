const BRAND_LOGO_PATH = '/images/brand/creatorbridge-platform-logo-transparent.png';

const COLORS = Object.freeze({
  clay: [156, 74, 51],
  forest: [45, 91, 68],
  gold: [161, 125, 64],
  ink: [30, 25, 21],
  stone: [102, 94, 84],
  paper: [255, 253, 249],
  line: [210, 198, 180],
  forestWash: [238, 246, 240],
});

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatTimestamp(value) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

function cleanText(value, fallback = 'Not provided') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

async function loadPdfModules(modules) {
  if (modules?.jsPDF && modules?.autoTable) return modules;
  const jsPDFModule = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  return {
    jsPDF: jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default,
    autoTable: autoTableModule.autoTable || autoTableModule.default?.autoTable || autoTableModule.default,
  };
}

export async function fetchBrandLogoDataUrl(url = BRAND_LOGO_PATH) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('CreatorBridge contract logo could not be loaded');
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return `data:${blob.type || 'image/png'};base64,${base64}`;
}

export async function createContractPdf({
  terms,
  signatures = [],
  contentHash,
  logoDataUrl,
  modules,
}) {
  if (!terms?.document?.number) throw new Error('Contract terms are required');
  if (!contentHash) throw new Error('Contract content hash is required');
  if (!logoDataUrl) throw new Error('The real CreatorBridge logo is required');

  const { jsPDF, autoTable } = await loadPdfModules(modules);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const clientSignature = signatures.find(signature => signature.signer_role === 'client');
  const creatorSignature = signatures.find(signature => signature.signer_role === 'creator');
  let y = 18;

  const drawFooter = () => {
    const pageNumber = doc.getNumberOfPages();
    doc.setDrawColor(...COLORS.line);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.stone);
    doc.text('CreatorBridge Production Agreement', margin, pageHeight - 8);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addPage = () => {
    drawFooter();
    doc.addPage();
    doc.setFillColor(...COLORS.paper);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    y = 20;
  };

  const ensureSpace = (height) => {
    if (y + height > pageHeight - 20) addPage();
  };

  const writeWrapped = (text, options = {}) => {
    const {
      x = margin,
      width = contentWidth,
      size = 10,
      color = COLORS.ink,
      font = 'helvetica',
      style = 'normal',
      lineHeight = 5,
    } = options;
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(cleanText(text), width);
    ensureSpace(lines.length * lineHeight + 2);
    doc.text(lines, x, y);
    y += lines.length * lineHeight + 2;
  };

  const section = (number, title, text) => {
    ensureSpace(24);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.clay);
    doc.text(String(number), margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gold);
    doc.text(String(title).toUpperCase(), margin + 14, y - 0.5);
    y += 7;
    writeWrapped(text, { x: margin + 14, width: contentWidth - 14, size: 9.5, color: COLORS.stone });
    y += 3;
  };

  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.addImage(logoDataUrl, 'PNG', margin, y, 57, 14, undefined, 'FAST');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gold);
  doc.text(`NO. ${terms.document.number}`, pageWidth - margin, y + 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.stone);
  doc.text(`ISSUED ${formatDate(terms.generated_at).toUpperCase()}`, pageWidth - margin, y + 10, { align: 'right' });
  y += 21;
  doc.setDrawColor(...COLORS.gold);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gold);
  doc.text('AUTO-GENERATED FROM THE ACCEPTED BRIEF', pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.ink);
  doc.text('Production Agreement', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setDrawColor(...COLORS.gold);
  doc.line(pageWidth / 2 - 32, y, pageWidth / 2 - 4, y);
  doc.line(pageWidth / 2 + 4, y, pageWidth / 2 + 32, y);
  doc.rect(pageWidth / 2 - 1.6, y - 1.6, 3.2, 3.2);
  y += 10;

  const clientName = cleanText(terms.parties?.client?.name, 'The Client');
  const creatorBusiness = cleanText(terms.parties?.creator?.business_name || terms.parties?.creator?.name, 'The Creator');
  writeWrapped(
    `Between ${clientName}${terms.parties?.client?.company ? ` for ${terms.parties.client.company}` : ''}, the Client, and ${creatorBusiness}, the Creator, facilitated and protected by CreatorBridge.`,
    { x: margin + 16, width: contentWidth - 32, size: 9.5, color: COLORS.stone, style: 'italic' },
  );
  y += 4;

  section('1', 'Parties', `This agreement is between ${clientName}${terms.parties?.client?.company ? ` for ${terms.parties.client.company}` : ''}, the Client, and ${creatorBusiness}, the Creator. CreatorBridge facilitates the booking and protected payment process.`);
  section('2', 'Project scope', `${cleanText(terms.project?.title)}. ${cleanText(terms.project?.description)} Service: ${cleanText(terms.project?.service_id)}.`);

  ensureSpace(30);
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.clay);
  doc.text('3', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gold);
  doc.text('DELIVERABLES AND TIMELINE', margin + 14, y - 0.5);
  y += 7;
  for (const deliverable of terms.deliverables || []) {
    ensureSpace(8);
    doc.setFillColor(...COLORS.clay);
    doc.rect(margin + 15, y - 2.1, 2.2, 2.2, 'F');
    writeWrapped(deliverable, { x: margin + 21, width: contentWidth - 21, size: 9.5, color: COLORS.stone });
  }
  writeWrapped(
    `Location: ${cleanText(terms.location)}. Project timing: ${cleanText(terms.timeline?.project_timeline)}. Delivery: ${terms.timeline?.turnaround_days ? `within ${terms.timeline.turnaround_days} days` : 'as stated in the accepted brief'}. Revisions: ${Number(terms.revisions || 0)} rounds included.`,
    { x: margin + 14, width: contentWidth - 14, size: 9, color: COLORS.ink, style: 'bold' },
  );
  y += 4;

  ensureSpace(64);
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.clay);
  doc.text('4', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gold);
  doc.text('FEES AND PROTECTED PAYMENT', margin + 14, y - 0.5);
  y += 4;
  const pricing = terms.pricing || {};
  autoTable(doc, {
    startY: y,
    margin: { left: margin + 14, right: margin },
    theme: 'plain',
    body: [
      ['Project total', formatMoney(pricing.total)],
      ['Retainer to book, 50 percent', formatMoney(pricing.retainer)],
      ['Final on approved delivery, 50 percent', formatMoney(pricing.final)],
      [`Client booking fee, ${pricing.client_fee_pct} percent`, formatMoney(pricing.client_fee)],
      [`Creator platform fee, ${pricing.creator_fee_pct} percent`, `-${formatMoney(pricing.creator_fee)}`],
      ['Estimated creator net', formatMoney(pricing.creator_net)],
    ],
    styles: { font: 'helvetica', fontSize: 9, textColor: COLORS.stone, cellPadding: 3.2, lineColor: COLORS.line, lineWidth: { bottom: 0.15 } },
    columnStyles: { 1: { halign: 'right', font: 'times', fontSize: 11, textColor: COLORS.ink } },
    didParseCell(data) {
      if (data.row.index === 5) {
        data.cell.styles.fillColor = COLORS.forestWash;
        data.cell.styles.textColor = COLORS.forest;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc.lastAutoTable?.finalY || y + 50) + 6;
  writeWrapped('CreatorBridge uses protected payment through Stripe. The final payment is attempted after client approval, or automatically five calendar days after delivery if the client does not respond.', { x: margin + 14, width: contentWidth - 14, size: 8.5, color: COLORS.stone, style: 'italic' });
  y += 3;

  section('5', 'Cancellation', terms.cancellation);
  section('6', 'Usage and ownership', terms.usage);
  section('7', 'Disputes and platform communication', `${terms.disputes} ${terms.communication}`);

  ensureSpace(55);
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.clay);
  doc.text('8', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gold);
  doc.text('SIGNATURES', margin + 14, y - 0.5);
  y += 7;
  doc.setDrawColor(...COLORS.gold);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.stone);
  doc.text('In witness whereof, the parties execute this agreement.', pageWidth / 2, y, { align: 'center' });
  y += 12;

  const signatureWidth = (contentWidth - 14) / 2;
  const drawSignature = (signature, role, x) => {
    if (signature?.image_data_url) {
      doc.addImage(signature.image_data_url, 'PNG', x + 8, y - 3, signatureWidth - 16, 18, undefined, 'FAST');
    } else {
      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.stone);
      doc.text('awaiting signature', x + signatureWidth / 2, y + 8, { align: 'center' });
    }
    doc.setDrawColor(...COLORS.gold);
    doc.line(x, y + 18, x + signatureWidth, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gold);
    doc.text(`THE ${role.toUpperCase()}`, x + signatureWidth / 2, y + 24, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.stone);
    doc.text(signature ? `Signed electronically, ${formatDate(signature.signed_at)}` : 'Signature pending', x + signatureWidth / 2, y + 29, { align: 'center' });
  };
  drawSignature(creatorSignature, 'Creator', margin);
  drawSignature(clientSignature, 'Client', margin + signatureWidth + 14);
  y += 38;

  writeWrapped('Both parties review and sign the same document. CreatorBridge records each signature against the exact document hash and never signs on behalf of either party.', { x: margin, width: contentWidth, size: 7.5, color: COLORS.stone, style: 'italic' });
  drawFooter();

  doc.addPage();
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  y = 22;
  doc.addImage(logoDataUrl, 'PNG', margin, y, 48, 12, undefined, 'FAST');
  y += 23;
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.ink);
  doc.text('Electronic Signature Audit', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.stone);
  doc.text(`Agreement ${terms.document.number}`, margin, y);
  y += 10;
  doc.setDrawColor(...COLORS.gold);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  for (const role of ['client', 'creator']) {
    const signature = signatures.find(item => item.signer_role === role);
    ensureSpace(48);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gold);
    doc.text(role.toUpperCase(), margin, y);
    y += 7;
    const rows = signature ? [
      ['Name', signature.signer_name],
      ['Method', signature.method],
      ['Signed at', formatTimestamp(signature.signed_at)],
      ['IP address', signature.ip_address || 'Not captured'],
      ['Device', signature.user_agent || 'Not captured'],
      ['Signed content hash', signature.signed_content_hash],
    ] : [['Status', 'Awaiting signature']];
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      body: rows,
      styles: { font: 'helvetica', fontSize: 8, textColor: COLORS.ink, cellPadding: 2.4, lineColor: COLORS.line, lineWidth: { bottom: 0.1 }, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold', textColor: COLORS.stone }, 1: { cellWidth: contentWidth - 35 } },
    });
    y = (doc.lastAutoTable?.finalY || y + 28) + 10;
  }

  ensureSpace(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gold);
  doc.text('DOCUMENT HASH', margin, y);
  y += 7;
  writeWrapped(contentHash, { size: 8, color: COLORS.ink, font: 'courier', lineHeight: 4.5 });
  writeWrapped('This audit records the electronic signature events associated with the exact structured terms identified by the document hash. It is factual evidence of the platform signing process and does not involve a notary service.', { size: 8, color: COLORS.stone, style: 'italic' });
  drawFooter();

  return {
    bytes: new Uint8Array(doc.output('arraybuffer')),
    filename: `${terms.document.number.toLowerCase()}-production-agreement.pdf`,
  };
}

export async function downloadContractPdf(options) {
  const logoDataUrl = options.logoDataUrl || await fetchBrandLogoDataUrl();
  const { bytes, filename } = await createContractPdf({ ...options, logoDataUrl });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export { BRAND_LOGO_PATH };
