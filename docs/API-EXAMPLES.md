# API 使用示例

本文档提供 Release Guardian API 的详细使用示例，帮助快速上手。

## 目录

- [认证](#认证)
- [健康检查](#健康检查)
- [发布管理](#发布管理)
- [审批操作](#审批操作)
- [Webhook 管理](#webhook-管理)
- [审计日志](#审计日志)
- [性能指标](#性能指标)

## 认证

如果配置了 API 密钥，需要在请求头中添加 `X-API-Key`：

```bash
curl -H "X-API-Key: your-secret-key" http://localhost:3000/api/releases
```

## 健康检查

### 存活探针

```bash
curl http://localhost:3000/health
# 返回: ok
```

### 就绪探针

```bash
curl http://localhost:3000/ready
# 返回:
# {
#   "data": {
#     "status": "ready",
#     "generatedAt": "2026-06-18T12:00:00.000Z",
#     "version": "3.1.0",
#     "checks": {
#       "datastore": {
#         "status": "ok",
#         "releaseCount": 0,
#         "teamCount": 3
#       }
#     }
#   }
# }
```

## 发布管理

### 创建发布请求

```bash
curl -X POST http://localhost:3000/api/releases \
  -H "Content-Type: application/json" \
  -d '{
    "application": "payment-service",
    "version": "2.1.0",
    "environment": "production",
    "serviceTier": "tier_1",
    "changeCategory": "standard",
    "plannedStartAt": "2026-06-20T08:00:00.000Z",
    "plannedEndAt": "2026-06-20T09:00:00.000Z",
    "summary": "新增支付网关集成",
    "components": ["api", "worker"],
    "owner": "alice",
    "controls": {
      "automatedTestsPassed": true,
      "rollbackReady": true,
      "monitoringReady": true,
      "securityReviewed": true,
      "customerImpactScore": 2,
      "dataSensitivityScore": 3
    }
  }'
```

**响应示例**：

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "application": "payment-service",
    "version": "2.1.0",
    "environment": "production",
    "status": "pending_approval",
    "risk": {
      "score": 75,
      "band": "high",
      "rationale": "Risk score 75 (high) derived from production environment, tier_1 service tier..."
    },
    "approvals": [
      {
        "team": "release_management",
        "displayName": "Release Management",
        "status": "pending",
        "slaHours": 4
      },
      {
        "team": "sre",
        "displayName": "SRE",
        "status": "pending",
        "slaHours": 4
      },
      {
        "team": "security",
        "displayName": "Security",
        "status": "pending",
        "slaHours": 8
      }
    ],
    "createdAt": "2026-06-18T12:00:00.000Z"
  }
}
```

### 查询发布列表

```bash
# 获取所有发布
curl http://localhost:3000/api/releases

# 按环境筛选
curl "http://localhost:3000/api/releases?environment=production"

# 按状态筛选
curl "http://localhost:3000/api/releases?status=pending_approval"

# 按应用筛选
curl "http://localhost:3000/api/releases?application=payment-service"

# 分页
curl "http://localhost:3000/api/releases?limit=10&offset=0"

# 排序
curl "http://localhost:3000/api/releases?sort=riskScore&order=desc"
```

### 获取单个发布

```bash
curl http://localhost:3000/api/releases/{release-id}
```

### 批量创建发布

```bash
curl -X POST http://localhost:3000/api/releases/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "releases": [
      {
        "application": "service-a",
        "version": "1.0.0",
        "environment": "development",
        "serviceTier": "tier_3",
        "changeCategory": "standard",
        "plannedStartAt": "2026-06-20T08:00:00.000Z",
        "plannedEndAt": "2026-06-20T09:00:00.000Z",
        "summary": "Feature release",
        "components": ["api"],
        "owner": "bob"
      },
      {
        "application": "service-b",
        "version": "2.0.0",
        "environment": "development",
        "serviceTier": "tier_3",
        "changeCategory": "standard",
        "plannedStartAt": "2026-06-20T10:00:00.000Z",
        "plannedEndAt": "2026-06-20T11:00:00.000Z",
        "summary": "Bug fix release",
        "components": ["api"],
        "owner": "bob"
      }
    ]
  }'
```

## 审批操作

### 审批发布

```bash
curl -X POST http://localhost:3000/api/releases/{release-id}/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "team": "release_management",
    "status": "approved",
    "actor": "admin",
    "decision": "approved",
    "comment": "LGTM"
  }'
```

### 拒绝发布

```bash
curl -X POST http://localhost:3000/api/releases/{release-id}/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "team": "security",
    "status": "rejected",
    "actor": "security-team",
    "decision": "rejected",
    "comment": "需要补充安全审计报告"
  }'
```

### 排期发布

```bash
curl -X POST http://localhost:3000/api/releases/{release-id}/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scheduledAt": "2026-06-20T08:00:00.000Z",
    "actor": "admin"
  }'
```

### 部署发布

```bash
curl -X POST http://localhost:3000/api/releases/{release-id}/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "deployedBy": "devops-team",
    "deploymentNotes": "Deployed to production successfully"
  }'
```

## Webhook 管理

### 创建 Webhook 订阅

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["release.created", "release.approved", "release.deployed"]
  }'
```

### 查询 Webhook 列表

```bash
curl http://localhost:3000/api/webhooks
```

### 删除 Webhook

```bash
curl -X DELETE http://localhost:3000/api/webhooks/{webhook-id}
```

### 查看 Webhook 事件日志

```bash
curl http://localhost:3000/api/webhooks/events
```

## 审计日志

### 查询审计日志

```bash
# 获取所有审计日志
curl http://localhost:3000/api/audit

# 按事件类型筛选
curl "http://localhost:3000/api/audit?event=release.created"

# 按操作者筛选
curl "http://localhost:3000/api/audit?actor=admin"

# 按时间范围筛选
curl "http://localhost:3000/api/audit?since=2026-06-18T00:00:00.000Z"

# 分页
curl "http://localhost:3000/api/audit?limit=50&offset=0"
```

### 获取审计统计

```bash
curl http://localhost:3000/api/audit/stats
```

## 性能指标

### JSON 格式指标

```bash
curl http://localhost:3000/api/metrics
```

**响应示例**：

```json
{
  "data": {
    "totalRequests": 1234,
    "errors": 5,
    "uptime": 86400,
    "avgResponseTime": 45.2,
    "byMethod": {
      "GET": 1000,
      "POST": 200,
      "PUT": 30,
      "DELETE": 4
    },
    "byPath": {
      "/api/releases": 500,
      "/health": 300,
      "/api/audit": 200
    }
  }
}
```

### Prometheus 格式指标

```bash
curl http://localhost:3000/metrics
```

**响应示例**：

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/releases",status="200"} 500
http_requests_total{method="POST",path="/api/releases",status="201"} 200

# HELP http_request_duration_ms Request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{le="10"} 100
http_request_duration_ms_bucket{le="50"} 800
http_request_duration_ms_bucket{le="100"} 950
http_request_duration_ms_bucket{le="500"} 990
http_request_duration_ms_bucket{le="+Inf"} 1000
```

## 治理策略

### 获取治理策略

```bash
curl http://localhost:3000/api/policy
```

**响应示例**：

```json
{
  "data": {
    "generatedAt": "2026-06-18T12:00:00.000Z",
    "environments": ["development", "staging", "production"],
    "riskBands": [
      { "code": "low", "minScore": 0, "maxScore": 39, "manualApprovalRequired": false },
      { "code": "medium", "minScore": 40, "maxScore": 69, "manualApprovalRequired": false },
      { "code": "high", "minScore": 70, "maxScore": 84, "manualApprovalRequired": true },
      { "code": "critical", "minScore": 85, "maxScore": 100, "manualApprovalRequired": true }
    ],
    "approvalRouting": [
      {
        "team": "release_management",
        "appliesWhen": "All releases",
        "slaHours": { "default": 4, "critical": 2 }
      }
    ]
  }
}
```

## 仪表板

### 获取仪表板数据

```bash
curl http://localhost:3000/api/dashboard
```

**响应示例**：

```json
{
  "data": {
    "totalReleases": 42,
    "byStatus": {
      "draft": 5,
      "pending_approval": 8,
      "approved": 12,
      "scheduled": 7,
      "deployed": 10
    },
    "byRiskBand": {
      "low": 15,
      "medium": 18,
      "high": 7,
      "critical": 2
    },
    "approvalSlaBreaches": 3
  }
}
```

## 升级告警

### 获取升级告警

```bash
curl http://localhost:3000/api/escalations
```

### 获取升级报告

```bash
curl http://localhost:3000/api/escalations/report
```

## 错误处理

所有错误响应格式：

```json
{
  "error": {
    "code": "validation_error",
    "message": "application must be a non-empty string.",
    "details": null
  }
}
```

常见错误码：
- `400` - 请求参数错误
- `401` - 未认证
- `404` - 资源不存在
- `413` - 请求体过大
- `415` - 不支持的 Content-Type
- `429` - 请求频率超限
- `500` - 服务器内部错误

## 最佳实践

1. **使用幂等键**：批量操作时添加唯一请求 ID
2. **处理速率限制**：监听 `X-RateLimit-Remaining` 头
3. **使用 ETag**：减少不必要的数据传输
4. **订阅 Webhook**：实时接收状态变更通知
5. **定期备份**：备份 `data/seed.json` 文件
