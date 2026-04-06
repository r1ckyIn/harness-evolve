// Scanner registry for deep scan module.
// Defines the Scanner type signature and holds all registered scanner
// functions. Supports both sync and async scanners.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import { scanRedundancy } from './redundancy.js';
import { scanMechanization } from './mechanization.js';
import { scanStaleness } from './staleness.js';
import { scanConflicts } from './conflict.js';
import { scanStructure } from './structure.js';
import { scanHooksRedundancy } from './hooks-redundancy.js';
import { scanCommands } from './commands.js';

export type Scanner = (context: ScanContext) => Recommendation[] | Promise<Recommendation[]>;

// Scanner registry -- all 7 scanners registered
export const scanners: Scanner[] = [
  scanRedundancy,
  scanMechanization,
  scanStaleness,
  scanConflicts,
  scanStructure,
  scanHooksRedundancy,
  scanCommands,
];

// Scanner names -- parallel to scanners array, keep in sync
export const scannerNames: string[] = [
  'redundancy',
  'mechanization',
  'staleness',
  'conflicts',
  'structure',
  'hooks',
  'commands',
];
