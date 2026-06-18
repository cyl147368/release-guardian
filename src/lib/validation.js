import { HttpError } from "./http.js";

export function assertString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "validation_error", `${field} must be a non-empty string.`);
  }
}

export function assertEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new HttpError(
      400,
      "validation_error",
      `${field} must be one of: ${allowed.join(", ")}.`
    );
  }
}

export function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new HttpError(400, "validation_error", `${field} must be a positive integer or zero.`);
  }
}

export function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "validation_error", `${field} must be an array.`);
  }
}

export function assertIsoTimestamp(value, field) {
  assertString(value, field);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new HttpError(400, "validation_error", `${field} must be a valid ISO-8601 timestamp.`);
  }
}
