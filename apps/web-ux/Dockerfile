FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @srip/web build

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable
COPY --from=base /workspace /workspace
EXPOSE 3000
CMD ["pnpm", "--filter", "@srip/web", "start"]
