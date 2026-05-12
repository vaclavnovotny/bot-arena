import { describe, it, expect } from 'vitest';
import { scoreTrajectory, scoreKeystrokes } from './level3';

describe('scoreTrajectory', () => {
  it('FAILs with zero intermediate moves', () => {
    expect(scoreTrajectory([]).verdict).toBe('fail');
  });

  it('FAILs with a single straight-line segment (zero curvature)', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: 0, t: i }));
    expect(scoreTrajectory(pts).verdict).toBe('fail');
  });

  it('PASSes with a curved trajectory of sufficient density', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({
      x: i * 8 + Math.sin(i / 3) * 12,
      y: i * 5 + Math.cos(i / 4) * 9,
      t: i * 6,
    }));
    expect(scoreTrajectory(pts).verdict).toBe('pass');
  });
});

describe('scoreKeystrokes', () => {
  it('FAILs when every interval is identical', () => {
    const ks = Array.from({ length: 8 }, (_, i) => ({ key: 'a', t: i * 50 }));
    expect(scoreKeystrokes(ks).verdict).toBe('fail');
  });

  it('FAILs when intervals are zero (simultaneous keydowns)', () => {
    const ks = Array.from({ length: 6 }, () => ({ key: 'a', t: 0 }));
    expect(scoreKeystrokes(ks).verdict).toBe('fail');
  });

  it('PASSes when intervals vary like a human typist', () => {
    const ks = [
      { key: 'h', t: 0 },
      { key: 'e', t: 142 },
      { key: 'l', t: 88 },
      { key: 'l', t: 109 },
      { key: 'o', t: 215 },
    ];
    expect(scoreKeystrokes(ks).verdict).toBe('pass');
  });
});
