FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @nuit-one/web build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/apps/web/package.json .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000


# Audit 2026-04-23 (cross-cutting I.1): run as non-root `node` (uid 1000)
# baked into the node:22-slim base image.
RUN chown -R node:node /app
USER node

CMD ["node", "build"]
