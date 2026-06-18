import { URL } from "node:url";

import { etagFor, HttpError, jsonResponse, readJsonBody, textResponse } from "./lib/http.js";

export function createApp(service) {
  return async function app(request) {
    const url = new URL(request.url, "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return textResponse(200, "ok");
      }

      if (request.method === "GET" && url.pathname === "/api/releases") {
        const releases = await service.listReleases();
        return jsonResponse(200, { data: releases }, { etag: etagFor(releases) });
      }

      if (request.method === "POST" && url.pathname === "/api/releases") {
        const body = await readJsonBody(request);
        const release = await service.createRelease(body);
        return jsonResponse(201, { data: release });
      }

      const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)$/);
      if (request.method === "GET" && releaseMatch) {
        const release = await service.getRelease(releaseMatch[1]);
        return jsonResponse(200, { data: release }, { etag: etagFor(release) });
      }

      const approvalMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/approvals$/);
      if (request.method === "POST" && approvalMatch) {
        const body = await readJsonBody(request);
        const release = await service.reviewRelease(approvalMatch[1], body);
        return jsonResponse(200, { data: release });
      }

      const scheduleMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/schedule$/);
      if (request.method === "POST" && scheduleMatch) {
        const body = await readJsonBody(request);
        const release = await service.scheduleRelease(scheduleMatch[1], body);
        return jsonResponse(200, { data: release });
      }

      const deployMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/deploy$/);
      if (request.method === "POST" && deployMatch) {
        const body = await readJsonBody(request);
        const release = await service.deployRelease(deployMatch[1], body);
        return jsonResponse(200, { data: release });
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const dashboard = await service.getDashboard();
        return jsonResponse(200, { data: dashboard }, { etag: etagFor(dashboard) });
      }

      return jsonResponse(404, {
        error: {
          code: "not_found",
          message: "Route was not found."
        }
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(error.statusCode, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        });
      }

      return jsonResponse(500, {
        error: {
          code: "internal_error",
          message: "Unexpected server error."
        }
      });
    }
  };
}
