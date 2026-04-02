import { z } from 'zod/v4';

export const configSchema = z.object({
  version: z.number().default(1),
  analysis: z.object({
    threshold: z.number().min(1).default(50),
    enabled: z.boolean().default(true),
    classifierThresholds: z.record(z.string(), z.number()).default({}),
  }).default({ threshold: 50, enabled: true, classifierThresholds: {} }),
  hooks: z.object({
    capturePrompts: z.boolean().default(true),
    captureTools: z.boolean().default(true),
    capturePermissions: z.boolean().default(true),
    captureSessions: z.boolean().default(true),
  }).default({
    capturePrompts: true,
    captureTools: true,
    capturePermissions: true,
    captureSessions: true,
  }),
  scrubbing: z.object({
    enabled: z.boolean().default(true),
    highEntropyDetection: z.boolean().default(false),
    customPatterns: z.array(z.object({
      name: z.string(),
      regex: z.string(),
      replacement: z.string(),
    })).default([]),
  }).default({
    enabled: true,
    highEntropyDetection: false,
    customPatterns: [],
  }),
  delivery: z.object({
    stdoutInjection: z.boolean().default(true),
    maxTokens: z.number().default(200),
    fullAuto: z.boolean().default(false),
    maxRecommendationsInFile: z.number().default(20),
    archiveAfterDays: z.number().default(7),
  }).default({
    stdoutInjection: true,
    maxTokens: 200,
    fullAuto: false,
    maxRecommendationsInFile: 20,
    archiveAfterDays: 7,
  }),
}).strict();

export type Config = z.infer<typeof configSchema>;
