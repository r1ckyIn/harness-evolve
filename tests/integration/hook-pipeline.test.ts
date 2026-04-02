// Integration test: full hook pipeline end-to-end with real file I/O.
// Verifies CAP-01 (prompt capture), CAP-02 (permission capture),
// CAP-03 (tool duration correlation), CAP-04 (transcript_path enrichment).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect all paths to temp directory
vi.mock('../../src/storage/dirs.js', async () => {
  return {
    get paths() {
      return {
        base: tempDir,
        logs: {
          prompts: join(tempDir, 'logs', 'prompts'),
          tools: join(tempDir, 'logs', 'tools'),
          permissions: join(tempDir, 'logs', 'permissions'),
          sessions: join(tempDir, 'logs', 'sessions'),
        },
        analysis: join(tempDir, 'analysis'),
        pending: join(tempDir, 'pending'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
      };
    },
    ensureInit: async () => {
      const { mkdir: mk } = await import('node:fs/promises');
      await mk(join(tempDir, 'logs', 'prompts'), { recursive: true });
      await mk(join(tempDir, 'logs', 'tools'), { recursive: true });
      await mk(join(tempDir, 'logs', 'permissions'), { recursive: true });
      await mk(join(tempDir, 'logs', 'sessions'), { recursive: true });
      await mk(join(tempDir, 'analysis'), { recursive: true });
      await mk(join(tempDir, 'pending'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import handlers AFTER mock is set up
const { handleUserPromptSubmit } = await import('../../src/hooks/user-prompt-submit.js');
const { handlePreToolUse } = await import('../../src/hooks/pre-tool-use.js');
const { handlePostToolUse } = await import('../../src/hooks/post-tool-use.js');
const { handlePostToolUseFailure } = await import('../../src/hooks/post-tool-use-failure.js');
const { handlePermissionRequest } = await import('../../src/hooks/permission-request.js');
const { readCounter } = await import('../../src/storage/counter.js');

// --- Input helpers ---

function makePromptInput(prompt: string, sessionId = 'test-session'): string {
  return JSON.stringify({
    session_id: sessionId,
    transcript_path: '/tmp/test-transcript.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: 'UserPromptSubmit',
    prompt,
  });
}

function makeToolInput(event: string, toolUseId: string, toolName = 'Bash'): string {
  return JSON.stringify({
    session_id: 'test-session',
    transcript_path: '/tmp/test-transcript.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: event,
    tool_name: toolName,
    tool_input: { command: 'ls -la' },
    tool_use_id: toolUseId,
  });
}

function makePermissionInput(toolName: string): string {
  return JSON.stringify({
    session_id: 'test-session',
    transcript_path: '/tmp/test-transcript.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: 'PermissionRequest',
    tool_name: toolName,
    tool_input: { command: 'rm -rf /' },
  });
}

/**
 * Read all JSONL entries from log files in a directory.
 * Each log file contains one JSONL line per appendLogEntry call.
 */
async function readLogEntries(logDir: string): Promise<Record<string, unknown>[]> {
  const entries: Record<string, unknown>[] = [];
  let files: string[];
  try {
    files = await readdir(logDir);
  } catch {
    return entries;
  }
  // Sort files to read in chronological order
  files.sort();
  for (const file of files) {
    const content = await readFile(join(logDir, file), 'utf-8');
    // Each file may have multiple lines (JSONL format)
    const lines = content.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      entries.push(JSON.parse(line) as Record<string, unknown>);
    }
  }
  return entries;
}

describe('hook pipeline integration', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-pipeline-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('full prompt capture pipeline (CAP-01, CAP-04)', async () => {
    // Submit 3 different prompts
    await handleUserPromptSubmit(makePromptInput('How do I create a hook?'));
    await handleUserPromptSubmit(makePromptInput('Show me the file structure'));
    await handleUserPromptSubmit(makePromptInput('Run the tests'));

    // Read log entries
    const logDir = join(tempDir, 'logs', 'prompts');
    const entries = await readLogEntries(logDir);

    // Verify 3 entries captured
    expect(entries.length).toBe(3);

    // Verify each entry has all required fields
    for (const entry of entries) {
      expect(entry.timestamp).toBeDefined();
      expect(entry.session_id).toBe('test-session');
      expect(entry.cwd).toBe('/home/user/project');
      expect(typeof entry.prompt).toBe('string');
      expect(typeof entry.prompt_length).toBe('number');
      expect(entry.transcript_path).toBe('/tmp/test-transcript.jsonl');
    }

    // Verify prompts are correct
    expect(entries[0].prompt).toBe('How do I create a hook?');
    expect(entries[1].prompt).toBe('Show me the file structure');
    expect(entries[2].prompt).toBe('Run the tests');

    // Verify counter shows total=3
    const counter = await readCounter();
    expect(counter.total).toBe(3);
    expect(counter.session['test-session']).toBe(3);
  });

  it('full tool usage pipeline with duration (CAP-03)', async () => {
    // Invoke PreToolUse
    await handlePreToolUse(makeToolInput('PreToolUse', 'tu_001'));

    // Small delay for measurable duration
    await new Promise((resolve) => setTimeout(resolve, 15));

    // Invoke PostToolUse with same tool_use_id
    await handlePostToolUse(makeToolInput('PostToolUse', 'tu_001'));

    // Read tools log entries
    const logDir = join(tempDir, 'logs', 'tools');
    const entries = await readLogEntries(logDir);

    // Should have 2 entries: pre + post
    expect(entries.length).toBe(2);

    // First entry is 'pre'
    const preEntry = entries[0];
    expect(preEntry.event).toBe('pre');
    expect(preEntry.tool_name).toBe('Bash');
    expect(preEntry.input_summary).toBeDefined();
    expect(preEntry.session_id).toBe('test-session');

    // Second entry is 'post' with duration
    const postEntry = entries[1];
    expect(postEntry.event).toBe('post');
    expect(postEntry.tool_name).toBe('Bash');
    expect(postEntry.success).toBe(true);
    expect(typeof postEntry.duration_ms).toBe('number');
    expect(postEntry.duration_ms as number).toBeGreaterThanOrEqual(10);

    // Verify marker file was cleaned up
    const pendingDir = join(tempDir, 'pending');
    const pendingFiles = await readdir(pendingDir);
    expect(pendingFiles.length).toBe(0);

    // Verify counter incremented for both events
    const counter = await readCounter();
    expect(counter.total).toBe(2);
  });

  it('tool failure pipeline (CAP-03)', async () => {
    // Invoke PreToolUse first
    await handlePreToolUse(makeToolInput('PreToolUse', 'tu_002'));

    // Invoke PostToolUseFailure with same tool_use_id
    await handlePostToolUseFailure(
      makeToolInput('PostToolUseFailure', 'tu_002'),
    );

    // Read tools log entries
    const logDir = join(tempDir, 'logs', 'tools');
    const entries = await readLogEntries(logDir);

    // Should have pre + failure entries
    expect(entries.length).toBe(2);

    // Second entry should be failure
    const failEntry = entries[1];
    expect(failEntry.event).toBe('failure');
    expect(failEntry.success).toBe(false);
    expect(failEntry.tool_name).toBe('Bash');

    // Verify marker file was cleaned up
    const pendingDir = join(tempDir, 'pending');
    const pendingFiles = await readdir(pendingDir);
    expect(pendingFiles.length).toBe(0);
  });

  it('permission request pipeline (CAP-02)', async () => {
    // Submit a permission request
    await handlePermissionRequest(makePermissionInput('Bash'));

    // Read permissions log entries
    const logDir = join(tempDir, 'logs', 'permissions');
    const entries = await readLogEntries(logDir);

    // Should have 1 entry
    expect(entries.length).toBe(1);

    const entry = entries[0];
    expect(entry.tool_name).toBe('Bash');
    expect(entry.decision).toBe('unknown');
    expect(entry.session_id).toBe('test-session');
    expect(entry.timestamp).toBeDefined();

    // Counter should increment
    const counter = await readCounter();
    expect(counter.total).toBe(1);
  });

  it('counter accumulates across all hook types', async () => {
    // 2 prompt submissions
    await handleUserPromptSubmit(makePromptInput('first prompt'));
    await handleUserPromptSubmit(makePromptInput('second prompt'));

    // 1 PreToolUse + 1 PostToolUse
    await handlePreToolUse(makeToolInput('PreToolUse', 'tu_acc'));
    await handlePostToolUse(makeToolInput('PostToolUse', 'tu_acc'));

    // 1 permission request
    await handlePermissionRequest(makePermissionInput('Write'));

    // Counter should show total=5 from all hook types
    const counter = await readCounter();
    expect(counter.total).toBe(5);
    expect(counter.session['test-session']).toBe(5);
  });
});
