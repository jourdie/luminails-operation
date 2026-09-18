import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { OrderInput, Row } from '../../types/domain';
export const importFields = [
  'external_order_id',
  'external_item_id',
  'sku',
  'qty',
  'price',
  'order_date',
] as const;
export type ImportField = (typeof importFields)[number];
export type Mapping = Record<ImportField, string>;
export type ParsedRow = Row & {
  external_order_id: string;
  external_item_id: string;
  sku_id: string;
  qty: number;
  price: number;
  order_date: string;
  status: 'NEW' | 'DUPLICATE' | 'UNMAPPED' | 'ERROR';
  errors: string[];
};
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV_INVALID_QUOTE');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function importErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message.replace(/^Error:\s*/, '') : String(error);
  const messages: Record<string, string> = { FILE_TOO_LARGE: 'File terlalu besar. Maksimal 10 MB.', FILE_ROWS: 'File harus berisi header dan maksimal 5.000 baris data.', FILE_TYPE: 'Format file tidak didukung. Gunakan .xlsx atau .csv.', CSV_INVALID_QUOTE: 'CSV tidak valid: tanda kutip tidak berpasangan.', DUPLICATE_HEADERS: 'Header kolom berulang. Hapus kolom yang sama.' };
  return messages[raw] ?? raw;
}

export function normalizeImportNumber(value: unknown): number {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) return Number(text.replace(/\./g, '').replace(',', '.'));
  return Number(text.replace(',', '.'));
}

export function normalizeImportDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  const text = String(value ?? '').trim();
  if (!text) return '';
  const iso = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) { const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))); return d.getUTCFullYear() === Number(iso[1]) && d.getUTCMonth() === Number(iso[2]) - 1 && d.getUTCDate() === Number(iso[3]) ? iso[1] + '-' + String(Number(iso[2])).padStart(2, '0') + '-' + String(Number(iso[3])).padStart(2, '0') : ''; }
  const dmy = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (dmy) { const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))); return d.getUTCFullYear() === Number(dmy[3]) && d.getUTCMonth() === Number(dmy[2]) - 1 && d.getUTCDate() === Number(dmy[1]) ? dmy[3] + '-' + String(Number(dmy[2])).padStart(2, '0') + '-' + String(Number(dmy[1])).padStart(2, '0') : ''; }
  const serial = Number(text);
  if (/^\d{5}$/.test(text) && Number.isFinite(serial)) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  return '';
}
export async function readImportFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  let matrix: string[][];
  if (file.name.toLowerCase().endsWith('.csv'))
    matrix = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
  else if (file.name.toLowerCase().endsWith('.xlsx')) {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    matrix = [];
    book.worksheets[0]?.eachRow((row) => {
      const values: string[] = [];
      for (let i = 1; i <= row.cellCount; i++) {
        const v = row.getCell(i).value;
        values.push(
          v instanceof Date
            ? normalizeImportDate(v)
            : typeof v === 'object' && v && 'result' in v
              ? String(v.result ?? '')
              : row.getCell(i).text,
        );
      }
      matrix.push(values);
    });
  } else throw new Error('FILE_TYPE');
  if (matrix.length < 2 || matrix.length > 5001) throw new Error('FILE_ROWS');
  const headers = matrix[0].map((h) => h.trim());
  if (new Set(headers).size !== headers.length) throw new Error('DUPLICATE_HEADERS');
  return {
    headers,
    rows: matrix
      .slice(1)
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]?.trim() ?? '']))),
  };
}
const aliases: Record<ImportField, string[]> = {
  external_order_id: ['No. Pesanan', 'Order ID', 'external_order_id'],
  external_item_id: ['ID Item', 'Item ID', 'external_item_id'],
  sku: ['SKU Induk', 'SKU', 'sku'],
  qty: ['Jumlah', 'Quantity', 'qty'],
  price: ['Harga Setelah Diskon', 'Price', 'price'],
  order_date: ['Waktu Pesanan Dibuat', 'Order Date', 'order_date'],
};
export function suggestMapping(headers: string[]): Mapping {
  return Object.fromEntries(
    importFields.map((f) => [
      f,
      headers.find((h) => aliases[f].some((a) => a.toLowerCase() === h.toLowerCase())) ?? '',
    ]),
  ) as Mapping;
}
const rowSchema = z.object({
  external_order_id: z.string().min(1),
  external_item_id: z.string().min(1),
  qty: z.number().int().positive().max(1000000),
  price: z.number().int().nonnegative().max(1e12),
  order_date: z.iso.date(),
});
export function validateImport(
  raw: Record<string, string>[],
  mapping: Mapping,
  skus: Row[],
  existingOrders: Set<string>,
  skuMapping: Record<string, string>,
): ParsedRow[] {
  const seen = new Set<string>();
  return raw.map((r) => {
    const code = r[mapping.sku];
    const sku = skuMapping[code] ?? String(skus.find((s) => s.sku_code === code)?.id ?? '');
    const normalized = {
      external_order_id: r[mapping.external_order_id] ?? '',
      external_item_id: r[mapping.external_item_id] ?? '',
      sku_id: sku,
      qty: normalizeImportNumber(r[mapping.qty]),
      price: normalizeImportNumber(r[mapping.price]),
      order_date: normalizeImportDate(r[mapping.order_date]),
    };
    const validation = rowSchema.safeParse(normalized);
    const identity = normalized.external_order_id + '\u0000' + normalized.external_item_id;
    const errors: string[] = [];
    if (!normalized.external_order_id || !normalized.external_item_id) errors.push('Nomor pesanan dan ID item wajib diisi.');
    if (!normalized.order_date) errors.push('Tanggal transaksi tidak dikenali. Gunakan DD/MM/YYYY atau YYYY-MM-DD.');
    if (!Number.isSafeInteger(normalized.qty) || normalized.qty <= 0) errors.push('Jumlah harus berupa bilangan bulat lebih dari 0.');
    if (!Number.isSafeInteger(normalized.price) || normalized.price < 0) errors.push('Harga harus berupa angka IDR yang valid.');
    let status: ParsedRow['status'] = !validation.success
      ? 'ERROR'
      : !sku
        ? 'UNMAPPED'
        : existingOrders.has(normalized.external_order_id)
          ? 'DUPLICATE'
          : 'NEW';
    if (seen.has(identity)) {
      status = 'ERROR';
      errors.push('ID item berulang dalam file.');
    }
    seen.add(identity);
    return { ...normalized, status, errors };
  });
}
export function groupImport(
  rows: ParsedRow[],
  allocation: { type: 'LOCAL_STOCK' | 'SUPPLIER'; reference: string },
): OrderInput[] {
  const grouped = new Map<string, OrderInput>();
  for (const row of rows.filter((r) => r.status === 'NEW')) {
    let order = grouped.get(row.external_order_id);
    if (!order) {
      order = {
        channel: 'SHOPEE',
        order_date: row.order_date,
        external_order_number: row.external_order_id,
        discount: 0,
        items: [],
      };
      grouped.set(row.external_order_id, order);
    }
    if (order.order_date !== row.order_date) throw new Error('IMPORT_DATE_CONFLICT');
    order.items.push({
      sku_id: row.sku_id,
      qty: row.qty,
      normal_unit_price: row.price,
      selling_unit_price: row.price,
      external_item_id: row.external_item_id,
      allocations: [
        {
          fulfillment_type: allocation.type,
          qty: row.qty,
          ...(allocation.type === 'LOCAL_STOCK'
            ? { inventory_location_id: allocation.reference }
            : { supplier_id: allocation.reference }),
        },
      ],
    });
  }
  return [...grouped.values()];
}


