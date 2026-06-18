# CI/CD 配置指南

本文档详细说明 Release Guardian 项目的 GitHub Actions CI/CD 配置。

## 概述

项目使用 GitHub Actions 实现完整的 CI/CD 流水线，包括：
- 代码规范检查
- 多版本 Node.js 测试
- 测试覆盖率检查
- OpenAPI 契约测试
- 综合质量门禁
- Docker 构建验证

## 工作流配置

### 触发条件

```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

### 任务说明

#### 1. 代码规范检查 (lint)

```yaml
lint:
  name: 代码规范检查
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - run: npm run lint
```

**作用**: 检查所有 JavaScript 文件的语法正确性。

#### 2. 单元测试 (test)

```yaml
test:
  name: 单元测试 (Node ${{ matrix.node-version }})
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      node-version: [20, 22, 24]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: npm
    - run: npm ci
    - name: 运行测试
      run: npm test
      timeout-minutes: 5
```

**作用**: 在多个 Node.js 版本上运行测试，确保兼容性。

#### 3. 覆盖率检查 (coverage)

```yaml
coverage:
  name: 覆盖率检查
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - name: 运行测试并生成覆盖率报告
      run: npm run test:coverage
      timeout-minutes: 5
    - name: 检查覆盖率阈值
      run: node scripts/quality-check.js --min-coverage 80
```

**作用**: 生成测试覆盖率报告并检查是否达到 80% 阈值。

#### 4. OpenAPI 契约测试 (openapi)

```yaml
openapi:
  name: OpenAPI 契约测试
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - name: 验证 OpenAPI 规范
      run: node --test tests/openapi.test.js
      timeout-minutes: 2
```

**作用**: 验证 OpenAPI 规范文件的有效性。

#### 5. 综合质量门禁 (quality)

```yaml
quality:
  name: 综合质量门禁
  runs-on: ubuntu-latest
  needs: [lint, test, coverage, openapi]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - name: 运行完整质量检查
      run: npm run quality
      timeout-minutes: 10
```

**作用**: 运行完整的质量检查，包括所有测试和覆盖率验证。

#### 6. Docker 构建验证 (docker)

```yaml
docker:
  name: Docker 构建验证
  runs-on: ubuntu-latest
  needs: [quality]
  steps:
    - uses: actions/checkout@v4
    - name: 构建 Docker 镜像
      run: docker build -t release-guardian:test .
    - name: 验证容器启动
      run: |
        docker run -d --name rg-test -p 3000:3000 release-guardian:test
        sleep 5
        curl -sf http://localhost:3000/health | grep -q "ok"
        docker stop rg-test
```

**作用**: 验证 Docker 镜像构建和容器启动。

## 常见问题解决

### 1. 测试超时

**症状**: 测试任务超时失败

**解决方案**:
- 增加 `timeout-minutes` 配置
- 检查是否有无限循环或长时间运行的测试
- 确保测试服务器正确关闭

### 2. 覆盖率检查失败

**症状**: 覆盖率低于阈值

**解决方案**:
- 运行 `npm run test:coverage` 查看详细报告
- 为未覆盖的代码添加测试
- 使用 `--min-coverage` 参数调整阈值

### 3. 依赖安装失败

**症状**: `npm ci` 失败

**解决方案**:
- 确保 `package-lock.json` 存在且是最新的
- 检查 Node.js 版本兼容性
- 清除 npm 缓存: `npm cache clean --force`

### 4. Docker 构建失败

**症状**: Docker 镜像构建失败

**解决方案**:
- 检查 Dockerfile 语法
- 确保所有必需文件都在构建上下文中
- 验证基础镜像可用性

## 本地测试

### 运行完整 CI 检查

```bash
# 运行所有质量检查
npm run quality

# 运行测试
npm test

# 运行覆盖率检查
npm run test:coverage

# 运行 lint 检查
npm run lint
```

### 模拟 CI 环境

```bash
# 使用 Node.js 24 运行测试
npx node@24 --test tests/*.test.js

# 检查覆盖率
npx node@24 --test --test-concurrency=1 --experimental-test-coverage tests/*.test.js
```

## 最佳实践

1. **保持 package-lock.json 更新**: 每次修改依赖后都要更新锁定文件
2. **使用 npm ci**: 在 CI 环境中使用 `npm ci` 而不是 `npm install`
3. **设置超时**: 为所有长时间运行的任务设置超时
4. **并行测试**: 使用 `--test-concurrency=1` 避免测试污染
5. **清理资源**: 确保测试中的服务器和连接都被正确关闭

## 监控和通知

### 查看 CI 状态

- 在 GitHub 仓库页面查看 Actions 标签
- 查看每个工作流的运行状态和日志
- 设置邮件通知以接收失败警报

### 覆盖率报告

- 覆盖率报告会在 CI 运行后生成
- 可以在 Actions 日志中查看详细报告
- 使用第三方服务（如 Codecov）可以更好地可视化覆盖率趋势

## 参考资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Node.js 测试运行器](https://nodejs.org/api/test.html)
- [npm ci 命令](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Docker 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
