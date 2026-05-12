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
