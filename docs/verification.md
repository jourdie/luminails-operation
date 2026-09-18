# Verification

## New supplier/template flow

The focused browser flow is available as `npm run test:browser:supplier`; `Promotion Rule` is included in the route smoke test. Upload validation accepts DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, and localized IDR separators. It covers free catalog fields, grouped IDR inputs, manual invoice before B2B supplier order, automatic reconciliation, supplier/customer payment flags, Shopee XLSX preview, cancellation and duplicate handling, address snapshot, and restock.

The local implementation has these repeatable checks:

```sh
npm run typecheck
npm test
npm run build
```

The automated suite has 48 tests across 10 files:

- 28 PostgreSQL tests execute the migrations, RLS, ledger posting/reversal, cost versions, mixed fulfillment, receipts, reconciliation/review, idempotent imports, invoice snapshots, payments, FX precision, and audit behavior.
- Five calculation/export tests validate Decimal arithmetic, the WhatsApp acceptance totals, numeric Excel cells, and text extracted from generated PDF output.
- Two import tests cover quoted CSV input, configurable mapping, invalid rows, and duplicate identities.
- Two permission helper tests cover owner/member/inactive behavior.
- One React table test validates search results.
- Catalog/reseller/promotion tests cover Brand/Product/Product Set import, retail/HPP, tiered pricing, overlap alerts, and single/multi-branch address behavior.
- One React Router test visits `/finance` as an inventory-only member and checks both route denial and hidden Finance navigation.

With Vite running, `npm run test:browser` uses a fresh Chromium context to visit the main routes and verify the empty workspace state. Functional posting/import/reversal coverage runs in the PostgreSQL/PGlite suite; reseller and supplier browser flows are separate scripts. Local screenshots are ignored under `.local/screenshots/`.

These checks do not substitute for testing the configured Supabase project. OAuth redirects, a real PostgREST session, private Storage behavior, backup/restore, and multiple concurrent remote clients still need integration verification after credentials are supplied. The database tests run PostgreSQL in PGlite with Supabase auth/storage fixtures.



