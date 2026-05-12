import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  // Disable automatic Cloudflare KV session binding — sessions are not used in this project.
  session: { driver: 'null' },
  integrations: [preact()],
  site: 'https://bot-arena.jhero.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
