import type { Case } from '../sim/cases';
import type { Seal } from '../sim/rules';

export type Stage = 'jev' | 'llm';

export interface DecideCtx {
  signal: AbortSignal;
}

export interface AgentResult {
  seal: Seal | null;
  confidence?: number;
  /** Latencia medida en el servidor proxy (o en el cliente si no viene). */
  latencyMs: number;
  costUsd: number;
  error?: string;
}

export interface Agent {
  readonly name: string;
  readonly model: string;
  readonly firstStage: Stage;
  decide(c: Case, ctx: DecideCtx): Promise<AgentResult>;
  /** Coste estimado de una llamada abandonada (paquete perdido): la entrada ya se ha enviado. */
  abandonCost(c: Case, stage: Stage): number;
}
