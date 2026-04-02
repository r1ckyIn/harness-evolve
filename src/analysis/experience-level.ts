// Pure function to compute user experience level from environment snapshot.
// Scores each tool category by weight and maps total score to a tier:
// 0 -> newcomer, 1-29 -> intermediate, 30+ -> power_user.
// Weights reflect automation investment: plugins (10), hooks (8), ecosystems (7),
// rules (6), skills (5), claude_md (3).

import type { EnvironmentSnapshot } from './schemas.js';
import type { ExperienceLevel, ExperienceTier } from '../schemas/onboarding.js';

export function computeExperienceLevel(snapshot: EnvironmentSnapshot): ExperienceLevel {
  const hooks = snapshot.installed_tools.hooks.length;
  const rules = snapshot.installed_tools.rules.length;
  const skills = snapshot.installed_tools.skills.length;
  const plugins = snapshot.installed_tools.plugins.length;
  const claudeMd = snapshot.installed_tools.claude_md.filter(c => c.exists).length;
  const ecosystems = snapshot.detected_ecosystems.length;

  const score = Math.min(100,
    hooks * 8 + rules * 6 + skills * 5 +
    plugins * 10 + claudeMd * 3 + ecosystems * 7,
  );

  const tier: ExperienceTier =
    score === 0 ? 'newcomer' :
    score < 30 ? 'intermediate' :
    'power_user';

  return {
    tier,
    score,
    breakdown: { hooks, rules, skills, plugins, claude_md: claudeMd, ecosystems },
  };
}
