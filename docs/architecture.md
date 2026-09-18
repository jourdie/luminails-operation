# Architecture

Luminails Operation is a modular React SPA backed by Supabase/PostgreSQL. The UI is Bahasa Indonesia; identifiers and source code are English. It is a single application, not a microservice system.

## Boundaries

- `src/features`: operational screens, organized by business domain.
- `src/components`: shared forms, tables, layout, charts, and shadcn-style Radix primitives.
- `src/lib/supabase`: public Supabase client, read/RPC gateway, isolated development adapter.
- `src/lib/money.ts`: Decimal-based customer totals; no supplier costs enter customer discount calculations.
- `src/lib/exports`: ExcelJS workbooks and React PDF documents.
- `supabase/migrations`: authoritative relational model, transactions, RLS, audit triggers, views.

TanStack Query owns remote state. React Hook Form/Zod validate input. TanStack Table handles interactive sorting/filtering/pagination. Component state is limited to pending forms, filters, and dialogs.

## Transaction rules

All authenticated table writes are revoked. Browser writes call explicitly authorized PostgreSQL functions. Every function validates the workspace and operation's module permission. Database foreign keys include workspace IDs, so valid UUIDs from another workspace cannot be attached to a transaction.

Posting acquires `FOR UPDATE` on the workspace row, then reads and writes the ledgers in one database transaction. This deliberately serializes financial/stock posting inside each workspace. Different workspaces remain independent. It is simple and appropriate for 2–5 users; replace it with deterministic supplier/SKU/location locks only after contention is measured.

Drafts can be edited or cancelled. Posting resolves cost snapshots and creates the necessary ledger entries. Posting twice fails. Reversal appends opposite stock/deposit movements and changes the source's status. The original entries remain. A reversed deposit entry remains part of the ledger sum together with its reversal; excluding both the original and including its opposite would be incorrect.

## Inventory valuation

Local costing uses a moving weighted average for each SKU/location:

```
quantity = SUM(qty_delta)
remaining_value = SUM(qty_delta × unit_cost)
average_cost = remaining_value / quantity
```

Incoming receipts add quantity at the purchase's immutable cost snapshot. Outgoing movements store the current weighted average, rounded to six decimal places in PostgreSQL. When stock is zero, the displayed average and value are zero; tiny rounding residue is below the six-place valuation precision. Local outgoing inventory cannot exceed available stock.

Example: 24 units at Rp8,000 plus 24 at Rp12,000 gives 48 units at Rp10,000. Issuing four units stores Rp10,000 each and leaves 44 at the same average.

Costing follows **posting order**. Backdating an operational date does not replay historical stock valuations. Supplier cost lookup uses the order date and latest effective version. A new supplier cost never rewrites posted snapshots. A receipt reversal is blocked when later movements exist for the same SKU/location, avoiding invalid historical valuation; use a reviewed adjustment in that case.

## Procurement and mixed fulfillment

Procurement posting deducts the supplier deposit but adds no warehouse stock. `receive_procurement_order` adds stock for warehouse items exactly once. Supplier/customer destinations never add local stock.

Each sales item can have local and supplier allocations. Before posting, allocation quantities must equal item quantity. Local allocations consume weighted-average inventory. Supplier allocations create a linked procurement and deduct the supplier deposit at supplier cost. Frontend code never submits a supplier cost through the sales editor.

## Reconciliation and imports

CSV/XLSX processing is a configurable mapping layer. Required marketplace order and item identifiers are explicit. File upload only changes local preview state. Confirmation saves a private import source and row preview, then creates draft orders atomically. Only a separate post changes operational ledgers.

Unique `(workspace_id, channel, external_order_number)` and `(sales_order_id, external_item_id)` prevent duplicate orders/items. A repeated existing order is skipped as a whole; late additions to an existing external order are not silently merged. Files contain at most 5,000 rows/10 MB. CSV values must use plain integer IDR and dates in ISO format; unsupported formats must be mapped/normalized before import.

Candidates use external order identity or nearby dates/SKU. They are never silently linked. Posting also blocks an ambiguous matching manual purchase without an external ID. An operator must confirm the match or explicitly mark it as a different transaction, with an audit record. Confirmation checks supplier, SKU, destination, and allocation quantity against the posted procurement item. Existing manual purchases then supply the snapshot without another deposit deduction. Reversing a reconciled sale leaves the original manual procurement posted and releases the active allocation reservation; a corrected sale can reconcile it again. Historical links remain auditable.

## Invoices and finance

Invoices snapshot customer, branch address, product identity, unit prices, and workspace payment settings. Their payable state is derived from payments and due date (`v_customer_receivables`); it is not a second editable balance. Partial payment and overpayment checks are atomic. Payments must be reversed before voiding an invoice.

Business Position uses latest dated account snapshots plus ledger-derived deposits, inventory, and receivables, minus liability snapshots. It is not profit. Account snapshots are periodic statements: recording a payment/expense does **not** increment/decrement a snapshot. Enter the next actual bank statement balance to refresh that asset.

P&L uses posted sales, item discounts, order discounts, fulfillment COGS, known marketplace fees, and expenses. Missing Shopee fees are explicitly flagged. Ads are included only if recorded as expenses. There is no invented fee estimate.

## Precision and time

PostgreSQL money uses `numeric`; IDR sales unit prices and discounts are whole rupiah. Customer totals use Decimal/BigInt validation in TypeScript. Sales totals are bounded to 15 digits for safe numeric Excel export. FX input remains decimal strings through the gateway and is converted by PostgreSQL `numeric(24,8)`; never parse FX form input with `parseFloat`. Chart coordinates and formatted display use numbers after calculation. Original high-precision FX fields in generic exports remain text when numeric Excel precision would be insufficient.

Use Asia/Jakarta as the operational browser timezone. Dates are `date`; timestamps are `timestamptz`. PostgreSQL `current_date` controls forecasts and invoice numbering; set the database role timezone to Asia/Jakarta for deployment consistency.

## Development database

Without credentials, `npm run dev` starts a clearly marked local mode. PGlite runs the same migration SQL in PostgreSQL WASM with an isolated auth/storage schema fixture. Every local read and RPC runs as the `authenticated` database role with a fake owner identity. Data persists in IndexedDB and is never uploaded. This is a development facility, not a multiuser or production backend.

Production builds fail closed without Supabase variables. A developer may explicitly opt into local mode in a preview build using `VITE_ENABLE_LOCAL_DATABASE=true`. Never enable that flag in production. The local migration runner records applied files; edits to already-applied migrations require a fresh development database. Add new migration files after deployment.

## Scale and current scope

Database indexes support workspace, dates, customers, suppliers, and SKU/location ledger reads. Reads page through Supabase's 1,000-row API limit so tables/reports do not silently truncate. Initial UI tables load the selected dataset and paginate client-side. Before substantially larger data volumes, move report aggregation and table filtering/paging to purpose-specific RPCs; live multi-page exports do not provide a repeatable-read snapshot.

The repository is an initial operational implementation, not a completed accounting suite. See `delivery-status.md` for shipped scope and remaining integration work.

Official references: [Supabase RLS and security-invoker views](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Vite runtime requirements](https://vite.dev/guide/).
