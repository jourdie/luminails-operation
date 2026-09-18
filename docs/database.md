# Database and migration guide

Apply migrations in timestamp order with Supabase CLI; do not paste the schema into frontend code.

| Migration                                | Responsibility                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `202609150001_core.sql`                  | Workspace, allowlist, permissions, audit helpers                                    |
| `202609150002_masters.sql`               | Brands, products, SKUs, suppliers, cost versions, locations, customers, branches    |
| `202609150003_ledgers_procurement.sql`   | Supplier deposits, stock ledger, procurement                                        |
| `202609150004_sales_invoices.sql`        | Unified orders, adjustments, allocations, invoice snapshots                         |
| `202609150005_import_finance.sql`        | Imports, reconciliation, accounts, snapshots, payments, expenses                    |
| `202609150006_posting.sql`               | Atomic posting, receipt, adjustments, reversals                                     |
| `202609150007_workflows.sql`             | Master writes, invoice/payment workflows, owner access management                   |
| `202609150008_imports.sql`               | Preview persistence and idempotent draft import                                     |
| `202609150009_views.sql`                 | Inventory, deposits, forecasts, receivables, P&L, business position                 |
| `202609150010_security.sql`              | RLS, RPC-only writes, audit triggers, indexes                                       |
| `202609150011_storage.sql`               | Private import/invoice/attachment buckets and policies                              |
| `202609150012_operational_guards.sql`    | Address ownership, shipment/draft maintenance, snapshot correction, SKU performance |
| `202609160013_reconciliation_review.sql` | Ambiguous-match review, reference-data access, decimal-safe FX API views            |

`seed.sql` is explicitly development-only. It creates Luminails, PARTY/Bluesky, nine example SKUs, test deposits, stock, customers/branches, and financial snapshots. It does not create real user credentials or automatically grant production access.

## Core RPC contract

All workspace calls take `w uuid`. Creation/update functions accept a JSON `payload`; state transitions accept `record_id uuid`. Never pass a service role key to the SPA.

- `save_master`: allowlisted fields/entities only; edits require `record_id` and module edit permission.
- `change_supplier_cost`: append a dated cost version.
- `save_sales_order`: create/edit draft and replace items/allocations/adjustments atomically.
- `save_procurement_order`, `update_procurement_draft`, `mark_procurement_shipped`.
- `post_procurement_order`, `receive_procurement_order`, `reverse_procurement_order`.
- `post_sales_order`, `reverse_sales_order`, `cancel_draft`.
- `post_stock_adjustment`, `post_supplier_deposit_topup`, `reverse_supplier_deposit_entry`.
- `confirm_reconciliation`: explicitly confirm a compatible purchase/allocation pair.
- `reject_reconciliation`: explicitly record that an ambiguous candidate is a different transaction.
- `issue_invoice`, `record_payment`, `void_invoice`.
- `record_finance`, `reverse_finance`, `correct_financial_snapshot`, `open_receivable`.
- `save_import_preview`, `commit_import`.
- `manage_member`, `claim_memberships`, `save_workspace`.

Sales payload:

```json
{
  "order_date": "2026-09-15",
  "channel": "WHATSAPP",
  "discount": 50000,
  "items": [
    {
      "sku_id": "<workspace-sku-uuid>",
      "qty": 3,
      "normal_unit_price": 120000,
      "selling_unit_price": 100000,
      "allocations": [
        {
          "fulfillment_type": "LOCAL_STOCK",
          "inventory_location_id": "<workspace-location-uuid>",
          "qty": 3
        }
      ]
    }
  ]
}
```

## Security and operational invariants

All business tables have RLS. Views use `security_invoker=true`. Internal helpers live in the unexposed `private` schema; executable public functions have explicit permission checks and fixed search paths. An authenticated SQL/API caller cannot insert, update, or delete ledger rows or permissions directly. Audit triggers record before/after state for every business table change.

Composite foreign keys protect tenant integrity even inside owner RPCs. Unique active procurement allocations prevent two sales from consuming the same manual supplier purchase. Historical inactive allocations and reconciliation links survive reversal.

## Test boundaries

`npm test` applies all migrations to a fresh PGlite PostgreSQL database with fixtures for Supabase-owned auth/storage objects. This executes SQL, constraints, RLS, views, and RPCs; it is not a mocked ledger test. A real Supabase smoke test is still required for OAuth, PostgREST, signed/private object retrieval, and database backup/restore policies.
