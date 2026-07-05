# NC Studios

Public website and studio dashboard for NC Studios. The website and app are separate surfaces and should stay that way.

Domain: `ncstudiouk.co.uk`

## Repository layout

- `docs/` is the public NC Studio website deployed to `ncstudiouk.co.uk`.
- `website-worker/` is website-only backend code for secure client delivery.
- Root dashboard files such as `dashboard.html`, `delivery.html`, `bookings.html` and `clients.html` are the private business app.
- `dashboard.html` is the private studio app entry point.
- `bookings.html` is where website enquiries appear as new booking enquiries.
- `buy-list.html` tracks things to buy, rent, research or leave for later.
- `studio-assistant.html` is the operational home for priorities, automations, pipeline, calendar and package suggestions.
- `crm.html` combines every couple and now includes the complete editable client profile.
- `content.html` tracks posting permission, portfolio selections, reel ideas, captions and post dates.
- `wedding-funds.html` protects rental money and assigns incoming wedding payments.

Do not copy website client-delivery code into the root app pages. Do not publish the root app folder as the public website.

## Website client vault

The website client-delivery system is kept entirely outside the app:

- `docs/client-vault.html` is the private website workspace used to create delivery links and upload client files.
- `docs/client-delivery.html` is the branded page opened by each couple.
- `website-worker/worker.js` protects the files and stores them in a private Cloudflare R2 bucket.

To connect storage in Cloudflare:

1. Create a private R2 bucket named `nc-client-deliveries`.
2. Open the deployed `ncstudios` Worker, then add an R2 binding.
3. Set the variable name to `CLIENT_DELIVERIES` and select the bucket.
4. Redeploy, then open `/client-vault.html` and sign in with the existing NC Studio Supabase login.

The R2 bucket must remain private. Client links use temporary access sessions created by the Worker.

## Run the private app locally

From the repository folder, start a local static server:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/dashboard.html`. The app saves on the device immediately. Sign in when prompted to sync the private records through Supabase, or choose **Use this device only** for local use.

## Private database setup

Run `supabase-secure-setup.sql` in the Supabase SQL editor after creating the NC Studio login user. It creates the admin-only CRM tables, packages, add-ons, tasks, reminders, payments, contracts, consultations, timelines, editing projects, templates, content plans and file links with row-level security.

Do not put the Supabase service-role key in browser files. The browser uses the public project URL and anonymous key; access to private records is controlled by authentication and the admin policies in the SQL setup.

## Website enquiries

The public enquiry form saves each submission as an incoming website enquiry using:

- Table: `app_storage`
- App key prefix: `website_enquiry_`
- Status: `enquiry`

When the studio app opens, `nc-supabase-sync.js` imports those incoming website enquiries into the main bookings list at `ncstudios_bookings_v1`.

Each website enquiry is saved with the client's name, event type, date, location and contact details inside the booking notes.

The public website uses the local `supabase-js.js` browser library so the enquiry form does not depend on a third-party CDN at page load.

## Hosting with your domain

The public website is deployed from `docs/` through the Cloudflare Worker configured in `wrangler.jsonc`.

Do not publish the dashboard pages publicly unless the host protects them with login or password access. If you use GitHub Pages for the full repo, files like `dashboard.html` and `bookings.html` can still be opened by direct link.

For step-by-step setup, see `HOSTING.md`.

For production, the cleanest setup is to keep the public form behind a Supabase Edge Function or a dedicated enquiries table so visitors can submit enquiries without exposing wider app storage access.
