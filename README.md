# NC Studios

Public website and studio dashboard for NC Studios.

## Pages

- `index.html` is the public website. This is the page your domain should open.
- `dashboard.html` is the private studio app entry point.
- `bookings.html` is where website enquiries appear as new booking enquiries.
- `buy-list.html` tracks things to buy, rent, research or leave for later.

## Website enquiries

The public enquiry form saves each submission as an incoming website enquiry using:

- Table: `app_storage`
- App key prefix: `website_enquiry_`
- Status: `enquiry`

When the studio app opens, `nc-supabase-sync.js` imports those incoming website enquiries into the main bookings list at `ncstudios_bookings_v1`.

Each website enquiry is saved with the client's name, event type, date, location and contact details inside the booking notes.

The public website uses the local `supabase-js.js` browser library so the enquiry form does not depend on a third-party CDN at page load.

## Hosting with your domain

You can host this as a static website on GitHub Pages, Netlify or Vercel. Point your domain at the host, and make sure the domain opens `index.html`.

Do not publish the dashboard pages publicly unless the host protects them with login or password access. If you use GitHub Pages for the full repo, files like `dashboard.html` and `bookings.html` can still be opened by direct link.

For GitHub Pages, add a `CNAME` file containing your domain once you know the exact domain name. Your DNS provider then needs the records GitHub Pages gives you.

For production, the cleanest setup is to keep the public form behind a Supabase Edge Function or a dedicated enquiries table so visitors can submit enquiries without exposing wider app storage access.
