import { wrap } from '../render/px/font';
import { mulberry32 } from './rng';
import { PRIORITY, type Seal } from './rules';

// Generador de partes de rayos X con semilla fija. Cada fragmento lleva la regla que activa; la
// decisión correcta es la de mayor prioridad entre las reglas presentes. Las cifras (mililitros,
// centímetros, vatios hora, gramos) se generan para que haya que leerlas y compararlas, y hay
// trampas a propósito (medio litro, 0,1 l, duty-free sin precinto, juguetes, queso curado...).

export type PkgKind = 'maleta' | 'mochila' | 'bolso' | 'neceser' | 'bandeja' | 'funda' | 'caja';

export interface Case {
  id: number;
  kind: PkgKind;
  text: string;
  seal: Seal;
  rules: string[];
}

/** Espacio del monitor en pantalla: el texto debe caber aquí. */
export const FICHA_TEXT_W = 218;
export const FICHA_LINES = 4;

type Rule = 'A1' | 'A2' | 'A3' | 'A4' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'V1' | 'V2' | 'V3' | 'V4';
type Fixed = string | [string, Rule];
type Rng = () => number;
/**
 * Nivel de dificultad del parte (0 a 3, uno por fase): 0 cifras claras; 1 cifras al límite y
 * excepciones; 2 unidades mezcladas y reglas que chocan; 3 cuentas (mAh x V, suma de líquidos).
 */
type Level = number;
/** Un fragmento puede ser fijo o generarse con cifras según el nivel. */
type Frag = Fixed | ((rng: Rng, lvl: Level) => Fixed);

const pickR = <T>(rng: Rng, a: T[]) => a[Math.floor(rng() * a.length)];
const num = (v: number) => (v >= 1000 ? v.toLocaleString('es-ES') : String(v).replace('.', ','));

/** Líquidos: cuenta la capacidad del envase y si hay excepción (receta, bebé, duty-free). */
const liquid: Frag = (rng, lvl) => {
  const ml = pickR(rng, lvl === 0 ? [50, 75, 200, 250, 500, 700] : lvl === 1 ? [90, 100, 100, 110, 120, 150, 200] : [90, 100, 100, 110, 150, 250, 330, 500]);
  // A partir del nivel 2 las capacidades llegan en otras unidades
  const vol = (v: number) => {
    if (lvl < 2) return v === 100 && lvl === 1 && rng() < 0.4 ? '0,1 l' : `${v} ml`;
    const opts = [`${v} ml`];
    if (v % 10 === 0) opts.push(`${v / 10} cl`);
    if (v === 500) opts.push('medio litro');
    if (v === 250) opts.push('un cuarto de litro');
    opts.push(`${num(v / 1000)} l`);
    return pickR(rng, opts);
  };
  const plain: [string, boolean][] = [['Botella de agua', false], ['Champú', false], ['Perfume', false], ['Gel de ducha', false], ['Crema solar', false]];
  const tricky: [string, boolean][] = [
    ['Spray antimosquitos', false], ['Jarabe con receta médica', true], ['Jarabe sin receta', false], ['Leche para el bebé', true],
    ['Licor del duty-free en bolsa precintada con ticket', true], ['Licor del duty-free, sin bolsa precintada', false], ['Termo con café', false],
  ];
  const [name, exempt] = pickR(rng, lvl === 0 ? plain : [...plain, ...tricky]);
  const t = `${name}, ${vol(ml)}`;
  return ml > 100 && !exempt ? [t, 'R1'] : t;
};

/** Bolsa de líquidos (nivel 3): cada envase cumple, pero la suma no puede pasar de 1 litro. */
const liquidBag: Frag = (rng) => {
  const [n1, v1, n2, v2] = pickR(rng, [
    [6, 100, 5, 90], [8, 100, 2, 90], [5, 100, 10, 50], [7, 100, 4, 75], [9, 100, 2, 60], [10, 100, 1, 50], [4, 100, 6, 90], [3, 100, 9, 75],
  ]);
  const t = `Bolsa de líquidos: ${n1} envases de ${v1} ml y ${n2} de ${v2} ml`;
  return n1 * v1 + n2 * v2 > 1000 ? [t, 'R7'] : t;
};

/** Hojas: más de 6 cm se retiran (a partir del nivel 2, en milímetros). */
const blade: Frag = (rng, lvl) => {
  const name = pickR(rng, ['Navaja', 'Tijeras', 'Cúter', 'Cuchillo de cocina', 'Tijeras de uñas']);
  if (lvl >= 2) {
    const mm = pickR(rng, [45, 55, 60, 60, 65, 70, 80]);
    const t = `${name} con hoja de ${mm} mm`;
    return mm > 60 ? [t, 'R2'] : t;
  }
  const cm = pickR(rng, lvl === 0 ? [3, 4, 10, 12] : [5, 6, 6, 7, 8]);
  const t = `${name} con hoja de ${cm} cm`;
  return cm > 6 ? [t, 'R2'] : t;
};

/** Herramientas: más de 7 cm se retiran (a partir del nivel 2, en milímetros). */
const tool: Frag = (rng, lvl) => {
  const name = pickR(rng, ['Destornillador', 'Llave inglesa', 'Alicates', 'Llave allen']);
  if (lvl >= 2) {
    const mm = pickR(rng, [60, 65, 70, 70, 75, 90]);
    const t = `${name} de ${mm} mm`;
    return mm > 70 ? [t, 'R3'] : t;
  }
  const cm = pickR(rng, lvl === 0 ? [5, 15, 20] : [6, 7, 7, 8, 9]);
  const t = `${name} de ${cm} cm`;
  return cm > 7 ? [t, 'R3'] : t;
};

/**
 * Baterías externas: hasta 100 Wh pasan, de 100 a 160 Wh se revisan, más de 160 Wh se retiran.
 * En el nivel 3 vienen en mAh y voltios y hay que calcular Wh = mAh x V / 1000.
 */
const battery: Frag = (rng, lvl) => {
  let wh: number;
  let t: string;
  if (lvl >= 3) {
    const [mah, v] = pickR(rng, [
      [10000, 3.7], [20000, 3.7], [26800, 3.7], [27000, 3.7], [20000, 5], [30000, 3.7], [40000, 3.7], [43000, 3.7], [45000, 3.7], [50000, 3.85],
    ]);
    wh = (mah * v) / 1000;
    t = `Batería externa de ${num(mah)} mAh a ${num(v)} V`;
  } else {
    wh = pickR(rng, lvl === 0 ? [20, 50, 220] : lvl === 1 ? [99, 100, 110, 160, 170] : [74, 100, 130, 160, 180]);
    t = `Batería externa de ${wh} Wh`;
  }
  return wh > 160 ? [t, 'R5'] : wh > 100 ? [t, 'V4'] : t;
};

/** Polvo: más de 350 g se revisan (a partir del nivel 2, a veces en kilos). */
const powder: Frag = (rng, lvl) => {
  const g = pickR(rng, lvl === 0 ? [100, 1000] : [300, 350, 350, 400, 500]);
  const name = pickR(rng, ['Bote de proteínas en polvo', 'Bolsa de café molido', 'Paquete de harina', 'Bote de especias']);
  const q = lvl >= 2 && rng() < 0.6 ? (g === 500 ? 'medio kilo' : `${num(g / 1000)} kg`) : g >= 1000 ? '1 kg' : `${g} g`;
  const t = `${name}, ${q}`;
  return g > 350 ? [t, 'V3'] : t;
};

/** Objetos con el nivel mínimo en que aparecen: los señuelos y las variantes engañosas llegan después. */
const POOL: [Frag, Level][] = [
  [liquid, 0], [liquid, 0], [liquid, 0], [liquid, 1], [blade, 0], [blade, 1], [tool, 0], [battery, 0], [battery, 1], [powder, 0],
  [liquidBag, 3], [battery, 3], [battery, 3],
  ['Ropa doblada', 0], ['Un libro', 0], ['Gafas de sol', 0], ['Cargador de móvil', 0], ['Auriculares con cable', 1], ['Despertador con pila', 1],
  ['Cubiertos de plástico', 1], ['Una revista de pirotecnia', 1], ['Bloque de queso curado, identificado', 2], ['Pistola de agua de colores vivos', 1],
  ['Un mechero', 0], [['Dos mecheros', 'R6'], 0], [['Tres mecheros', 'R6'], 0], [['Un mechero y otro de repuesto', 'R6'], 2],
  [['Portátil sin sacar de la bolsa', 'V1'], 0], [['Tableta sin sacar de la bolsa', 'V1'], 0], ['Portátil en bandeja aparte', 1],
  [['Tableta dentro de su funda, sin sacar', 'V1'], 2], ['Portátil que el pasajero ya sacó a la bandeja', 2],
  [['Masa opaca que la máquina no identifica', 'V2'], 0],
  [['Réplica metálica de pistola', 'R4'], 0], [['Pistola de juguete realista', 'R4'], 1],
  [['Caja de petardos', 'A1'], 0], [['Bengala de barco', 'A1'], 0], [['Pistola real, descargada', 'A2'], 0],
  [['Cables con pila y temporizador, sin aparato', 'A3'], 0], [['Bombona de gas de camping', 'A4'], 0], [['Olor intenso a gasolina', 'A4'], 1],
];

const CONTAINERS: { kind: PkgKind; names: string[] }[] = [
  { kind: 'maleta', names: ['Maleta de mano', 'Maleta de cabina'] },
  { kind: 'mochila', names: ['Mochila', 'Mochila de viaje'] },
  { kind: 'bolso', names: ['Bolso', 'Bolso de mano'] },
  { kind: 'neceser', names: ['Neceser', 'Bolsa de aseo'] },
  { kind: 'bandeja', names: ['Bandeja', 'Bandeja suelta'] },
  { kind: 'funda', names: ['Funda de portátil', 'Funda de cámara'] },
  { kind: 'caja', names: ['Caja de cartón', 'Caja de regalo'] },
];

/** Proporción objetivo de cada decisión en la secuencia. */
const TARGETS: Seal[] = ['pasa', 'pasa', 'pasa', 'retirar', 'retirar', 'retirar', 'revisar', 'revisar', 'alerta', 'alerta'];

const fragText = (f: Fixed) => (typeof f === 'string' ? f : f[0]);
const fragRule = (f: Fixed) => (typeof f === 'string' ? null : f[1]);

export function sealFor(rules: string[]): Seal {
  const has = (c: string) => rules.some((r) => r[0] === c);
  return has('A') ? PRIORITY[0] : has('R') ? PRIORITY[1] : has('V') ? PRIORITY[2] : PRIORITY[3];
}

export const fichaLines = (text: string) => wrap(text, FICHA_TEXT_W);

/** Secuencia determinista de `n` casos para una semilla; `levelOf(i)` da la dificultad de cada uno. */
export function generateCases(seed: number, n: number, levelOf: (i: number) => Level = () => 0): Case[] {
  const rng = mulberry32(seed * 7919 + 17);
  const pick = <T>(a: T[]) => pickR(rng, a);

  const compose = (lvl: Level) => {
    const box = pick(CONTAINERS);
    const items = POOL.filter(([, min]) => min <= lvl).map(([f]) => f);
    const take = (a: Frag[]): Fixed => {
      const f = pick(a);
      return typeof f === 'function' ? f(rng, lvl) : f;
    };
    // Más objetos por bandeja según sube la dificultad (y más reglas que pueden chocar)
    const count = lvl === 0 ? (rng() < 0.6 ? 1 : 2) : lvl === 1 ? 2 : lvl === 2 ? (rng() < 0.5 ? 2 : 3) : 3;
    const parts: Fixed[] = [];
    for (let i = 0; i < count; i++) {
      const f = take(items);
      // Sin repetir el mismo tipo de objeto en una bandeja
      if (!parts.some((p) => fragText(p).slice(0, 12) === fragText(f).slice(0, 12))) parts.push(f);
    }
    const rules = parts.map(fragRule).filter((x): x is Rule => x !== null);
    return { kind: box.kind, text: `${pick(box.names)}: ${parts.map(fragText).join('. ')}.`, rules };
  };

  const out: Case[] = [];
  const recent = new Set<string>();
  for (let id = 0; id < n; id++) {
    const target = pick(TARGETS);
    const lvl = levelOf(id);
    let c = compose(lvl);
    for (let tries = 0; tries < 500; tries++) {
      const ok = sealFor(c.rules) === target && fichaLines(c.text).length <= FICHA_LINES && !recent.has(c.text);
      if (ok) break;
      c = compose(lvl);
    }
    out.push({ id, ...c, seal: sealFor(c.rules) });
    recent.add(c.text);
    if (recent.size > 40) recent.delete(recent.values().next().value!);
  }
  return out;
}
