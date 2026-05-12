import type { DetectionBus } from '../lib/detection-bus';

export interface MovePt {
  x: number;
  y: number;
  t: number;
}

export interface KeyPt {
  key: string;
  t: number;
}

export interface Score {
  verdict: 'pass' | 'fail';
  detail: string;
}

export function scoreTrajectory(points: MovePt[]): Score {
  if (points.length < 5) {
    return { verdict: 'fail', detail: `only ${points.length} mousemove points (need ≥5)` };
  }
  let path = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    path += Math.hypot(dx, dy);
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
  const ratio = path / diag;

  if (ratio < 1.005) {
    return { verdict: 'fail', detail: `path/diagonal ratio ${ratio.toFixed(3)} (≈ straight line)` };
  }
  return { verdict: 'pass', detail: `${points.length} points, path/diag ratio ${ratio.toFixed(2)}` };
}

export function scoreKeystrokes(keys: KeyPt[]): Score {
  if (keys.length < 3) {
    return { verdict: 'pass', detail: `only ${keys.length} keystrokes (not enough to judge)` };
  }
  const intervals: number[] = [];
  for (let i = 1; i < keys.length; i++) intervals.push(keys[i].t - keys[i - 1].t);

  if (intervals.every((d) => d === 0)) {
    return { verdict: 'fail', detail: 'all keystrokes registered simultaneously' };
  }
  const allEqual = intervals.every((d) => d === intervals[0]);
  if (allEqual) {
    return { verdict: 'fail', detail: `every interval = ${intervals[0]} ms` };
  }
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  const cv = Math.sqrt(variance) / Math.max(mean, 1);
  if (cv < 0.05) {
    return { verdict: 'fail', detail: `cv ${cv.toFixed(3)} (too uniform)` };
  }
  return { verdict: 'pass', detail: `${keys.length} keystrokes, cv ${cv.toFixed(2)}` };
}

interface RunArgs {
  window: Window;
  bus: DetectionBus;
}

export function attachLevel3({ window: win, bus }: RunArgs): () => void {
  const moves: MovePt[] = [];
  const keys: KeyPt[] = [];

  const onMove = (e: MouseEvent) => moves.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  const onKey = (e: KeyboardEvent) => keys.push({ key: e.key, t: performance.now() });
  const onSubmit = (e: Event) => {
    const trj = scoreTrajectory(moves);
    bus.emit({
      id: 'mouse-trajectory',
      name: 'Mouse trajectory shape',
      status: trj.verdict,
      detail: trj.detail,
    });
    const ks = scoreKeystrokes(keys);
    bus.emit({
      id: 'keystroke-cadence',
      name: 'Keystroke cadence',
      status: ks.verdict,
      detail: ks.detail,
    });
    void e;
  };

  win.addEventListener('mousemove', onMove, { passive: true });
  win.addEventListener('keydown', onKey, { passive: true });
  win.document.addEventListener('submit', onSubmit, true);

  bus.emit({
    id: 'level3-armed',
    name: 'Trajectory recorder armed',
    status: 'info',
    detail: 'move the mouse and submit the form to score',
  });

  return () => {
    win.removeEventListener('mousemove', onMove);
    win.removeEventListener('keydown', onKey);
    win.document.removeEventListener('submit', onSubmit, true);
    moves.length = 0;
    keys.length = 0;
  };
}
