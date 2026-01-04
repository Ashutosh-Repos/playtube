# Base Image
FROM node:20-alpine AS base

# Builder Stage
FROM base AS builder
WORKDIR /app
# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
# Copy workspace packages (pruned approach is better, but this is simple for now)
COPY packages ./packages
COPY apps/video-service ./apps/video-service
COPY apps/video-service/.env.example ./apps/video-service/.env

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build video-service
RUN pnpm turbo run build --filter=video-service

# Runner Stage
FROM base AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built artifacts and dependencies
# Note: In a real production setup, we would prune devDependencies.
# For simplicity with Turbo, we copy the built structure.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/video-service/package.json ./apps/video-service/package.json
COPY --from=builder /app/apps/video-service/dist ./apps/video-service/dist
COPY --from=builder /app/apps/video-service/.env.example ./apps/video-service/.env

WORKDIR /app/apps/video-service
USER nodejs

EXPOSE 4003

CMD ["node", "dist/index.js"]
