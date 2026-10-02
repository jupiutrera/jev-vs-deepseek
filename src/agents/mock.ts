import type { Case } from '../sim/cases';
import { SEALS } from '../sim/rules';
import type { Agent, AgentResult, DecideCtx, Stage } from './types';

/** Latencia log-normal con percentiles 10 y 90 aproximados en [p10, p90]. */
export function sampleLatency([p10, p90]: [number, number], rnd = Math.random): number {
  const mu = (Math.log(p10) + Math.log(p90)) / 2;
  const sigma = (Math.log(p90) - Math.log(p10)) / 2.56;
  const g = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  return Math.exp(mu + sigma * g);
}

// Agente simulado para ensayar sin API: conoce el sello correcto y se equivoca con una tasa
// configurable. Cuando se equivoca suele declarar poca confianza (como haría un modelo calibrado).
export class MockAgent implements Agent {
  constructor(
    readonly name: string,
    readonly model: string,
    readonly firstStage: Stage,
    private latency: [number, number],
    private errorRate: number,
    private cost: number,
  ) {}

  async decide(c: Case, ctx: DecideCtx): Promise<AgentResult> {
    const ms = sampleLatency(this.latency);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      ctx.signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
    });
    const wrong = Math.random() < this.errorRate;
    const others = SEALS.filter((s) => s !== c.seal);
    const confidence = wrong
      ? Math.random() < 0.8 ? 0.35 + Math.random() * 0.35 : 0.8 + Math.random() * 0.15
      : 0.7 + Math.random() * 0.3;
    return { seal: wrong ? others[Math.floor(Math.random() * others.length)] : c.seal, confidence, latencyMs: ms, costUsd: this.cost };
  }

  abandonCost(): number {
    return this.cost * 0.9;
  }
}
