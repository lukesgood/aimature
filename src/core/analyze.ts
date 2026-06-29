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
import { silentLogger, type Logger } from './logger.js';
import type { Finding, Report } from './types.js';

const COLLECTORS: Collector[] = [metadataCollector, secretsCollector, vibeCollector];
const ADAPTERS: Adapter[] = [npmAuditAdapter];

export interface AnalyzeOptions {
  rootDir: string;
  frameworkPath?: string;
  exec?: ExecFn;
  llmClient?: LlmClient | null;
  useTools?: boolean;
  /** Diagnostics sink. Defaults to a silent logger for library callers. */
  logger?: Logger;
}

async function safe(
  log: Logger,
  label: string,
  fn: () => Promise<Finding[]>,
): Promise<Finding[]> {
  try {
    const findings = await fn();
    log.debug(`layer "${label}" completed`, { layer: label, findings: findings.length });
    return findings;
  } catch (err) {
    log.warn(`layer "${label}" failed — its criteria will be uncovered`, {
      layer: label,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function analyze(opts: AnalyzeOptions): Promise<Report> {
  const log = opts.logger ?? silentLogger;
  const ctx = buildContext(opts.rootDir);
  const framework = loadFramework(opts.frameworkPath ?? defaultFrameworkPath());
  const findings: Finding[] = [];

  log.info('scan started', { rootDir: opts.rootDir, files: ctx.files.length });

  for (const c of COLLECTORS) {
    findings.push(...await safe(log, c.name, () => c.collect(ctx)));
  }

  if (opts.useTools !== false && opts.exec) {
    for (const a of ADAPTERS) {
      if (a.isApplicable(ctx)) {
        findings.push(...await safe(log, a.name, () => a.run(ctx, opts.exec!)));
      } else {
        log.debug(`adapter "${a.name}" not applicable — skipped`, { adapter: a.name });
      }
    }
  } else {
    log.debug('external tools disabled (Layer 2 skipped)');
  }

  if (opts.llmClient) {
    findings.push(...await safe(log, 'llm', () => llmReview(ctx, opts.llmClient!)));
  } else {
    log.debug('no LLM client configured (Layer 3 skipped)');
  }

  const report = score(framework, findings);

  const ranked = report.pillars
    .flatMap((p) => p.criteria)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  report.recommendations = ranked.map(
    (c) => `Improve ${c.title} (${c.criterionId}): ${c.evidence[0]?.note ?? 'low score'}`,
  );

  log.info('scan complete', {
    level: report.level,
    score: Math.round(report.overallScore * 10) / 10,
    uncovered: report.uncovered.length,
  });
  if (report.uncovered.length > 0) {
    log.warn(`${report.uncovered.length} criteria could not be measured`, {
      uncovered: report.uncovered,
    });
  }

  return report;
}
