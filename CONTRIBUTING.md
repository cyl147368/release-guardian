# 贡献指南

感谢你对 Release Guardian 的兴趣！我们欢迎所有形式的贡献。

## 如何贡献

### 1. 报告 Bug

使用 [Bug 报告模板](https://github.com/cyl147368/release-guardian/issues/new?template=bug_report.md) 报告 Bug。

**请包含**:
- Bug 描述
- 复现步骤
- 期望行为
- 实际行为
- 环境信息（OS、Node.js 版本等）
- 相关日志

### 2. 建议功能

使用 [功能请求模板](https://github.com/cyl147368/release-guardian/issues/new?template=feature_request.md) 建议新功能。

**请包含**:
- 功能描述
- 使用场景
- 期望行为
- 替代方案

### 3. 提交代码

#### Fork 项目

```bash
# Fork 项目到你的 GitHub
# 克隆你的 Fork
git clone https://github.com/your-username/release-guardian.git
cd release-guardian

# 添加上游仓库
git remote add upstream https://github.com/cyl147368/release-guardian.git
```

#### 创建分支

```bash
# 同步上游
git fetch upstream
git checkout main
git merge upstream/main

# 创建功能分支
git checkout -b feature/amazing-feature
```

#### 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage

# 代码规范检查
npm run lint

# 综合质量检查
npm run quality
```

#### 提交

```bash
# 添加更改
git add .

# 提交（使用语义化提交信息）
git commit -m "feat: 新增超棒功能"

# 推送到你的 Fork
git push origin feature/amazing-feature
```

#### 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "New Pull Request"
3. 选择目标分支（通常是 `main`）
4. 填写 PR 描述
5. 等待代码审查

## 开发环境

### 环境要求

- Node.js >= 20
- npm >= 9
- Git

### 安装

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
```

### 运行

```bash
npm start
```

### 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage

# 运行特定测试文件
node --test tests/app.test.js

# 运行特定测试
node --test --test-name-pattern "GET /health" tests/app.test.js
```

### 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint -- --fix
```

### 综合质量检查

```bash
npm run quality
```

## 代码规范

### JavaScript 规范

- 使用 ES 模块（`import/export`）
- 使用 `const` 和 `let`，避免 `var`
- 使用箭头函数
- 使用模板字符串
- 使用解构赋值
- 使用 async/await

### 命名规范

- **变量和函数**: camelCase
- **类名**: PascalCase
- **常量**: UPPER_SNAKE_CASE
- **文件名**: camelCase 或 kebab-case

### 注释规范

```javascript
/**
 * 函数描述
 * @param {string} param1 - 参数1描述
 * @param {number} param2 - 参数2描述
 * @returns {object} 返回值描述
 */
function myFunction(param1, param2) {
  // 实现
}
```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

**示例**:
```
feat(release): 新增批量创建功能

- 支持一次创建多个发布
- 验证每个发布的有效性
- 返回创建结果和错误信息

Closes #123
```

## 测试指南

### 测试原则

- 每个功能都应该有测试
- 测试应该独立且可重复
- 测试应该快速执行
- 测试应该清晰易懂

### 编写测试

```javascript
import test from "node:test";
import assert from "node:assert/strict";

test("功能描述", async () => {
  // 准备
  const input = { /* ... */ };
  
  // 执行
  const result = await myFunction(input);
  
  // 断言
  assert.equal(result.status, "success");
  assert.ok(result.data);
});
```

### 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看未覆盖的行
npm run test:coverage 2>&1 | grep "uncovered"
```

### 测试最佳实践

- 测试边界条件
- 测试错误情况
- 使用描述性测试名称
- 避免测试实现细节
- 使用 mock 和 stub

## 文档指南

### 文档类型

- **README.md**: 项目概述和快速开始
- **docs/**: 详细文档
- **代码注释**: 函数和复杂逻辑说明
- **CHANGELOG.md**: 版本更新记录

### 编写文档

- 使用清晰简洁的语言
- 提供代码示例
- 包含使用场景
- 保持文档更新

### 文档结构

```
docs/
├── ARCHITECTURE.md    # 架构文档
├── DEPLOYMENT.md      # 部署指南
├── OPERATIONS.md      # 运维手册
├── OBSERVABILITY.md   # 可观测性
├── PERFORMANCE.md     # 性能指南
├── SECURITY.md        # 安全策略
├── TROUBLESHOOTING.md # 故障排查
└── ROADMAP.md         # 路线图
```

## Pull Request 指南

### PR 描述

**请包含**:
- 更改描述
- 相关 Issue
- 测试说明
- 文档更新

**示例**:
```markdown
## 描述

新增批量创建发布功能。

## 相关 Issue

Closes #123

## 更改内容

- 新增 POST /api/releases/bulk 端点
- 支持一次创建多个发布
- 验证每个发布的有效性
- 返回创建结果和错误信息

## 测试

- [x] 单元测试
- [x] 集成测试
- [x] 代码覆盖率 > 90%

## 文档

- [x] API 文档更新
- [x] README 更新
- [x] CHANGELOG 更新
```

### 代码审查

**审查要点**:
- 代码质量
- 测试覆盖
- 文档更新
- 性能影响
- 安全考虑

**审查流程**:
1. 自动化检查（CI）
2. 人工审查
3. 反馈和修改
4. 合并发布

## 发布流程

### 版本号

使用 [语义化版本](https://semver.org/):

- **主版本号**: 不兼容的 API 更改
- **次版本号**: 向后兼容的功能
- **修订号**: 向后兼容的 Bug 修复

### 发布步骤

1. 更新版本号
2. 更新 CHANGELOG
3. 创建 Git 标签
4. 发布到 npm（如果适用）
5. 创建 GitHub Release
6. 发布公告

## 社区

### 沟通渠道

- **GitHub Issues**: Bug 报告和功能请求
- **GitHub Discussions**: 一般讨论和问答
- **邮件**: security@example.com（安全问题）

### 行为准则

- 尊重他人
- 包容不同观点
- 建设性反馈
- 专业态度

### 获得帮助

- 查看文档
- 搜索现有 Issue
- 提问时提供详细信息
- 耐心等待回复

## 许可证

贡献即表示你同意你的贡献将在 [MIT 许可证](LICENSE) 下发布。

## 致谢

感谢所有贡献者的支持！

## 常见问题

### Q: 如何运行测试？

```bash
npm test
```

### Q: 如何生成覆盖率报告？

```bash
npm run test:coverage
```

### Q: 如何检查代码规范？

```bash
npm run lint
```

### Q: 如何运行综合质量检查？

```bash
npm run quality
```

### Q: 如何提交 PR？

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 PR
5. 等待审查

### Q: 如何报告安全漏洞？

发送邮件至 security@example.com，不要公开披露。

### Q: 如何加入社区？

- GitHub Discussions
- 邮件列表
- 社区论坛

## 联系方式

- **GitHub**: https://github.com/cyl147368/release-guardian
- **邮件**: support@example.com
- **文档**: https://github.com/cyl147368/release-guardian/docs
