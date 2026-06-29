import type { LlmClient } from './reviewer.js';

/**
 * Runs an external command, feeding `input` to its stdin, and returns the
 * captured stdout plus exit status. Injected so tests never spawn a real
 * process; the production implementation lives in the CLI entry point.
 */
export type CliRunner = (cmd: string, args: string[], input: string) => {
  stdout: string;
  status: number | null;
};

export interface ClaudeCliOptions {
  runner: CliRunner;
  /** Optional model id passed through to `claude --model`. */
  model?: string;
  /** Override the executable name (defaults to `claude`). */
  command?: string;
}

/**
 * Builds an LlmClient that delegates to the Claude Code CLI in headless mode
 * (`claude -p --output-format json`). The prompt is passed via stdin so it is
 * never shell-parsed (no quoting/length/injection concerns), and AIMature
 * inherits whatever authentication Claude Code is configured with — the user's
 * logged-in session, or AWS Bedrock when `CLAUDE_CODE_USE_BEDROCK` and AWS
 * credentials are set in the environment. No API key is handled here.
 */
export function createClaudeCliClient(opts: ClaudeCliOptions): LlmClient {
  const cmd = opts.command ?? 'claude';
  const args = ['-p', '--output-format', 'json'];
  if (opts.model) args.push('--model', opts.model);

  return async (prompt: string): Promise<string> => {
    const res = opts.runner(cmd, args, prompt);
    if (res.status !== 0) {
      throw new Error(`claude CLI exited with status ${res.status}`);
    }
    try {
      const parsed = JSON.parse(res.stdout) as { result?: unknown };
      if (typeof parsed.result === 'string') return parsed.result;
    } catch {
      // Not JSON (e.g. --output-format text) — return the raw text.
    }
    return res.stdout;
  };
}

/** Probes whether the Claude Code CLI is installed and runnable. */
export function claudeCliAvailable(runner: CliRunner, command = 'claude'): boolean {
  try {
    return runner(command, ['--version'], '').status === 0;
  } catch {
    return false;
  }
}
