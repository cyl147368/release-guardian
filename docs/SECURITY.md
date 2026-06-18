# 安全策略

## 概述

Release Guardian 采用纵深防御策略，从多个层面保护系统和数据安全。

## 安全架构

### 1. 网络层安全

- **HTTPS 强制**：生产环境必须使用 HTTPS
- **CORS 配置**：限制允许的源
- **安全头**：自动添加安全响应头

### 2. 应用层安全

- **输入验证**：所有输入都经过严格验证
- **输出编码**：防止 XSS 攻击
- **速率限制**：防止暴力攻击和 DDoS
- **API 密钥认证**：可选的身份验证

### 3. 数据层安全

- **数据加密**：传输中加密（HTTPS）
- **访问控制**：基于 API 密钥的访问控制
- **审计日志**：记录所有操作

## 安全功能

### 1. 安全响应头

自动添加以下安全头：

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'none'
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 2. CORS 配置

```bash
# 允许特定源
export CORS_ORIGIN=https://your-domain.com

# 允许多个源（逗号分隔）
export CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

### 3. API 密钥认证

```bash
# 生成密钥
openssl rand -hex 32

# 配置密钥
export API_KEYS=key1,key2,key3

# 使用密钥
curl -H "X-API-Key: key1" http://localhost:3000/api/releases
```

**白名单路径**（不需要认证）：
- `/health`
- `/ready`
- `/`
- `/openapi/*`

### 4. 速率限制

```bash
# 启用速率限制
export RATE_LIMIT_ENABLED=true

# 配置限制
export RATE_LIMIT_MAX=100        # 窗口内最大请求数
export RATE_LIMIT_WINDOW_MS=60000 # 窗口大小（毫秒）
```

**响应头**：
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1624000000
Retry-After: 60  # 仅在触发限制时返回
```

### 5. 输入验证

所有输入都经过以下验证：

- **类型检查**：确保字段类型正确
- **范围检查**：数值字段在有效范围内
- **枚举检查**：状态、环境等字段值在允许列表中
- **字符串清理**：HTML 转义、控制字符移除

### 6. 请求体限制

```bash
# 配置最大请求体大小
export MAX_BODY_BYTES=1048576  # 1MB
```

## 安全最佳实践

### 1. 生产环境配置

```bash
# 必须配置
export NODE_ENV=production
export API_KEYS=your-strong-secret-key
export CORS_ORIGIN=https://your-domain.com
export RATE_LIMIT_ENABLED=true
export SECURITY_HEADERS=true

# 推荐配置
export RATE_LIMIT_MAX=1000
export RATE_LIMIT_WINDOW_MS=60000
export MAX_BODY_BYTES=1048576
```

### 2. 反向代理安全

始终在反向代理（Nginx/Traefik）后部署：

```nginx
# Nginx 安全配置
server {
    # 隐藏版本号
    server_tokens off;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 请求限制
    client_max_body_size 1m;
    client_body_timeout 10s;
    client_header_timeout 10s;
    
    # 连接限制
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 100;
}
```

### 3. 密钥管理

- 使用强随机密钥（至少 32 字节）
- 定期轮换密钥
- 不要在代码中硬编码密钥
- 使用环境变量或密钥管理服务

### 4. 日志安全

- 不要记录敏感信息（密码、密钥）
- 使用结构化日志便于分析
- 定期审查日志

## 漏洞报告

### 1. 报告流程

如果发现安全漏洞，请按以下步骤报告：

1. **不要公开披露**
2. 发送邮件至 security@example.com
3. 提供详细描述和复现步骤
4. 我们会在 48 小时内回复

### 2. 报告内容

请包含以下信息：

- 漏洞描述
- 影响范围
- 复现步骤
- 建议修复方案（如果有）

### 3. 响应时间

- **严重漏洞**：24 小时内响应
- **高危漏洞**：48 小时内响应
- **中危漏洞**：7 天内响应
- **低危漏洞**：30 天内响应

## 安全更新

### 1. 依赖更新

定期更新依赖：

```bash
npm audit
npm update
```

### 2. 安全公告

关注安全公告：

- GitHub Security Advisories
- Node.js Security Releases
- npm Security Advisories

## 合规性

### 1. 数据保护

- 最小化数据收集
- 数据加密存储和传输
- 访问控制和审计

### 2. 审计追踪

所有操作都记录审计日志：

```bash
# 查询审计日志
curl -s "http://localhost:3000/api/audit?limit=100" | jq .

# 查询特定事件
curl -s "http://localhost:3000/api/audit?event=release.approved" | jq .
```

### 3. 访问控制

基于 API 密钥的访问控制：

```bash
# 创建发布
curl -X POST -H "X-API-Key: key1" \
  -H "Content-Type: application/json" \
  -d '{"application":"test","version":"1.0.0",...}' \
  http://localhost:3000/api/releases

# 只读访问
curl -H "X-API-Key: key2" \
  http://localhost:3000/api/releases
```

## 安全检查清单

### 部署前检查

- [ ] 启用 HTTPS
- [ ] 配置 CORS
- [ ] 启用 API 密钥认证
- [ ] 启用速率限制
- [ ] 启用安全头
- [ ] 配置请求体限制
- [ ] 审查日志配置
- [ ] 配置监控和告警

### 运行时检查

- [ ] 定期审查日志
- [ ] 监控异常请求
- [ ] 定期轮换密钥
- [ ] 更新依赖
- [ ] 备份数据

### 事件响应

- [ ] 确认漏洞范围
- [ ] 隔离受影响系统
- [ ] 修复漏洞
- [ ] 恢复服务
- [ ] 事后分析

## 安全工具

### 1. 静态分析

```bash
# ESLint 安全规则
npm install --save-dev eslint-plugin-security

# 代码扫描
npm audit
```

### 2. 动态测试

```bash
# 渗透测试
# 使用 OWASP ZAP 或 Burp Suite

# 负载测试
node scripts/performance-test.js
```

### 3. 依赖扫描

```bash
# npm audit
npm audit

# Snyk
npx snyk test
```
