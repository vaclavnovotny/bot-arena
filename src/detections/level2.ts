import type { DetectionBus } from '../lib/detection-bus';

interface RunArgs {
  window: Window;
  bus: DetectionBus;
}

export async function runLevel2({ window: win, bus }: RunArgs): Promise<void> {
  // 1. Driver-shim artefacts (legacy Selenium, but cheap).
  {
    const keys = Object.getOwnPropertyNames(win).filter(
      (k) => k.startsWith('cdc_') || k === '$cdc_asdjflasutopfhvcZLmcfl_' || k === 'webdriver'
    );
    bus.emit({
      id: 'driver-shims',
      name: 'No driver-shim properties on window',
      status: keys.length === 0 ? 'pass' : 'fail',
      detail: keys.length === 0 ? 'clean' : `found: ${keys.join(', ')}`,
    });
  }

  // 2. Function.prototype.toString integrity.
  {
    const fn = (win as unknown as { Function?: FunctionConstructor }).Function ?? Function;
    const s = fn.prototype.toString.toString();
    const isNative = /function toString\(\) \{ \[native code\] \}/.test(s);
    bus.emit({
      id: 'tostring-integrity',
      name: 'Function.prototype.toString is native',
      status: isNative ? 'pass' : 'fail',
      detail: isNative ? 'native impl' : 'toString has been replaced',
    });
  }

  // 3. Error.stack timing — heuristic; cheap to compute. CDP-attached contexts
  // tend to be measurably slower because the inspector materialises the stack
  // lazily. Threshold conservatively tuned — false positives are fine here.
  {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const obj: { stack?: string } = {};
      Object.defineProperty(obj, 'stack', {
        get() {
          return new Error().stack;
        },
      });
      const t0 = performance.now();
      void obj.stack;
      samples.push(performance.now() - t0);
    }
    const median = samples.slice().sort((a, b) => a - b)[2];
    const fail = median > 1.5;
    bus.emit({
      id: 'error-stack-timing',
      name: 'Error.stack getter timing (CDP heuristic)',
      status: fail ? 'fail' : 'pass',
      detail: `median ${median.toFixed(2)} ms (threshold 1.5)`,
    });
  }

  // 4. console.debug hijack heuristic — DevTools/CDP probes argument values;
  // we pass a getter and observe whether it fires.
  {
    let triggered = false;
    const arg = {
      get __probe__() {
        triggered = true;
        return undefined;
      },
    };
    // eslint-disable-next-line no-console
    const con = (win as unknown as { console?: Console }).console ?? console;
    con.debug(arg as unknown as string);
    bus.emit({
      id: 'console-debug-hijack',
      name: 'console.debug getter not invoked',
      status: triggered ? 'fail' : 'pass',
      detail: triggered ? 'DevTools/CDP appears to have probed the argument' : 'no probe',
    });
  }
}
