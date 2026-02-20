# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: base
# Establishes the shared runtime foundation: Node 20 Alpine with pnpm.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install pnpm via corepack so the version is driven by packageManager in
# package.json rather than a hardcoded ARG.
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: deps
# Installs all workspace dependencies using the lockfile for a reproducible
# install. Only manifests and the lockfile are copied so this layer is
# invalidated only when dependencies actually change.
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace manifests — order matters for cache locality.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json  ./packages/shared/package.json
COPY packages/core/package.json    ./packages/core/package.json
COPY packages/cli/package.json     ./packages/cli/package.json
COPY packages/web/package.json     ./packages/web/package.json

# --frozen-lockfile ensures CI parity; --prod is NOT used here because build
# tooling (typescript) lives in devDependencies.
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: build
# Compiles all TypeScript packages in dependency order as declared by the
# composite tsconfig.build.json project references.
# -----------------------------------------------------------------------------
FROM deps AS build

COPY tsconfig.json tsconfig.build.json ./
COPY packages/ ./packages/

RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 4: api
# Minimal production image for the Sentinel API server (packages/core).
# Copies only the compiled output and production node_modules.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS api

RUN corepack enable && corepack prepare pnpm@latest --activate

# Run as non-root for least-privilege execution.
RUN addgroup --system --gid 1001 sentinel \
 && adduser  --system --uid 1001 --ingroup sentinel sentinel

WORKDIR /app

# Copy workspace manifests so pnpm can reconstruct the virtual store for
# production dependencies only.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json  ./packages/shared/package.json
COPY packages/core/package.json    ./packages/core/package.json

RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from the build stage.
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/core/dist   ./packages/core/dist

USER sentinel

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# The API entry point. Once a real server is wired up this will point to the
# compiled server module; for now it runs the core package output.
CMD ["node", "packages/core/dist/index.js"]

# -----------------------------------------------------------------------------
# Stage 5: web
# Minimal production image for the Sentinel web UI (packages/web).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS web

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN addgroup --system --gid 1001 sentinel \
 && adduser  --system --uid 1001 --ingroup sentinel sentinel

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json  ./packages/shared/package.json
COPY packages/core/package.json    ./packages/core/package.json
COPY packages/web/package.json     ./packages/web/package.json

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/core/dist   ./packages/core/dist
COPY --from=build /app/packages/web/dist    ./packages/web/dist

USER sentinel

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "packages/web/dist/index.js"]
