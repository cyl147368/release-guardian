import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAuditLog, AuditEvents } from "../src/lib/audit.js";

describe("审计日志", () => {
  it("记录审计事件并分配唯一ID和时间戳", () => {
    const log = createAuditLog();
    const entry = log.record(AuditEvents.RELEASE_CREATED, {
      actor: "alice",
      resourceType: "release",
      resourceId: "r-001",
      details: { application: "my-app", version: "1.0.0" },
    });

    assert.ok(entry.id);
    assert.ok(entry.timestamp);
    assert.equal(entry.event, AuditEvents.RELEASE_CREATED);
    assert.equal(entry.actor, "alice");
    assert.equal(entry.resourceType, "release");
    assert.equal(entry.resourceId, "r-001");
    assert.equal(entry.details.application, "my-app");
  });

  it("默认 actor 为 system", () => {
    const log = createAuditLog();
    const entry = log.record(AuditEvents.WEBHOOK_SUBSCRIBED);
    assert.equal(entry.actor, "system");
  });

  it("根据事件类型推断 resourceType", () => {
    const log = createAuditLog();
    assert.equal(log.record("release.created").resourceType, "release");
    assert.equal(log.record("webhook.subscribed").resourceType, "webhook");
    assert.equal(log.record("custom.event").resourceType, "unknown");
  });

  it("查询支持按事件类型过滤", () => {
    const log = createAuditLog();
    log.record(AuditEvents.RELEASE_CREATED, { actor: "alice" });
    log.record(AuditEvents.RELEASE_APPROVED, { actor: "bob" });
    log.record(AuditEvents.RELEASE_CREATED, { actor: "charlie" });

    const result = log.query({ event: AuditEvents.RELEASE_CREATED });
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
  });

  it("查询支持按 actor 过滤", () => {
    const log = createAuditLog();
    log.record(AuditEvents.RELEASE_CREATED, { actor: "alice" });
    log.record(AuditEvents.RELEASE_APPROVED, { actor: "bob" });

    const result = log.query({ actor: "alice" });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].actor, "alice");
  });

  it("查询支持按 resourceType 过滤", () => {
    const log = createAuditLog();
    log.record("release.created");
    log.record("webhook.subscribed");

    const result = log.query({ resourceType: "release" });
    assert.equal(result.total, 1);
  });

  it("查询支持按 resourceId 过滤", () => {
    const log = createAuditLog();
    log.record(AuditEvents.RELEASE_CREATED, { resourceId: "r-001" });
    log.record(AuditEvents.RELEASE_CREATED, { resourceId: "r-002" });

    const result = log.query({ resourceId: "r-001" });
    assert.equal(result.total, 1);
  });

  it("查询支持分页", () => {
    const log = createAuditLog();
    for (let i = 0; i < 10; i++) {
      log.record(AuditEvents.RELEASE_CREATED);
    }

    const page1 = log.query({ limit: 3, offset: 0 });
    assert.equal(page1.items.length, 3);
    assert.equal(page1.total, 10);

    const page2 = log.query({ limit: 3, offset: 3 });
    assert.equal(page2.items.length, 3);
  });

  it("查询结果按时间倒序排列", () => {
    const log = createAuditLog();
    const e1 = log.record(AuditEvents.RELEASE_CREATED);
    const e2 = log.record(AuditEvents.RELEASE_APPROVED);

    const result = log.query({});
    assert.equal(result.items[0].id, e2.id);
    assert.equal(result.items[1].id, e1.id);
  });

  it("getStats 返回正确的统计信息", () => {
    const log = createAuditLog();
    log.record(AuditEvents.RELEASE_CREATED);
    log.record(AuditEvents.RELEASE_CREATED);
    log.record(AuditEvents.RELEASE_APPROVED);

    const stats = log.getStats();
    assert.equal(stats.totalEntries, 3);
    assert.equal(stats.byEvent[AuditEvents.RELEASE_CREATED], 2);
    assert.equal(stats.byEvent[AuditEvents.RELEASE_APPROVED], 1);
    assert.ok(stats.oldestEntry);
    assert.ok(stats.newestEntry);
  });

  it("getStats 空日志返回正确值", () => {
    const log = createAuditLog();
    const stats = log.getStats();
    assert.equal(stats.totalEntries, 0);
    assert.equal(stats.oldestEntry, null);
    assert.equal(stats.newestEntry, null);
  });

  it("超过最大条目数时自动裁剪", () => {
    const log = createAuditLog({ maxEntries: 5 });
    for (let i = 0; i < 10; i++) {
      log.record(AuditEvents.RELEASE_CREATED, { details: { index: i } });
    }

    assert.equal(log._entries.length, 5);
    // 最早的条目应该被移除
    assert.equal(log._entries[0].details.index, 5);
  });

  it("查询支持 since 时间过滤", () => {
    const log = createAuditLog();
    log.record(AuditEvents.RELEASE_CREATED);
    
    const futureDate = new Date(Date.now() + 100000).toISOString();
    log.record(AuditEvents.RELEASE_APPROVED);

    const result = log.query({ since: futureDate });
    assert.equal(result.total, 0);
  });
});
