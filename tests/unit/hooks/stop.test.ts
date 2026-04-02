import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Temp directory updated per-test
let tempDir: string;

// Track checkAndTriggerAnalysis calls
const mockCheckAndTrigger = vi.fn().mockResolvedValue(true);

// Mock dirs module to redirect paths to temp directory
vi.mock('../../../src/storage/dirs.js', async () => {
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
        analysisResult: join(tempDir, 'analysis-result.json'),
        recommendations: join(tempDir, 'recommendations.md'),
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

// Mock the analysis trigger to track calls without side effects
vi.mock('../../../src/analysis/trigger.js', () => {
  return {
    checkAndTriggerAnalysis: mockCheckAndTrigger,
  };
});

// Import AFTER mocks are set up
const { handleStop } = await import('../../../src/hooks/stop.js');

// Import schema for direct validation tests
const { stopInputSchema } = await import('../../../src/schemas/hook-input.js');

// Valid Stop input
const validInput = {
  session_id: 'test-session-001',
  transcript_path: '/tmp/transcripts/abc.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'Stop',
  stop_hook_active: false,
  last_assistant_message: 'Here is your answer.',
};

describe('handleStop', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-stop-'));
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
    mockCheckAndTrigger.mockClear();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('calls checkAndTriggerAnalysis when stop_hook_active is false', async () => {
    await handleStop(JSON.stringify(validInput));

    expect(mockCheckAndTrigger).toHaveBeenCalledOnce();
    expect(mockCheckAndTrigger).toHaveBeenCalledWith('/home/user/project');
  });

  it('returns immediately without calling checkAndTriggerAnalysis when stop_hook_active is true', async () => {
    const activeInput = { ...validInput, stop_hook_active: true };
    await handleStop(JSON.stringify(activeInput));

    expect(mockCheckAndTrigger).not.toHaveBeenCalled();
  });

  it('does not throw on invalid JSON', async () => {
    await expect(handleStop('not valid json {')).resolves.not.toThrow();
    expect(mockCheckAndTrigger).not.toHaveBeenCalled();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handleStop(incomplete)).resolves.not.toThrow();
    expect(mockCheckAndTrigger).not.toHaveBeenCalled();
  });

  it('handles optional last_assistant_message', async () => {
    const noMessage = { ...validInput };
    delete (noMessage as Record<string, unknown>).last_assistant_message;
    await handleStop(JSON.stringify(noMessage));

    expect(mockCheckAndTrigger).toHaveBeenCalledOnce();
  });

  it('swallows errors from checkAndTriggerAnalysis', async () => {
    mockCheckAndTrigger.mockRejectedValueOnce(new Error('analysis failed'));
    await expect(handleStop(JSON.stringify(validInput))).resolves.not.toThrow();
  });
});

describe('stopInputSchema', () => {
  it('validates correct Stop event shape', () => {
    const result = stopInputSchema.parse(validInput);
    expect(result.hook_event_name).toBe('Stop');
    expect(result.stop_hook_active).toBe(false);
    expect(result.cwd).toBe('/home/user/project');
    expect(result.last_assistant_message).toBe('Here is your answer.');
  });

  it('rejects non-Stop hook_event_name', () => {
    const wrongEvent = { ...validInput, hook_event_name: 'UserPromptSubmit' };
    expect(() => stopInputSchema.parse(wrongEvent)).toThrow();
  });
});
