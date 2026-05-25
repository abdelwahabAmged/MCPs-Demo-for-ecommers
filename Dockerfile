FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY servers/b2c-commerce/package.json servers/b2c-commerce/
COPY servers/b2b-distributor/package.json servers/b2b-distributor/
COPY servers/parts-finder/package.json servers/parts-finder/
COPY servers/service-marketplace/package.json servers/service-marketplace/
COPY servers/internal-sales-rep/package.json servers/internal-sales-rep/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @mcp-demos/shared build
ARG SERVER
RUN pnpm --filter @mcp-demos/${SERVER} build

FROM base AS runtime
ARG SERVER
ENV NODE_ENV=production
ENV SERVER_NAME=${SERVER}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/servers/${SERVER}/dist ./servers/${SERVER}/dist
COPY --from=build /app/servers/${SERVER}/src/data ./servers/${SERVER}/src/data
COPY --from=build /app/servers/${SERVER}/package.json ./servers/${SERVER}/
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "node servers/$SERVER_NAME/dist/index.js"]
