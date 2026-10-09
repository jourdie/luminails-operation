# Deployment

## Local

```bash
npm install
npm run dev
```

Without Supabase environment variables, the app runs a read-write local preview backed by browser local storage. This mode is for development only.

## Supabase

Link the development project, then apply migrations in `supabase/migrations` in order. Review RLS and RPC changes before production. Configure Google OAuth in Supabase Auth and add the local and production callback URLs.

## Cloudflare

Build with `npm run build` and deploy the Vite output using a Cloudflare-compatible static hosting setup or Worker entry. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_URL` in the build environment. Configure SPA fallback to `index.html`.

Production must have Supabase variables. Never deploy local preview mode with real data.
