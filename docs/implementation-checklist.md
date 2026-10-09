# Implementation checklist

## Phase 1

- [x] Repository setup and portable scripts
- [x] Vite, React, TypeScript, Tailwind, and Cloudflare-compatible build setup
- [x] Design tokens and application shell
- [x] Lazy route structure
- [x] Supabase browser client
- [x] Google SSO entry point
- [x] Workspace membership loading
- [x] Permission-aware navigation and protected routes
- [x] Local preview mode with browser-stored seed data
- [x] Core workspace and permission migrations
- [x] RLS foundation and audit table
- [x] Permission unit tests
- [x] Inventory, supplier deposit, restock, sales, reconciliation, and finance local workflows
- [x] Excel template and import preview flows
- [x] Settlement fee component import and P&L breakdown
- [x] B2B order PDF export
- [ ] Live Supabase integration test with a member lacking Finance access (requires project credentials)

## Local workflow coverage

- [x] Supplier, product, SKU, and HPP versioning
- [x] Inventory ledger and moving weighted average cost
- [x] Supplier deposit ledger
- [x] Restock posting, partial receiving, and receiving
- [x] Unified sales and split fulfillment
- [x] Shopee and settlement imports with local preview
- [x] Daily reconciliation
- [x] Finance, P&L, business position, and expense purpose separation
- [x] Reports CSV export and B2B invoice PDF preview
- [x] Manual data setup, workspace cleansing, and opening balance entry flows

## Production hardening

- [ ] Replace local browser store with live Supabase query/mutation adapters
- [ ] Run Supabase migrations and seed against a real project
- [ ] Verify Google OAuth redirect URLs and active member access
- [ ] Verify RLS with a member lacking Finance access
- [ ] Review production pagination/query plans and import batching
- [ ] Configure private Storage buckets and Cloudflare deployment secrets
