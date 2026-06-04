FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@yezz/api", "exec", "tsx", "src/index.ts"]
