#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { analyze } from './core/analyze.js';
import { renderJson, renderMarkdown, renderTerminal } from './report/render.js';
import { createAnthropicClient, type LlmClient } from './llm/reviewer.js';
import { createClaudeCliClient, claudeCliAvailable, type CliRunner } from './llm/cli.js';
import { createLogger, type LogLevel } from './core/logger.js';
import type { ExecFn } from './adapters/types.js';

export interface CliDeps {
  write: (s: string) => void;
  env: Record<string, string | undefined>;
  /** Injectable runner for the Claude Code CLI provider; defaults to a real spawn. */
  cliRunner?: CliRunner;
}

const realExec: ExecFn = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { stdout: r.stdout ?? '', status: r.status };
};

const realCliRunner: CliRunner = (cmd, args, input) => {
  // `shell: true` on Windows so the `claude` shim (claude.cmd) resolves; args are
  // static and safe, and the untrusted prompt rides on stdin, not the command line.
  const r = spawnSync(cmd, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (r.error) return { stdout: '', status: 127 };
  return { stdout: r.stdout ?? '', status: r.status };
};

export async function runScan(argv: string[], deps: CliDeps): Promise<number> {
  const program = new Command();
  let exitCode = 0;

  program
    .name('aim')
    .command('scan <path>')
    .option('--llm', 'enable LLM-assisted analysis')
    .option('--llm-provider <p>', 'cli | api (default: cli when --llm is set)')
    .option('--llm-model <id>', 'model id for the LLM layer')
    .option('--no-tools', 'skip external tool adapters')
    .option('--format <type>', 'terminal | json | markdown', 'terminal')
    .option('--out <file>', 'write report to a file')
    .option('--config <file>', 'custom framework.yaml path')
    .option('-v, --verbose', 'verbose diagnostics on stderr')
    .option('-q, --quiet', 'suppress diagnostics (errors only)')
    .action(async (path: string, opts: any) => {
      const key = deps.env.ANTHROPIC_API_KEY;
      const cliRunner = deps.cliRunner ?? realCliRunner;
      let llmClient: LlmClient | null = null;

      // Diagnostics go to stderr so report stdout (e.g. JSON) stays clean.
      const level: LogLevel = opts.verbose ? 'debug' : opts.quiet ? 'error' : 'warn';
      const logger = createLogger({ level, write: (s) => process.stderr.write(s) });

      // Resolve provider: explicit flag wins; otherwise default to the Claude
      // Code CLI when --llm is set, or the API path when only a key is present.
      const provider: string | undefined =
        opts.llmProvider ?? (opts.llm ? 'cli' : key ? 'api' : undefined);

      if (opts.llm || opts.llmProvider) {
        if (provider === 'api') {
          llmClient = createAnthropicClient(opts.llmModel ?? 'claude-opus-4-8', key);
          if (!llmClient) {
            deps.write('Error: --llm-provider api requires ANTHROPIC_API_KEY\n');
            exitCode = 2;
            return;
          }
        } else {
          // CLI provider — reuses Claude Code's own auth (subscription or Bedrock).
          if (!claudeCliAvailable(cliRunner)) {
            deps.write('Error: Claude Code CLI (claude) not found on PATH\n');
            exitCode = 2;
            return;
          }
          llmClient = createClaudeCliClient({ runner: cliRunner, model: opts.llmModel });
        }
      } else if (key) {
        llmClient = createAnthropicClient(opts.llmModel ?? 'claude-opus-4-8', key);
      }

      const report = await analyze({
        rootDir: path,
        frameworkPath: opts.config,
        exec: realExec,
        useTools: opts.tools !== false,
        llmClient,
        logger,
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runScan(process.argv.slice(2), { write: (s) => process.stdout.write(s), env: process.env })
    .then((code) => process.exit(code));
}
