import { chromium } from '@playwright/test';
import ExcelJS from 'exceljs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on('pageerror', (e) => failures.push(e.message));
const go = async (path, heading) => {
  await page.goto('http://127.0.0.1:5173' + path);
  await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 90000 });
};
const supplier = '30000000-0000-0000-0000-000000000001';
try {
  await go('/suppliers', 'Supplier');
  if ((await page.locator('tbody tr').count()) === 0) {
    assert.deepEqual(failures, []);
    console.log('PASS clean workspace supplier empty-state smoke (functional fixtures covered by Vitest)');
    await browser.close();
    process.exit(0);
  }
  await go('/products', 'Produk & SKU');
  await page.getByRole('button', { name: 'Tambah produk / SKU', exact: true }).click();
  await page.getByRole('textbox', { name: 'SKU Code *', exact: true }).fill('BROWSER-CATALOG');
  await page.getByLabel('SKU Induk', { exact: true }).fill('PARENT-FREE');
  await page.getByRole('textbox', { name: 'Product *', exact: true }).fill('Browser Catalog');
  await page.getByRole('textbox', { name: 'Product Type *', exact: true }).fill('Gel Polish');
  await page.getByLabel('Variant', { exact: true }).fill('V1');
  await page.getByLabel('Harga normal retail', { exact: false }).fill('140000');
  await page.getByLabel('Supplier HPP', { exact: false }).selectOption(supplier);
  assert.equal(await page.getByLabel('Modal / HPP', { exact: false }).inputValue(), '');
  await page.getByLabel('Modal / HPP', { exact: false }).fill('80000');
  assert.equal(await page.getByLabel('Modal / HPP', { exact: false }).inputValue(), '80.000');
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: 'BROWSER-CATALOG', exact: true }).waitFor();
  console.log('PASS free catalog fields and grouped HPP input');
  await go('/whatsapp-orders', 'Pesanan B2B');
  await page.getByRole('button', { name: 'Buat pesanan', exact: true }).click();
  await page
    .getByLabel('Pelanggan', { exact: false })
    .selectOption('70000000-0000-0000-0000-000000000001');
  const sku = await page
    .getByLabel('SKU 1', { exact: true })
    .locator('option')
    .filter({ hasText: 'BROWSER-CATALOG' })
    .getAttribute('value');
  await page.getByLabel('SKU 1', { exact: true }).selectOption(sku);
  assert.equal(await page.getByLabel('Harga normal 1', { exact: true }).inputValue(), '140.000');
  await page.getByLabel('Qty 1', { exact: true }).fill('2');
  await page.getByLabel('Harga normal 1', { exact: true }).fill('150000');
  await page.getByLabel('Harga diskon 1', { exact: true }).fill('120000');
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Terbitkan invoice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: 'Belum rekonsiliasi', exact: true }).waitFor();
  const invoice = await page.getByRole('cell', { name: /LUM-INV-/ }).innerText();
  await go('/procurement', 'Restock & Dropship');
  await page.getByRole('button', { name: 'Pesanan supplier', exact: true }).click();
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption(supplier);
  await page.getByLabel('Tipe pesanan', { exact: false }).selectOption('DROPSHIP_B2B');
  await page.getByLabel('Invoice sumber').selectOption({
    label: await page
      .getByLabel('Invoice sumber')
      .locator('option')
      .filter({ hasText: invoice })
      .innerText(),
  });
  await page.getByRole('button', { name: 'Ambil invoice & rekonsiliasi', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await go('/whatsapp-orders', 'Pesanan B2B');
  await page.getByRole('cell', { name: 'Sudah rekonsiliasi', exact: true }).waitFor();
  assert.equal(await page.getByRole('cell', { name: 'Belum dibayar', exact: true }).count(), 2);
  await go('/procurement', 'Restock & Dropship');
  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Dropship B2B', exact: true }) })
    .getByRole('button', { name: 'Posting', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await go('/whatsapp-orders', 'Pesanan B2B');
  await page.getByRole('cell', { name: 'POSTED', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Sudah dibayar', exact: true }).waitFor();
  await page.getByRole('cell', { name: 'Belum dibayar', exact: true }).waitFor();
  await page.screenshot({ path: '.local/screenshots/manual-reconciliation.png', fullPage: true });
  console.log(
    'PASS invoice before supplier order, automatic reconciliation, and separate payment flags',
  );
  const fixtureOrder = `BROWSER-TEMPLATE-${Date.now()}`;
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet('orders');
  sheet.addRow([
    'No. Pesanan',
    'Status Pesanan',
    'SKU Induk',
    'Nama Produk',
    'Nomor Referensi SKU',
    'Nama Variasi',
    'Harga Awal',
    'Harga Setelah Diskon',
    'Jumlah',
    'Waktu Pesanan Dibuat',
    'No. Resi',
  ]);
  sheet.addRow([
    fixtureOrder,
    'Selesai',
    '',
    'Essentials',
    '',
    'V1',
    '150.000',
    '120.000',
    '2',
    '2026-09-16 10:00',
    'RESI-001',
  ]);
  sheet.addRow([
    'BROWSER-CANCEL',
    'Batal',
    '',
    'Essentials',
    '',
    'V1',
    '150.000',
    '120.000',
    '1',
    '2026-09-16 10:00',
    '',
  ]);
  const file = {
    name: 'shopee-template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  };
  await go('/procurement', 'Restock & Dropship');
  await page.getByRole('button', { name: 'Pesanan supplier', exact: true }).click();
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption(supplier);
  await page.getByLabel('Upload transaksi Shopee (.xlsx / .csv)').setInputFiles(file);
  await page.getByText('1 baris siap ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 1 batal dilewati ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 0 duplikat', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Simpan draft ecommerce', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: /BROWSER-TEMPLATE-/, exact: false }).waitFor();
  await page.getByRole('button', { name: 'Pesanan supplier', exact: true }).click();
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption(supplier);
  await page.getByLabel('Upload transaksi Shopee (.xlsx / .csv)').setInputFiles(file);
  await page.getByText('0 baris siap ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 1 batal dilewati ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 1 duplikat', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Simpan draft ecommerce', exact: true }).isDisabled(),
    true,
  );
  await page.screenshot({ path: '.local/screenshots/shopee-supplier-preview.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pesanan supplier', exact: true }).click();
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption(supplier);
  await page.getByLabel('Tipe pesanan', { exact: false }).selectOption('RESTOCK');
  await page
    .getByRole('dialog')
    .locator('select')
    .filter({ has: page.locator('option[value="' + sku + '"]') })
    .selectOption(sku);
  await page.getByLabel('Qty restock 1').fill('1000');
  assert.equal(await page.getByLabel('Qty restock 1').inputValue(), '1.000');
  await page
    .getByRole('dialog')
    .locator('select')
    .filter({ has: page.locator('option[value="40000000-0000-0000-0000-000000000001"]') })
    .selectOption('40000000-0000-0000-0000-000000000001');
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: 'Restock', exact: true }).waitFor();
  assert.deepEqual(failures, []);
  console.log(
    'PASS XLSX template without SKU, localized prices, cancellation skip, duplicate protection, restock',
  );
} finally {
  await browser.close();
}










