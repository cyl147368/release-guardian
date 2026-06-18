import { Repository } from "../src/repository.js";
import { ReleaseService } from "../src/services/releaseService.js";

const service = new ReleaseService(new Repository());

const release = await service.createRelease({
  application: "checkout-service",
  version: "2026.06.18-demo",
  environment: "production",
  serviceTier: "tier_1",
  changeCategory: "normal",
  plannedStartAt: "2026-06-21T06:00:00.000Z",
  plannedEndAt: "2026-06-21T07:00:00.000Z",
  summary: "Deploy refined tax-calculation pipeline for premium merchants.",
  components: ["api", "worker"],
  owner: "demo.bot",
  controls: {
    automatedTestsPassed: true,
    rollbackReady: true,
    monitoringReady: true,
    securityReviewed: true,
    customerImpactScore: 4,
    dataSensitivityScore: 4
  }
});

console.log(`Seeded demo release ${release.id}`);
