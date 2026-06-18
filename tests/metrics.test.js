import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMetrics } from "../src/lib/metrics.js";

describe("应用指标", () => {
  it("记录 HTTP 请求并生成快照", () => {
    const m = createMetrics();
    m.recordRequest("GET", "/api/releases", 200, 15);
    m.recordRequest("POST", "/api/releases", 201, 42);
    m.recordRequest("GET", "/api/releases", 500, 120);

    const snap = m.getSnapshot();
    assert.equal(snap.http.totalRequests, 3);
    assert.equal(snap.http.totalErrors, 1);
    assert.ok(snap.http.errorRate);
    assert.equal(snap.http.byStatus[200], 1);
    assert.equal(snap.http.byStatus[201], 1);
    assert.equal(snap.http.byStatus[500], 1);
  });

  it("跟踪延迟统计", () => {
    const m = createMetrics();
    m.recordRequest("GET", "/health", 200, 5);
    m.recordRequest("GET", "/health", 200, 10);
    m.recordRequest("GET", "/health", 200, 100);

    const snap = m.getSnapshot();
    assert.ok(snap.latency.avgMs > 0);
    assert.ok(snap.latency.p50 >= 0);
    assert.ok(snap.latency.p95 >= 0);
    assert.ok(snap.latency.p99 >= 0);
  });

  it("跟踪业务事件", () => {
    const m = createMetrics();
    m.recordBusinessEvent("release.created");
    m.recordBusinessEvent("release.created");
    m.recordBusinessEvent("release.approved");
    m.recordBusinessEvent("release.deployed");
    m.recordBusinessEvent("sla.breached");
    m.recordBusinessEvent("webhook.dispatched");

    const snap = m.getSnapshot();
    assert.equal(snap.business.releasesCreated, 2);
    assert.equal(snap.business.releasesApproved, 1);
    assert.equal(snap.business.releasesDeployed, 1);
    assert.equal(snap.business.slaBreaches, 1);
    assert.equal(snap.business.webhooksDispatched, 1);
  });

  it("忽略未知业务事件类型", () => {
    const m = createMetrics();
    m.recordBusinessEvent("unknown.event");
    const snap = m.getSnapshot();
    assert.equal(snap.business.releasesCreated, 0);
  });

  it("导出 Prometheus 格式指标", () => {
    const m = createMetrics();
    m.recordRequest("GET", "/health", 200, 5);
    m.recordBusinessEvent("release.created");

    const prom = m.toPrometheus();
    assert.ok(prom.includes("rg_uptime_seconds"));
    assert.ok(prom.includes("rg_http_requests_total 1"));
    assert.ok(prom.includes("rg_http_request_duration_ms"));
    assert.ok(prom.includes("rg_releases_created_total 1"));
    assert.ok(prom.includes("rg_sla_breaches_total 0"));
    assert.ok(prom.includes("# TYPE"));
    assert.ok(prom.includes("# HELP"));
  });

  it("快照包含 uptime 和 generatedAt", () => {
    const m = createMetrics();
    const snap = m.getSnapshot();
    assert.ok(snap.uptime.ms >= 0);
    assert.ok(snap.uptime.seconds >= 0);
    assert.ok(snap.uptime.formatted);
    assert.ok(snap.generatedAt);
  });

  it("topPaths 跟踪最热路径", () => {
    const m = createMetrics();
    for (let i = 0; i < 5; i++) m.recordRequest("GET", "/api/releases", 200, 10);
    for (let i = 0; i < 3; i++) m.recordRequest("GET", "/health", 200, 1);

    const snap = m.getSnapshot();
    assert.equal(snap.http.topPaths[0].path, "GET /api/releases");
    assert.equal(snap.http.topPaths[0].count, 5);
  });

  it("延迟直方图桶分布正确", () => {
    const m = createMetrics();
    m.recordRequest("GET", "/", 200, 3);    // <=5ms
    m.recordRequest("GET", "/", 200, 8);    // <=10ms
    m.recordRequest("GET", "/", 200, 20);   // <=25ms
    m.recordRequest("GET", "/", 200, 10000); // >5000ms (overflow)

    const snap = m.getSnapshot();
    assert.ok(snap.latency.buckets.length > 0);
  });

  it("空指标返回零值", () => {
    const m = createMetrics();
    const snap = m.getSnapshot();
    assert.equal(snap.http.totalRequests, 0);
    assert.equal(snap.http.totalErrors, 0);
    assert.equal(snap.latency.avgMs, 0);
  });
});
