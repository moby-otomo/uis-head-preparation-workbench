import { createHash } from "node:crypto";

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function reproducibilityKey(input: {
  sourceEncodedSha256: string;
  workflow: { id: string; version: string; deterministic: boolean; parameters: Record<string, unknown> };
  compatibilityProfileId?: string;
}): string {
  return sha256(canonicalJson(input));
}
