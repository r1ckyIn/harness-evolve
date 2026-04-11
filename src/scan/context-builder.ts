// Context builder for deep scan module.
// Reads all Claude Code configuration sources (CLAUDE.md files, rules,
// settings, commands, hooks) from the filesystem and produces a validated
// ScanContext object for scanner analysis.

import { readFile, readdir } from 'node:fs/promises';
import { join, basename, relative } from 'node:path';
import { scanContextSchema, type ScanContext } from './schemas.js';

/**
 * Safely read a file, returning its content or null if it cannot be read.
 */
async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract markdown headings (# through ######) from content.
 */
export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const regex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

/**
 * Extract @-reference paths from content (e.g., @docs/guide.md).
 * Filters out email-like patterns (user@domain).
 */
export function extractReferences(content: string): string[] {
  const refs: string[] = [];
  const regex = /@([\w./-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const ref = match[1];
    // Filter out email-like patterns: if preceded by a word char, skip
    const idx = match.index;
    if (idx > 0 && /\w/.test(content[idx - 1])) {
      continue;
    }
    // Strip trailing dots only if they don't look like file extensions
    // e.g., "file.ts." -> "file.ts", but "file.md" stays as-is
    const cleaned = ref.replace(/\.$/, '');
    refs.push(cleaned);
  }
  return refs;
}

/**
 * Read CLAUDE.md files from the 3 standard locations.
 */
async function readClaudeMdFiles(
  cwd: string,
  home: string,
): Promise<ScanContext['claude_md_files']> {
  const locations: Array<{ path: string; scope: 'user' | 'project' | 'local' }> = [
    { path: join(cwd, 'CLAUDE.md'), scope: 'project' },
    { path: join(cwd, '.claude', 'CLAUDE.md'), scope: 'local' },
    { path: join(home, '.claude', 'CLAUDE.md'), scope: 'user' },
  ];

  const files: ScanContext['claude_md_files'] = [];

  for (const loc of locations) {
    const content = await readFileSafe(loc.path);
    if (content !== null) {
      files.push({
        path: loc.path,
        scope: loc.scope,
        content,
        line_count: content.split('\n').length,
        headings: extractHeadings(content),
        references: extractReferences(content),
      });
    }
  }

  return files;
}

/**
 * Recursively collect all .md files from a directory.
 */
async function collectMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectMdFiles(fullPath);
        results.push(...nested);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory does not exist or is unreadable
  }
  return results;
}

/**
 * Parse simple YAML frontmatter from markdown content.
 * Looks for --- delimiters and extracts paths array if present.
 */
function parseFrontmatter(
  content: string,
): { paths?: string[] } | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;

  const frontmatter = match[1];
  const pathsMatch = frontmatter.match(
    /paths:\s*\n((?:\s*-\s*.+\n?)*)/,
  );
  if (!pathsMatch) return {};

  const paths = pathsMatch[1]
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter((line) => line.length > 0);

  return paths.length > 0 ? { paths } : {};
}

/**
 * Read all rule files from .claude/rules/ recursively.
 */
async function readRuleFiles(cwd: string): Promise<ScanContext['rules']> {
  const rulesDir = join(cwd, '.claude', 'rules');
  const mdFiles = await collectMdFiles(rulesDir);

  const rules: ScanContext['rules'] = [];
  for (const filePath of mdFiles) {
    const content = await readFileSafe(filePath);
    if (content !== null) {
      rules.push({
        path: filePath,
        filename: basename(filePath),
        scope: 'project' as const,
        content,
        frontmatter: parseFrontmatter(content),
        headings: extractHeadings(content),
      });
    }
  }

  return rules;
}

/**
 * Read settings.json from all 3 scopes (user, project, local).
 */
async function readAllSettings(
  cwd: string,
  home: string,
): Promise<ScanContext['settings']> {
  const settingsPaths = {
    user: join(home, '.claude', 'settings.json'),
    project: join(cwd, '.claude', 'settings.json'),
    local: join(cwd, '.claude', 'settings.local.json'),
  };

  const readJsonSafe = async (path: string): Promise<unknown | null> => {
    try {
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };

  const [user, project, local] = await Promise.all([
    readJsonSafe(settingsPaths.user),
    readJsonSafe(settingsPaths.project),
    readJsonSafe(settingsPaths.local),
  ]);

  return { user, project, local };
}

/**
 * Read command files from both project and global .claude/commands/ directories.
 * Uses collectMdFiles for recursive subdirectory support.
 * Commands are labeled with scope to distinguish project-level from user-global.
 */
async function readCommandFiles(
  cwd: string,
  home: string,
): Promise<ScanContext['commands']> {
  const commands: ScanContext['commands'] = [];

  const locations: Array<{ dir: string; scope: 'user' | 'project' }> = [
    { dir: join(cwd, '.claude', 'commands'), scope: 'project' },
    { dir: join(home, '.claude', 'commands'), scope: 'user' },
  ];

  for (const loc of locations) {
    const mdFiles = await collectMdFiles(loc.dir);
    for (const filePath of mdFiles) {
      const content = await readFileSafe(filePath);
      if (content !== null) {
        // Compute relative name from the commands root dir, without .md extension
        const name = relative(loc.dir, filePath).replace(/\.md$/, '');
        commands.push({
          path: filePath,
          name,
          scope: loc.scope,
          content,
        });
      }
    }
  }

  return commands;
}

/**
 * Extract hook registrations from all settings scopes.
 */
function extractHooksFromAllSettings(
  settings: ScanContext['settings'],
): ScanContext['hooks_registered'] {
  const hooks: ScanContext['hooks_registered'] = [];

  const extractFromScope = (
    settingsObj: unknown,
    scope: 'user' | 'project' | 'local',
  ): void => {
    if (!settingsObj || typeof settingsObj !== 'object') return;
    const obj = settingsObj as Record<string, unknown>;
    if (!obj.hooks || typeof obj.hooks !== 'object') return;

    const hooksConfig = obj.hooks as Record<string, unknown>;
    for (const [event, defs] of Object.entries(hooksConfig)) {
      if (!Array.isArray(defs)) continue;
      for (const def of defs) {
        if (!def || typeof def !== 'object') continue;
        const hookDef = def as Record<string, unknown>;
        const type = String(hookDef.type ?? 'command');
        const command =
          typeof hookDef.command === 'string' ? hookDef.command : undefined;
        hooks.push({ event, scope, type, command });
      }
    }
  };

  extractFromScope(settings.user, 'user');
  extractFromScope(settings.project, 'project');
  extractFromScope(settings.local, 'local');

  return hooks;
}

/**
 * Build scope_summary by counting project vs user sources across all config types.
 */
function buildScopeSummary(
  claudeMdFiles: ScanContext['claude_md_files'],
  rules: ScanContext['rules'],
  settings: ScanContext['settings'],
  commands: ScanContext['commands'],
  hooksRegistered: ScanContext['hooks_registered'],
): ScanContext['scope_summary'] {
  // project_sources: claude_md with scope=project|local + rules + settings.project + settings.local + commands with scope=project + hooks with scope=project|local
  const projectSources =
    claudeMdFiles.filter((f) => f.scope === 'project' || f.scope === 'local').length +
    rules.length +
    (settings.project !== null ? 1 : 0) +
    (settings.local !== null ? 1 : 0) +
    commands.filter((c) => c.scope === 'project').length +
    hooksRegistered.filter((h) => h.scope === 'project' || h.scope === 'local').length;

  // user_sources: claude_md with scope=user + settings.user + commands with scope=user + hooks with scope=user
  const userSources =
    claudeMdFiles.filter((f) => f.scope === 'user').length +
    (settings.user !== null ? 1 : 0) +
    commands.filter((c) => c.scope === 'user').length +
    hooksRegistered.filter((h) => h.scope === 'user').length;

  return {
    project_sources: projectSources,
    user_sources: userSources,
    has_project_config: projectSources > 0,
    has_user_config: userSources > 0,
  };
}

/**
 * Build a complete ScanContext by reading all configuration sources.
 * Returns a validated ScanContext or throws if validation fails.
 *
 * @param cwd  - Project root directory
 * @param home - User home directory (defaults to process.env.HOME)
 */
export async function buildScanContext(
  cwd: string,
  home?: string,
): Promise<ScanContext> {
  const homeDir = home ?? process.env.HOME ?? '';

  const [claudeMdFiles, rules, settings, commands] = await Promise.all([
    readClaudeMdFiles(cwd, homeDir),
    readRuleFiles(cwd),
    readAllSettings(cwd, homeDir),
    readCommandFiles(cwd, homeDir),
  ]);

  const hooksRegistered = extractHooksFromAllSettings(settings);
  const scopeSummary = buildScopeSummary(claudeMdFiles, rules, settings, commands, hooksRegistered);

  const ctx = {
    generated_at: new Date().toISOString(),
    project_root: cwd,
    claude_md_files: claudeMdFiles,
    rules,
    settings,
    commands,
    hooks_registered: hooksRegistered,
    scope_summary: scopeSummary,
  };

  return scanContextSchema.parse(ctx);
}
