import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding, type Evidence } from '../core/types.js';

const CODE = /\.[jt]sx?$|\.py$/;
const MARKER = /\b(TODO|FIXME|XXX)\b|example\.com|your-api-key|changeme/i;
const INDENT = /^([ \t])/;

export const vibeCollector: Collector = {
  name: 'vibe',
  async collect(ctx: CollectorContext): Promise<Finding[]> {
    const codeFiles = ctx.files.filter((f) => CODE.test(f));
    const evidence: Evidence[] = [];
    let markers = 0;
    let tabFiles = 0;
    let spaceFiles = 0;

    for (const file of codeFiles) {
      const lines = ctx.readText(file).split('\n');
      let tabs = 0, spaces = 0;
      lines.forEach((line, i) => {
        if (MARKER.test(line)) {
          markers++;
          if (evidence.length < 5) evidence.push({ file, line: i + 1, note: 'Placeholder/TODO marker' });
        }
        const m = INDENT.exec(line);
        if (m) { if (m[1] === '\t') tabs++; else spaces++; }
      });
      if (tabs > spaces) tabFiles++; else if (spaces > tabs) spaceFiles++;
    }

    const density = codeFiles.length > 0 ? Math.round((markers / codeFiles.length) * 10) : 0;
    const convScore = Math.max(20, 90 - density * 10);

    const totalIndent = tabFiles + spaceFiles;
    const dominant = totalIndent === 0 ? 1 : Math.max(tabFiles, spaceFiles) / totalIndent;
    const structScore = dominant > 0.8 ? 80 : 50;

    const out: Finding[] = [];
    out.push(makeFinding({
      criterionId: 'maint.conventions',
      score: convScore,
      confidence: 0.5,
      source: 'heuristic',
      evidence: evidence.length ? evidence : [{ file: '(repo)', note: 'No placeholder markers found' }],
    }));
    out.push(makeFinding({
      criterionId: 'maint.structure',
      score: structScore,
      confidence: 0.5,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: `Indent consistency ${(dominant * 100).toFixed(0)}%` }],
    }));
    return out;
  },
};
