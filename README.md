# crumbs

**every piece you love.**

A minimalist, Pinterest-inspired visual wishlist. Save product images, auto-sort with Gemini, and browse by category.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (auth, Postgres, storage)
- Google Gemini 1.5 Flash (`@google/genai`)

## Local development

```bash
npm install
cp .env.example .env.local
# fill in Supabase + Gemini keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `GEMINI_API_KEY` | Google AI Studio API key |

See `.env.example` for a template.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL:** Run `supabase/migrations/001_init.sql` in the SQL editor (table, RLS, storage bucket + policies).
3. **Auth:** Enable Email and Google providers under Authentication → Providers. Add your site URL and `http://localhost:3000/auth/callback` to redirect URLs.
4. **Storage:** Confirm the `crumb-images` public bucket exists after migration.

## Deploy (Vercel)

1. Import the repo, set the three env vars from `.env.example`.
2. Deploy. Middleware protects `/` and refreshes Supabase sessions.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (optional; build skips lint for ESLint 9 compatibility)
