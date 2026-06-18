#!/usr/bin/env node

/**
 * Release Guardian 性能基准测试
 * 
 * 测试关键 API 端点的响应时间和吞吐量
 */

import { createApp } from "../src/app.js";
import { Repository } from "../src/repository.js";
import { ReleaseService } from "../src/services/releaseService.js";
import { Readable } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function buildRequest(method, url, body) {
  const stream = Readable.from(body ? [JSON.stringify(body)] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = { "content-type": "application/json" };
  return stream;
}

function createPayload() {
  return {
    application: "perf-test-app",
    version: `${Date.now()}`,
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-07-01T10:00:00Z",
    plannedEndAt: "2026-07-01T12:00:00Z",
    summary: "Performance test release",
    components: ["api"],
    owner: "perf-tester",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: true,
      customerImpactScore: 0,
      dataSensitivityScore: 0
    }
  };
}

async function benchmark(name, fn, iterations = 100) {
  const start = performance.now();
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await fn();
    results.push(performance.now() - iterStart);
  }
  
  const total = performance.now() - start;
  const avg = total / iterations;
  const p50 = results.sort((a, b) => a - b)[Math.floor(iterations * 0.5)];
  const p95 = results[Math.floor(iterations * 0.95)];
  const p99 = results[Math.floor(iterations * 0.99)];
  
  return {
    name,
    iterations,
    totalMs: Math.round(total),
    avgMs: Math.round(avg * 100) / 100,
    p50Ms: Math.round(p50 * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    p99Ms: Math.round(p99 * 100) / 100,
    rps: Math.round(iterations / (total / 1000))
  };
}

async function runBenchmarks() {
  console.log("Release Guardian 性能基准测试\n");
  
  const repository = new Repository();
  const service = new ReleaseService(repository, () => new Date().toISOString());
  const app = createApp(service);
  
  // 健康检查
  const healthResult = await benchmark("GET /health", async () => {
    await app(buildRequest("GET", "/health"));
  });
  
  // 就绪检查
  const readyResult = await benchmark("GET /ready", async () => {
    await app(buildRequest("GET", "/ready"));
  });
  
  // 创建发布
  const createResult = await benchmark("POST /api/releases", async () => {
    await app(buildRequest("POST", "/api/releases", createPayload()));
  }, 50);
  
  // 列出发布
  const listResult = await benchmark("GET /api/releases", async () => {
    await app(buildRequest("GET", "/api/releases"));
  });
  
  // 仪表板
  const dashboardResult = await benchmark("GET /api/dashboard", async () => {
    await app(buildRequest("GET", "/api/dashboard"));
  });
  
  // 输出结果
  const results = [healthResult, readyResult, createResult, listResult, dashboardResult];
  
  console.log("端点                    | 次数  | 平均(ms) | P50(ms) | P95(ms) | P99(ms) | RPS");
  console.log("-".repeat(90));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(24)} | ${String(r.iterations).padStart(5)} | ${String(r.avgMs).padStart(8)} | ${String(r.p50Ms).padStart(7)} | ${String(r.p95Ms).padStart(7)} | ${String(r.p99Ms).padStart(7)} | ${String(r.rps).padStart(5)}`
    );
  }
  
  console.log("\n基准测试完成！");
}

runBenchmarks().catch(console.error);
