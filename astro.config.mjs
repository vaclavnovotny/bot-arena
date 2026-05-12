import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [preact()],
  site: 'https://jhero.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
