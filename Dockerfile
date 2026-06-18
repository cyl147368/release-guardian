# ---- Build stage ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .

# ---- Production stage ----
FROM node:24-alpine AS production
LABEL org.opencontainers.image.source="https://github.com/cyl147368/release-guardian"
LABEL org.opencontainers.image.description="Enterprise-grade release governance API with web console"
LABEL org.opencontainers.image.title="Release Guardian"

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser

WORKDIR /app

# 复制运行时所需文件
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/openapi ./openapi

# 数据目录权限
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
