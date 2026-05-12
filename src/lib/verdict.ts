import type { DetectionEvent } from './detection-bus';

export type Verdict =
  | { kind: 'pending'; failCount: 0; passCount: 0 }
  | { kind: 'human'; failCount: 0; passCount: number }
  | { kind: 'bot'; failCount: number; passCount: number };

export function computeVerdict(events: DetectionEvent[]): Verdict {
  let pass = 0;
  let fail = 0;
  for (const e of events) {
    if (e.status === 'pass') pass++;
    else if (e.status === 'fail') fail++;
  }
  if (pass === 0 && fail === 0) return { kind: 'pending', failCount: 0, passCount: 0 };
  if (fail === 0) return { kind: 'human', failCount: 0, passCount: pass };
  return { kind: 'bot', failCount: fail, passCount: pass };
}
