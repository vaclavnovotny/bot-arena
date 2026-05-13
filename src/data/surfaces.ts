import { type LevelReport, levels } from './levels';

export type Family =
  | 'cross-origin'
  | 'vendor-challenge'
  | 'fingerprinting'
  | 'behavioural'
  | 'vision-only'
  | 'dynamic-selectors'
  | 'windowed-dom';

export type LevelRef = { section: 'bd' | 'sr'; n: number };

export interface Surface {
  id: string;
  title: string;
  family: Family;
  examples: string;
  levels: LevelRef[];
  expanded: string;
  playwright: {
    verdict: 'impossible' | 'possible';
    effort: 1 | 2 | 3 | 4 | 5;
  };
  aiva: {
    verdict: 'native' | 'needs-fix';
    effort: 1 | 2 | 3 | 4 | 5;
  };
}

/** Look up a level by its LevelRef. */
export function resolveLevel(ref: LevelRef): LevelReport {
  const sectionName: LevelReport['section'] =
    ref.section === 'bd' ? 'Bot detection' : 'Selector resistance';
  const level = levels.find((l) => l.section === sectionName && l.n === ref.n);
  if (!level) {
    throw new Error(`Surface references unknown level: ${ref.section.toUpperCase()}-${ref.n}`);
  }
  return level;
}

/** Map a LevelReport to the playwright/aiva slice of a Surface. */
export function deriveVerdicts(level: LevelReport): Pick<Surface, 'playwright' | 'aiva'> {
  const pwEffort: 1 | 2 | 3 | 4 | 5 =
    level.playwright.kind === 'fixable' ? level.playwright.difficulty : 5;

  if (level.aiva.passes) {
    return {
      playwright: {
        verdict: level.playwright.kind === 'impossible' ? 'impossible' : 'possible',
        effort: pwEffort,
      },
      aiva: { verdict: 'native', effort: 1 },
    };
  }

  const fixes = level.aiva.fixes ?? [];
  if (fixes.length === 0) {
    throw new Error(`Level ${level.section} ${level.n} has passes=false but no fixes`);
  }
  const minEffort = Math.min(
    ...fixes.map((f) => (f.kind === 'fixable' ? f.difficulty : 5)),
  ) as 1 | 2 | 3 | 4 | 5;

  return {
    playwright: {
      verdict: level.playwright.kind === 'impossible' ? 'impossible' : 'possible',
      effort: pwEffort,
    },
    aiva: { verdict: 'needs-fix', effort: minEffort },
  };
}

export const surfaces: Surface[] = [];
