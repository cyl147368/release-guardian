import { createHash, randomUUID } from "node:crypto";

import { HttpError } from "../lib/http.js";
import { addHours, compareIso, nowIso } from "../lib/time.js";
import {
  assertArray,
  assertEnum,
  assertIntegerRange,
  assertIsoTimestamp,
  assertString
} from "../lib/validation.js";

const ENVIRONMENTS = ["development", "staging", "production"];
const RELEASE_STATUS = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "deployed",
  "rolled_back"
];
const APPROVAL_STATUS = ["pending", "approved", "rejected"];

export class ReleaseService {
  constructor(repository, clock = nowIso) {
    this.repository = repository;
    this.clock = clock;
  }

  async listReleases(filters = {}) {
    const query = normalizeReleaseFilters(filters);
    const db = await this.repository.load();
    return db.releases
      .map((release) => refreshApprovalSla(release, this.clock()))
      .filter((release) => matchesReleaseFilters(release, query))
      .sort((left, right) => compareReleases(left, right, query.sort, query.order))
      .slice(query.offset, query.offset + query.limit);
  }

  async getRelease(releaseId) {
    const db = await this.repository.load();
    const release = db.releases.find((item) => item.id === releaseId);
    if (!release) {
      throw new HttpError(404, "not_found", `Release ${releaseId} was not found.`);
    }
    refreshApprovalSla(release, this.clock());
    return release;
  }

  async createRelease(input) {
    validateReleaseInput(input);

    const db = await this.repository.load();
    const timestamp = this.clock();
    const risk = calculateRisk(input);
    const needsManualApproval = risk.score >= 70;
    const approvalTargets = buildApprovalTargets(
      risk,
      db.teams,
      input.serviceTier,
      timestamp,
      needsManualApproval
    );
    const conflicts = findReleaseConflicts(db.releases, input);

    const release = {
      id: randomUUID(),
      application: input.application.trim(),
      version: input.version.trim(),
      environment: input.environment,
      serviceTier: input.serviceTier,
      changeCategory: input.changeCategory,
      plannedStartAt: input.plannedStartAt,
      plannedEndAt: input.plannedEndAt,
      summary: input.summary.trim(),
      components: input.components.map((item) => item.trim()),
      controls: normalizeControls(input.controls),
      conflicts,
      owner: input.owner.trim(),
      status: needsManualApproval ? "pending_approval" : "approved",
      risk,
      approvals: approvalTargets,
      deployment: null,
      timeline: [
        {
          at: timestamp,
          type: "release_created",
          actor: input.owner.trim(),
          detail: "Release request created."
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    db.releases.push(release);
    await this.repository.save(db);
    return release;
  }

  async getReleaseConflicts(releaseId) {
    const db = await this.repository.load();
    const release = db.releases.find((item) => item.id === releaseId);
    if (!release) {
      throw new HttpError(404, "not_found", `Release ${releaseId} was not found.`);
    }

    const conflicts = findReleaseConflicts(db.releases, release, release.id);
    release.conflicts = conflicts;
    release.updatedAt = this.clock();
    await this.repository.save(db);

    return {
      generatedAt: this.clock(),
      releaseId: release.id,
      application: release.application,
      environment: release.environment,
      plannedStartAt: release.plannedStartAt,
      plannedEndAt: release.plannedEndAt,
      totalConflicts: conflicts.length,
      conflicts
    };
  }

  async getEscalations() {
    const db = await this.repository.load();
    const currentTime = this.clock();
    const releases = db.releases.map((release) => refreshApprovalSla(release, currentTime));

    const overdueApprovals = releases.flatMap((release) =>
      release.approvals
        .filter((approval) => approval.status === "pending" && approval.slaBreached)
        .map((approval) => ({
          releaseId: release.id,
          application: release.application,
          version: release.version,
          environment: release.environment,
          riskBand: release.risk.band,
          team: approval.team,
          displayName: approval.displayName,
          requestedAt: approval.requestedAt,
          slaHours: approval.slaHours,
          ageHours: calculateAgeHours(approval.requestedAt, currentTime),
          owner: release.owner
        }))
    );

    const highRiskPending = releases
      .filter((release) => release.status === "pending_approval")
      .filter((release) => ["high", "critical"].includes(release.risk.band))
      .map((release) => ({
        releaseId: release.id,
        application: release.application,
        version: release.version,
        environment: release.environment,
        riskBand: release.risk.band,
        riskScore: release.risk.score,
        pendingTeams: release.approvals
          .filter((approval) => approval.status === "pending")
          .map((approval) => approval.team),
        owner: release.owner,
        plannedStartAt: release.plannedStartAt
      }));

    const conflictRisks = releases
      .map((release) => ({
        release,
        conflicts: findReleaseConflicts(releases, release, release.id)
      }))
      .filter((item) => item.conflicts.length > 0)
      .map((item) => ({
        releaseId: item.release.id,
        application: item.release.application,
        version: item.release.version,
        environment: item.release.environment,
        status: item.release.status,
        conflictCount: item.conflicts.length,
        conflicts: item.conflicts
      }));

    return {
      generatedAt: currentTime,
      counts: {
        overdueApprovals: overdueApprovals.length,
        highRiskPending: highRiskPending.length,
        conflictRisks: conflictRisks.length
      },
      overdueApprovals,
      highRiskPending,
      conflictRisks
    };
  }

  async getEscalationReport() {
    const escalations = await this.getEscalations();
    return buildEscalationReport(escalations);
  }

  async reviewRelease(releaseId, input) {
    assertString(input.team, "team");
    assertString(input.actor, "actor");
    assertEnum(input.decision, "decision", ["approved", "rejected"]);

    const db = await this.repository.load();
    const release = db.releases.find((item) => item.id === releaseId);
    if (!release) {
      throw new HttpError(404, "not_found", `Release ${releaseId} was not found.`);
    }
    if (release.status !== "pending_approval") {
      throw new HttpError(
        409,
        "invalid_state",
        "Only releases awaiting approval can be reviewed."
      );
    }

    const approval = release.approvals.find(
      (item) => item.team === input.team && item.status === "pending"
    );
    if (!approval) {
      throw new HttpError(404, "not_found", `Pending approval for team ${input.team} was not found.`);
    }

    approval.status = input.decision;
    approval.actor = input.actor.trim();
    approval.comment = typeof input.comment === "string" ? input.comment.trim() : "";
    approval.updatedAt = this.clock();

    if (input.decision === "rejected") {
      release.status = "rejected";
    } else if (release.approvals.every((item) => item.status === "approved")) {
      release.status = "approved";
    }

    release.updatedAt = this.clock();
    release.timeline.push({
      at: this.clock(),
      type: "approval_reviewed",
      actor: input.actor.trim(),
      detail: `${input.team} marked release as ${input.decision}.`
    });

    await this.repository.save(db);
    return release;
  }

  async scheduleRelease(releaseId, input) {
    assertString(input.actor, "actor");
    assertIsoTimestamp(input.scheduledAt, "scheduledAt");

    const db = await this.repository.load();
    const release = db.releases.find((item) => item.id === releaseId);
    if (!release) {
      throw new HttpError(404, "not_found", `Release ${releaseId} was not found.`);
    }
    if (release.status !== "approved") {
      throw new HttpError(
        409,
        "invalid_state",
        "Only approved releases can be scheduled."
      );
    }

    release.status = "scheduled";
    release.deployment = {
      scheduledAt: input.scheduledAt,
      startedAt: null,
      finishedAt: null,
      executedBy: input.actor.trim(),
      rollbackPlan: input.rollbackPlan ? input.rollbackPlan.trim() : "Standard rollback procedure",
      outcome: "scheduled"
    };
    release.updatedAt = this.clock();
    release.timeline.push({
      at: this.clock(),
      type: "release_scheduled",
      actor: input.actor.trim(),
      detail: `Release scheduled for ${input.scheduledAt}.`
    });

    await this.repository.save(db);
    return release;
  }

  async deployRelease(releaseId, input) {
    assertString(input.actor, "actor");
    assertEnum(input.outcome, "outcome", ["deployed", "rolled_back"]);

    const db = await this.repository.load();
    const release = db.releases.find((item) => item.id === releaseId);
    if (!release) {
      throw new HttpError(404, "not_found", `Release ${releaseId} was not found.`);
    }
    if (!["approved", "scheduled"].includes(release.status)) {
      throw new HttpError(
        409,
        "invalid_state",
        "Only approved or scheduled releases can be deployed."
      );
    }

    const startedAt = input.startedAt || this.clock();
    const finishedAt = input.finishedAt || addHours(startedAt, 1);
    assertIsoTimestamp(startedAt, "startedAt");
    assertIsoTimestamp(finishedAt, "finishedAt");
    if (new Date(finishedAt).getTime() < new Date(startedAt).getTime()) {
      throw new HttpError(
        400,
        "validation_error",
        "finishedAt must be greater than or equal to startedAt."
      );
    }

    release.status = input.outcome;
    release.deployment = {
      scheduledAt: release.deployment?.scheduledAt || startedAt,
      startedAt,
      finishedAt,
      executedBy: input.actor.trim(),
      rollbackPlan: release.deployment?.rollbackPlan || "Standard rollback procedure",
      outcome: input.outcome
    };
    release.updatedAt = this.clock();
    release.timeline.push({
      at: this.clock(),
      type: "release_deployed",
      actor: input.actor.trim(),
      detail: `Deployment finished with outcome ${input.outcome}.`
    });

    await this.repository.save(db);
    return release;
  }

  async getPolicy() {
    return buildPolicySnapshot(this.clock());
  }

  async getEvidencePackage(releaseId) {
    const release = await this.getRelease(releaseId);
    const controls = buildControlEvidence(release);
    const approvalEvidence = release.approvals.map((approval) => ({
      control: `approval:${approval.team}`,
      displayName: approval.displayName,
      status: approval.status,
      passed: approval.status === "approved",
      actor: approval.actor,
      requestedAt: approval.requestedAt,
      updatedAt: approval.updatedAt,
      slaHours: approval.slaHours,
      slaBreached: approval.slaBreached,
      comment: approval.comment
    }));

    const deploymentEvidence = {
      control: "deployment:outcome-recorded",
      passed: ["deployed", "rolled_back"].includes(release.status),
      status: release.status,
      deployment: release.deployment
    };

    const evidence = [...controls, ...approvalEvidence, deploymentEvidence];
    const passed = evidence.filter((item) => item.passed).length;

    return {
      generatedAt: this.clock(),
      releaseId: release.id,
      application: release.application,
      version: release.version,
      environment: release.environment,
      status: release.status,
      risk: release.risk,
      summary: {
        totalControls: evidence.length,
        passedControls: passed,
        failedControls: evidence.length - passed,
        auditReady: evidence.every((item) => item.passed)
      },
      evidence,
      timeline: release.timeline
    };
  }

  async getDashboard() {
    const db = await this.repository.load();
    const releases = db.releases;
    const byStatus = Object.fromEntries(RELEASE_STATUS.map((status) => [status, 0]));
    const byEnvironment = Object.fromEntries(ENVIRONMENTS.map((env) => [env, 0]));
    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const release of releases) {
      refreshApprovalSla(release, this.clock());
      byStatus[release.status] = (byStatus[release.status] || 0) + 1;
      byEnvironment[release.environment] = (byEnvironment[release.environment] || 0) + 1;
      riskDistribution[release.risk.band] += 1;
    }

    const changeFailureRate = calculateChangeFailureRate(releases);
    const averageLeadHours = calculateAverageLeadHours(releases);
    const approvalSlaBreaches = releases.filter((release) =>
      release.approvals.some((approval) => approval.status === "pending" && approval.slaBreached)
    ).length;

    return {
      generatedAt: this.clock(),
      totalReleases: releases.length,
      byStatus,
      byEnvironment,
      riskDistribution,
      approvalSlaBreaches,
      changeFailureRate,
      averageLeadHours
    };
  }
}

function normalizeReleaseFilters(filters) {
  if (filters.environment) {
    assertEnum(filters.environment, "environment", ENVIRONMENTS);
  }
  if (filters.status) {
    assertEnum(filters.status, "status", RELEASE_STATUS);
  }
  if (filters.riskBand) {
    assertEnum(filters.riskBand, "riskBand", ["low", "medium", "high", "critical"]);
  }
  if (filters.application && typeof filters.application !== "string") {
    throw new HttpError(400, "validation_error", "application must be a string.");
  }
  if (filters.owner && typeof filters.owner !== "string") {
    throw new HttpError(400, "validation_error", "owner must be a string.");
  }

  const sort = filters.sort || "createdAt";
  assertEnum(sort, "sort", ["createdAt", "updatedAt", "riskScore", "application", "environment"]);

  const order = filters.order || "desc";
  assertEnum(order, "order", ["asc", "desc"]);

  const limit = parseQueryInteger(filters.limit, "limit", 1, 100, 50);
  const offset = parseQueryInteger(filters.offset, "offset", 0, Number.MAX_SAFE_INTEGER, 0);

  const pendingApprovals = parseOptionalBoolean(filters.pendingApprovals, "pendingApprovals");

  return {
    environment: filters.environment,
    status: filters.status,
    riskBand: filters.riskBand,
    application: filters.application,
    owner: filters.owner,
    sort,
    order,
    limit,
    offset,
    pendingApprovals
  };
}

function matchesReleaseFilters(release, filters) {
  return (
    (!filters.environment || release.environment === filters.environment) &&
    (!filters.status || release.status === filters.status) &&
    (!filters.riskBand || release.risk.band === filters.riskBand) &&
    (!filters.application ||
      release.application.toLowerCase().includes(filters.application.toLowerCase())) &&
    (!filters.owner || release.owner.toLowerCase().includes(filters.owner.toLowerCase())) &&
    (filters.pendingApprovals === undefined ||
      release.approvals.some((approval) => approval.status === "pending") ===
        filters.pendingApprovals)
  );
}

function findReleaseConflicts(releases, candidate, candidateId = null) {
  return releases
    .filter((release) => release.id !== candidateId)
    .filter((release) => release.application === candidate.application)
    .filter((release) => release.environment === candidate.environment)
    .filter((release) => !["rejected", "rolled_back", "deployed"].includes(release.status))
    .filter((release) =>
      windowsOverlap(
        release.plannedStartAt,
        release.plannedEndAt,
        candidate.plannedStartAt,
        candidate.plannedEndAt
      )
    )
    .map((release) => ({
      releaseId: release.id,
      application: release.application,
      environment: release.environment,
      status: release.status,
      plannedStartAt: release.plannedStartAt,
      plannedEndAt: release.plannedEndAt,
      owner: release.owner,
      riskBand: release.risk.band,
      reason: "same application, same environment, overlapping release window"
    }));
}

function windowsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  const leftStartTime = new Date(leftStart).getTime();
  const leftEndTime = new Date(leftEnd).getTime();
  const rightStartTime = new Date(rightStart).getTime();
  const rightEndTime = new Date(rightEnd).getTime();

  return leftStartTime < rightEndTime && rightStartTime < leftEndTime;
}

function calculateAgeHours(start, end) {
  const age = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
  return Number(Math.max(age, 0).toFixed(2));
}

function buildEscalationReport(escalations) {
  const rows = [
    ...escalations.overdueApprovals.map((approval) => ({
      category: "overdue_approval",
      severity: approval.riskBand === "critical" ? "critical" : "high",
      releaseId: approval.releaseId,
      application: approval.application,
      version: approval.version,
      environment: approval.environment,
      owner: approval.owner,
      team: approval.team,
      ageHours: approval.ageHours,
      detail: `${approval.displayName} approval is overdue by policy.`,
      recommendedAction: `Escalate to ${approval.displayName} and ${approval.owner}.`
    })),
    ...escalations.highRiskPending.map((release) => ({
      category: "high_risk_pending",
      severity: release.riskBand === "critical" ? "critical" : "high",
      releaseId: release.releaseId,
      application: release.application,
      version: release.version,
      environment: release.environment,
      owner: release.owner,
      team: release.pendingTeams.join(","),
      ageHours: null,
      detail: `${release.riskBand} release is waiting on ${release.pendingTeams.length} approval(s).`,
      recommendedAction: "Hold deployment until required approvals are complete."
    })),
    ...escalations.conflictRisks.map((release) => ({
      category: "release_window_conflict",
      severity: release.status === "pending_approval" ? "high" : "medium",
      releaseId: release.releaseId,
      application: release.application,
      version: release.version,
      environment: release.environment,
      owner: null,
      team: null,
      ageHours: null,
      detail: `${release.conflictCount} overlapping release window(s) detected.`,
      recommendedAction: "Resolve calendar collision before scheduling or deployment."
    }))
  ].sort(compareReportRows);

  const severityCounts = rows.reduce(
    (counts, row) => ({
      ...counts,
      [row.severity]: counts[row.severity] + 1
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
  const topSeverity = ["critical", "high", "medium", "low"].find(
    (severity) => severityCounts[severity] > 0
  );

  const report = {
    reportId: "",
    generatedAt: escalations.generatedAt,
    title: "Release Guardian Escalation Report",
    executiveSummary: {
      totalEscalations: rows.length,
      topSeverity: topSeverity || "none",
      counts: {
        ...escalations.counts,
        bySeverity: severityCounts
      },
      narrative: buildEscalationNarrative(escalations.counts, severityCounts)
    },
    recommendedActions: buildEscalationActions(escalations.counts, severityCounts),
    rows
  };

  report.reportId = createStableReportId(report);
  return report;
}

function compareReportRows(left, right) {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const categoryDelta = left.category.localeCompare(right.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  return left.releaseId.localeCompare(right.releaseId);
}

function buildEscalationNarrative(counts, severityCounts) {
  if (
    counts.overdueApprovals === 0 &&
    counts.highRiskPending === 0 &&
    counts.conflictRisks === 0
  ) {
    return "No active release escalations were detected.";
  }

  const parts = [];
  if (severityCounts.critical > 0) {
    parts.push(`${severityCounts.critical} critical escalation(s) require immediate attention`);
  }
  if (counts.overdueApprovals > 0) {
    parts.push(`${counts.overdueApprovals} overdue approval(s) are breaching SLA`);
  }
  if (counts.highRiskPending > 0) {
    parts.push(`${counts.highRiskPending} high-risk release(s) are waiting for approval`);
  }
  if (counts.conflictRisks > 0) {
    parts.push(`${counts.conflictRisks} release-window conflict group(s) need scheduling review`);
  }

  return `${parts.join("; ")}.`;
}

function buildEscalationActions(counts, severityCounts) {
  const actions = [];

  if (severityCounts.critical > 0) {
    actions.push({
      priority: "P0",
      owner: "release_management",
      action: "Start an immediate release governance review for critical escalations."
    });
  }
  if (counts.overdueApprovals > 0) {
    actions.push({
      priority: "P1",
      owner: "release_management",
      action: "Page approval owners and record the response decision in the release timeline."
    });
  }
  if (counts.highRiskPending > 0) {
    actions.push({
      priority: "P1",
      owner: "service_owner",
      action: "Block deployment automation until all required approvals are approved."
    });
  }
  if (counts.conflictRisks > 0) {
    actions.push({
      priority: "P2",
      owner: "release_manager",
      action: "Move or merge overlapping release windows before scheduling production changes."
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "P3",
      owner: "release_management",
      action: "Continue routine monitoring; no active escalation remediation is required."
    });
  }

  return actions;
}

function createStableReportId(report) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ generatedAt: report.generatedAt, rows: report.rows }))
    .digest("hex")
    .slice(0, 16);
  return `esc-${digest}`;
}

function validateReleaseInput(input) {
  assertString(input.application, "application");
  assertString(input.version, "version");
  assertEnum(input.environment, "environment", ENVIRONMENTS);
  assertEnum(input.serviceTier, "serviceTier", ["tier_1", "tier_2", "tier_3"]);
  assertEnum(input.changeCategory, "changeCategory", ["standard", "normal", "emergency"]);
  assertIsoTimestamp(input.plannedStartAt, "plannedStartAt");
  assertIsoTimestamp(input.plannedEndAt, "plannedEndAt");
  assertString(input.summary, "summary");
  assertArray(input.components, "components");
  assertString(input.owner, "owner");

  if (input.components.length === 0) {
    throw new HttpError(400, "validation_error", "components must contain at least one component.");
  }

  validateControls(input.controls);
  if (new Date(input.plannedEndAt).getTime() < new Date(input.plannedStartAt).getTime()) {
    throw new HttpError(
      400,
      "validation_error",
      "plannedEndAt must be greater than or equal to plannedStartAt."
    );
  }
}

function validateControls(controls) {
  if (!controls || typeof controls !== "object") {
    throw new HttpError(400, "validation_error", "controls must be an object.");
  }

  for (const field of ["automatedTestsPassed", "rollbackReady", "monitoringReady", "securityReviewed"]) {
    if (typeof controls[field] !== "boolean") {
      throw new HttpError(400, "validation_error", `${field} must be a boolean.`);
    }
  }

  assertIntegerRange(controls.customerImpactScore, "customerImpactScore", 0, 5);
  assertIntegerRange(controls.dataSensitivityScore, "dataSensitivityScore", 0, 5);
}

function normalizeControls(controls) {
  return {
    automatedTestsPassed: controls.automatedTestsPassed,
    rollbackReady: controls.rollbackReady,
    monitoringReady: controls.monitoringReady,
    securityReviewed: controls.securityReviewed,
    customerImpactScore: controls.customerImpactScore,
    dataSensitivityScore: controls.dataSensitivityScore
  };
}

function calculateRisk(input) {
  let score = 10;

  if (input.environment === "production") {
    score += 25;
  } else if (input.environment === "staging") {
    score += 10;
  }

  if (input.serviceTier === "tier_1") {
    score += 20;
  } else if (input.serviceTier === "tier_2") {
    score += 10;
  }

  if (input.changeCategory === "emergency") {
    score += 20;
  } else if (input.changeCategory === "normal") {
    score += 10;
  }

  score += Math.min(input.components.length * 5, 20);
  score += Math.min(input.controls.customerImpactScore * 4, 20);
  score += Math.min(input.controls.dataSensitivityScore * 4, 20);

  if (!input.controls.automatedTestsPassed) {
    score += 15;
  }
  if (!input.controls.rollbackReady) {
    score += 15;
  }
  if (!input.controls.monitoringReady) {
    score += 10;
  }
  if (!input.controls.securityReviewed) {
    score += 10;
  }

  const boundedScore = Math.min(score, 100);
  const band =
    boundedScore >= 85
      ? "critical"
      : boundedScore >= 70
        ? "high"
        : boundedScore >= 40
          ? "medium"
          : "low";

  return {
    score: boundedScore,
    band,
    rationale: buildRationale(input, boundedScore, band)
  };
}

function buildRationale(input, score, band) {
  const points = [
    `${input.environment} environment`,
    `${input.serviceTier} service tier`,
    `${input.changeCategory} change category`,
    `${input.components.length} component(s) in scope`
  ];
  if (!input.controls.automatedTestsPassed) {
    points.push("automated tests have not passed");
  }
  if (!input.controls.rollbackReady) {
    points.push("rollback is not ready");
  }
  if (!input.controls.monitoringReady) {
    points.push("monitoring coverage is incomplete");
  }
  if (!input.controls.securityReviewed) {
    points.push("security review is incomplete");
  }
  return `Risk score ${score} (${band}) derived from ${points.join(", ")}.`;
}

function buildApprovalTargets(risk, teams, serviceTier, requestedAt, needsManualApproval) {
  const baseline = [
    makeApproval(
      "release_management",
      "Release Management",
      risk.band === "critical" ? 2 : 4,
      requestedAt,
      needsManualApproval
    )
  ];

  if (risk.score >= 70) {
    baseline.push(makeApproval("sre", "Site Reliability Engineering", 4, requestedAt, true));
  }
  if (risk.score >= 85 || serviceTier === "tier_1") {
    baseline.push(makeApproval("security", "Security", 8, requestedAt, true));
  }

  return baseline.map((approval) => {
    const team = teams.find((item) => item.code === approval.team);
    return {
      ...approval,
      displayName: team?.name || approval.displayName
    };
  });
}

function makeApproval(team, displayName, hours, requestedAt, isPending) {
  return {
    team,
    displayName,
    status: isPending ? "pending" : "approved",
    actor: isPending ? null : "system",
    comment: isPending ? "" : "Auto-approved based on risk policy.",
    requestedAt,
    updatedAt: isPending ? null : requestedAt,
    slaHours: hours,
    slaBreached: false
  };
}

function refreshApprovalSla(release, currentTime) {
  const currentTimestamp = new Date(currentTime).getTime();
  release.approvals = release.approvals.map((approval) => ({
    ...approval,
    slaBreached:
      approval.status === "pending" &&
      currentTimestamp >
        new Date(approval.requestedAt).getTime() + approval.slaHours * 60 * 60 * 1000
  }));
  return release;
}

function calculateChangeFailureRate(releases) {
  const completed = releases.filter((release) =>
    ["deployed", "rolled_back"].includes(release.status)
  );
  if (completed.length === 0) {
    return 0;
  }
  const failed = completed.filter((release) => release.status === "rolled_back").length;
  return Number(((failed / completed.length) * 100).toFixed(2));
}

function calculateAverageLeadHours(releases) {
  const deployed = releases.filter((release) => release.deployment?.finishedAt);
  if (deployed.length === 0) {
    return 0;
  }

  const average =
    deployed.reduce((sum, release) => {
      const created = new Date(release.createdAt).getTime();
      const finished = new Date(release.deployment.finishedAt).getTime();
      return sum + (finished - created) / (1000 * 60 * 60);
    }, 0) / deployed.length;

  return Number(average.toFixed(2));
}

function buildPolicySnapshot(generatedAt) {
  return {
    generatedAt,
    environments: ENVIRONMENTS,
    releaseStatuses: RELEASE_STATUS,
    approvalStatuses: APPROVAL_STATUS,
    serviceTiers: [
      {
        code: "tier_1",
        description: "Mission-critical service with heightened approval requirements."
      },
      {
        code: "tier_2",
        description: "Important business service with standard production controls."
      },
      {
        code: "tier_3",
        description: "Lower criticality service eligible for lighter governance."
      }
    ],
    riskBands: [
      { code: "low", minScore: 0, maxScore: 39, manualApprovalRequired: false },
      { code: "medium", minScore: 40, maxScore: 69, manualApprovalRequired: false },
      { code: "high", minScore: 70, maxScore: 84, manualApprovalRequired: true },
      { code: "critical", minScore: 85, maxScore: 100, manualApprovalRequired: true }
    ],
    approvalRouting: [
      {
        team: "release_management",
        appliesWhen: "All releases",
        slaHours: {
          default: 4,
          critical: 2
        }
      },
      {
        team: "sre",
        appliesWhen: "Risk score is 70 or higher",
        slaHours: {
          default: 4
        }
      },
      {
        team: "security",
        appliesWhen: "Risk score is 85 or higher, or service tier is tier_1",
        slaHours: {
          default: 8
        }
      }
    ],
    controlScoreBounds: {
      customerImpactScore: { min: 0, max: 5 },
      dataSensitivityScore: { min: 0, max: 5 }
    }
  };
}

function buildControlEvidence(release) {
  return [
    {
      control: "control:automated-tests",
      passed: release.controls.automatedTestsPassed,
      status: release.controls.automatedTestsPassed ? "passed" : "failed",
      description: "Automated tests passed before release approval."
    },
    {
      control: "control:rollback-ready",
      passed: release.controls.rollbackReady,
      status: release.controls.rollbackReady ? "passed" : "failed",
      description: "Rollback plan was ready before release approval."
    },
    {
      control: "control:monitoring-ready",
      passed: release.controls.monitoringReady,
      status: release.controls.monitoringReady ? "passed" : "failed",
      description: "Monitoring was ready before release approval."
    },
    {
      control: "control:security-reviewed",
      passed: release.controls.securityReviewed,
      status: release.controls.securityReviewed ? "passed" : "failed",
      description: "Security review was completed or deemed not required."
    },
    {
      control: "control:customer-impact-bounded",
      passed: release.controls.customerImpactScore <= 5,
      status: release.controls.customerImpactScore <= 5 ? "passed" : "failed",
      value: release.controls.customerImpactScore,
      description: "Customer impact score is within the configured governance bound."
    },
    {
      control: "control:data-sensitivity-bounded",
      passed: release.controls.dataSensitivityScore <= 5,
      status: release.controls.dataSensitivityScore <= 5 ? "passed" : "failed",
      value: release.controls.dataSensitivityScore,
      description: "Data sensitivity score is within the configured governance bound."
    }
  ];
}

function compareReleases(left, right, sortField, order) {
  const direction = order === "asc" ? 1 : -1;
  const primary = compareReleaseField(left, right, sortField);
  if (primary !== 0) {
    return direction * primary;
  }

  const created = compareIso(left.createdAt, right.createdAt);
  if (created !== 0) {
    return direction * created;
  }

  return direction * left.id.localeCompare(right.id);
}

function compareReleaseField(left, right, sortField) {
  switch (sortField) {
    case "updatedAt":
      return compareIso(left.updatedAt, right.updatedAt);
    case "riskScore":
      return left.risk.score - right.risk.score;
    case "application":
      return left.application.localeCompare(right.application);
    case "environment":
      return left.environment.localeCompare(right.environment);
    case "createdAt":
    default:
      return compareIso(left.createdAt, right.createdAt);
  }
}

function parseQueryInteger(value, field, min, max, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, "validation_error", `${field} must be an integer.`);
  }

  assertIntegerRange(parsed, field, min, max);
  return parsed;
}

function parseOptionalBoolean(value, field) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }

  throw new HttpError(400, "validation_error", `${field} must be true or false.`);
}

export { APPROVAL_STATUS, ENVIRONMENTS, RELEASE_STATUS };
