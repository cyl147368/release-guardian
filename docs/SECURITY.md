# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.7.x | Yes |
| < 1.7 | No |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email the maintainer or use GitHub's private vulnerability reporting.
3. Include a description, reproduction steps, and the potential impact.
4. Allow 72 hours for an initial response.

## Security Architecture

### Authentication

- API key authentication via `X-API-Key` header
- Configured via `API_KEYS` environment variable (comma-separated)
- Health and readiness endpoints are exempt from authentication
- When `API_KEYS` is empty, authentication is disabled (development mode)

### Rate Limiting

- Per-client IP sliding window rate limiter
- Configurable via `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- Returns standard `Retry-After` and `X-RateLimit-*` headers

### Request Security

- JSON body parsing with strict error handling (no prototype pollution vectors)
- Input validation on all mutable endpoints (type checks, enum bounds, string trimming)
- Numeric bounds enforcement on risk scores and pagination parameters
- Request correlation IDs for audit traceability

### Data Security

- JSON file persistence with atomic writes (write-to-temp + rename)
- No credentials stored in the repository
- No secrets in log output (structured logging omits sensitive fields)
- Configurable log levels to control information disclosure

### Container Security

- Multi-stage Docker build (no dev dependencies in production image)
- Non-root user (UID 1001) in production container
- Read-only filesystem compatible (data volume is the only write path)
- OCI image labels for supply chain transparency

### Network Security

- All responses include `X-Request-Id` for request tracing
- Rate limit headers inform clients of their quota
- HTTP health check endpoints for load balancer integration
- No server version disclosure in response headers

## Hardening Checklist

Before deploying to production:

- [ ] Set `API_KEYS` to at least one strong key
- [ ] Enable rate limiting (`RATE_LIMIT_ENABLED=true`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `LOG_LEVEL=warn` or higher
- [ ] Use TLS termination at the load balancer or ingress
- [ ] Restrict network access to the API port
- [ ] Enable persistent volume for data directory
- [ ] Configure backup for the data directory
- [ ] Monitor the `/ready` endpoint for datastore health
- [ ] Set up alerting on 5xx error rates

## Dependency Security

Release Guardian has zero third-party runtime dependencies. All functionality is built with Node.js built-in modules:

- `node:http` for the HTTP server
- `node:crypto` for UUID generation, hashing, and ETags
- `node:url` for URL parsing
- `node:fs` for file persistence
- `node:test` for testing (dev only)

This eliminates supply-chain attack vectors from npm dependency chains.
