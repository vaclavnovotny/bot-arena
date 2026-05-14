import { describe, it, expect } from 'vitest';
import { externalDemos } from './externalDemos';

describe('externalDemos data module', () => {
  it('contains the odoo-spreadsheet entry', () => {
    expect(externalDemos.map((d) => d.id)).toContain('odoo-spreadsheet');
  });

  it('every entry is fully populated', () => {
    expect(externalDemos.length).toBeGreaterThan(0);
    for (const d of externalDemos) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.category.length).toBeGreaterThan(0);
      expect(d.demoUrl).toMatch(/^https:\/\//);
      expect(d.goal.length).toBeGreaterThan(0);
      expect(d.steps.length).toBeGreaterThan(0);
      for (const s of d.steps) expect(s.length).toBeGreaterThan(0);
      expect(d.problem.length).toBeGreaterThan(0);
      expect(d.layers.length).toBeGreaterThan(0);
      for (const layer of d.layers) {
        expect(['reaches', 'fails', 'opaque']).toContain(layer.status);
        expect(layer.name.length).toBeGreaterThan(0);
        expect(layer.detail.length).toBeGreaterThan(0);
      }
      expect(d.aivaFootnote.length).toBeGreaterThan(0);
      expect(d.testCode.length).toBeGreaterThan(0);
      expect(d.failureLine.length).toBeGreaterThan(0);
      expect(d.videoSrc).toMatch(/\.webm$/);
      expect(d.posterSrc).toMatch(/\.(png|jpg|jpeg|webp)$/);
      expect(d.videoDuration.length).toBeGreaterThan(0);
      expect(d.aivaVideoSrc).toMatch(/\.(mp4|webm)$/);
      expect(d.aivaVideoCaption.length).toBeGreaterThan(0);
      expect(d.aivaStepsImageSrc).toMatch(/\.(png|jpg|jpeg|webp)$/);
      expect(d.aivaStepsCaption.length).toBeGreaterThan(0);
    }
  });
});
