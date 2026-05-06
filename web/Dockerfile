# syntax=docker/dockerfile:1.7

FROM node:24-bookworm AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY web/package.json ./package.json
RUN --mount=type=cache,id=zhushou-web-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
  pnpm install --no-frozen-lockfile

COPY web/ ./
RUN pnpm build

FROM nginx:1.27-alpine

ENV ZHUSHOU_GATEWAY_UPSTREAM=http://zhushou-gateway:18789

COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
