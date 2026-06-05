# NC Studios Website Hosting

The public website is in `docs/`. Host that folder only.

Do not publish the whole repo as the public website unless the dashboard pages are protected with login/password access.

## Recommended: Netlify

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

- Root/apex domain, like `yourdomain.co.uk`: use Netlify's shown ALIAS/ANAME option if your domain provider supports it. If not, use an A record to `75.2.60.5`.
- `www.yourdomain.co.uk`: add a CNAME pointing to your Netlify site name, like `your-site-name.netlify.app`.

DNS can take 24-48 hours to fully update.

## Alternative: GitHub Pages

1. Push this repo to GitHub.
2. In the repo, open Settings, then Pages.
3. Set the source to deploy from the branch and choose the `/docs` folder.
4. Save.
5. Add your custom domain in Pages settings.

For GitHub Pages DNS:

- Root/apex domain, like `yourdomain.co.uk`: use A records for:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- `www.yourdomain.co.uk`: add a CNAME pointing to your GitHub Pages domain, usually `your-github-username.github.io`.

After GitHub accepts the domain, turn on Enforce HTTPS when it becomes available.

## Domain File

Once you know the exact domain, add a file at `docs/CNAME` containing only the domain name.

Example:

```text
www.yourdomain.co.uk
```

Use `www` as the main site unless you specifically want the root domain as primary.
