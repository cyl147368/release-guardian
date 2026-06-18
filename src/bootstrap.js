import { createServer } from "node:http";

import { createApp } from "./app.js";
import { createAuditLog } from "./lib/audit.js";
import { sendResponse } from "./lib/http.js";
import { createLogger } from "./lib/logger.js";
import { createMetrics } from "./lib/metrics.js";
import { createWebSocketServer } from "./lib/websocket.js";
import {
  withApiKeyAuth,
  withBodySizeLimit,
  withContentTypeValidation,
  withCors,
  withRateLimit,
  withRequestLogging,
  withSecurityHeaders,
} from "./lib/middleware.js";
import { Repository } from "./repository.js";
import { ReleaseService } from "./services/releaseService.js";

export function createRuntime({
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1",
  socketPath = process.env.SOCKET_PATH || "",
  repository = new Repository(),
  service = new ReleaseService(repository),
  logger = console,
  structuredLogger = createLogger(),
  createServerImpl = createServer,
  enableRateLimit = process.env.RATE_LIMIT_ENABLED === "true",
  rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100),
  rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(",").map((k) => k.trim()).filter(Boolean) : [],
  corsOrigin = process.env.CORS_ORIGIN || "*",
  enableSecurityHeaders = process.env.SECURITY_HEADERS !== "false",
  maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1048576),
} = {}) {
  // 创建审计日志和指标收集器
  const auditLog = createAuditLog();
  const metrics = createMetrics();

  // 创建 WebSocket 服务器（延迟初始化，需要 HTTP server 实例）
  let wsServer = null;
  
  let app = createApp(service, { auditLog, metrics, wsBroadcast: (event, data) => wsServer?.broadcast(event, data) });

  // 中间件管道：指标记录 → 安全头 → CORS → 内容类型验证 → 请求体限制 → 认证 → 速率限制 → 请求日志 → 应用
  app = withMetrics(app, metrics);
  if (enableSecurityHeaders) app = withSecurityHeaders(app);
  app = withCors(app, { allowOrigin: corsOrigin });
  app = withContentTypeValidation(app);
  app = withBodySizeLimit(app, { maxBytes: maxBodyBytes });
  if (apiKeys.length > 0) app = withApiKeyAuth(app, { apiKeys });
  if (enableRateLimit) app = withRateLimit(app, { maxRequests: rateLimitMax, windowMs: rateLimitWindowMs });
  app = withRequestLogging(app, structuredLogger);

  const server = createServerImpl(async (request, response) => {
    const payload = await app(request);
    sendResponse(response, payload);
  });

  // 初始化 WebSocket 服务器
  wsServer = createWebSocketServer({
    httpServer: server,
    onConnection: (clientId) => {
      structuredLogger.info("ws_client_connected", { clientId });
      metrics.recordRequest("WS", "/ws", 101, 0);
    },
    onDisconnect: (clientId) => {
      structuredLogger.info("ws_client_disconnected", { clientId });
    },
  });

  // 优雅关闭
  let shuttingDown = false;

  function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    structuredLogger.info("shutdown_started", { signal });

    server.close(() => {
      structuredLogger.info("shutdown_completed", { signal });
      process.exit(0);
    });

    setTimeout(() => {
      structuredLogger.error("shutdown_forced", { signal });
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  async function listen() {
    return await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      server.once("error", onError);

      const onListening = () => {
        server.off("error", onError);
        const address = socketPath ? `unix://${socketPath}` : `http://${host}:${port}`;
        logger.log(`Release Guardian listening on ${address}`);
        resolve({ address, server });
      };

      if (socketPath) {
        server.listen(socketPath, onListening);
      } else {
        server.listen(port, host, onListening);
      }
    });
  }

  return { app, server, listen, auditLog, metrics, wsServer };
}

/**
 * 指标收集中间件
 */
function withMetrics(app, metrics) {
  return async function metricsApp(request) {
    const start = performance.now();
    const url = new URL(request.url, "http://localhost");
    const payload = await app(request);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    metrics.recordRequest(request.method, url.pathname, payload.statusCode, durationMs);
    return payload;
  };
}
