# Database Migration Path

Release Guardian ships with a JSON file repository for zero-dependency operation. For production workloads, migrate to a persistent database using the path below.

## Current: JSON File Repository

The default `Repository` class reads and writes `data/release-guardian.json` with atomic file operations (write-to-temp + rename). This is suitable for:

- Development and testing
- Single-instance deployments with low write volume
- Environments where operational simplicity matters more than throughput

**Limitations:**

- No concurrent write safety beyond filesystem atomicity
- Full database load on every request
- No indexing or query optimization
- Single-node only

## Migration Target: PostgreSQL

### Schema Design

```sql
CREATE TABLE releases (
  id UUID PRIMARY KEY,
  application TEXT NOT NULL,
  version TEXT NOT NULL,
  environment TEXT NOT NULL,
  service_tier TEXT NOT NULL,
  change_category TEXT NOT NULL,
  planned_start_at TIMESTAMPTZ NOT NULL,
  planned_end_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]',
  controls JSONB NOT NULL,
  conflicts JSONB NOT NULL DEFAULT '[]',
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  risk JSONB NOT NULL,
  approvals JSONB NOT NULL DEFAULT '[]',
  deployment JSONB,
  timeline JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_releases_application ON releases(application);
CREATE INDEX idx_releases_environment ON releases(environment);
CREATE INDEX idx_releases_status ON releases(status);
CREATE INDEX idx_releases_owner ON releases(owner);
CREATE INDEX idx_releases_created_at ON releases(created_at);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["*"]',
  secret TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  deliveries JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
```

### Repository Adapter

To implement a PostgreSQL adapter, create `src/repository-postgres.js`:

```javascript
export class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async load() {
    const releases = await this.pool.query('SELECT * FROM releases ORDER BY created_at');
    const teams = await this.pool.query('SELECT * FROM teams ORDER BY name');
    return {
      releases: releases.rows.map(row => ({
        id: row.id,
        application: row.application,
        // ... map all columns back to the JSON structure
      })),
      teams: teams.rows
    };
  }

  async save(data) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Upsert releases, update teams, etc.
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
```

### Migration Steps

1. **Install PostgreSQL driver:**
   ```bash
   npm install pg
   ```

2. **Create the schema** using the SQL above.

3. **Seed initial data** from JSON:
   ```bash
   node scripts/seed-to-postgres.js
   ```

4. **Configure the runtime:**
   ```bash
   DATABASE_URL=postgresql://user:pass@localhost:5432/release_guardian
   ```

5. **Update `src/bootstrap.js`** to select the repository based on `DATABASE_URL`:
   ```javascript
   const repository = process.env.DATABASE_URL
     ? new PostgresRepository(new Pool({ connectionString: process.env.DATABASE_URL }))
     : new Repository();
   ```

6. **Run tests** to verify the adapter works correctly.

## Migration Target: SQLite

For deployments that want database features without running a separate server:

```sql
-- Same schema as PostgreSQL, but use TEXT for UUIDs and ISO timestamps
CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  application TEXT NOT NULL,
  -- ... same columns with TEXT types
);
```

Use `better-sqlite3` for synchronous, high-performance local storage.

## Zero-Downtime Migration

For production systems already running on JSON:

1. Deploy the dual-write version (writes to both JSON and database)
2. Backfill the database from the JSON file
3. Verify data consistency
4. Switch reads to the database
5. Remove the JSON repository

## Testing

Each repository adapter must pass the same test suite. Use dependency injection:

```javascript
// tests/repository-contract.test.js
export function testRepositoryContract(createRepo) {
  describe("Repository contract", () => {
    it("saves and loads releases", async () => {
      const repo = createRepo();
      const db = await repo.load();
      db.releases.push({ id: "test-1", application: "test" });
      await repo.save(db);
      const loaded = await repo.load();
      assert.ok(loaded.releases.some(r => r.id === "test-1"));
    });
  });
}
```

Run with each adapter:

```bash
node --test tests/repository-contract.test.js  # JSON
DATABASE_URL=... node --test tests/repository-pg.test.js  # PostgreSQL
```
