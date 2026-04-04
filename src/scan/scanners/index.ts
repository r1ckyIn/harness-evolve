// Scanner registry for deep scan module.
// Defines the Scanner type signature and holds all registered scanner
// functions. Scanners are added in Plan 02.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

export type Scanner = (context: ScanContext) => Recommendation[];

// Scanner registry -- populated by Plan 02
export const scanners: Scanner[] = [];
