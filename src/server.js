import { createServer } from "node:http";

import { createApp } from "./app.js";
import { sendResponse } from "./lib/http.js";
import { Repository } from "./repository.js";
import { ReleaseService } from "./services/releaseService.js";

const port = Number(process.env.PORT || 3000);
const repository = new Repository();
const service = new ReleaseService(repository);
const app = createApp(service);

const server = createServer(async (request, response) => {
  const payload = await app(request);
  sendResponse(response, payload);
});

server.listen(port, () => {
  console.log(`Release Guardian listening on http://localhost:${port}`);
});
