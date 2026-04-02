// String and object scrubbing functions.
// Applies regex-based secret detection patterns to replace
// sensitive values with [REDACTED:type] markers (D-01, D-02).

import { SCRUB_PATTERNS, type ScrubPattern } from './patterns.js';

/**
 * Scrub secrets from a string using built-in patterns
 * plus optional extra patterns (e.g., user-defined custom patterns).
 */
export function scrubString(input: string, extraPatterns?: ScrubPattern[]): string {
  let result = input;
  const patterns = extraPatterns
    ? [...SCRUB_PATTERNS, ...extraPatterns]
    : SCRUB_PATTERNS;
  for (const pattern of patterns) {
    // Reset regex lastIndex for global patterns to ensure
    // correct matching when regex objects are reused across calls
    pattern.regex.lastIndex = 0;
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

/**
 * Recursively scrub all string values in an object/array structure.
 * Non-string primitives (numbers, booleans, null, undefined) pass through unchanged.
 */
export function scrubObject<T>(obj: T, extraPatterns?: ScrubPattern[]): T {
  if (typeof obj === 'string') {
    return scrubString(obj, extraPatterns) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, extraPatterns)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = scrubObject(value, extraPatterns);
    }
    return result as T;
  }
  return obj; // numbers, booleans, null, undefined pass through
}
