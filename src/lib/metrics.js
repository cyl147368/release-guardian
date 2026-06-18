/**
 * 应用指标模块
 * 
 * 收集并暴露 Prometheus 兼容的运行时指标。
 * 包括请求计数、延迟分布、活跃连接数和业务指标。
 */

/**
 * 创建指标收集器
 */
export function createMetrics() {
  const startTime = Date.now();
  
  // 请求计数器
  let requestCount = 0;
  let errorCount = 0;
  const statusCounts = {};
  const pathCounts = {};
  
  // 延迟直方图（毫秒桶）
  const latencyBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const latencyHistogram = new Array(latencyBuckets.length + 1).fill(0);
  let latencySum = 0;
  let latencyCount = 0;

  // 业务指标
  let releasesCreated = 0;
  let releasesApproved = 0;
  let releasesRejected = 0;
  let releasesDeployed = 0;
  let webhooksDispatched = 0;
  let slaBreaches = 0;

  function recordRequest(method, path, statusCode, durationMs) {
    requestCount++;
    
    if (statusCode >= 400) errorCount++;
    
    statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
    
    const pathKey = `${method} ${normalizePath(path)}`;
    pathCounts[pathKey] = (pathCounts[pathKey] || 0) + 1;

    // 延迟直方图
    latencySum += durationMs;
    latencyCount++;
    let placed = false;
    for (let i = 0; i < latencyBuckets.length; i++) {
      if (durationMs <= latencyBuckets[i]) {
        latencyHistogram[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) latencyHistogram[latencyBuckets.length]++;
  }

  function recordBusinessEvent(event) {
    switch (event) {
      case "release.created": releasesCreated++; break;
      case "release.approved": releasesApproved++; break;
      case "release.rejected": releasesRejected++; break;
      case "release.deployed": releasesDeployed++; break;
      case "webhook.dispatched": webhooksDispatched++; break;
      case "sla.breached": slaBreaches++; break;
    }
  }

  function getSnapshot() {
    const uptimeMs = Date.now() - startTime;
    return {
      uptime: {
        ms: uptimeMs,
        seconds: Math.floor(uptimeMs / 1000),
        formatted: formatUptime(uptimeMs),
      },
      http: {
        totalRequests: requestCount,
        totalErrors: errorCount,
        errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) + "%" : "0%",
        byStatus: { ...statusCounts },
        topPaths: Object.entries(pathCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([path, count]) => ({ path, count })),
      },
      latency: {
        avgMs: latencyCount > 0 ? Math.round(latencySum / latencyCount * 100) / 100 : 0,
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
        buckets: latencyBuckets.map((le, i) => ({ le, count: latencyHistogram[i] })),
      },
      business: {
        releasesCreated,
        releasesApproved,
        releasesRejected,
        releasesDeployed,
        webhooksDispatched,
        slaBreaches,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  function getPercentile(p) {
    if (latencyCount === 0) return 0;
    const target = Math.ceil(latencyCount * p / 100);
    let cumulative = 0;
    for (let i = 0; i < latencyHistogram.length; i++) {
      cumulative += latencyHistogram[i];
      if (cumulative >= target) {
        return i < latencyBuckets.length ? latencyBuckets[i] : latencyBuckets[latencyBuckets.length - 1];
      }
    }
    return latencyBuckets[latencyBuckets.length - 1];
  }

  /**
   * 导出 Prometheus 格式指标文本
   */
  function toPrometheus() {
    const lines = [];
    const snap = getSnapshot();

    lines.push("# HELP rg_uptime_seconds Application uptime in seconds");
    lines.push("# TYPE rg_uptime_seconds gauge");
    lines.push(`rg_uptime_seconds ${snap.uptime.seconds}`);

    lines.push("# HELP rg_http_requests_total Total HTTP requests");
    lines.push("# TYPE rg_http_requests_total counter");
    lines.push(`rg_http_requests_total ${snap.http.totalRequests}`);

    lines.push("# HELP rg_http_errors_total Total HTTP errors");
    lines.push("# TYPE rg_http_errors_total counter");
    lines.push(`rg_http_errors_total ${snap.http.totalErrors}`);

    lines.push("# HELP rg_http_request_duration_ms Request latency in milliseconds");
    lines.push("# TYPE rg_http_request_duration_ms summary");
    lines.push(`rg_http_request_duration_ms{quantile="0.5"} ${snap.latency.p50}`);
    lines.push(`rg_http_request_duration_ms{quantile="0.95"} ${snap.latency.p95}`);
    lines.push(`rg_http_request_duration_ms{quantile="0.99"} ${snap.latency.p99}`);

    lines.push("# HELP rg_releases_created_total Total releases created");
    lines.push("# TYPE rg_releases_created_total counter");
    lines.push(`rg_releases_created_total ${snap.business.releasesCreated}`);

    lines.push("# HELP rg_releases_deployed_total Total releases deployed");
    lines.push("# TYPE rg_releases_deployed_total counter");
    lines.push(`rg_releases_deployed_total ${snap.business.releasesDeployed}`);

    lines.push("# HELP rg_sla_breaches_total Total SLA breaches");
    lines.push("# TYPE rg_sla_breaches_total counter");
    lines.push(`rg_sla_breaches_total ${snap.business.slaBreaches}`);

    return lines.join("\n") + "\n";
  }

  return { recordRequest, recordBusinessEvent, getSnapshot, toPrometheus };
}

function normalizePath(pathname) {
  // 将动态路径段替换为占位符
  return pathname
    .replace(/\/api\/releases\/[^/]+/, "/api/releases/:id")
    .replace(/\/api\/webhooks\/[^/]+/, "/api/webhooks/:id");
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
}
