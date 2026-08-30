FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG API_PROXY_TARGET=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL API_PROXY_TARGET=$API_PROXY_TARGET
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
