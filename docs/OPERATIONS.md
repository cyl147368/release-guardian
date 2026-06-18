# 运维手册

## 概述

本文档提供 Release Guardian 的日常运维操作指南。

## 日常操作

### 1. 查看服务状态

```bash
# Systemd
systemctl status release-guardian

# Docker
docker ps | grep release-guardian

# Kubernetes
kubectl get pods -l app=release-guardian
```

### 2. 查看日志

```bash
# Systemd
journalctl -u release-guardian -f

# Docker
docker logs -f release-guardian

# Kubernetes
kubectl logs -l app=release-guardian -f
```

### 3. 重启服务

```bash
# Systemd
systemctl restart release-guardian

# Docker
docker restart release-guardian

# Kubernetes
kubectl rollout restart deployment/release-guardian
```

### 4. 健康检查

```bash
# 存活检查
curl -s http://localhost:3000/health

# 就绪检查
curl -s http://localhost:3000/ready | jq .

# 指标检查
curl -s http://localhost:3000/api/metrics | jq .
```

## 监控

### 1. Prometheus 配置

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'release-guardian'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 2. Grafana 仪表板

导入以下指标创建仪表板：

- **请求速率**: `rate(rg_http_requests_total[5m])`
- **错误率**: `rate(rg_http_errors_total[5m])`
- **延迟 P95**: `rg_http_request_duration_ms{quantile="0.95"}`
- **发布创建数**: `rg_releases_created_total`
- **SLA 违规数**: `rg_sla_breaches_total`

### 3. 告警规则

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
```

## 数据管理

### 1. 备份策略

```bash
# 每日备份脚本
#!/bin/bash
BACKUP_DIR="/backup/release-guardian"
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# 备份数据文件
cp /opt/release-guardian/data/seed.json $BACKUP_DIR/seed-$DATE.json

# 保留最近 30 天备份
find $BACKUP_DIR -name "seed-*.json" -mtime +30 -delete

echo "备份完成: seed-$DATE.json"
```

### 2. 数据恢复

```bash
# 停止服务
systemctl stop release-guardian

# 恢复数据
cp /backup/release-guardian/seed-20260618.json /opt/release-guardian/data/seed.json

# 验证数据
node -e "console.log(JSON.parse(require('fs').readFileSync('data/seed.json')).releases.length)"

# 启动服务
systemctl start release-guardian
```

### 3. 数据清理

```bash
# 清理旧的发布记录（保留最近 1000 条）
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/seed.json'));
if (data.releases.length > 1000) {
  data.releases = data.releases.slice(-1000);
  fs.writeFileSync('data/seed.json', JSON.stringify(data, null, 2));
  console.log('清理完成，保留最近 1000 条记录');
}
"
```

## 性能调优

### 1. 启用速率限制

```bash
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_MAX=1000
export RATE_LIMIT_WINDOW_MS=60000
```

### 2. 调整 Node.js 内存

```bash
node --max-old-space-size=4096 src/server.js
```

### 3. 使用 PM2 集群模式

```bash
npm install -g pm2

# ecosystem.config.js
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
    }
  }]
};

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 故障排查

### 1. 服务无法启动

```bash
# 检查端口占用
lsof -i :3000

# 检查日志
journalctl -u release-guardian -n 100

# 检查数据文件
node -e "JSON.parse(require('fs').readFileSync('data/seed.json'))"
```

### 2. 响应缓慢

```bash
# 检查系统资源
top
free -h
df -h

# 检查 Node.js 进程
ps aux | grep node

# 检查连接数
netstat -an | grep :3000 | wc -l
```

### 3. 数据损坏

```bash
# 验证 JSON 格式
node -e "JSON.parse(require('fs').readFileSync('data/seed.json'))"

# 从备份恢复
cp /backup/release-guardian/seed-latest.json data/seed.json
```

### 4. 内存泄漏

```bash
# 监控内存使用
node -e "
const used = process.memoryUsage();
console.log('内存使用:');
for (let key in used) {
  console.log(\`  \${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
}
"
```

## 扩容

### 1. 水平扩展（Kubernetes）

```bash
# 增加副本数
kubectl scale deployment release-guardian --replicas=5

# 自动扩缩容
kubectl autoscale deployment release-guardian --min=3 --max=10 --cpu-percent=80
```

### 2. 垂直扩展

```bash
# 增加资源限制
kubectl set resources deployment release-guardian \
  -c release-guardian \
  --limits=cpu=2000m,memory=2Gi
```

## 安全运维

### 1. 轮换 API 密钥

```bash
# 生成新密钥
NEW_KEY=$(openssl rand -hex 32)

# 更新环境变量
export API_KEYS=$NEW_KEY

# 重启服务
systemctl restart release-guardian

# 更新客户端配置
```

### 2. 审计日志查询

```bash
# 查询最近的审计事件
curl -s "http://localhost:3000/api/audit?limit=100" | jq .

# 查询特定事件类型
curl -s "http://localhost:3000/api/audit?event=release.created" | jq .

# 查询特定操作者
curl -s "http://localhost:3000/api/audit?actor=alice" | jq .
```

### 3. 安全检查

```bash
# 检查安全头
curl -I http://localhost:3000/health

# 检查 CORS
curl -H "Origin: https://evil.com" http://localhost:3000/api/releases

# 检查速率限制
for i in $(seq 1 110); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/health; done
```

## 灾难恢复

### 1. 完全恢复流程

```bash
# 1. 停止所有实例
kubectl scale deployment release-guardian --replicas=0

# 2. 恢复数据
kubectl cp /backup/seed.json release-guardian-pod:/app/data/seed.json

# 3. 启动实例
kubectl scale deployment release-guardian --replicas=3

# 4. 验证
kubectl get pods -l app=release-guardian
curl http://localhost:3000/ready
```

### 2. 回滚版本

```bash
# Docker
docker stop release-guardian
docker run -d ... release-guardian:2.4.0

# Kubernetes
kubectl rollout undo deployment/release-guardian
```

## 维护窗口

### 1. 计划维护

```bash
# 通知用户
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://slack.com/webhook","events":["maintenance"]}'

# 执行维护
# ...

# 恢复服务
# ...
```

### 2. 紧急维护

```bash
# 1. 通知用户
# 2. 停止接收新请求
# 3. 等待当前请求完成
# 4. 执行维护
# 5. 恢复服务
# 6. 验证
```
