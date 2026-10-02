// Calibración sin interfaz: aplica el calendario de fases a agentes con distintas latencias y
// cuenta paquetes sellados y perdidos por fase. El objetivo del plan: en la fase 1 todos llegan;
// en la fase 4 Jev llega y el LLM no.
// Uso: npx tsx scripts/sim-check.ts                      (latencias simuladas, las de ?mock)
//      npx tsx scripts/sim-check.ts logs/latencias-X.json (latencias medidas con npm run latency)
import { readFileSync } from 'node:fs';
import { PHASES } from '../src/config';
import { sampleLatency } from '../src/agents/mock';
import { mulberry32 } from '../src/sim/rng';
import { buildSchedule } from '../src/sim/schedule';

interface Profile {
  name: string;
  /** Devuelve la latencia de una decisión (ms). */
  sample: (rnd: () => number) => number;
}

// FASES="2,3;1,2;0.7,1.5;0.45,1.2" prueba otros ritmos (cada cuánto llega un paquete, segundos de cinta)
if (process.env.FASES) {
  process.env.FASES.split(';').forEach((f, i) => {
    const [everyS, transitS] = f.split(',').map(Number);
    Object.assign(PHASES[i], { everyS, transitS });
  });
  console.log('Fases:', PHASES.map((p) => `${p.everyS}/${p.transitS}`).join(' · '));
}

const file = process.argv[2];
const measured = file ? (JSON.parse(readFileSync(file, 'utf8')) as { jev: { ms: number }[]; llm: { ms: number }[] }) : null;
const pickFrom = <T>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

const profiles: Profile[] = measured
  ? [
      { name: 'LLM', sample: (r) => pickFrom(measured.llm, r).ms },
      { name: 'Jev', sample: (r) => pickFrom(measured.jev, r).ms },
    ]
  : [
      { name: 'LLM', sample: (r) => sampleLatency([650, 1150], r) },
      { name: 'Jev', sample: (r) => sampleLatency([280, 380], r) },
    ];

function run(p: Profile, seed: number) {
  const rnd = mulberry32(seed);
  const sched = buildSchedule(Number(process.env.RITMO) || 1);
  const done = sched.map(() => false);
  const sealed = PHASES.map(() => 0);
  const lost = PHASES.map(() => 0);
  let t = 0;
  const recent: number[] = [];
  const cut: number[] = []; // duraciones de llamadas cortadas: sólo cuentan si no hay completas
  // Misma estimación que el juego: percentil 80 de las últimas 20 duraciones
  const estimate = () => {
    const src = recent.length ? recent : cut;
    if (!src.length) return 0;
    const s = [...src].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.8))];
  };
  for (;;) {
    // Los que caducan antes de que el agente los coja se pierden. Misma política que el
    // juego: el más antiguo que aún se pueda sellar; si ninguno, el último
    let cand = -1;
    let last = -1; // la más reciente aún en la cinta
    const est = estimate();
    for (const a of sched) {
      if (done[a.idx] || a.atMs > t) continue;
      if (a.atMs + a.transitMs <= t) {
        done[a.idx] = true;
        lost[a.phase]++;
        continue;
      }
      last = a.idx;
      if (cand < 0 && a.atMs + a.transitMs - t >= est) cand = a.idx;
    }
    // Ninguna da tiempo: espera a la siguiente llegada (o a que caigan las que quedan)
    if (cand < 0) {
      const next = sched.find((a) => !done[a.idx] && a.atMs > t);
      if (next) t = next.atMs;
      else if (last >= 0) t = sched[last].atMs + sched[last].transitMs;
      else break;
      continue;
    }
    const a = sched[cand];
    const ms = p.sample(rnd);
    const end = t + ms;
    const deadline = a.atMs + a.transitMs;
    done[cand] = true;
    if (end >= deadline) {
      lost[a.phase]++;
      cut.push(deadline - t);
      if (cut.length > 20) cut.shift();
      t = deadline;
    } else {
      sealed[a.phase]++;
      t = end;
      recent.push(ms);
      if (recent.length > 20) recent.shift();
    }
  }
  return { sealed, lost };
}

const RUNS = 20;
console.log(measured ? `Latencias medidas: ${file}` : 'Latencias simuladas (las de ?mock)');
for (const p of profiles) {
  const sealed = PHASES.map(() => 0);
  const lost = PHASES.map(() => 0);
  for (let s = 1; s <= RUNS; s++) {
    const r = run(p, s);
    r.sealed.forEach((v, i) => (sealed[i] += v / RUNS));
    r.lost.forEach((v, i) => (lost[i] += v / RUNS));
  }
  const cells = PHASES.map((_, i) => {
    const total = sealed[i] + lost[i];
    return `F${i + 1} ${Math.round((lost[i] / total) * 100).toString().padStart(3)}% perdidos`;
  });
  console.log(`${p.name.padEnd(8)} | ${cells.join(' | ')}`);
}
