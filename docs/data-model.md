# Database schema plan

## Phase 1 entities

| Entity | Purpose | Key boundary |
| --- | --- | --- |
| workspaces | Tenant root | Every business row is workspace scoped |
| profiles | User display data | Linked to auth.users |
| workspace_members | Active access membership | Inactive members cannot query workspace data |
| member_permissions | Module actions | Checked by UI and RLS |
| audit_logs | Critical history | Append-only through policy and server functions |

## Planned business entities

Products, SKUs, channel SKUs, suppliers, supplier cost versions, inventory locations, inventory movements, supplier deposit movements, restocks, sales orders, sales order items, fulfillment allocations, import batches, import rows, reconciliation records, customers, B2B invoices, payments, financial accounts, expenses, liabilities, and settlement imports.

## Invariants

- Every operational row has a workspace ID and foreign keys to its parent records.
- Amounts use PostgreSQL `numeric`, never floating point.
- Quantities and costs are non-negative where applicable.
- Posted data is immutable and corrected with a reversal.
- External order, item, settlement, and webhook identities are unique within their source scope.
- Ledger balances are derived from movements or controlled snapshots, not direct edits.

## Phase 1 RLS model

`is_active_workspace_member(workspace_id)` gates read access. `has_workspace_permission(workspace_id, module, action)` gates sensitive module access. Both are `SECURITY DEFINER` SQL functions with a locked search path and are used in table policies.

## Later reporting views

`v_inventory_balance`, `v_inventory_value`, `v_supplier_deposit_balance`, `v_supplier_usage_daily`, `v_customer_receivables`, `v_sales_profit`, `v_low_stock`, `v_supplier_runway`, and `v_business_position` will be added only with query patterns and indexes reviewed.
