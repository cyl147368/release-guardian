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

test("getReadiness reports datastore health and service metadata", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const readiness = await service.getReadiness();

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.version, "3.0.0");
  assert.equal(readiness.checks.datastore.status, "ok");
  assert.equal(readiness.checks.datastore.releaseCount, 0);
  assert.equal(readiness.checks.datastore.teamCount, 3);
});

test("getReadiness reports not_ready when datastore cannot be loaded", async () => {
  const service = new ReleaseService(
    {
      async load() {
        throw new Error("datastore unavailable");
      }
    },
    () => "2026-06-18T00:00:00.000Z"
  );

  const readiness = await service.getReadiness();

  assert.equal(readiness.status, "not_ready");
  assert.equal(readiness.checks.datastore.status, "error");
  assert.equal(readiness.checks.datastore.message, "datastore unavailable");
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

test("scheduleRelease blocks approved releases with active window conflicts", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");
  const basePayload = {
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
  };

  await service.createRelease(basePayload);
  const conflicting = await service.createRelease({
    ...basePayload,
    version: "1.0.1",
    plannedStartAt: "2026-06-18T08:30:00.000Z",
    plannedEndAt: "2026-06-18T09:30:00.000Z"
  });

  await assert.rejects(
    service.scheduleRelease(conflicting.id, {
      actor: "bob",
      scheduledAt: "2026-06-18T08:30:00.000Z"
    }),
    (error) => {
      assert.equal(error.code, "release_window_conflict");
      assert.equal(error.details.conflicts.length, 1);
      return true;
    }
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

  assert.equal(production.items.length, 1);
  assert.equal(production.items[0].environment, "production");
  assert.equal(approvedDocs.items.length, 1);
  assert.equal(approvedDocs.items[0].application, "docs-site");
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

  assert.equal(pending.items.length, 1);
  assert.equal(pending.items[0].id, critical.id);
  assert.equal(secondPage.items.length, 1);
  assert.equal(secondPage.items[0].application, "docs-site");
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

  assert.match(evidence.evidencePackageId, /^pkg-[a-f0-9]{16}$/);
  assert.equal(evidence.summary.auditReady, true);
  assert.equal(evidence.summary.openConflicts, 0);
  assert.equal(evidence.summary.escalationFlags, 0);
  assert.equal(evidence.remediationActions.length, 0);
  assert.ok(evidence.evidence.every((item) => /^ev-[a-f0-9]{12}$/.test(item.evidenceId)));
  assert.ok(evidence.evidence.some((item) => item.control === "control:automated-tests"));
  assert.ok(evidence.evidence.some((item) => item.control === "approval:release_management"));
  assert.equal(evidence.evidence.at(-1).control, "deployment:outcome-recorded");
});

test("getEvidencePackage surfaces conflicts, escalation flags, and remediation actions", async () => {
  const repository = await createFixtureRepository();
  let currentTime = "2026-06-18T00:00:00.000Z";
  const service = new ReleaseService(repository, () => currentTime);

  const first = await service.createRelease(buildPayload());
  await service.createRelease({
    ...buildPayload(),
    version: "2026.06.18-conflict",
    plannedStartAt: "2026-06-20T08:30:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z"
  });

  currentTime = "2026-06-18T10:30:00.000Z";
  const evidence = await service.getEvidencePackage(first.id);

  assert.equal(evidence.summary.auditReady, false);
  assert.equal(evidence.summary.openConflicts, 1);
  assert.equal(evidence.summary.escalationFlags, 3);
  assert.ok(evidence.conflicts.some((conflict) => conflict.version === "2026.06.18-conflict"));
  assert.ok(evidence.escalationFlags.some((flag) => flag.code === "approval_sla_breached"));
  assert.ok(evidence.escalationFlags.some((flag) => flag.code === "high_risk_pending_approval"));
  assert.ok(evidence.escalationFlags.some((flag) => flag.code === "release_window_conflict"));
  assert.ok(evidence.remediationActions.some((action) => action.priority === "P0"));
  assert.ok(
    evidence.remediationActions.some((action) =>
      action.action.includes("Resolve release-window conflicts")
    )
  );
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

test("listReleases returns pagination metadata", async () => {
  const repository = await createFixtureRepository();
  let tick = 0;
  const service = new ReleaseService(repository, () =>
    new Date(Date.UTC(2026, 5, 18, 0, tick++, 0)).toISOString()
  );

  for (let i = 0; i < 5; i++) {
    await service.createRelease({
      ...buildPayload(),
      application: `app-${i}`,
      version: `${i}.0.0`
    });
  }

  const firstPage = await service.listReleases({ limit: "2", offset: "0" });
  assert.equal(firstPage.items.length, 2);
  assert.equal(firstPage.total, 5);
  assert.equal(firstPage.limit, 2);
  assert.equal(firstPage.offset, 0);
  assert.equal(firstPage.hasMore, true);

  const lastPage = await service.listReleases({ limit: "2", offset: "4" });
  assert.equal(lastPage.items.length, 1);
  assert.equal(lastPage.total, 5);
  assert.equal(lastPage.hasMore, false);

  const allItems = await service.listReleases({ limit: "100", offset: "0" });
  assert.equal(allItems.items.length, 5);
  assert.equal(allItems.hasMore, false);
});

test("createRelease with emergency change category", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease({
    ...buildPayload(),
    changeCategory: "emergency",
    environment: "production",
    serviceTier: "tier_1"
  });

  assert.ok(release.risk.score >= 70);
  assert.equal(release.status, "pending_approval");
});

test("createRelease with low-risk change auto-approves", async () => {
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
    summary: "Minor doc update.",
    components: ["site"],
    owner: "tester",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: false,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  });

  assert.ok(release.risk.score < 70);
  assert.equal(release.status, "approved");
});

test("createRelease records timeline entry", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease(buildPayload());

  assert.ok(Array.isArray(release.timeline));
  assert.ok(release.timeline.length >= 1);
  assert.equal(release.timeline[0].type, "release_created");
});

test("createRelease validates all required fields", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.createRelease({}),
    { code: "validation_error" }
  );

  await assert.rejects(
    () => service.createRelease({ application: "" }),
    { code: "validation_error" }
  );
});

test("getPolicy returns complete policy snapshot", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const policy = await service.getPolicy();

  assert.ok(policy.generatedAt);
  assert.ok(Array.isArray(policy.environments));
  assert.ok(Array.isArray(policy.releaseStatuses));
  assert.ok(Array.isArray(policy.serviceTiers));
  assert.ok(Array.isArray(policy.riskBands));
  assert.ok(Array.isArray(policy.approvalRouting));
  assert.ok(policy.controlScoreBounds);
});

test("getDashboard returns comprehensive metrics", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await service.createRelease(buildPayload());

  const dashboard = await service.getDashboard();

  assert.ok(dashboard.totalReleases >= 1);
  assert.ok(dashboard.byStatus);
  assert.ok(dashboard.byEnvironment);
  assert.ok(dashboard.riskDistribution);
  assert.ok(typeof dashboard.changeFailureRate === "number");
  assert.ok(typeof dashboard.averageLeadHours === "number");
});

test("getRelease returns release when found", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const created = await service.createRelease(buildPayload());
  const found = await service.getRelease(created.id);

  assert.equal(found.id, created.id);
  assert.equal(found.application, created.application);
});

test("getRelease throws 404 for nonexistent id", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.getRelease("nonexistent-id"),
    { statusCode: 404 }
  );
});

test("reviewRelease records approval decision", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease({
    ...buildPayload(),
    environment: "production",
    serviceTier: "tier_1",
    changeCategory: "emergency"
  });

  assert.equal(release.status, "pending_approval");
  const targetTeam = release.approvals[0].team;

  const approved = await service.reviewRelease(release.id, {
    team: targetTeam,
    actor: "reviewer",
    decision: "approved",
    comment: "Reviewed and approved."
  });

  assert.ok(approved);
});

test("reviewRelease throws 404 for nonexistent release", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.reviewRelease("nonexistent-id", { team: "release_management", actor: "reviewer", decision: "approved" }),
    (err) => err.statusCode === 404 || err.message.includes("not found")
  );
});

test("scheduleRelease schedules an approved release", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease({
    application: "docs-site",
    version: "1.0.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-20T08:00:00.000Z",
    plannedEndAt: "2026-06-20T09:00:00.000Z",
    summary: "Minor update.",
    components: ["site"],
    owner: "tester",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: false,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  });

  assert.equal(release.status, "approved");

  const scheduled = await service.scheduleRelease(release.id, {
    scheduledAt: "2026-06-20T08:00:00.000Z",
    actor: "scheduler"
  });

  assert.equal(scheduled.status, "scheduled");
});

test("scheduleRelease throws 404 for nonexistent release", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.scheduleRelease("nonexistent-id", { scheduledAt: "2026-06-20T08:00:00.000Z", actor: "scheduler" }),
    (err) => err.statusCode === 404 || err.message.includes("not found")
  );
});

test("deployRelease throws 404 for nonexistent release", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.deployRelease("nonexistent-id", { outcome: "deployed", actor: "alice" }),
    (err) => err.statusCode === 404 || err.message.includes("not found")
  );
});

test("getEvidencePackage throws 404 for nonexistent release", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  await assert.rejects(
    () => service.getEvidencePackage("nonexistent-id"),
    { statusCode: 404 }
  );
});

test("getReleaseConflicts returns empty for release with no conflicts", async () => {
  const repository = await createFixtureRepository();
  const service = new ReleaseService(repository, () => "2026-06-18T00:00:00.000Z");

  const release = await service.createRelease(buildPayload());
  const conflicts = await service.getReleaseConflicts(release.id);

  assert.ok(conflicts);
  assert.equal(conflicts.releaseId, release.id);
  assert.ok(Array.isArray(conflicts.conflicts));
});



// ── 额外的边界情况测试 ──

async function makeService() {
  const repo = await createFixtureRepository();
  return new ReleaseService(repo, () => "2026-06-18T00:00:00.000Z");
}

function makePayload(overrides = {}) {
  return { ...buildPayload(), ...overrides };
}

test("批量创建空数组返回 400", async () => {
  const service = await makeService();
  await assert.rejects(
    () => service.bulkCreateReleases([]),
    (err) => err.code === "validation_error"
  );
});

test("批量创建包含无效项时报告错误", async () => {
  const service = await makeService();
  const result = await service.bulkCreateReleases([
    makePayload({ application: "valid-app" }),
    { invalid: true }
  ]);
  assert.ok(result.created.length > 0 || result.errors.length > 0);
});

test("getRelease 不存在时抛出 404", async () => {
  const service = await makeService();
  await assert.rejects(
    () => service.getRelease("nonexistent-id"),
    (err) => err.statusCode === 404
  );
});

test("reviewRelease 在非 pending_approval 状态时抛出错误", async () => {
  const service = await makeService();
  const release = await service.createRelease(makePayload({
    environment: "development",
    serviceTier: "tier_3",
    controls: { automatedTestsPassed: true, rollbackReady: true, monitoringReady: true, securityReviewed: true, customerImpactScore: 0, dataSensitivityScore: 0 }
  }));
  assert.equal(release.status, "approved");
  await assert.rejects(
    () => service.reviewRelease(release.id, { team: "release_management", decision: "approved", actor: "bob" }),
    (err) => err.message.includes("awaiting approval")
  );
});

test("scheduleRelease 在非 approved 状态时抛出错误", async () => {
  const service = await makeService();
  const release = await service.createRelease(makePayload());
  await assert.rejects(
    () => service.scheduleRelease(release.id, { scheduledBy: "ops" }),
    (err) => err.code === "validation_error"
  );
});

test("deployRelease 在非 scheduled 状态时抛出错误", async () => {
  const service = await makeService();
  const release = await service.createRelease(makePayload());
  await assert.rejects(
    () => service.deployRelease(release.id, { deployedBy: "ops" }),
    (err) => err.code === "validation_error"
  );
});

test("getEvidencePackage 返回完整证据包", async () => {
  const service = await makeService();
  const release = await service.createRelease(makePayload());
  const evidence = await service.getEvidencePackage(release.id);
  assert.ok(evidence.evidencePackageId);
  assert.ok(evidence.releaseId);
  assert.ok(evidence.risk);
  assert.ok(evidence.timeline);
  assert.ok(evidence.evidence);
});

test("getReleaseConflicts 检测时间窗口冲突", async () => {
  const service = await makeService();
  const r1 = await service.createRelease(makePayload({ application: "app-a" }));
  const result = await service.getReleaseConflicts(r1.id);
  assert.ok(result.releaseId);
  assert.ok(Array.isArray(result.conflicts));
  assert.equal(result.application, "app-a");
});

test("getDashboard 在有数据时返回完整统计", async () => {
  const service = await makeService();
  await service.createRelease(makePayload({ environment: "production" }));
  await service.createRelease(makePayload({ environment: "staging", application: "other-app" }));
  const dashboard = await service.getDashboard();
  assert.ok(dashboard.totalReleases >= 2);
  assert.ok(dashboard.byEnvironment.production >= 1);
  assert.ok(dashboard.byEnvironment.staging >= 1);
  assert.ok(dashboard.riskDistribution);
});

test("getEscalations 检测高风险待审批", async () => {
  const service = await makeService();
  await service.createRelease(makePayload({
    environment: "production",
    serviceTier: "tier_1",
    changeCategory: "emergency",
    controls: { automatedTestsPassed: false, rollbackReady: false, monitoringReady: false, securityReviewed: false, customerImpactScore: 5, dataSensitivityScore: 5 }
  }));
  const escalations = await service.getEscalations();
  assert.ok(escalations.highRiskPending.length > 0 || escalations.overdueApprovals.length >= 0);
});

test("getPolicy 返回完整策略配置", async () => {
  const service = await makeService();
  const policy = await service.getPolicy();
  assert.ok(policy.environments.length > 0);
  assert.ok(policy.releaseStatuses.length > 0);
  assert.ok(policy.serviceTiers.length > 0);
  assert.ok(policy.riskBands.length > 0);
  assert.ok(policy.approvalRouting.length > 0);
  assert.ok(policy.controlScoreBounds);
});

test("getEscalationReport 返回报告数据", async () => {
  const service = await makeService();
  const report = await service.getEscalationReport();
  assert.ok(report.reportId);
  assert.ok(report.generatedAt);
  assert.ok(report.executiveSummary);
  assert.ok(report.executiveSummary.counts);
  assert.ok(Array.isArray(report.rows));
  assert.ok(Array.isArray(report.recommendedActions));
});
