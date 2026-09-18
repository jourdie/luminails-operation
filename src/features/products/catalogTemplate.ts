import ExcelJS from 'exceljs';
import { readImportFile } from '../shopee/import';
export const SKU_TEMPLATE_HEADERS = [
  'Merk', 'Product', 'Product Type', 'Variant', 'SKU Code', 'SKU Induk', 'Supplier', 'Retail Price', 'HPP',
] as const;
export type CatalogTemplateRow = Record<(typeof SKU_TEMPLATE_HEADERS)[number], string>;
export async function createSkuTemplate() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('SKU Master');
  sheet.addRow([...SKU_TEMPLATE_HEADERS]);
  sheet.addRow(['Party', 'Essentials', 'Gel Polish', 'Clear', 'SKU-001', '', 'Party', '140000', '88000']);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103E38' } };
  sheet.columns.forEach((c) => (c.width = 20));
  return book.xlsx.writeBuffer();
}
export async function readSkuTemplate(file: File) {
  const parsed = await readImportFile(file);
  const missing = SKU_TEMPLATE_HEADERS.filter((h) => !parsed.headers.includes(h));
  if (missing.length) throw new Error(`Template SKU belum lengkap. Kolom wajib: ${missing.join(', ')}`);
  return parsed.rows as CatalogTemplateRow[];
}
