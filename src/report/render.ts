import type { Report } from '../core/types.js';

export function renderJson(r: Report): string {
  return JSON.stringify(r, null, 2);
}

export function renderMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`# AIMature Report`);
  lines.push('');
  lines.push(`**Maturity Level:** ${r.level} — ${r.levelLabel}`);
  lines.push(`**Overall Score:** ${r.overallScore.toFixed(1)} / 100`);
  if (r.cappedBy) lines.push(`> ⚠️ Level capped by gate \`${r.cappedBy}\`.`);
  lines.push('');
  lines.push('## Pillars');
  lines.push('');
  lines.push('| Pillar | Score |');
  lines.push('|---|---|');
  for (const p of r.pillars) lines.push(`| ${p.title} | ${p.measured === false ? 'n/a (not measured)' : p.score.toFixed(1)} |`);
  lines.push('');
  for (const p of r.pillars) {
    lines.push(`### ${p.title}`);
    for (const c of p.criteria) {
      lines.push(`- **${c.title}** (${c.criterionId}): ${c.score.toFixed(1)} _(confidence ${c.confidence.toFixed(2)})_`);
      for (const e of c.evidence) {
        lines.push(`  - ${e.file}${e.line ? ':' + e.line : ''} — ${e.note}`);
      }
    }
    lines.push('');
  }
  if (r.uncovered.length) {
    lines.push('## Uncovered (not measured)');
    for (const u of r.uncovered) lines.push(`- ${u}`);
    lines.push('');
  }
  if (r.recommendations.length) {
    lines.push('## Recommendations');
    for (const rec of r.recommendations) lines.push(`- ${rec}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderTerminal(r: Report): string {
  const lines: string[] = [];
  lines.push(`AIMature: ${r.level} (${r.levelLabel})  score ${r.overallScore.toFixed(1)}/100`);
  if (r.cappedBy) lines.push(`  [capped by ${r.cappedBy}]`);
  for (const p of r.pillars) lines.push(`  ${p.title.padEnd(28)} ${p.measured === false ? 'n/a' : p.score.toFixed(1)}`);
  if (r.uncovered.length) lines.push(`  uncovered: ${r.uncovered.join(', ')}`);
  return lines.join('\n');
}
