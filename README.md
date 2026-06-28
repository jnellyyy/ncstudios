# NC Studios

Public website and studio dashboard for NC Studios.

Domain: `ncstudiouk.co.uk`

## Pages

- `index.html` is the public website. This is the page your domain should open.
- `dashboard.html` is the private studio app entry point.
- `bookings.html` is where website enquiries appear as new booking enquiries.
- `buy-list.html` tracks things to buy, rent, research or leave for later.
- `studio-assistant.html` is the operational home for priorities, automations, pipeline, calendar and package suggestions.
- `crm.html` combines every couple and now includes the complete editable client profile.
- `content.html` tracks posting permission, portfolio selections, reel ideas, captions and post dates.
- `wedding-funds.html` protects rental money and assigns incoming wedding payments.
- `docs/` is the safe public deployment folder for the live website.

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

You can host this as a static website on GitHub Pages, Netlify or Vercel. Publish the `docs/` folder only, then point your domain at the host.

Do not publish the dashboard pages publicly unless the host protects them with login or password access. If you use GitHub Pages for the full repo, files like `dashboard.html` and `bookings.html` can still be opened by direct link.

For step-by-step setup, see `HOSTING.md`.

For production, the cleanest setup is to keep the public form behind a Supabase Edge Function or a dedicated enquiries table so visitors can submit enquiries without exposing wider app storage access.
