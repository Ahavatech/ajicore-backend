FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Keep the Prisma CLI available in the runtime image because `npm start`
# runs `prisma migrate deploy` before booting the server.
RUN pnpm install --frozen-lockfile --prod=false

COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

RUN mkdir -p logs uploads && chown -R node:node /app/logs /app/uploads

USER node

EXPOSE 3000

CMD ["pnpm", "start"]
