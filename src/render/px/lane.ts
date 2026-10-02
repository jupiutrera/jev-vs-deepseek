import { PRECISION_RIDE_MS } from '../../config';
import type { Game, Lane, Pkg } from '../../game';
import { FICHA_LINES, fichaLines } from '../../sim/cases';
import { SEAL_LABEL, SEALS } from '../../sim/rules';
import { measure, text } from './font';
import { easeInOut, easeOut, fmtMs, fmtSec, fmtUsd, mini, plate, Rolling } from './hud-kit';
import { drawMascot, type MascotKind, type MascotState } from './mascots';
import { LANE_COLOR, LANE_W, P, SEAL_COLOR } from './palette';
import { drawBelt, drawBin, drawImpact, drawPackage, drawPit, drawSeal, drawSmoke, drawXray } from './sprites';

// Geometría de un mostrador, en coordenadas locales (0..240).
export const L = {
  nameY: 20,
  statsY: 45,
  ficha: { x: 6, y: 58, w: 228, h: 44 },
  clerk: { cx: 120, bottom: 150 },
  beltY: 150,
  beltX0: 3,
  beltLen: 186, // largo de la cinta dibujada; las bandejas sólo recorren el tramo tras el escáner
  pit: { x: 200, y: 151, w: 34, h: 15 },
  binsY: 184,
  binsX: [10, 73, 136, 199],
  scoreY: 216,
};

/** Máquina de rayos X sobre el principio de la cinta. */
const XRAY = { x: 4, w: 40 };
// Las bandejas nacen en la boca de la máquina (su borde izquierdo en las cortinas) y su centro
// recorre PKG_LEN px hasta el carro. El agente empieza a leerlas cuando ya se ven.
const PKG_X0 = XRAY.x + XRAY.w + 8;
const PKG_LEN = L.beltX0 + 8 + L.beltLen - PKG_X0;
const STAMP_P = (L.clerk.cx - PKG_X0) / PKG_LEN;
const FLIGHT_MS = 300;
const FALL_MS = 260;
const RIGHT = LANE_W - 10;

export class LaneRenderer {
  private beltOffset = 0;
  private points = new Rolling();
  private scanIdx = 0;

  constructor(readonly k: number) {}

  /**
   * Barra de carga del escáner: se llena entre la salida de una bandeja y la de la siguiente, y se
   * completa justo cuando la nueva asoma por las cortinas.
   */
  private scanProgress(g: Game, lane: Lane): number | null {
    const now = g.wallMs;
    // Sin calendario (modo precisión) la bandeja nueva sale en cuanto se decide la anterior
    if (g.mode === 'precision') return null;
    const sched = g.schedule;
    const emerge = (i: number) => sched[i].atMs;
    if (this.scanIdx > 0 && emerge(this.scanIdx - 1) > now) this.scanIdx = 0; // la partida se reinició
    while (this.scanIdx < sched.length && emerge(this.scanIdx) <= now) this.scanIdx++;
    if (this.scanIdx >= sched.length) return null;
    const prev = this.scanIdx > 0 ? emerge(this.scanIdx - 1) : 0;
    const next = emerge(this.scanIdx);
    return next > prev ? (now - prev) / (next - prev) : 0;
  }

  /** Posición del paquete en la cinta (0..1, 1 = cae al foso). */
  progress(p: Pkg, ms: number): number {
    if (p.transitMs === Infinity) return Math.min(1, (ms - p.arriveMs) / PRECISION_RIDE_MS) * STAMP_P;
    return Math.min(1, (ms - p.arriveMs) / p.transitMs);
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, lane: Lane, t: number, dtMs: number) {
    const x0 = this.k * LANE_W;
    const color = LANE_COLOR[this.k];
    const now = g.wallMs;
    const sinceStamp = lane.lastSeal ? now - lane.lastSeal.ms : 1e9;
    // Pausa de 2 fotogramas al estampar: la cinta se congela un instante
    const hitStop = sinceStamp < 34;
    const vis = hitStop ? lane.lastSeal!.ms : now;

    // Temblor de 1 px al estampar
    const shake = sinceStamp < 120 ? (Math.floor(sinceStamp / 40) % 2 ? 1 : -1) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 3, 14, LANE_W - 6, 256);
    ctx.clip();
    ctx.translate(x0 + shake, 0);

    this.drawHeader(ctx, g, lane, color, t);
    this.drawFicha(ctx, g, lane);

    // Velocidad visual de la cinta = velocidad real de los paquetes
    if (g.phase === 'corriendo' && !hitStop) {
      const speed = g.mode === 'precision'
        ? lane.active.some((p) => this.progress(p, now) < STAMP_P) ? (PKG_LEN * STAMP_P) / PRECISION_RIDE_MS : 0
        : PKG_LEN / (g.schedule.find((a) => a.phase === g.currentPhase)?.transitMs ?? 4000);
      this.beltOffset += speed * dtMs;
    }

    this.drawClerkArea(ctx, g, lane, t, sinceStamp);
    drawBelt(ctx, L.beltX0 - 3, L.beltY, L.beltLen + 13, this.beltOffset);
    this.drawPitArea(ctx, lane, now);
    this.drawPackages(ctx, lane, vis, now, t);
    // Las bandejas salen de la máquina de rayos X, que tapa el principio de la cinta
    drawXray(ctx, XRAY.x, L.beltY, XRAY.w, t, this.scanProgress(g, lane));
    SEALS.forEach((s, i) => drawBin(ctx, L.binsX[i], L.binsY, s, (now - lane.binHit[i]) / 1000));
    this.drawFlights(ctx, lane, now);
    this.drawScore(ctx, g, lane, color, t);
    ctx.restore();
  }

  private drawHeader(ctx: CanvasRenderingContext2D, g: Game, lane: Lane, color: string, t: number) {
    text(ctx, lane.agent.name, LANE_W / 2, L.nameY, color, { scale: 3, outline: P.night, align: 'center' });
    const st = lane.stats();
    const y = L.statsY;
    // Franja oscura bajo las cifras para que se lean sobre el muro
    ctx.fillStyle = P.night;
    ctx.fillRect(4, y - 3, LANE_W - 8, 13);
    // Aciertos, errores y perdidos con icono propio; latencia media y coste a la derecha
    let x = 10;
    const item = (kind: 'ok' | 'bad' | 'lost', n: number, col: string) => {
      mini(ctx, kind, x, y, n ? col : P.slate);
      text(ctx, String(n), x + 9, y, n ? P.parchment : P.stone);
      x += 9 + measure(String(n)) + 10;
    };
    item('ok', st.aciertos, P.green);
    item('bad', st.errores, P.red);
    item('lost', st.perdidos, P.fire);
    if (st.lastError && g.wallMs - st.lastError.ms < 3000) {
      text(ctx, 'ERROR DE API', RIGHT, y, Math.floor(t * 4) % 2 ? P.red : P.fire, { align: 'right' });
      return;
    }
    const cost = fmtUsd(st.cost);
    text(ctx, cost, RIGHT, y, P.stoneLight, { align: 'right' });
    const lat = fmtMs(st.avgLatency);
    const lx = RIGHT - measure(cost) - 12;
    text(ctx, lat, lx, y, P.parchment, { align: 'right' });
    text(ctx, 'MEDIA', lx - measure(lat) - 5, y, P.stoneLight, { align: 'right' });
  }

  private drawFicha(ctx: CanvasRenderingContext2D, g: Game, lane: Lane) {
    const f = L.ficha;
    const now = g.wallMs;
    const cur = lane.current?.pkg ?? null;
    const shown = cur ?? lane.lastSeal?.pkg ?? null;
    // Monitor de rayos X: marco gris y pantalla azul marino con el parte del equipaje
    plate(ctx, f.x, f.y, f.w, f.h, P.slate, P.night);
    ctx.fillStyle = P.navy;
    ctx.fillRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4);
    if (!shown) {
      text(ctx, g.phase === 'listo' ? 'ESPERANDO EL PRIMER EQUIPAJE' : 'CINTA VACÍA', f.x + f.w / 2, f.y + 18, P.stoneLight, { align: 'center' });
      return;
    }
    const lines = fichaLines(shown.c.text).slice(0, FICHA_LINES);
    const ink = cur ? P.parchment : P.stoneLight;
    lines.forEach((ln, i) => text(ctx, ln, f.x + 5, f.y + 5 + i * 9, ink));

    if (!cur && lane.lastSeal && shown.seal) {
      // Sello estampado sobre la ficha: entra con un golpe de 2 px y se asienta
      const since = now - lane.lastSeal.ms;
      const label = SEAL_LABEL[shown.seal];
      const w = measure(label) + 28;
      const sx = f.x + f.w - w - 4;
      const sy = f.y + f.h - 21;
      const grow = since < 70 ? 2 : 0;
      ctx.fillStyle = SEAL_COLOR[shown.seal];
      ctx.fillRect(sx - grow, sy - grow, w + grow * 2, 18 + grow * 2);
      ctx.fillStyle = P.parchment;
      ctx.fillRect(sx + 1, sy + 1, w - 2, 16);
      drawSeal(ctx, shown.seal, sx + 2, sy + 1);
      const labelCol = shown.seal === 'revisar' ? P.wood : SEAL_COLOR[shown.seal];
      text(ctx, label, sx + 21, sy + 6, labelCol);
      if (shown.correct === false) {
        // Sello equivocado: cruz roja de 2 px sobre todo el sello, legible sin sonido
        ctx.fillStyle = P.red;
        const steps = w + 4;
        for (let i = 0; i <= steps; i++) {
          const yy = Math.round((i / steps) * 21);
          ctx.fillRect(sx - 2 + i, sy - 2 + yy, 2, 2);
          ctx.fillRect(sx - 2 + i, sy + 19 - yy, 2, 2);
        }
      }
    }
  }

  private drawClerkArea(ctx: CanvasRenderingContext2D, g: Game, lane: Lane, t: number, sinceStamp: number) {
    const now = g.wallMs;
    const wrong = lane.lastSeal?.pkg.correct === false;
    let state: MascotState = 'idle';
    let since = 0;
    if (sinceStamp < 260) {
      state = 'stamping';
      since = sinceStamp / 1000;
    } else if (wrong && sinceStamp < 700) state = 'error';
    else if (lane.current) state = 'reading';
    const c = L.clerk;
    // DeepSeek es la ballena; Jev, su monigote naranja
    const kind: MascotKind = lane.agent.firstStage === 'llm' ? 'whale' : 'jev';
    drawMascot(ctx, kind, c.cx, c.bottom, { state, t, since, stressed: lane.active.length > 3, seal: lane.lastSeal?.pkg.seal });

    if (lane.current && g.phase !== 'fin') {
      const el = (now - lane.current.startMs) / 1000;
      // Puntos suspensivos junto al monigote: cuanto más tarda, más rato se ven
      const bx = c.cx + 22;
      const by = c.bottom - 46;
      plate(ctx, bx, by, 30, 13, P.parchment, P.night);
      ctx.fillStyle = P.night;
      ctx.fillRect(bx + 2, by + 12, 3, 2);
      const n = Math.floor(t * 4) % 4;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < n ? P.slate : P.stoneLight;
        ctx.fillRect(bx + 6 + i * 7, by + 5, 4, 4);
      }
      // Segundos de espera, grandes: cambian de color y tiemblan según se alarga la espera
      if (el > 0.3) {
        const col = el < 1 ? P.parchment : el < 2 ? P.yellow : el < 3 ? P.fire : P.red;
        const jitter = el >= 2 ? (Math.floor(t * 20) % 2 ? 1 : 0) : 0;
        text(ctx, `${fmtSec(el)} S`, c.cx - 26 + jitter, c.bottom - 36, col, { scale: 2, outline: P.night, align: 'right' });
      }
    }
  }

  /** Foso de perdidos: el montón crece con cada paquete perdido y el número se lee de lejos. */
  private drawPitArea(ctx: CanvasRenderingContext2D, lane: Lane, now: number) {
    const pit = L.pit;
    const lost = lane.stats().perdidos;
    drawPit(ctx, pit.x, pit.y, pit.w, pit.h, (now - lane.lostHit) / 1000);
    const cols = Math.floor((pit.w - 4) / 2);
    const rows = Math.floor((pit.h - 4) / 2);
    const heap = Math.min(lost, cols * rows);
    const tones = [P.wood, P.woodDark, P.fire, P.wood, P.stone];
    for (let i = 0; i < heap; i++) {
      ctx.fillStyle = tones[(i * 7) % tones.length];
      ctx.fillRect(pit.x + 2 + (i % cols) * 2, pit.y + pit.h - 4 - Math.floor(i / cols) * 2, 2, 2);
    }
    const y = pit.y + pit.h + 3;
    const hit = now - lane.lostHit < 300;
    const right = pit.x + pit.w;
    const nw = measure(String(lost), 2);
    text(ctx, String(lost), right, y, lost ? P.red : P.stone, { scale: 2, outline: P.night, align: 'right' });
    const lw = measure('SIN DECIDIR');
    plate(ctx, right - nw - lw - 9, y + 3, lw + 6, 11, P.night, P.night);
    text(ctx, 'SIN DECIDIR', right - nw - 6, y + 5, hit ? P.red : P.stoneLight, { align: 'right' });
  }

  private drawPackages(ctx: CanvasRenderingContext2D, lane: Lane, vis: number, now: number, t: number) {
    // Con cola, los paquetes que esperan se empujan: un vaivén de 1 px que delata el atasco
    const jam = lane.active.length > 3;
    lane.active.forEach((p, i) => {
      const pr = this.progress(p, vis);
      const cx = PKG_X0 + pr * PKG_LEN;
      const waiting = lane.current?.pkg !== p;
      const nudge = jam && waiting ? (Math.floor(t * 8 + i) % 2 ? -1 : 0) : 0;
      // Parpadea en rojo en el último 20 % del recorrido
      const flash = p.transitMs !== Infinity && pr > 0.8 && Math.floor(t * 10) % 2 === 0;
      drawPackage(ctx, p.c.kind, cx + nudge, L.beltY + 1 + nudge, flash);
    });
    // Caídas al foso, con humo
    for (let i = lane.pkgs.length - 1; i >= 0; i--) {
      const p = lane.pkgs[i];
      if (p.status !== 'perdido' || p.endMs === undefined) continue;
      const since = now - p.endMs;
      if (since > 900) {
        if (since > 4000) break;
        continue;
      }
      const cx = L.pit.x + L.pit.w / 2;
      if (since < FALL_MS) {
        const q = since / FALL_MS;
        const x = PKG_X0 + PKG_LEN + (cx - PKG_X0 - PKG_LEN) * easeOut(q);
        const y = L.beltY + 1 + q * q * 12;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, LANE_W, L.pit.y + L.pit.h - 2);
        ctx.clip();
        drawPackage(ctx, p.c.kind, x, y, true);
        ctx.restore();
      } else {
        drawSmoke(ctx, cx, L.pit.y + 4, (since - FALL_MS) / (900 - FALL_MS));
      }
    }
  }

  private drawFlights(ctx: CanvasRenderingContext2D, lane: Lane, now: number) {
    for (let i = lane.pkgs.length - 1; i >= 0; i--) {
      const p = lane.pkgs[i];
      if (p.status !== 'sellado' || p.endMs === undefined || !p.seal) continue;
      const since = now - p.endMs;
      if (since > FLIGHT_MS + 200) {
        if (since > 4000) break;
        continue;
      }
      const sx = PKG_X0 + this.progress(p, p.endMs) * PKG_LEN;
      const sy = L.beltY - 7;
      if (since < 200) drawImpact(ctx, sx, sy, since / 200, SEAL_COLOR[p.seal]);
      if (since >= FLIGHT_MS) continue;
      const q = easeInOut(since / FLIGHT_MS);
      const bi = SEALS.indexOf(p.seal);
      const tx = L.binsX[bi] + 16;
      const ty = L.binsY + 10;
      const x = sx + (tx - sx) * q;
      const y = L.beltY + 1 + (ty - L.beltY - 1) * q - Math.sin(q * Math.PI) * 18;
      drawPackage(ctx, p.c.kind, x, y);
    }
  }

  private drawScore(ctx: CanvasRenderingContext2D, g: Game, lane: Lane, color: string, t: number) {
    const st = lane.stats();
    const y = L.scoreY;
    plate(ctx, 6, y, LANE_W - 12, 44, P.night, P.slate);
    text(ctx, 'PUNTOS', 14, y + 6, P.stone);
    this.points.draw(ctx, st.puntos, 14, y + 15, st.puntos < 0 ? P.red : color, 4, t);
    const r = LANE_W - 14;
    if (g.mode === 'precision') {
      // Sin prisa: fichas resueltas y, al acabar, cuánto tardó
      const done = lane.doneMs !== null;
      text(ctx, done ? 'TERMINÓ EN' : 'FICHAS', r, y + 6, P.stone, { align: 'right' });
      const v = done ? `${fmtSec(lane.doneMs! / 1000)} S` : `${lane.records.length}/${g.cases.length}`;
      text(ctx, v, r, y + 22, done ? color : P.stoneLight, { scale: 2, outline: P.night, align: 'right' });
      return;
    }
    // Cola en la cinta: el atasco en cifra
    const q = lane.active.length;
    text(ctx, 'EN COLA', r, y + 6, P.stone, { align: 'right' });
    text(ctx, String(q), r, y + 18, q > 3 ? P.fire : P.stoneLight, { scale: 3, outline: P.night, align: 'right' });
  }
}
