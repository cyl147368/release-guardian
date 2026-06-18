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
    "/api/releases:",
    "/api/releases/{releaseId}:",
    "/api/releases/{releaseId}/evidence:",
    "/api/releases/{releaseId}/conflicts:",
    "/api/releases/{releaseId}/approvals:",
    "/api/releases/{releaseId}/schedule:",
    "/api/releases/{releaseId}/deploy:",
    "/api/dashboard:",
    "/api/escalations:",
    "/api/escalations/report:",
    "/api/policy:"
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
    "ErrorResponse:"
  ]) {
    assert.match(contract, new RegExp(`^    ${escapeRegExp(schema)}`, "m"));
  }

  assert.match(contract, /#\/components\/schemas\/CreateReleaseRequest/);
  assert.match(contract, /#\/components\/schemas\/EvidencePackageResponse/);
  assert.match(contract, /#\/components\/responses\/Conflict/);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
