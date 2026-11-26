# Web GAMC — Next.js 15 con `output: 'standalone'`.
# Build multi-etapa: la imagen final solo contiene el servidor standalone.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* se compila dentro del bundle: hay que pasarlos en el build.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WEBSOCKET_URL
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
ARG NEXT_PUBLIC_MAP_DEFAULT_LAT
ARG NEXT_PUBLIC_MAP_DEFAULT_LNG
ARG NEXT_PUBLIC_MAP_DEFAULT_ZOOM
ARG NEXT_PUBLIC_MAP_TILE_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_WEBSOCKET_URL=$NEXT_PUBLIC_WEBSOCKET_URL \
    NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=$NEXT_PUBLIC_MAP_TILE_ATTRIBUTION \
    NEXT_PUBLIC_MAP_DEFAULT_LAT=$NEXT_PUBLIC_MAP_DEFAULT_LAT \
    NEXT_PUBLIC_MAP_DEFAULT_LNG=$NEXT_PUBLIC_MAP_DEFAULT_LNG \
    NEXT_PUBLIC_MAP_DEFAULT_ZOOM=$NEXT_PUBLIC_MAP_DEFAULT_ZOOM \
    NEXT_PUBLIC_MAP_TILE_API_KEY=$NEXT_PUBLIC_MAP_TILE_API_KEY

RUN npm run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
