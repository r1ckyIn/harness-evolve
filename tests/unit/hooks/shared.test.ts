import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import {
  hookCommonSchema,
  userPromptSubmitInputSchema,
  preToolUseInputSchema,
  postToolUseInputSchema,
  postToolUseFailureInputSchema,
  permissionRequestInputSchema,
} from '../../../src/schemas/hook-input.js';
import { summarizeToolInput, readFromStream } from '../../../src/hooks/shared.js';

// Common test fields reused across schemas
const common = {
  session_id: 's1',
  transcript_path: '/tmp/t.jsonl',
  cwd: '/home',
  permission_mode: 'default',
};

describe('hookCommonSchema', () => {
  it('parses valid common fields', () => {
    const result = hookCommonSchema.parse(common);
    expect(result).toEqual(common);
  });

  it('rejects missing fields', () => {
    expect(() => hookCommonSchema.parse({ session_id: 's1' })).toThrow();
  });
});

describe('userPromptSubmitInputSchema', () => {
  it('parses valid UserPromptSubmit input', () => {
    const input = {
      ...common,
      hook_event_name: 'UserPromptSubmit',
      prompt: 'hello world',
    };
    const result = userPromptSubmitInputSchema.parse(input);
    expect(result.hook_event_name).toBe('UserPromptSubmit');
    expect(result.prompt).toBe('hello world');
    expect(result.session_id).toBe('s1');
  });

  it('rejects wrong hook_event_name', () => {
    const input = {
      ...common,
      hook_event_name: 'PreToolUse',
      prompt: 'hello',
    };
    expect(() => userPromptSubmitInputSchema.parse(input)).toThrow();
  });
});

describe('preToolUseInputSchema', () => {
  it('parses valid PreToolUse input', () => {
    const input = {
      ...common,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    const result = preToolUseInputSchema.parse(input);
    expect(result.hook_event_name).toBe('PreToolUse');
    expect(result.tool_name).toBe('Bash');
    expect(result.tool_input).toEqual({ command: 'ls' });
    expect(result.tool_use_id).toBe('tu_123');
  });

  it('rejects wrong hook_event_name', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    expect(() => preToolUseInputSchema.parse(input)).toThrow();
  });
});

describe('postToolUseInputSchema', () => {
  it('parses valid PostToolUse input', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    const result = postToolUseInputSchema.parse(input);
    expect(result.hook_event_name).toBe('PostToolUse');
    expect(result.tool_response).toBeUndefined();
  });

  it('parses PostToolUse with optional tool_response', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
      tool_response: 'file1.txt\nfile2.txt',
    };
    const result = postToolUseInputSchema.parse(input);
    expect(result.tool_response).toBe('file1.txt\nfile2.txt');
  });

  it('rejects wrong hook_event_name', () => {
    const input = {
      ...common,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    expect(() => postToolUseInputSchema.parse(input)).toThrow();
  });
});

describe('postToolUseFailureInputSchema', () => {
  it('parses valid PostToolUseFailure input', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    const result = postToolUseFailureInputSchema.parse(input);
    expect(result.hook_event_name).toBe('PostToolUseFailure');
    expect(result.error).toBeUndefined();
    expect(result.is_interrupt).toBeUndefined();
  });

  it('parses PostToolUseFailure with optional error and is_interrupt', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
      tool_use_id: 'tu_456',
      error: 'Permission denied',
      is_interrupt: true,
    };
    const result = postToolUseFailureInputSchema.parse(input);
    expect(result.error).toBe('Permission denied');
    expect(result.is_interrupt).toBe(true);
  });

  it('rejects wrong hook_event_name', () => {
    const input = {
      ...common,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'tu_123',
    };
    expect(() => postToolUseFailureInputSchema.parse(input)).toThrow();
  });
});

describe('permissionRequestInputSchema', () => {
  it('parses valid PermissionRequest input', () => {
    const input = {
      ...common,
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    };
    const result = permissionRequestInputSchema.parse(input);
    expect(result.hook_event_name).toBe('PermissionRequest');
    expect(result.tool_name).toBe('Bash');
    expect(result.permission_suggestions).toBeUndefined();
  });

  it('parses PermissionRequest with optional permission_suggestions', () => {
    const input = {
      ...common,
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
      permission_suggestions: [{ action: 'deny' }],
    };
    const result = permissionRequestInputSchema.parse(input);
    expect(result.permission_suggestions).toEqual([{ action: 'deny' }]);
  });

  it('rejects wrong hook_event_name', () => {
    const input = {
      ...common,
      hook_event_name: 'UserPromptSubmit',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    };
    expect(() => permissionRequestInputSchema.parse(input)).toThrow();
  });
});

// -- Shared utility tests --

describe('summarizeToolInput', () => {
  it('returns command for Bash tool', () => {
    expect(summarizeToolInput('Bash', { command: 'npm test' })).toBe('npm test');
  });

  it('returns file_path for Write tool', () => {
    expect(summarizeToolInput('Write', { file_path: '/tmp/foo.ts', content: 'very long content...' })).toBe('/tmp/foo.ts');
  });

  it('returns file_path for Edit tool', () => {
    expect(summarizeToolInput('Edit', { file_path: '/tmp/bar.ts' })).toBe('/tmp/bar.ts');
  });

  it('returns file_path for Read tool', () => {
    expect(summarizeToolInput('Read', { file_path: '/tmp/baz.ts' })).toBe('/tmp/baz.ts');
  });

  it('returns pattern for Glob tool', () => {
    expect(summarizeToolInput('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts');
  });

  it('returns pattern for Grep tool', () => {
    expect(summarizeToolInput('Grep', { pattern: 'import.*from' })).toBe('import.*from');
  });

  it('returns JSON stringified input for unknown tool', () => {
    const result = summarizeToolInput('UnknownMCP', { foo: 'bar' });
    expect(result).toBe('{"foo":"bar"}');
  });

  it('truncates long Bash commands to 200 chars', () => {
    const longCmd = 'x'.repeat(300);
    const result = summarizeToolInput('Bash', { command: longCmd });
    expect(result.length).toBe(203); // 200 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncates long unknown tool input to 200 chars', () => {
    const bigInput: Record<string, unknown> = { data: 'y'.repeat(300) };
    const result = summarizeToolInput('UnknownMCP', bigInput);
    expect(result.length).toBeLessThanOrEqual(203);
    expect(result.endsWith('...')).toBe(true);
  });

  it('does not truncate short inputs', () => {
    expect(summarizeToolInput('Bash', { command: 'ls' })).toBe('ls');
  });

  it('handles missing command field for Bash', () => {
    expect(summarizeToolInput('Bash', {})).toBe('');
  });

  it('handles missing file_path field for Write', () => {
    expect(summarizeToolInput('Write', {})).toBe('');
  });
});

describe('readFromStream', () => {
  it('reads complete data from stream', async () => {
    const stream = Readable.from(['hello ', 'world']);
    const result = await readFromStream(stream);
    expect(result).toBe('hello world');
  });

  it('reads empty stream', async () => {
    const stream = Readable.from([]);
    const result = await readFromStream(stream);
    expect(result).toBe('');
  });

  it('reads multi-chunk stream', async () => {
    const chunks = ['{"session_id":', '"abc",', '"prompt":"hi"}'];
    const stream = Readable.from(chunks);
    const result = await readFromStream(stream);
    expect(JSON.parse(result)).toEqual({ session_id: 'abc', prompt: 'hi' });
  });

  it('rejects on stream error', async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error('stream broke'));
      },
    });
    await expect(readFromStream(stream)).rejects.toThrow('stream broke');
  });
});
