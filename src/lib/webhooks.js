import { randomUUID } from "node:crypto";
import { nowIso } from "./time.js";

/**
 * Manages webhook subscriptions and dispatches events.
 * In-memory store; suitable for single-instance or as a reference
 * implementation for a persistent adapter.
 */
export class WebhookManager {
  constructor({ clock = nowIso, dispatch = defaultDispatch } = {}) {
    this.subscriptions = new Map();
    this.eventLog = [];
    this.clock = clock;
    this.dispatch = dispatch;
  }

  subscribe({ url, events, secret }) {
    const id = randomUUID();
    const subscription = {
      id,
      url,
      events: events || ["*"],
      secret: secret || null,
      active: true,
      createdAt: this.clock()
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  unsubscribe(id) {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    this.subscriptions.delete(id);
    return true;
  }

  listSubscriptions() {
    return Array.from(this.subscriptions.values());
  }

  async dispatchEvent(eventType, payload) {
    const timestamp = this.clock();
    const eventId = randomUUID();
    const event = {
      eventId,
      type: eventType,
      timestamp,
      payload
    };

    const matchingSubs = Array.from(this.subscriptions.values())
      .filter((sub) => sub.active && (sub.events.includes("*") || sub.events.includes(eventType)));

    const deliveries = [];

    for (const sub of matchingSubs) {
      const delivery = {
        deliveryId: randomUUID(),
        eventId,
        subscriptionId: sub.id,
        url: sub.url,
        status: "pending",
        attemptedAt: timestamp
      };

      try {
        await this.dispatch(sub.url, event, sub.secret);
        delivery.status = "delivered";
      } catch (error) {
        delivery.status = "failed";
        delivery.error = error.message;
      }

      deliveries.push(delivery);
    }

    this.eventLog.push({ ...event, deliveries });
    return { event, deliveries };
  }

  getEventLog({ limit = 50, offset = 0 } = {}) {
    return this.eventLog
      .slice()
      .reverse()
      .slice(offset, offset + limit);
  }
}

async function defaultDispatch(url, event, secret) {
  // In production, this would make an HTTP POST to the webhook URL
  // with HMAC signature if a secret is configured.
  // For now, this is a no-op stub that can be overridden.
  return { status: "stub", url, eventId: event.eventId };
}
