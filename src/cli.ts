#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { analyze } from './core/analyze.js';
import { renderJson, renderMarkdown, renderTerminal } from './report/render.js';
import { createAnthropicClient, type LlmClient } from './llm/reviewer.js';
import type { ExecFn } from './adapters/types.js';

export interface CliDeps {
  write: (s: string) => void;
  env: Record<string, string | undefined>;
}

const realExec: ExecFn = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { stdout: r.stdout ?? '', status: r.status };
};

export async function runScan(argv: string[], deps: CliDeps): Promise<number> {
  const program = new Command();
  let exitCode = 0;

  program
    .name('aim')
    .command('scan <path>')
    .option('--llm', 'force LLM-assisted analysis (requires ANTHROPIC_API_KEY)')
    .option('--no-tools', 'skip external tool adapters')
    .option('--format <type>', 'terminal | json | markdown', 'terminal')
    .option('--out <file>', 'write report to a file')
    .option('--config <file>', 'custom framework.yaml path')
    .action(async (path: string, opts: any) => {
      const key = deps.env.ANTHROPIC_API_KEY;
      let llmClient: LlmClient | null = null;
      if (opts.llm) {
        llmClient = createAnthropicClient('claude-opus-4-8', key);
        if (!llmClient) {
          deps.write('Error: --llm requires ANTHROPIC_API_KEY\n');
          exitCode = 2;
          return;
        }
      } else if (key) {
        llmClient = createAnthropicClient('claude-opus-4-8', key);
      }

      const report = await analyze({
        rootDir: path,
        frameworkPath: opts.config,
        exec: realExec,
        useTools: opts.tools !== false,
        llmClient,
      });

      const rendered =
        opts.format === 'json' ? renderJson(report)
        : opts.format === 'markdown' ? renderMarkdown(report)
        : renderTerminal(report);

      if (opts.out) {
        writeFileSync(opts.out, rendered);
        deps.write(`Report written to ${opts.out}\n`);
      } else {
        deps.write(rendered + '\n');
      }
    });

  await program.parseAsync(argv, { from: 'user' });
  return exitCode;
}

// Entry point when run as a binary.
if (import.meta.url === `file://${process.argv[1]}`) {
  runScan(process.argv.slice(2), { write: (s) => process.stdout.write(s), env: process.env })
    .then((code) => process.exit(code));
}
