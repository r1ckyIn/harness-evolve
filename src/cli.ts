#!/usr/bin/env node
// CLI entry point -- Commander.js program with init, status, and uninstall subcommands

import { Command } from '@commander-js/extra-typings';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerInitCommand } from './cli/init.js';
import { registerStatusCommand } from './cli/status.js';
import { registerUninstallCommand } from './cli/uninstall.js';
import { registerScanCommand } from './cli/scan.js';
import { registerPendingCommand, registerApplyOneCommand, registerDismissCommand } from './cli/apply.js';

// Read version from package.json at runtime
// import.meta.dirname = dist/ (where cli.js lives after build)
const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command()
  .name('harness-evolve')
  .description('Self-iteration engine for Claude Code')
  .version(pkg.version);

// Register all subcommands
registerInitCommand(program);
registerStatusCommand(program);
registerUninstallCommand(program);
registerScanCommand(program);
registerPendingCommand(program);
registerApplyOneCommand(program);
registerDismissCommand(program);

program.parse();
