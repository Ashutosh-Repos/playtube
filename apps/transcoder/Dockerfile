FROM node:20-slim AS base
# Install FFmpeg (Critical for Transcoder)
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune --scope=transcoder-service --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=transcoder-service...

FROM base AS runner
WORKDIR /app
COPY --from=installer /app .

CMD ["node", "apps/transcoder/dist/index.js"]
