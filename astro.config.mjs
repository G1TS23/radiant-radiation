// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Absolute site URL — lets the layout build absolute og:/twitter: image URLs
  // so link previews (iMessage, WhatsApp, Discord, X…) resolve the card.
  site: "https://radiant-radiation.netlify.app",
});
