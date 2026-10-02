# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Apify Standby injects ACTOR_WEB_SERVER_PORT / APIFY_CONTAINER_PORT;
# local runs fall back to 3000.
EXPOSE 3000

CMD ["node", "dist/apify-http.js"]
