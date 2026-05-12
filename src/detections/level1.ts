import type { DetectionBus } from '../lib/detection-bus';

interface RunArgs {
  window: Window;
  bus: DetectionBus;
}

export async function runLevel1({ window: win, bus }: RunArgs): Promise<void> {
  // navigator.webdriver
  {
    const w = win.navigator.webdriver;
    const fail = w === true;
    bus.emit({
      id: 'webdriver',
      name: 'navigator.webdriver',
      status: fail ? 'fail' : 'pass',
      detail: `value: ${String(w)}`,
    });
  }

  // window.chrome.runtime
  {
    const chrome = (win as unknown as { chrome?: { runtime?: unknown } }).chrome;
    const ok = !!chrome && typeof chrome.runtime !== 'undefined';
    bus.emit({
      id: 'chrome-runtime',
      name: 'window.chrome.runtime present',
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'chrome.runtime is defined' : 'chrome or chrome.runtime missing',
    });
  }

  // navigator.plugins
  {
    const n = win.navigator.plugins?.length ?? 0;
    bus.emit({
      id: 'plugins',
      name: 'navigator.plugins.length > 0',
      status: n > 0 ? 'pass' : 'fail',
      detail: `plugins.length = ${n}`,
    });
  }

  // navigator.languages
  {
    const langs = win.navigator.languages ?? [];
    bus.emit({
      id: 'languages',
      name: 'navigator.languages non-empty',
      status: langs.length > 0 ? 'pass' : 'fail',
      detail: `languages = [${langs.join(', ')}]`,
    });
  }

  // UA
  {
    const ua = win.navigator.userAgent ?? '';
    const bad = ua.includes('HeadlessChrome');
    bus.emit({
      id: 'ua-headless',
      name: 'User-Agent free of HeadlessChrome',
      status: bad ? 'fail' : 'pass',
      detail: `UA: ${ua}`,
    });
  }

  // Notification.permission vs permissions.query inconsistency
  {
    try {
      const notif = (win as unknown as { Notification?: { permission: NotificationPermission } }).Notification;
      const perm = notif?.permission ?? 'default';
      const q = await win.navigator.permissions.query({ name: 'notifications' as PermissionName });
      const inconsistent = perm === 'denied' && q.state === 'granted';
      bus.emit({
        id: 'notif-permission',
        name: 'Notification permission consistency',
        status: inconsistent ? 'fail' : 'pass',
        detail: `Notification.permission=${perm}, permissions.query=${q.state}`,
      });
    } catch (err) {
      bus.emit({
        id: 'notif-permission',
        name: 'Notification permission consistency',
        status: 'info',
        detail: `unable to query: ${(err as Error).message}`,
      });
    }
  }
}
