// Parámetros de la partida, calibrados con latencias reales (partida del 01/10/2026, semilla 7813:
// DeepSeek p50 900 ms, Jev p50 309 ms). Recalibrar con npm run latency + test:sim si cambian.

export interface PhaseDef {
  name: string;
  durationS: number;
  everyS: number; // un paquete nuevo cada X segundos
  transitS: number; // lo que tarda un paquete en recorrer la cinta
}

export const PHASES: PhaseDef[] = [
  { name: 'MADRUGADA', durationS: 45, everyS: 2.0, transitS: 3.0 },
  { name: 'PRIMEROS VUELOS', durationS: 45, everyS: 0.9, transitS: 1.8 },
  { name: 'HORA PUNTA', durationS: 45, everyS: 0.6, transitS: 1.3 },
  { name: 'OPERACIÓN SALIDA', durationS: 45, everyS: 0.4, transitS: 1.0 },
];

export const GAME_S = PHASES.reduce((a, p) => a + p.durationS, 0);

export const POINTS = {
  acierto: 10,
  error: -5,
  perdido: 0, // una bandeja sin decidir no suma, pero tampoco resta: sólo restan los errores
  alertaPasa: -25, // dejar pasar un equipaje que era alerta
};

/**
 * Ritmo de las fases según el razonamiento del LLM (multiplica cada cuánto llega una bandeja y
 * cuánto dura en la cinta). Calibrado con partidas reales: sin razonamiento DeepSeek tarda ~0,8 s
 * (x1), con razonamiento bajo ~1,25 s (x1,8, con margen para sus rachas lentas) y con alto ~1,5 s
 * (x2,3). El de máximo es estimado.
 * ?ritmo=1.5 en la URL lo fuerza.
 */
export const PACE_BY_THINKING: Record<string, number> = { off: 1, low: 1.8, high: 2.3, max: 3 };

export const AGENT_TIMEOUT_MS = 20000;
/** Tras un error de la API, el agente espera esto antes de volver a intentarlo. */
export const ERROR_COOLDOWN_MS = 1000;

/** Modo precisión: casos por mostrador; los paquetes esperan lo que haga falta. */
export const PRECISION_CASES = 40;
export const PRECISION_RIDE_MS = 600;

/**
 * Al terminar, cada mostrador analiza sin prisa las bandejas que se le quedaron sin decidir, para
 * saber cuánto habría acertado con tiempo para todas. Llamadas en paralelo a la vez.
 */
export const HINDSIGHT_CONCURRENCY = 6;
