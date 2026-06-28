import Anthropic from '@anthropic-ai/sdk';
import type { CollectorContext } from '../collectors/types.js';
import { makeFinding, type Finding } from '../core/types.js';

export type LlmClient = (prompt: string) => Promise<string>;

const CRITERIA = ['scal.architecture', 'scal.state', 'scal.db', 'sec.authz', 'sec.input', 'rel.errors', 'rel.logging'];
const CODE = /\.[jt]sx?$|\.py$/;

function buildPrompt(ctx: CollectorContext): string {
  const sample = ctx.files.filter((f) => CODE.test(f)).slice(0, 20)
    .map((f) => `--- ${f} ---\n${ctx.readText(f)}`)
    .join('\n\n')
    .slice(0, 12000);
  return [
    'You are a senior engineer assessing production maturity of a (likely AI-generated) codebase.',
    `Score each of these criteria 0-100 (higher = more production-ready): ${CRITERIA.join(', ')}.`,
    'Reply ONLY with JSON: {"scores":{"<criterionId>":{"score":<0-100>,"note":"<short reason>"}}}.',
    '',
    'CODE SAMPLE:',
    sample,
  ].join('\n');
}

function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function llmReview(ctx: CollectorContext, client: LlmClient | null): Promise<Finding[]> {
  if (!client) return [];
  let text: string;
  try {
    text = await client(buildPrompt(ctx));
  } catch {
    return [];
  }
  const parsed = extractJson(text);
  const scores = parsed?.scores;
  if (!scores || typeof scores !== 'object') return [];

  const out: Finding[] = [];
  for (const [criterionId, val] of Object.entries(scores as Record<string, any>)) {
    if (!CRITERIA.includes(criterionId) || typeof val?.score !== 'number') continue;
    out.push(makeFinding({
      criterionId,
      score: val.score,
      confidence: 0.7,
      source: 'llm',
      evidence: [{ file: '(llm)', note: String(val.note ?? 'LLM assessment') }],
    }));
  }
  return out;
}

export function createAnthropicClient(model: string, apiKey: string | undefined): LlmClient | null {
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  return async (prompt: string): Promise<string> => {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  };
}
