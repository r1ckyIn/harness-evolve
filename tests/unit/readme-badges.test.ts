import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readmePath = join(__dirname, '..', '..', 'README.md');
const content = readFileSync(readmePath, 'utf-8');

describe('README badges', () => {
  it('contains npm version badge', () => {
    expect(content).toContain('img.shields.io/npm/v/harness-evolve');
  });

  it('contains CI status badge', () => {
    expect(content).toContain(
      'img.shields.io/github/actions/workflow/status/r1ckyIn/harness-evolve/ci.yml',
    );
  });

  it('contains license badge', () => {
    expect(content).toContain('img.shields.io/badge/License-MIT');
  });

  it('does not contain static test count badge', () => {
    expect(content).not.toContain('Tests-336_passing');
  });

  it('all badges use flat-square style', () => {
    expect(content).toContain('flat-square');
  });
});
