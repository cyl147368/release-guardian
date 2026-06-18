#!/usr/bin/env node
/**
 * Release Guardian Benchmark Script
 * 
 * Runs a configurable load test against the API to measure throughput,
 * latency percentiles, and error rates.
 * 
 * Usage:
 *   node scripts/benchmark.js [--url http://localhost:3000] [--concurrency 10] [--duration 10]
 * 
 * Options:
 *   --url          Base URL of the API (default: http://localhost:3000)
 *   --concurrency  Number of concurrent workers (default: 10)
 *   --duration     Test duration in seconds (default: 10)
 *   --help         Show this help message
 */

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    concurrency: { type: "string", default: "10" },
    duration: { type: "string", default: "10" },
    help: { type: "boolean", default: false }
  },
  strict: true
});

if (values.help) {
  console.log(`Usage: node scripts/benchmark.js [--url URL] [--concurrency N] [--duration SECONDS]`);
  process.exit(0);
}

const BASE_URL = values.url;
const CONCURRENCY = Number(values.concurrency);
const DURATION_MS = Number(values.duration) * 1000;

const ENDPOINTS = [
  { method: "GET", path: "/health", name: "GET /health" },
  { method: "GET", path: "/ready", name: "GET /ready" },
  { method: "GET", path: "/api/releases", name: "GET /api/releases" },
  { method: "GET", path: "/api/dashboard", name: "GET /api/dashboard" },
  { method: "GET", path: "/api/policy", name: "GET /api/policy" },
  { method: "GET", path: "/api/escalations", name: "GET /api/escalations" }
];

function createReleasePayload() {
  return JSON.stringify({
    application: `bench-${randomUUID().slice(0, 8)}`,
    version: `1.0.${Math.floor(Math.random() * 1000)}`,
    environment: "development",
    serviceTier: "tier_3",
    changeCategory: "standard",
    plannedStartAt: "2026-06-20T08:00:00.000Z",
    plannedEndAt: "2026-06-20T09:00:00.000Z",
    summary: "Benchmark test release.",
    components: ["api"],
    owner: "benchmark",
    controls: {
      automatedTestsPassed: true,
      rollbackReady: true,
      monitoringReady: true,
      securityReviewed: false,
      customerImpactScore: 1,
      dataSensitivityScore: 1
    }
  });
}

const CREATE_ENDPOINT = {
  method: "POST",
  path: "/api/releases",
  name: "POST /api/releases",
  body: createReleasePayload
};

async function runRequest(endpoint) {
  const start = performance.now();
  try {
    const opts = { method: endpoint.method, headers: {} };
    if (endpoint.body) {
      opts.headers["content-type"] = "application/json";
      opts.body = typeof endpoint.body === "function" ? endpoint.body() : endpoint.body;
    }
    const res = await fetch(`${BASE_URL}${endpoint.path}`, opts);
    await res.text();
    const duration = performance.now() - start;
    return { endpoint: endpoint.name, status: res.status, duration, error: null };
  } catch (error) {
    const duration = performance.now() - start;
    return { endpoint: endpoint.name, status: 0, duration, error: error.message };
  }
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBenchmark() {
  console.log(`\nRelease Guardian Benchmark`);
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Duration: ${DURATION_MS / 1000}s\n`);

  // Warm up
  console.log("Warming up...");
  await Promise.all(ENDPOINTS.slice(0, 3).map((ep) => runRequest(ep)));

  const results = [];
  const startTime = Date.now();
  let running = true;

  async function worker(id) {
    const allEndpoints = [...ENDPOINTS, CREATE_ENDPOINT];
    while (running) {
      const ep = allEndpoints[Math.floor(Math.random() * allEndpoints.length)];
      const result = await runRequest(ep);
      results.push(result);
    }
  }

  console.log(`Running benchmark...`);
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));

  setTimeout(() => { running = false; }, DURATION_MS);
  await Promise.all(workers);

  const elapsed = (Date.now() - startTime) / 1000;

  // Aggregate
  const byEndpoint = {};
  for (const r of results) {
    if (!byEndpoint[r.endpoint]) {
      byEndpoint[r.endpoint] = { total: 0, success: 0, errors: 0, durations: [], statuses: {} };
    }
    const agg = byEndpoint[r.endpoint];
    agg.total++;
    if (r.error || r.status >= 400) {
      agg.errors++;
    } else {
      agg.success++;
    }
    agg.durations.push(r.duration);
    agg.statuses[r.status] = (agg.statuses[r.status] || 0) + 1;
  }

  console.log(`\n${"─".repeat(80)}`);
  console.log(`Results (${results.length} requests in ${elapsed.toFixed(1)}s, ${(results.length / elapsed).toFixed(0)} req/s)`);
  console.log(`${"─".repeat(80)}\n`);

  for (const [name, agg] of Object.entries(byEndpoint)) {
    const durations = agg.durations.sort((a, b) => a - b);
    const p50 = percentile(durations, 50).toFixed(1);
    const p95 = percentile(durations, 95).toFixed(1);
    const p99 = percentile(durations, 99).toFixed(1);
    const avg = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
    const statusStr = Object.entries(agg.statuses).map(([s, c]) => `${s}:${c}`).join(" ");
    console.log(`  ${name}`);
    console.log(`    Requests: ${agg.total} (${agg.success} ok, ${agg.errors} errors)`);
    console.log(`    Latency:  avg=${avg}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms`);
    console.log(`    Status:   ${statusStr}`);
    console.log();
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err.message);
  process.exit(1);
});
