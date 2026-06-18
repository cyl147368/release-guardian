import { randomUUID } from "node:crypto";

/**
 * Wraps an app function with request logging, correlation IDs, and timing.
 * Returns a new app function with identical semantics.
 */
export function withRequestLogging(app, logger) {
  return async function loggedApp(request) {
    const start = performance.now();
    const requestId = request.headers?.["x-request-id"] || randomUUID();
    const method = request.method;
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;

    logger.info("request_started", {
      requestId,
      method,
      path: pathname,
      userAgent: request.headers?.["user-agent"] || null,
      clientIp: request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"] || null
    });

    let payload;
    try {
      payload = await app(request);
    } catch (error) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      logger.error("request_failed", {
        requestId,
        method,
        path: pathname,
        durationMs,
        error: error.message,
        errorCode: error.code || "unknown"
      });
      throw error;
    }

    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    // Inject correlation ID into response headers
    payload.headers = {
      ...payload.headers,
      "x-request-id": requestId
    };

    const logLevel = payload.statusCode >= 500 ? "error"
      : payload.statusCode >= 400 ? "warn"
      : "info";

    logger[logLevel]("request_completed", {
      requestId,
      method,
      path: pathname,
      statusCode: payload.statusCode,
      durationMs
    });

    return payload;
  };
}

/**
 * Basic rate limiter using a sliding window in memory.
 * Suitable for single-instance deployments.
 */
export function withRateLimit(app, { maxRequests = 100, windowMs = 60_000 } = {}) {
  const buckets = new Map();

  // Periodic cleanup to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) {
        buckets.delete(key);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  return async function rateLimitedApp(request) {
    const url = new URL(request.url, "http://localhost");
    const clientKey = request.headers?.["x-forwarded-for"]
      || request.headers?.["x-real-ip"]
      || "anonymous";

    const now = Date.now();
    let bucket = buckets.get(clientKey);

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(clientKey, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    const retryAfter = bucket.count > maxRequests
      ? Math.ceil((bucket.resetAt - now) / 1000)
      : 0;

    if (bucket.count > maxRequests) {
      return {
        statusCode: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(retryAfter),
          "x-ratelimit-limit": String(maxRequests),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.ceil(bucket.resetAt / 1000))
        },
        body: JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter
          }
        })
      };
    }

    const payload = await app(request);

    payload.headers = {
      ...payload.headers,
      "x-ratelimit-limit": String(maxRequests),
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(Math.ceil(bucket.resetAt / 1000))
    };

    return payload;
  };
}

/**
 * API key authentication middleware.
 * Checks for an API key in the X-API-Key header.
 * Whitelisted paths bypass authentication.
 */
export function withApiKeyAuth(app, {
  apiKeys = [],
  whitelistedPaths = ["/health", "/ready"]
} = {}) {
  const keySet = new Set(apiKeys);

  if (keySet.size === 0) return app;

  return async function authenticatedApp(request) {
    const url = new URL(request.url, "http://localhost");

    if (whitelistedPaths.includes(url.pathname)) {
      return app(request);
    }

    // Allow unauthenticated read access to docs/openapi
    if (url.pathname.startsWith("/openapi") || url.pathname === "/") {
      return app(request);
    }

    const apiKey = request.headers?.["x-api-key"];
    if (!apiKey || !keySet.has(apiKey)) {
      return {
        statusCode: 401,
        headers: {
          "content-type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          error: {
            code: "unauthorized",
            message: "A valid X-API-Key header is required."
          }
        })
      };
    }

    return app(request);
  };
}


/**
 * Adds CORS headers to responses.
 * Supports configurable allowed origins, methods, and headers.
 */
export function withCors(app, {
  allowOrigin = "*",
  allowMethods = "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  allowHeaders = "Content-Type, X-API-Key, X-Request-Id",
  maxAge = "86400"
} = {}) {
  return async function corsApp(request) {
    // Handle preflight
    if (request.method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "access-control-allow-origin": allowOrigin,
          "access-control-allow-methods": allowMethods,
          "access-control-allow-headers": allowHeaders,
          "access-control-max-age": maxAge
        },
        body: ""
      };
    }

    const payload = await app(request);
    payload.headers = {
      ...payload.headers,
      "access-control-allow-origin": allowOrigin,
      "access-control-expose-headers": "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag"
    };
    return payload;
  };
}

/**
 * Adds standard security headers to all responses.
 */
export function withSecurityHeaders(app, { csp = "default-src 'none'" } = {}) {
  return async function secureApp(request) {
    const payload = await app(request);
    payload.headers = {
      ...payload.headers,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": csp,
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()"
    };
    return payload;
  };
}


/**
 * Limits request body size to prevent denial-of-service.
 * Rejects requests with Content-Length exceeding the configured maximum.
 */
export function withBodySizeLimit(app, { maxBytes = 1024 * 1024 } = {}) {
  return async function bodyLimitedApp(request) {
    const contentLength = request.headers?.["content-length"];
    if (contentLength && Number(contentLength) > maxBytes) {
      return {
        statusCode: 413,
        headers: {
          "content-type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          error: {
            code: "payload_too_large",
            message: `Request body must not exceed ${maxBytes} bytes.`
          }
        })
      };
    }
    return app(request);
  };
}

/**
 * Validates Content-Type header for write operations (POST, PUT, PATCH).
 */
export function withContentTypeValidation(app, {
  allowedTypes = ["application/json"]
} = {}) {
  return async function ctValidApp(request) {
    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      const ct = request.headers?.["content-type"] || "";
      const baseType = ct.split(";")[0].trim().toLowerCase();
      if (baseType && !allowedTypes.includes(baseType)) {
        return {
          statusCode: 415,
          headers: {
            "content-type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({
            error: {
              code: "unsupported_media_type",
              message: `Content-Type must be one of: ${allowedTypes.join(", ")}.`
            }
          })
        };
      }
    }
    return app(request);
  };
}
