# 可观测性集成指南

Release Guardian 内置结构化日志和请求关联 ID，可与主流可观测性平台无缝集成。

## 结构化日志

所有日志输出为 JSON 格式，包含以下标准字段：

```json
{
  "timestamp": "2026-06-18T12:00:00.000Z",
  "level": "info",
  "message": "request_completed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/releases",
  "statusCode": 201,
  "durationMs": 12.5
}
```

### 日志级别

| 级别 | 用途 |
|------|------|
| `debug` | 开发调试信息 |
| `info` | 正常业务事件（请求完成、发布创建等） |
| `warn` | 需要关注但非致命的问题（4xx 响应、审批 SLA 接近超时） |
| `error` | 系统错误（5xx 响应、数据存储不可用） |

### 配置

```bash
LOG_LEVEL=info  # 可选: debug, info, warn, error
```

## 请求关联 ID

每个请求都会生成或复用一个 `X-Request-Id`：

- 客户端发送 `X-Request-Id` 头时，服务端复用该值
- 未发送时，服务端生成 UUID v4
- 响应头中始终包含 `X-Request-Id`
- 所有日志条目中包含 `requestId` 字段

### 分布式追踪集成

将 `X-Request-Id` 作为追踪上下文传播：

```javascript
// 客户端示例
const requestId = crypto.randomUUID();
const response = await fetch("http://localhost:3000/api/releases", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Request-Id": requestId
  },
  body: JSON.stringify(payload)
});
console.log("Server Request-ID:", response.headers.get("x-request-id"));
```

## OpenTelemetry 集成

虽然 Release Guardian 没有内置 OpenTelemetry，但可以通过以下方式集成：

### 方案一：自动注入

使用 OpenTelemetry 的 HTTP 自动注入：

```javascript
// tracing.js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

const sdk = new NodeSDK({
  instrumentations: [new HttpInstrumentation()]
});
sdk.start();
```

```bash
node --require ./tracing.js src/server.js
```

### 方案二：自定义中间件

在中间件中添加 OpenTelemetry span：

```javascript
import { trace } from "@opentelemetry/api";

export function withTracing(app) {
  const tracer = trace.getTracer("release-guardian");
  return async function tracedApp(request) {
    return tracer.startActiveSpan(`${request.method} ${request.url}`, async (span) => {
      try {
        const payload = await app(request);
        span.setStatus({ code: 0 });
        return payload;
      } catch (error) {
        span.setStatus({ code: 2, message: error.message });
        throw error;
      } finally {
        span.end();
      }
    });
  };
}
```

## 指标导出

建议监控以下关键指标：

| 指标 | 类型 | 说明 |
|------|------|------|
| `http_requests_total` | Counter | 请求总数（按方法、路径、状态码） |
| `http_request_duration_ms` | Histogram | 请求延迟分布 |
| `releases_created_total` | Counter | 创建的发布总数 |
| `approval_sla_breaches_total` | Counter | 审批 SLA 违规总数 |
| `rate_limit_rejected_total` | Counter | 被速率限制拒绝的请求数 |

## 告警建议

| 条件 | 严重程度 | 说明 |
|------|----------|------|
| 5xx 错误率 > 5% | 严重 | 服务健康状况异常 |
| 平均延迟 > 500ms | 警告 | 性能退化 |
| 审批 SLA 违规 > 10 | 警告 | 审批流程瓶颈 |
| 数据存储错误 | 严重 | 持久化层不可用 |
| 速率限制拒绝率 > 20% | 信息 | 可能的滥用或配置问题 |

## 集成平台

### ELK Stack

```yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths:
      - /var/lib/docker/containers/*/*.log
    json.keys_under_root: true
    json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### Datadog

日志自动解析 JSON 格式，使用 `requestId` 作为关联字段。

### Grafana + Loki

```yaml
# promtail 配置
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
            requestId: requestId
```
