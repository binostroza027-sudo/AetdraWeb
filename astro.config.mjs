import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aetdramc.live',
  vite: { build: { assetsInlineLimit: 0 } },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https://nmsr.nickac.dev",
        "font-src 'self'",
        "connect-src 'self' https://api.mcsrvstat.us https://nmsr.nickac.dev",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
});
