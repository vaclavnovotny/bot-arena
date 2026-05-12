import type { DetectionBus } from '../lib/detection-bus';

interface RunArgs {
  window: Window;
  bus: DetectionBus;
}

export async function runLevel2({ window: win, bus }: RunArgs): Promise<void> {
  // 1. Driver-shim artefacts (legacy Selenium, stealth plugins, etc).
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

  // 2. Function.prototype.toString integrity (catches stealth plugins that patch toString to hide themselves).
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

  // 3. window.chrome surface area — real headed Chrome exposes chrome.app and chrome.csi
  //    in addition to chrome.runtime. Headless / CDP-only contexts typically miss app and csi.
  {
    const chrome = (win as unknown as { chrome?: Record<string, unknown> }).chrome;
    const hasApp = !!chrome && 'app' in chrome;
    const hasCsi = !!chrome && 'csi' in chrome;
    const ok = hasApp && hasCsi;
    bus.emit({
      id: 'chrome-surface',
      name: 'window.chrome exposes app + csi',
      status: ok ? 'pass' : 'fail',
      detail: `app=${hasApp}, csi=${hasCsi}`,
    });
  }

  // 4. Browser chrome height — real headed Chrome has visible toolbars/tabs so
  //    outerHeight is meaningfully larger than innerHeight. Headless Chrome / kiosk mode = 0.
  {
    const oh = win.outerHeight ?? 0;
    const ih = win.innerHeight ?? 0;
    const diff = oh - ih;
    const ok = diff >= 50;
    bus.emit({
      id: 'browser-chrome-height',
      name: 'Visible browser chrome (toolbars/tabs)',
      status: ok ? 'pass' : 'fail',
      detail: `outerHeight - innerHeight = ${diff}px (≥ 50 expected)`,
    });
  }

  // 5. Screen has taskbar/dock — real desktop OS reserves screen pixels for the
  //    OS chrome (taskbar on Windows/Linux, menu bar on macOS). Headless = no taskbar.
  {
    const ah = win.screen?.availHeight ?? 0;
    const h = win.screen?.height ?? 0;
    const ok = ah < h;
    bus.emit({
      id: 'screen-taskbar',
      name: 'Screen has taskbar/dock chrome',
      status: ok ? 'pass' : 'fail',
      detail: `availHeight=${ah}, height=${h}`,
    });
  }
}
