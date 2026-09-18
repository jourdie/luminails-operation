import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { pdf } from '@react-pdf/renderer';
import { createOrderWorkbook, type ExportOrder } from '../src/lib/exports/excel';
import { OrderDocument } from '../src/lib/exports/pdf';
import { orderTotals, sumMoney, subtractMoney } from '../src/lib/money';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const order: ExportOrder = {
  number: 'TEST-WA-001',
  date: '2026-09-15',
  customer: 'Pelanggan Uji',
  discount: '50000',
  items: [
    { sku: 'A', name: 'SKU A', qty: 3, normal_unit_price: 120000, selling_unit_price: 100000 },
    { sku: 'B', name: 'SKU B', qty: 2, normal_unit_price: 150000, selling_unit_price: 125000 },
  ],
};
describe('WhatsApp totals and exports', () => {
  it('adds decimal amounts without binary floating-point loss', () => {
    expect(sumMoney(['0.1', '0.2'])).toBe('0.3');
    expect(subtractMoney('100000000000000000.01', '0.01')).toBe('100000000000000000');
  });
  it('calculates fixed nominal discount and total savings', () => {
    expect(orderTotals(order.items, order.discount)).toEqual({
      units: 5,
      normal: '660000',
      selling: '550000',
      discount: '50000',
      grand: '500000',
      savings: '160000',
      valid: true,
    });
    expect(orderTotals(order.items, 600000).valid).toBe(false);
  });
  it('roundtrips XLSX with numeric totals and numeric currency cells', async () => {
    const buffer = await createOrderWorkbook(order).xlsx.writeBuffer(),
      book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    const sheet = book.worksheets[0];
    expect(sheet.getCell('C8').value).toBe(3);
    expect(sheet.getCell('H8').value).toBe(300000);
    expect(sheet.getCell('B11').value).toBe(5);
    expect(sheet.getCell('B12').value).toBe(660000);
    expect(sheet.getCell('B13').value).toBe(550000);
    expect(sheet.getCell('B14').value).toBe(50000);
    expect(sheet.getCell('B15').value).toBe(500000);
    expect(sheet.getCell('B16').value).toBe(160000);
    expect(sheet.getCell('B15').numFmt).toContain('Rp');
  });
  it('invoice export shows product class/SKU type and discount amounts without customer subtotal or negative zero', async () => {
    const invoice = {
      ...order,
      number: 'INV-1',
      dueDate: '2026-09-30',
      discount: '100000',
      paid: '0',
      items: [{ ...order.items[0], product_type: 'Gel Polish', sku_type: 'Base Coat', sku: '' }],
    };
    const blob = await pdf(<OrderDocument order={invoice} />).toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const task = getDocument({ data: bytes, useSystemFonts: true });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(text).toContain('Product Class');
    expect(text).toContain('Diskon Produk');
    expect(text).toContain('Total');
    expect(text).not.toContain('Subtotal Customer');
    expect(text).not.toContain('- Rp');
    await task.destroy();
  });
  it('generates a valid PDF whose text includes all acceptance totals', async () => {
    const blob = await pdf(<OrderDocument order={order} />).toBlob();
    expect(blob.size).toBeGreaterThan(1500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const task = getDocument({ data: bytes, useSystemFonts: true });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    for (const value of ['660.000', '550.000', '50.000', '500.000', '160.000'])
      expect(text).toContain(value);
    await task.destroy();
  });
});
