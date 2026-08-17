FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --frozen-lockfile \
  && python3 -m venv /app/.pythonlibs \
  && /app/.pythonlibs/bin/pip install --no-cache-dir yt-dlp \
  && pnpm --filter @workspace/api-server build

WORKDIR /app/artifacts/api-server

ENV NODE_ENV=production

CMD ["pnpm", "start"]