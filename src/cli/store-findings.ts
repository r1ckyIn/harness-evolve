// Store-findings CLI subcommand -- validates and persists model-generated findings.
// Reads a JSON array of recommendations from stdin, validates each against
// recommendationSchema, and writes valid ones to the analysis pipeline.

import type { Command } from '@commander-js/extra-typings';
import { recommendationSchema } from '../schemas/recommendation.js';
import type { Recommendation } from '../schemas/recommendation.js';
import { ensureInit, paths } from '../storage/dirs.js';
import writeFileAtomic from 'write-file-atomic';

/**
 * Read all data from stdin as a string.
 * Collects chunks until EOF, then returns the concatenated result.
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Register the 'store-findings' subcommand on a Commander.js program.
 *
 * Accepts a JSON array of model-generated findings from stdin, validates
 * each against the Recommendation schema, and persists valid findings to
 * the analysis result file (paths.analysisResult). Invalid findings are
 * skipped with error messages rather than rejecting the entire batch.
 *
 * Auto-creates ~/.harness-evolve/ directories via ensureInit() if they
 * don't exist (INFRA-04: works without prior 'harness-evolve init').
 *
 * Usage: echo '[{...}]' | harness-evolve store-findings
 */
export function registerStoreFindingsCommand(program: Command): void {
  program
    .command('store-findings')
    .description('Validate and store model-generated findings into the apply pipeline')
    .action(async () => {
      // Guard: no piped input
      if (process.stdin.isTTY) {
        console.error(
          'Usage: Pipe JSON findings to stdin.\n' +
          '  echo \'[{"id":"...","target":"HOOK",...}]\' | harness-evolve store-findings'
        );
        process.exitCode = 1;
        return;
      }

      // Auto-create directories (INFRA-04)
      await ensureInit();

      let raw: string;
      try {
        raw = await readStdin();
      } catch (err) {
        console.error(`Error reading stdin: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
        return;
      }

      let findings: unknown[];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.error('Error: Input must be a JSON array of findings.');
          process.exitCode = 1;
          return;
        }
        findings = parsed;
      } catch (err) {
        console.error(`Error: Invalid JSON input. ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
        return;
      }

      const valid: Recommendation[] = [];
      const errors: string[] = [];

      for (let i = 0; i < findings.length; i++) {
        const result = recommendationSchema.safeParse(findings[i]);
        if (result.success) {
          valid.push(result.data);
        } else {
          const issueMessages = result.error.issues
            .map((issue) => issue.message)
            .join(', ');
          errors.push(`Finding ${i}: ${issueMessages}`);
        }
      }

      if (valid.length > 0) {
        const now = new Date().toISOString();
        const analysisResult = {
          generated_at: now,
          summary_period: {
            since: now,
            until: now,
            days: 0,
          },
          recommendations: valid,
          metadata: {
            classifier_count: 0,
            patterns_evaluated: valid.length,
            environment_ecosystems: [],
            claude_code_version: 'model-driven',
          },
        };

        await writeFileAtomic(
          paths.analysisResult,
          JSON.stringify(analysisResult, null, 2),
        );
      }

      console.log(JSON.stringify({
        stored: valid.length,
        skipped: errors.length,
        errors,
      }, null, 2));
    });
}
