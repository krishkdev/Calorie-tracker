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

## Using it on your phone with local models

Phones can't reach `localhost` on your computer. Serve the app on your LAN and point it at your machine's IP:

```bash
npm run preview            # prints a http://192.168.x.x:4173 URL
OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS="*" ollama serve
```

In the app: Ollama preset, base URL `http://192.168.x.x:11434/v1`.

## Updating

Pull the latest changes and redeploy. The service worker updates in the background; users get the new version on their next launch.
