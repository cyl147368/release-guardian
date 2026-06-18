import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { WebhookManager } from "../src/lib/webhooks.js";
import { ReleaseService } from "../src/services/releaseService.js";

function fixedClock() {
  return "2026-06-18T12:00:00.000Z";
}

class InMemoryRepository {
  constructor(data = { releases: [], teams: [{ name: "release_management" }, { name: "sre" }, { name: "security" }] }) {
    this.data = JSON.parse(JSON.stringify(data));
  }
  async load() { return JSON.parse(JSON.stringify(this.data)); }
  async save(data) { this.data = JSON.parse(JSON.stringify(data)); }
}

describe("WebhookManager", () => {
  let manager;

  beforeEach(() => {
    manager = new WebhookManager({ clock: fixedClock });
  });

  it("creates a subscription with a generated id", () => {
    const sub = manager.subscribe({ url: "https://example.com/hook" });
    assert.ok(sub.id);
    assert.equal(sub.url, "https://example.com/hook");
    assert.deepEqual(sub.events, ["*"]);
    assert.equal(sub.active, true);
  });

  it("creates a subscription with specific events", () => {
    const sub = manager.subscribe({
      url: "https://example.com/hook",
      events: ["release.created", "release.deployed"]
    });
    assert.deepEqual(sub.events, ["release.created", "release.deployed"]);
  });

  it("lists all subscriptions", () => {
    manager.subscribe({ url: "https://a.com/hook" });
    manager.subscribe({ url: "https://b.com/hook" });
    assert.equal(manager.listSubscriptions().length, 2);
  });

  it("removes a subscription", () => {
    const sub = manager.subscribe({ url: "https://a.com/hook" });
    assert.equal(manager.unsubscribe(sub.id), true);
    assert.equal(manager.listSubscriptions().length, 0);
  });

  it("returns false when removing a nonexistent subscription", () => {
    assert.equal(manager.unsubscribe("nonexistent"), false);
  });

  it("dispatches events to matching subscribers", async () => {
    const dispatched = [];
    manager = new WebhookManager({
      clock: fixedClock,
      async dispatch(url, event, secret) {
        dispatched.push({ url, event, secret });
      }
    });

    manager.subscribe({ url: "https://a.com/hook", events: ["release.created"] });
    manager.subscribe({ url: "https://b.com/hook", events: ["release.deployed"] });
    manager.subscribe({ url: "https://c.com/hook", events: ["*"] });

    await manager.dispatchEvent("release.created", { id: "123" });

    // a.com matches release.created, c.com matches wildcard
    assert.equal(dispatched.length, 2);
    assert.equal(dispatched[0].url, "https://a.com/hook");
    assert.equal(dispatched[1].url, "https://c.com/hook");
  });

  it("records event deliveries in the log", async () => {
    manager.subscribe({ url: "https://a.com/hook", events: ["*"] });
    await manager.dispatchEvent("test.event", { data: 1 });

    const log = manager.getEventLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].type, "test.event");
    assert.equal(log[0].deliveries[0].status, "delivered");
  });

  it("records failed deliveries", async () => {
    manager = new WebhookManager({
      clock: fixedClock,
      async dispatch() {
        throw new Error("Connection refused");
      }
    });
    manager.subscribe({ url: "https://fail.com/hook", events: ["*"] });
    await manager.dispatchEvent("test.event", {});

    const log = manager.getEventLog();
    assert.equal(log[0].deliveries[0].status, "failed");
    assert.equal(log[0].deliveries[0].error, "Connection refused");
  });

  it("supports pagination in event log", async () => {
    manager.subscribe({ url: "https://a.com/hook", events: ["*"] });
    for (let i = 0; i < 5; i++) {
      await manager.dispatchEvent("test.event", { i });
    }

    const page = manager.getEventLog({ limit: 2, offset: 0 });
    assert.equal(page.length, 2);
    // Log is reversed (newest first)
    assert.equal(page[0].payload.i, 4);
  });
});

describe("ReleaseService webhook integration", () => {
  it("subscribeWebhook validates url", () => {
    const service = new ReleaseService(new InMemoryRepository(), fixedClock);
    assert.throws(
      () => service.subscribeWebhook({}),
      { code: "validation_error" }
    );
  });

  it("subscribeWebhook creates a subscription", () => {
    const service = new ReleaseService(new InMemoryRepository(), fixedClock);
    const sub = service.subscribeWebhook({ url: "https://example.com/hook", events: ["release.created"] });
    assert.ok(sub.id);
    assert.equal(sub.url, "https://example.com/hook");
  });

  it("unsubscribeWebhook throws for unknown id", () => {
    const service = new ReleaseService(new InMemoryRepository(), fixedClock);
    assert.throws(
      () => service.unsubscribeWebhook("nonexistent"),
      { code: "not_found" }
    );
  });

  it("listWebhookSubscriptions returns all subscriptions", () => {
    const service = new ReleaseService(new InMemoryRepository(), fixedClock);
    service.subscribeWebhook({ url: "https://a.com/hook" });
    service.subscribeWebhook({ url: "https://b.com/hook" });
    assert.equal(service.listWebhookSubscriptions().length, 2);
  });

  it("getWebhookEventLog respects limit and offset", async () => {
    const service = new ReleaseService(new InMemoryRepository(), fixedClock);
    await service.emitWebhookEvent("test", { a: 1 });
    await service.emitWebhookEvent("test", { b: 2 });
    const log = service.getWebhookEventLog({ limit: 1 });
    assert.equal(log.length, 1);
  });
});
