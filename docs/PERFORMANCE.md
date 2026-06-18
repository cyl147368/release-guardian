# 性能指南

## 概述

Release Guardian 经过优化，可以在单节点上处理高并发请求。本文档提供性能基准、优化建议和调优指南。

## 性能基准

### 测试环境

- **硬件**: Apple M1, 16GB RAM
- **操作系统**: macOS 14.0
- **Node.js**: v24.0.0
- **测试工具**: 自定义基准测试脚本

### 基准结果

| 端点 | 吞吐量 (RPS) | P50 延迟 | P95 延迟 | P99 延迟 |
|------|-------------|----------|----------|----------|
| GET /health | 158,678 | 0ms | 0.01ms | 0.26ms |
| GET /ready | 11,518 | 0.06ms | 0.11ms | 1.97ms |
| POST /api/releases | 726 | 1.22ms | 2.73ms | 4.23ms |
| GET /api/releases | 325 | 2.87ms | 3.72ms | 10.63ms |
| GET /api/dashboard | 724 | 1.28ms | 1.92ms | 3.17ms |

### 运行基准测试

```bash
node scripts/performance-test.js
```

## 性能特点

### 1. 零依赖优势

- 无第三方包加载开销
- 更小的内存占用
- 更快的启动速度
- 更少的安全漏洞

### 2. 内存效率

- 流式处理请求体
- 无状态设计
- 自动垃圾回收
- 审计日志自动裁剪

### 3. I/O 效率

- 异步非阻塞 I/O
- 原子文件写入
- 静态文件缓存
- ETag 支持

## 优化建议

### 1. 启用速率限制

防止滥用和 DDoS 攻击：

```bash
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_MAX=1000
export RATE_LIMIT_WINDOW_MS=60000
```

**权衡**：
- 增加少量 CPU 开销
- 保护后端服务
- 提供公平访问

### 2. 使用反向代理

Nginx 提供更好的性能：

```nginx
# 启用 gzip
gzip on;
gzip_types text/plain application/json;

# 缓存静态文件
location /css/ {
    expires 1h;
    add_header Cache-Control "public, immutable";
}

location /js/ {
    expires 1h;
    add_header Cache-Control "public, immutable";
}

# 连接池
upstream release_guardian {
    server 127.0.0.1:3000;
    keepalive 32;
}
```

### 3. 调整 Node.js 参数

```bash
# 增加内存限制
node --max-old-space-size=4096 src/server.js

# 启用垃圾回收日志
node --trace-gc src/server.js

# 启用性能分析
node --prof src/server.js
```

### 4. 使用 PM2 集群模式

充分利用多核 CPU：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'release-guardian',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096'
  }]
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. 使用 Unix Socket

减少 TCP 开销：

```bash
export SOCKET_PATH=/var/run/release-guardian.sock
```

Nginx 配置：

```nginx
upstream release_guardian {
    server unix:/var/run/release-guardian.sock;
}
```

## 数据库优化

### 当前实现

JSON 文件存储，适合：
- 中小规模部署
- 简单查询需求
- 快速原型开发

### 优化建议

1. **定期清理旧数据**
   ```bash
   # 保留最近 1000 条发布
   node -e "
   const fs = require('fs');
   const data = JSON.parse(fs.readFileSync('data/seed.json'));
   if (data.releases.length > 1000) {
     data.releases = data.releases.slice(-1000);
     fs.writeFileSync('data/seed.json', JSON.stringify(data, null, 2));
   }
   "
   ```

2. **使用 SSD 存储**
   - 更快的读写速度
   - 更低的延迟

3. **内存映射文件**
   - 减少磁盘 I/O
   - 提高读取速度

## 缓存策略

### 1. 静态文件缓存

```
Cache-Control: public, max-age=3600  # CSS/JS/图片
Cache-Control: no-cache               # HTML
```

### 2. ETag 支持

```bash
# 请求
curl -H "If-None-Match: abc123" http://localhost:3000/api/releases

# 响应
# 304 Not Modified（如果未变化）
# 200 OK + 新 ETag（如果变化）
```

### 3. 应用层缓存

```javascript
// 简单内存缓存
const cache = new Map();
const CACHE_TTL = 60000; // 1 分钟

function getCached(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

## 并发处理

### 1. 异步处理

所有 I/O 操作都是异步的：

```javascript
// 异步文件读取
const data = await readFile('data/seed.json', 'utf8');

// 异步 HTTP 请求
const response = await fetch(url);
```

### 2. 事件循环

Node.js 单线程事件循环：

- 非阻塞 I/O
- 高并发处理
- 低内存占用

### 3. 集群模式

PM2 集群模式：

```bash
# 启动 4 个实例
pm2 start src/server.js -i 4

# 自动扩展
pm2 start src/server.js -i max
```

## 监控指标

### 1. 系统指标

```bash
# CPU 使用率
top -p <PID>

# 内存使用
ps -p <PID> -o %mem,rss

# 磁盘 I/O
iostat -x 1

# 网络连接
netstat -an | grep :3000 | wc -l
```

### 2. 应用指标

```bash
# 请求速率
curl -s http://localhost:3000/api/metrics | jq .http.totalRequests

# 错误率
curl -s http://localhost:3000/api/metrics | jq .http.errorRate

# 延迟
curl -s http://localhost:3000/api/metrics | jq .latency
```

### 3. Prometheus 指标

```bash
# 查看所有指标
curl -s http://localhost:3000/metrics

# 查询特定指标
curl -s http://localhost:9090/api/v1/query?query=rg_http_requests_total
```

## 性能测试

### 1. 负载测试

使用 Artillery：

```yaml
# artillery-config.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 100
scenarios:
  - name: "API 测试"
    flow:
      - get:
          url: "/health"
      - get:
          url: "/api/releases"
      - post:
          url: "/api/releases"
          json:
            application: "load-test"
            version: "1.0.0"
```

```bash
artillery run artillery-config.yml
```

### 2. 压力测试

使用 autocannon：

```bash
npx autocannon -c 100 -d 30 http://localhost:3000/health
```

### 3. 基准测试

```bash
node scripts/performance-test.js
```

## 调优清单

### 启动前

- [ ] 启用速率限制
- [ ] 配置反向代理
- [ ] 启用 gzip 压缩
- [ ] 配置静态文件缓存
- [ ] 调整 Node.js 内存限制

### 运行时

- [ ] 监控系统资源
- [ ] 监控应用指标
- [ ] 审查慢查询日志
- [ ] 检查错误率

### 持续优化

- [ ] 定期清理旧数据
- [ ] 更新依赖
- [ ] 优化查询
- [ ] 增加缓存

## 扩展性

### 垂直扩展

增加单机资源：

- CPU: 2 核 → 4 核 → 8 核
- 内存: 4GB → 8GB → 16GB
- 存储: HDD → SSD → NVMe

### 水平扩展

增加实例数量：

```bash
# Kubernetes
kubectl scale deployment release-guardian --replicas=5

# PM2
pm2 scale release-guardian 5
```

### 数据库扩展

对于大规模部署：

- 使用 PostgreSQL 或 MySQL
- 实现读写分离
- 使用连接池
- 添加缓存层

## 最佳实践

### 1. 代码优化

- 避免同步操作
- 使用流式处理
- 减少内存分配
- 优化循环

### 2. 配置优化

- 启用生产模式
- 配置合适的限制
- 使用环境变量
- 定期审查配置

### 3. 运维优化

- 使用容器化部署
- 实现自动扩缩容
- 监控和告警
- 定期备份

## 参考资料

- [Node.js 性能优化](https://nodejs.org/en/docs/guides/performance/)
- [PM2 集群模式](https://pm2.keymetrics.io/docs/usage/cluster-mode/)
- [Nginx 性能调优](https://www.nginx.com/blog/tuning-nginx/)
