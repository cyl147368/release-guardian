# 可观测性指南

## 概述

可观测性是理解系统内部状态的能力。Release Guardian 提供完整的可观测性支持，包括日志、指标和追踪。

## 三大支柱

### 1. 日志 (Logs)

结构化 JSON 日志，包含请求上下文。

### 2. 指标 (Metrics)

Prometheus 格式指标，包括延迟、吞吐量、错误率。

### 3. 追踪 (Traces)

请求追踪，通过 X-Request-Id 实现。

## 日志

### 日志格式

```json
{
  "timestamp": "2026-06-18T12:00:00.000Z",
  "level": "info",
  "message": "request_completed",
  "requestId": "abc-123-def-456",
  "method": "POST",
  "path": "/api/releases",
  "statusCode": 201,
  "durationMs": 15.5,
  "userAgent": "curl/7.68.0",
  "clientIp": "192.168.1.100"
}
```

### 日志级别

- **error**: 服务器错误（5xx）
- **warn**: 客户端错误（4xx）
- **info**: 正常请求
- **debug**: 调试信息

### 日志收集

#### ELK Stack

```yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - decode_json_fields:
          fields: ["message"]
          target: "json"

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

#### Loki

```yaml
# promtail-config.yml
scrape_configs:
  - job_name: release-guardian
    static_configs:
      - targets: [localhost]
        labels:
          job: release-guardian
          __path__: /var/log/release-guardian/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
      - labels:
          level:
```

## 指标

### 可用指标

| 指标名称 | 类型 | 说明 |
|---------|------|------|
| `rg_uptime_seconds` | Gauge | 应用运行时间（秒） |
| `rg_http_requests_total` | Counter | HTTP 请求总数 |
| `rg_http_errors_total` | Counter | HTTP 错误总数 |
| `rg_http_request_duration_ms` | Summary | 请求延迟（毫秒） |
| `rg_releases_created_total` | Counter | 创建的发布总数 |
| `rg_releases_deployed_total` | Counter | 部署的发布总数 |
| `rg_sla_breaches_total` | Counter | SLA 违规总数 |

### Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'release-guardian'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scheme: 'http'
```

### Grafana 仪表板

导入以下 JSON 创建仪表板：

```json
{
  "dashboard": {
    "title": "Release Guardian",
    "panels": [
      {
        "title": "请求速率",
        "type": "graph",
        "targets": [{
          "expr": "rate(rg_http_requests_total[5m])",
          "legendFormat": "{{method}} {{path}}"
        }]
      },
      {
        "title": "错误率",
        "type": "graph",
        "targets": [{
          "expr": "rate(rg_http_errors_total[5m]) / rate(rg_http_requests_total[5m])",
          "legendFormat": "Error Rate"
        }]
      },
      {
        "title": "延迟 P95",
        "type": "graph",
        "targets": [{
          "expr": "rg_http_request_duration_ms{quantile=\"0.95\"}",
          "legendFormat": "P95 Latency"
        }]
      },
      {
        "title": "发布创建数",
        "type": "stat",
        "targets": [{
          "expr": "rg_releases_created_total",
          "legendFormat": "Total Created"
        }]
      }
    ]
  }
}
```

### 自定义指标

```javascript
import { createMetrics } from './src/lib/metrics.js';

const metrics = createMetrics();

// 记录自定义指标
metrics.recordBusinessEvent('release.created');
metrics.recordBusinessEvent('release.approved');

// 获取快照
const snapshot = metrics.getSnapshot();
console.log(snapshot);

// Prometheus 格式
const prometheus = metrics.toPrometheus();
console.log(prometheus);
```

## 追踪

### 请求追踪

每个请求都有唯一的 `X-Request-Id`：

```bash
# 请求
curl -v http://localhost:3000/api/releases

# 响应头
X-Request-Id: abc-123-def-456
```

### 日志关联

通过 `requestId` 关联日志：

```bash
# 查看特定请求的日志
grep "abc-123-def-456" /var/log/release-guardian/*.log
```

### 分布式追踪

集成 OpenTelemetry：

```javascript
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  serviceName: 'release-guardian',
});
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();
```

## 告警

### Prometheus 告警规则

```yaml
# alerting-rules.yml
groups:
  - name: release-guardian
    rules:
      - alert: HighErrorRate
        expr: rate(rg_http_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高错误率"
          description: "错误率超过 10% 持续 5 分钟"

      - alert: HighLatency
        expr: rg_http_request_duration_ms{quantile="0.95"} > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高延迟"
          description: "P95 延迟超过 1 秒持续 5 分钟"

      - alert: SLABreaches
        expr: increase(rg_sla_breaches_total[1h]) > 5
        labels:
          severity: critical
        annotations:
          summary: "SLA 违规过多"
          description: "过去 1 小时 SLA 违规超过 5 次"

      - alert: ServiceDown
        expr: up{job="release-guardian"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "服务宕机"
          description: "Release Guardian 服务不可用"
```

### Alertmanager 配置

```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .Annotations.description }}'

  - name: 'email'
    email_configs:
      - to: 'oncall@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.example.com:587'
```

## 仪表板

### Grafana 仪表板

1. **概览面板**
   - 请求速率
   - 错误率
   - 延迟分布
   - 活跃连接数

2. **业务面板**
   - 发布创建数
   - 审批数
   - 部署数
   - SLA 违规数

3. **系统面板**
   - CPU 使用率
   - 内存使用率
   - 磁盘 I/O
   - 网络 I/O

### 自定义仪表板

```javascript
// 获取指标快照
const snapshot = metrics.getSnapshot();

// HTTP 统计
console.log('总请求数:', snapshot.http.totalRequests);
console.log('错误率:', snapshot.http.errorRate);
console.log('热门路径:', snapshot.http.topPaths);

// 延迟统计
console.log('平均延迟:', snapshot.latency.avgMs, 'ms');
console.log('P50:', snapshot.latency.p50, 'ms');
console.log('P95:', snapshot.latency.p95, 'ms');
console.log('P99:', snapshot.latency.p99, 'ms');

// 业务统计
console.log('发布创建数:', snapshot.business.releasesCreated);
console.log('SLA 违规数:', snapshot.business.slaBreaches);
```

## 最佳实践

### 1. 日志最佳实践

- 使用结构化日志（JSON）
- 包含请求上下文（requestId）
- 不要记录敏感信息
- 使用适当的日志级别

### 2. 指标最佳实践

- 使用标准命名约定
- 添加有用的标签
- 避免高基数标签
- 定期清理过期指标

### 3. 告警最佳实践

- 设置合理的阈值
- 避免告警疲劳
- 使用告警抑制
- 定期审查告警规则

### 4. 仪表板最佳实践

- 保持简洁
- 突出关键指标
- 使用合适的可视化
- 定期更新
