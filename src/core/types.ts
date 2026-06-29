export type Source = 'heuristic' | 'tool' | 'llm';

export interface Evidence {
  file: string;
  line?: number;
  note: string;
}

export interface Finding {
  criterionId: string;
  score: number;        // 0-100
  evidence: Evidence[];
  confidence: number;   // 0-1
  source: Source;
}

export interface Criterion {
  id: string;
  title: string;
  pillarId: string;
  weight: number;       // relative weight within its pillar
}

export interface Pillar {
  id: string;
  title: string;
  weight: number;       // 0-1, pillars sum to 1
  criteria: Criterion[];
}

export interface GateRule {
  id: string;
  criterionId: string;
  whenScoreBelow: number;
  capLevel: string;     // e.g. 'L1'
  description: string;
}

export interface LevelBand {
  level: string;        // 'L0'..'L4'
  min: number;
  max: number;
  label: string;
}

export interface Framework {
  pillars: Pillar[];
  levels: LevelBand[];
  gates: GateRule[];
}

export interface CriterionResult {
  criterionId: string;
  title: string;
  score: number;
  confidence: number;
  evidence: Evidence[];
}

export interface PillarResult {
  id: string;
  title: string;
  score: number;
  measured?: boolean;   // false when the pillar had no covered criteria
  criteria: CriterionResult[];
}

export interface Report {
  overallScore: number;
  level: string;
  levelLabel: string;
  pillars: PillarResult[];
  uncovered: string[];
  recommendations: string[];
  cappedBy?: string;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export function makeFinding(input: {
  criterionId: string;
  score: number;
  confidence: number;
  source: Source;
  evidence?: Evidence[];
}): Finding {
  return {
    criterionId: input.criterionId,
    score: clamp(input.score, 0, 100),
    confidence: clamp(input.confidence, 0, 1),
    source: input.source,
    evidence: input.evidence ?? [],
  };
}
