import { describe, it, expect } from 'vitest';
import { llmReview, createAnthropicClient } from '../../src/llm/reviewer.js';
import type { CollectorContext } from '../../src/collectors/types.js';

const ctx: CollectorContext = {
  rootDir: '/x',
  files: ['src/app.ts'],
  readText: () => 'export function handler() { return 1; }',
};

describe('llmReview', () => {
  it('skips (returns []) when client is null', async () => {
    expect(await llmReview(ctx, null)).toEqual([]);
    expect(createAnthropicClient('claude-opus-4-8', undefined)).toBeNull();
  });

  it('parses JSON scores from the model into findings', async () => {
    const client = async () => '```json\n{"scores":{"sec.authz":{"score":40,"note":"no auth"}}}\n```';
    const fs = await llmReview(ctx, client);
    expect(fs).toHaveLength(1);
    expect(fs[0].criterionId).toBe('sec.authz');
    expect(fs[0].score).toBe(40);
    expect(fs[0].source).toBe('llm');
  });

  it('returns [] on malformed model output', async () => {
    const client = async () => 'I cannot help with that.';
    expect(await llmReview(ctx, client)).toEqual([]);
  });
});
