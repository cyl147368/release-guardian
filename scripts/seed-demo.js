import { Repository } from "../src/repository.js";
import { ReleaseService } from "../src/services/releaseService.js";

const service = new ReleaseService(new Repository());

const demoReleases = [
  {
    application: "checkout-service",
    version: "2026.06.18",
    environment: "production",
    serviceTier: "tier_1",
    changeCategory: "normal",
    plannedStartAt: "2026-06-21T06:00:00.000Z",
    plannedEndAt: "2026-06-21T07:00:00.000Z",
    summary: "Deploy refined tax-calculation pipeline for premium merchants.",
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
  },
  {
    application: "user-auth",
    version: "3.2.1",
    environment: "staging",
    serviceTier: "tier_2",
    changeCategory: "standard",
    plannedStartAt: "2026-06-19T14:00:00.000Z",
    plannedEndAt: "2026-06-19T15:00:00.000Z",
    summary: "Upgrade OAuth2 token refresh flow with PKCE support.",
    components: ["api", "gateway"],
    owner: "bob",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 2,
      dataSensitivityScore: 4
    }
  },
  {
    application: "notification-hub",
    version: "1.5.0",
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-18T10:00:00.000Z",
    plannedEndAt: "2026-06-18T10:30:00.000Z",
    summary: "Add Slack integration for deployment notifications.",
    components: ["worker"],
    owner: "carol",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: false,
      securityReviewed: false,
      customerImpactScore: 1,
      dataSensitivityScore: 1
    }
  },
  {
    application: "billing-api",
    version: "4.0.0",
    environment: "production",
    serviceTier: "tier_1",
    changeCategory: "emergency",
    plannedStartAt: "2026-06-18T22:00:00.000Z",
    plannedEndAt: "2026-06-18T23:00:00.000Z",
    summary: "Hotfix for invoice rounding error affecting enterprise accounts.",
    components: ["api", "worker", "database-migration"],
    owner: "dave",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 5,
      dataSensitivityScore: 5
    }
  },
  {
    application: "analytics-dashboard",
    version: "2.1.0",
    environment: "staging",
    serviceTier: "tier_2",
    changeCategory: "normal",
    plannedStartAt: "2026-06-20T09:00:00.000Z",
    plannedEndAt: "2026-06-20T10:00:00.000Z",
    summary: "Add DORA metrics trend visualization and export.",
    components: ["api", "frontend", "worker"],
    owner: "eve",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: false,
      customerImpactScore: 2,
      dataSensitivityScore: 2
    }
  }
];

console.log("Seeding demo data...\n");

for (const input of demoReleases) {
  try {
    const release = await service.createRelease(input);
    const riskLabel = release.risk.band.padEnd(8);
    const statusLabel = release.status.padEnd(18);
    console.log(`  [${riskLabel}] [${statusLabel}] ${release.application}@${release.version} (${release.environment})`);
  } catch (error) {
    console.error(`  Failed to seed ${input.application}: ${error.message}`);
  }
}

console.log(`\nSeeded ${demoReleases.length} demo releases.`);
