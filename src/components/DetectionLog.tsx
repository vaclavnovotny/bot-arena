import { useEffect, useState } from 'preact/hooks';
import type { DetectionBus, DetectionEvent } from '../lib/detection-bus';
import { computeVerdict } from '../lib/verdict';

function fmtTs(ms: number): string {
  const d = new Date(performance.timeOrigin + ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mss = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mss}`;
}

function statusBadge(status: DetectionEvent['status']): string {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-800';
  if (status === 'fail') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export function DetectionLog() {
  const [events, setEvents] = useState<DetectionEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__bus) return;
    const bus: DetectionBus = window.__bus;
    setEvents(bus.snapshot());
    const offEvent = bus.on((e) => setEvents((prev) => [...prev, e]));
    const offReset = bus.onReset(() => setEvents([]));
    return () => {
      offEvent();
      offReset();
    };
  }, []);

  const verdict = computeVerdict(events);

  let pillText = 'Awaiting signals…';
  let pillClass = 'bg-slate-200 text-slate-700';
  if (verdict.kind === 'human') {
    pillText = `Looks human · ${verdict.passCount} signals passed`;
    pillClass = 'bg-emerald-600 text-white';
  } else if (verdict.kind === 'bot') {
    pillText = `Bot suspected · ${verdict.failCount} failed signal${verdict.failCount === 1 ? '' : 's'}`;
    pillClass = 'bg-rose-600 text-white';
  }

  return (
    <aside class="flex w-[360px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header class="border-b border-slate-200 p-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detection Log
        </div>
        <div class={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${pillClass}`}>
          {pillText}
        </div>
      </header>
      <div class="h-[480px] overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {events.length === 0 && (
          <p class="text-slate-400">No signals yet — interact with the page.</p>
        )}
        {events.map((e) => (
          <div key={`${e.id}-${e.ts}`} class="mb-1 flex items-start gap-2" title={e.detail ?? ''}>
            <span class="shrink-0 text-slate-400">[{fmtTs(e.ts)}]</span>
            <span class={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(e.status)}`}>
              {e.status}
            </span>
            <span class="text-slate-800">{e.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
