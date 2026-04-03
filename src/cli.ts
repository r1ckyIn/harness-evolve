#!/usr/bin/env node
// CLI entry point -- Phase 11 will add Commander.js commands
// For now, display version and usage hint

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

console.log(`harness-evolve v${pkg.version}`);
console.log('Commands: init, status, uninstall (coming in v1.1)');
console.log('Run with --help for usage information.');
