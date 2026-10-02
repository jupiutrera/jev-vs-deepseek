// Comprueba el generador de casos: reparto de sellos, que las fichas quepan en pantalla y que
// un clasificador por palabras clave NO resuelva el reglamento (si lo hiciera, la demo no vale).
// Uso: npx tsx scripts/cases-check.ts [semilla] [--list]
import { FICHA_LINES, fichaLines, generateCases } from '../src/sim/cases';
import { buildSchedule } from '../src/sim/schedule';
import { SEALS, type Seal } from '../src/sim/rules';

const seed = Number(process.argv[2]) || 1;
const sched = buildSchedule();
const n = sched.length;
const cases = generateCases(seed, n, (i) => sched[i].phase);

// Clasificador ingenuo: lo que haría un `if` con palabras sueltas
function keywords(text: string): Seal {
  const t = text.toLowerCase();
  if (/petardo|bengala|pirotecnia|pistola|cables|gas|gasolina/.test(t)) return 'alerta';
  if (/litro|\d{3} ml|navaja|cuchillo|cúter|réplica|mecheros|destornillador|llave|alicates/.test(t)) return 'retirar';
  if (/portátil|tableta|opaca|polvo|harina|café molido|batería/.test(t)) return 'revisar';
  return 'pasa';
}

const dist: Record<string, number> = {};
let kwOk = 0;
let tooLong = 0;
let maxLines = 0;
for (const c of cases) {
  dist[c.seal] = (dist[c.seal] ?? 0) + 1;
  if (keywords(c.text) === c.seal) kwOk++;
  const lines = fichaLines(c.text).length;
  maxLines = Math.max(maxLines, lines);
  if (lines > FICHA_LINES) tooLong++;
}
const unique = new Set(cases.map((c) => c.text)).size;

console.log(`semilla ${seed} · ${n} casos (${unique} textos distintos)`);
console.log('reparto:', SEALS.map((s) => `${s} ${dist[s] ?? 0}`).join(' · '));
console.log(`fichas que no caben: ${tooLong} (máximo ${maxLines}/${FICHA_LINES} líneas)`);
console.log(`clasificador por palabras clave: ${kwOk}/${n} = ${Math.round((kwOk / n) * 100)}% de acierto`);

// Por fase: qué parte del acierto del clasificador ingenuo se mantiene al subir la dificultad
for (let ph = 0; ph < 4; ph++) {
  const cs = cases.filter((c) => sched[c.id].phase === ph);
  const ok = cs.filter((c) => keywords(c.text) === c.seal).length;
  const conflicts = cs.filter((c) => new Set(c.rules.map((r) => r[0])).size > 1).length;
  console.log(`  fase ${ph + 1}: ${cs.length} casos · palabras clave ${Math.round((ok / cs.length) * 100)}% · con reglas que chocan ${conflicts}`);
}

if (process.argv.includes('--list')) {
  for (const c of cases) console.log(`${String(c.id).padStart(3)} ${c.seal.padEnd(12)} ${c.rules.join(',').padEnd(8)} ${c.text}`);
}
if (tooLong) process.exit(1);
