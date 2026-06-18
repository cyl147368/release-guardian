import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Repository } from "../src/repository.js";
import { ReleaseService } from "../src/services/releaseService.js";

async function createFixtureRepository() {
  const directory = await mkdtemp(join(tmpdir(), "release-guardian-"));
  const filePath = join(directory, "seed.json");
  const seed = await readFile(new URL("../data/seed.json", import.meta.url), "utf8");
  await writeFile(filePath, seed, "utf8");
  return new Repository(filePath);
}

function buildPayload() {
  return {
    application: "billing-api",
    version: "2026.06.18",
    environment: "production",
    serviceTier: "tier_1",
    changeCategory: "normal",
    plannedStartAt: "2026-06-20T08:00:00.000Z",
    plannedEndAt: "2026-06-20T09:00:00.000Z",
    summary: "Enable a new reconciliation workflow for enterprise invoices.",
    components: ["api", "worker", "scheduler"],
    owner: "alice",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 4,
      dataSensitivityScore: 5
    }
  };
}

test("createRelease computes high risk and approval chain for production tier_1 changes", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease(buildPayload());

  assert.equal(release.application, "billing-api");
  assert.equal(release.risk.band, "critical");
  assert.equal(release.status, "pending_approval");
  assert.deepEqual(
    release.approvals.map((item) => item.team),
    ["release_management", "sre", "security"]
  );
  assert.equal(release.approvals.every((item) => item.status === "pending"), true);
});

test("reviewRelease transitions to approved once all teams approve", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const release = await service.createRelease(buildPayload());

  await service.reviewRelease(release.id, {
    team: "release_management",
    actor: "manager",
    decision: "approved"
  });
  await service.reviewRelease(release.id, {
    team: "sre",
    actor: "sre-lead",
    decision: "approved"
  });
  const approved = await service.reviewRelease(release.id, {
    team: "security",
    actor: "security-lead",
    decision: "approved"
  });

  assert.equal(approved.status, "approved");
  assert.equal(approved.approvals.every((item) => item.status === "approved"), true);
});

test("scheduleRelease rejects scheduling before approval", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const release = await service.createRelease(buildPayload());

  await assert.rejects(
    service.scheduleRelease(release.id, {
      actor: "alice",
      scheduledAt: "2026-06-20T08:00:00.000Z"
    }),
    /Only approved releases can be scheduled/
  );
});

test("createRelease auto-approves low-risk releases consistently", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const release = await service.createRelease({
    application: "docs-site",
    version: "1.0.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-18T08:00:00.000Z",
    plannedEndAt: "2026-06-18T09:00:00.000Z",
    summary: "Publish a minor documentation update.",
    components: ["site"],
    owner: "bob",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  });

  assert.equal(release.status, "approved");
  assert.equal(release.approvals.every((item) => item.status === "approved"), true);
});

test("listReleases filters by environment, status, application, owner, and risk band", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await service.createRelease(buildPayload());
  await service.createRelease({
    application: "docs-site",
    version: "1.0.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-18T08:00:00.000Z",
    plannedEndAt: "2026-06-18T09:00:00.000Z",
    summary: "Publish a minor documentation update.",
    components: ["site"],
    owner: "bob",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  });

  const production = await service.listReleases({ environment: "production" });
  const approvedDocs = await service.listReleases({
    status: "approved",
    application: "docs",
    owner: "bob",
    riskBand: "low"
  });

  assert.equal(production.length, 1);
  assert.equal(production[0].environment, "production");
  assert.equal(approvedDocs.length, 1);
  assert.equal(approvedDocs[0].application, "docs-site");
});

test("listReleases supports pagination, sorting, and pending approval filters", async () => {
  const repository = await createFixtureRepository();
  let tick = 0;
  const service = new ReleaseService(repository, () =>
    new Date(Date.UTC(2026, 5, 18, 0, tick++, 0)).toISOString()
  );

  const critical = await service.createRelease(buildPayload());
  await service.createRelease({
    application: "docs-site",
    version: "1.0.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-18T08:00:00.000Z",
    plannedEndAt: "2026-06-18T09:00:00.000Z",
    summary: "Publish a minor documentation update.",
    components: ["site"],
    owner: "bob",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  });

  const pending = await service.listReleases({
    pendingApprovals: "true",
    sort: "riskScore",
    order: "desc",
    limit: "1",
    offset: "0"
  });
  const secondPage = await service.listReleases({
    sort: "application",
    order: "asc",
    limit: "1",
    offset: "1"
  });

  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, critical.id);
  assert.equal(secondPage.length, 1);
  assert.equal(secondPage[0].application, "docs-site");
});

test("listReleases rejects invalid query controls", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    service.listReleases({ limit: "101" }),
    /limit must be an integer between 1 and 100/
  );
  await assert.rejects(
    service.listReleases({ pendingApprovals: "sometimes" }),
    /pendingApprovals must be true or false/
  );
});

test("createRelease records same-application window conflicts", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const first = await service.createRelease(buildPayload());
  const second = await service.createRelease({
    ...buildPayload(),
    version: "2026.06.18-b",
    plannedStartAt: "2026-06-20T08:30:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z"
  });

  assert.equal(second.conflicts.length, 1);
  assert.equal(second.conflicts[0].releaseId, first.id);
});

test("getReleaseConflicts returns current overlapping release windows", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await service.createRelease(buildPayload());
  const second = await service.createRelease({
    ...buildPayload(),
    version: "2026.06.18-c",
    plannedStartAt: "2026-06-20T08:30:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z"
  });

  const conflicts = await service.getReleaseConflicts(second.id);

  assert.equal(conflicts.totalConflicts, 1);
  assert.equal(conflicts.conflicts[0].reason, "same application, same environment, overlapping release window");
});

test("getEscalations summarizes overdue approvals, high-risk pending releases, and conflicts", async () => {
  const repository = await createFixtureRepository();
  let currentTime = "2026-06-18T00:00:00.000Z";
  const service = new ReleaseService(repository, () => currentTime);

  await service.createRelease(buildPayload());
  await service.createRelease({
    ...buildPayload(),
    version: "2026.06.18-overlap",
    plannedStartAt: "2026-06-20T08:30:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z"
  });

  currentTime = "2026-06-18T10:30:00.000Z";
  const escalations = await service.getEscalations();

  assert.equal(escalations.counts.overdueApprovals, 6);
  assert.equal(escalations.counts.highRiskPending, 2);
  assert.equal(escalations.counts.conflictRisks, 2);
  assert.equal(escalations.overdueApprovals[0].ageHours, 10.5);
});

test("getEscalationReport creates an auditable executive escalation report", async () => {
  const repository = await createFixtureRepository();
  let currentTime = "2026-06-18T00:00:00.000Z";
  const service = new ReleaseService(repository, () => currentTime);

  await service.createRelease(buildPayload());
  await service.createRelease({
    ...buildPayload(),
    version: "2026.06.18-overlap",
    plannedStartAt: "2026-06-20T08:30:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z"
  });

  currentTime = "2026-06-18T10:30:00.000Z";
  const report = await service.getEscalationReport();
  const repeatedReport = await service.getEscalationReport();

  assert.match(report.reportId, /^esc-[a-f0-9]{16}$/);
  assert.equal(report.reportId, repeatedReport.reportId);
  assert.equal(report.executiveSummary.totalEscalations, 10);
  assert.equal(report.executiveSummary.topSeverity, "critical");
  assert.equal(report.executiveSummary.counts.bySeverity.critical, 8);
  assert.equal(report.executiveSummary.counts.bySeverity.high, 2);
  assert.equal(report.rows[0].category, "high_risk_pending");
  assert.equal(report.rows[0].severity, "critical");
  assert.ok(report.recommendedActions.some((item) => item.priority === "P0"));
  assert.ok(
    report.rows.some((row) => row.category === "release_window_conflict" && row.severity === "high")
  );
});

test("getPolicy returns governance rules and score bounds", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const policy = await service.getPolicy();

  assert.equal(policy.serviceTiers.length, 3);
  assert.equal(policy.riskBands[3].code, "critical");
  assert.equal(policy.controlScoreBounds.customerImpactScore.max, 5);
});

test("getEvidencePackage assembles audit-ready release evidence", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const release = await service.createRelease(buildPayload());

  for (const [team, actor] of [
    ["release_management", "manager"],
    ["sre", "sre-lead"],
    ["security", "security-lead"]
  ]) {
    await service.reviewRelease(release.id, {
      team,
      actor,
      decision: "approved"
    });
  }

  await service.scheduleRelease(release.id, {
    actor: "release-bot",
    scheduledAt: "2026-06-20T08:00:00.000Z"
  });
  await service.deployRelease(release.id, {
    actor: "release-bot",
    outcome: "deployed",
    startedAt: "2026-06-20T08:00:00.000Z",
    finishedAt: "2026-06-20T08:30:00.000Z"
  });

  const evidence = await service.getEvidencePackage(release.id);

  assert.equal(evidence.summary.auditReady, true);
  assert.ok(evidence.evidence.some((item) => item.control === "control:automated-tests"));
  assert.ok(evidence.evidence.some((item) => item.control === "approval:release_management"));
  assert.equal(evidence.evidence.at(-1).control, "deployment:outcome-recorded");
});

test("deployRelease records deployment outcome and dashboard metrics", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const release = await service.createRelease(buildPayload());

  for (const [team, actor] of [
    ["release_management", "manager"],
    ["sre", "sre-lead"],
    ["security", "security-lead"]
  ]) {
    await service.reviewRelease(release.id, {
      team,
      actor,
      decision: "approved"
    });
  }

  await service.scheduleRelease(release.id, {
    actor: "release-bot",
    scheduledAt: "2026-06-20T08:00:00.000Z",
    rollbackPlan: "Restore previous deployment artifact."
  });

  const deployed = await service.deployRelease(release.id, {
    actor: "release-bot",
    outcome: "deployed",
    startedAt: "2026-06-20T08:00:00.000Z",
    finishedAt: "2026-06-20T08:30:00.000Z"
  });

  assert.equal(deployed.status, "deployed");

  const dashboard = await service.getDashboard();
  assert.equal(dashboard.totalReleases, 1);
  assert.equal(dashboard.byStatus.deployed, 1);
  assert.equal(dashboard.changeFailureRate, 0);
});
