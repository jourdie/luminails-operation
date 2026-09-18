import ExcelJS from 'exceljs';
import type { Column } from '../../components/tables/DataTable';
import type { Row } from '../../types/domain';
import { orderTotals } from '../money';
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export interface ExportOrder {
  number: string;
  date: string;
  customer: string;
  address?: string;
  dueDate?: string;
  paid?: string;
  paymentInfo?: string;
  notes?: string;
  items: {
    sku: string;
    name: string;
    product_type?: string;
    sku_type?: string;
    qty: number;
    normal_unit_price: number;
    selling_unit_price: number;
    description?: string;
  }[];
  discount: string;
}
const currency = '"Rp "#,##0;[Red]("Rp "#,##0)';
function style(sheet: ExcelJS.Worksheet, headerRow: number) {
  sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  sheet.getRow(headerRow).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103E38' } };
  });
  sheet.columns.forEach((c) => (c.width = 22));
  sheet.getColumn(2).width = 32;
  sheet.getRow(1).font = { size: 20, bold: true, color: { argb: 'FF103E38' } };
}
export function createOrderWorkbook(order: ExportOrder) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Luminails';
  const sheet = book.addWorksheet('Luminails Order');
  sheet.addRow(['Luminails Order']);
  sheet.addRow(['Nomor', order.number]);
  sheet.addRow(['Tanggal', order.date]);
  sheet.addRow(['Pelanggan', order.customer]);
  sheet.addRow(['Alamat', order.address ?? '']);
  sheet.addRow([]);
  sheet.addRow([
    ...(order.dueDate ? ['Product Class', 'SKU Type', 'Product'] : ['SKU', 'Product']),
    'Qty',
    'Normal Price',
    'Discount Price',
    'Description',
    'Normal Total',
    'Customer Total',
  ]);
  for (const item of order.items) {
    const row = sheet.addRow([
      ...(order.dueDate
        ? [item.product_type ?? '', item.sku_type ?? '', item.name]
        : [item.sku, item.name]),
      item.qty,
      item.normal_unit_price,
      item.selling_unit_price,
      item.description ?? '',
      item.qty * item.normal_unit_price,
      item.qty * item.selling_unit_price,
    ]);
    [4, 5, 7, 8].forEach((i) => (row.getCell(i).numFmt = currency));
  }
  const t = orderTotals(order.items, order.discount);
  sheet.addRow([]);
  for (const [label, value] of [
    ['Total Barang', t.units],
    ['Subtotal Normal', t.normal],
    ...(order.dueDate
      ? [
          ['Diskon Produk', Number(t.normal) - Number(t.selling)],
          ['Diskon Tambahan', t.discount],
          ['Total', t.grand],
        ]
      : [
          ['Subtotal Customer', t.selling],
          ['Fixed Discount', t.discount],
          ['Grand Total', t.grand],
          ['Total Saving', t.savings],
        ]),
  ]) {
    const row = sheet.addRow([label, Number(value)]);
    if (label !== 'Total Barang') row.getCell(2).numFmt = currency;
    if (label === 'Grand Total') row.font = { bold: true };
  }
  if (order.dueDate) {
    sheet.addRow(['Jatuh tempo', order.dueDate]);
    sheet.addRow(['Dibayar', Number(order.paid ?? 0)]).getCell(2).numFmt = currency;
    sheet.addRow(['Sisa tagihan', Number(t.grand) - Number(order.paid ?? 0)]).getCell(2).numFmt =
      currency;
  }
  style(sheet, 7);
  return book;
}
export async function exportOrderExcel(order: ExportOrder) {
  const buffer = await createOrderWorkbook(order).xlsx.writeBuffer();
  download(
    new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${order.number}.xlsx`,
  );
}
export async function exportTable(title: string, columns: Column[], rows: Row[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Laporan');
  sheet.addRow([title]);
  sheet.addRow(['Diekspor', new Date().toISOString()]);
  sheet.addRow(columns.map((c) => c.label));
  for (const row of rows)
    sheet.addRow(
      columns.map((c) => {
        const v = row[c.key];
        if (c.key === 'amount_original_currency' || c.key === 'exchange_rate')
          return String(v ?? '');
        if (
          /amount|cost|total|balance|paid|outstanding|profit|revenue|spend|qty|stock|value|price/.test(
            c.key,
          ) &&
          v != null &&
          Number.isFinite(Number(v))
        )
          return Number(v);
        return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
      }),
    );
  style(sheet, 3);
  columns.forEach((c, i) => {
    if (/amount|cost|total|balance|paid|outstanding|profit|revenue|spend|value|price/.test(c.key))
      sheet.getColumn(i + 1).numFmt = currency;
  });
  const buffer = await book.xlsx.writeBuffer();
  download(new Blob([buffer as BlobPart]), `${title}.xlsx`);
}
export function exportCsv(title: string, columns: Column[], rows: Row[]) {
  const escape = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  download(
    new Blob(
      [
        '\uFEFF' +
          [
            columns.map((c) => escape(c.label)).join(','),
            ...rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')),
          ].join('\r\n'),
      ],
      { type: 'text/csv;charset=utf-8;' },
    ),
    `${title}.csv`,
  );
}
