# Initial delivery status

## Implemented

### Perubahan lanjutan: Produk, Shopee, supplier, reseller, dan invoice

- Reseller memiliki flag multi cabang. Reseller tanpa multi cabang menyimpan alamat utama dan otomatis membuat alamat default; reseller multi cabang mengelola alamat melalui modul Cabang.
- Invoice menampilkan Product Class, SKU Type, harga normal, diskon produk, diskon tambahan, dan total. Kode SKU Shopee tidak dicetak.
- Master SKU dapat mengunduh dan mengunggah template resmi dengan harga retail normal, HPP, class, SKU type, varian, dan status aktif.

### Perubahan lanjutan: Produk, Shopee, dan supplier

- Produk & SKU memiliki katalog bebas dengan kolom `SKU Induk`, `Nomor Referensi SKU`, Brand, Product, Product Set, tipe SKU Shopee, harga retail normal, dan HPP per supplier (tanggal efektif diisi sistem). Preview katalog dapat dibuat dari kolom produk/varian pada template Shopee; HPP tidak ditebak dari harga jual.
- Form angka mulai kosong dan menampilkan pemisah ribuan Indonesia saat diketik (`80.000`), sementara nilai yang dikirim tetap numerik. Nilai nol hanya muncul sebagai placeholder.
- Restock & Dropship dimulai dengan supplier, tipe `Dropship ecommerce`, `Dropship B2B`, atau `Restock`, serta tanggal pesanan.
- Dropship ecommerce membaca template Shopee XLSX/CSV, memvalidasi kolom, mata uang bertitik, SKU kosong, status batal/retur, resi, duplikat, dan HPP sebelum membuat draft supplier.
- Modul penjualan manual sekarang bernama B2B; Dropship B2B mengambil invoice aktif dari modul B2B. Item dan alamat invoice ditautkan otomatis; pengguna tidak mengetik ulang. Pesanan manual menampilkan status rekonsiliasi, pembayaran supplier, dan pembayaran pelanggan secara terpisah.
- Posting supplier tertaut memotong deposit dan memposting penjualan satu kali dalam transaksi atomik. Draft sumber terkunci, invoice yang sama tidak dapat dipakai dua kali, dan pembalikan mengembalikan ledger.

### Perubahan lanjutan: Produk, Shopee, dan supplier

- Produk & SKU memiliki katalog bebas dengan kolom `SKU Induk`, `Nomor Referensi SKU`, Brand, Product, Product Set, tipe SKU Shopee, harga retail normal, dan HPP per supplier (tanggal efektif diisi sistem). Preview katalog dapat dibuat dari kolom produk/varian pada template Shopee; HPP tidak ditebak dari harga jual.
- Form angka mulai kosong dan menampilkan pemisah ribuan Indonesia saat diketik (`80.000`), sementara nilai yang dikirim tetap numerik. Nilai nol hanya muncul sebagai placeholder.
- Restock & Dropship dimulai dengan supplier, tipe `Dropship ecommerce`, `Dropship B2B`, atau `Restock`, serta tanggal pesanan.
- Dropship ecommerce membaca template Shopee XLSX/CSV, memvalidasi kolom, mata uang bertitik, SKU kosong, status batal/retur, resi, duplikat, dan HPP sebelum membuat draft supplier.
- Modul penjualan manual sekarang bernama B2B; Dropship B2B mengambil invoice aktif dari modul B2B. Item dan alamat invoice ditautkan otomatis; pengguna tidak mengetik ulang. Pesanan manual menampilkan status rekonsiliasi, pembayaran supplier, dan pembayaran pelanggan secara terpisah.
- Posting supplier tertaut memotong deposit dan memposting penjualan satu kali dalam transaksi atomik. Draft sumber terkunci, invoice yang sama tidak dapat dipakai dua kali, dan pembalikan mengembalikan ledger.

- React/TypeScript/Vite app, responsive Indonesian operations UI, shared tables/forms, guarded routes, Google OAuth/allowlist integration.
- Supabase migrations, per-workspace composite foreign keys, RLS, RPC-only writes, audit trail, private storage policies.
- Product/SKU/brand/supplier maintenance and append-only supplier cost versions.
- Deposit ledger, forecast, opening entries, topups, adjustments, reversals.
- Procurement draft creation, atomic posting, warehouse receipt, reversal; shipment and draft editing RPCs.
- Inventory ledger, weighted-average costing, low-stock/velocity views, adjustment UI.
- Stock adjustment import/export uses the SKU master template columns, previews multiple rows, posts atomically to an automatic default warehouse, and filters by brand, product, and product type.
- Unified sales engine, B2B/reseller/Shopee orders, Promotion Rule tier pricing and bonus items, editable item tables, nominal fixed discount, mixed fulfillment, posting and reversal.
- Customer PDF/print and numeric Excel export; invoice snapshots, partial payments, overpayment prevention, receivables, payment/expense reversal.
- Configurable CSV/XLSX import preview, column/SKU mapping, duplicate protection, private source upload, draft-only commitment, confirmed reconciliation.
- B2B customers/branches and reseller customers/orders/profit trends.
- Finance account/snapshot/expense screens, current Business Position, period P&L with missing-fee notices, transparent health formulas.
- Dashboard, report selection/date filters, Excel/CSV reports, setup/opening workflows, access management, audit viewer.
- Database/domain/component/export tests and repeatable browser smoke script.

## Deliberately outside this initial delivery

- Hosted Supabase provisioning, actual OAuth credentials, external service smoke tests, Netlify deployment. No credentials were provided; no deployment was requested.
- Historical spreadsheet migration and Shopee Income Report/fee ingestion. `marketplace_fee` is nullable and P&L flags missing values.
- Email delivery for invitations, marketplace API synchronization, WhatsApp messaging, payment gateway integration.
- Automatic PDF storage/archive and attachment UI. Private buckets/policies exist; current invoice/order PDFs download locally.
- Partial receiving, shipment tracking API, returns referencing individual sales, automated bank reconciliation, double-entry general ledger, tax/e-invoice features.
- Credit limit enforcement (the field is stored for reference), automatic dunning, configurable financial-health thresholds.
- High-volume server-side report aggregation, background import jobs, repeatable-read export snapshots, or a replica/read model. The database model supports growth; the current client fetches paginated complete datasets.

## UI limits to account for

- Procurement supports multi-item draft editing, shipment/resi recording, full receipt, and reversal. Receiving remains all-at-once.
- Import supports bulk local or supplier allocation; split fulfillment is edited per item on the resulting drafts before posting. Existing external orders are skipped rather than merged. Monetary separators and arbitrary date formats must be normalized in the source.
- Reconciliation links one complete procurement item to one supplier allocation, with exact matching quantity. Splitting a single manual purchase item across multiple sales is not supported.
- Finance snapshots and net position represent latest available balances; historical as-of business-position reconstruction is not included. Snapshot corrections are available through the UI with confirmation and an audit trail.
- General reports export Excel/CSV; customer orders and invoices export PDF/print. Generic financial report PDF templates are not included.
- Reseller profit analytics are Finance-protected; reseller-only members can operate orders/customers without seeing full business finance.

These limits are explicit so the initial implementation can be reviewed and used within its tested scope.

