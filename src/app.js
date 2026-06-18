import { URL } from "node:url";

import { etagFor, HttpError, jsonResponse, readJsonBody, textResponse } from "./lib/http.js";

export function createApp(service) {
  return async function app(request) {
    const url = new URL(request.url, "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return textResponse(200, "ok");
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        const readiness = await service.getReadiness();
        const statusCode = readiness.status === "ready" ? 200 : 503;
        return jsonResponse(statusCode, { data: readiness }, { etag: etagFor(readiness) });
      }

      if (request.method === "GET" && url.pathname === "/api/releases") {
        const result = await service.listReleases(Object.fromEntries(url.searchParams));
        return jsonResponse(200, {
          data: result.items,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore: result.hasMore
          }
        }, { etag: etagFor(result) });
      }

      if (request.method === "POST" && url.pathname === "/api/releases") {
        const body = await readJsonBody(request);
        const release = await service.createRelease(body);
        return jsonResponse(201, { data: release });
      }

      if (request.method === "POST" && url.pathname === "/api/releases/bulk") {
        const body = await readJsonBody(request);
        const result = await service.bulkCreateReleases(body.releases || body);
        return jsonResponse(201, { data: result });
      }


      const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)$/);
      if (request.method === "GET" && releaseMatch) {
        const release = await service.getRelease(releaseMatch[1]);
        return jsonResponse(200, { data: release }, { etag: etagFor(release) });
      }

      const evidenceMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/evidence$/);
      if (request.method === "GET" && evidenceMatch) {
        const evidence = await service.getEvidencePackage(evidenceMatch[1]);
        return jsonResponse(200, { data: evidence }, { etag: etagFor(evidence) });
      }

      const conflictMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/conflicts$/);
      if (request.method === "GET" && conflictMatch) {
        const conflicts = await service.getReleaseConflicts(conflictMatch[1]);
        return jsonResponse(200, { data: conflicts }, { etag: etagFor(conflicts) });
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

      if (request.method === "GET" && url.pathname === "/api/escalations") {
        const escalations = await service.getEscalations();
        return jsonResponse(200, { data: escalations }, { etag: etagFor(escalations) });
      }

      if (request.method === "GET" && url.pathname === "/api/escalations/report") {
        const report = await service.getEscalationReport();
        return jsonResponse(200, { data: report }, { etag: etagFor(report) });
      }

      if (request.method === "GET" && url.pathname === "/api/policy") {
        const policy = await service.getPolicy();
        return jsonResponse(200, { data: policy }, { etag: etagFor(policy) });
      }


      if (request.method === "GET" && url.pathname === "/api/webhooks") {
        const subs = service.listWebhookSubscriptions();
        return jsonResponse(200, { data: subs }, { etag: etagFor(subs) });
      }

      if (request.method === "POST" && url.pathname === "/api/webhooks") {
        const body = await readJsonBody(request);
        const sub = service.subscribeWebhook(body);
        return jsonResponse(201, { data: sub });
      }

      const webhookMatch = url.pathname.match(/^\/api\/webhooks\/([^/]+)$/);
      if (request.method === "DELETE" && webhookMatch) {
        service.unsubscribeWebhook(webhookMatch[1]);
        return jsonResponse(204, null);
      }

      if (request.method === "GET" && url.pathname === "/api/webhooks/events") {
        const events = service.getWebhookEventLog(Object.fromEntries(url.searchParams));
        return jsonResponse(200, { data: events }, { etag: etagFor(events) });
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
