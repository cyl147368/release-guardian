import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HealthChecker } from "../src/lib/healthcheck.js";

describe("HealthChecker", () => {
  it("返回健康状态当所有检查通过", async () => {
    const checker = new HealthChecker();
    checker.addCheck("test", async () => ({ value: 42 }));

    const result = await checker.runChecks();

    assert.equal(result.status, "healthy");
    assert.ok(result.timestamp);
    assert.equal(result.checks.test.status, "ok");
    assert.equal(result.checks.test.value, 42);
  });

  it("返回降级状态当检查失败", async () => {
    const checker = new HealthChecker();
    checker.addCheck("failing", async () => { throw new Error("连接失败"); });

    const result = await checker.runChecks();

    assert.equal(result.status, "degraded");
    assert.equal(result.checks.failing.status, "error");
    assert.equal(result.checks.failing.message, "连接失败");
  });

  it("支持多个检查", async () => {
    const checker = new HealthChecker();
    checker.addCheck("check1", async () => ({ a: 1 }));
    checker.addCheck("check2", async () => ({ b: 2 }));

    const result = await checker.runChecks();

    assert.equal(result.status, "healthy");
    assert.equal(result.checks.check1.a, 1);
    assert.equal(result.checks.check2.b, 2);
  });

  it("一个检查失败不影响其他检查", async () => {
    const checker = new HealthChecker();
    checker.addCheck("good", async () => ({ ok: true }));
    checker.addCheck("bad", async () => { throw new Error("错误"); });

    const result = await checker.runChecks();

    assert.equal(result.status, "degraded");
    assert.equal(result.checks.good.status, "ok");
    assert.equal(result.checks.bad.status, "error");
  });

  it("使用仓库时自动添加数据存储检查", async () => {
    const mockRepo = {
      async load() {
        return { releases: [{ id: "1" }], teams: [{ name: "t1" }] };
      }
    };
    const checker = new HealthChecker({ repository: mockRepo });

    const result = await checker.runChecks();

    assert.equal(result.checks.datastore.status, "ok");
    assert.equal(result.checks.datastore.releaseCount, 1);
    assert.equal(result.checks.datastore.teamCount, 1);
  });
});
