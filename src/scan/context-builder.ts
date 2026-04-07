// Context builder for deep scan module.
// Reads all Claude Code configuration sources (CLAUDE.md files, rules,
// settings, commands, hooks) from the filesystem and produces a validated
// ScanContext object for scanner analysis.

import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
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
 * Check if a reference looks like an npm scoped package (e.g., @scope/package).
 * Returns true when the ref has exactly one slash (2 segments) and the second
 * segment has no file extension, OR when the @ is preceded by a quote character
 * (JSON/import context).
 */
function isNpmScopedPackage(ref: string, content: string, matchIndex: number): boolean {
  // Check for JSON/import context: "@scope/package" or '@scope/package'
  if (matchIndex > 0 && (content[matchIndex - 1] === '"' || content[matchIndex - 1] === "'")) {
    return true;
  }

  const segments = ref.split('/');
  // npm scoped packages have exactly 2 path segments: scope/package
  if (segments.length !== 2) return false;

  // If the last segment has a file extension, it's a real file reference
  const lastSegment = segments[segments.length - 1];
  if (/\.\w+$/.test(lastSegment)) return false;

  return true;
}

/**
 * Check if a reference is a URL user path (e.g., github.com/@user/path).
 * Returns true when the character before @ is / or : (URL context).
 */
function isUrlUserPath(content: string, matchIndex: number): boolean {
  if (matchIndex <= 0) return false;
  const prevChar = content[matchIndex - 1];
  return prevChar === '/' || prevChar === ':';
}

/**
 * Extract @-reference paths from content (e.g., @docs/guide.md).
 * Filters out email-like patterns (user@domain), npm scoped packages
 * (@scope/package), and URL user paths (/@user/path).
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
    // Strip trailing dots (punctuation) before filtering
    // e.g., "file.ts." -> "file.ts", but "file.md" stays as-is
    const cleaned = ref.replace(/\.$/, '');
    // Filter npm scoped packages: @scope/package patterns
    if (isNpmScopedPackage(cleaned, content, idx)) {
      continue;
    }
    // Filter URL user paths: /@user/path preceded by / or :
    if (isUrlUserPath(content, idx)) {
      continue;
    }
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
 * Read command files from .claude/commands/ directory.
 */
async function readCommandFiles(
  cwd: string,
): Promise<ScanContext['commands']> {
  const commandsDir = join(cwd, '.claude', 'commands');
  const commands: ScanContext['commands'] = [];

  try {
    const entries = await readdir(commandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = join(commandsDir, entry.name);
        const content = await readFileSafe(filePath);
        if (content !== null) {
          commands.push({
            path: filePath,
            name: entry.name.replace(/\.md$/, ''),
            content,
          });
        }
      }
    }
  } catch {
    // Directory does not exist
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
        const matcherGroup = def as Record<string, unknown>;

        // Nested format: { matcher?, hooks: [{ type, command, ... }] }
        if (Array.isArray(matcherGroup.hooks)) {
          const matcher =
            typeof matcherGroup.matcher === 'string'
              ? matcherGroup.matcher
              : undefined;
          for (const innerHook of matcherGroup.hooks) {
            if (!innerHook || typeof innerHook !== 'object') continue;
            const h = innerHook as Record<string, unknown>;
            hooks.push({
              event,
              scope,
              type: String(h.type ?? 'command'),
              command:
                typeof h.command === 'string' ? h.command : undefined,
              matcher,
            });
          }
        } else {
          // Flat format fallback: { type, command, ... }
          hooks.push({
            event,
            scope,
            type: String(matcherGroup.type ?? 'command'),
            command:
              typeof matcherGroup.command === 'string'
                ? matcherGroup.command
                : undefined,
          });
        }
      }
    }
  };

  extractFromScope(settings.user, 'user');
  extractFromScope(settings.project, 'project');
  extractFromScope(settings.local, 'local');

  return hooks;
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
    readCommandFiles(cwd),
  ]);

  const hooksRegistered = extractHooksFromAllSettings(settings);

  const ctx = {
    generated_at: new Date().toISOString(),
    project_root: cwd,
    claude_md_files: claudeMdFiles,
    rules,
    settings,
    commands,
    hooks_registered: hooksRegistered,
  };

  return scanContextSchema.parse(ctx);
}
