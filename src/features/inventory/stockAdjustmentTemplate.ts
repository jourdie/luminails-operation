import ExcelJS from 'exceljs';
import { readImportFile, normalizeImportDate, normalizeImportNumber } from '../shopee/import';
import type { Row } from '../../types/domain';
export const STOCK_ADJUSTMENT_HEADERS = [
  'Merk', 'Product', 'Product Type', 'Variant', 'SKU Code', 'SKU Induk', 'Supplier', 'Retail Price', 'HPP',
  'Adjustment Type', 'Quantity', 'Unit Cost', 'Transaction Date', 'Notes',
] as const;
export type StockAdjustmentInput = { sku_code: string; movement_type: string; qty_delta: number; unit_cost: number | null; transaction_date: string; notes: string };
export async function createStockAdjustmentTemplate(rows: Row[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Penyesuaian Stok');
  sheet.addRow([...STOCK_ADJUSTMENT_HEADERS]);
  for (const row of rows) {
    sheet.addRow([
      row.brand ?? '', row.product_name ?? row.name ?? '', row.product_type ?? row.category ?? '', row.variant_name ?? '', row.sku_code ?? '', row.parent_sku ?? '', row.supplier ?? '', row.retail_price ?? '', row.average_cost ?? row.hpp ?? '',
      'ADJUSTMENT_IN', '', row.average_cost ?? row.hpp ?? '', '', '',
    ]);
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103E38' } };
  sheet.columns.forEach((c) => (c.width = 20)); sheet.getColumn(14).width = 32;
  return book.xlsx.writeBuffer();
}
export async function readStockAdjustmentTemplate(file: File): Promise<StockAdjustmentInput[]> {
  const parsed = await readImportFile(file);
  const missing = ['SKU Code', 'Adjustment Type', 'Quantity'].filter((h) => !parsed.headers.includes(h));
  if (missing.length) throw new Error(`Template penyesuaian stok belum lengkap. Kolom wajib: ${missing.join(', ')}`);
  return parsed.rows.map((row, index) => {
    const movement = String(row['Adjustment Type'] ?? '').trim().toUpperCase();
    const qty = normalizeImportNumber(row.Quantity);
    const date = normalizeImportDate(row['Transaction Date']);
    if (!String(row['SKU Code'] ?? '').trim()) throw new Error(`Baris ${index + 2}: SKU Code wajib diisi.`);
    if (!['OPENING_BALANCE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'CUSTOMER_RETURN', 'IN', 'OUT', 'MASUK', 'KELUAR'].includes(movement)) throw new Error(`Baris ${index + 2}: Adjustment Type tidak valid.`);
    if (!Number.isSafeInteger(qty) || qty === 0) throw new Error(`Baris ${index + 2}: Quantity harus bilangan bulat dan bukan 0.`);
    return { sku_code: String(row['SKU Code']).trim(), movement_type: movement, qty_delta: qty, unit_cost: String(row['Unit Cost'] ?? '').trim() ? normalizeImportNumber(row['Unit Cost']) : null, transaction_date: date, notes: String(row.Notes ?? '').trim() };
  });
}