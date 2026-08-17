# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- The frontend is deployed as a Render static site and the API as a separate Render Docker web service.
- The API image installs `yt-dlp` and `ffmpeg`, which are required for video inspection, downloads, and clipping.
- The frontend accepts the API service host through `VITE_API_BASE_URL`; an unset value keeps same-origin API behavior for local development.

## Product

Clipforge inspects public YouTube and Facebook video links, shows metadata and a preview, downloads full videos, and creates time-range clips.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The frontend Vite config requires both `PORT` and `BASE_PATH` during builds; Render sets these in `render.yaml`.
- The API must start with `artifacts/api-server` as its working directory because its video-tool paths are relative to that directory.
- Render deployment is configured through the root `render.yaml` Blueprint. The frontend receives the API hostname automatically from the API service.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
