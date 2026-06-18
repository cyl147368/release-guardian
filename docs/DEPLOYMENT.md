# Deployment Guide

## Overview

Release Guardian is currently packaged as a lightweight Node.js service. The reference deployment path is:

1. Build the container image.
2. Provide a persistent writable volume for the JSON data store.
3. Expose the service behind an internal ingress or API gateway.
4. Add authentication, centralized logging, and metrics before production rollout.

## Runtime Requirements

- Node.js 20 or later
- npm 10 or later
- A writable filesystem path for `data/seed.json`
- Internal network access for client systems that create or approve releases

## Local Deployment

```bash
npm install
npm start
```

Default listener:

- `HOST=127.0.0.1`
- `PORT=3000`

Optional unix socket mode:

```bash
SOCKET_PATH=/tmp/release-guardian.sock npm start
```

## Docker Deployment

Build the image:

```bash
docker build -t release-guardian:1.4.0 .
```

Run the service:

```bash
docker run \
  --name release-guardian \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  release-guardian:1.4.0
```

## Environment Variables

- `PORT`: TCP port when running in network mode
- `HOST`: bind address when running in network mode
- `SOCKET_PATH`: optional unix socket path

## Production Topology Recommendations

- Run behind an internal API gateway
- Terminate TLS at the gateway or service mesh
- Store audit and release records in PostgreSQL instead of JSON files
- Add out-of-band backups for release history
- Push logs into a centralized observability platform

## Suggested CI/CD Flow

1. Run `npm run lint`
2. Run `npm test`
3. Run `npm run test:coverage`
4. Build a container image
5. Scan the image
6. Promote to staging
7. Run contract and integration checks
8. Promote to production after approval

## Rollback Strategy

This reference implementation keeps rollback simple:

- Revert the application version
- Restore the data file from backup if corrupted
- Recreate the container from the previous image tag

For production use, add:

- Immutable artifact versioning
- Schema migration version control
- Automated backup verification
- Incident rollback drills
