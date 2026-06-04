FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production

RUN pnpm --filter @yezz/api run build

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["pnpm", "--filter", "@yezz/api", "run", "start"]
