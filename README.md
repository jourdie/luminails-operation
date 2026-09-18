# Luminails Operation

Internal operating system for Luminails: ledger-based inventory and supplier deposits, unified sales, Shopee import/reconciliation, B2B/reseller customers, invoices, receivables, finance, and reporting.

**No editable stock/deposit balances.** PostgreSQL RPCs post transactions atomically, preserve historical costs, enforce workspace permissions, and maintain an audit trail.

## Start locally

Requires Node.js **22.13+** and npm.

```sh
npm ci
npm run start
```

Perintah ini membuka browser otomatis ke **http://127.0.0.1:5173**. Jika tidak otomatis, buka URL tersebut manual. Untuk mode tanpa membuka browser gunakan `npm run dev`. Without Supabase variables, development mode uses isolated PostgreSQL/PGlite with an empty workspace persisted in your browser. Add your own brands, suppliers, products, and opening balances before testing. Automated tests use a separate fixture seed.

Jika ingin menghapus data yang sudah telanjur tersimpan di browser, buka menu **Pengaturan** lalu pilih **Cleansing data browser**. Fitur ini hanya tersedia pada mode lokal dan akan menghapus seluruh data operasional browser setelah konfirmasi; workspace dan akun akses dibuat kembali kosong.

Data master dapat dihapus melalui tombol **Hapus** pada masing-masing tabel. Relasi supplier/HPP dan alamat turunan yang belum dipakai akan ikut dibersihkan; data yang sudah terhubung ke transaksi, stok, atau ledger akan ditolak agar riwayat tetap aman. Gunakan pembatalan, pembalikan, atau void untuk transaksi.

On Windows, if Node is installed in `C:\Program Files\nodejs` but missing from PATH, run `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1`. The script adds Node to the current process PATH and starts Vite.

## Connect Supabase

Copy `.env.example` to `.env` and set:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The key must be a **public anon/publishable key**, never a service role key. `VITE_SUPABASE_PUBLISHABLE_KEY` is also supported. Keep `VITE_ENABLE_LOCAL_DATABASE=false` for production. Production fails closed without configuration.

```sh
npx supabase start
npx supabase db reset
```

These commands require Docker and apply the local migrations/seed. Hosted setup uses `npx supabase link --project-ref YOUR_PROJECT_REF` and `npx supabase db push`; **do not seed production**. Configure Google OAuth and bootstrap the verified first owner as described in [deployment.md](docs/deployment.md). Google sign-in alone never grants access.

## Commands

```sh
npm run typecheck
npm test
npm run build
npm run preview
npm run test:browser
```

The browser test needs the dev server on port 5173 and Playwright Chromium (`npx playwright install chromium`). Artifacts go to ignored `.local/screenshots/`.

## Stack

React, strict TypeScript, Vite, React Router, Tailwind CSS, shadcn-style Radix UI, Lucide, React Hook Form, Zod, Supabase JS, TanStack Query/Table, Recharts, date-fns, Decimal.js, ExcelJS, React PDF. Vitest, React Testing Library, and Playwright provide validation.

## Documentation

- [Architecture and costing](docs/architecture.md)
- [Database, migrations, and RPCs](docs/database.md)
- [Permission model](docs/permissions.md)
- [Supabase, Google OAuth, seed, and Netlify setup](docs/deployment.md)
- [Delivered scope and explicit remaining work](docs/delivery-status.md)
- [Automated and browser verification](docs/verification.md)

Netlify uses `npm run build`, output `dist`, with SPA redirects in `netlify.toml`. **Nothing has been deployed.**



