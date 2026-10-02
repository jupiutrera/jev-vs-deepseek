import type { PkgKind } from '../../sim/cases';
import { SEALS, type Seal } from '../../sim/rules';
import { P, PIX, SEAL_COLOR } from './palette';

// Sprites hechos en código: rejillas de letras (ver PIX) o primitivas de píxel.

const PACKAGES: Record<PkgKind, string[]> = {
  maleta: [
    '....kkkkkk....', '....k....k....', '.kkkkkkkkkkkk.', '.kNNNNNNNNNNk.', '.kNbNNNNNNbNk.', '.kNbNNNNNNbNk.',
    '.kNbNNNNNNbNk.', '.kNbNNNNNNbNk.', '.kNbNNNNNNbNk.', '.kNNNNNNNNNNk.', '.kkkkkkkkkkkk.', '..kk......kk..',
  ],
  mochila: [
    '....kkkkk....', '...k.....k...', '..kkkkkkkkk..', '.koooooooook.', '.korrrrrrrok.', '.korooooorok.',
    '.koroyyyorok.', '.korooooorok.', '.korrrrrrrok.', '.koooooooook.', '..kkkkkkkkk..',
  ],
  bolso: [
    '....kkkkk....', '...k.....k...', '..k.......k..', '.kkkkkkkkkkk.', '.kvvvvvvvvvk.', '.kvvvvyvvvvk.',
    '.kvvvvvvvvvk.', '.kvvvvvvvvvk.', '..kkkkkkkkk..',
  ],
  neceser: [
    '.kkkkkkkkkkk.', 'kccccccccccck', 'kSSSSSSSSSSSk', 'kccccccccccck', 'kcccccyccccck', 'kccccccccccck', '.kkkkkkkkkkk.',
  ],
  bandeja: ['...bbb...yy...', '..bbbbb.yyyy..', 'kkkkkkkkkkkkkk', 'kSSSSSSSSSSSSk', 'kssssssssssssk', '.kkkkkkkkkkkk.'],
  funda: ['.kkkkkkkkkkkk.', 'kNNNNNNNNNNNNk', 'kNllllllllllNk', 'kNNNNNNNNNNNNk', 'kNNNNNNNNNNNNk', 'kNNNNNNNNNNNNk', '.kkkkkkkkkkkk.'],
  caja: [
    'kkkkkkkkkkkkkk', 'kWWWWWWWWWWWWk', 'kwwwwwwwwwwwwk', 'kWWWWWWWWWWWWk', 'kWWwWWWWWWwWWk', 'kWWWwWWWWwWWWk',
    'kWWWWwWWwWWWWk', 'kWWWWWwwWWWWWk', 'kWWWWwWWwWWWWk', 'kwwwwwwwwwwwwk', 'kWWWWWWWWWWWWk', 'kkkkkkkkkkkkkk',
  ],

};

const cache = new Map<string, HTMLCanvasElement>();

function fromGrid(key: string, rows: string[], recolor?: string): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = rows.length;
  const ctx = cv.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      ctx.fillStyle = recolor && c !== 'k' ? recolor : PIX[c];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, cv);
  return cv;
}

/** Paquete apoyado en (cx, bottom). `flash` lo pinta en rojo (a punto de caer). */
export function drawPackage(ctx: CanvasRenderingContext2D, kind: PkgKind, cx: number, bottom: number, flash = false) {
  const cv = fromGrid(`pkg:${kind}:${flash}`, PACKAGES[kind], flash ? P.red : undefined);
  ctx.drawImage(cv, Math.round(cx - cv.width / 2), Math.round(bottom - cv.height));
}

// Sellos: forma propia + icono propio + color, para que se distingan también sin color.
const ICONS: Record<Seal, string[]> = {
  pasa: ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
  retirar: ['##....##', '###..###', '.######.', '..####..', '..####..', '.######.', '###..###', '##....##'],
  revisar: ['.####...', '#....#..', '#....#..', '#....#..', '.####...', '....##..', '.....##.', '......##'],
  alerta: ['...##...', '..####..', '..####..', '..####..', '...##...', '........', '...##...', '...##...'],
};

function inShape(s: Seal, x: number, y: number): boolean {
  const cx = x - 7.5;
  const cy = y - 7.5;
  if (s === 'pasa') return cx * cx + cy * cy <= 7.6 * 7.6; // círculo
  if (s === 'retirar') return x >= 1 && x <= 14 && y >= 1 && y <= 14; // cuadrado
  if (s === 'revisar') return Math.abs(cx) + Math.abs(cy) <= 9.2 && Math.abs(cx) <= 7.5 && Math.abs(cy) <= 7.5; // octógono
  return y >= 1 && Math.abs(cx) <= (y + 1) / 2 + 0.6; // triángulo
}

/** Insignia de sello de 16x16. */
export function sealBadge(s: Seal): HTMLCanvasElement {
  const key = `seal:${s}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 16;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inShape(s, x, y)) continue;
      const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => !inShape(s, x + dx, y + dy));
      ctx.fillStyle = edge ? P.stoneLight : SEAL_COLOR[s];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const icon = ICONS[s];
  const oy = s === 'alerta' ? 6 : 4;
  ctx.fillStyle = s === 'revisar' ? P.slate : P.parchment;
  icon.forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (row[x] === '#') ctx.fillRect(4 + x, oy + y, 1, 1);
  });
  cache.set(key, cv);
  return cv;
}

export function drawSeal(ctx: CanvasRenderingContext2D, s: Seal, x: number, y: number) {
  ctx.drawImage(sealBadge(s), Math.round(x), Math.round(y));
}

/** Cubeta de 32x24 con la insignia de la decisión. */
export function drawBin(ctx: CanvasRenderingContext2D, x: number, y: number, s: Seal, hit: number) {
  const dy = hit < 0.25 ? (Math.floor(hit * 24) % 2 ? -1 : 1) : 0;
  y += dy;
  ctx.fillStyle = P.slate;
  ctx.fillRect(x, y, 32, 24);
  ctx.fillStyle = P.night;
  ctx.fillRect(x + 1, y + 1, 30, 4);
  ctx.fillStyle = P.stone;
  ctx.fillRect(x + 1, y + 5, 30, 18);
  ctx.fillStyle = P.slate;
  for (const py of [10, 16, 22]) ctx.fillRect(x + 1, y + py, 30, 1);
  ctx.fillRect(x + 1, y + 5, 30, 1);
  ctx.fillStyle = SEAL_COLOR[s];
  ctx.fillRect(x + 1, y + 1, 30, 1);
  drawSeal(ctx, s, x + 8, y + 6);
  if (hit < 0.12) {
    ctx.fillStyle = 'rgba(244,244,244,0.5)';
    ctx.fillRect(x + 1, y + 1, 30, 22);
  }
}

/** Cinta transportadora de alto 12; `offset` en píxeles hace avanzar las juntas. */
export function drawBelt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, offset: number) {
  ctx.fillStyle = P.slate;
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = P.stone;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = P.night;
  ctx.fillRect(x, y + 1, w, 5);
  ctx.fillStyle = P.slate;
  const o = ((offset % 8) + 8) % 8;
  for (let px = x - 8 + o; px < x + w; px += 8) if (px >= x) ctx.fillRect(Math.floor(px), y + 1, 2, 5);
  // Rodillos
  ctx.fillStyle = P.navy;
  ctx.fillRect(x, y + 7, w, 4);
  const ro = Math.floor(o / 2) % 4;
  for (let px = x + 2; px < x + w - 2; px += 8) {
    ctx.fillStyle = P.stone;
    ctx.fillRect(px, y + 7, 4, 4);
    ctx.fillStyle = P.stoneLight;
    ctx.fillRect(px + (ro < 2 ? ro : 3 - ro) + 1, y + 8, 1, 2);
  }
  ctx.fillStyle = P.night;
  ctx.fillRect(x, y + 11, w, 1);
}

/** Foso de perdidos: agujero con remolino. */
/** Carro de rejilla al final de la cinta: aquí acaba el equipaje que nadie decidió a tiempo. */
export function drawPit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hit: number) {
  ctx.fillStyle = hit < 0.3 ? P.red : P.stoneLight;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.night;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Rejilla metálica
  ctx.fillStyle = P.slate;
  for (let gx = x + 4; gx < x + w - 1; gx += 4) ctx.fillRect(gx, y + 1, 1, h - 2);
  for (let gy = y + 5; gy < y + h - 1; gy += 4) ctx.fillRect(x + 1, gy, w - 2, 1);
}

/**
 * Máquina de rayos X a la entrada de la cinta: las bandejas salen de debajo de sus cortinas.
 * Ocupa de x a x+w y se apoya en la cinta (bottom). `scan` (0..1) es la barra de carga del panel:
 * se llena hasta que sale la siguiente bandeja; null la deja vacía.
 */
export function drawXray(ctx: CanvasRenderingContext2D, x: number, bottom: number, w: number, t: number, scan: number | null) {
  const h = 30;
  const y = bottom - h;
  ctx.fillStyle = P.night;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.stoneLight;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = P.stone;
  ctx.fillRect(x + 1, y + h - 8, w - 2, 7);
  // Boca del túnel con cortinas de lamas que se mueven al paso de la cinta
  ctx.fillStyle = P.night;
  ctx.fillRect(x + w - 10, y + 9, 9, h - 9);
  ctx.fillStyle = P.slate;
  const sway = Math.floor(t * 6) % 2;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + w - 9 + i * 3 + (i === 1 ? sway : 0), y + 10, 2, h - 12);
  // Piloto verde de encendido y rótulo
  ctx.fillStyle = Math.floor(t * 2) % 2 ? P.green : P.lime;
  ctx.fillRect(x + 4, y + 4, 2, 2);
  ctx.fillStyle = P.navy;
  ctx.fillRect(x + 4, y + 9, w - 18, 8);
  if (scan !== null) {
    ctx.fillStyle = P.cyan;
    const bw = Math.round(Math.max(0, Math.min(1, scan)) * (w - 20));
    if (bw > 0) ctx.fillRect(x + 5, y + 12, bw, 2);
  }
}

/** Mancha de tinta al estampar: anillo que se abre en 4 fotogramas. */
export function drawImpact(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number, color: string) {
  const f = Math.min(3, Math.floor(p * 4));
  const rr = 4 + f * 3;
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + f * 0.2;
    const len = f === 3 ? 1 : 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.7), len, len);
  }
}

/** Humo al caer al foso. */
export function drawSmoke(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number) {
  ctx.fillStyle = p < 0.5 ? P.stoneLight : P.stone;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    const d = 2 + p * 10;
    const s = p < 0.66 ? 3 : 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * d - s / 2), Math.round(cy + Math.sin(a) * d - s / 2), s, s);
  }
}

export const SEAL_ORDER = SEALS;
