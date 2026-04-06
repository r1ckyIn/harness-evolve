// Unit tests for simplified scan module (buildScanResult).
// Validates that buildScanResult wraps buildScanContext output
// with a generated_at timestamp and scan_context field.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context-builder module
vi.mock('../../../src/scan/context-builder.js', () => ({
  buildScanContext: vi.fn(),
}));

import { buildScanResult, type ScanResult } from '../../../src/scan/index.js';
import { buildScanContext } from '../../../src/scan/context-builder.js';
import type { ScanContext } from '../../../src/scan/schemas.js';

// Minimal valid ScanContext fixture
const fakeScanContext: ScanContext = {
  generated_at: new Date().toISOString(),
  project_root: '/fake/project',
  claude_md_files: [],
  rules: [],
  settings: { user: null, project: null, local: null },
  commands: [],
  hooks_registered: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildScanContext).mockResolvedValue(fakeScanContext);
});

describe('buildScanResult', () => {
  it('returns ScanResult with generated_at and scan_context', async () => {
    const result = await buildScanResult('/fake/project');

    expect(result).toHaveProperty('generated_at');
    expect(result).toHaveProperty('scan_context');
    expect(result.scan_context).toEqual(fakeScanContext);
  });

  it('generated_at is a valid ISO timestamp', async () => {
    const before = new Date().toISOString();
    const result = await buildScanResult('/fake/project');
    const after = new Date().toISOString();

    expect(typeof result.generated_at).toBe('string');
    expect(result.generated_at >= before).toBe(true);
    expect(result.generated_at <= after).toBe(true);
  });

  it('calls buildScanContext with provided cwd', async () => {
    await buildScanResult('/my/project');

    expect(buildScanContext).toHaveBeenCalledWith('/my/project', undefined);
  });

  it('passes home parameter through to buildScanContext', async () => {
    await buildScanResult('/my/project', '/custom/home');

    expect(buildScanContext).toHaveBeenCalledWith('/my/project', '/custom/home');
  });

  it('scan_context matches mocked buildScanContext output', async () => {
    const customContext: ScanContext = {
      ...fakeScanContext,
      project_root: '/custom/path',
      claude_md_files: [
        {
          path: '/custom/CLAUDE.md',
          scope: 'project',
          content: '# Test',
          line_count: 1,
          headings: ['Test'],
          references: [],
        },
      ],
    };
    vi.mocked(buildScanContext).mockResolvedValue(customContext);

    const result = await buildScanResult('/custom/path');

    expect(result.scan_context).toEqual(customContext);
    expect(result.scan_context.claude_md_files).toHaveLength(1);
  });

  it('does not include recommendations or scanner_meta fields', async () => {
    const result = await buildScanResult('/fake/project') as Record<string, unknown>;

    expect(result).not.toHaveProperty('recommendations');
    expect(result).not.toHaveProperty('scanner_meta');
  });
});
