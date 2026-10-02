// Calibración con las APIs reales, a través del proxy (npm run dev o docker compose up).
// Lanza N fichas en serie a Jev y al LLM, mide latencia y acierto, y guarda las latencias en
// logs/latencias-<fecha>.json para alimentar npm run test:sim y ajustar las fases y el umbral.
// Uso: npx tsx scripts/latency-check.ts [n=40] [semilla=1] [http://localhost:5173]
import { mkdirSync, writeFileSync } from 'node:fs';
import { JevAgent } from '../src/agents/jev';
import { LlmAgent } from '../src/agents/llm';
import { setPrices } from '../src/agents/pricing';
import type { Agent } from '../src/agents/types';
import { generateCases } from '../src/sim/cases';

const n = Number(process.argv[2]) || 40;
const seed = Number(process.argv[3]) || 1;
const base = process.argv[4] ?? 'http://localhost:5173';

const status = await (await fetch(`${base}/api/status`)).json();
setPrices(status.prices);
if (!status.jev || !status.llm) console.log(`Aviso: faltan claves (jev ${status.jev}, llm ${status.llm})`);

// Mezcla de las cuatro dificultades, por tramos iguales
const cases = generateCases(seed, n, (i) => Math.floor((i * 4) / n));
const agents: Agent[] = [new JevAgent(status.jevModel, base), new LlmAgent(status.llmName, status.llmModel, base)];

const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const out: Record<string, { ms: number; ok: boolean; confidence?: number; seal: string | null; truth: string }[]> = { jev: [], llm: [] };
for (const [i, agent] of agents.entries()) {
  const key = i === 0 ? 'jev' : 'llm';
  let cost = 0;
  for (const c of cases) {
    const r = await agent.decide(c, { signal: new AbortController().signal });
    if (r.error && !r.seal) {
      console.log(`${agent.name} #${c.id}: ${r.error}`);
      continue;
    }
    cost += r.costUsd;
    out[key].push({ ms: r.latencyMs, ok: r.seal === c.seal, confidence: r.confidence, seal: r.seal, truth: c.seal });
  }
  const rows = out[key];
  const ms = rows.map((r) => r.ms);
  const acc = rows.filter((r) => r.ok).length / Math.max(1, rows.length);
  console.log(
    `${agent.name.padEnd(9)} ${rows.length}/${n} · p50 ${Math.round(pct(ms, 50))} ms · p90 ${Math.round(pct(ms, 90))} ms · máx ${Math.round(Math.max(...ms))} ms · acierto ${Math.round(acc * 100)}% · coste $${cost.toFixed(5)}`,
  );
}

mkdirSync('logs', { recursive: true });
const file = `logs/latencias-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify({ date: new Date().toISOString(), seed, status, ...out }, null, 1));
console.log(`\nGuardado ${file}. Siguiente paso: npx tsx scripts/sim-check.ts ${file}`);
