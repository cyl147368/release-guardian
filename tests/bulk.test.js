import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ReleaseService } from "../src/services/releaseService.js";
import { Repository } from "../src/repository.js";
import { createApp } from "../src/app.js";

function fixedClock() {
  return "2026-06-18T12:00:00.000Z";
}

function validRelease(overrides = {}) {
  return {
    application: "billing-api",
    version: "1.0.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-20T08:00:00.000Z",
    plannedEndAt: "2026-06-20T09:00:00.000Z",
    summary: "Routine update.",
    components: ["api"],
    owner: "tester",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: false,
      customerImpactScore: 1,
      dataSensitivityScore: 1
    },
    ...overrides
  };
}

class InMemoryRepository {
  constructor(data = { releases: [], teams: [{ name: "release_management" }, { name: "sre" }, { name: "security" }] }) {
    this.data = JSON.parse(JSON.stringify(data));
  }
  async load() { return JSON.parse(JSON.stringify(this.data)); }
  async save(data) { this.data = JSON.parse(JSON.stringify(data)); }
}

describe("bulkCreateReleases", () => {
  let service;
  let repo;

  beforeEach(() => {
    repo = new InMemoryRepository();
    service = new ReleaseService(repo, fixedClock);
  });

  it("creates multiple releases in a single call", async () => {
    const result = await service.bulkCreateReleases([
      validRelease({ application: "app-a", version: "1.0.0" }),
      validRelease({ application: "app-b", version: "2.0.0" })
    ]);

    assert.equal(result.created, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.releases.length, 2);
    assert.equal(result.releases[0].application, "app-a");
    assert.equal(result.releases[1].application, "app-b");
    assert.equal(result.errors.length, 0);
  });

  it("rejects empty arrays", async () => {
    await assert.rejects(
      () => service.bulkCreateReleases([]),
      { code: "validation_error" }
    );
  });

  it("rejects arrays exceeding 50 items", async () => {
    const inputs = Array.from({ length: 51 }, () => validRelease());
    await assert.rejects(
      () => service.bulkCreateReleases(inputs),
      { code: "validation_error" }
    );
  });

  it("continues processing when individual items fail", async () => {
    const result = await service.bulkCreateReleases([
      validRelease({ application: "good-app", version: "1.0.0" }),
      { application: "", version: "", environment: "invalid" },
      validRelease({ application: "another-good", version: "2.0.0" })
    ]);

    assert.equal(result.created, 2);
    assert.equal(result.failed, 1);
    assert.equal(result.errors[0].index, 1);
    assert.equal(result.errors[0].code, "validation_error");
  });

  it("persists all created releases to the repository", async () => {
    await service.bulkCreateReleases([
      validRelease({ application: "x", version: "1" }),
      validRelease({ application: "y", version: "2" }),
      validRelease({ application: "z", version: "3" })
    ]);

    const db = await repo.load();
    assert.equal(db.releases.length, 3);
  });

  it("marks timeline entries as bulk operation", async () => {
    const result = await service.bulkCreateReleases([
      validRelease()
    ]);

    assert.equal(result.releases[0].timeline[0].detail, "Release request created via bulk operation.");
  });
});

describe("POST /api/releases/bulk via app", () => {
  it("returns 201 with bulk result", async () => {
    const repo = new InMemoryRepository();
    const service = new ReleaseService(repo, fixedClock);
    const app = createApp(service);

    const request = {
      method: "POST",
      url: "http://localhost/api/releases/bulk",
      headers: {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({
          releases: [
            validRelease({ application: "bulk-a", version: "1" }),
            validRelease({ application: "bulk-b", version: "2" })
          ]
        }));
      }
    };

    const response = await app(request);
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.data.created, 2);
    assert.equal(body.data.failed, 0);
  });
});
