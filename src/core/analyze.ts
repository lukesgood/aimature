import { buildContext } from '../collectors/scan.js';
import type { Collector } from '../collectors/types.js';
import { metadataCollector } from '../collectors/metadata.js';
import { secretsCollector } from '../collectors/secrets.js';
import { vibeCollector } from '../collectors/vibe.js';
import { npmAuditAdapter } from '../adapters/npmAudit.js';
import type { Adapter, ExecFn } from '../adapters/types.js';
import { llmReview, type LlmClient } from '../llm/reviewer.js';
import { loadFramework, defaultFrameworkPath } from './framework.js';
import { score } from './scoring.js';
import type { Finding, Report } from './types.js';

const COLLECTORS: Collector[] = [metadataCollector, secretsCollector, vibeCollector];
const ADAPTERS: Adapter[] = [npmAuditAdapter];

export interface AnalyzeOptions {
  rootDir: string;
  frameworkPath?: string;
  exec?: ExecFn;
  llmClient?: LlmClient | null;
  useTools?: boolean;
}

async function safe(label: string, fn: () => Promise<Finding[]>): Promise<Finding[]> {
  try {
    return await fn();
  } catch (err) {
    process.stderr.write(`[aim] layer "${label}" failed: ${(err as Error).message}\n`);
    return [];
  }
}

export async function analyze(opts: AnalyzeOptions): Promise<Report> {
  const ctx = buildContext(opts.rootDir);
  const framework = loadFramework(opts.frameworkPath ?? defaultFrameworkPath());
  const findings: Finding[] = [];

  for (const c of COLLECTORS) {
    findings.push(...await safe(c.name, () => c.collect(ctx)));
  }

  if (opts.useTools !== false && opts.exec) {
    for (const a of ADAPTERS) {
      if (a.isApplicable(ctx)) {
        findings.push(...await safe(a.name, () => a.run(ctx, opts.exec!)));
      }
    }
  }

  if (opts.llmClient) {
    findings.push(...await safe('llm', () => llmReview(ctx, opts.llmClient!)));
  }

  const report = score(framework, findings);

  const ranked = report.pillars
    .flatMap((p) => p.criteria)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  report.recommendations = ranked.map(
    (c) => `Improve ${c.title} (${c.criterionId}): ${c.evidence[0]?.note ?? 'low score'}`,
  );

  return report;
}
