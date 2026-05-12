import { describe, it, expect } from 'vitest';
import { computeVerdict } from './verdict';
import type { DetectionEvent } from './detection-bus';

function ev(status: DetectionEvent['status'], id = 's'): DetectionEvent {
  return { id, name: id, status, ts: 0 };
}

describe('computeVerdict', () => {
  it('is "pending" when no actionable signals fired yet', () => {
    expect(computeVerdict([])).toEqual({ kind: 'pending', failCount: 0, passCount: 0 });
  });

  it('counts only pass/fail (ignores info)', () => {
    const events = [ev('pass', 'a'), ev('info', 'b'), ev('fail', 'c')];
    expect(computeVerdict(events)).toEqual({ kind: 'bot', failCount: 1, passCount: 1 });
  });

  it('is "human" when all signals passed', () => {
    expect(computeVerdict([ev('pass', 'a'), ev('pass', 'b')])).toEqual({
      kind: 'human',
      failCount: 0,
      passCount: 2,
    });
  });

  it('is "bot" when any signal failed', () => {
    expect(computeVerdict([ev('pass', 'a'), ev('fail', 'b')])).toEqual({
      kind: 'bot',
      failCount: 1,
      passCount: 1,
    });
  });
});
