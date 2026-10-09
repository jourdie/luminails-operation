# Route plan

## Public routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/login` | Google SSO entry | Public |
| `/access-denied` | Authenticated but inactive or unauthorized user | Authenticated |

## Protected routes

| Route | Module |
| --- | --- |
| `/` | Dashboard |
| `/orders/shopee` | Shopee Orders |
| `/orders/manual` | Manual and Reseller |
| `/orders/b2b` | B2B Orders |
| `/operations/inventory` | Inventory and SKU |
| `/operations/restock` | Restock |
| `/operations/supplier-deposit` | Supplier Deposit |
| `/operations/reconciliation` | Daily Reconciliation |
| `/finance/profit-loss` | Profit and Loss |
| `/finance/business-position` | Business Position |
| `/finance/expenses` | Expenses and Liabilities |
| `/reports` | Reports |
| `/settings/data-setup` | Data setup, workspace cleansing, and manual opening balances |
| `/settings/users` | Users and Permissions |
| `/settings/suppliers` | Suppliers |
| `/settings/accounts` | Financial Accounts |
| `/settings/invoices` | Invoice Settings |
| `/settings/audit-log` | Audit Log |

Major business routes are lazy loaded. The shell and login remain small and fast. Route authorization is checked before rendering module content; RLS remains the enforcement boundary for data access.
