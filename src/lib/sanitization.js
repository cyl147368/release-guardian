/**
 * 输入清理工具 — 防止 XSS 和注入攻击
 */

/**
 * 清理字符串中的 HTML 特殊字符
 */
export function escapeHtml(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * 清理对象中所有字符串字段
 */
export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * 移除字符串中的控制字符
 */
export function stripControlChars(input) {
  if (typeof input !== "string") return input;
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * 限制字符串长度
 */
export function truncate(input, maxLength = 10000) {
  if (typeof input !== "string") return input;
  return input.length > maxLength ? input.slice(0, maxLength) : input;
}
