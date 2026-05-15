import { describe, it, expect } from 'vitest';
import { externalDemos } from './externalDemos';

describe('externalDemos data module', () => {
  it('contains the odoo-spreadsheet entry', () => {
    expect(externalDemos.map((d) => d.id)).toContain('odoo-spreadsheet');
  });

  it('contains the business-one-google entry', () => {
    expect(externalDemos.map((d) => d.id)).toContain('business-one-google');
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
      // AIVA evidence is optional — entries shipped Playwright-first must
      // instead carry an aivaPendingNote so the page has *something* to
      // render in the AIVA slot. The step-by-step screenshot is its own
      // independently-optional pair (some demos have a video but no log).
      if (d.aivaVideoSrc) {
        expect(d.aivaVideoSrc).toMatch(/\.(mp4|webm)$/);
        expect(d.aivaVideoCaption?.length ?? 0).toBeGreaterThan(0);
      } else {
        expect(d.aivaPendingNote?.length ?? 0).toBeGreaterThan(0);
      }
      if (d.aivaStepsImageSrc) {
        expect(d.aivaStepsImageSrc).toMatch(/\.(png|jpg|jpeg|webp)$/);
        expect(d.aivaStepsCaption?.length ?? 0).toBeGreaterThan(0);
      }
      if (d.stills) {
        for (const s of d.stills) {
          expect(s.src).toMatch(/\.(png|jpg|jpeg|webp)$/);
          expect(s.caption.length).toBeGreaterThan(0);
        }
      }
      if (d.attempts) {
        const validWalls = ['fingerprint', 'recaptcha-anchor', 'recaptcha-image'];
        for (const a of d.attempts) {
          expect(a.letter.length).toBeGreaterThan(0);
          expect(a.name.length).toBeGreaterThan(0);
          expect(a.change.length).toBeGreaterThan(0);
          expect(validWalls).toContain(a.wall);
          expect(a.outcome.length).toBeGreaterThan(0);
          expect(a.sourceUrl).toMatch(/^https:\/\/github\.com\/.+\/blob\/.+/);
        }
      }
    }
  });
});
