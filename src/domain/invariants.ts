import path from "node:path";

import { DIRECTIONS, type Direction, type Identity } from "./model.js";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const WINDOWS_ABSOLUTE_PATTERN = /^[A-Za-z]:[\\/]/;

export function assertId(value: string, label = "id"): void {
  if (!ID_PATTERN.test(value) || value.length > 160) {
    throw new Error(`${label} must start alphanumerically and use only letters, numbers, dot, underscore, or hyphen`);
  }
}

export function assertDirection(value: unknown): asserts value is Direction {
  if (typeof value !== "string" || !DIRECTIONS.includes(value as Direction)) {
    throw new Error("direction must be facing-left or facing-right");
  }
}

export function assertIdentity(identity: Identity): void {
  assertId(identity.characterId, "characterId");
  if (!identity.displayName.trim()) throw new Error("displayName is required");
  if (!(["non-canon", "production-unspecified"] as const).includes(identity.canonStatus)) {
    throw new Error("canonStatus is invalid");
  }
  if (identity.characterId.startsWith("TEST_") && identity.canonStatus !== "non-canon") {
    throw new Error("TEST_ identities must be explicitly non-canon");
  }
}

export function assertPortableRelativePath(value: string): void {
  if (!value || path.posix.isAbsolute(value) || WINDOWS_ABSOLUTE_PATTERN.test(value)) {
    throw new Error("path must be portable and relative");
  }
  if (value.includes("\\") || value.includes("\0")) {
    throw new Error("path must use portable POSIX separators");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "..") || value.startsWith("./") || value.includes("//")) {
    throw new Error("path traversal and non-canonical relative paths are forbidden");
  }
  if (path.posix.normalize(value) !== value) throw new Error("path is not canonical");
}
