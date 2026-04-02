// Classifier registry: defines the Classifier type and holds all registered
// classifier functions. New classifiers are added by importing and pushing
// to the classifiers array.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';
import { classifyRepeatedPrompts } from './repeated-prompts.js';
import { classifyLongPrompts } from './long-prompts.js';
import { classifyPermissionPatterns } from './permission-patterns.js';
import { classifyCodeCorrections } from './code-corrections.js';
import { classifyPersonalInfo } from './personal-info.js';
import { classifyConfigDrift } from './config-drift.js';
import { classifyEcosystemAdaptations } from './ecosystem-adapter.js';
import { classifyOnboarding } from './onboarding.js';

export type Classifier = (
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
) => Recommendation[];

// Registered classifiers, evaluated in order by the analyzer
export const classifiers: Classifier[] = [
  classifyRepeatedPrompts,
  classifyLongPrompts,
  classifyPermissionPatterns,
  classifyCodeCorrections,
  classifyPersonalInfo,
  classifyConfigDrift,
  classifyEcosystemAdaptations,
  classifyOnboarding,
];
