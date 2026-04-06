# Research Summary: harness-evolve v4.0 Model-Driven Scanner

**Domain:** Scanner architecture redesign -- code-based to model-driven analysis
**Researched:** 2026-04-06
**Overall confidence:** HIGH

## Executive Summary

harness-evolve v3.0 shipped a comprehensive config scanner with 7 TypeScript functions that detect quality issues via regex and string matching. Human testing revealed two fundamental problems: (1) BUG-01 -- the hooks parser cannot handle Claude Code's actual nested `{matcher, hooks: [...]}` format, causing 21 false positives on real configs; and (2) ARCH-01 -- regex-based analysis is semantically blind, unable to detect meaning-level conflicts or redundancies.

The v4.0 redesign splits the scanner into two layers: **code handles I/O** (reading files, building context, persisting results) and **the model handles analysis** (semantic judgment, conflict detection, optimization recommendations). This mirrors the proven GSD pattern where `.md` workflow documents structure model behavior with precise output format specs, severity rules, and edge case handling to achieve consistent results.

The architectural pivot is low-risk because: (1) the output contract stays unchanged (Recommendation schema), so the entire downstream pipeline (apply, store, dismiss, auto-apply) works without modification; (2) the old code-based scanners can coexist during transition; and (3) BUG-01 is fixed in the context-builder regardless of architecture, improving all consumers.

The key research finding is that existing scanners fall into two categories: **deterministic checks** (staleness, structure, commands) that work well as code and could theoretically stay, vs **judgment checks** (redundancy, mechanization, conflict) that are fundamentally limited by regex. By moving ALL analysis to the model, we gain consistency (one analysis approach), extensibility (add new checks by editing guidance docs, not writing code), and a new capability impossible with code: cross-file coherence analysis.

## Key Findings

**Stack:** No new dependencies. Changes are architectural (template rewrite, CLI commands, code removal). Existing Zod, Commander.js, and write-file-atomic cover all needs.

**Architecture:** Split into "code for I/O, model for judgment." Context-builder reads files and outputs JSON. Slash command template embeds analysis guidance. Model produces structured findings. New CLI commands (`scan-context`, `store-findings`) bridge the gap.

**Critical pitfall:** The `/evolve:scan` template becomes the most important artifact -- it IS the scanner. Template quality directly determines scan quality. Bad guidance = bad findings. This must be tested with diverse real-world configs before removing old scanners.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase A: BUG-01 Fix + Context Enhancement** -- Foundation, no breaking changes
   - Addresses: BUG-01 nested hooks parsing, `scan-context` CLI command
   - Avoids: Making any breaking changes before new approach is proven
   - Dependencies: None. Everything else depends on this.

2. **Phase B: Scanner Guidance + Template Rewrite** -- The core architectural pivot
   - Addresses: ARCH-01 (model-driven analysis), ARCH-02 (guidance docs)
   - Avoids: Removing old scanners prematurely
   - Dependencies: Phase A (needs working `scan-context` CLI)

3. **Phase C: Cleanup + Old Scanner Removal** -- Safe only after Phase B validated
   - Addresses: Code cleanup, test migration
   - Avoids: Removing fallback before new approach proven
   - Dependencies: Phase B (must be validated with real configs first)

4. **Phase D: Ecosystem Learning + Polish** -- Independent research
   - Addresses: Similar project analysis, cross-file coherence, guidance tuning
   - Avoids: Scope creep -- this is improvement, not foundation
   - Dependencies: Phase B (improves guidance quality)

**Phase ordering rationale:**
- A before B: Template needs working `scan-context` CLI to call
- B before C: Never remove old code until replacement is validated
- C after B validation: If model-driven analysis has gaps, old scanners remain as fallback
- D can overlap with C or follow it

**Research flags for phases:**
- Phase B: HIGH priority for deeper research -- guidance document quality determines entire scanner effectiveness. Study GSD workflow patterns closely for structured output specs.
- Phase A: Standard patterns -- bug fix + new CLI command, unlikely to need research.
- Phase C: Standard patterns -- file deletion + test migration.
- Phase D: Needs research by definition -- ecosystem study.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All changes use existing tools. |
| Features | HIGH | Feature set directly derived from BUG-01/ARCH-01 analysis. Clear before/after comparison. |
| Architecture | HIGH | "Code for I/O, model for judgment" pattern validated by GSD workflow analysis. Output contract (Recommendation schema) unchanged = low integration risk. |
| Pitfalls | HIGH | Primary risk (template quality) identified with mitigation (retain old scanners during transition). BUG-01 fix approach verified against official Claude Code hooks format. |

## Gaps to Address

- **Guidance document authoring best practices:** How verbose should each analysis area be? Too terse = model misses issues. Too verbose = exceeds template size limits. Need to test with real configs.
- **Model temperature and consistency:** Different Claude models may produce different results from the same guidance. Should the template specify model constraints (e.g., `disable-model-invocation` removed, specific model requested)?
- **Token budget for scan-context:** Large configs (50+ rule files) could produce ScanContext JSON that exceeds reasonable token limits. May need truncation or summarization for very large configs.
- **CI integration:** Old `harness-evolve scan` CLI provided machine-parseable output. Model-driven scan via slash command is interactive. Need a story for CI/automated scanning.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Confirmed nested `{matcher, hooks: [...]}` as standard format
- Codebase analysis: 7 scanner files, context-builder.ts, scan orchestrator, CLI utils, recommendation schema
- GSD workflow analysis: execute-phase.md, new-project.md, research-phase.md, quick.md, verify-work.md, gsd-executor agent

### Secondary (MEDIUM confidence)
- GSD agent definitions (gsd-executor.md) -- Pattern for structuring model behavioral specs
- TODOS.md -- BUG-01, ARCH-01, ARCH-02 definitions

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
