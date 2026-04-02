// Environment scanner: discovers installed Claude Code tools via filesystem
// scanning, reads settings at all scopes, detects Claude Code version, and
// identifies ecosystem presence (GSD, Cog, etc.).

import { readdir, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { constants } from 'node:fs';
import writeFileAtomic from 'write-file-atomic';
import {
  environmentSnapshotSchema,
  type EnvironmentSnapshot,
} from './schemas.js';
import { paths, ensureInit } from '../storage/dirs.js';

// Version compatibility range -- tested and verified
const KNOWN_COMPATIBLE_MIN = '2.1.0';
const KNOWN_COMPATIBLE_MAX = '2.1.99';

/**
 * Scan the user's environment to discover installed Claude Code tools,
 * settings, version info, and ecosystem presence. Writes the snapshot
 * atomically to paths.environmentSnapshot.
 *
 * @param cwd  - Current working directory (project root)
 * @param home - User home directory (defaults to process.env.HOME)
 * @returns Validated EnvironmentSnapshot
 */
export async function scanEnvironment(
  cwd: string,
  home?: string,
): Promise<EnvironmentSnapshot> {
  const homeDir = home ?? process.env.HOME ?? '';

  // Read all 3 settings files in parallel
  const [userSettings, projectSettings, localSettings] = await Promise.all([
    readSettingsSafe(join(homeDir, '.claude', 'settings.json')),
    readSettingsSafe(join(cwd, '.claude', 'settings.json')),
    readSettingsSafe(join(cwd, '.claude', 'settings.local.json')),
  ]);

  // Extract enabledPlugins from user settings if present
  const enabledPluginNames = extractEnabledPlugins(userSettings);

  // Run all discovery functions in parallel
  const [claudeVersion, plugins, skills, rules, hooks, claudeMds, ecosystems] =
    await Promise.all([
      Promise.resolve(detectClaudeCodeVersion()),
      discoverPlugins(homeDir, enabledPluginNames),
      discoverSkills(homeDir, cwd),
      discoverRules(cwd),
      Promise.resolve(
        discoverHooks(userSettings, projectSettings, localSettings),
      ),
      discoverClaudeMd(homeDir, cwd),
      detectEcosystems(cwd, homeDir),
    ]);

  const snapshot: EnvironmentSnapshot = {
    generated_at: new Date().toISOString(),
    claude_code: claudeVersion,
    settings: {
      user: userSettings,
      project: projectSettings,
      local: localSettings,
    },
    installed_tools: {
      plugins,
      skills,
      rules,
      hooks,
      claude_md: claudeMds,
    },
    detected_ecosystems: ecosystems,
  };

  // Validate against schema before writing
  const validated = environmentSnapshotSchema.parse(snapshot);

  // Write atomically to analysis directory
  await ensureInit();
  await writeFileAtomic(
    paths.environmentSnapshot,
    JSON.stringify(validated),
  );

  return validated;
}

// --- Internal helpers ---

/**
 * Detect Claude Code version by running `claude --version`.
 * Returns { version, version_known, compatible }.
 */
function detectClaudeCodeVersion(): EnvironmentSnapshot['claude_code'] {
  try {
    const output = execFileSync('claude', ['--version'], {
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const match = output.match(/^(\d+\.\d+\.\d+)/);
    if (!match) {
      return { version: 'unknown', version_known: false, compatible: false };
    }

    const version = match[1];
    const compatible =
      compareSemver(version, KNOWN_COMPATIBLE_MIN) >= 0 &&
      compareSemver(version, KNOWN_COMPATIBLE_MAX) <= 0;

    return { version, version_known: true, compatible };
  } catch {
    return { version: 'unknown', version_known: false, compatible: false };
  }
}

/**
 * Safely read and parse a JSON settings file.
 * Returns parsed object or null if file is missing or invalid.
 */
async function readSettingsSafe(
  filePath: string,
): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Extract enabled plugin names from user settings.
 */
function extractEnabledPlugins(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object') return [];
  const obj = settings as Record<string, unknown>;
  if (!Array.isArray(obj.enabledPlugins)) return [];

  return obj.enabledPlugins
    .map((p: unknown) => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object' && 'name' in p) {
        return String((p as { name: unknown }).name);
      }
      return null;
    })
    .filter((n): n is string => n !== null);
}

/**
 * Discover installed plugins from ~/.claude/plugins/installed_plugins.json.
 * Cross-references with enabledPlugins from settings for accuracy.
 */
async function discoverPlugins(
  home: string,
  enabledPluginNames: string[],
): Promise<EnvironmentSnapshot['installed_tools']['plugins']> {
  try {
    const pluginsFile = join(home, '.claude', 'plugins', 'installed_plugins.json');
    const raw = await readFile(pluginsFile, 'utf-8');
    const installed = JSON.parse(raw) as unknown[];

    if (!Array.isArray(installed)) return [];

    const plugins: EnvironmentSnapshot['installed_tools']['plugins'] = [];

    for (const entry of installed) {
      if (!entry || typeof entry !== 'object') continue;
      const plugin = entry as Record<string, unknown>;
      const name = String(plugin.name ?? '');
      const marketplace = String(plugin.marketplace ?? 'unknown');
      const scope = String(plugin.scope ?? 'user');
      const version = String(plugin.version ?? 'latest');

      const enabled = enabledPluginNames.includes(name);

      // Scan plugin cache for capabilities
      const capabilities = await scanPluginCapabilities(
        home,
        marketplace,
        name,
        version,
      );

      plugins.push({ name, marketplace, enabled, scope, capabilities });
    }

    return plugins;
  } catch {
    return [];
  }
}

/**
 * Scan plugin cache directory for capability subdirectories.
 */
async function scanPluginCapabilities(
  home: string,
  marketplace: string,
  pluginName: string,
  version: string,
): Promise<string[]> {
  const knownCapabilities = ['commands', 'skills', 'hooks', 'agents'];
  const capabilities: string[] = [];

  try {
    const cacheDir = join(
      home, '.claude', 'plugins', 'cache',
      marketplace, pluginName, version,
    );
    const entries = await readdir(cacheDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && knownCapabilities.includes(entry.name)) {
        capabilities.push(entry.name);
      }
    }
  } catch {
    // Cache directory does not exist or is unreadable
  }

  return capabilities;
}

/**
 * Discover skill directories at user and project scopes.
 */
async function discoverSkills(
  home: string,
  cwd: string,
): Promise<EnvironmentSnapshot['installed_tools']['skills']> {
  const skills: EnvironmentSnapshot['installed_tools']['skills'] = [];

  // User-scope skills: ~/.claude/skills/
  try {
    const userSkillsDir = join(home, '.claude', 'skills');
    const entries = await readdir(userSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push({ name: entry.name, scope: 'user' });
      }
    }
  } catch {
    // Directory does not exist
  }

  // Project-scope skills: {cwd}/.claude/skills/
  try {
    const projectSkillsDir = join(cwd, '.claude', 'skills');
    const entries = await readdir(projectSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push({ name: entry.name, scope: 'project' });
      }
    }
  } catch {
    // Directory does not exist
  }

  return skills;
}

/**
 * Discover rule directories at project scope.
 */
async function discoverRules(
  cwd: string,
): Promise<EnvironmentSnapshot['installed_tools']['rules']> {
  const rules: EnvironmentSnapshot['installed_tools']['rules'] = [];

  try {
    const rulesDir = join(cwd, '.claude', 'rules');
    const entries = await readdir(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        rules.push({ name: entry.name, scope: 'project' });
      }
    }
  } catch {
    // Directory does not exist
  }

  return rules;
}

/**
 * Extract hook definitions from settings objects at all 3 scopes.
 */
function discoverHooks(
  userSettings: unknown,
  projectSettings: unknown,
  localSettings: unknown,
): EnvironmentSnapshot['installed_tools']['hooks'] {
  const hooks: EnvironmentSnapshot['installed_tools']['hooks'] = [];

  extractHooksFromSettings(userSettings, 'user', hooks);
  extractHooksFromSettings(projectSettings, 'project', hooks);
  extractHooksFromSettings(localSettings, 'local', hooks);

  return hooks;
}

/**
 * Extract hooks from a single settings object and append to the hooks array.
 */
function extractHooksFromSettings(
  settings: unknown,
  scope: 'user' | 'project' | 'local',
  hooks: EnvironmentSnapshot['installed_tools']['hooks'],
): void {
  if (!settings || typeof settings !== 'object') return;
  const obj = settings as Record<string, unknown>;
  if (!obj.hooks || typeof obj.hooks !== 'object') return;

  const hooksConfig = obj.hooks as Record<string, unknown>;
  for (const [event, defs] of Object.entries(hooksConfig)) {
    if (!Array.isArray(defs)) continue;
    for (const def of defs) {
      if (!def || typeof def !== 'object') continue;
      const hookDef = def as Record<string, unknown>;
      const type = String(hookDef.type ?? 'command');
      hooks.push({ event, scope, type });
    }
  }
}

/**
 * Discover CLAUDE.md files at common locations.
 */
async function discoverClaudeMd(
  home: string,
  cwd: string,
): Promise<EnvironmentSnapshot['installed_tools']['claude_md']> {
  const locations = [
    join(cwd, 'CLAUDE.md'),
    join(cwd, '.claude', 'CLAUDE.md'),
    join(home, '.claude', 'CLAUDE.md'),
  ];

  const results: EnvironmentSnapshot['installed_tools']['claude_md'] = [];

  for (const path of locations) {
    let exists = false;
    try {
      await access(path, constants.F_OK);
      exists = true;
    } catch {
      // File does not exist
    }
    results.push({ path, exists });
  }

  return results;
}

/**
 * Detect known ecosystems by checking for characteristic directories.
 */
async function detectEcosystems(
  cwd: string,
  home: string,
): Promise<string[]> {
  const ecosystems: string[] = [];

  // GSD: check for .planning/ directory
  try {
    await access(join(cwd, '.planning'), constants.F_OK);
    ecosystems.push('gsd');
  } catch {
    // No GSD detected
  }

  // Cog: check for 'cog' in ~/.claude/skills/
  try {
    const skillsDir = join(home, '.claude', 'skills');
    const entries = await readdir(skillsDir);
    if (entries.some((e) => e.toLowerCase().includes('cog'))) {
      ecosystems.push('cog');
    }
  } catch {
    // Skills directory does not exist
  }

  return ecosystems;
}

/**
 * Compare two semver strings (X.Y.Z format).
 * Returns -1, 0, or 1.
 */
function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}
