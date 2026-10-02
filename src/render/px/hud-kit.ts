import { measure, text } from './font';
import { P } from './palette';

// Piezas comunes de la interfaz: placas planas, formato de cifras y contador rodante.

// Decimales con coma en todas las cifras, como se escriben en español
const comma = (s: string) => s.replace('.', ',');
export const fmtMs = (ms: number | null) =>
  ms === null ? '-' : ms < 1000 ? `${Math.round(ms)} MS` : `${comma((ms / 1000).toFixed(ms < 10000 ? 2 : 1))} S`;
export const fmtUsd = (v: number) => (v === 0 ? '$0' : `$${comma(v.toFixed(v < 0.01 ? 5 : 3))}`);
/** Importes pequeños con dos cifras significativas (p. ej. $0,000035). */
export const fmtUsdSmall = (v: number | null) =>
  v === null ? '-' : v === 0 ? '$0' : `$${comma(v.toFixed(Math.max(2, 1 - Math.floor(Math.log10(v)))))}`;
export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtSec = (s: number) => comma(s.toFixed(1));

/** Curvas: salida exponencial para lo que entra; entrada-salida para lo que viaja. */
export const easeOut = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
export const easeInOut = (p: number) => {
  const x = Math.min(1, Math.max(0, p));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Placa plana con borde de 1 px. */
export function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, edge: string = P.night) {
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Iconos de 7x7 para los contadores (acierto, error, perdido). */
const MINI: Record<'ok' | 'bad' | 'lost', string[]> = {
  ok: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....', '.......'],
  bad: ['##...##', '.##.##.', '..###..', '..###..', '.##.##.', '##...##', '.......'],
  lost: ['.#####.', '#.....#', '#.###.#', '#.#.#.#', '#...#.#', '.####.#', '.......'],
};

export function mini(ctx: CanvasRenderingContext2D, kind: keyof typeof MINI, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  MINI[kind].forEach((row, ry) => {
    for (let rx = 0; rx < 7; rx++) if (row[rx] === '#') ctx.fillRect(x + rx, y + ry, 1, 1);
  });
}

/**
 * Contador con giro de dígitos en celdas de ancho fijo: las cifras se alinean por la derecha y
 * sólo rueda la que cambia, en 80 ms, para que el número nunca se lea roto.
 */
export class Rolling {
  private shown = '';
  private prev = '';
  private since = -1;

  draw(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, color: string, scale: number, t: number) {
    const now = String(value);
    if (!this.shown) this.shown = this.prev = now;
    else if (now !== this.shown) {
      this.prev = this.shown;
      this.shown = now;
      this.since = t;
    }
    const len = Math.max(now.length, this.prev.length);
    const cur = now.padStart(len, ' ');
    const old = this.prev.padStart(len, ' ');
    const cell = 6 * scale;
    const ch = 7 * scale;
    const p = Math.min(1, (t - this.since) / 0.08);
    const off = Math.round(easeOut(p) * (ch + 2));
    // Las celdas vacías de la izquierda no ocupan sitio cuando el número ya se ha asentado
    const skip = p >= 1 ? len - now.length : 0;
    let cx = x;
    for (let i = skip; i < len; i++) {
      const glyph = (c: string, yy: number) => {
        if (c === ' ') return;
        const dx = Math.round((5 * scale - measure(c, scale)) / 2);
        text(ctx, c, cx + dx, yy, color, { scale, outline: P.night });
      };
      if (p < 1 && old[i] !== cur[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - 1, y - 1, cell, ch + 2);
        ctx.clip();
        glyph(old[i], y - off);
        glyph(cur[i], y + ch + 2 - off);
        ctx.restore();
      } else glyph(cur[i], y);
      cx += cell;
    }
    return cx;
  }
}
