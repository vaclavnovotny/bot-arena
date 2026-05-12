# Bot Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bot-arena public demo site at `jhero.app` per `docs/superpowers/specs/2026-05-12-bot-arena-design.md` — five level pages, a shared Detection Log panel, one Turnstile-verification server endpoint, deployed via Cloudflare Pages.

**Architecture:** Astro 5 MPA, one static page per level, single Preact island for the Detection Log, single SSR endpoint for Turnstile verification. Detection logic in pure-TS modules each level page imports; a per-page event bus (`window.__bus`) is the shared comm channel between detection scripts and the island. Deployed to Cloudflare Pages with `@astrojs/cloudflare`.

**Tech Stack:** Astro 5, Preact, TypeScript, Tailwind CSS v4 (Vite plugin), Vitest + jsdom for unit tests, `@astrojs/cloudflare` adapter, Cloudflare Turnstile (managed mode), Cloudflare Pages for hosting.

**Repo policy:** This repo is pre-authorised for commit AND push to `main` after each task. Use `git push` at the end of every task's commit step.

---

## File Structure

```
bot-arena/
├─ README.md                                  Task 5
├─ .gitignore                                 Task 5
├─ package.json                               Tasks 1-4
├─ tsconfig.json                              Task 1
├─ astro.config.mjs                           Tasks 1-3
├─ vitest.config.ts                           Task 4
├─ src/
│  ├─ env.d.ts                                Task 1
│  ├─ styles/global.css                       Task 2
│  ├─ lib/
│  │  ├─ detection-bus.ts                     Task 6
│  │  ├─ detection-bus.test.ts                Task 6
│  │  ├─ verdict.ts                           Task 7
│  │  └─ verdict.test.ts                      Task 7
│  ├─ components/
│  │  ├─ DetectionLog.tsx                     Task 8
│  │  ├─ LevelLayout.astro                    Task 9
│  │  └─ LoginForm.astro                      Task 10
│  ├─ detections/
│  │  ├─ level1.ts + level1.test.ts           Task 13
│  │  ├─ level2.ts + level2.test.ts           Task 14
│  │  ├─ level3.ts + level3.test.ts           Task 15
│  │  ├─ level4.ts + level4.test.ts           Task 16
│  │  └─ level5.ts                            Task 17 (no unit test — depends on widget)
│  └─ pages/
│     ├─ index.astro                          Task 11
│     ├─ about.astro                          Task 12
│     ├─ level/
│     │  ├─ 1.astro                           Task 13
│     │  ├─ 2.astro                           Task 14
│     │  ├─ 3.astro                           Task 15
│     │  ├─ 4.astro                           Task 16
│     │  └─ 5.astro                           Task 17
│     └─ api/turnstile/
│        └─ verify.ts                         Task 17
└─ .env.example                               Task 17
```

---

## Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/env.d.ts`

- [ ] **Step 1: Initialise npm package**

Run in `C:\Users\ganz\github\bot-arena`:

```bash
npm init -y
```

- [ ] **Step 2: Install Astro + Preact + Cloudflare adapter + TypeScript**

```bash
npm install astro@^5 @astrojs/preact @astrojs/cloudflare preact
npm install --save-dev typescript @types/node
```

- [ ] **Step 3: Write `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [preact()],
  site: 'https://jhero.app',
});
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["astro/client"]
  },
  "include": ["src/**/*", "astro.config.mjs"]
}
```

- [ ] **Step 5: Write `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
```

- [ ] **Step 6: Add npm scripts to `package.json`**

Edit `package.json` `"scripts"` to:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  }
}
```

- [ ] **Step 7: Verify build works (empty project)**

```bash
mkdir -p src/pages
echo "<h1>placeholder</h1>" > src/pages/index.astro
npm run build
```

Expected: completes without errors; `dist/` contains `index.html`.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "chore: scaffold Astro 5 + Preact + Cloudflare adapter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 2: Add Tailwind CSS v4

**Files:**
- Modify: `astro.config.mjs`
- Create: `src/styles/global.css`

- [ ] **Step 1: Install Tailwind v4 Vite plugin**

```bash
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update `astro.config.mjs` to register the Tailwind Vite plugin**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [preact()],
  site: 'https://jhero.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Create `src/styles/global.css`**

```css
@import "tailwindcss";

:root {
  color-scheme: light;
}

body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 4: Wire the stylesheet into `src/pages/index.astro` as a smoke test**

```astro
---
import '../styles/global.css';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Bot Arena</title>
  </head>
  <body class="min-h-screen bg-slate-50 text-slate-900">
    <main class="mx-auto max-w-3xl p-8">
      <h1 class="text-3xl font-bold">Bot Arena</h1>
      <p class="mt-2 text-slate-600">scaffold ok</p>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Run dev and confirm styling renders**

```bash
npm run dev
```

Open `http://localhost:4321/`. Expected: heading is bold and large, page has slate-50 background. Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: add Tailwind v4 + global stylesheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 3: Make the Turnstile endpoint route SSR-ready

**Files:**
- No file changes yet; just confirm Cloudflare adapter handles the `output: 'static'` + per-route `prerender = false` pattern Astro uses for hybrid builds.

- [ ] **Step 1: Sanity-check the adapter works with a stub server route**

Create `src/pages/api/_ping.ts`:

```ts
export const prerender = false;

export const GET = () => new Response('pong', { status: 200 });
```

- [ ] **Step 2: Build and verify the route is emitted as a Worker function**

```bash
npm run build
```

Expected: build succeeds. `dist/_worker.js/` contains generated worker code. (Astro + `@astrojs/cloudflare` lifts non-prerendered routes into the worker bundle.)

- [ ] **Step 3: Remove the stub**

```bash
rm src/pages/api/_ping.ts
```

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "chore: verify hybrid SSR route emission with Cloudflare adapter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 4: Add Vitest for unit tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script + deps)

- [ ] **Step 1: Install Vitest and jsdom**

```bash
npm install --save-dev vitest jsdom @types/jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 3: Add `test` script to `package.json`**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a trivial sanity test**

Create `src/lib/_sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs in jsdom and has window', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 6: Remove the sanity test**

```bash
rm src/lib/_sanity.test.ts
```

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "chore: add Vitest with jsdom environment

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 5: README and .gitignore

**Files:**
- Create: `README.md`, `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
.astro/
.wrangler/
.env
.env.local
.DS_Store
*.log
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Bot Arena

A public demo site at [jhero.app](https://jhero.app) that showcases five layered anti-bot detections firing in real time as browser automation interacts with the page. Built as a sales-demo asset for the AIVA automation product.

## What it demonstrates

The site has five level pages, each exercising a different detection technique:

1. **Webdriver tells** — `navigator.webdriver`, missing `chrome.runtime`, headless UA hints.
2. **CDP attached** — Function/`Error.stack` integrity, driver-shim artefacts.
3. **Mouse trajectory** — `mousemove` density and curvature, keystroke cadence.
4. **Fingerprint battery** — canvas, audio, font, and WebGL signals.
5. **Cloudflare Turnstile** — managed-mode widget + server-side verification.

On every page a **Detection Log panel** reports each signal as it fires, color-coded. A "Reset demo" button re-arms the detections so the demo can be run repeatedly.

The site is **target-only** — it does not run any automation itself. During a sales call the presenter points two browser sessions at the same level page (one driven by Playwright/CDP, one driven by VNC over a real headed Chrome) and the audience watches the Detection Log diverge.

## Stack

- Astro 5 (static-first MPA, one Preact island for the Detection Log)
- Tailwind CSS v4
- TypeScript
- Cloudflare Pages + one Pages Function for Turnstile token verification
- Vitest + jsdom for unit tests

## Development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build
npm test
```

## Design

See [`docs/superpowers/specs/2026-05-12-bot-arena-design.md`](docs/superpowers/specs/2026-05-12-bot-arena-design.md) for the full design.
```

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "docs: add README and .gitignore

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 6: Detection event bus

The bus is the shared comm channel between (a) detection scripts that run in the page and (b) the Preact `DetectionLog` island. It's attached to `window.__bus` so both can reach it.

**Files:**
- Create: `src/lib/detection-bus.ts`
- Test: `src/lib/detection-bus.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/detection-bus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: 5 failures (module not found).

- [ ] **Step 3: Implement the bus**

`src/lib/detection-bus.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: 5 passed.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat(lib): add detection event bus

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 7: Verdict aggregator

Reduces a list of detection events to a verdict pill ("Looks human" / "Bot suspected: N signals").

**Files:**
- Create: `src/lib/verdict.ts`
- Test: `src/lib/verdict.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/verdict.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeVerdict } from './verdict';
import type { DetectionEvent } from './detection-bus';

function ev(status: DetectionEvent['status'], id = 's'): DetectionEvent {
  return { id, name: id, status, ts: 0 };
}

describe('computeVerdict', () => {
  it('is "pending" when no actionable signals fired yet', () => {
    expect(computeVerdict([])).toEqual({ kind: 'pending', failCount: 0, passCount: 0 });
  });

  it('counts only pass/fail (ignores info)', () => {
    const events = [ev('pass', 'a'), ev('info', 'b'), ev('fail', 'c')];
    expect(computeVerdict(events)).toEqual({ kind: 'bot', failCount: 1, passCount: 1 });
  });

  it('is "human" when all signals passed', () => {
    expect(computeVerdict([ev('pass', 'a'), ev('pass', 'b')])).toEqual({
      kind: 'human',
      failCount: 0,
      passCount: 2,
    });
  });

  it('is "bot" when any signal failed', () => {
    expect(computeVerdict([ev('pass', 'a'), ev('fail', 'b')])).toEqual({
      kind: 'bot',
      failCount: 1,
      passCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test
```

Expected: 4 failures.

- [ ] **Step 3: Implement `verdict.ts`**

```ts
import type { DetectionEvent } from './detection-bus';

export type Verdict =
  | { kind: 'pending'; failCount: 0; passCount: 0 }
  | { kind: 'human'; failCount: 0; passCount: number }
  | { kind: 'bot'; failCount: number; passCount: number };

export function computeVerdict(events: DetectionEvent[]): Verdict {
  let pass = 0;
  let fail = 0;
  for (const e of events) {
    if (e.status === 'pass') pass++;
    else if (e.status === 'fail') fail++;
  }
  if (pass === 0 && fail === 0) return { kind: 'pending', failCount: 0, passCount: 0 };
  if (fail === 0) return { kind: 'human', failCount: 0, passCount: pass };
  return { kind: 'bot', failCount: fail, passCount: pass };
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: 9 passed (4 new + 5 existing).

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat(lib): add verdict aggregator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 8: DetectionLog Preact island

The visible log panel. Reads from `window.__bus`, renders an append-only event list plus a verdict pill at the top.

**Files:**
- Create: `src/components/DetectionLog.tsx`

- [ ] **Step 1: Implement the component**

`src/components/DetectionLog.tsx`:

```tsx
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
```

- [ ] **Step 2: Confirm typecheck**

```bash
npm run check
```

Expected: 0 errors. (If there are warnings about unused imports etc., address them inline before continuing.)

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat(ui): add DetectionLog Preact island

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 9: LevelLayout shared shell

Every level page imports this. It renders the header strip, mounts the DetectionLog island, exposes a Reset button, and provides slots for the level's body and inline `<script>`. The bus is instantiated inline in `<head>` so detection scripts can rely on `window.__bus` synchronously.

**Files:**
- Create: `src/components/LevelLayout.astro`

- [ ] **Step 1: Implement the layout**

`src/components/LevelLayout.astro`:

```astro
---
import '../styles/global.css';
import { DetectionLog } from './DetectionLog';

interface Props {
  levelNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  summary: string;
  measured: string; // plain-language "what's measured" content
}

const { levelNumber, title, summary, measured } = Astro.props;
const prev = levelNumber > 1 ? `/level/${levelNumber - 1}` : '/';
const next = levelNumber < 5 ? `/level/${levelNumber + 1}` : '/about';
const nextLabel = levelNumber < 5 ? `Level ${levelNumber + 1} →` : 'About →';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Level {levelNumber} — {title} · Bot Arena</title>
    <script is:inline>
      // Bus must exist before any detection script runs.
      (function () {
        const target = new EventTarget();
        let log = [];
        window.__bus = {
          emit(e) {
            const full = Object.assign({}, e, { ts: performance.now() });
            log.push(full);
            target.dispatchEvent(new CustomEvent('detection', { detail: full }));
          },
          on(h) {
            const l = (ev) => h(ev.detail);
            target.addEventListener('detection', l);
            return () => target.removeEventListener('detection', l);
          },
          onReset(h) {
            const l = () => h();
            target.addEventListener('reset', l);
            return () => target.removeEventListener('reset', l);
          },
          reset() {
            log = [];
            target.dispatchEvent(new Event('reset'));
          },
          snapshot() {
            return log.slice();
          },
        };
      })();
    </script>
  </head>
  <body class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" class="text-lg font-semibold tracking-tight">
          🛡️ Bot Arena
        </a>
        <nav class="flex gap-4 text-sm text-slate-600">
          <a href="/" class="hover:text-slate-900">Home</a>
          <a href="/about" class="hover:text-slate-900">About</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto flex max-w-6xl gap-8 px-6 py-10">
      <section class="flex-1">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Level {levelNumber} of 5
        </div>
        <h1 class="text-3xl font-bold tracking-tight">{title}</h1>
        <p class="mt-2 max-w-2xl text-slate-600">{summary}</p>

        <details class="mt-4 max-w-2xl rounded-lg bg-white p-4 text-sm shadow-sm">
          <summary class="cursor-pointer font-medium text-slate-700">
            What's measured on this page
          </summary>
          <div class="mt-3 whitespace-pre-line text-slate-600" set:html={measured} />
        </details>

        <div class="mt-8">
          <slot />
        </div>

        <div class="mt-8 flex items-center gap-3">
          <button
            id="reset-btn"
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset demo
          </button>
        </div>

        <nav class="mt-12 flex justify-between text-sm">
          <a href={prev} class="text-slate-500 hover:text-slate-900">← Back</a>
          <a href={next} class="text-slate-500 hover:text-slate-900">{nextLabel}</a>
        </nav>
      </section>

      <DetectionLog client:load />
    </main>

    <script is:inline>
      document.getElementById('reset-btn')?.addEventListener('click', () => {
        window.__bus.reset();
        document.querySelectorAll('form').forEach((f) => f.reset());
        document.querySelectorAll('[data-arena-state]').forEach((el) => {
          el.removeAttribute('data-arena-state');
        });
        // Re-run any registered rerun hooks (each level's detection module can register one).
        if (window.__rerun) window.__rerun();
      });
    </script>

    <slot name="scripts" />
  </body>
</html>
```

- [ ] **Step 2: Typecheck**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat(ui): add LevelLayout with inline bus init + reset wiring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 10: LoginForm component

Reused on most level pages as the click target. Submitting toggles a visible "✓ Access granted" / "✗ Blocked" state via `data-arena-state` on the form. No real auth.

**Files:**
- Create: `src/components/LoginForm.astro`

- [ ] **Step 1: Implement the form**

`src/components/LoginForm.astro`:

```astro
---
interface Props {
  formId?: string;
}
const { formId = 'login-form' } = Astro.props;
---
<form
  id={formId}
  class="max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm data-[arena-state=granted]:border-emerald-300 data-[arena-state=blocked]:border-rose-300"
  data-arena-form
>
  <h2 class="text-base font-semibold text-slate-900">Sign in</h2>
  <p class="mt-1 text-sm text-slate-500">Demo target — credentials are not checked.</p>

  <label class="mt-4 block text-sm font-medium text-slate-700">
    Email
    <input
      type="email"
      name="email"
      autocomplete="email"
      class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      value="user@example.com"
    />
  </label>

  <label class="mt-3 block text-sm font-medium text-slate-700">
    Password
    <input
      type="password"
      name="password"
      autocomplete="current-password"
      class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      value="hunter2"
    />
  </label>

  <slot name="extra" />

  <button
    type="submit"
    class="mt-5 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
  >
    Sign in
  </button>

  <div class="mt-4 hidden text-sm font-medium text-emerald-700" data-arena-granted>
    ✓ Access granted
  </div>
  <div class="mt-4 hidden text-sm font-medium text-rose-700" data-arena-blocked>
    ✗ Blocked — bot detected
  </div>
</form>

<script is:inline>
  document.querySelectorAll('[data-arena-form]').forEach((form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const bus = window.__bus;
      const events = bus ? bus.snapshot() : [];
      const failed = events.some((e) => e.status === 'fail');
      form.setAttribute('data-arena-state', failed ? 'blocked' : 'granted');
      form.querySelector('[data-arena-granted]')?.classList.toggle('hidden', failed);
      form.querySelector('[data-arena-blocked]')?.classList.toggle('hidden', !failed);
    });
  });
</script>
```

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "feat(ui): add LoginForm component with arena-state toggling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 11: Landing page

Lists the five levels with one-line descriptions and a Start CTA.

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace the placeholder**

`src/pages/index.astro`:

```astro
---
import '../styles/global.css';

const levels = [
  { n: 1, name: 'The honest tell', blurb: 'navigator.webdriver, missing chrome.runtime, headless UA hints.' },
  { n: 2, name: 'CDP attached', blurb: 'Driver-shim artefacts and toString/Error.stack integrity checks.' },
  { n: 3, name: 'Mouse trajectory', blurb: 'Mousemove density, click curvature, keystroke cadence.' },
  { n: 4, name: 'Fingerprint battery', blurb: 'Canvas, audio, font, and WebGL signals.' },
  { n: 5, name: 'Cloudflare Turnstile', blurb: 'Managed-mode widget with server-side verification.' },
];
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bot Arena — anti-bot detection demo</title>
    <meta name="description" content="Five layered anti-bot detections, live Detection Log, real Cloudflare Turnstile. A demo target for browser automation." />
  </head>
  <body class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" class="text-lg font-semibold tracking-tight">🛡️ Bot Arena</a>
        <nav class="flex gap-4 text-sm text-slate-600">
          <a href="/about" class="hover:text-slate-900">About</a>
          <a href="https://github.com/vaclavnovotny/bot-arena" class="hover:text-slate-900">GitHub</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-16">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">A live demo</p>
      <h1 class="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
        Five layers of bot detection. Watch them fire.
      </h1>
      <p class="mt-4 max-w-2xl text-lg text-slate-600">
        Point your favourite browser-automation tool at any level. The Detection Log on the right shows, in real time, exactly which signals you tripped.
      </p>

      <a
        href="/level/1"
        class="mt-8 inline-block rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Start at Level 1 →
      </a>

      <ol class="mt-14 grid gap-4 sm:grid-cols-2">
        {levels.map((l) => (
          <li class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <a href={`/level/${l.n}`} class="block">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Level {l.n}
              </div>
              <div class="mt-1 text-lg font-semibold text-slate-900">{l.name}</div>
              <p class="mt-1 text-sm text-slate-600">{l.blurb}</p>
            </a>
          </li>
        ))}
      </ol>
    </main>

    <footer class="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      Demo target only. No analytics, no tracking.
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Run dev and visually confirm**

```bash
npm run dev
```

Open `http://localhost:4321/`. Expected: hero, CTA, grid of 5 level cards. Stop the dev server.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat(pages): landing page with five-level grid

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 12: About page

Plain-language explanation of the demo.

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create the page**

`src/pages/about.astro`:

```astro
---
import '../styles/global.css';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>About — Bot Arena</title>
  </head>
  <body class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" class="text-lg font-semibold tracking-tight">🛡️ Bot Arena</a>
        <nav class="flex gap-4 text-sm text-slate-600">
          <a href="/" class="hover:text-slate-900">Home</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-16 text-slate-700">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">About this demo</h1>

      <p class="mt-6">
        Bot Arena is a deliberately-obvious anti-bot target. Each of the five level pages exercises a different family of detection signals that real-world sites use to tell humans from automation.
      </p>
      <p class="mt-4">
        The site does not run any automation itself. It's designed to be a target you point your own tool at. The <strong>Detection Log</strong> panel on every level page shows, in real time, every signal the page captured — passed signals in green, failed signals in red — so you can see exactly which checks your tool tripped.
      </p>

      <h2 class="mt-12 text-xl font-semibold text-slate-900">Reading the log</h2>
      <ul class="mt-3 list-disc space-y-2 pl-5">
        <li><strong>PASS</strong> means the signal is consistent with a real human in a real browser.</li>
        <li><strong>FAIL</strong> means the signal is consistent with automation or a headless browser.</li>
        <li><strong>INFO</strong> is a contextual note that doesn't affect the verdict (e.g. "Turnstile widget mode: interactive").</li>
        <li>The verdict pill at the top of the log aggregates: any FAIL turns it red.</li>
      </ul>

      <h2 class="mt-12 text-xl font-semibold text-slate-900">No tracking</h2>
      <p class="mt-3">
        The site stores nothing about your visit. The Detection Log lives in browser memory and resets when you reload. The one server endpoint (Level 5's Turnstile verification) calls Cloudflare's <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">siteverify</code> API and immediately discards the token.
      </p>

      <p class="mt-12 text-sm text-slate-500">
        Source: <a class="underline" href="https://github.com/vaclavnovotny/bot-arena">github.com/vaclavnovotny/bot-arena</a>
      </p>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "feat(pages): add About page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 13: Level 1 — the honest tell

Pure passive checks. Each runs once on page load and emits a single event.

**Files:**
- Create: `src/detections/level1.ts`, `src/detections/level1.test.ts`, `src/pages/level/1.astro`

- [ ] **Step 1: Write the failing tests**

`src/detections/level1.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
```

- [ ] **Step 2: Run tests and verify failures**

```bash
npm test
```

Expected: 7 failures (module not found).

- [ ] **Step 3: Implement `src/detections/level1.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: all level1 tests green; total count now 9 + 7 = 16 passed.

- [ ] **Step 5: Create `src/pages/level/1.astro`**

```astro
---
import LevelLayout from '../../components/LevelLayout.astro';
import LoginForm from '../../components/LoginForm.astro';

const measured = `
- <code>navigator.webdriver</code> — must be <code>false</code> or undefined.
- <code>window.chrome.runtime</code> — present in real Chrome.
- <code>navigator.plugins.length</code> — non-zero in real Chrome.
- <code>navigator.languages</code> — non-empty.
- <code>User-Agent</code> — does not contain <code>HeadlessChrome</code>.
- <code>Notification.permission</code> vs <code>permissions.query({name:"notifications"})</code> — should agree.
`;
---
<LevelLayout
  levelNumber={1}
  title="The honest tell"
  summary="Six passive flags that real Chrome sets and most automation contexts get wrong."
  measured={measured}
>
  <LoginForm />
</LevelLayout>

<script>
  import { runLevel1 } from '../../detections/level1';
  const start = () => runLevel1({ window, bus: window.__bus! });
  start();
  // Re-run when the user clicks "Reset demo".
  window.__rerun = start;
</script>
```

- [ ] **Step 6: Run dev and confirm signals fire**

```bash
npm run dev
```

Visit `http://localhost:4321/level/1`. Expected: Detection Log shows 6 entries, all green PASS (real Chrome). Click Reset → log clears and re-fills. Stop the dev server.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat(level1): webdriver tell detections + page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 14: Level 2 — CDP attached

Probes that fire if CDP / DevTools is attached or if the runtime has been tampered with by an automation framework.

**Files:**
- Create: `src/detections/level2.ts`, `src/detections/level2.test.ts`, `src/pages/level/2.astro`

- [ ] **Step 1: Write the failing tests**

`src/detections/level2.test.ts`:

```ts
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
    await runLevel2({ window: fakeWin as Window, bus });
    expect(bus.snapshot().some((e) => e.id === 'tostring-integrity' && e.status === 'fail')).toBe(true);
    // sanity: real one still works
    expect(native.call(parseInt)).toContain('native code');
  });
});
```

- [ ] **Step 2: Run tests, verify failures**

```bash
npm test
```

Expected: 3 failures.

- [ ] **Step 3: Implement `src/detections/level2.ts`**

```ts
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

  // 3. Error.stack timing — a heuristic; cheap to compute and only emits INFO/FAIL.
  // We measure the time to materialise a stack via property getter; CDP-attached
  // contexts tend to be measurably slower because the inspector materialises the
  // stack lazily. Threshold tuned conservatively — false positives are acceptable here
  // because the level only needs ONE failing signal to flip the verdict.
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

  // 4. console.debug hijack heuristic — when DevTools/CDP attaches, getter on a
  // console.debug arg gets invoked during string conversion.
  {
    let triggered = false;
    const arg = {
      get __probe__() {
        triggered = true;
        return undefined;
      },
    };
    // eslint-disable-next-line no-console
    win.console.debug(arg as unknown as string);
    bus.emit({
      id: 'console-debug-hijack',
      name: 'console.debug getter not invoked',
      status: triggered ? 'fail' : 'pass',
      detail: triggered ? 'DevTools/CDP appears to have probed the argument' : 'no probe',
    });
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: 3 new + 16 existing = 19 passed.

- [ ] **Step 5: Create `src/pages/level/2.astro`**

```astro
---
import LevelLayout from '../../components/LevelLayout.astro';
import LoginForm from '../../components/LoginForm.astro';

const measured = `
- <strong>Driver-shim properties</strong> — legacy Selenium leaves <code>cdc_*</code> globals; a free win.
- <strong>Function.prototype.toString integrity</strong> — if a framework patches toString to hide itself, the patch's own toString string is not "[native code]".
- <strong>Error.stack timing</strong> — accessing a getter that materialises an Error stack is measurably slower when CDP / DevTools is attached.
- <strong>console.debug hijack</strong> — DevTools/CDP probes argument values; we pass a getter and see whether it fires.
`;
---
<LevelLayout
  levelNumber={2}
  title="CDP attached"
  summary="Four checks for a debugger, automation framework, or driver shim being active."
  measured={measured}
>
  <LoginForm />
</LevelLayout>

<script>
  import { runLevel2 } from '../../detections/level2';
  const start = () => runLevel2({ window, bus: window.__bus! });
  start();
  window.__rerun = start;
</script>
```

- [ ] **Step 6: Visual smoke test**

```bash
npm run dev
```

Visit `/level/2`. Expected: 4 entries in the log. In real Chrome with DevTools closed, all should be PASS. Open DevTools → click Reset → the `console.debug` check and possibly `Error.stack timing` should flip to FAIL.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat(level2): CDP attachment probes + page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 15: Level 3 — mouse trajectory

Records mousemoves and keystrokes between page load and form submission. On submit it scores the trajectory.

**Files:**
- Create: `src/detections/level3.ts`, `src/detections/level3.test.ts`, `src/pages/level/3.astro`

- [ ] **Step 1: Write failing tests**

`src/detections/level3.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreTrajectory, scoreKeystrokes } from './level3';

describe('scoreTrajectory', () => {
  it('FAILs with zero intermediate moves', () => {
    expect(scoreTrajectory([]).verdict).toBe('fail');
  });

  it('FAILs with a single straight-line segment (zero curvature)', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: 0, t: i }));
    expect(scoreTrajectory(pts).verdict).toBe('fail');
  });

  it('PASSes with a curved trajectory of sufficient density', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({
      x: i * 8 + Math.sin(i / 3) * 12,
      y: i * 5 + Math.cos(i / 4) * 9,
      t: i * 6,
    }));
    expect(scoreTrajectory(pts).verdict).toBe('pass');
  });
});

describe('scoreKeystrokes', () => {
  it('FAILs when every interval is identical', () => {
    const ks = Array.from({ length: 8 }, (_, i) => ({ key: 'a', t: i * 50 }));
    expect(scoreKeystrokes(ks).verdict).toBe('fail');
  });

  it('FAILs when intervals are zero (simultaneous keydowns)', () => {
    const ks = Array.from({ length: 6 }, () => ({ key: 'a', t: 0 }));
    expect(scoreKeystrokes(ks).verdict).toBe('fail');
  });

  it('PASSes when intervals vary like a human typist', () => {
    const ks = [
      { key: 'h', t: 0 },
      { key: 'e', t: 142 },
      { key: 'l', t: 88 },
      { key: 'l', t: 109 },
      { key: 'o', t: 215 },
    ];
    expect(scoreKeystrokes(ks).verdict).toBe('pass');
  });
});
```

- [ ] **Step 2: Run tests, verify failures**

```bash
npm test
```

Expected: 6 failures.

- [ ] **Step 3: Implement `src/detections/level3.ts`**

```ts
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
  // Total path length and bounding-box diagonal — ratio < 1.05 means almost-straight line.
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

  if (ratio < 1.05) {
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
  // Coefficient of variation — humans naturally vary, automation often doesn't.
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
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
    // Don't preventDefault — LoginForm handles that; we just observe.
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

  // Info banner explaining the level is observational.
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
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: 6 new + 19 existing = 25 passed.

- [ ] **Step 5: Create `src/pages/level/3.astro`**

```astro
---
import LevelLayout from '../../components/LevelLayout.astro';
import LoginForm from '../../components/LoginForm.astro';

const measured = `
- <strong>Mouse trajectory</strong> — every <code>mousemove</code> is recorded; on submit the path length is compared to its bounding-box diagonal. A ratio &lt; 1.05 means an essentially-straight jump.
- <strong>Keystroke cadence</strong> — intervals between key events are profiled. Identical intervals or zero-spread intervals look mechanical.
`;
---
<LevelLayout
  levelNumber={3}
  title="Mouse trajectory"
  summary="Records mousemoves and keystrokes; scores them on form submit."
  measured={measured}
>
  <LoginForm />
</LevelLayout>

<script>
  import { attachLevel3 } from '../../detections/level3';
  let detach = attachLevel3({ window, bus: window.__bus! });
  window.__rerun = () => {
    detach();
    detach = attachLevel3({ window, bus: window.__bus! });
  };
</script>
```

- [ ] **Step 6: Visual smoke test**

```bash
npm run dev
```

Visit `/level/3`. Move the mouse naturally to the button, fill the form, submit. Expected: log shows `Trajectory recorder armed` (info), then `Mouse trajectory shape` (pass) and `Keystroke cadence` (pass). Stop the dev server.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat(level3): mouse trajectory + keystroke cadence scoring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 16: Level 4 — fingerprint battery

Canvas, audio, font, and WebGL fingerprints. Logic is pure and unit-testable; the hard-coded denylist will be empty at first — see the operational note below.

**Files:**
- Create: `src/detections/level4.ts`, `src/detections/level4.test.ts`, `src/pages/level/4.astro`

- [ ] **Step 1: Write failing tests**

`src/detections/level4.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkRenderer, fontProbeVerdict } from './level4';

describe('checkRenderer', () => {
  it('PASSes on real GPU strings', () => {
    expect(checkRenderer('Intel Iris Xe Graphics').status).toBe('pass');
    expect(checkRenderer('NVIDIA GeForce RTX 4070').status).toBe('pass');
  });

  it('FAILs on SwiftShader', () => {
    expect(checkRenderer('Google SwiftShader').status).toBe('fail');
  });

  it('FAILs on Mesa OffScreen', () => {
    expect(checkRenderer('Mesa OffScreen').status).toBe('fail');
  });

  it('returns info when string is empty/unknown', () => {
    expect(checkRenderer('').status).toBe('info');
  });
});

describe('fontProbeVerdict', () => {
  it('PASSes when the UA-expected font is present', () => {
    expect(
      fontProbeVerdict({ ua: 'Windows', presentFonts: ['Arial Black', 'Segoe UI Emoji'] }).status
    ).toBe('pass');
  });

  it('FAILs when none of the expected fonts are present', () => {
    expect(
      fontProbeVerdict({ ua: 'Windows', presentFonts: ['DejaVu Sans'] }).status
    ).toBe('fail');
  });
});
```

- [ ] **Step 2: Run tests, verify failures**

```bash
npm test
```

Expected: 6 failures.

- [ ] **Step 3: Implement `src/detections/level4.ts`**

```ts
import type { DetectionBus } from '../lib/detection-bus';

const SOFTWARE_RENDERERS = ['SwiftShader', 'Mesa OffScreen', 'llvmpipe'];

// Hashes known to come from headless/automated Chromes. Empty in v1 — collect
// these by running Playwright against /level/4 once during dev and harvesting
// the canvas/audio hashes the Detection Log prints in `detail`. Add them here.
const CANVAS_DENYLIST: string[] = [];
const AUDIO_DENYLIST: string[] = [];

const EXPECTED_FONTS_BY_OS: Array<{ uaPattern: RegExp; fonts: string[] }> = [
  { uaPattern: /Windows/i, fonts: ['Segoe UI Emoji', 'Arial Black', 'Comic Sans MS'] },
  { uaPattern: /Mac OS X/i, fonts: ['Apple Color Emoji', 'Helvetica Neue'] },
  { uaPattern: /Linux/i, fonts: ['Noto Color Emoji', 'DejaVu Sans'] },
];

export interface Verdict {
  status: 'pass' | 'fail' | 'info';
  detail: string;
}

export function checkRenderer(renderer: string): Verdict {
  if (!renderer) return { status: 'info', detail: 'WebGL renderer unavailable' };
  for (const r of SOFTWARE_RENDERERS) {
    if (renderer.includes(r)) {
      return { status: 'fail', detail: `${renderer} — software rasteriser (headless tell)` };
    }
  }
  return { status: 'pass', detail: renderer };
}

export function fontProbeVerdict({
  ua,
  presentFonts,
}: {
  ua: string;
  presentFonts: string[];
}): Verdict {
  const entry = EXPECTED_FONTS_BY_OS.find((e) => e.uaPattern.test(ua));
  if (!entry) return { status: 'info', detail: 'unknown OS in UA — no font expectation' };
  const overlap = entry.fonts.filter((f) => presentFonts.includes(f));
  if (overlap.length === 0) {
    return {
      status: 'fail',
      detail: `expected one of [${entry.fonts.join(', ')}], present: [${presentFonts.join(', ')}]`,
    };
  }
  return { status: 'pass', detail: `found ${overlap.join(', ')}` };
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function canvasHash(): Promise<string> {
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 40;
  const ctx = c.getContext('2d')!;
  ctx.textBaseline = 'top';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#069';
  ctx.fillText('Bot Arena 🛡️ canvas-fp', 4, 6);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('Bot Arena 🛡️ canvas-fp', 6, 8);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return sha256Hex(new Uint8Array(data.buffer));
}

async function audioHash(): Promise<string> {
  const OfflineCtor = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!OfflineCtor) return 'unavailable';
  const ctx = new OfflineCtor(1, 5000, 44100);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 1000;
  const compressor = ctx.createDynamicsCompressor();
  osc.connect(compressor);
  compressor.connect(ctx.destination);
  osc.start(0);
  const rendered = await ctx.startRendering();
  const samples = rendered.getChannelData(0);
  // Reduce to a single number that captures the spectral fingerprint.
  let sum = 0;
  for (let i = 4500; i < 5000; i++) sum += Math.abs(samples[i]);
  return sha256Hex(sum.toFixed(8));
}

function isFontInstalled(name: string): boolean {
  const test = 'mmmmmmmmlli';
  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.fontSize = '72px';
  span.textContent = test;
  span.style.fontFamily = 'monospace';
  document.body.appendChild(span);
  const baseline = span.offsetWidth;
  span.style.fontFamily = `'${name}', monospace`;
  const probe = span.offsetWidth;
  document.body.removeChild(span);
  return baseline !== probe;
}

interface RunArgs {
  window: Window;
  bus: DetectionBus;
}

export async function runLevel4({ window: win, bus }: RunArgs): Promise<void> {
  // WebGL renderer.
  let renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') ?? c.getContext('experimental-webgl');
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        renderer = (gl as WebGLRenderingContext).getParameter(
          (ext as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL
        ) as string;
      }
    }
  } catch {
    /* ignore */
  }
  const rendererV = checkRenderer(renderer);
  bus.emit({ id: 'webgl-renderer', name: 'WebGL renderer plausibility', ...rendererV });

  // Canvas hash.
  try {
    const hash = await canvasHash();
    const bad = CANVAS_DENYLIST.includes(hash);
    bus.emit({
      id: 'canvas-fp',
      name: 'Canvas fingerprint',
      status: bad ? 'fail' : 'pass',
      detail: `sha256: ${hash.slice(0, 16)}…`,
    });
  } catch (err) {
    bus.emit({ id: 'canvas-fp', name: 'Canvas fingerprint', status: 'info', detail: (err as Error).message });
  }

  // Audio hash.
  try {
    const hash = await audioHash();
    const bad = AUDIO_DENYLIST.includes(hash);
    bus.emit({
      id: 'audio-fp',
      name: 'AudioContext fingerprint',
      status: bad ? 'fail' : 'pass',
      detail: `sha256: ${hash.slice(0, 16)}…`,
    });
  } catch (err) {
    bus.emit({ id: 'audio-fp', name: 'AudioContext fingerprint', status: 'info', detail: (err as Error).message });
  }

  // Font probe.
  const candidates = ['Segoe UI Emoji', 'Arial Black', 'Comic Sans MS', 'Apple Color Emoji', 'Helvetica Neue', 'Noto Color Emoji', 'DejaVu Sans'];
  const present = candidates.filter(isFontInstalled);
  const fontV = fontProbeVerdict({ ua: win.navigator.userAgent, presentFonts: present });
  bus.emit({ id: 'font-probe', name: 'Font set matches UA', ...fontV });
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
npm test
```

Expected: 6 new + 25 existing = 31 passed.

- [ ] **Step 5: Create `src/pages/level/4.astro`**

```astro
---
import LevelLayout from '../../components/LevelLayout.astro';
import LoginForm from '../../components/LoginForm.astro';

const measured = `
- <strong>WebGL renderer</strong> — software rasterisers (SwiftShader, Mesa OffScreen, llvmpipe) are headless tells.
- <strong>Canvas fingerprint</strong> — hash a rendered string + emoji; compare to a denylist harvested from automated runs.
- <strong>AudioContext fingerprint</strong> — hash the output of an OscillatorNode → DynamicsCompressor → destination chain.
- <strong>Font set</strong> — the OS implied by the UA should ship a known set of fonts; mismatched set = suspect.
`;
---
<LevelLayout
  levelNumber={4}
  title="Fingerprint battery"
  summary="Canvas, audio, WebGL, and font signals — each one consistent with a real desktop browser."
  measured={measured}
>
  <LoginForm />
</LevelLayout>

<script>
  import { runLevel4 } from '../../detections/level4';
  const start = () => runLevel4({ window, bus: window.__bus! });
  start();
  window.__rerun = start;
</script>
```

- [ ] **Step 6: Visual smoke test**

```bash
npm run dev
```

Visit `/level/4`. Expected: 4 entries — canvas, audio, WebGL renderer, font probe. On a real Chrome, all PASS (the denylist is empty so the canvas/audio hashes always pass). Note the hash prefixes printed in the `detail` — those are what you harvest from a Playwright run to populate `CANVAS_DENYLIST` / `AUDIO_DENYLIST` later.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat(level4): canvas/audio/webgl/font fingerprint battery

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

**Operational note (do NOT skip):** The canvas and audio denylists are empty at first commit. Before the demo is useful for that signal class, run Playwright against `/level/4` and copy the printed hashes into `CANVAS_DENYLIST` / `AUDIO_DENYLIST`. This is a follow-up task tracked outside this plan.

---

## Task 17: Level 5 — Cloudflare Turnstile + verify endpoint

Embed the Turnstile widget in managed mode, post the token to a Pages Function endpoint, show the verification result in the log.

**Files:**
- Create: `src/detections/level5.ts`, `src/pages/level/5.astro`, `src/pages/api/turnstile/verify.ts`, `.env.example`
- Modify: `src/components/LoginForm.astro` (allow the level-5 slot to inject the widget) — already supported via `<slot name="extra" />`

- [ ] **Step 1: Create `.env.example`** (documents required Pages env vars)

```bash
# Cloudflare Turnstile — get keys from https://dash.cloudflare.com/?to=/:account/turnstile
# For local dev / CI you can use the always-passes test pair below.
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

- [ ] **Step 2: Create `src/detections/level5.ts`**

```ts
import type { DetectionBus } from '../lib/detection-bus';

interface RunArgs {
  bus: DetectionBus;
  token: string | null;
}

export async function verifyAndEmit({ bus, token }: RunArgs): Promise<void> {
  if (!token) {
    bus.emit({
      id: 'turnstile',
      name: 'Cloudflare Turnstile verification',
      status: 'fail',
      detail: 'no token — widget did not solve',
    });
    return;
  }
  try {
    const res = await fetch('/api/turnstile/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json()) as { success: boolean; error?: string };
    bus.emit({
      id: 'turnstile',
      name: 'Cloudflare Turnstile verification',
      status: body.success ? 'pass' : 'fail',
      detail: body.success ? 'siteverify: success' : `siteverify: ${body.error ?? 'failed'}`,
    });
  } catch (err) {
    bus.emit({
      id: 'turnstile',
      name: 'Cloudflare Turnstile verification',
      status: 'info',
      detail: `network error: ${(err as Error).message}`,
    });
  }
}
```

- [ ] **Step 3: Create the SSR endpoint `src/pages/api/turnstile/verify.ts`**

```ts
import type { APIRoute } from 'astro';

export const prerender = false;

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env: Record<string, string> } }).runtime?.env ?? (process.env as Record<string, string>);
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return Response.json({ success: false, error: 'server misconfigured (no secret)' }, { status: 500 });
  }
  let token = '';
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token ?? '';
  } catch {
    return Response.json({ success: false, error: 'invalid JSON' }, { status: 400 });
  }
  if (!token) return Response.json({ success: false, error: 'no token' }, { status: 400 });

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);

  const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = (await cfRes.json()) as SiteverifyResponse;
  if (data.success) return Response.json({ success: true });
  return Response.json({
    success: false,
    error: (data['error-codes'] ?? ['unknown']).join(','),
  });
};
```

- [ ] **Step 4: Create `src/pages/level/5.astro`**

```astro
---
import LevelLayout from '../../components/LevelLayout.astro';
import LoginForm from '../../components/LoginForm.astro';

// Site key is public — embedded in the HTML.
const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';

const measured = `
- <strong>Turnstile widget mode</strong> — managed; Cloudflare decides whether to challenge.
- <strong>Server-side verification</strong> — the token is POSTed to <code>/api/turnstile/verify</code>, which calls Cloudflare's siteverify with the secret. The token is single-use; the secret never reaches the browser.
`;
---
<LevelLayout
  levelNumber={5}
  title="Cloudflare Turnstile"
  summary="Real Turnstile widget in managed mode, with server-side token verification."
  measured={measured}
>
  <LoginForm formId="ts-form">
    <div slot="extra" class="mt-4">
      <div class="cf-turnstile" data-sitekey={siteKey} data-callback="onTurnstileOk" data-error-callback="onTurnstileErr"></div>
    </div>
  </LoginForm>
</LevelLayout>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer is:inline></script>

<script>
  import { verifyAndEmit } from '../../detections/level5';

  let lastToken: string | null = null;

  (window as Window & { onTurnstileOk?: (t: string) => void; onTurnstileErr?: () => void }).onTurnstileOk = (token: string) => {
    lastToken = token;
    window.__bus!.emit({
      id: 'turnstile-token',
      name: 'Turnstile widget produced a token',
      status: 'info',
      detail: 'awaiting server-side siteverify on submit',
    });
  };
  (window as Window & { onTurnstileOk?: (t: string) => void; onTurnstileErr?: () => void }).onTurnstileErr = () => {
    lastToken = null;
    window.__bus!.emit({
      id: 'turnstile-token',
      name: 'Turnstile widget error',
      status: 'fail',
      detail: 'widget did not produce a token',
    });
  };

  document.getElementById('ts-form')?.addEventListener(
    'submit',
    async () => {
      await verifyAndEmit({ bus: window.__bus!, token: lastToken });
    },
    { capture: true }
  );

  window.__rerun = () => {
    lastToken = null;
    const tsContainer = document.querySelector('.cf-turnstile');
    if (tsContainer && (window as Window & { turnstile?: { reset: (el: Element) => void } }).turnstile) {
      (window as Window & { turnstile: { reset: (el: Element) => void } }).turnstile.reset(tsContainer);
    }
  };
</script>
```

- [ ] **Step 5: Typecheck and build**

```bash
npm run check
npm run build
```

Expected: 0 errors. `dist/_worker.js/` includes the turnstile verify route.

- [ ] **Step 6: Local end-to-end smoke test with test keys**

Create a local `.env`:

```bash
cp .env.example .env
```

`.env` already contains the always-passes test keys.

Run dev:

```bash
npm run dev
```

Visit `/level/5`. Expected:
- Turnstile widget renders (test key shows an obvious "test mode" banner).
- Form submit produces `Turnstile widget produced a token` (info) then `Cloudflare Turnstile verification` (pass).

Stop the dev server.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat(level5): Turnstile widget + server verification endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 18: Deploy to Cloudflare Pages and attach jhero.app

These steps run in the Cloudflare dashboard and on the user's machine — they're not automatable in this plan, so this task is a checklist for the engineer to walk through and tick off.

- [ ] **Step 1: Create the Pages project (one-time)**

Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select `vaclavnovotny/bot-arena` → **Begin setup**.
- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: (leave empty)

- [ ] **Step 2: Add environment variables (Production)**

In the Pages project → **Settings** → **Variables and secrets**:
- `PUBLIC_TURNSTILE_SITE_KEY` — your real site key from Cloudflare → Turnstile → Add site (Domain: `jhero.app`)
- `TURNSTILE_SECRET_KEY` — set as **encrypted** secret; paste the matching secret

- [ ] **Step 3: First deploy**

Click **Save and Deploy**. Wait for the build to finish (≈90 s). The default URL is `bot-arena.pages.dev`.

- [ ] **Step 4: Attach the custom domain**

Pages project → **Custom domains** → **Set up a custom domain** → enter `jhero.app` → follow prompts. (DNS is already in this Cloudflare account; the Pages flow adds the records automatically.) Repeat for `www.jhero.app` if desired.

- [ ] **Step 5: End-to-end smoke against jhero.app**

Once the custom domain shows **Active**:
- Open `https://jhero.app/` in real desktop Chrome → confirm landing renders.
- Walk levels 1-4 → confirm the Detection Log fills with PASS entries (you're a real human in a real browser).
- Level 5 → submit the form → confirm the verification PASS arrives. (If it FAILs with "siteverify: invalid-input-secret" or similar, the secret env var is wrong — fix in Pages settings and trigger a redeploy.)

- [ ] **Step 6: Take a baseline screenshot**

For the demo deck, screenshot one level page (logs visible, Reset button visible) at 1440-wide and save to `docs/screenshots/level3-baseline.png` (create the folder).

- [ ] **Step 7: Commit the screenshot**

```bash
git add docs/screenshots/
git commit -m "docs: add baseline screenshot of level 3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Self-Review

**Spec coverage check** (vs `2026-05-12-bot-arena-design.md`):

- §2 "Showcase five levels" — Tasks 13-17 cover levels 1-5. ✓
- §2 "Detection Log panel reports in real time" — Task 8. ✓
- §2 "Self-resetting" — Reset button in LevelLayout (Task 9), per-level `window.__rerun` hook in Tasks 13/14/15/16/17. ✓
- §2 "Levels 1-4 client-side; Level 5 server-verified" — Tasks 13-16 pure-client; Task 17 includes Pages Function. ✓
- §4 routes (`/`, `/level/1..5`, `/about`) — Tasks 11, 13-17, 12. ✓
- §4 page contents (header, target form, log, info popover, reset, footer nav) — LevelLayout (Task 9). ✓
- §4 visual style (Tailwind, neutral SaaS, monospace log) — Tasks 2, 8, 9. ✓
- §5 specific signals for each level — all covered in detection modules (Tasks 13-17). ✓
- §6 Detection Log behaviour (event bus, append-only, verdict pill, reset) — Tasks 6, 7, 8, 9. ✓
- §7 stack — Astro 5 (Task 1), Tailwind v4 (Task 2), Preact (Task 1), Cloudflare adapter (Task 1), Vitest + jsdom (Task 4). ✓
- §8 repo structure — matches the file structure block at the top of this plan. ✓
- §9 non-goals — no mobile/dark-mode tasks; no analytics; no e2e tests; ✓

**Placeholder scan:** No "TBD", no "implement later", no naked "handle edge cases". Operational follow-ups (denylist harvest, screenshots, Pages dashboard config) are flagged explicitly as out-of-code tasks.

**Type consistency:** `DetectionEvent` / `DetectionBus` / `runLevelN({ window, bus })` shape is consistent across Tasks 6, 8, 13, 14, 15, 16. Level 3 differs by design (`attachLevel3` returns a detach function because it needs to listen) — that's the right shape for that level and the page wires it accordingly. `__rerun` hook is used consistently across all level pages.

**Open items deferred (not in this plan):**
- Harvesting canvas/audio fingerprint hashes from a Playwright run and populating `CANVAS_DENYLIST` / `AUDIO_DENYLIST` (operational note in Task 16).
- Promotional screenshots beyond the one baseline (Task 18 step 6).

---

## Execution

Plan saved to `docs/superpowers/plans/2026-05-12-bot-arena-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks. Each task is short and self-contained, which suits this model well.

**2. Inline Execution** — I implement task by task in this session, checkpointing for your review.

Which approach do you want?
