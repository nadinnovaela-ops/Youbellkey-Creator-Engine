# Multi-arch (linux/amd64 & linux/arm64) Universal Worker image
# Compatible with personal Linux/Docker PC and Oracle Ampere A1 (2 OCPU / 12 GB RAM)
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    chromium \
    fonts-noto-core \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY engines ./engines
COPY workers ./workers

RUN npm install --omit=dev

CMD ["npx", "tsx", "workers/cloud-worker/src/index.ts"]
