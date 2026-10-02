import type { Agent, AgentResult, Stage } from './agents/types';
import { ERROR_COOLDOWN_MS, GAME_S, PHASES, POINTS, PRECISION_CASES } from './config';
import { generateCases, type Case } from './sim/cases';
import { SEALS, type Seal } from './sim/rules';
import { buildSchedule, phaseAt, phaseStartMs, type Arrival } from './sim/schedule';

export type Mode = 'cronometrado' | 'precision';
export type Phase = 'listo' | 'corriendo' | 'pausa' | 'fin';
export type Outcome = 'acierto' | 'error' | 'perdido';

export interface Pkg {
  c: Case;
  arriveMs: number;
  transitMs: number; // Infinity en modo precisión
  status: 'cinta' | 'sellado' | 'perdido';
  endMs?: number;
  seal?: Seal;
  correct?: boolean;
}

export interface DecisionRecord {
  caseId: number;
  truth: Seal;
  seal: Seal | null;
  outcome: Outcome;
  points: number;
  arriveMs: number;
  startMs: number | null; // null: el agente no llegó a cogerlo
  endMs: number;
  latencyMs: number | null; // medida en el proxy; null si se abandonó
  costUsd: number;
  confidence?: number;
  queue: number; // paquetes en cinta al empezar a leerlo
}

export type GameEvent =
  | { type: 'sello'; lane: number; seal: Seal; correct: boolean }
  | { type: 'perdido'; lane: number }
  | { type: 'fase'; phase: number }
  | { type: 'fin' };

export interface GameLog {
  version: 1;
  /** Factor que estira el ritmo de las fases (1 = el calibrado sin razonamiento). */
  pace: number;
  game: 'control-seguridad';
  date: string;
  seed: number;
  mode: Mode;
  phases: typeof PHASES;
  points: typeof POINTS;
  endMs: number | null;
  lanes: { name: string; model: string; records: DecisionRecord[]; apiErrors: { ms: number; error: string }[] }[];
  cases: { id: number; text: string; seal: Seal }[];
}

export function pointsFor(truth: Seal, seal: Seal | null): number {
  if (seal === null) return POINTS.perdido;
  if (seal === truth) return POINTS.acierto;
  return truth === 'alerta' && seal === 'pasa' ? POINTS.alertaPasa : POINTS.error;
}

export class Lane {
  pkgs: Pkg[] = [];
  /** Paquetes todavía en la cinta, del más antiguo al más nuevo. */
  active: Pkg[] = [];
  current: { pkg: Pkg; startMs: number; ctrl: AbortController; stage: Stage; queue: number } | null = null;
  records: DecisionRecord[] = [];
  apiErrors: { ms: number; error: string }[] = [];
  cooldownUntil = 0;
  lastSeal: { pkg: Pkg; ms: number } | null = null;
  binHit = SEALS.map(() => -1e9);
  lostHit = -1e9;
  spawned = 0;
  doneMs: number | null = null;

  constructor(readonly index: number, readonly agent: Agent) {}

  /**
   * Latencia con margen: el percentil 80 de las últimas llamadas completas (0 al principio). Con la
   * mediana, la mitad de las veces el agente se quedaba corto y encadenaba bandejas perdidas. Las
   * llamadas cortadas sólo cuentan mientras no hay ninguna completa: su duración es una cota
   * inferior y, mezclada con las demás, rebajaba la estimación justo cuando más falta hacía margen.
   */
  latencyEstimate(n = 20, q = 0.8): number {
    const done = this.records.filter((r) => r.latencyMs !== null).slice(-n).map((r) => r.latencyMs!);
    const lat = done.length
      ? done
      : this.records.filter((r) => r.startMs !== null).slice(-n).map((r) => r.endMs - r.startMs!);
    if (!lat.length) return 0;
    lat.sort((a, b) => a - b);
    return lat[Math.min(lat.length - 1, Math.floor(lat.length * q))];
  }

  stats() {
    let aciertos = 0, errores = 0, perdidos = 0, puntos = 0, cost = 0, lat = 0, nLat = 0;
    for (const r of this.records) {
      if (r.outcome === 'acierto') aciertos++;
      else if (r.outcome === 'error') errores++;
      else perdidos++;
      puntos += r.points;
      cost += r.costUsd;
      if (r.latencyMs !== null) {
        lat += r.latencyMs;
        nLat++;
      }
    }
    const decided = aciertos + errores;
    // Llamadas a la API: las decididas y las abandonadas porque el paquete cayó (también cuestan)
    const calls = this.records.filter((r) => r.startMs !== null).length;
    return {
      aciertos, errores, perdidos, puntos, cost, decided, calls,
      costPerCall: calls ? cost / calls : null,
      avgLatency: nLat ? lat / nLat : null,
      accuracy: decided ? aciertos / decided : null,
      lastError: this.apiErrors.length ? this.apiErrors[this.apiErrors.length - 1] : undefined,
    };
  }
}

export class Game {
  phase: Phase = 'listo';
  wallMs = 0;
  lanes: Lane[] = [];
  cases: Case[] = [];
  schedule: Arrival[];
  events: GameEvent[] = [];
  currentPhase = 0;
  endMs: number | null = null;
  private next = 0;
  private generation = 0;
  private date = '';

  constructor(private agents: Agent[], public seed: number, public mode: Mode, readonly pace = 1) {
    this.schedule = buildSchedule(pace);
    this.reset(seed, mode);
  }

  reset(seed = this.seed, mode = this.mode) {
    this.generation++;
    for (const l of this.lanes) l.current?.ctrl.abort();
    this.seed = seed;
    this.mode = mode;
    // La dificultad sube con la fase; en modo precisión, por tramos iguales de la secuencia
    this.cases =
      mode === 'precision'
        ? generateCases(seed, PRECISION_CASES, (i) => Math.floor((i * PHASES.length) / PRECISION_CASES))
        : generateCases(seed, this.schedule.length, (i) => this.schedule[i].phase);
    this.lanes = this.agents.map((a, i) => new Lane(i, a));
    this.phase = 'listo';
    this.wallMs = 0;
    this.next = 0;
    this.currentPhase = 0;
    this.endMs = null;
    this.events = [];
  }

  /** Para ensayar: arranca en una fase concreta, sin los paquetes anteriores. */
  skipToPhase(i: number) {
    if (this.mode !== 'cronometrado' || i <= 0) return;
    const ms = phaseStartMs(Math.min(i, PHASES.length - 1));
    this.wallMs = ms;
    this.currentPhase = phaseAt(ms);
    while (this.next < this.schedule.length && this.schedule[this.next].atMs < ms) this.next++;
  }

  togglePause() {
    if (this.phase === 'listo') {
      this.phase = 'corriendo';
      this.date = new Date().toISOString();
      if (this.mode === 'cronometrado') this.events.push({ type: 'fase', phase: 0 });
    } else if (this.phase === 'pausa') this.phase = 'corriendo';
    else if (this.phase === 'corriendo') this.phase = 'pausa';
  }

  /** Segundos de partida para el reloj. */
  get clockS() {
    return this.mode === 'cronometrado' ? Math.min(this.wallMs, GAME_S * 1000) / 1000 : this.wallMs / 1000;
  }

  update(dtMs: number) {
    if (this.phase !== 'corriendo') return;
    this.wallMs += Math.min(dtMs, 250);
    const now = this.wallMs;
    if (this.mode === 'cronometrado') this.updateTimed(now);
    else this.updatePrecision(now);
  }

  private updateTimed(now: number) {
    const ph = phaseAt(now);
    if (ph !== this.currentPhase && now < GAME_S * 1000) {
      this.currentPhase = ph;
      this.events.push({ type: 'fase', phase: ph });
    }
    // Mismos paquetes, mismo instante, en los tres mostradores
    while (this.next < this.schedule.length && this.schedule[this.next].atMs <= now) {
      const a = this.schedule[this.next++];
      for (const l of this.lanes) {
        const p: Pkg = { c: this.cases[a.idx], arriveMs: a.atMs, transitMs: a.transitMs, status: 'cinta' };
        l.pkgs.push(p);
        l.active.push(p);
      }
    }
    for (const l of this.lanes) {
      for (const p of [...l.active]) if (now >= p.arriveMs + p.transitMs) this.lose(l, p, now);
      this.maybeLaunch(l, now);
    }
    if (this.next >= this.schedule.length && this.lanes.every((l) => !l.active.length && !l.current)) this.finish(now);
  }

  private updatePrecision(now: number) {
    for (const l of this.lanes) {
      if (l.doneMs !== null) continue;
      if (!l.active.length && !l.current && l.spawned < this.cases.length) {
        const p: Pkg = { c: this.cases[l.spawned++], arriveMs: now, transitMs: Infinity, status: 'cinta' };
        l.pkgs.push(p);
        l.active.push(p);
      }
      this.maybeLaunch(l, now);
      if (l.spawned >= this.cases.length && !l.active.length && !l.current) l.doneMs = now;
    }
    if (this.lanes.every((l) => l.doneMs !== null)) this.finish(now);
  }

  private finish(now: number) {
    this.phase = 'fin';
    this.endMs = now;
    this.events.push({ type: 'fin' });
  }

  /**
   * Procesamiento secuencial: una bandeja a la vez. Se coge la más antigua que todavía se pueda
   * decidir con margen (percentil 80 de la latencia reciente del propio agente); si ninguna da
   * tiempo, espera a la siguiente. Así nadie pierde el tiempo con una bandeja que va a caer (es la
   * mejor estrategia para el agente lento, no la peor).
   */
  private maybeLaunch(l: Lane, now: number) {
    if (l.current || now < l.cooldownUntil || !l.active.length) return;
    const est = l.latencyEstimate();
    // Si ninguna da tiempo, espera a la siguiente: coger una condenada retrasa también a la que viene
    const pkg = l.active.find((p) => p.arriveMs + p.transitMs - now >= est);
    if (!pkg) return;
    const gen = this.generation;
    const ctrl = new AbortController();
    const queue = l.active.length;
    const cur = { pkg, startMs: now, ctrl, stage: l.agent.firstStage, queue };
    l.current = cur;
    l.agent
      .decide(pkg.c, { signal: ctrl.signal })
      .then((res) => {
        if (gen !== this.generation || ctrl.signal.aborted || pkg.status !== 'cinta') return;
        this.resolve(l, pkg, res, cur.startMs, queue);
      });
  }

  private resolve(l: Lane, pkg: Pkg, res: AgentResult, startMs: number, queue: number) {
    const now = this.wallMs;
    l.current = null;
    if (!res.seal) {
      l.apiErrors.push({ ms: now, error: res.error ?? 'sin respuesta' });
      l.cooldownUntil = now + ERROR_COOLDOWN_MS;
      return;
    }
    const correct = res.seal === pkg.c.seal;
    pkg.status = 'sellado';
    pkg.endMs = now;
    pkg.seal = res.seal;
    pkg.correct = correct;
    l.active.splice(l.active.indexOf(pkg), 1);
    l.records.push({
      caseId: pkg.c.id, truth: pkg.c.seal, seal: res.seal, outcome: correct ? 'acierto' : 'error',
      points: pointsFor(pkg.c.seal, res.seal), arriveMs: pkg.arriveMs, startMs, endMs: now,
      latencyMs: res.latencyMs, costUsd: res.costUsd, confidence: res.confidence, queue,
    });
    l.lastSeal = { pkg, ms: now };
    l.binHit[SEALS.indexOf(res.seal)] = now;
    this.events.push({ type: 'sello', lane: l.index, seal: res.seal, correct });
  }

  private lose(l: Lane, pkg: Pkg, now: number) {
    pkg.status = 'perdido';
    pkg.endMs = now;
    l.active.splice(l.active.indexOf(pkg), 1);
    let startMs: number | null = null;
    let costUsd = 0;
    let queue = l.active.length + 1;
    // Si lo estaba leyendo, abandona la llamada: el coste de la entrada ya está hecho
    if (l.current?.pkg === pkg) {
      startMs = l.current.startMs;
      costUsd = l.agent.abandonCost(pkg.c, l.current.stage);
      l.current.ctrl.abort();
      queue = l.current.queue;
      l.current = null;
    }
    l.records.push({
      caseId: pkg.c.id, truth: pkg.c.seal, seal: null, outcome: 'perdido', points: POINTS.perdido,
      arriveMs: pkg.arriveMs, startMs, endMs: now, latencyMs: null, costUsd, queue,
    });
    l.lostHit = now;
    this.events.push({ type: 'perdido', lane: l.index });
  }

  log(): GameLog {
    return {
      version: 1,
      pace: this.pace,
      game: 'control-seguridad',
      date: this.date,
      seed: this.seed,
      mode: this.mode,
      phases: PHASES,
      points: POINTS,
      endMs: this.endMs,
      lanes: this.lanes.map((l) => ({ name: l.agent.name, model: l.agent.model, records: l.records, apiErrors: l.apiErrors })),
      cases: this.cases.map((c) => ({ id: c.id, text: c.text, seal: c.seal })),
    };
  }
}

/** Aciertos por minuto a lo largo de la partida (ventana deslizante). */
export function throughput(records: DecisionRecord[], endMs: number, stepMs = 2000, windowMs = 20000): number[] {
  const hits = records.filter((r) => r.outcome === 'acierto').map((r) => r.endMs);
  const out: number[] = [];
  for (let t = 0; t <= endMs; t += stepMs) {
    const from = Math.max(0, t - windowMs);
    const span = Math.max(stepMs, t - from);
    out.push((hits.filter((h) => h > from && h <= t).length * 60000) / span);
  }
  return out;
}
