import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { d1, r2 } from '@emdash-cms/cloudflare';

export default defineConfig({
  site: 'https://kirshchenya.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [react(), emdash({
    migrations: { runtime: 'check', dev: 'auto' },
    database: d1({ binding: 'DB', session: 'auto', coalesce: true }),
    storage: r2({ binding: 'MEDIA' }),
  })],
  devToolbar: { enabled: false },
});
