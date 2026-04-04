// Generator module public API.
// Re-exports all generators, schemas, and utility functions.

export { generatedArtifactSchema } from './schemas.js';
export type { GeneratedArtifact, GeneratorOptions } from './schemas.js';
export { toSlug, escapeYaml, GENERATOR_VERSION, nowISO } from './schemas.js';
export { generateSkill } from './skill-generator.js';
export { generateHook } from './hook-generator.js';
export { generateClaudeMdPatch } from './claude-md-generator.js';
