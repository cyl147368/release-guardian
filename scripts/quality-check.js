#!/usr/bin/env node
/**
 * 代码质量检查脚本
 * 
 * 运行完整的质量检查流程：语法检查、测试、覆盖率验证
 * 
 * 用法: node scripts/quality-check.js [--min-coverage 80]
 */

import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "min-coverage": { type: "string", default: "80" },
    help: { type: "boolean", default: false }
  },
  strict: true
});

if (values.help) {
  console.log("用法: node scripts/quality-check.js [--min-coverage 80]");
  process.exit(0);
}

const MIN_COVERAGE = Number(values["min-coverage"]);

console.log("=== Release Guardian 代码质量检查 ===\n");

let passed = true;

function runStep(name, command) {
  console.log(`▸ ${name}...`);
  try {
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`  ✓ ${name} 通过\n`);
    return output;
  } catch (error) {
    console.error(`  ✗ ${name} 失败`);
    console.error(`  ${error.stderr || error.message}\n`);
    passed = false;
    return null;
  }
}

// 1. 语法检查
runStep("语法检查", "npm run lint");

// 重置数据文件
function resetSeedData() {
  try {
    execSync("git show 78780e9:data/seed.json > data/seed.json", { encoding: "utf8", stdio: "pipe" });
  } catch {
    // 如果 git show 失败，手动重置
    const fs = require("fs");
    const defaultSeed = { releases: [], teams: [{ id: "release_management", displayName: "Release Management" }, { id: "security", displayName: "Security" }, { id: "sre", displayName: "SRE" }] };
    fs.writeFileSync("data/seed.json", JSON.stringify(defaultSeed, null, 2) + "
");
  }
}

// 2. 测试
resetSeedData();
const testOutput = runStep("单元测试", "npm test");

// 3. 覆盖率
resetSeedData();
const coverageOutput = runStep("覆盖率检查", "npm run test:coverage");

if (coverageOutput) {
  const match = coverageOutput.match(/all files\s*\|\s*([\d.]+)/);
  if (match) {
    const coverage = parseFloat(match[1]);
    console.log(`  当前覆盖率: ${coverage}%`);
    if (coverage < MIN_COVERAGE) {
      console.error(`  ✗ 覆盖率 ${coverage}% 低于阈值 ${MIN_COVERAGE}%`);
      passed = false;
    } else {
      console.log(`  ✓ 覆盖率满足要求 (>= ${MIN_COVERAGE}%)\n`);
    }
  }
}

// 4. OpenAPI 合约测试
runStep("OpenAPI 合约测试", "node --test tests/openapi.test.js");

console.log("=== 检查结果 ===\n");
if (passed) {
  console.log("✓ 所有质量检查通过！");
  process.exit(0);
} else {
  console.error("✗ 部分质量检查失败");
  process.exit(1);
}
