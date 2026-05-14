import { describe, it, expect } from 'vitest';
import { externalDemos } from './externalDemos';

describe('externalDemos data module', () => {
  it('contains exactly the three v1 entries', () => {
    const ids = externalDemos.map((d) => d.id).sort();
    expect(ids).toEqual(['grafana', 'odoo', 'onshape']);
  });

  it('every entry is fully populated', () => {
    for (const d of externalDemos) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.category.length).toBeGreaterThan(0);
      expect(d.demoUrl).toMatch(/^https:\/\//);
      expect(d.useCase.length).toBeGreaterThan(0);
      expect(d.family).toBe('vision-only');
      expect(['read', 'click', 'drag']).toContain(d.failureShape);
      expect(d.naive.code.length).toBeGreaterThan(0);
      expect(d.naive.error.length).toBeGreaterThan(0);
      expect(d.bestEffort.code.length).toBeGreaterThan(0);
      expect(d.bestEffort.error.length).toBeGreaterThan(0);
      expect(d.bestEffort.reasonItStillFails.length).toBeGreaterThan(0);
      expect(d.whyItFails.length).toBeGreaterThan(0);
      expect(d.aivaContext.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a distinct failure shape (read / click / drag)', () => {
    const shapes = externalDemos.map((d) => d.failureShape).sort();
    expect(shapes).toEqual(['click', 'drag', 'read']);
  });
});
