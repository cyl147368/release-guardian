import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Logger } from "../src/lib/logger.js";
import { withRequestLogging, withRateLimit, withApiKeyAuth } from "../src/lib/middleware.js";

function createBuffer() {
  const chunks = [];
  return {
    write(data) { chunks.push(data); return true; },
    get lines() {
      return chunks.join("").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    }
  };
}

function fakeRequest(method = "GET", path = "/api/releases", headers = {}) {
  return { method, url: `http://localhost${path}`, headers };
}

function okApp(payload = { statusCode: 200, headers: {}, body: '{"ok":true}' }) {
  return async () => ({ ...payload });
}

describe("withRequestLogging", () => {
  it("injects x-request-id into response headers", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp(), logger);
    const res = await app(fakeRequest());

    assert.ok(res.headers["x-request-id"]);
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });

  it("reuses client-provided x-request-id", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp(), logger);
    const reqId = "test-correlation-id-12345";
    const res = await app(fakeRequest("GET", "/health", { "x-request-id": reqId }));

    assert.equal(res.headers["x-request-id"], reqId);
  });

  it("logs request_started and request_completed", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp(), logger);
    await app(fakeRequest("POST", "/api/releases"));

    const messages = dest.lines.map((l) => l.message);
    assert.ok(messages.includes("request_started"));
    assert.ok(messages.includes("request_completed"));
  });

  it("logs duration in milliseconds", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp(), logger);
    await app(fakeRequest());

    const completed = dest.lines.find((l) => l.message === "request_completed");
    assert.ok(typeof completed.durationMs === "number");
    assert.ok(completed.durationMs >= 0);
  });

  it("warns on 4xx responses", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp({ statusCode: 404, headers: {}, body: "not found" }), logger);
    await app(fakeRequest());

    const completed = dest.lines.find((l) => l.message === "request_completed");
    assert.equal(completed.level, "warn");
  });

  it("errors on 5xx responses", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const app = withRequestLogging(okApp({ statusCode: 500, headers: {}, body: "fail" }), logger);
    await app(fakeRequest());

    const completed = dest.lines.find((l) => l.message === "request_completed");
    assert.equal(completed.level, "error");
  });

  it("logs and rethrows when the app throws", async () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "info", destination: dest });
    const failingApp = async () => { throw new Error("boom"); };
    const app = withRequestLogging(failingApp, logger);

    await assert.rejects(() => app(fakeRequest()), { message: "boom" });

    const failed = dest.lines.find((l) => l.message === "request_failed");
    assert.ok(failed);
    assert.equal(failed.error, "boom");
  });
});

describe("withRateLimit", () => {
  it("allows requests within the limit", async () => {
    const app = withRateLimit(okApp(), { maxRequests: 5, windowMs: 60_000 });
    const res = await app(fakeRequest());

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-ratelimit-limit"], "5");
    assert.equal(res.headers["x-ratelimit-remaining"], "4");
  });

  it("returns 429 when limit exceeded", async () => {
    const app = withRateLimit(okApp(), { maxRequests: 2, windowMs: 60_000 });

    await app(fakeRequest("GET", "/a"));
    await app(fakeRequest("GET", "/b"));
    const res = await app(fakeRequest("GET", "/c"));

    assert.equal(res.statusCode, 429);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, "rate_limit_exceeded");
    assert.ok(res.headers["retry-after"]);
  });

  it("tracks rate limits per client IP", async () => {
    const app = withRateLimit(okApp(), { maxRequests: 1, windowMs: 60_000 });

    const res1 = await app(fakeRequest("GET", "/", { "x-forwarded-for": "10.0.0.1" }));
    const res2 = await app(fakeRequest("GET", "/", { "x-forwarded-for": "10.0.0.2" }));

    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);
  });
});

describe("withApiKeyAuth", () => {
  it("allows whitelisted paths without API key", async () => {
    const app = withApiKeyAuth(okApp(), { apiKeys: ["secret-key"] });

    const health = await app(fakeRequest("GET", "/health"));
    const ready = await app(fakeRequest("GET", "/ready"));

    assert.equal(health.statusCode, 200);
    assert.equal(ready.statusCode, 200);
  });

  it("rejects requests without API key on protected paths", async () => {
    const app = withApiKeyAuth(okApp(), { apiKeys: ["secret-key"] });
    const res = await app(fakeRequest("GET", "/api/releases"));

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, "unauthorized");
  });

  it("rejects requests with invalid API key", async () => {
    const app = withApiKeyAuth(okApp(), { apiKeys: ["secret-key"] });
    const res = await app(fakeRequest("GET", "/api/releases", { "x-api-key": "wrong" }));

    assert.equal(res.statusCode, 401);
  });

  it("allows requests with valid API key", async () => {
    const app = withApiKeyAuth(okApp(), { apiKeys: ["secret-key"] });
    const res = await app(fakeRequest("GET", "/api/releases", { "x-api-key": "secret-key" }));

    assert.equal(res.statusCode, 200);
  });

  it("skips auth when no apiKeys are configured", async () => {
    const app = withApiKeyAuth(okApp(), { apiKeys: [] });
    const res = await app(fakeRequest("GET", "/api/releases"));

    assert.equal(res.statusCode, 200);
  });
});

describe("withCors", () => {
  it("handles OPTIONS preflight requests", async () => {
    const { withCors } = await import("../src/lib/middleware.js");
    const app = withCors(okApp());
    const res = await app({ method: "OPTIONS", url: "http://localhost/api/releases", headers: {} });

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.ok(res.headers["access-control-allow-methods"]);
    assert.ok(res.headers["access-control-allow-headers"]);
  });

  it("adds CORS headers to normal responses", async () => {
    const { withCors } = await import("../src/lib/middleware.js");
    const app = withCors(okApp());
    const res = await app(fakeRequest());

    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.ok(res.headers["access-control-expose-headers"]);
  });

  it("respects custom origin", async () => {
    const { withCors } = await import("../src/lib/middleware.js");
    const app = withCors(okApp(), { allowOrigin: "https://example.com" });
    const res = await app(fakeRequest());

    assert.equal(res.headers["access-control-allow-origin"], "https://example.com");
  });
});

describe("withSecurityHeaders", () => {
  it("adds security headers to responses", async () => {
    const { withSecurityHeaders } = await import("../src/lib/middleware.js");
    const app = withSecurityHeaders(okApp());
    const res = await app(fakeRequest());

    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "DENY");
    assert.ok(res.headers["strict-transport-security"]);
    assert.ok(res.headers["content-security-policy"]);
    assert.equal(res.headers["referrer-policy"], "no-referrer");
    assert.ok(res.headers["permissions-policy"]);
  });

  it("preserves existing response headers", async () => {
    const { withSecurityHeaders } = await import("../src/lib/middleware.js");
    const app = withSecurityHeaders(okApp({ statusCode: 200, headers: { "x-custom": "value" }, body: "ok" }));
    const res = await app(fakeRequest());

    assert.equal(res.headers["x-custom"], "value");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });
});

describe("withBodySizeLimit", () => {
  it("allows requests without Content-Length header", async () => {
    const { withBodySizeLimit } = await import("../src/lib/middleware.js");
    const app = withBodySizeLimit(okApp());
    const res = await app(fakeRequest());
    assert.equal(res.statusCode, 200);
  });

  it("allows requests within the size limit", async () => {
    const { withBodySizeLimit } = await import("../src/lib/middleware.js");
    const app = withBodySizeLimit(okApp(), { maxBytes: 1024 });
    const req = fakeRequest("POST", "/api/releases", { "content-length": "500" });
    const res = await app(req);
    assert.equal(res.statusCode, 200);
  });

  it("rejects requests exceeding the size limit", async () => {
    const { withBodySizeLimit } = await import("../src/lib/middleware.js");
    const app = withBodySizeLimit(okApp(), { maxBytes: 1024 });
    const req = fakeRequest("POST", "/api/releases", { "content-length": "2048" });
    const res = await app(req);
    assert.equal(res.statusCode, 413);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, "payload_too_large");
  });
});

describe("withContentTypeValidation", () => {
  it("allows GET requests without Content-Type", async () => {
    const { withContentTypeValidation } = await import("../src/lib/middleware.js");
    const app = withContentTypeValidation(okApp());
    const res = await app(fakeRequest("GET", "/api/releases"));
    assert.equal(res.statusCode, 200);
  });

  it("allows POST with application/json", async () => {
    const { withContentTypeValidation } = await import("../src/lib/middleware.js");
    const app = withContentTypeValidation(okApp());
    const req = fakeRequest("POST", "/api/releases", { "content-type": "application/json" });
    const res = await app(req);
    assert.equal(res.statusCode, 200);
  });

  it("rejects POST with unsupported Content-Type", async () => {
    const { withContentTypeValidation } = await import("../src/lib/middleware.js");
    const app = withContentTypeValidation(okApp());
    const req = fakeRequest("POST", "/api/releases", { "content-type": "text/plain" });
    const res = await app(req);
    assert.equal(res.statusCode, 415);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, "unsupported_media_type");
  });

  it("allows POST with application/json including charset", async () => {
    const { withContentTypeValidation } = await import("../src/lib/middleware.js");
    const app = withContentTypeValidation(okApp());
    const req = fakeRequest("POST", "/api/releases", { "content-type": "application/json; charset=utf-8" });
    const res = await app(req);
    assert.equal(res.statusCode, 200);
  });
});
