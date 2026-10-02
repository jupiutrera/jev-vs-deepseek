import type { Case } from '../sim/cases';
import { REGLAMENTO, SEALS, type Seal } from '../sim/rules';
import { errMsg, post } from './http';
import { estimateTokens, llmCost, PRICES } from './pricing';
import type { Agent, AgentResult, DecideCtx } from './types';

// El reglamento va en el mensaje de sistema, idéntico en todas las llamadas, para que la
// caché de prompt de la API lo aproveche. La salida se restringe a un JSON con el sello.
export const SYSTEM = `Eres agente del control de seguridad de un aeropuerto. Para cada parte de rayos X de un equipaje decides qué le corresponde según este reglamento.

${REGLAMENTO}

Responde SOLO con JSON, sin explicaciones ni razonamiento: {"decision": "pasa" | "retirar" | "revisar" | "alerta"}`;

export const llmMessages = (c: Case) => [
  { role: 'system', content: SYSTEM },
  { role: 'user', content: `Parte de rayos X: ${c.text}` },
];

export function parseLlm(content: string): Seal | null {
  try {
    const v = String(JSON.parse(content)?.decision ?? '').trim().toLowerCase();
    return (SEALS as readonly string[]).includes(v) ? (v as Seal) : null;
  } catch {
    return null;
  }
}

// LLM tradicional vía /chat/completions, configurado de la forma más rápida razonable.
export class LlmAgent implements Agent {
  readonly firstStage = 'llm';

  constructor(readonly name: string, readonly model: string, private base = '') {}

  async decide(c: Case, ctx: DecideCtx): Promise<AgentResult> {
    const t0 = performance.now();
    try {
      const { ok, status, json, latencyMs } = await post(`${this.base}/api/llm`, { messages: llmMessages(c) }, ctx.signal);
      if (!ok) return { seal: null, latencyMs, costUsd: 0, error: json?.error?.message || `HTTP ${status}` };
      const costUsd = llmCost(json.usage ?? {});
      const seal = parseLlm(json.choices?.[0]?.message?.content ?? '');
      return { seal, latencyMs, costUsd, error: seal ? undefined : 'JSON inválido' };
    } catch (e) {
      return { seal: null, latencyMs: performance.now() - t0, costUsd: 0, error: errMsg(e) };
    }
  }

  abandonCost(c: Case): number {
    // La entrada se envía entera; se supone que el reglamento ya está en caché
    return (estimateTokens(SYSTEM) * PRICES.llmCached + estimateTokens(c.text) * PRICES.llmIn) / 1e6;
  }
}
