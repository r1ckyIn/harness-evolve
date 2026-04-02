import { readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { configSchema, type Config } from '../schemas/config.js';
import { paths } from './dirs.js';

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(paths.config, 'utf-8');
    return configSchema.parse(JSON.parse(raw));
  } catch {
    // File doesn't exist, is invalid JSON, or fails strict validation
    const defaults = configSchema.parse({});
    await writeFileAtomic(paths.config, JSON.stringify(defaults, null, 2));
    return defaults;
  }
}
