# kirshchenya.com

Vitaly Kirshchenya’s personal site. The production source lives in this repository. The four English pages, styles, scripts and local Inter font are in `public/`. The site preserves the original portfolio, projects, work journal and photo carousel.

## Publishing

Cloudflare Workers Builds connects this repository’s `main` branch to the `kirshchenya-portfolio` Worker. The build command is `npm test` and the deploy command is `npm run deploy`. The repository pins the Wrangler CLI. After a push, check the build log in Cloudflare and run `npm run check:live` to verify the four pages and the SHA-256 digest of every published image.

Edit page copy in `public/`, run `npm test`, then commit it to GitHub. Cloudflare serves existing static assets directly. Requests to `/media/` are handled by the Worker through the private R2 binding `PHOTOS`. The only custom domain declared in `wrangler.jsonc` is the apex. The separate Wordcards application owns `app.kirshchenya.com`.

## Photos

The bucket is `kirshchenya-portfolio-media`. Only site-ready WebP files are uploaded, using the names listed in `media.json`. The original camera files and the published photo bytes are kept out of Git. Images have content-addressed names and immutable cache headers. Reverting a Git commit restores links to the prior image versions as long as the objects are retained.

For a new image, run `node scripts/prepare-photo.js /absolute/path/to/photo.webp`. Upload the resulting WebP from `media-upload/` to the bucket root, reference the printed URL in the relevant page, and commit the updated manifest and HTML. For a thumbnail, supply a separate file with a distinct descriptive name. Upload all new objects before merging their links. Wrangler for local development can use locally seeded R2 objects via the same bucket binding.

## Local checks

Use Node.js 22.16 or later. Run `npm test` to check internal links and the R2 serving path. `npm run check:bundle` runs a Wrangler dry run. `npm run dev` serves the application locally.
