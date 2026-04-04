import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

describe('package.json metadata (NPM-01)', () => {
  it('has a non-empty description', () => {
    expect(pkg.description).toBe(
      'Self-iteration engine for Claude Code \u2014 detects usage patterns and routes optimization recommendations',
    );
  });

  it('has required keywords', () => {
    const required = ['claude-code', 'hooks', 'self-improvement', 'automation', 'developer-tools', 'ai'];
    expect(pkg.keywords).toEqual(expect.arrayContaining(required));
    expect(pkg.keywords).toHaveLength(required.length);
  });

  it('has MIT license', () => {
    expect(pkg.license).toBe('MIT');
  });

  it('has author containing Ricky', () => {
    expect(pkg.author).toContain('Ricky');
  });

  it('has correct repository URL', () => {
    expect(pkg.repository).toBeDefined();
    expect(pkg.repository.url).toBe('git+https://github.com/r1ckyIn/harness-evolve.git');
  });

  it('has correct homepage', () => {
    expect(pkg.homepage).toBe('https://github.com/r1ckyIn/harness-evolve#readme');
  });

  it('has bugs URL', () => {
    expect(pkg.bugs).toBeDefined();
    expect(pkg.bugs.url).toBe('https://github.com/r1ckyIn/harness-evolve/issues');
  });

  it('has correct engines', () => {
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toBe('>=22.14.0');
  });
});

describe('package.json files whitelist (NPM-02)', () => {
  it('has files field with dist, README.md, LICENSE', () => {
    expect(pkg.files).toEqual(['dist', 'README.md', 'LICENSE']);
  });

  it('does NOT include src, tests, or .planning in files', () => {
    expect(pkg.files).not.toContain('src');
    expect(pkg.files).not.toContain('tests');
    expect(pkg.files).not.toContain('.planning');
  });
});

describe('package.json exports map (NPM-03)', () => {
  it('has root export with types before default', () => {
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
    expect(pkg.exports['.'].default).toBe('./dist/index.js');

    // Verify types key comes before default key
    const keys = Object.keys(pkg.exports['.']);
    const typesIdx = keys.indexOf('types');
    const defaultIdx = keys.indexOf('default');
    expect(typesIdx).toBeLessThan(defaultIdx);
  });

  const subpaths = [
    './hooks/user-prompt-submit',
    './hooks/pre-tool-use',
    './hooks/post-tool-use',
    './hooks/post-tool-use-failure',
    './hooks/permission-request',
    './hooks/stop',
    './delivery/run-evolve',
  ];

  it('has all 7 hook/delivery subpath exports', () => {
    for (const subpath of subpaths) {
      expect(pkg.exports[subpath]).toBeDefined();
    }
  });

  it.each(subpaths)('subpath %s has correct types and default', (subpath) => {
    const clean = subpath.replace('./', '');
    expect(pkg.exports[subpath].types).toBe(`./dist/${clean}.d.ts`);
    expect(pkg.exports[subpath].default).toBe(`./dist/${clean}.js`);
  });

  it('has exactly 8 export entries (root + 7 subpaths)', () => {
    expect(Object.keys(pkg.exports)).toHaveLength(8);
  });
});

describe('package.json bin field (NPM-04)', () => {
  it('has bin field with harness-evolve pointing to dist/cli.js', () => {
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin['harness-evolve']).toBe('dist/cli.js');
  });
});

describe('package.json publishConfig', () => {
  it('has provenance set to true', () => {
    expect(pkg.publishConfig).toBeDefined();
    expect(pkg.publishConfig.provenance).toBe(true);
  });
});

describe('package.json validation scripts', () => {
  it('has check:publint script', () => {
    expect(pkg.scripts['check:publint']).toBe('publint --strict');
  });

  it('has check:attw script', () => {
    expect(pkg.scripts['check:attw']).toBe('attw --pack . --profile esm-only');
  });

  it('has check:package script', () => {
    expect(pkg.scripts['check:package']).toBe('npm run check:publint && npm run check:attw');
  });

  it('has prepublishOnly script', () => {
    expect(pkg.scripts.prepublishOnly).toBe('npm run build && npm run check:package');
  });
});

describe('package.json dev dependencies for validation', () => {
  it('has publint as dev dependency', () => {
    expect(pkg.devDependencies.publint).toBeDefined();
  });

  it('has @arethetypeswrong/cli as dev dependency', () => {
    expect(pkg.devDependencies['@arethetypeswrong/cli']).toBeDefined();
  });
});
