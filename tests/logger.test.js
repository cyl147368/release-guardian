import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Logger, createLogger } from "../src/lib/logger.js";

function createBuffer() {
  const chunks = [];
  return {
    write(data) {
      chunks.push(data);
      return true;
    },
    get lines() {
      return chunks
        .join("")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }
  };
}

describe("Logger", () => {
  it("writes structured JSON log entries", () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "debug", destination: dest });
    logger.info("test_message", { foo: "bar" });

    const lines = dest.lines;
    assert.equal(lines.length, 1);
    assert.equal(lines[0].level, "info");
    assert.equal(lines[0].message, "test_message");
    assert.equal(lines[0].foo, "bar");
    assert.ok(lines[0].timestamp);
  });

  it("respects log level filtering", () => {
    const dest = createBuffer();
    const logger = new Logger({ level: "warn", destination: dest });

    logger.debug("ignored");
    logger.info("ignored");
    logger.warn("visible");
    logger.error("visible");

    const lines = dest.lines;
    assert.equal(lines.length, 2);
    assert.equal(lines[0].level, "warn");
    assert.equal(lines[1].level, "error");
  });

  it("includes prefix in child loggers", () => {
    const dest = createBuffer();
    const parent = new Logger({ level: "info", destination: dest });
    const child = parent.child("http");

    child.info("request_started", { method: "GET" });

    const lines = dest.lines;
    assert.equal(lines[0].logger, "http");
  });

  it("chains child logger prefixes", () => {
    const dest = createBuffer();
    const parent = new Logger({ level: "info", destination: dest });
    const child = parent.child("http").child("auth");

    child.info("check");

    assert.equal(dest.lines[0].logger, "http:auth");
  });

  it("createLogger reads LOG_LEVEL from environment", () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";
    const logger = createLogger();
    assert.equal(logger.level, 0); // debug = 0
    process.env.LOG_LEVEL = original ?? "";
  });

  it("defaults to info level when LOG_LEVEL is unset", () => {
    const original = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    const logger = createLogger();
    assert.equal(logger.level, 1); // info = 1
    if (original !== undefined) process.env.LOG_LEVEL = original;
  });
});
