# 部署指南

## 概述

Release Guardian 支持多种部署方式，从简单的单机部署到高可用的 Kubernetes 集群。

## 部署选项

### 1. 单机部署（推荐入门）

最简单的部署方式，适合开发和测试环境。

```bash
# 克隆项目
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian

# 安装依赖
npm install

# 启动服务
npm start
```

**配置**：
- 默认监听 `127.0.0.1:3000`
- 数据存储在 `data/seed.json`
- 日志输出到标准输出

### 2. Docker 部署

适合生产环境，隔离性好。

```bash
# 构建镜像
docker build -t release-guardian:3.0.0 .

# 运行容器
docker run -d \
  --name release-guardian \
  -p 3000:3000 \
  -v rg-data:/app/data \
  -e NODE_ENV=production \
  -e RATE_LIMIT_ENABLED=true \
  -e API_KEYS=your-secret-key \
  release-guardian:3.0.0
```

**环境变量**：
- `NODE_ENV=production` - 启用生产模式
- `RATE_LIMIT_ENABLED=true` - 启用速率限制
- `API_KEYS=key1,key2` - API 密钥（逗号分隔）
- `CORS_ORIGIN=https://your-domain.com` - CORS 允许源

### 3. Docker Compose 部署

适合需要反向代理的场景。

```yaml
# docker-compose.yml
version: '3.8'

services:
  release-guardian:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - rg-data:/app/data
    environment:
      - NODE_ENV=production
      - RATE_LIMIT_ENABLED=true
      - API_KEYS=${API_KEYS}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - release-guardian
    restart: unless-stopped

volumes:
  rg-data:
```

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f release-guardian
```

### 4. Kubernetes 部署

适合高可用和可扩展场景。

#### 使用 Kustomize

```bash
# 生产环境
kubectl apply -k k8s/overlays/production

# 预发布环境
kubectl apply -k k8s/overlays/staging
```

#### 使用 Helm

```bash
# 添加 Helm 仓库（如果有的话）
helm repo add release-guardian https://your-helm-repo.com

# 安装
helm install release-guardian release-guardian/release-guardian \
  --set replicaCount=3 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=rg.example.com \
  --set ingress.tls[0].secretName=rg-tls \
  --set ingress.tls[0].hosts[0]=rg.example.com
```

### 5. Systemd 服务部署

适合传统 Linux 服务器。

```ini
# /etc/systemd/system/release-guardian.service
[Unit]
Description=Release Guardian
After=network.target

[Service]
Type=simple
User=release-guardian
Group=release-guardian
WorkingDirectory=/opt/release-guardian
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

```bash
# 创建用户
sudo useradd -r -s /bin/false release-guardian

# 安装应用
sudo mkdir -p /opt/release-guardian
sudo cp -r . /opt/release-guardian
sudo chown -R release-guardian:release-guardian /opt/release-guardian

# 启用服务
sudo systemctl daemon-reload
sudo systemctl enable release-guardian
sudo systemctl start release-guardian

# 查看状态
sudo systemctl status release-guardian
```

## 配置参考

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `NODE_ENV` | `development` | 运行环境 |
| `RATE_LIMIT_ENABLED` | `false` | 启用速率限制 |
| `RATE_LIMIT_MAX` | `100` | 窗口内最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 速率限制窗口（毫秒） |
| `API_KEYS` | _(空)_ | API 密钥列表（逗号分隔） |
| `CORS_ORIGIN` | `*` | CORS 允许源 |
| `MAX_BODY_BYTES` | `1048576` | 最大请求体大小（字节） |
| `SECURITY_HEADERS` | `true` | 启用安全头 |
| `SOCKET_PATH` | _(空)_ | Unix Socket 路径（覆盖 HOST:PORT） |

### 配置文件

项目使用环境变量配置，不依赖配置文件。所有配置都可以通过环境变量覆盖。

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name rg.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rg.example.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Traefik

```yaml
# docker-compose.yml
services:
  release-guardian:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.rg.rule=Host(`rg.example.com`)"
      - "traefik.http.routers.rg.tls=true"
      - "traefik.http.services.rg.loadbalancer.server.port=3000"
```

## 数据持久化

### 备份

数据存储在 `data/seed.json`，定期备份：

```bash
# 每日备份
0 2 * * * cp /opt/release-guardian/data/seed.json /backup/release-guardian-$(date +\%Y\%m\%d).json
```

### 恢复

```bash
# 停止服务
systemctl stop release-guardian

# 恢复数据
cp /backup/release-guardian-20260618.json /opt/release-guardian/data/seed.json

# 启动服务
systemctl start release-guardian
```

## 监控

### 健康检查

```bash
# 存活检查
curl http://localhost:3000/health

# 就绪检查
curl http://localhost:3000/ready
```

### Prometheus 指标

```bash
# 获取指标
curl http://localhost:3000/metrics
```

### 日志

日志输出到标准输出，JSON 格式：

```json
{
  "timestamp": "2026-06-18T12:00:00.000Z",
  "level": "info",
  "message": "request_completed",
  "requestId": "abc-123",
  "method": "GET",
  "path": "/api/releases",
  "statusCode": 200,
  "durationMs": 15
}
```

## 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

2. **权限问题**
   ```bash
   chown -R release-guardian:release-guardian /opt/release-guardian
   ```

3. **数据损坏**
   ```bash
   # 从备份恢复
   cp /backup/seed.json /opt/release-guardian/data/seed.json
   ```

### 调试模式

```bash
NODE_ENV=development npm start
```

## 性能调优

### 1. 启用速率限制

```bash
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_MAX=1000
export RATE_LIMIT_WINDOW_MS=60000
```

### 2. 调整请求体限制

```bash
export MAX_BODY_BYTES=10485760  # 10MB
```

### 3. 使用 Unix Socket

```bash
export SOCKET_PATH=/var/run/release-guardian.sock
```

## 安全加固

### 1. 启用 API 密钥

```bash
export API_KEYS=your-secret-key-1,your-secret-key-2
```

### 2. 配置 CORS

```bash
export CORS_ORIGIN=https://your-domain.com
```

### 3. 启用安全头

```bash
export SECURITY_HEADERS=true
```

### 4. 使用 HTTPS

始终在反向代理后使用 HTTPS。

## 升级

### Docker

```bash
docker pull release-guardian:latest
docker stop release-guardian
docker rm release-guardian
docker run -d ... release-guardian:latest
```

### 源码

```bash
cd /opt/release-guardian
git pull
npm install
systemctl restart release-guardian
```
