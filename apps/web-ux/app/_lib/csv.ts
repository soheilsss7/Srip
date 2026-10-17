/* ============================================================================
   CSV helpers — Excel-compatible (UTF-8 BOM + RFC-4180 quoting).
   ============================================================================ */

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return '\uFEFF' + lines.join('\r\n'); // BOM → Excel opens Persian correctly
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Detect delimiter (comma vs semicolon) from the header line. */
function detectDelimiter(firstLine: string): string {
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semi = (firstLine.match(/;/g) ?? []).length;
  return semi > comma ? ';' : ',';
}

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  let src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delim = detectDelimiter(src.split('\n')[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}

/** Map a header label (Persian or English) to a canonical key. */
const HEADER_ALIASES: Record<string, string> = {
  'نام': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName', 'نام کوچک': 'firstName',
  'نام خانوادگی': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
  'ایمیل': 'email', 'email': 'email',
  'تلفن': 'phone', 'phone': 'phone', 'موبایل': 'phone',
  'سمت': 'title', 'title': 'title', 'عنوان شغلی': 'title',
  'بخش': 'department', 'department': 'department', 'دپارتمان': 'department',
  'سازمان': 'organization', 'organization': 'organization', 'organizationid': 'organizationId', 'شناسه سازمان': 'organizationId',
  'وضعیت': 'status', 'status': 'status',
  'نفوذ': 'influenceScore', 'influence': 'influenceScore', 'influenceScore': 'influenceScore',
};

export function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/[\s\-_]+/g, '');
  for (const [alias, canonical] of Object.entries(HEADER_ALIASES)) {
    if (alias.replace(/[\s\-_]+/g, '').toLowerCase() === key) return canonical;
  }
  return h.trim();
}

export const PEOPLE_TEMPLATE_HEADERS = ['نام', 'نام خانوادگی', 'ایمیل', 'تلفن', 'سمت', 'بخش', 'وضعیت', 'نفوذ'];
export const PEOPLE_TEMPLATE_SAMPLE = [
  ['سارا', 'محمدی', 'sara@example.ir', '+98 912 000 0000', 'مدیر فروش', 'فروش', 'ACTIVE', '82'],
  ['رضا', 'کریمی', 'reza@example.ir', '+98 913 000 0000', 'مدیر خرید', 'تدارکات', 'ACTIVE', '74'],
];
