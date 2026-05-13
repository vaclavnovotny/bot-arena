import { describe, it, expect } from 'vitest';
import { surfaces, resolveLevel, deriveVerdicts } from './surfaces';

describe('surfaces data module', () => {
  it('every LevelRef resolves to a real level', () => {
    for (const surface of surfaces) {
      for (const ref of surface.levels) {
        expect(() => resolveLevel(ref)).not.toThrow();
      }
    }
  });

  it('deriveVerdicts produces well-typed output for every referenced level', () => {
    for (const surface of surfaces) {
      for (const ref of surface.levels) {
        const level = resolveLevel(ref);
        const result = deriveVerdicts(level);

        expect(['impossible', 'possible']).toContain(result.playwright.verdict);
        expect([1, 2, 3, 4, 5]).toContain(result.playwright.effort);
        expect(['native', 'needs-fix']).toContain(result.aiva.verdict);
        expect([1, 2, 3, 4, 5]).toContain(result.aiva.effort);
      }
    }
  });
});
