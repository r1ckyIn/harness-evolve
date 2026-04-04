// Main library export -- populated as modules are built

export { configSchema } from './schemas/config.js';
export type { Config } from './schemas/config.js';

export {
  promptEntrySchema,
  toolEntrySchema,
  permissionEntrySchema,
  sessionEntrySchema,
} from './schemas/log-entry.js';
export type {
  PromptEntry,
  ToolEntry,
  PermissionEntry,
  SessionEntry,
} from './schemas/log-entry.js';

export { counterSchema } from './schemas/counter.js';
export type { Counter } from './schemas/counter.js';

export {
  hookCommonSchema,
  userPromptSubmitInputSchema,
  preToolUseInputSchema,
  postToolUseInputSchema,
  postToolUseFailureInputSchema,
  permissionRequestInputSchema,
  stopInputSchema,
} from './schemas/hook-input.js';
export type {
  HookCommon,
  UserPromptSubmitInput,
  PreToolUseInput,
  PostToolUseInput,
  PostToolUseFailureInput,
  PermissionRequestInput,
  StopInput,
} from './schemas/hook-input.js';

export { readStdin, readFromStream, summarizeToolInput } from './hooks/shared.js';
export { handleStop } from './hooks/stop.js';

export { paths, ensureInit } from './storage/dirs.js';
export { loadConfig } from './storage/config.js';

export { scrubString, scrubObject } from './scrubber/scrub.js';
export { SCRUB_PATTERNS, type ScrubPattern } from './scrubber/patterns.js';
export { appendLogEntry, type LogType } from './storage/logger.js';
export { incrementCounter, readCounter, resetCounter } from './storage/counter.js';

// Phase 3: Analysis modules
export { summarySchema, environmentSnapshotSchema } from './analysis/schemas.js';
export type { Summary, EnvironmentSnapshot } from './analysis/schemas.js';
export { readLogEntries } from './analysis/jsonl-reader.js';
export { preProcess } from './analysis/pre-processor.js';
export { scanEnvironment } from './analysis/environment-scanner.js';

// Phase 4: Analysis engine
export {
  routingTargetSchema,
  confidenceSchema,
  recommendationSchema,
  analysisConfigSchema,
  analysisResultSchema,
} from './schemas/recommendation.js';
export type {
  RoutingTarget,
  Confidence,
  Recommendation,
  AnalysisConfig,
  AnalysisResult,
} from './schemas/recommendation.js';
export { analyze, adjustConfidence } from './analysis/analyzer.js';
export type { Classifier } from './analysis/classifiers/index.js';
export {
  checkAndTriggerAnalysis,
  runAnalysis,
  writeAnalysisResult,
} from './analysis/trigger.js';

// Phase 5: Delivery
export {
  recommendationStatusSchema,
  recommendationStateEntrySchema,
  recommendationStateSchema,
  autoApplyLogEntrySchema,
} from './schemas/delivery.js';
export type {
  RecommendationStatus,
  RecommendationStateEntry,
  RecommendationState,
  AutoApplyLogEntry,
} from './schemas/delivery.js';
export {
  renderRecommendations,
  loadState,
  saveState,
  updateStatus,
  getStatusMap,
  rotateRecommendations,
  buildNotification,
  writeNotificationFlag,
  hasNotificationFlag,
  clearNotificationFlag,
  readNotificationFlagCount,
  autoApplyRecommendations,
} from './delivery/index.js';

// Phase 6: Onboarding & Quality Polish
export {
  experienceTierSchema,
  experienceLevelSchema,
  outcomeEntrySchema,
  outcomeSummarySchema,
} from './schemas/onboarding.js';
export type {
  ExperienceTier,
  ExperienceLevel,
  OutcomeEntry,
  OutcomeSummary,
} from './schemas/onboarding.js';
export { computeExperienceLevel } from './analysis/experience-level.js';
export { classifyOnboarding } from './analysis/classifiers/onboarding.js';
export {
  trackOutcomes,
  loadOutcomeHistory,
  computeOutcomeSummaries,
} from './analysis/outcome-tracker.js';

// Phase 12: Deep Scan
export { runDeepScan } from './scan/index.js';
export type { ScanResult, ScanContext, Scanner } from './scan/index.js';
export { scanContextSchema } from './scan/schemas.js';
export { buildScanContext } from './scan/context-builder.js';
export { scanRedundancy } from './scan/scanners/redundancy.js';
export { scanMechanization } from './scan/scanners/mechanization.js';
export { scanStaleness } from './scan/scanners/staleness.js';

// Phase 13: Auto-Generators
export { generateSkill } from './generators/skill-generator.js';
export { generateHook } from './generators/hook-generator.js';
export { generateClaudeMdPatch } from './generators/claude-md-generator.js';
export { generatedArtifactSchema, GENERATOR_VERSION } from './generators/schemas.js';
export type { GeneratedArtifact, GeneratorOptions } from './generators/schemas.js';

// Phase 14: Auto-Apply Closure
export { HookApplier } from './delivery/appliers/hook-applier.js';
export { ClaudeMdApplier } from './delivery/appliers/claude-md-applier.js';

// Phase 15: Slash Commands & Interactive Apply
export { registerScanCommand } from './cli/scan.js';
export { registerPendingCommand, registerApplyOneCommand, registerDismissCommand } from './cli/apply.js';
