import { describe, it, expect } from 'vitest';
import { createBus } from '../lib/detection-bus';
import { runLevel2 } from './level2';

describe('runLevel2', () => {
  it('toString integrity PASSes when Function.prototype.toString is native', async () => {
    const bus = createBus();
    await runLevel2({ window: globalThis as unknown as Window, bus });
    const tostr = bus.snapshot().find((e) => e.id === 'tostring-integrity');
    expect(tostr).toBeDefined();
    expect(tostr!.status).toBe('pass');
  });

  it('driver-shim check FAILs when window.cdc_* is present', async () => {
    const fake = Object.create(null);
    fake.cdc_adoQpoasnfa76pfcZLmcfl_Array = true;
    const bus = createBus();
    await runLevel2({ window: fake as Window, bus });
    expect(bus.snapshot().some((e) => e.id === 'driver-shims' && e.status === 'fail')).toBe(true);
  });

  it('toString integrity FAILs when Function.prototype.toString has been replaced', async () => {
    const native = Function.prototype.toString;
    const fakeWin = Object.create(globalThis) as Record<string, unknown>;
    fakeWin.Function = function FakeFn() {} as unknown as FunctionConstructor;
    (fakeWin.Function as { prototype: { toString: () => string } }).prototype = {
      toString() {
        return 'function toString() { /* patched */ }';
      },
    };
    const bus = createBus();
    await runLevel2({ window: fakeWin as unknown as Window, bus });
    expect(bus.snapshot().some((e) => e.id === 'tostring-integrity' && e.status === 'fail')).toBe(true);
    // sanity: real one still works
    expect(native.call(parseInt)).toContain('native code');
  });
});
