# NC Studio website backend

This folder belongs to the public website, not the NC Studio business app.

`worker.js` serves the files in `docs/` and provides two website-only API routes:

- `/api/client-vault` for authenticated delivery management.
- `/api/client-delivery` for private client access and file streaming.

The Worker expects one private Cloudflare R2 binding named `CLIENT_DELIVERIES`.

The Worker also uses a Workers AI binding named `AI` for wedding photo sorting. This binding is declared in `wrangler.jsonc`. Cloudflare requires the account owner to accept the Meta Llama 3.2 Vision licence once before the first smart sort. If AI is unavailable, uploads remain usable and photographs fall back to `Unsorted` for manual review.

Client files and metadata are stored only in that private bucket. Studio management requests are checked against the existing Supabase `is_nc_admin` function before the Worker allows changes.
