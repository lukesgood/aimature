import type {
  Framework, Finding, Report, PillarResult, CriterionResult, Evidence,
} from './types.js';

function mergeCriterion(findings: Finding[]): { score: number; confidence: number; evidence: Evidence[] } {
  const totalConf = findings.reduce((a, f) => a + f.confidence, 0);
  const weighted = totalConf > 0
    ? findings.reduce((a, f) => a + f.score * f.confidence, 0) / totalConf
    : 0;
  return {
    score: weighted,
    confidence: Math.max(...findings.map((f) => f.confidence)),
    evidence: findings.flatMap((f) => f.evidence),
  };
}

function levelForScore(framework: Framework, s: number): { level: string; label: string } {
  for (const band of framework.levels) {
    if (s >= band.min && (s < band.max || (band.max >= 100 && s <= 100))) {
      return { level: band.level, label: band.label };
    }
  }
  const last = framework.levels[framework.levels.length - 1];
  return { level: last.level, label: last.label };
}

export function score(framework: Framework, findings: Finding[]): Report {
  const byCriterion = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byCriterion.get(f.criterionId) ?? [];
    list.push(f);
    byCriterion.set(f.criterionId, list);
  }

  const uncovered: string[] = [];
  const criterionScores = new Map<string, number>();
  const pillars: PillarResult[] = [];

  for (const pillar of framework.pillars) {
    const covered: { c: CriterionResult; weight: number }[] = [];
    const criteriaResults: CriterionResult[] = [];

    for (const crit of pillar.criteria) {
      const fs = byCriterion.get(crit.id);
      if (!fs || fs.length === 0) {
        uncovered.push(crit.id);
        continue;
      }
      const merged = mergeCriterion(fs);
      criterionScores.set(crit.id, merged.score);
      const cr: CriterionResult = {
        criterionId: crit.id,
        title: crit.title,
        score: merged.score,
        confidence: merged.confidence,
        evidence: merged.evidence,
      };
      criteriaResults.push(cr);
      covered.push({ c: cr, weight: crit.weight });
    }

    const wsum = covered.reduce((a, x) => a + x.weight, 0);
    const pillarScore = wsum > 0
      ? covered.reduce((a, x) => a + x.c.score * x.weight, 0) / wsum
      : 0;

    pillars.push({
      id: pillar.id,
      title: pillar.title,
      score: pillarScore,
      measured: criteriaResults.length > 0,
      criteria: criteriaResults,
    });
  }

  const measured = framework.pillars.filter((p) => {
    const pr = pillars.find((x) => x.id === p.id)!;
    return pr.criteria.length > 0;
  });
  const totalWeight = measured.reduce((a, p) => a + p.weight, 0);
  const overallScore = totalWeight > 0
    ? measured.reduce((a, p) => {
        const pr = pillars.find((x) => x.id === p.id)!;
        return a + pr.score * p.weight;
      }, 0) / totalWeight
    : 0;

  let { level, label } = levelForScore(framework, overallScore);
  let cappedBy: string | undefined;
  const levelIndex = (lvl: string) => framework.levels.findIndex((b) => b.level === lvl);

  for (const gate of framework.gates) {
    const cs = criterionScores.get(gate.criterionId);
    if (cs !== undefined && cs < gate.whenScoreBelow) {
      if (levelIndex(gate.capLevel) < levelIndex(level)) {
        level = gate.capLevel;
        label = framework.levels[levelIndex(gate.capLevel)].label;
        cappedBy = gate.id;
      }
    }
  }

  return {
    overallScore,
    level,
    levelLabel: label,
    pillars,
    uncovered,
    recommendations: [],
    cappedBy,
  };
}
