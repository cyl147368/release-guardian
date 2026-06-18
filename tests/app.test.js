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
