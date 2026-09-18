# Local setup and deployment

## Requirements

- Node.js 22.13+ (tested with Node 24.21), npm.
- For full local Supabase: Docker Desktop and Supabase CLI (`npx supabase`).
- A Supabase project and configured Google OAuth provider for shared use.

## Run the application

```sh
npm ci
cp .env.example .env
npm run dev
```

PowerShell: `Copy-Item .env.example .env`. Open `http://127.0.0.1:5173`.

With blank credentials, Vite development mode runs isolated PostgreSQL in the browser with conspicuous test-data labeling. Local data is per-browser; another device/user cannot share it. Keep one local-mode tab open at a time. Clearing site storage removes development data.

## Supabase

For a full local stack:

```sh
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` destroys and recreates the **local** database and applies development seed data. It must not be used casually against remote databases.

For a new hosted project:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Do not include the development seed in production. Set these public frontend variables in `.env` or the hosting build settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is supported as an alternative. Never put a service role key in `VITE_*`. Partial configuration fails closed. Production builds with no configuration fail closed unless local preview mode is explicitly enabled; keep `VITE_ENABLE_LOCAL_DATABASE=false` in production.

## Google OAuth and first owner

1. Configure a Google OAuth web client in Google Cloud. Add Supabase's callback URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
2. Enable Google in Supabase Authentication providers, supplying the Google client ID and secret there.
3. Configure Supabase Site URL and allowed redirect origins for the local and eventual hosted app.
4. Sign in once through the app. The user initially sees the no-access screen; no automatic workspace is granted.
5. In the trusted Supabase SQL editor, bootstrap the first workspace/owner. Replace the email with the exact verified owner email:

```sql
do $$
declare w uuid; u uuid; e text := lower('OWNER_EMAIL_HERE');
begin
  select id into u from auth.users where lower(email)=e and email_confirmed_at is not null;
  if u is null then raise exception 'Sign in with the verified owner email first'; end if;
  insert into public.workspaces(name) values('Luminails') returning id into w;
  insert into public.workspace_members(workspace_id,user_id,email,role)
    values(w,u,e,'OWNER');
end $$;
```

Run bootstrap once. For a seeded local Supabase workspace, insert the owner membership into the existing workspace instead of creating a duplicate. Then reload the app, create reference data, and record opening balances. Owners allowlist additional emails in Settings → Users & Access; that screen does not send invitation emails.

Set the PostgreSQL application role timezone to `Asia/Jakarta` using the project's database settings and verify `current_date` agrees with the operating day. Add localhost and `127.0.0.1` redirects if using both.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Optional browser verification, with the dev server running on port 5173:

```sh
npx playwright install chromium
npm run test:browser
```

For an existing browser installation, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can specify its executable. Browser smoke testing starts a separate test context, exercises routes/order totals/downloads/persistence, and writes screenshots under ignored `.local/screenshots/`.

Before real operational use, verify Google sign-in, allowlist denial, two distinct permission roles, private file access, import/reconciliation/post/reversal, and backups against the actual Supabase project. This repository's tests do not validate external OAuth configuration or a hosted deployment.

## Netlify (prepared, not deployed)

- Build command: `npm run build`.
- Publish directory: `dist`.
- Node: 22 or newer.
- Set the public Supabase variables before building. Rebuild after environment changes.
- `netlify.toml` includes an SPA rewrite to `index.html`, so direct `/inventory`, `/b2b`, and `/finance` URLs work.
- Add the final HTTPS origin to Supabase OAuth redirects.
- Keep local database preview disabled in production.

No deployment is required for the initial implementation and none has been performed.
