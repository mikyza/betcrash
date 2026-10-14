FROM node:22-alpine AS build
WORKDIR /app

# Copy ONLY package.json to ignore any corrupted or conflicting package-lock.json
COPY package.json ./

# Install dependencies ignoring peer conflicts
RUN npm install --legacy-peer-deps

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

# Copy next config conditionally or copy both ts/js if present
COPY --from=build /app/next.config.* ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "dist/server.js"]
