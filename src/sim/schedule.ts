import { PHASES } from '../config';

export interface Arrival {
  idx: number; // índice del caso
  atMs: number; // instante de aparición en la cinta
  transitMs: number;
  phase: number;
}

/**
 * Llegadas de la partida cronometrada: idénticas para los dos mostradores. `pace` estira el ritmo
 * de todas las fases (cada cuánto llega una bandeja y cuánto dura en la cinta) sin cambiar su duración.
 */
export function buildSchedule(pace = 1): Arrival[] {
  const out: Arrival[] = [];
  let start = 0;
  PHASES.forEach((p, phase) => {
    const end = start + p.durationS * 1000;
    for (let t = start; t < end - 1; t += p.everyS * pace * 1000) {
      out.push({ idx: out.length, atMs: Math.round(t), transitMs: p.transitS * pace * 1000, phase });
    }
    start = end;
  });
  return out;
}

/** Fase en curso para un instante de partida. */
export function phaseAt(ms: number): number {
  let end = 0;
  for (let i = 0; i < PHASES.length; i++) {
    end += PHASES[i].durationS * 1000;
    if (ms < end) return i;
  }
  return PHASES.length - 1;
}

export function phaseStartMs(i: number): number {
  return PHASES.slice(0, i).reduce((a, p) => a + p.durationS * 1000, 0);
}
