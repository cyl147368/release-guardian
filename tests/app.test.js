import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createApp } from "../src/app.js";
import { Repository } from "../src/repository.js";
import { ReleaseService } from "../src/services/releaseService.js";

async function createFixtureApp() {
  const directory = await mkdtemp(join(tmpdir(), "release-guardian-app-"));
  const filePath = join(directory, "seed.json");
  const seed = await readFile(new URL("../data/seed.json", import.meta.url), "utf8");
  await writeFile(filePath, seed, "utf8");

  const service = new ReleaseService(
    new Repository(filePath),
    () => "2026-06-18T00:00:00.000Z"
  );
  return createApp(service);
}

function buildRequest(method, url, body) {
  const stream = Readable.from(body ? [JSON.stringify(body)] : []);
  stream.method = method;
  stream.url = url;
  return stream;
}

function createPayload() {
  return {
    application: "ops-portal",
    version: "2.1.0",
    environment: "staging",
    serviceTier: "tier_2",
    changeCategory: "standard",
    plannedStartAt: "2026-06-21T08:00:00.000Z",
    plannedEndAt: "2026-06-21T09:00:00.000Z",
    summary: "Ship refined operator dashboard widgets.",
    components: ["frontend"],
    owner: "carol",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 2,
      dataSensitivityScore: 1
    }
  };
}

test("GET /health returns ok", async () => {
  const app = await createFixtureApp();
  const response = await app(buildRequest("GET", "/health"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "ok");
});

test("POST /api/releases creates a release", async () => {
  const app = await createFixtureApp();
  const response = await app(buildRequest("POST", "/api/releases", createPayload()));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.application, "ops-portal");
  assert.equal(body.data.status, "approved");
});

test("GET /api/dashboard returns aggregate data", async () => {
  const app = await createFixtureApp();
  await app(buildRequest("POST", "/api/releases", createPayload()));
  const response = await app(buildRequest("GET", "/api/dashboard"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.totalReleases, 1);
  assert.equal(body.data.byEnvironment.staging, 1);
});

test("GET /api/releases supports filters", async () => {
  const app = await createFixtureApp();
  await app(buildRequest("POST", "/api/releases", createPayload()));
  const response = await app(buildRequest("GET", "/api/releases?environment=staging&status=approved&riskBand=medium&sort=riskScore&order=desc&limit=10&offset=0"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].application, "ops-portal");
});

test("GET /api/releases rejects invalid pagination", async () => {
  const app = await createFixtureApp();
  const response = await app(buildRequest("GET", "/api/releases?limit=0"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, "validation_error");
});

test("GET /api/policy returns governance policy", async () => {
  const app = await createFixtureApp();
  const response = await app(buildRequest("GET", "/api/policy"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.riskBands[2].code, "high");
});

test("GET /api/releases/:id/evidence returns audit package", async () => {
  const app = await createFixtureApp();
  const payload = createPayload();
  payload.environment = "production";
  payload.serviceTier = "tier_1";
  payload.components = ["frontend", "api", "worker"];
  payload.controls.customerImpactScore = 4;
  payload.controls.dataSensitivityScore = 5;

  const createdResponse = await app(buildRequest("POST", "/api/releases", payload));
  const created = JSON.parse(createdResponse.body).data;

  const approvalInputs = [
    ["release_management", "manager"],
    ["sre", "sre-lead"]
  ];
  for (const [team, actor] of approvalInputs) {
    await app(buildRequest("POST", `/api/releases/${created.id}/approvals`, {
      team,
      actor,
      decision: "approved"
    }));
  }

  const approvalResponse = await app(buildRequest("POST", `/api/releases/${created.id}/approvals`, {
    team: "security",
    actor: "security-lead",
    decision: "approved"
  }));
  const approved = JSON.parse(approvalResponse.body).data;

  const scheduledResponse = await app(buildRequest("POST", `/api/releases/${approved.id}/schedule`, {
    actor: "release-bot",
    scheduledAt: "2026-06-21T10:00:00.000Z"
  }));
  const scheduled = JSON.parse(scheduledResponse.body).data;

  await app(buildRequest("POST", `/api/releases/${scheduled.id}/deploy`, {
    actor: "release-bot",
    outcome: "deployed",
    startedAt: "2026-06-21T10:00:00.000Z",
    finishedAt: "2026-06-21T10:30:00.000Z"
  }));

  const response = await app(buildRequest("GET", `/api/releases/${scheduled.id}/evidence`));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.match(body.data.evidencePackageId, /^pkg-[a-f0-9]{16}$/);
  assert.equal(body.data.summary.auditReady, true);
  assert.equal(body.data.summary.openConflicts, 0);
  assert.equal(body.data.summary.escalationFlags, 0);
  assert.ok(body.data.evidence.every((item) => /^ev-[a-f0-9]{12}$/.test(item.evidenceId)));
  assert.ok(body.data.evidence.some((item) => item.control === "deployment:outcome-recorded"));
});

test("GET /api/releases/:id/conflicts returns release-window conflicts", async () => {
  const app = await createFixtureApp();
  const firstPayload = createPayload();
  firstPayload.environment = "production";
  firstPayload.serviceTier = "tier_1";
  firstPayload.plannedStartAt = "2026-06-21T08:00:00.000Z";
  firstPayload.plannedEndAt = "2026-06-21T09:00:00.000Z";
  firstPayload.components = ["frontend", "api"];
  firstPayload.controls.customerImpactScore = 4;
  firstPayload.controls.dataSensitivityScore = 5;

  await app(buildRequest("POST", "/api/releases", firstPayload));

  const secondPayload = {
    ...firstPayload,
    version: "2.1.1",
    plannedStartAt: "2026-06-21T08:30:00.000Z",
    plannedEndAt: "2026-06-21T09:30:00.000Z"
  };
  const createdResponse = await app(buildRequest("POST", "/api/releases", secondPayload));
  const created = JSON.parse(createdResponse.body).data;

  const response = await app(buildRequest("GET", `/api/releases/${created.id}/conflicts`));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.totalConflicts, 1);
  assert.equal(body.data.conflicts[0].application, "ops-portal");
});

test("POST /api/releases/:id/schedule rejects active release-window conflicts", async () => {
  const app = await createFixtureApp();
  const firstPayload = createPayload();
  firstPayload.environment = "development";
  firstPayload.serviceTier = "tier_3";
  firstPayload.controls.customerImpactScore = 0;
  firstPayload.controls.dataSensitivityScore = 0;

  await app(buildRequest("POST", "/api/releases", firstPayload));
  const secondResponse = await app(buildRequest("POST", "/api/releases", {
    ...firstPayload,
    version: "2.1.1",
    plannedStartAt: "2026-06-21T08:30:00.000Z",
    plannedEndAt: "2026-06-21T09:30:00.000Z"
  }));
  const second = JSON.parse(secondResponse.body).data;

  const response = await app(buildRequest("POST", `/api/releases/${second.id}/schedule`, {
    actor: "carol",
    scheduledAt: "2026-06-21T08:30:00.000Z"
  }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 409);
  assert.equal(body.error.code, "release_window_conflict");
  assert.equal(body.error.details.conflicts.length, 1);
});

test("GET /api/escalations returns operational escalation summary", async () => {
  const app = await createFixtureApp();
  const payload = createPayload();
  payload.environment = "production";
  payload.serviceTier = "tier_1";
  payload.components = ["frontend", "api"];
  payload.controls.customerImpactScore = 4;
  payload.controls.dataSensitivityScore = 5;

  await app(buildRequest("POST", "/api/releases", payload));
  const response = await app(buildRequest("GET", "/api/escalations"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.counts.highRiskPending, 1);
  assert.equal(body.data.highRiskPending[0].application, "ops-portal");
});

test("GET /api/escalations/report returns executive escalation report", async () => {
  const app = await createFixtureApp();
  const payload = createPayload();
  payload.environment = "production";
  payload.serviceTier = "tier_1";
  payload.components = ["frontend", "api"];
  payload.controls.customerImpactScore = 4;
  payload.controls.dataSensitivityScore = 5;

  await app(buildRequest("POST", "/api/releases", payload));
  const response = await app(buildRequest("GET", "/api/escalations/report"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.match(body.data.reportId, /^esc-[a-f0-9]{16}$/);
  assert.equal(body.data.title, "Release Guardian Escalation Report");
  assert.equal(body.data.executiveSummary.totalEscalations, 1);
  assert.equal(body.data.rows[0].category, "high_risk_pending");
  assert.equal(body.data.recommendedActions[0].priority, "P0");
});

test("POST /api/releases rejects score bounds outside policy", async () => {
  const app = await createFixtureApp();
  const payload = createPayload();
  payload.controls.customerImpactScore = 6;

  const response = await app(buildRequest("POST", "/api/releases", payload));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, "validation_error");
});

test("POST /api/releases rejects invalid JSON", async () => {
  const app = await createFixtureApp();
  const stream = Readable.from(["{invalid"]);
  stream.method = "POST";
  stream.url = "/api/releases";

  const response = await app(stream);
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, "invalid_json");
});

test("POST /api/releases rejects invalid timestamps", async () => {
  const app = await createFixtureApp();
  const payload = createPayload();
  payload.plannedEndAt = "not-a-date";

  const response = await app(buildRequest("POST", "/api/releases", payload));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, "validation_error");
});
