// ClaudeMdApplier: placeholder — implementation in Task 2.
// This file exists so that Task 1 test imports resolve.

import type { Applier, ApplierOptions } from './index.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';

export class ClaudeMdApplier implements Applier {
  readonly target = 'CLAUDE_MD';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'CLAUDE_MD';
  }

  async apply(
    rec: Recommendation,
    _options?: ApplierOptions,
  ): Promise<AutoApplyResult> {
    return {
      recommendation_id: rec.id,
      success: false,
      details: 'ClaudeMdApplier not yet implemented',
    };
  }
}
