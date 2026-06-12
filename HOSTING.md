# NC Studios Website Hosting

The public website is in `docs/`. Host that folder only.

Do not publish the whole repo as the public website unless the dashboard pages are protected with login/password access.

Domain: `ncstudiouk.co.uk`

## Credit-Safe Hosting Rule

Use Cloudflare or Netlify only for the public static website in `docs/`.

Do not publish the repo root as the public website.

Do not use the public website host for:

- the private business app
- Supabase sync logic
- repeated tiny preview/test deploys
- Netlify Functions
- Netlify Forms
- image/video storage

The enquiry form already sends straight to Supabase from the static website, so Netlify does not need to process forms or run backend code.

To save credits, test with the local files first, then deploy grouped finished changes.

## Cloudflare Static Setup

Use these settings for Cloudflare Pages or Workers static assets:

- Build command: leave blank
- Build output directory / assets directory: `docs`
- Public website folder: `docs`
- Do not set the output directory to `.`

This keeps the private business app pages out of the public website deployment.

If deploying with Wrangler, `wrangler.jsonc` should point assets at:

```json
"assets": {
  "directory": "./docs"
}
```

The public redirects live in `docs/_redirects`.

## Netlify Static Setup

1. Push this repo to GitHub.
2. In Netlify, choose Add new project, then Import an existing project.
3. Choose the GitHub repo.
4. Use these settings:
   - Build command: leave blank
   - Publish directory: `docs`
5. Publish the site.
6. Netlify will give you a temporary `.netlify.app` link first.
7. In Domain management, add your custom domain.

For external DNS:

- Root/apex domain, `ncstudiouk.co.uk`: use Netlify's shown ALIAS/ANAME option if your domain provider supports it. If not, use an A record to `75.2.60.5`.
- `www.ncstudiouk.co.uk`: add a CNAME pointing to your Netlify site name, like `your-site-name.netlify.app`.

For Namecheap, this normally means:

```text
Type: A Record
Host: @
Value: 75.2.60.5
TTL: Automatic
```

```text
Type: CNAME Record
Host: www
Value: your-site-name.netlify.app
TTL: Automatic
```

DNS can take 24-48 hours to fully update.

## Alternative: GitHub Pages

1. Push this repo to GitHub.
2. In the repo, open Settings, then Pages.
3. Set the source to deploy from the branch and choose the `/docs` folder.
4. Save.
5. Add your custom domain in Pages settings.

For GitHub Pages DNS:

- Root/apex domain, `ncstudiouk.co.uk`: use A records for:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- `www.ncstudiouk.co.uk`: add a CNAME pointing to your GitHub Pages domain, usually `your-github-username.github.io`.

After GitHub accepts the domain, turn on Enforce HTTPS when it becomes available.

## Domain File

If you use GitHub Pages, add a file at `docs/CNAME` containing only the domain name.

Example:

```text
www.ncstudiouk.co.uk
```

Use `www` as the main site unless you specifically want the root domain as primary.

## Updating Website Content

Open the live site with Me Mode turned on:

```text
https://ncstudiouk.co.uk/?me=1
```

Use the Me Mode button to edit page text and preview image/video changes.

When you are happy:

1. Click Export JSON.
2. Save the downloaded file as `site-content.json`.
3. Put `site-content.json` inside `docs/`.
4. Redeploy the site.

Images can be uploaded into Me Mode for quick previews. For large videos, upload the video file to your host or storage first, then paste the video URL into Me Mode.
