# Architecture review

## Scope

Luminails Ops is an internal operational system for a small team with high data integrity requirements. The first release should favor explicit workflows and database transactions over broad automation.

## Target shape

```text
Browser
  -> React + Vite + React Router
  -> Supabase JS with TanStack Query
  -> Supabase Auth / PostgreSQL / Storage
  -> Cloudflare static hosting and SPA fallback
```

The browser never receives a service role key. PostgreSQL RLS is the final data boundary. Atomic posting operations will live in PostgreSQL functions so inventory, deposits, sales, and audit rows commit together.

## Phase 1 decisions

- Use one Vite SPA with route-level lazy loading.
- Use a workspace membership record as the authorization source of truth.
- Keep roles and module permissions separate so an owner can grant narrowly scoped access.
- Keep demo mode explicit and environment gated. It is for local UI review only.
- Keep migrations small and ordered. Phase 1 creates workspace, profile, membership, permissions, audit, and RLS helpers.

## Reliability boundaries

- Inventory and supplier deposit balances will be ledger views, never editable balances.
- Posted records will be immutable. Corrections use reversal transactions.
- Imports use stable external identities and idempotency keys.
- Historical cost is stored as a snapshot on posted transactions.
- Reconciliation verifies and controls ledger posting; it is not a second ledger.

## Hosting and portability

The frontend only uses browser-compatible APIs and Vite build output. Supabase is accessed through its public client APIs and RLS. Cloudflare deployment is documented but not executed by this phase.

## Risks to review before production

- Confirm Google OAuth redirect URLs for each environment.
- Test RLS with a member that lacks Finance permission.
- Review every posting function for duplicate source protection.
- Measure bundle size after the first business modules are added.
