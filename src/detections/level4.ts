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
  const buf = await crypto.subtle.digest('SHA-256', data as BufferSource);
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
