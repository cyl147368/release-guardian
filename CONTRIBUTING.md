# 贡献指南

感谢您对 Release Guardian 项目的关注！本文档将帮助您了解如何参与项目开发。

## 目录

- [开发环境](#开发环境)
- [项目结构](#项目结构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试规范](#测试规范)
- [提交规范](#提交规范)
- [文档规范](#文档规范)

## 开发环境

### 前置要求

- Node.js >= 20
- npm >= 9
- Git

### 环境搭建

```bash
# 1. Fork 项目到您的 GitHub 账号

# 2. 克隆项目
git clone https://github.com/your-username/release-guardian.git
cd release-guardian

# 3. 安装依赖
npm install

# 4. 运行测试
npm test

# 5. 启动开发服务器
npm run dev
```

### 开发工具推荐

- **编辑器**: VS Code
- **扩展**: ESLint, Prettier, GitLens
- **终端**: iTerm2 或 Windows Terminal

## 项目结构

```
release-guardian/
├── src/                    # 源代码
│   ├── app.js             # HTTP 路由和静态文件服务
│   ├── bootstrap.js       # 服务器启动和中间件管道
│   ├── server.js          # 入口文件
│   ├── repository.js      # JSON 文件持久化
│   ├── lib/               # 工具库
│   │   ├── audit.js       # 审计日志模块
│   │   ├── healthcheck.js # 健康检查
│   │   ├── http.js        # HTTP 工具函数
│   │   ├── logger.js      # 结构化日志
│   │   ├── metrics.js     # 性能指标
│   │   ├── middleware.js  # 中间件
│   │   ├── sanitization.js# 输入清理
│   │   ├── time.js        # 时间工具
│   │   ├── validation.js  # 输入验证
│   │   ├── webhooks.js    # Webhook 管理
│   │   └── websocket.js   # WebSocket 实时推送
│   └── services/          # 业务逻辑
│       └── releaseService.js
├── tests/                  # 测试文件
├── public/                 # 前端静态资源
│   ├── index.html
│   ├── css/
│   └── js/
├── docs/                   # 文档
├── openapi/                # OpenAPI 规范
├── scripts/                # 工具脚本
└── data/                   # 数据文件
```

## 开发流程

### 1. 创建功能分支

```bash
# 确保主分支是最新的
git checkout main
git pull origin main

# 创建功能分支
git checkout -b feature/your-feature-name
```

### 2. 开发功能

```bash
# 编写代码
# 运行测试
npm test

# 运行质量检查
npm run quality
```

### 3. 提交更改

```bash
# 添加更改
git add .

# 提交（遵循提交规范）
git commit -m "feat: 添加新功能描述"
```

### 4. 推送并创建 PR

```bash
# 推送到远程
git push origin feature/your-feature-name

# 在 GitHub 上创建 Pull Request
```

## 代码规范

### JavaScript 规范

- 使用 ES Modules (`import/export`)
- 使用 `const` 和 `let`，避免 `var`
- 使用箭头函数或函数声明
- 使用模板字符串
- 使用解构赋值
- 使用 async/await 处理异步

### 命名规范

- **文件名**: camelCase (`releaseService.js`)
- **类名**: PascalCase (`ReleaseService`)
- **函数名**: camelCase (`createRelease`)
- **常量**: UPPER_SNAKE_CASE (`SERVICE_VERSION`)
- **变量**: camelCase (`releaseId`)

### 代码风格

```javascript
// ✅ 好的示例
export function createRelease(input) {
  const timestamp = this.clock();
  const risk = calculateRisk(input);
  
  return {
    id: randomUUID(),
    application: input.application.trim(),
    version: input.version.trim(),
    // ...
  };
}

// ❌ 避免的示例
export function createRelease(input) {
  var timestamp = this.clock()
  var risk = calculateRisk(input)
  
  return {
    id: randomUUID(),
    application: input.application.trim(),
    version: input.version.trim(),
    // ...
  }
}
```

## 测试规范

### 测试文件命名

- 测试文件放在 `tests/` 目录
- 文件名格式: `{模块名}.test.js`
- 例如: `releaseService.test.js`

### 测试结构

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("模块名称", () => {
  describe("功能分组", () => {
    it("测试用例描述", () => {
      // Arrange - 准备测试数据
      const input = { /* ... */ };
      
      // Act - 执行被测试的功能
      const result = functionUnderTest(input);
      
      // Assert - 验证结果
      assert.equal(result.status, "expected");
    });
  });
});
```

### 测试覆盖率要求

- 行覆盖率: >= 80%
- 分支覆盖率: >= 80%
- 函数覆盖率: >= 80%

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm run test:bootstrap

# 运行覆盖率检查
npm run test:coverage
```

## 提交规范

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (type)

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链更新

### 示例

```
feat(release): 添加批量创建发布功能

- 支持一次创建最多 50 个发布
- 验证每个发布的必填字段
- 返回成功和失败的详细信息

Closes #123
```

```
fix(auth): 修复 API 密钥验证逻辑

- 修复空密钥导致的 500 错误
- 添加密钥格式验证

Fixes #456
```

## 文档规范

### 文档类型

1. **README.md**: 项目概述和快速开始
2. **API 文档**: OpenAPI 规范 (`openapi/openapi.yaml`)
3. **架构文档**: `docs/ARCHITECTURE.md`
4. **部署文档**: `docs/DEPLOYMENT.md`
5. **运维文档**: `docs/OPERATIONS.md`

### 文档更新

- 新功能必须更新相关文档
- API 变更必须更新 OpenAPI 规范
- 重大变更必须更新 CHANGELOG.md

### 多语言支持

- 主文档: 中文
- 翻译文档: 英文、日文、韩文、繁体中文
- 翻译放在 `docs/` 目录

## Pull Request 规范

### PR 标题

遵循提交规范格式。

### PR 描述

```markdown
## 变更说明

简要描述本次变更的内容。

## 变更类型

- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 重构
- [ ] 测试

## 测试情况

- [ ] 已添加新测试
- [ ] 所有测试通过
- [ ] 覆盖率满足要求

## 相关 Issue

Closes #xxx
```

### 代码审查

- 至少需要 1 个审批
- 所有自动化检查必须通过
- 解决所有审查意见

## 问题反馈

### Bug 报告

使用 Bug Report 模板，包含：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息

### 功能请求

使用 Feature Request 模板，包含：
- 功能描述
- 使用场景
- 实现建议

## 社区准则

- 尊重所有贡献者
- 建设性地提供反馈
- 遵循项目编码规范
- 保持专业和友善

## 联系方式

- GitHub Issues: 项目问题反馈
- Email: 项目维护者邮箱

感谢您的贡献！🎉
