/**
 * exportCsv — converts an array of objects to a CSV file and triggers a browser download.
 *
 * @param {object[]} rows     Array of plain objects (all rows must have the same keys)
 * @param {string}   filename Desired filename, without the .csv extension
 */
export function exportCsv(rows, filename) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const escape = val => {
    if (val == null) return '';
    const str = String(val);
    // Wrap in quotes if it contains a comma, quote, or newline
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
