import type { DetectionBus } from '../lib/detection-bus';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FIELDS: Record<'email' | 'password' | 'submit', Rect> = {
  email: { x: 24, y: 76, w: 312, h: 36 },
  password: { x: 24, y: 152, w: 312, h: 36 },
  submit: { x: 24, y: 220, w: 312, h: 44 },
};

const inside = (x: number, y: number, r: Rect): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

interface FormState {
  email: string;
  password: string;
  focused: 'email' | 'password' | null;
  granted: boolean;
}

function draw(ctx: CanvasRenderingContext2D, state: FormState): void {
  const { width, height } = ctx.canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('Sign in', 24, 36);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Demo target — credentials are not checked.', 24, 56);

  // Email
  ctx.fillStyle = '#334155';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Email', FIELDS.email.x, FIELDS.email.y - 4);
  ctx.strokeStyle = state.focused === 'email' ? '#0f172a' : '#cbd5e1';
  ctx.lineWidth = state.focused === 'email' ? 2 : 1;
  ctx.strokeRect(FIELDS.email.x, FIELDS.email.y, FIELDS.email.w, FIELDS.email.h);
  ctx.fillStyle = '#0f172a';
  ctx.font = '14px ui-monospace, Menlo, Consolas, monospace';
  const emailText = state.email + (state.focused === 'email' ? '|' : '');
  ctx.fillText(emailText, FIELDS.email.x + 10, FIELDS.email.y + 23);

  // Password
  ctx.fillStyle = '#334155';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Password', FIELDS.password.x, FIELDS.password.y - 4);
  ctx.strokeStyle = state.focused === 'password' ? '#0f172a' : '#cbd5e1';
  ctx.lineWidth = state.focused === 'password' ? 2 : 1;
  ctx.strokeRect(FIELDS.password.x, FIELDS.password.y, FIELDS.password.w, FIELDS.password.h);
  ctx.fillStyle = '#0f172a';
  ctx.font = '14px ui-monospace, Menlo, Consolas, monospace';
  const masked = '•'.repeat(state.password.length) + (state.focused === 'password' ? '|' : '');
  ctx.fillText(masked, FIELDS.password.x + 10, FIELDS.password.y + 23);

  // Submit button
  ctx.fillStyle = state.granted ? '#10b981' : '#0f172a';
  ctx.fillRect(FIELDS.submit.x, FIELDS.submit.y, FIELDS.submit.w, FIELDS.submit.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sign in', FIELDS.submit.x + FIELDS.submit.w / 2, FIELDS.submit.y + 28);
  ctx.textAlign = 'left';

  if (state.granted) {
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('✓ Access granted', FIELDS.submit.x, FIELDS.submit.y + FIELDS.submit.h + 28);
  }

  ctx.lineWidth = 1;
}

interface SetupArgs {
  canvas: HTMLCanvasElement;
  bus: DetectionBus;
}

export function attachLevel6({ canvas, bus }: SetupArgs): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const state: FormState = { email: '', password: '', focused: null, granted: false };
  const render = (): void => draw(ctx, state);

  const onClick = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    bus.emit({
      id: 'canvas-click',
      name: 'Canvas click registered',
      status: 'info',
      detail: `at (${Math.round(x)}, ${Math.round(y)})`,
    });
    if (inside(x, y, FIELDS.email)) state.focused = 'email';
    else if (inside(x, y, FIELDS.password)) state.focused = 'password';
    else if (inside(x, y, FIELDS.submit)) {
      const ok = state.email.length > 0 && state.password.length > 0;
      state.granted = ok;
      state.focused = null;
      bus.emit({
        id: 'canvas-submit',
        name: 'Canvas form submitted',
        status: ok ? 'pass' : 'fail',
        detail: ok
          ? 'email and password entered → Access granted'
          : 'submit clicked with empty email or password',
      });
    } else {
      state.focused = null;
    }
    render();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!state.focused) return;
    if (e.key === 'Backspace') {
      state[state.focused] = state[state.focused].slice(0, -1);
    } else if (e.key === 'Enter') {
      const ok = state.email.length > 0 && state.password.length > 0;
      state.granted = ok;
      bus.emit({
        id: 'canvas-submit',
        name: 'Canvas form submitted (Enter)',
        status: ok ? 'pass' : 'fail',
        detail: ok ? 'email and password entered → Access granted' : 'Enter with empty fields',
      });
      state.focused = null;
    } else if (e.key.length === 1) {
      state[state.focused] += e.key;
    } else {
      return;
    }
    render();
  };

  canvas.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  render();

  bus.emit({
    id: 'level6-armed',
    name: 'Canvas form rendered',
    status: 'info',
    detail: 'No DOM form fields exist — only pixels on a <canvas>.',
  });

  return () => {
    canvas.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
  };
}
