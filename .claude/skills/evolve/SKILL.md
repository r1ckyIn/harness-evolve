---
name: evolve
description: Run harness-evolve analysis and show optimization recommendations for your Claude Code configuration
---

# harness-evolve: On-Demand Analysis

Run the harness-evolve analysis pipeline and present recommendations.

## Steps

1. Run the analysis pipeline:
   !`node "${CLAUDE_SKILL_DIR}/../../dist/delivery/run-evolve.js" "$PWD" 2>/dev/null`

2. Read the recommendations file at `~/.harness-evolve/recommendations.md` and present the results conversationally to the user, grouped by confidence tier (HIGH first, then MEDIUM, then LOW).

3. For each pending recommendation, ask the user what action to take:
   - **Apply**: Implement the suggested change now
   - **Dismiss**: Mark as dismissed (will not show again until a new analysis produces it)
   - **Skip**: Leave as pending for later review

4. When the user decides on a recommendation:
   - If **Apply**: Implement the suggested action, then update state by running:
     !`node -e "import('./dist/delivery/index.js').then(m => m.updateStatus('REC_ID', 'applied', 'Applied via /evolve'))"`
   - If **Dismiss**: Update state:
     !`node -e "import('./dist/delivery/index.js').then(m => m.updateStatus('REC_ID', 'dismissed'))"`
   - Replace REC_ID with the actual recommendation id.

5. After processing all recommendations, summarize what was applied and what was dismissed.
