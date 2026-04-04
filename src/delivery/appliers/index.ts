// Applier interface, options, and registry for auto-apply dispatch.
// The registry maps routing targets (e.g. 'SETTINGS', 'RULE') to their
// corresponding Applier implementations. Adding a new applier requires
// only implementing the Applier interface and calling registerApplier().

import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';

export interface ApplierOptions {
  /** Override settings.json path (used in testing) */
  settingsPath?: string;
  /** Override rules directory (used in testing) */
  rulesDir?: string;
  /** Override hooks directory (used in testing) */
  hooksDir?: string;
  /** Override CLAUDE.md path (used in testing) */
  claudeMdPath?: string;
}

export interface Applier {
  readonly target: string;
  canApply(rec: Recommendation): boolean;
  apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult>;
}

const registry = new Map<string, Applier>();

export function registerApplier(applier: Applier): void {
  registry.set(applier.target, applier);
}

export function getApplier(target: string): Applier | undefined {
  return registry.get(target);
}

export function hasApplier(target: string): boolean {
  return registry.has(target);
}
