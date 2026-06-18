import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readOpenApi() {
  return readFile(new URL("../openapi/openapi.yaml", import.meta.url), "utf8");
}

test("OpenAPI contract declares all public routes", async () => {
  const contract = await readOpenApi();

  for (const route of [
    "/health:",
    "/ready:",
    "/api/releases:",
    "/api/releases/bulk:",
    "/api/releases/{releaseId}:",
    "/api/releases/{releaseId}/evidence:",
    "/api/releases/{releaseId}/conflicts:",
    "/api/releases/{releaseId}/approvals:",
    "/api/releases/{releaseId}/schedule:",
    "/api/releases/{releaseId}/deploy:",
    "/api/dashboard:",
    "/api/escalations:",
    "/api/escalations/report:",
    "/api/policy:",
    "/api/webhooks:",
    "/api/webhooks/{webhookId}:",
    "/api/webhooks/events:"
  ]) {
    assert.match(contract, new RegExp(`^  ${escapeRegExp(route)}`, "m"));
  }
});

test("OpenAPI contract documents critical request and response schemas", async () => {
  const contract = await readOpenApi();

  for (const schema of [
    "CreateReleaseRequest:",
    "ReviewReleaseRequest:",
    "ScheduleReleaseRequest:",
    "DeployReleaseRequest:",
    "Release:",
    "EvidencePackage:",
    "EscalationReport:",
    "ErrorResponse:",
    "Readiness:",
    "ReadinessResponse:",
    "BulkCreateResult:",
    "BulkCreateResponse:",
    "WebhookSubscription:",
    "CreateWebhookRequest:",
    "WebhookEvent:",
    "WebhookEventLogResponse:"
  ]) {
    assert.match(contract, new RegExp(`^    ${escapeRegExp(schema)}`, "m"));
  }
});

test("OpenAPI contract includes security and rate limit responses", async () => {
  const contract = await readOpenApi();

  for (const response of [
    "BadRequest:",
    "NotFound:",
    "Conflict:",
    "Unauthorized:",
    "TooManyRequests:"
  ]) {
    assert.match(contract, new RegExp(`^    ${escapeRegExp(response)}`, "m"));
  }
});

test("OpenAPI contract includes rate limit headers", async () => {
  const contract = await readOpenApi();

  for (const header of [
    "Retry-After:",
    "X-RateLimit-Limit:",
    "X-RateLimit-Remaining:",
    "X-RateLimit-Reset:"
  ]) {
    assert.match(contract, new RegExp(escapeRegExp(header)));
  }
});

test("OpenAPI contract preserves governance-specific schema fields", async () => {
  const contract = await readOpenApi();

  for (const field of [
    "evidencePackageId:",
    "evidenceId:",
    "release_window_conflict",
    "customerImpactScore:",
    "dataSensitivityScore:",
    "minimum: 0",
    "maximum: 5"
  ]) {
    assert.match(contract, new RegExp(escapeRegExp(field)));
  }
});

test("OpenAPI contract documents webhook and bulk tags", async () => {
  const contract = await readOpenApi();

  for (const tag of [
    "Health",
    "Releases",
    "Governance",
    "Reporting",
    "Webhooks"
  ]) {
    assert.match(contract, new RegExp(`- name: ${escapeRegExp(tag)}`));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
