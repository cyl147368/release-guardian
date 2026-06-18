# 性能优化指南

## 基准测试

使用内置的基准测试脚本评估性能：

```bash
node scripts/benchmark.js --url http://localhost:3000 --concurrency 20 --duration 30
```

### 预期性能指标

| 端点 | 预期吞吐量 | P95 延迟 |
|------|-----------|---------|
| GET /health | >10,000 req/s | <5ms |
| GET /ready | >5,000 req/s | <10ms |
| GET /api/releases | >2,000 req/s | <50ms |
| POST /api/releases | >1,000 req/s | <100ms |

## 优化建议

### 1. 启用速率限制

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
```

### 2. 调整日志级别

生产环境使用 `warn` 或 `error` 级别减少日志开销：

```bash
LOG_LEVEL=warn
```

### 3. 使用反向代理

在 Nginx 或 Caddy 后面运行，利用连接池和缓存：

```nginx
upstream release_guardian {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl;
    
    location / {
        proxy_pass http://release_guardian;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4. 数据库迁移

JSON 文件存储在高并发场景下可能成为瓶颈。迁移到 PostgreSQL：

```bash
# 参见 docs/DATABASE-MIGRATION.md
DATABASE_URL=postgresql://user:pass@localhost:5432/release_guardian
```

### 5. 水平扩展

使用 Kubernetes HPA 自动扩缩：

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

## 内存优化

- JSON 数据全量加载到内存，适合中小规模数据集
- 大规模数据集建议迁移到数据库
- 定期重启可释放累积的内存碎片

## 网络优化

- 启用 HTTP/2（通过反向代理）
- 使用 ETag 减少重复数据传输
- 启用 GZIP 压缩（通过反向代理）
