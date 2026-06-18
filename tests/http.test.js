import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jsonResponse,
  textResponse,
  sendResponse,
  HttpError,
  etagFor
} from "../src/lib/http.js";

describe("HTTP utilities", () => {
  describe("jsonResponse", () => {
    it("creates a JSON response with correct headers", () => {
      const res = jsonResponse(200, { ok: true });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
      assert.equal(JSON.parse(res.body).ok, true);
    });

    it("supports custom headers", () => {
      const res = jsonResponse(200, {}, { "x-custom": "value" });
      assert.equal(res.headers["x-custom"], "value");
    });

    it("handles null payload", () => {
      const res = jsonResponse(204, null);
      assert.equal(res.statusCode, 204);
    });
  });

  describe("textResponse", () => {
    it("creates a text response with correct headers", () => {
      const res = textResponse(200, "ok");
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/plain; charset=utf-8");
      assert.equal(res.body, "ok");
    });
  });

  describe("HttpError", () => {
    it("creates an error with status code and code", () => {
      const err = new HttpError(404, "not_found", "Resource not found");
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, "not_found");
      assert.equal(err.message, "Resource not found");
    });

    it("supports optional details", () => {
      const err = new HttpError(400, "validation_error", "Invalid input", { field: "name" });
      assert.deepEqual(err.details, { field: "name" });
    });

    it("is an instance of Error", () => {
      const err = new HttpError(500, "internal_error", "Something went wrong");
      assert.ok(err instanceof Error);
    });
  });

  describe("etagFor", () => {
    it("generates a consistent hash for the same payload", () => {
      const hash1 = etagFor({ a: 1, b: 2 });
      const hash2 = etagFor({ a: 1, b: 2 });
      assert.equal(hash1, hash2);
    });

    it("generates different hashes for different payloads", () => {
      const hash1 = etagFor({ a: 1 });
      const hash2 = etagFor({ a: 2 });
      assert.notEqual(hash1, hash2);
    });

    it("returns a hex string", () => {
      const hash = etagFor({ test: true });
      assert.match(hash, /^[a-f0-9]+$/);
    });
  });

  describe("sendResponse", () => {
    it("writes status code, headers, and body to the response", () => {
      const response = {
        statusCode: null,
        headers: null,
        body: "",
        writeHead(statusCode, headers) {
          this.statusCode = statusCode;
          this.headers = headers;
        },
        end(body) {
          this.body = body;
        }
      };
      const payload = jsonResponse(200, { ok: true });
      sendResponse(response, payload);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
      assert.ok(response.body.includes('"ok"'));
    });
  });
});
