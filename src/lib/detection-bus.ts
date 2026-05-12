export type DetectionStatus = 'pass' | 'fail' | 'info';

export interface DetectionEvent {
  id: string;
  name: string;
  status: DetectionStatus;
  detail?: string;
  ts: number;
}

export interface DetectionBus {
  emit(event: Omit<DetectionEvent, 'ts'>): void;
  on(handler: (e: DetectionEvent) => void): () => void;
  onReset(handler: () => void): () => void;
  reset(): void;
  snapshot(): DetectionEvent[];
}

export function createBus(): DetectionBus {
  const target = new EventTarget();
  let log: DetectionEvent[] = [];

  return {
    emit(e) {
      const full: DetectionEvent = {
        ...e,
        ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
      log.push(full);
      target.dispatchEvent(new CustomEvent('detection', { detail: full }));
    },
    on(handler) {
      const listener = (ev: Event) => {
        handler((ev as CustomEvent<DetectionEvent>).detail);
      };
      target.addEventListener('detection', listener);
      return () => target.removeEventListener('detection', listener);
    },
    onReset(handler) {
      const listener = () => handler();
      target.addEventListener('reset', listener);
      return () => target.removeEventListener('reset', listener);
    },
    reset() {
      log = [];
      target.dispatchEvent(new Event('reset'));
    },
    snapshot() {
      return log.slice();
    },
  };
}

declare global {
  interface Window {
    __bus?: DetectionBus;
  }
}
