/**
 * 审计日志模块
 * 
 * 记录所有发布状态变更、审批操作和关键业务事件。
 * 每条审计记录包含时间戳、操作者、操作类型和变更详情。
 */

import { randomUUID } from "node:crypto";

/** 审计事件类型 */
export const AuditEvents = Object.freeze({
  RELEASE_CREATED:     "release.created",
  RELEASE_UPDATED:     "release.updated",
  RELEASE_APPROVED:    "release.approved",
  RELEASE_REJECTED:    "release.rejected",
  RELEASE_DEPLOYED:    "release.deployed",
  RELEASE_ROLLED_BACK: "release.rolled_back",
  WEBHOOK_SUBSCRIBED:  "webhook.subscribed",
  WEBHOOK_REMOVED:     "webhook.removed",
  BULK_CREATED:        "releases.bulk_created",
});

/**
 * 创建审计日志实例
 * @param {object} options
 * @param {Array} [options.entries] 初始条目（用于测试注入）
 * @param {number} [options.maxEntries=10000] 最大保留条目数
 */
export function createAuditLog({ entries = [], maxEntries = 10000 } = {}) {
  const log = [...entries];

  function record(event, { actor = "system", resourceType, resourceId, details = {} } = {}) {
    const entry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      actor,
      resourceType: resourceType || inferResourceType(event),
      resourceId: resourceId || null,
      details,
    };

    log.push(entry);

    // 防止内存无限增长
    if (log.length > maxEntries) {
      log.splice(0, log.length - maxEntries);
    }

    return entry;
  }

  function query({ event, actor, resourceType, resourceId, since, limit = 50, offset = 0 } = {}) {
    let results = [...log];

    if (event) results = results.filter(e => e.event === event);
    if (actor) results = results.filter(e => e.actor === actor);
    if (resourceType) results = results.filter(e => e.resourceType === resourceType);
    if (resourceId) results = results.filter(e => e.resourceId === resourceId);
    if (since) {
      const sinceDate = new Date(since).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= sinceDate);
    }

    // 倒序（最新在前）
    results.reverse();

    return {
      items: results.slice(offset, offset + limit),
      total: results.length,
      limit,
      offset,
    };
  }

  function getStats() {
    const byEvent = {};
    for (const entry of log) {
      byEvent[entry.event] = (byEvent[entry.event] || 0) + 1;
    }
    return {
      totalEntries: log.length,
      byEvent,
      oldestEntry: log.length > 0 ? log[0].timestamp : null,
      newestEntry: log.length > 0 ? log[log.length - 1].timestamp : null,
    };
  }

  return { record, query, getStats, _entries: log };
}

function inferResourceType(event) {
  if (event.startsWith("release.")) return "release";
  if (event.startsWith("webhook.")) return "webhook";
  return "unknown";
}
