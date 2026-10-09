# Luminails Ops

Internal operations workspace for Luminails. The application is built for reliable operational, inventory, supplier deposit, reconciliation, and finance workflows.

## Architecture

- React, TypeScript, Vite, React Router
- Tailwind CSS with shadcn-style primitives and Lucide icons
- Supabase Auth, PostgreSQL, Storage, RLS, and SQL functions
- TanStack Query for server state
- Cloudflare-compatible static deployment

The first phase provides the application shell, Google SSO structure, workspace membership checks, permission-aware routes, and the RLS foundation. Business ledgers are added in later phases.

## Local setup

Requirements: Node.js 20 or newer and a Supabase project for authenticated mode.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

If Supabase is not configured, `npm run dev` automatically opens a local preview with seeded dashboard data stored in browser local storage. You can also set `VITE_DEMO_MODE=true` explicitly. Local preview must not be used for production data.

For manual testing, open `Settings > Data Setup`. Use `Workspace kosong` to remove sample master and transaction data, then enter suppliers and opening deposits, SKU/HPP/opening stock, and financial account opening balances. `Pulihkan demo` restores the local sample dataset.

## Environment variables

See `.env.example`. Only the Supabase URL and publishable key use the `VITE_` prefix. Never put a service role key in frontend environment variables.

## Supabase setup

1. Create a development Supabase project.
2. Run migrations in `supabase/migrations` in filename order.
3. Enable Google in Supabase Auth and configure the redirect URLs documented in `docs/deployment.md`.
4. Add a workspace member through the owner workflow or the development seed.

```bash
npm run db:push
npm run db:seed
```

The commands require the Supabase CLI and a linked project. Production migrations must be reviewed before they are applied.

## Google SSO

Create a Google OAuth web client, add the Supabase callback URL, then paste the client ID and secret into Supabase Auth Provider settings. Add the local and Cloudflare application URLs to the Supabase redirect allow list. Authentication does not grant application access; the user must also be an active workspace member.

## Cloudflare deployment

```bash
npm run build
npm run deploy
```

Set the production `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values in the Cloudflare build environment. `wrangler.jsonc` configures the `dist` directory and SPA fallback so application routes resolve to `index.html`. Do not target Netlify or Vercel.

## Testing and build

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Security notes

- Frontend access checks are paired with PostgreSQL RLS.
- Business tables are scoped by workspace membership.
- Posted operational records will be immutable and corrected by reversal transactions.
- Private storage buckets are planned for imports, invoices, and attachments.
- Back up the Supabase database and storage before production migration changes.
