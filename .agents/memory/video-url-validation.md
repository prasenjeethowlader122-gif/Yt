---
name: Video URL validation and generated schemas
description: Reusable constraints for video downloader API work in this workspace.
---

Generated Zod schemas currently target Zod 3, so OpenAPI `format: uri` emits `zod.url()` and breaks the library typecheck. Keep URL fields as strings in the OpenAPI contract and validate allowed hosts explicitly in the server.

**Why:** Code generation succeeded but the generated schema failed until URI formats were removed; the workspace's installed Zod version does not expose `zod.url()`.

**How to apply:** When adding URL-based endpoints, keep transport schemas string-based and enforce protocol/domain rules in route-level helpers.

YouTube may allow oEmbed metadata and an embedded preview while blocking server-side media extraction with a sign-in/bot challenge. Treat that as preview-only rather than attempting to collect browser cookies.

**Why:** The challenged source returned title/thumbnail through the official oEmbed endpoint but did not expose duration or downloadable media to yt-dlp, even after updating the extractor.

**How to apply:** Keep clip/download controls disabled when duration is unavailable, explain the limitation, and preserve real processing for sources that expose authorized media streams.