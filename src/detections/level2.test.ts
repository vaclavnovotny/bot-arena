import { describe, it, expect } from 'vitest';
import { createBus } from '../lib/detection-bus';
import { runLevel2 } from './level2';

/** Build a fake Window with sensible "real headed Chrome" defaults; overrides apply on top. */
function fakeWin(
  over: Partial<{
    cdc: boolean;
    patchToString: boolean;
    chrome: Record<string, unknown> | null;
    outerHeight: number;
    innerHeight: number;
    availHeight: number;
    screenHeight: number;
  }> = {}
): Window {
  const base: Record<string, unknown> = {
    chrome:
      over.chrome === null
        ? undefined
        : over.chrome ?? { app: {}, csi: () => ({}), runtime: {}, loadTimes: () => ({}) },
    outerHeight: over.outerHeight ?? 900,
    innerHeight: over.innerHeight ?? 800,
    screen: { availHeight: over.availHeight ?? 1040, height: over.screenHeight ?? 1080 },
    console,
    Function,
  };
  if (over.cdc) base.cdc_adoQpoasnfa76pfcZLmcfl_Array = true;
  if (over.patchToString) {
    base.Function = function FakeFn() {} as unknown as FunctionConstructor;
    (base.Function as { prototype: { toString: () => string } }).prototype = {
      toString() {
        return 'function toString() { /* patched */ }';
      },
    };
  }
  return base as unknown as Window;
}

describe('runLevel2', () => {
  it('all PASS on a clean headed Chrome shape', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin(), bus });
    const events = bus.snapshot();
    expect(events.length).toBe(5);
    expect(events.every((e) => e.status === 'pass')).toBe(true);
  });

  it('driver-shim check FAILs when window.cdc_* is present', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ cdc: true }), bus });
    expect(bus.snapshot().some((e) => e.id === 'driver-shims' && e.status === 'fail')).toBe(true);
  });

  it('toString integrity FAILs when Function.prototype.toString has been replaced', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ patchToString: true }), bus });
    expect(bus.snapshot().some((e) => e.id === 'tostring-integrity' && e.status === 'fail')).toBe(true);
    // sanity: the real toString still works
    expect(Function.prototype.toString.call(parseInt)).toContain('native code');
  });

  it('chrome-surface FAILs when window.chrome lacks app or csi', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ chrome: { runtime: {} } }), bus });
    expect(bus.snapshot().some((e) => e.id === 'chrome-surface' && e.status === 'fail')).toBe(true);
  });

  it('chrome-surface FAILs when window.chrome is missing entirely', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ chrome: null }), bus });
    expect(bus.snapshot().some((e) => e.id === 'chrome-surface' && e.status === 'fail')).toBe(true);
  });

  it('browser-chrome-height FAILs when outerHeight equals innerHeight (headless tell)', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ outerHeight: 800, innerHeight: 800 }), bus });
    expect(bus.snapshot().some((e) => e.id === 'browser-chrome-height' && e.status === 'fail')).toBe(true);
  });

  it('browser-chrome-height PASSes when outerHeight - innerHeight >= 50px', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ outerHeight: 900, innerHeight: 800 }), bus });
    expect(bus.snapshot().some((e) => e.id === 'browser-chrome-height' && e.status === 'pass')).toBe(true);
  });

  it('screen-taskbar FAILs when availHeight equals height (no taskbar)', async () => {
    const bus = createBus();
    await runLevel2({ window: fakeWin({ availHeight: 1080, screenHeight: 1080 }), bus });
    expect(bus.snapshot().some((e) => e.id === 'screen-taskbar' && e.status === 'fail')).toBe(true);
  });
});
