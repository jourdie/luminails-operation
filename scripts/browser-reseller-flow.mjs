import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const b = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const p = await b.newPage();
try {
  await p.goto('http://127.0.0.1:5173/reseller');
  await p.getByRole('heading', { name: 'Reseller', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Tambah data', exact: true }).click();
  await p.getByLabel('Nama pelanggan').fill('E2E Single Reseller');
  await p.getByLabel('Nama penerima / PIC alamat utama').fill('PIC Single');
  await p.getByLabel('Alamat utama (wajib jika tanpa multi cabang)').fill('Jalan Single');
  await p.getByLabel('Kota').fill('Jakarta');
  await p.getByLabel('Provinsi').fill('DKI');
  await p.getByRole('dialog').getByRole('button', { name: 'Simpan', exact: true }).click();
  await p.getByRole('dialog').waitFor({ state: 'hidden' });
  await p.getByRole('cell', { name: 'E2E Single Reseller', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Tambah data', exact: true }).click();
  await p.getByLabel('Nama pelanggan').fill('E2E Multi Reseller');
  await p.getByLabel('Memiliki multi cabang').check();
  await p.getByRole('dialog').getByRole('button', { name: 'Simpan', exact: true }).click();
  await p.getByRole('dialog').waitFor({ state: 'hidden' });
  await p.getByRole('cell', { name: 'E2E Multi Reseller', exact: true }).waitFor();
  assert.equal(await p.getByText('Aplikasi mengalami kendala.').count(), 0);
  console.log('PASS reseller single-address and multi-branch flow');
} finally {
  await b.close();
}
