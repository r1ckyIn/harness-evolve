// Hooks redundancy scanner for deep scan module.
// Detects duplicate hook registrations, hooks without commands,
// and same command registered across multiple scopes in settings.json.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Scan for redundant or misconfigured hook registrations.
 * Checks for exact duplicate hooks, hooks without commands,
 * and same command registered at multiple scopes.
 */
export function scanHooksRedundancy(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  const hooks = context.hooks_registered;

  // Check 1: Exact duplicate hooks (same event + same scope + same command)
  const dupeMap = new Map<string, number>();
  for (const hook of hooks) {
    const key = `${hook.event}|${hook.scope}|${hook.command ?? ''}`;
    dupeMap.set(key, (dupeMap.get(key) ?? 0) + 1);
  }

  for (const [key, count] of dupeMap) {
    if (count < 2) continue;
    const [event, scope, command] = key.split('|');
    recommendations.push({
      id: `rec-scan-hooks-redundancy-${index++}`,
      target: 'SETTINGS',
      confidence: 'HIGH',
      pattern_type: 'scan_hooks_redundancy',
      severity: 'problem',
      title: `Duplicate hook registration for ${event} in ${scope} scope`,
      description:
        `The hook for ${event} in ${scope} settings.json is registered ${count} times ` +
        `with the same command '${command}'. Only one registration is needed.`,
      evidence: {
        count,
        examples: [`${scope} settings.json: ${event} -> ${command}`],
      },
      suggested_action:
        `Remove duplicate hook registration for ${event} in ${scope} settings.json. ` +
        `Both entries run '${command}'. ` +
        `Expected effect: eliminates double-execution of the same hook script.`,
    });
  }

  // Check 2: Hooks without commands (type 'command' but command missing/empty)
  for (const hook of hooks) {
    if (hook.type === 'command' && (!hook.command || hook.command.trim() === '')) {
      recommendations.push({
        id: `rec-scan-hooks-redundancy-${index++}`,
        target: 'SETTINGS',
        confidence: 'HIGH',
        pattern_type: 'scan_hooks_redundancy',
        severity: 'problem',
        title: `Hook without command for ${hook.event} in ${hook.scope} scope`,
        description:
          `The ${hook.event} hook in ${hook.scope} settings.json has type 'command' ` +
          `but no command is specified. This hook will fail silently when triggered.`,
        evidence: {
          count: 1,
          examples: [`${hook.scope} settings.json: ${hook.event} (no command)`],
        },
        suggested_action:
          `Add a command to the ${hook.event} hook in ${hook.scope} settings.json, ` +
          `or remove the empty hook entry. ` +
          `Expected effect: hook will actually execute instead of failing silently.`,
      });
    }
  }

  // Check 3: Same command across scopes (same event + same command, different scope)
  // Build a Map keyed by event|command, collecting all scopes
  const crossScopeMap = new Map<string, Set<string>>();
  for (const hook of hooks) {
    if (!hook.command || hook.command.trim() === '') continue;
    const key = `${hook.event}|${hook.command}`;
    const scopes = crossScopeMap.get(key) ?? new Set<string>();
    scopes.add(hook.scope);
    crossScopeMap.set(key, scopes);
  }

  for (const [key, scopes] of crossScopeMap) {
    if (scopes.size < 2) continue;
    const [event, command] = key.split('|');
    const scopeList = [...scopes];
    recommendations.push({
      id: `rec-scan-hooks-redundancy-${index++}`,
      target: 'SETTINGS',
      confidence: 'MEDIUM',
      pattern_type: 'scan_hooks_redundancy',
      severity: 'suggestion',
      title: `Cross-scope hook duplication for ${event}`,
      description:
        `Hook command '${command}' for ${event} is registered in both ` +
        `${scopeList[0]} and ${scopeList[1]} scope. ` +
        `This causes double-execution.`,
      evidence: {
        count: scopes.size,
        examples: scopeList.map(s => `${s} settings.json: ${event} -> ${command}`),
      },
      suggested_action:
        `Hook command '${command}' for ${event} is registered in both ` +
        `${scopeList[0]} and ${scopeList[1]} scope. ` +
        `This causes double-execution. Keep it in one scope only. ` +
        `Expected effect: hook runs once instead of twice per trigger.`,
    });
  }

  return recommendations;
}
