// The site name Google shows comes entirely from the `WebSite` JSON-LD block:
// drop it and Google silently falls back to the bare netlify.app subdomain.
// Nothing in the browser surfaces that, so lock it down here.
//
// Read through Vite's `?raw` rather than node:fs — the suite runs in jsdom,
// where import.meta.url is not a file: URL, and the repo carries no Node types.
import { describe, it, expect } from "vitest";
import layout from "./Layout.astro?raw";

describe("structured data", () => {
  it("declares a WebSite block with a name and a URL", () => {
    expect(layout).toMatch(/"@type":\s*"WebSite"/);
    expect(layout).toMatch(/const siteName = "[^"]+"/);
    // Google ignores WebSite markup that sits anywhere but the root.
    expect(layout).toMatch(/url: canonical/);
    expect(layout).toMatch(/const canonical = new URL\("\/", site\)/);
  });

  it("reuses that same name for og:site_name", () => {
    // A secondary signal per Google, but two diverging values would cancel
    // each other out rather than reinforce.
    expect(layout).toMatch(/<meta property="og:site_name" content=\{siteName\} \/>/);
  });
});
