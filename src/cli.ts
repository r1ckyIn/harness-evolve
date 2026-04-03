#!/usr/bin/env node
// CLI entry point -- Commander.js program with subcommands

import { Command } from '@commander-js/extra-typings';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerInitCommand } from './cli/init.js';

// Read version from package.json at runtime
// import.meta.dirname = dist/ (where cli.js lives after build)
const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command()
  .name('harness-evolve')
  .description('Self-iteration engine for Claude Code')
  .version(pkg.version);

// Register subcommands
registerInitCommand(program);

// Placeholder commands for status and uninstall (Plan 11-02 implements these)
program
  .command('status')
  .description('Show harness-evolve status and statistics')
  .action(() => {
    console.log('Status command coming in Plan 11-02');
  });

program
  .command('uninstall')
  .description('Remove harness-evolve hooks and optionally delete data')
  .option('--purge', 'Also delete ~/.harness-evolve/ data directory')
  .action(() => {
    console.log('Uninstall command coming in Plan 11-02');
  });

program.parse();
