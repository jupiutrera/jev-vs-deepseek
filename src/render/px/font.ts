// Fuente bitmap propia (heredada de Jev vs DeepSeek): mayúsculas de 5x7 con dos filas extra para tildes.
// Todo el texto se dibuja píxel a píxel y se cachea por (texto, color, escala, borde).

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': ['#', '.', '#', '#', '#', '#', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
  '✓': ['.....', '....#', '....#', '...#.', '#.#..', '.#...', '.....'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  ';': ['..', '.#', '..', '..', '..', '.#', '#.'],
  '✗': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '■': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
  '▸': ['....', '#...', '##..', '###.', '##..', '#...', '....'],
};

const ACUTE = ['...#.', '..#..'];
const TILDE = ['.##.#', '#.##.'];
const ACCENTED: Record<string, [string, string[]]> = {
  Á: ['A', ACUTE],
  É: ['E', ACUTE],
  Í: ['I', ['..#', '.#.']],
  Ó: ['O', ACUTE],
  Ú: ['U', ACUTE],
  Ñ: ['N', TILDE],
  Ü: ['U', ['.#.#.', '.....']],
};

export const GLYPH_H = 9; // 2 filas de tilde + 7 de mayúscula
export const CAP_TOP = 2;

function glyph(ch: string): string[] {
  const acc = ACCENTED[ch];
  if (acc) {
    const base = G[acc[0]];
    const w = base[0].length;
    const marks = acc[1].map((r) => r.padEnd(w, '.').slice(0, w));
    return [...marks, ...base];
  }
  const g = G[ch] ?? G['?'];
  const blank = '.'.repeat(g[0].length);
  return [blank, blank, ...g];
}

export function measure(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text.toUpperCase()) w += (glyph(ch)[0].length + 1) * scale;
  return Math.max(0, w - scale);
}

interface TextOpts {
  scale?: number;
  outline?: string;
  shadow?: string;
  align?: 'left' | 'center' | 'right';
}

/** Parte un texto en líneas que caben en `maxW` píxeles. */
export function wrap(str: string, maxW: number, scale = 1): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of str.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, scale) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const cache = new Map<string, HTMLCanvasElement>();

function render(text: string, color: string, scale: number, outline?: string, shadow?: string): HTMLCanvasElement {
  const key = `${text}|${color}|${scale}|${outline ?? ''}|${shadow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // El borde y la sombra miden siempre 1 píxel lógico, a cualquier escala
  const pad = outline || shadow ? 1 : 0;
  const w = measure(text, scale) + pad * 2;
  const h = GLYPH_H * scale + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w);
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const pixels: [number, number][] = [];
  let x = 0;
  for (const ch of text.toUpperCase()) {
    const g = glyph(ch);
    g.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') pixels.push([x + i, y]);
    });
    x += g[0].length + 1;
  }
  const plot = (dx: number, dy: number, col: string) => {
    ctx.fillStyle = col;
    for (const [px, py] of pixels) ctx.fillRect(pad + px * scale + dx, pad + py * scale + dy, scale, scale);
  };
  if (shadow) plot(1, 1, shadow);
  if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) plot(dx, dy, outline);
  plot(0, 0, color);
  if (cache.size > 800) cache.clear();
  cache.set(key, cv);
  return cv;
}

/** Dibuja texto con la parte superior de la mayúscula en `y`. */
export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, opts: TextOpts = {}) {
  const scale = opts.scale ?? 1;
  const cv = render(str, color, scale, opts.outline, opts.shadow);
  const pad = opts.outline || opts.shadow ? 1 : 0;
  const w = cv.width - pad * 2;
  let dx = x;
  if (opts.align === 'center') dx = x - Math.round(w / 2);
  else if (opts.align === 'right') dx = x - w;
  ctx.drawImage(cv, Math.round(dx - pad), Math.round(y - CAP_TOP * scale - pad));
}
