# kirshchenya.com

The personal portfolio runs on Astro, EmDash and Cloudflare Workers. Open `/admin` to edit Home, Experience, Work Journal, Projects and Outside Work. Publish an entry to make it visible. The Experience display order is ascending, with the first role expanded. The three editorial sections show recent publications first and support the original fragment links.

## Deploying

Cloudflare Workers Builds runs the tests on main and deploys with `npm run deploy`. Use Node 24.22.1 and `npm ci`. The deployment binds D1 for editorial content, KV for sessions, R2 for CMS uploads and the existing PHOTOS bucket. Before the owner registers the first passkey, the site serves its original pages and the setup flow requires the private initial setup credentials. Include the portfolio content when applying the seed. The initial setup guard stops applying once setup is complete. Do not reapply the seed over edited entries.

## Photos

The bucket is `kirshchenya-portfolio-media`. Only site-ready WebP files are uploaded, using the names listed in `media.json`. The original camera files and the published photo bytes are kept out of Git. Images have content-addressed names and immutable cache headers. Reverting a Git commit restores links to the prior image versions as long as the objects are retained.

For a new image, run `node scripts/prepare-photo.js /absolute/path/to/photo.webp`. Upload the resulting WebP from `media-upload/` to the bucket root, reference the printed URL in the relevant page, and commit the updated manifest and HTML. For a thumbnail, supply a separate file with a distinct descriptive name. Upload all new objects before merging their links. Wrangler for local development can use locally seeded R2 objects via the same bucket binding.

## Local checks

Run `npm test`, `npm run check:bundle` and `npm run dev` as needed. The postdeploy check covers the four pages and all original image digests.
