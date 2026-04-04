// Scanner registry for deep scan module.
// Defines the Scanner type signature and holds all registered scanner
// functions. Supports both sync and async scanners.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import { scanRedundancy } from './redundancy.js';
import { scanMechanization } from './mechanization.js';
import { scanStaleness } from './staleness.js';

export type Scanner = (context: ScanContext) => Recommendation[] | Promise<Recommendation[]>;

// Scanner registry -- all 3 scanners registered
export const scanners: Scanner[] = [scanRedundancy, scanMechanization, scanStaleness];
