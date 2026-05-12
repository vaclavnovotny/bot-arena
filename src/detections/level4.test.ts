import { describe, it, expect } from 'vitest';
import { checkRenderer, fontProbeVerdict } from './level4';

describe('checkRenderer', () => {
  it('PASSes on real GPU strings', () => {
    expect(checkRenderer('Intel Iris Xe Graphics').status).toBe('pass');
    expect(checkRenderer('NVIDIA GeForce RTX 4070').status).toBe('pass');
  });

  it('FAILs on SwiftShader', () => {
    expect(checkRenderer('Google SwiftShader').status).toBe('fail');
  });

  it('FAILs on Mesa OffScreen', () => {
    expect(checkRenderer('Mesa OffScreen').status).toBe('fail');
  });

  it('returns info when string is empty/unknown', () => {
    expect(checkRenderer('').status).toBe('info');
  });
});

describe('fontProbeVerdict', () => {
  it('PASSes when the UA-expected font is present', () => {
    expect(
      fontProbeVerdict({ ua: 'Windows', presentFonts: ['Arial Black', 'Segoe UI Emoji'] }).status
    ).toBe('pass');
  });

  it('FAILs when none of the expected fonts are present', () => {
    expect(
      fontProbeVerdict({ ua: 'Windows', presentFonts: ['DejaVu Sans'] }).status
    ).toBe('fail');
  });
});
