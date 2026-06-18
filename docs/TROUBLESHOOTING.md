# 故障排除指南

## 常见问题

### 服务无法启动

**症状：** `EADDRINUSE` 错误

**原因：** 端口已被占用

**解决：**
```bash
# 查找占用端口的进程
lsof -i :3000

# 使用不同端口
PORT=3001 npm start
```

### 数据文件损坏

**症状：** `SyntaxError: Unexpected token` 或 `JSON.parse` 错误

**原因：** 数据文件写入中断或手动编辑错误

**解决：**
```bash
# 备份损坏的文件
mv data/release-guardian.json data/release-guardian.json.bak

# 重新初始化
node scripts/seed-demo.js
```

### 测试失败

**症状：** 测试断言失败

**原因：** 数据文件被修改或版本不匹配

**解决：**
```bash
# 恢复原始数据文件
git checkout data/seed.json

# 重新运行测试
npm test
```

### Docker 容器健康检查失败

**症状：** 容器状态为 `unhealthy`

**原因：** 服务未正确启动或端口配置错误

**解决：**
```bash
# 检查容器日志
docker logs release-guardian

# 验证健康检查
docker exec release-guardian wget -qO- http://localhost:3000/health
```

### 速率限制误触发

**症状：** 正常请求返回 429

**原因：** 速率限制配置过低

**解决：**
```bash
# 增加速率限制
RATE_LIMIT_MAX=500

# 或临时禁用
RATE_LIMIT_ENABLED=false
```

### API Key 认证失败

**症状：** 正常请求返回 401

**原因：** API Key 未配置或不匹配

**解决：**
```bash
# 检查配置
echo $API_KEYS

# 确保请求头正确
curl -H "X-API-Key: your-key" http://localhost:3000/api/releases
```

## 日志调试

启用调试日志获取更多信息：

```bash
LOG_LEVEL=debug npm start
```

日志输出为 JSON 格式，可使用 `jq` 过滤：

```bash
# 只看错误日志
npm start 2>&1 | jq 'select(.level == "error")'

# 只看特定请求
npm start 2>&1 | jq 'select(.requestId == "xxx")'
```

## 性能问题

### 响应延迟高

1. 检查日志级别（`debug` 会产生大量日志）
2. 检查数据文件大小
3. 考虑迁移到数据库

### 内存使用高

1. 检查数据文件大小
2. 定期重启服务
3. 迁移到数据库

## 获取帮助

- 查看 GitHub Issues
- 阅读文档：`docs/` 目录
- 提交 Bug 报告：使用 Issue 模板
