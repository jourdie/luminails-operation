import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  normalizeImportDate,
  normalizeImportNumber,
  suggestMapping,
  validateImport,
  groupImport,
} from '../src/features/shopee/import';
describe('Configurable marketplace import', () => {
  it('normalizes Indonesian, ISO, and Excel serial transaction dates and prices', () => {
    expect(normalizeImportDate('18/09/2026 10:30')).toBe('2026-09-18');
    expect(normalizeImportDate('2026-09-18T10:30:00')).toBe('2026-09-18');
    expect(normalizeImportDate('45918')).toBe('2025-09-18');
    expect(normalizeImportDate('tanggal tidak valid')).toBe('');
    expect(normalizeImportNumber('80.000')).toBe(80000);
    expect(normalizeImportNumber('1.400.000')).toBe(1400000);
  });
  it('parses quoted delimiters, newlines, BOM-safe data, and escaped quotes', () => {
    expect(parseCsv('a,b\r\n"one,two","three\nline"\r\n"say ""hi""",ok')).toEqual([
      ['a', 'b'],
      ['one,two', 'three\nline'],
      ['say "hi"', 'ok'],
    ]);
  });
  it('classifies duplicates, unmapped SKUs, and invalid values', () => {
    const mapping = suggestMapping([
      'Order ID',
      'Item ID',
      'SKU',
      'Quantity',
      'Price',
      'Order Date',
    ]);
    const raw = {
      'Order ID': 'A',
      'Item ID': 'I',
      SKU: 'LUM-001',
      Quantity: '3',
      Price: '100000',
      'Order Date': '2026-09-15',
    };
    const skus = [{ id: 'internal', sku_code: 'LUM-001' }];
    const rows = validateImport([raw], mapping, skus, new Set(), {});
    expect(rows[0].status).toBe('NEW');
    expect(
      groupImport(rows, { type: 'LOCAL_STOCK', reference: 'location' })[0].items[0].allocations[0]
        .qty,
    ).toBe(3);
    expect(validateImport([raw], mapping, skus, new Set(['A']), {})[0].status).toBe('DUPLICATE');
    expect(validateImport([raw], mapping, [], new Set(), {})[0].status).toBe('UNMAPPED');
    expect(
      validateImport([{ ...raw, Quantity: '-2' }], mapping, skus, new Set(), {})[0].status,
    ).toBe('ERROR');
    expect(validateImport([raw, raw], mapping, skus, new Set(), {})[1].status).toBe('ERROR');
  });
});
