import test from "node:test";
import assert from "node:assert/strict";
import { withRequestSanitization, withRequestTimeout } from "../src/lib/middleware.js";

test("withRequestSanitization - 正常请求通过", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestSanitization(mockApp);
  
  const req = { url: "http://localhost/api/releases", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 200);
});

test("withRequestSanitization - 路径遍历攻击被阻止", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestSanitization(mockApp);
  
  const req = { url: "http://localhost/../../../etc/passwd", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 400);
  assert.ok(result.body.includes("Path traversal"));
});

test("withRequestSanitization - 编码路径遍历被阻止", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestSanitization(mockApp);
  
  const req = { url: "http://localhost/%2e%2e/%2e%2e/etc/passwd", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 400);
});

test("withRequestSanitization - SQL 注入模式被阻止", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestSanitization(mockApp);
  
  const req = { url: "http://localhost/api/releases?id=1 UNION SELECT * FROM users", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 400);
  assert.ok(result.body.includes("malicious"));
});

test("withRequestSanitization - DROP TABLE 被阻止", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestSanitization(mockApp);
  
  const req = { url: "http://localhost/api/releases?id=1; DROP TABLE users", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 400);
});

test("withRequestTimeout - 正常请求在超时前完成", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestTimeout(mockApp, { timeoutMs: 1000 });
  
  const req = { url: "http://localhost/api/releases", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 200);
});

test("withRequestTimeout - 超时请求返回 408", async () => {
  const mockApp = async (req) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { statusCode: 200, body: "ok" };
  };
  const wrappedApp = withRequestTimeout(mockApp, { timeoutMs: 50 });
  
  const req = { url: "http://localhost/api/releases", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 408);
  assert.ok(result.body.includes("timeout"));
});

test("withRequestTimeout - 使用默认超时时间", async () => {
  const mockApp = async (req) => ({ statusCode: 200, body: "ok" });
  const wrappedApp = withRequestTimeout(mockApp);
  
  const req = { url: "http://localhost/api/releases", method: "GET" };
  const result = await wrappedApp(req);
  
  assert.equal(result.statusCode, 200);
});
