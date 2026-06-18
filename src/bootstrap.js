import { createServer } from "node:http";

import { createApp } from "./app.js";
import { sendResponse } from "./lib/http.js";
import { createLogger } from "./lib/logger.js";
import { withApiKeyAuth, withRateLimit, withRequestLogging } from "./lib/middleware.js";
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
  apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(",").map((k) => k.trim()).filter(Boolean) : []
} = {}) {
  let app = createApp(service);

  // Layer middleware: auth → rate limit → logging → app
  if (apiKeys.length > 0) {
    app = withApiKeyAuth(app, { apiKeys });
  }
  if (enableRateLimit) {
    app = withRateLimit(app, { maxRequests: rateLimitMax, windowMs: rateLimitWindowMs });
  }
  app = withRequestLogging(app, structuredLogger);

  const server = createServerImpl(async (request, response) => {
    const payload = await app(request);
    sendResponse(response, payload);
  });

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

  return {
    app,
    server,
    listen
  };
}
