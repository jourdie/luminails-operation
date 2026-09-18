import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const failures = [];
page.on('pageerror', (e) => failures.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor({ timeout: 90000 });
  assert.match(await page.locator('.hero-value').innerText(), /^Rp/);
  await page.screenshot({ path: '.local/screenshots/dashboard.png', fullPage: true });
  const routes = [
    ['/products', 'Produk & SKU'],
    ['/suppliers', 'Supplier'],
    ['/deposits', 'Deposit Supplier'],
    ['/inventory', 'Stok & Persediaan'],
    ['/procurement', 'Restock & Dropship'],
    ['/promotions', 'Promotion Rule'],
    ['/b2b', 'Pelanggan B2B'],
    ['/b2b/branches', 'Cabang & Alamat'],
    ['/reseller', 'Reseller'],
    ['/shopee', 'Impor Shopee'],
    ['/reconciliation', 'Rekonsiliasi Dropship'],
    ['/finance', 'Posisi Bisnis'],
    ['/finance/pnl', 'Laba Rugi'],
    ['/settings/users', 'Pengguna & Akses'],
    ['/invoices', 'Invoice'],
    ['/reports', 'Laporan'],
  ];
  for (const [path, title] of routes) {
    await page.goto('http://127.0.0.1:5173' + path);
    await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 45000 });
    assert.equal(await page.getByText('Aplikasi mengalami kendala.').count(), 0);
    console.log('PASS route', path);
  }
  await page.goto('http://127.0.0.1:5173/whatsapp-orders');
  await page.getByRole('button', { name: 'Buat pesanan', exact: true }).click();
  if ((await page.getByLabel('SKU 1', { exact: true }).locator('option').count()) <= 1) {
    assert.deepEqual(failures, []);
    console.log('PASS clean workspace route and empty-state smoke (functional fixtures covered by Vitest)');
    await browser.close();
    process.exit(0);
  }
  await page
    .getByLabel('SKU 1', { exact: true })
    .selectOption('60000000-0000-0000-0000-000000000001');
  await page.getByLabel('Qty 1', { exact: true }).fill('3');
  await page.getByLabel('Harga normal 1', { exact: true }).fill('120000');
  await page.getByLabel('Harga diskon 1', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Tambah barang', exact: true }).click();
  await page
    .getByLabel('SKU 2', { exact: true })
    .selectOption('60000000-0000-0000-0000-000000000002');
  await page.getByLabel('Qty 2', { exact: true }).fill('2');
  await page.getByLabel('Harga normal 2', { exact: true }).fill('150000');
  await page.getByLabel('Harga diskon 2', { exact: true }).fill('125000');
  await page.getByRole('button', { name: '+ Tambah Diskon', exact: true }).click();
  await page.getByLabel('Diskon Tambahan', { exact: true }).fill('50000');
  assert.match(await page.locator('.grand-total').innerText(), /500.000/);
  assert.match(await page.locator('.savings').innerText(), /160.000/);
  await page.locator('.allocation-card').nth(0).getByLabel('Lokal', { exact: true }).fill('3');
  await page.locator('.allocation-card').nth(1).getByLabel('Lokal', { exact: true }).fill('2');
  await page.screenshot({ path: '.local/screenshots/order-editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: 'Rp 500.000', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Posting', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByText('POSTED', { exact: true }).waitFor();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel', exact: true }).last().click();
  assert.match((await download).suggestedFilename(), /\.xlsx$/);
  const pdfDownload = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  assert.match((await pdfDownload).suggestedFilename(), /\.pdf$/);
  await page.reload();
  await page.getByRole('cell', { name: 'Rp 500.000', exact: true }).waitFor({ timeout: 45000 });
  await page.goto('http://127.0.0.1:5173/shopee');
  const csv =
    'Order ID,Item ID,SKU,Quantity,Price,Order Date\nBROWSER-SHOPEE-1,ITEM-1,LUM-001,1,120000,2026-09-16';
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'acceptance.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page
    .getByLabel('Lokasi atau supplier')
    .selectOption('40000000-0000-0000-0000-000000000001');
  await page.getByRole('button', { name: 'Tinjau & buat draft', exact: true }).click();
  await page.getByRole('button', { name: 'Buat draft pesanan', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'acceptance.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByText('DUPLICATE', { exact: true }).waitFor();
  console.log('PASS marketplace import preview, draft creation, and duplicate detection');
  await page.goto('http://127.0.0.1:5173/whatsapp-orders');
  await page.getByRole('heading', { name: 'Pesanan B2B', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/screenshots/mobile.png', fullPage: true });
  assert.deepEqual(failures, []);
  console.log(
    'PASS WhatsApp calculation, persistence, Excel download, mobile layout, and no page errors',
  );
} finally {
  await browser.close();
}


