import { nowIso } from "./time.js";

/**
 * 深度健康检查 — 验证所有依赖组件
 */
export class HealthChecker {
  constructor({ repository, clock = nowIso } = {}) {
    this.checks = [];
    if (repository) {
      this.addCheck("datastore", async () => {
        const db = await repository.load();
        return {
          status: "ok",
          releaseCount: Array.isArray(db.releases) ? db.releases.length : 0,
          teamCount: Array.isArray(db.teams) ? db.teams.length : 0
        };
      });
    }
  }

  addCheck(name, fn) {
    this.checks.push({ name, fn });
  }

  async runChecks() {
    const results = {};
    let healthy = true;

    for (const check of this.checks) {
      try {
        const result = await check.fn();
        results[check.name] = { status: "ok", ...result };
      } catch (error) {
        results[check.name] = { status: "error", message: error.message };
        healthy = false;
      }
    }

    return {
      status: healthy ? "healthy" : "degraded",
      timestamp: nowIso(),
      checks: results
    };
  }
}
