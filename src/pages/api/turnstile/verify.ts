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
