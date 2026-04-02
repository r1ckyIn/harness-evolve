import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_DIR = join(process.env.HOME ?? '', '.harness-evolve');

export const paths = {
  base: BASE_DIR,
  logs: {
    prompts: join(BASE_DIR, 'logs', 'prompts'),
    tools: join(BASE_DIR, 'logs', 'tools'),
    permissions: join(BASE_DIR, 'logs', 'permissions'),
    sessions: join(BASE_DIR, 'logs', 'sessions'),
  },
  analysis: join(BASE_DIR, 'analysis'),
  analysisPreProcessed: join(BASE_DIR, 'analysis', 'pre-processed'),
  summary: join(BASE_DIR, 'analysis', 'pre-processed', 'summary.json'),
  environmentSnapshot: join(BASE_DIR, 'analysis', 'environment-snapshot.json'),
  analysisResult: join(BASE_DIR, 'analysis', 'analysis-result.json'),
  pending: join(BASE_DIR, 'pending'),
  config: join(BASE_DIR, 'config.json'),
  counter: join(BASE_DIR, 'counter.json'),
  recommendations: join(BASE_DIR, 'recommendations.md'),
  recommendationState: join(BASE_DIR, 'analysis', 'recommendation-state.json'),
  recommendationArchive: join(BASE_DIR, 'analysis', 'recommendations-archive'),
  notificationFlag: join(BASE_DIR, 'analysis', 'has-pending-notifications'),
  autoApplyLog: join(BASE_DIR, 'analysis', 'auto-apply-log.jsonl'),
  outcomeHistory: join(BASE_DIR, 'analysis', 'outcome-history.jsonl'),
} as const;

let initialized = false;

export async function ensureInit(): Promise<void> {
  if (initialized) return;
  await mkdir(paths.logs.prompts, { recursive: true });
  await mkdir(paths.logs.tools, { recursive: true });
  await mkdir(paths.logs.permissions, { recursive: true });
  await mkdir(paths.logs.sessions, { recursive: true });
  await mkdir(paths.analysis, { recursive: true });
  await mkdir(paths.analysisPreProcessed, { recursive: true });
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.recommendationArchive, { recursive: true });
  initialized = true;
}

// For testing: reset the initialized flag
export function resetInit(): void {
  initialized = false;
}
