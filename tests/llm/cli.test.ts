import { describe, it, expect } from 'vitest';
import { createClaudeCliClient, claudeCliAvailable, type CliRunner } from '../../src/llm/cli.js';
import { llmReview } from '../../src/llm/reviewer.js';
import type { CollectorContext } from '../../src/collectors/types.js';

const ctx: CollectorContext = {
  rootDir: '/x',
  files: ['src/app.ts'],
  readText: () => 'export function handler() { return 1; }',
};

describe('claude CLI provider', () => {
  it('parses .result from `claude -p --output-format json`', async () => {
    const runner: CliRunner = () => ({
      stdout: JSON.stringify({ result: '{"scores":{}}', total_cost_usd: 0.01 }),
      status: 0,
    });
    const client = createClaudeCliClient({ runner });
    expect(await client('hello')).toBe('{"scores":{}}');
  });

  it('falls back to raw stdout when the output is not JSON', async () => {
    const runner: CliRunner = () => ({ stdout: 'plain text answer', status: 0 });
    const client = createClaudeCliClient({ runner });
    expect(await client('x')).toBe('plain text answer');
  });

  it('throws on a non-zero exit so the LLM layer degrades gracefully', async () => {
    const runner: CliRunner = () => ({ stdout: '', status: 1 });
    const client = createClaudeCliClient({ runner });
    await expect(client('x')).rejects.toThrow();
  });

  it('passes the prompt to the runner via stdin input', async () => {
    let seen = '';
    const runner: CliRunner = (_cmd, _args, input) => {
      seen = input;
      return { stdout: JSON.stringify({ result: 'ok' }), status: 0 };
    };
    const client = createClaudeCliClient({ runner });
    await client('PROMPT-123');
    expect(seen).toBe('PROMPT-123');
  });

  it('adds --model only when provided', async () => {
    let seenArgs: string[] = [];
    const runner: CliRunner = (_cmd, args) => {
      seenArgs = args;
      return { stdout: JSON.stringify({ result: 'ok' }), status: 0 };
    };
    await createClaudeCliClient({ runner })('x');
    expect(seenArgs).not.toContain('--model');
    await createClaudeCliClient({ runner, model: 'claude-opus-4-8' })('x');
    expect(seenArgs).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8']));
  });

  it('claudeCliAvailable reflects the --version exit status', () => {
    const ok: CliRunner = (_c, args) => ({ stdout: '2.1.0', status: args[0] === '--version' ? 0 : 1 });
    const missing: CliRunner = () => ({ stdout: '', status: 127 });
    expect(claudeCliAvailable(ok)).toBe(true);
    expect(claudeCliAvailable(missing)).toBe(false);
  });

  it('drives llmReview end-to-end through the CLI client', async () => {
    const runner: CliRunner = () => ({
      stdout: JSON.stringify({
        result: '```json\n{"scores":{"sec.authz":{"score":40,"note":"no auth"}}}\n```',
      }),
      status: 0,
    });
    const findings = await llmReview(ctx, createClaudeCliClient({ runner }));
    expect(findings).toHaveLength(1);
    expect(findings[0].criterionId).toBe('sec.authz');
    expect(findings[0].source).toBe('llm');
  });
});
