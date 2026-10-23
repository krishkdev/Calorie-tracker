# Self-hosting

The app is a static site. There is no backend, no database server and no account system; every user's data stays in their own browser. Hosting it means serving a folder of files.

## GitHub Pages (free)

1. Fork the repository.
2. In your fork: **Settings → Pages → Source: GitHub Actions**.
3. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually).

The workflow builds with `VITE_BASE=/<repo-name>/` so links and the service worker work under the project path. Your app will be at `https://<you>.github.io/<repo-name>/`.

## Any static host

```bash
npm ci
npm run build          # output in dist/
```

Upload `dist/` to Netlify, Vercel, Cloudflare Pages, S3, or any web server. If the app is served from a sub-path, build with `VITE_BASE=/that-path/`.

Serve `sw.js` and `manifest.webmanifest` with `Cache-Control: no-cache` so updates reach users; hashed files under `assets/` can be cached forever.

## Docker

```bash
docker build -t calorie-tracker .
docker run -d -p 8080:80 calorie-tracker
```

Open http://localhost:8080. The image is nginx serving the built files with the cache headers above (see `nginx.conf`).

## Using it on your phone during development

Run `npm run preview -- --host` (or `npm run dev -- --host`) and open the printed LAN address on your phone. The AI providers are reached directly from the phone, so nothing else needs to run on your computer.

## Updating

Pull the latest changes and redeploy. The service worker updates in the background; users get the new version on their next launch.

## Vercel

1. Go to https://vercel.com/new and import the GitHub repository.
2. Keep the defaults: Vercel detects Vite, runs `npm run build`, and serves `dist/`. The included `vercel.json` sets the cache headers for the service worker.
3. Deploy. Every push to the production branch redeploys automatically.

No environment variables are needed: users enter their own AI keys in the app.
