# NC Studios

Public website and studio dashboard for NC Studios.

## Pages

- `index.html` is the public website. This is the page your domain should open.
- `dashboard.html` is the private studio app entry point.
- `bookings.html` is where website enquiries appear as new booking enquiries.

## Website enquiries

The public enquiry form saves into the existing Supabase-backed bookings list using:

- Table: `app_storage`
- App key: `ncstudios_bookings_v1`
- Status: `enquiry`

Each website enquiry is saved with the client's name, event type, date, location and contact details inside the booking notes.

## Hosting with your domain

You can host this as a static website on GitHub Pages, Netlify or Vercel. Point your domain at the host, and make sure the domain opens `index.html`.

For GitHub Pages, add a `CNAME` file containing your domain once you know the exact domain name. Your DNS provider then needs the records GitHub Pages gives you.

For production, the cleanest setup is to keep the public form behind a Supabase Edge Function or a dedicated enquiries table so visitors can submit enquiries without exposing wider app storage access.
