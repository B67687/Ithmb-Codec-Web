// decode-pipeline.ts — DOM-free decode decision logic.
//
// WHY A SEPARATE MODULE: decoder.ts is DOM/WASM-coupled (viewer, i18n read
// document at module top), so node-scoped unit tests cannot import it —
// tsconfig.node.json would typecheck the whole DOM chain without globals.
// These pure functions carry the per-file branch logic; decodeFile applies them.
// Unit-tested in tests/unit/decode-pipeline.test.ts.
import { KNOWN_PREFIXES } from "./state.js";

export function classifyResult(prefix: number, result: Uint8Array): "success";
export function classifyResult(
  prefix: number,
  result: null | undefined,
): "known-failed" | "unknown";
export function classifyResult(
  prefix: number,
  result: Uint8Array | null | undefined,
): "success" | "known-failed" | "unknown" {
  if (result) return "success";
  return KNOWN_PREFIXES.has(prefix) ? "known-failed" : "unknown";
}

export function parsePixelHeader(result: Uint8Array): {
  width: number;
  height: number;
  pixels: Uint8Array;
} {
  const width = new DataView(result.buffer).getUint32(0, true);
  const height = new DataView(result.buffer).getUint32(4, true);
  return { width, height, pixels: result.slice(8) };
}
