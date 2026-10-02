import { GAME_S, PHASES } from '../../config';
import { throughput, type Game } from '../../game';
import { phaseStartMs } from '../../sim/schedule';
import { measure, text } from './font';
import { easeOut, fmtClock, fmtMs, fmtSec, fmtUsd, fmtUsdSmall, mini, plate } from './hud-kit';
import { LANE_COLOR, LH, LW, P } from './palette';

export interface HudFlags {
  mock: boolean;
  keys: boolean;
  muted: boolean;
}

export interface ApiStatus {
  jev: boolean;
  llm: boolean;
  llmName: string;
  llmModel: string;
  jevModel: string;
  llmThinking?: string;
}

export function drawTopStrip(ctx: CanvasRenderingContext2D, g: Game, flags: HudFlags) {
  text(ctx, 'CONTROL DE SEGURIDAD', 6, 3, P.parchment);
  const mid = g.mode === 'precision' ? 'MODO PRECISIÓN' : `FASE ${g.currentPhase + 1} · ${PHASES[g.currentPhase].name}`;
  text(ctx, mid, LW / 2, 3, P.yellow, { align: 'center' });
  const clock = g.mode === 'precision' ? `${fmtSec(g.clockS)} S` : `${fmtClock(g.clockS)} / ${fmtClock(GAME_S)}`;
  text(ctx, clock, LW - 6, 3, P.parchment, { align: 'right' });
  // La etiqueta de datos simulados va junto al reloj, donde no pisa al título ni a la fase
  if (flags.mock) tag(ctx, 'SIMULADO', LW - 6 - measure(clock) - 12 - measure('SIMULADO'), 3);
}

/** Cartel de fase: entra rápido, se lee y sale más rápido todavía. */
export function drawPhaseBanner(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.mode !== 'cronometrado' || g.phase === 'listo' || g.phase === 'fin') return;
  const since = g.wallMs - phaseStartMs(g.currentPhase);
  const IN = 200;
  const HOLD = 2000;
  const OUT = 140;
  if (since < 0 || since > IN + HOLD + OUT) return;
  const open = since < IN ? easeOut(since / IN) : since > IN + HOLD ? 1 - (since - IN - HOLD) / OUT : 1;
  const ph = PHASES[g.currentPhase];
  const h = 50;
  const y = 66;
  const w = Math.round(LW * open);
  const x = Math.round((LW - w) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - 1, w, h + 2);
  ctx.clip();
  ctx.fillStyle = P.night;
  ctx.fillRect(0, y - 1, LW, h + 2);
  ctx.fillStyle = P.navy;
  ctx.fillRect(0, y, LW, h);
  ctx.fillStyle = P.yellow;
  ctx.fillRect(0, y + 2, LW, 1);
  ctx.fillRect(0, y + h - 3, LW, 1);
  text(ctx, `FASE ${g.currentPhase + 1}`, LW / 2, y + 7, P.yellow, { align: 'center' });
  text(ctx, ph.name, LW / 2, y + 18, P.parchment, { scale: 2, outline: P.night, align: 'center' });
  text(ctx, `${ph.hint} · UNA BANDEJA CADA ${fmtSec(ph.everyS * g.pace)} S`, LW / 2, y + 37, P.stoneLight, { align: 'center' });
  ctx.restore();
}

/** Aviso de datos simulados: texto claro sobre placa pizarra (el rojo queda para los errores), legible a cualquier tamaño. */
function tag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, align: 'left' | 'center' = 'left') {
  const w = measure(label) + 6;
  const lx = align === 'center' ? Math.round(x - w / 2) : x;
  ctx.fillStyle = P.slate;
  ctx.fillRect(lx, y - 2, w, 11);
  text(ctx, label, lx + 3, y, P.parchment);
}

function cover(ctx: CanvasRenderingContext2D, a: number) {
  ctx.fillStyle = `rgba(26,28,44,${a})`;
  ctx.fillRect(0, 0, LW, LH);
}

function keysLine(ctx: CanvasRenderingContext2D, line: string) {
  const w = measure(line) + 10;
  ctx.fillStyle = P.night;
  ctx.fillRect(LW / 2 - w / 2, LH - 13, w, 11);
  text(ctx, line, LW / 2, LH - 11, P.stone, { align: 'center' });
}

export function drawStart(ctx: CanvasRenderingContext2D, g: Game, t: number, api: ApiStatus | null, flags: HudFlags) {
  cover(ctx, 0.94);
  const y = 44;
  text(ctx, 'CONTROL DE SEGURIDAD', LW / 2, y, P.parchment, { scale: 3, outline: P.night, align: 'center' });

  // Los dos mostradores, cada uno en su color
  const names = g.lanes.map((l) => l.agent.name);
  const gap = ' VS ';
  const total = names.reduce((a, n) => a + measure(n, 2), 0) + measure(gap, 2) * (names.length - 1) + 4 * names.length;
  let x = LW / 2 - total / 2;
  names.forEach((n, i) => {
    text(ctx, n, x, y + 34, LANE_COLOR[i], { scale: 2, outline: P.night });
    x += measure(n, 2) + 2;
    if (i < names.length - 1) {
      text(ctx, gap, x, y + 34, P.yellow, { scale: 2, outline: P.night });
      x += measure(gap, 2) + 2;
    }
  });

  if (g.mode === 'precision') text(ctx, `${g.cases.length} FICHAS SIN PRISA: SE MIDE SÓLO LA PRECISIÓN`, LW / 2, y + 66, P.stoneLight, { align: 'center' });

  const blink = Math.floor(t * 2) % 2 === 0;
  text(ctx, 'PULSA ESPACIO', LW / 2, y + 104, blink ? P.yellow : P.wood, { scale: 2, outline: P.night, align: 'center' });
  if (api && !flags.mock) {
    const pace = g.mode === 'cronometrado' && g.pace !== 1 ? `` : '';
    text(ctx, `LLM: ${api.llmName.toUpperCase()} (${api.llmModel.toUpperCase()})${pace}`, LW / 2, y + 144, P.stone, { align: 'center' });
  }

  let warn = '';
  if (flags.mock) warn = 'SIMULADO: AGENTES DE PRUEBA, SIN LLAMADAS A LA API';
  else if (api && (!api.jev || !api.llm)) warn = `FALTA EN .ENV: ${[!api.jev && 'CLAVE DE JEV', !api.llm && 'LLM_API_KEY'].filter(Boolean).join(' Y ')}`;
  else if (!api) warn = 'SIN SERVIDOR PROXY: ARRANCA CON NPM RUN DEV';
  if (warn) tag(ctx, warn, LW / 2, y + 160, 'center');
  if (flags.keys) keysLine(ctx, 'M MODO · N SEMILLA · R REINICIAR · S GUARDAR · A SONIDO');
}

export function drawPause(ctx: CanvasRenderingContext2D) {
  cover(ctx, 0.6);
  text(ctx, 'PAUSA', LW / 2, 120, P.parchment, { scale: 3, outline: P.night, align: 'center' });
}

/** Resultados: una frase con el hallazgo, la tabla honesta y la gráfica de aciertos por minuto. */
export function drawEnd(ctx: CanvasRenderingContext2D, g: Game, sinceMs: number, flags: HudFlags) {
  if (sinceMs <= 0) return;
  const appear = easeOut(sinceMs / 400);
  cover(ctx, appear);
  if (sinceMs < 250) return;
  const stats = g.lanes.map((l) => l.stats());
  const names = g.lanes.map((l) => l.agent.name);

  const pct = (v: number | null) => (v === null ? '-' : `${Math.round(v * 100)}%`);
  const head = 'RESULTADOS';
  text(ctx, head, LW / 2, 8, P.yellow, { scale: 2, outline: P.night, align: 'center' });

  // Tabla
  const colX = [250, 380];
  const ty = 30;
  names.forEach((n, i) => text(ctx, n, colX[i], ty, LANE_COLOR[i], { align: 'center' }));
  const rows: { label: string; vals: string[]; nums: (number | null)[]; better: 'max' | 'min' | null }[] = [
    { label: 'PUNTOS', vals: stats.map((s) => String(s.puntos)), nums: stats.map((s) => s.puntos), better: 'max' },
    { label: 'ACIERTOS', vals: stats.map((s) => String(s.aciertos)), nums: stats.map((s) => s.aciertos), better: 'max' },
    { label: 'ERRORES', vals: stats.map((s) => String(s.errores)), nums: stats.map((s) => s.errores), better: 'min' },
    { label: 'SIN DECIDIR', vals: stats.map((s) => String(s.perdidos)), nums: stats.map((s) => s.perdidos), better: 'min' },
    { label: 'PRECISIÓN POR DECISIÓN', vals: stats.map((s) => pct(s.accuracy)), nums: stats.map((s) => s.accuracy), better: 'max' },
    { label: 'LATENCIA MEDIA', vals: stats.map((s) => fmtMs(s.avgLatency)), nums: stats.map((s) => s.avgLatency), better: 'min' },
    { label: 'COSTE', vals: stats.map((s) => fmtUsd(s.cost)), nums: stats.map((s) => s.cost), better: 'min' },
    { label: 'COSTE POR LLAMADA', vals: stats.map((s) => fmtUsdSmall(s.costPerCall)), nums: stats.map((s) => s.costPerCall), better: 'min' },
  ];
  if (g.mode === 'precision') {
    // La precisión es lo que mide este modo: va primero
    rows.unshift(rows.splice(4, 1)[0]);
    rows.splice(4, 1, {
      label: 'TIEMPO TOTAL',
      vals: g.lanes.map((l) => (l.doneMs === null ? '-' : `${fmtSec(l.doneMs / 1000)} S`)),
      nums: g.lanes.map((l) => l.doneMs),
      better: 'min',
    });
  }
  rows.forEach((r, ri) => {
    // Entrada escalonada de 40 ms por fila
    const show = sinceMs - 300 - ri * 40;
    if (show < 0) return;
    const y = ty + 12 + ri * 10;
    if (ri % 2 === 0) {
      ctx.fillStyle = P.night;
      ctx.fillRect(40, y - 2, 400, 10);
    }
    text(ctx, r.label, 48, y, P.stoneLight);
    // Sólo compiten los mostradores que llegaron a decidir algo (0 errores sin decidir no es mérito)
    const valid = r.nums.filter((n, i): n is number => n !== null && stats[i].decided > 0);
    const best = r.better && valid.length > 1 ? (r.better === 'max' ? Math.max(...valid) : Math.min(...valid)) : null;
    r.vals.forEach((v, i) => text(ctx, v, colX[i], y, best !== null && r.nums[i] === best && stats[i].decided > 0 ? P.yellow : P.parchment, { align: 'center' }));
  });

  if (g.mode === 'precision') drawRace(ctx, g, sinceMs - 500);
  else drawChart(ctx, g, sinceMs - 500);

  if (flags.mock) tag(ctx, 'DATOS SIMULADOS, NO SON MEDICIONES REALES', LW / 2, LH - 16, 'center');
  if (flags.keys) keysLine(ctx, 'R REINICIAR · N NUEVA SEMILLA · S GUARDAR REGISTRO');
}

/** Modo precisión: cada ficha resuelta es una marca en el instante en que se selló. */
function drawRace(ctx: CanvasRenderingContext2D, g: Game, sinceMs: number) {
  if (sinceMs < 0 || !g.endMs) return;
  const x = 108;
  const y = 136;
  const w = 278;
  const legendY = y + 14 + g.lanes.length * 26;
  plate(ctx, 40, y - 14, 400, legendY - y + 26, P.night, P.slate);
  text(ctx, 'CADA FICHA, CUÁNDO SE SELLÓ', 48, y - 9, P.stoneLight);
  const reveal = easeOut(sinceMs / 900);
  const toX = (ms: number) => x + Math.round((ms / g.endMs!) * w);
  g.lanes.forEach((l, k) => {
    const ly = y + 10 + k * 26;
    text(ctx, l.agent.name, 48, ly + 3, LANE_COLOR[k]);
    ctx.fillStyle = P.slate;
    ctx.fillRect(x, ly + 12, w, 1);
    for (const r of l.records) {
      const rx = toX(r.endMs);
      if (rx > x + w * reveal) continue;
      ctx.fillStyle = r.outcome === 'acierto' ? P.green : P.red;
      ctx.fillRect(rx, r.outcome === 'acierto' ? ly + 2 : ly, 2, r.outcome === 'acierto' ? 9 : 12);
    }
    if (l.doneMs !== null && reveal >= 1) text(ctx, `${fmtSec(l.doneMs / 1000)} S`, toX(l.doneMs) + 5, ly + 3, P.parchment);
  });
  mini(ctx, 'ok', 48, legendY, P.green);
  text(ctx, 'ACIERTO', 58, legendY, P.stoneLight);
  mini(ctx, 'bad', 108, legendY, P.red);
  text(ctx, 'ERROR', 118, legendY, P.stoneLight);
}

/** Aciertos por minuto a lo largo de la partida; las líneas se dibujan de izquierda a derecha. */
function drawChart(ctx: CanvasRenderingContext2D, g: Game, sinceMs: number) {
  if (sinceMs < 0 || !g.endMs) return;
  const x = 64;
  const y = 136;
  const w = 336;
  const h = 86;
  plate(ctx, x - 24, y - 14, w + 88, h + 28, P.night, P.slate);
  text(ctx, 'ACIERTOS POR MINUTO', x - 16, y - 9, P.stoneLight);

  const step = 2000;
  const series = g.lanes.map((l) => throughput(l.records, g.endMs!, step));
  const max = Math.max(10, ...series.flat());
  const yMax = Math.ceil(max / 10) * 10;
  const toX = (ms: number) => x + Math.round((ms / g.endMs!) * w);
  const toY = (v: number) => y + h - Math.round((v / yMax) * h);

  // Fases como bandas alternas con su número
  if (g.mode === 'cronometrado') {
    PHASES.forEach((_, i) => {
      const a = toX(phaseStartMs(i));
      const b = toX(Math.min(g.endMs!, phaseStartMs(i + 1)));
      if (i % 2) {
        ctx.fillStyle = P.slate;
        for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(a, yy, b - a, 1);
      }
      text(ctx, `F${i + 1}`, a + 3, y + h + 4, P.stone);
    });
  }
  ctx.fillStyle = P.stone;
  ctx.fillRect(x, y + h, w, 1);
  text(ctx, String(yMax), x - 2, y, P.stone, { align: 'right' });
  text(ctx, '0', x - 2, y + h - 6, P.stone, { align: 'right' });

  const reveal = Math.min(1, sinceMs / 900);
  const ends: { k: number; y: number }[] = [];
  series.forEach((s, k) => {
    ctx.fillStyle = LANE_COLOR[k];
    const n = Math.max(1, Math.floor((s.length - 1) * reveal));
    let px = toX(0);
    let py = toY(s[0]);
    for (let i = 1; i <= n; i++) {
      const nx = toX(i * step);
      const ny = toY(s[i]);
      // Segmento de 2 px de grosor, en escalones de píxel
      const steps = Math.max(Math.abs(nx - px), Math.abs(ny - py), 1);
      for (let j = 0; j <= steps; j++) {
        ctx.fillRect(Math.round(px + ((nx - px) * j) / steps), Math.round(py + ((ny - py) * j) / steps), 2, 2);
      }
      px = nx;
      py = ny;
    }
    ends.push({ k, y: py - 3 });
  });
  // Etiqueta directa al final de cada línea, separadas para que no se pisen
  if (reveal < 1) return;
  ends.sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => {
    if (i > 0) e.y = Math.max(e.y, ends[i - 1].y + 9);
  });
  const shift = Math.max(0, ends[ends.length - 1].y - (y + h - 7));
  for (const e of ends) text(ctx, g.lanes[e.k].agent.name, x + w + 6, Math.max(y, e.y - shift), LANE_COLOR[e.k]);
}
