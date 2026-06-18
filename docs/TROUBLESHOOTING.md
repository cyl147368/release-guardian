# 故障排查指南

## 概述

本文档提供 Release Guardian 常见问题的排查和解决方法。

## 常见问题

### 1. 服务无法启动

#### 症状

```bash
$ npm start
> release-guardian@3.0.0 start
> node src/server.js

Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

#### 原因

端口 3000 已被其他进程占用。

#### 解决方法

```bash
# 查找占用端口的进程
lsof -i :3000

# 终止进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 npm start
```

### 2. 数据文件损坏

#### 症状

```bash
SyntaxError: Unexpected token in JSON at position 0
```

#### 原因

`data/seed.json` 文件格式损坏。

#### 解决方法

```bash
# 验证 JSON 格式
node -e "JSON.parse(require('fs').readFileSync('data/seed.json'))"

# 从备份恢复
cp /backup/seed.json data/seed.json

# 或重新初始化
rm data/seed.json
npm start
```

### 3. 权限问题

#### 症状

```bash
Error: EACCES: permission denied, open 'data/seed.json'
```

#### 原因

当前用户没有数据文件的读写权限。

#### 解决方法

```bash
# 修改文件权限
chmod 644 data/seed.json

# 或修改目录权限
chmod 755 data/

# Docker 环境
docker run -v rg-data:/app/data ...
```

### 4. 内存不足

#### 症状

```bash
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

#### 原因

Node.js 堆内存不足。

#### 解决方法

```bash
# 增加内存限制
node --max-old-space-size=4096 src/server.js

# 或设置环境变量
export NODE_OPTIONS="--max-old-space-size=4096"
```

### 5. 响应缓慢

#### 症状

请求响应时间超过 1 秒。

#### 排查步骤

```bash
# 1. 检查系统资源
top
free -h
df -h

# 2. 检查网络
ping localhost
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# 3. 检查日志
tail -f /var/log/release-guardian/*.log | grep durationMs

# 4. 检查指标
curl -s http://localhost:3000/api/metrics | jq .latency
```

#### 解决方法

- 增加服务器资源
- 启用速率限制
- 优化查询
- 使用缓存

### 6. 连接被拒绝

#### 症状

```bash
curl: (7) Failed to connect to localhost port 3000: Connection refused
```

#### 原因

服务未启动或监听地址错误。

#### 解决方法

```bash
# 检查服务状态
systemctl status release-guardian

# 检查监听地址
netstat -tlnp | grep 3000

# 检查防火墙
sudo iptables -L -n
```

### 7. CORS 错误

#### 症状

```
Access to XMLHttpRequest at 'http://api.example.com' from origin 'http://app.example.com' 
has been blocked by CORS policy
```

#### 原因

CORS 配置不正确。

#### 解决方法

```bash
# 配置允许的源
export CORS_ORIGIN=https://app.example.com

# 或允许多个源
export CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### 8. API 密钥认证失败

#### 症状

```json
{
  "error": {
    "code": "unauthorized",
    "message": "A valid X-API-Key header is required."
  }
}
```

#### 原因

未提供 API 密钥或密钥无效。

#### 解决方法

```bash
# 检查配置
echo $API_KEYS

# 提供正确的密钥
curl -H "X-API-Key: your-key" http://localhost:3000/api/releases

# 或禁用认证（仅开发环境）
unset API_KEYS
```

### 9. 速率限制触发

#### 症状

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

#### 原因

请求频率超过限制。

#### 解决方法

```bash
# 检查限制配置
echo $RATE_LIMIT_MAX

# 增加限制
export RATE_LIMIT_MAX=1000

# 或等待重试
sleep 60
```

### 10. 静态文件 404

#### 症状

访问 Web 控制台返回 404。

#### 原因

`public/` 目录不存在或权限问题。

#### 解决方法

```bash
# 检查目录
ls -la public/

# 重新构建
npm run build

# Docker 环境
docker build -t release-guardian .
```

## 性能问题

### 1. 高 CPU 使用

#### 排查

```bash
# 查看进程
ps aux | grep node

# 查看线程
top -H -p <PID>

# 生成火焰图
node --prof src/server.js
node --prof-process isolate-*.log > processed.txt
```

#### 解决

- 优化代码逻辑
- 减少循环
- 使用异步操作
- 增加服务器 CPU

### 2. 高内存使用

#### 排查

```bash
# 监控内存
node -e "
setInterval(() => {
  const used = process.memoryUsage();
  console.log(\`Heap: \${Math.round(used.heapUsed / 1024 / 1024)} MB\`);
}, 1000);
"

# 生成堆快照
node --inspect src/server.js
# 使用 Chrome DevTools 连接
```

#### 解决

- 检查内存泄漏
- 优化数据结构
- 增加内存限制
- 使用流式处理

### 3. 磁盘 I/O 高

#### 排查

```bash
# 监控磁盘
iostat -x 1

# 查看文件操作
strace -p <PID> -e trace=file
```

#### 解决

- 使用 SSD
- 优化写入频率
- 使用内存缓存
- 批量写入

## 网络问题

### 1. 连接超时

#### 排查

```bash
# 测试连接
curl -v --connect-timeout 5 http://localhost:3000/health

# 检查网络
ping localhost
traceroute localhost
```

#### 解决

- 检查防火墙
- 检查代理配置
- 增加超时时间
- 使用连接池

### 2. DNS 解析失败

#### 排查

```bash
# 测试 DNS
nslookup localhost
dig localhost
```

#### 解决

- 使用 IP 地址
- 配置 DNS
- 检查 hosts 文件

## 数据问题

### 1. 数据丢失

#### 排查

```bash
# 检查备份
ls -la /backup/release-guardian/

# 检查数据文件
cat data/seed.json | jq .releases | length
```

#### 解决

- 从备份恢复
- 检查自动备份配置
- 启用数据复制

### 2. 数据不一致

#### 排查

```bash
# 验证数据完整性
node -e "
const data = JSON.parse(require('fs').readFileSync('data/seed.json'));
console.log('Releases:', data.releases.length);
console.log('Teams:', data.teams.length);
// 检查引用完整性
for (const release of data.releases) {
  if (!release.id || !release.application) {
    console.error('Invalid release:', release);
  }
}
"
```

#### 解决

- 修复损坏的数据
- 从备份恢复
- 检查代码逻辑

## 日志分析

### 1. 查看错误日志

```bash
# 查看错误
grep '"level":"error"' /var/log/release-guardian/*.log

# 查看特定错误
grep '"code":"validation_error"' /var/log/release-guardian/*.log
```

### 2. 分析请求模式

```bash
# 查看慢请求
grep durationMs /var/log/release-guardian/*.log | \
  awk -F'"durationMs":' '{print $2}' | \
  sort -n | tail -10

# 查看错误率
grep statusCode /var/log/release-guardian/*.log | \
  awk -F'"statusCode":' '{print $2}' | \
  sort | uniq -c | sort -rn
```

### 3. 关联日志

```bash
# 通过 requestId 关联
grep "abc-123-def-456" /var/log/release-guardian/*.log
```

## 监控告警

### 1. 检查指标

```bash
# 查看指标
curl -s http://localhost:3000/api/metrics | jq .

# 查看 Prometheus 指标
curl -s http://localhost:3000/metrics
```

### 2. 验证告警

```bash
# 查看告警规则
curl -s http://localhost:9090/api/v1/rules

# 查看触发的告警
curl -s http://localhost:9093/api/v1/alerts
```

## 调试技巧

### 1. 启用调试日志

```bash
NODE_ENV=development npm start
```

### 2. 使用 Node.js 调试器

```bash
node --inspect src/server.js
# 打开 Chrome DevTools: chrome://inspect
```

### 3. 性能分析

```bash
# 生成性能报告
node --prof src/server.js
node --prof-process isolate-*.log > processed.txt

# 使用 Clinic.js
npx clinic doctor -- node src/server.js
```

## 获取帮助

### 1. 检查文档

- [README](../README.md)
- [架构文档](ARCHITECTURE.md)
- [部署指南](DEPLOYMENT.md)
- [运维手册](OPERATIONS.md)

### 2. 搜索问题

- GitHub Issues
- Stack Overflow
- Google

### 3. 报告问题

- 提供详细描述
- 包含复现步骤
- 附上日志和错误信息
- 说明环境信息
