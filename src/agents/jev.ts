import type { Case } from '../sim/cases';
import { REGLAMENTO, SEAL_CRITERIA, SEALS, type Seal } from '../sim/rules';
import { errMsg, post } from './http';
import { estimateTokens, jevCost } from './pricing';
import type { Agent, AgentResult, DecideCtx } from './types';

export const JEV_INSTRUCTIONS =
  'Lee el parte de rayos X del equipaje y aplica el reglamento. ¿Qué decisión le corresponde? ' +
  'Si se cumplen varias reglas, manda la de mayor prioridad: alerta > retirar > revisar > pasa.';

/** Petición de Jev: el reglamento como contexto y los cuatro sellos como espacio de salida tipado. */
export function jevRequest(c: Case) {
  return {
    state: { rol: 'Agente del control de seguridad de un aeropuerto', reglamento: REGLAMENTO, parte_rayos_x: c.text },
    questions: { decision: { type: 'choice', instructions: JEV_INSTRUCTIONS, criteria: SEAL_CRITERIA } },
  };
}

/** Lee la respuesta de Jev: elección y confianza (probabilidad de la opción elegida). */
export function parseJev(answers: any): { seal: Seal | null; confidence?: number } {
  const a = answers?.decision;
  const choice = typeof a === 'string' ? a : a?.choice;
  if (typeof choice !== 'string' || !(SEALS as readonly string[]).includes(choice)) return { seal: null };
  const unit = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : undefined);
  return { seal: choice as Seal, confidence: unit(a?.probabilities?.[choice]) ?? unit(a?.confidence) };
}

// Jev (TypeSafe AI): una pregunta de tipo choice por paquete.
export class JevAgent implements Agent {
  readonly name = 'Jev';
  readonly firstStage = 'jev';

  constructor(readonly model = 'jev', private base = '') {}

  async decide(c: Case, ctx: DecideCtx): Promise<AgentResult> {
    const t0 = performance.now();
    try {
      const { ok, status, json, latencyMs } = await post(`${this.base}/api/jev`, jevRequest(c), ctx.signal);
      if (!ok) {
        const msg = json?.message || json?.error?.message || (typeof json?.detail === 'string' ? json.detail : '');
        return { seal: null, latencyMs, costUsd: 0, error: msg || `HTTP ${status}` };
      }
      // Coste real del gateway; si no viene, se calcula con los tokens de entrada
      const gateway = Number(json?.providerMetadata?.gateway?.cost ?? json?.provider_metadata?.gateway?.cost);
      const tokens = Number(json?.usage?.inputTokens ?? json?.usage?.input_tokens ?? 0);
      const costUsd = Number.isFinite(gateway) && gateway > 0 ? gateway : jevCost(tokens || estimateTokens(JSON.stringify(jevRequest(c))));
      const r = parseJev(json.answers);
      return { ...r, latencyMs, costUsd, error: r.seal ? undefined : 'respuesta sin sello' };
    } catch (e) {
      return { seal: null, latencyMs: performance.now() - t0, costUsd: 0, error: errMsg(e) };
    }
  }

  abandonCost(c: Case): number {
    return jevCost(estimateTokens(JSON.stringify(jevRequest(c))));
  }
}
