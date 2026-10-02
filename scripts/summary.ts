// Resume varias partidas guardadas con la tecla S: media y desviación por mostrador.
// El plan pide al menos 5 ejecuciones por configuración, no sólo la mejor.
// Uso: npx tsx scripts/summary.ts logs/control-*.json
import { readFileSync } from 'node:fs';
import type { GameLog } from '../src/game';

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Uso: npx tsx scripts/summary.ts <partida.json> [...]');
  process.exit(1);
}
const logs = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as GameLog);
const modes = new Set(logs.map((l) => l.mode));
if (modes.size > 1) console.log('Aviso: mezcla de modos', [...modes].join(', '));

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const fmt = (a: number[], d = 0) => `${mean(a).toFixed(d)} ± ${sd(a).toFixed(d)}`;

console.log(`${logs.length} partidas · semillas ${logs.map((l) => l.seed).join(', ')}`);
console.log(`fechas ${logs.map((l) => l.date.slice(0, 10)).join(', ')}\n`);
const names = logs[0].lanes.map((l) => l.name);
for (const [i, name] of names.entries()) {
  const per = logs.map((log) => {
    const r = log.lanes[i].records;
    const decided = r.filter((x) => x.outcome !== 'perdido');
    const lat = r.filter((x) => x.latencyMs !== null).map((x) => x.latencyMs!);
    return {
      puntos: r.reduce((a, x) => a + x.points, 0),
      aciertos: r.filter((x) => x.outcome === 'acierto').length,
      perdidos: r.filter((x) => x.outcome === 'perdido').length,
      precision: decided.length ? decided.filter((x) => x.outcome === 'acierto').length / decided.length : 0,
      // Precisión con tiempo: lo decidido más el análisis posterior de las que cayeron (si lo hay)
      conTiempo: log.lanes[i].hindsight?.finished
        ? (() => {
            const h = log.lanes[i].hindsight!;
            const n = decided.length + h.done - h.failed;
            return n ? (decided.filter((x) => x.outcome === 'acierto').length + h.correct) / n : null;
          })()
        : null,
      latencia: mean(lat),
      // Incluye las llamadas del análisis posterior, que también se pagan
      coste: r.reduce((a, x) => a + x.costUsd, 0) + (log.lanes[i].hindsight?.costUsd ?? 0),
    };
  });
  console.log(`${name} (${logs[0].lanes[i].model})`);
  console.log(`  puntos     ${fmt(per.map((p) => p.puntos))}`);
  console.log(`  aciertos   ${fmt(per.map((p) => p.aciertos))}`);
  console.log(`  perdidos   ${fmt(per.map((p) => p.perdidos))}`);
  console.log(`  precisión  ${fmt(per.map((p) => p.precision * 100), 1)} %`);
  const ct = per.map((p) => p.conTiempo).filter((v): v is number => v !== null);
  if (ct.length) console.log(`  con tiempo ${fmt(ct.map((v) => v * 100), 1)} % (${ct.length} partidas)`);
  console.log(`  latencia   ${fmt(per.map((p) => p.latencia))} ms`);
  console.log(`  coste      $${fmt(per.map((p) => p.coste), 5)}\n`);
}
