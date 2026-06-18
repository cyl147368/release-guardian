import { createServer } from "node:http";

import { createApp } from "./app.js";
import { sendResponse } from "./lib/http.js";
import { Repository } from "./repository.js";
import { ReleaseService } from "./services/releaseService.js";

export function createRuntime({
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1",
  socketPath = process.env.SOCKET_PATH || "",
  repository = new Repository(),
  service = new ReleaseService(repository),
  logger = console,
  createServerImpl = createServer
} = {}) {
  const app = createApp(service);
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
