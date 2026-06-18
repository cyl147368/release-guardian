import { randomUUID } from "node:crypto";

import { HttpError } from "../lib/http.js";
import { addHours, compareIso, nowIso } from "../lib/time.js";
import {
  assertArray,
  assertEnum,
  assertIsoTimestamp,
  assertPositiveInteger,
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

  async listReleases() {
    const db = await this.repository.load();
    return db.releases
      .map((release) => refreshApprovalSla(release, this.clock()))
      .slice()
      .sort((left, right) => compareIso(right.createdAt, left.createdAt));
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

  assertPositiveInteger(controls.customerImpactScore, "customerImpactScore");
  assertPositiveInteger(controls.dataSensitivityScore, "dataSensitivityScore");
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

export { APPROVAL_STATUS, ENVIRONMENTS, RELEASE_STATUS };
