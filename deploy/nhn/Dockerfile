FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1400
COPY package.json package-lock.json .npmrc ./
RUN npm install -g npm@11.19.0 && npm ci --no-audit --no-fund
COPY . .
RUN npm run typecheck && npm run check:validators && npm run test:unit && mkdir -p outputs && node tests/node-runtime.cjs && npm run build:nhn

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3100 BIZPROOF_DATA_DIR=/data
RUN groupadd -g 10001 bizproof && useradd -u 10001 -g bizproof bizproof
COPY --from=build --chown=10001:10001 /app/.next-nhn/standalone ./
COPY --from=build --chown=10001:10001 /app/.next-nhn/static ./.next-nhn/static
COPY --from=build --chown=10001:10001 /app/public ./public
COPY --from=build --chown=10001:10001 /app/scripts/update-geoip.mjs ./scripts/update-geoip.mjs
USER 10001
EXPOSE 3100
CMD ["node","server.js"]
