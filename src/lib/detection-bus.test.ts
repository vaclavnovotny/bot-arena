import { describe, it, expect, vi } from 'vitest';
import { createBus, type DetectionEvent } from './detection-bus';

describe('detection-bus', () => {
  it('emits events to subscribers with a timestamp', () => {
    const bus = createBus();
    const received: DetectionEvent[] = [];
    bus.on((e) => received.push(e));

    bus.emit({ id: 'a', name: 'A', status: 'pass' });

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe('a');
    expect(received[0].name).toBe('A');
    expect(received[0].status).toBe('pass');
    expect(typeof received[0].ts).toBe('number');
  });

  it('returns an unsubscribe function from on()', () => {
    const bus = createBus();
    const handler = vi.fn();
    const off = bus.on(handler);

    bus.emit({ id: 'a', name: 'A', status: 'pass' });
    off();
    bus.emit({ id: 'b', name: 'B', status: 'fail' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reset() fires a reset event to subscribers', () => {
    const bus = createBus();
    const onReset = vi.fn();
    bus.onReset(onReset);

    bus.emit({ id: 'a', name: 'A', status: 'pass' });
    bus.reset();

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('snapshot() returns all emitted events in order', () => {
    const bus = createBus();
    bus.emit({ id: 'a', name: 'A', status: 'pass' });
    bus.emit({ id: 'b', name: 'B', status: 'fail' });

    const snap = bus.snapshot();
    expect(snap.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('snapshot() returns empty array after reset()', () => {
    const bus = createBus();
    bus.emit({ id: 'a', name: 'A', status: 'pass' });
    bus.reset();
    expect(bus.snapshot()).toEqual([]);
  });
});
