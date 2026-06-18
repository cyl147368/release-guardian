import { createHash } from "node:crypto";

export function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(payload, null, 2)
  };
}

export function textResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers
    },
    body
  };
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export function sendResponse(response, payload) {
  const body = payload.body || "";
  const buffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  
  // 自动设置 Content-Length
  const headers = {
    ...payload.headers,
    "content-length": String(buffer.length),
  };
  
  response.writeHead(payload.statusCode, headers);
  response.end(buffer);
}

export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function etagFor(payload) {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}
