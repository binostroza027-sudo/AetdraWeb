import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aetdramc.live',
  vite: { build: { assetsInlineLimit: 0 } },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://mc-heads.net",
        "font-src 'self'",
        "connect-src 'self' https://api.mcsrvstat.us",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
});
