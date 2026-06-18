# Operations Runbook

## Service Purpose

Release Guardian tracks release requests, approvals, deployment outcomes, and governance metrics.

## Core Operational Checks

### Health

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```text
ok
```

### Basic Dashboard

```bash
curl http://127.0.0.1:3000/api/dashboard
```

## Daily Operator Checklist

1. Confirm the service answers `/health`
2. Review pending approvals
3. Review rejected releases and exception patterns
4. Review rollback counts and change failure rate
5. Verify the data file is backed up

## Incident Response Pointers

### Symptom: service does not start

Checks:

- Verify Node.js version
- Verify the data directory is writable
- Verify the configured socket or port is available

### Symptom: requests return `validation_error`

Checks:

- Confirm the request body is JSON
- Confirm timestamps are valid ISO-8601 values
- Confirm release lifecycle transitions are legal

### Symptom: release data appears stale

Checks:

- Verify the service process is writing to the expected data path
- Confirm the file volume is mounted correctly
- Inspect the data file modification time

## Backup and Restore

### Backup

Copy the `data/seed.json` file to a protected backup location on a regular schedule.

### Restore

1. Stop the service
2. Restore `data/seed.json` from a verified backup
3. Start the service
4. Confirm `/api/dashboard` returns expected counts

## Recommended Monitoring Signals

- Service availability
- Request error rate
- Release creation volume
- Pending approval age
- Rollback count
- Change failure rate
- Average lead time

## Operational Caveats

This repository is a strong foundation, but full enterprise production use still benefits from:

- Database-backed storage
- Authentication and RBAC
- Structured audit export
- Notification integrations
- Metrics and tracing
