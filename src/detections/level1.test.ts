import { describe, it, expect } from 'vitest';
import { createBus, type DetectionEvent } from '../lib/detection-bus';
import { runLevel1 } from './level1';

function fakeWindow(over: Partial<{
  webdriver: boolean | undefined;
  chrome: unknown;
  plugins: number;
  languages: string[];
  ua: string;
  notificationPermission: NotificationPermission;
  permissionsState: PermissionState;
}> = {}): Window {
  const navigator = {
    webdriver: 'webdriver' in over ? over.webdriver : false,
    plugins: { length: over.plugins ?? 3 },
    languages: over.languages ?? ['en-US', 'en'],
    userAgent: over.ua ?? 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
    permissions: {
      query: async () => ({ state: over.permissionsState ?? 'prompt' }),
    },
  };
  return {
    navigator,
    chrome: 'chrome' in over ? over.chrome : { runtime: {} },
    Notification: { permission: over.notificationPermission ?? 'default' },
  } as unknown as Window;
}

describe('runLevel1', () => {
  it('all PASS on a clean headed Chrome shape', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow(), bus });
    const events = bus.snapshot();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e: DetectionEvent) => e.status === 'pass')).toBe(true);
  });

  it('FAILs when navigator.webdriver is true', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow({ webdriver: true }), bus });
    expect(bus.snapshot().some((e) => e.id === 'webdriver' && e.status === 'fail')).toBe(true);
  });

  it('FAILs when window.chrome is missing', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow({ chrome: undefined }), bus });
    expect(bus.snapshot().some((e) => e.id === 'chrome-runtime' && e.status === 'fail')).toBe(true);
  });

  it('FAILs when plugins.length is 0', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow({ plugins: 0 }), bus });
    expect(bus.snapshot().some((e) => e.id === 'plugins' && e.status === 'fail')).toBe(true);
  });

  it('FAILs when languages is empty', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow({ languages: [] }), bus });
    expect(bus.snapshot().some((e) => e.id === 'languages' && e.status === 'fail')).toBe(true);
  });

  it('FAILs when UA contains HeadlessChrome', async () => {
    const bus = createBus();
    await runLevel1({ window: fakeWindow({ ua: 'Mozilla/5.0 HeadlessChrome/120' }), bus });
    expect(bus.snapshot().some((e) => e.id === 'ua-headless' && e.status === 'fail')).toBe(true);
  });

  it('FAILs on notification/permission inconsistency', async () => {
    const bus = createBus();
    await runLevel1({
      window: fakeWindow({ notificationPermission: 'denied', permissionsState: 'granted' }),
      bus,
    });
    expect(bus.snapshot().some((e) => e.id === 'notif-permission' && e.status === 'fail')).toBe(true);
  });
});
