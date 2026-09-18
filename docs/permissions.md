# Permissions

Google OAuth proves identity; it never grants workspace access. `claim_memberships` binds an already allowlisted email to the verified Supabase Auth user ID. Inactive/uninvited users receive no workspace access.

Only an active owner can invoke `manage_member`. Granting settings access to a member does not permit owner-level invitation or permission escalation. The owner is protected from deactivation through the member editor.

Every permission has `can_view`, `can_create`, `can_edit`, `can_post`, and `can_export`. All other actions also require view permission. Owners have all actions. The UI hides inaccessible navigation, guards direct URLs, and disables unauthorized actions. PostgreSQL independently authorizes RPCs and applies RLS to every read.

| Module         | Data/actions                                                                |
| -------------- | --------------------------------------------------------------------------- |
| dashboard      | Dashboard route; underlying data still requires relevant permissions        |
| products       | Brand/product/SKU maintenance                                               |
| suppliers      | Supplier maintenance, supplier-SKU links, cost versions                     |
| deposits       | Deposit ledger and procurement posting                                      |
| inventory      | Inventory ledger, adjustments, procurement receipt                          |
| shopee         | Imports and Shopee sales                                                    |
| reconciliation | Candidate viewing and explicit confirmation                                 |
| reseller       | Reseller customer/order/invoice operations                                  |
| b2b            | B2B and retail customers, branches, manual/WhatsApp/B2B orders and invoices |
| finance        | Account balances, expense/payment posting, full P&L and business position   |
| reports        | Report interface, combined with underlying module read/export permissions   |
| settings       | Workspace settings, locations, audit log; owner additionally manages users  |

Operational read sharing is intentional: order entry can read SKU/location/supplier reference data; inventory can read procurement receipts; customer operators can read their invoices and related payments; finance can read sales for P&L. This does not grant direct writes or access to bank snapshots/expenses without Finance permission.

Reseller profit analytics require Finance permission in addition to Reseller permission. WhatsApp uses B2B permission because the requested module list has no separate manual-order permission. Stock receipt requires Inventory post; supplier purchase requires Deposits post. Sales post includes its related ledger effects, without requiring separate ledger module permissions.

`can_export` gates the app's export actions. Once someone can read data, a browser cannot prevent them from copying or exporting it outside the app. It is not a data-loss-prevention control.

RLS SELECT returns zero visible rows for forbidden data; PostgREST may return an empty result rather than HTTP 403. Forbidden writes/RPCs raise an authorization error. Both enforce the requested no-access behavior.

Private storage paths begin with the workspace UUID. Imports follow Shopee permissions; invoices follow B2B permissions; attachments follow Settings permissions. PDFs are generated locally in this version; automatic invoice archival is not enabled.
