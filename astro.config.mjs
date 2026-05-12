import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  integrations: [preact()],
  site: 'https://jhero.app',
});
