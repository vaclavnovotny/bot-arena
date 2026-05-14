import { createWorker, type Worker } from 'tesseract.js';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Return the geometric centre of a Playwright bounding box.
 * Used by Onshape's best-effort canvas-click test.
 */
export function canvasCentre(box: BoundingBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Parse a CSS length value (e.g. "12px", "1.5rem", "0") to a number of pixels.
 * Returns null if the value cannot be parsed. Only `px` is interpreted as
 * pixels; rem/em/% return null so the caller knows the demo did not expose
 * a pixel-valued CSS variable. Used by Odoo's best-effort drag test.
 */
export function parseCssLength(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)px$/);
  if (!m) return null;
  return Number(m[1]);
}

let cachedWorker: Worker | null = null;

/**
 * Run Tesseract.js OCR on a PNG/JPEG buffer and return the recognised text.
 * Loads the English language model lazily on first call and reuses the worker
 * across subsequent calls in the same test process.
 */
export async function ocr(buffer: Buffer): Promise<string> {
  if (!cachedWorker) {
    cachedWorker = await createWorker('eng');
  }
  const result = await cachedWorker.recognize(buffer);
  return result.data.text;
}
