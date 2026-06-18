import test from "node:test";
import assert from "node:assert/strict";

import { createRuntime } from "../src/bootstrap.js";

test("runtime listens on host and port by default", async () => {
  const events = createFakeServerEvents();
  const calls = [];
  const logs = [];

  const runtime = createRuntime({
    port: 3200,
    host: "127.0.0.1",
    logger: {
      log(message) {
        logs.push(message);
      }
    },
    createServerImpl(handler) {
      events.handler = handler;
      return createFakeServer(events, calls);
    }
  });

  const result = await runtime.listen();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 2), [3200, "127.0.0.1"]);
  assert.equal(result.address, "http://127.0.0.1:3200");
  assert.equal(logs[0], "Release Guardian listening on http://127.0.0.1:3200");
});

test("runtime listens on a unix socket when configured", async () => {
  const events = createFakeServerEvents();
  const calls = [];

  const runtime = createRuntime({
    socketPath: "/tmp/release-guardian.sock",
    logger: {
      log() {}
    },
    createServerImpl() {
      return createFakeServer(events, calls);
    }
  });

  const result = await runtime.listen();

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/tmp/release-guardian.sock");
  assert.equal(result.address, "unix:///tmp/release-guardian.sock");
});

test("runtime passes requests through the app pipeline", async () => {
  const events = createFakeServerEvents();

  createRuntime({
    createServerImpl(handler) {
      events.handler = handler;
      return createFakeServer(events, []);
    }
  });

  const response = createMockResponse();
  await events.handler(createMockRequest("GET", "/health"), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "ok");
});

function createFakeServer(events, calls) {
  return {
    once(event, listener) {
      events[event] = listener;
    },
    off(event, listener) {
      if (events[event] === listener) {
        delete events[event];
      }
    },
    on(event, listener) {
      // WebSocket upgrade handler 注册
      events[event] = listener;
    },
    listen(...args) {
      calls.push(args);
      const callback = args.at(-1);
      callback();
    }
  };
}

function createFakeServerEvents() {
  return {
    handler: null
  };
}

function createMockRequest(method, url) {
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      return;
    }
  };
}

function createMockResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      // 支持 Buffer 和字符串
      this.body = Buffer.isBuffer(body) ? body.toString("utf8") : body;
    }
  };
}
