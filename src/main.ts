import { JevAgent, jevRequest } from './agents/jev';
import { LlmAgent, llmMessages } from './agents/llm';
import { MockAgent } from './agents/mock';
import { estimateTokens, jevCost, llmCost, setPrices } from './agents/pricing';
import type { Agent } from './agents/types';
import { Sound } from './audio';
import { PACE_BY_THINKING } from './config';
import { Game, type Mode } from './game';
import { RunRecorder } from './recorder';
import { generateCases } from './sim/cases';
import { drawEnd, drawLoading, drawPause, drawPhaseBanner, drawStart, drawTopStrip, type ApiStatus, type HudFlags, statsReady } from './render/px/hud';
import { LaneRenderer } from './render/px/lane';
import { LH, LW } from './render/px/palette';
import { sceneLayer } from './render/px/scene';

const params = new URLSearchParams(location.search);
const mock = params.has('mock');
// ?keys muestra los atajos en pantalla (fuera de cámara no hacen falta)
const flags: HudFlags = { mock, keys: params.has('keys'), muted: params.has('muted') };
const sound = new Sound();
sound.muted = flags.muted;

async function loadStatus(): Promise<ApiStatus | null> {
  try {
    const s = await (await fetch('/api/status')).json();
    setPrices(s.prices ?? {});
    return s;
  } catch {
    return null;
  }
}

function makeAgents(api: ApiStatus | null): Agent[] {
  if (mock) {
    // Coste simulado con los mismos precios y prompts que las llamadas reales
    const sample = generateCases(1, 1)[0];
    const llmUsd = llmCost({
      prompt_tokens: estimateTokens(llmMessages(sample).map((m) => m.content).join('')),
      prompt_cache_hit_tokens: estimateTokens(llmMessages(sample)[0].content),
      completion_tokens: 8,
    });
    const jevUsd = jevCost(estimateTokens(JSON.stringify(jevRequest(sample))));
    return [
      new MockAgent('DeepSeek', 'simulado', 'llm', [650, 1150], 0.04, llmUsd),
      new MockAgent('Jev', 'simulado', 'jev', [280, 380], 0.05, jevUsd),
    ];
  }
  const llmName = api?.llmName ?? 'LLM';
  const llmModel = api?.llmModel ?? '';
  const jevModel = api?.jevModel ?? 'jev';
  return [new LlmAgent(llmName, llmModel), new JevAgent(jevModel)];
}

const randomSeed = () => 1 + Math.floor(Math.random() * 9999);

// El lienzo es de 480x270 píxeles lógicos; CSS lo escala sin suavizado (x4 en 1080p).
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = LW;
canvas.height = LH;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

function resize() {
  const fit = Math.min(window.innerWidth / LW, window.innerHeight / LH);
  // Escala entera cuando cabe, para que cada píxel lógico mida lo mismo
  const s = fit >= 1 ? Math.floor(fit) : fit;
  canvas.style.width = `${LW * s}px`;
  canvas.style.height = `${LH * s}px`;
}
window.addEventListener('resize', resize);
resize();

const api = await loadStatus();
// El ritmo se adapta a la latencia esperada del LLM (más lento si razona); ?ritmo=N lo fuerza
const pace = Number(params.get('ritmo')) || (mock ? 1 : PACE_BY_THINKING[api?.llmThinking ?? 'off'] ?? 1);
const game = new Game(makeAgents(api), Number(params.get('seed')) || randomSeed(), (params.get('mode') as Mode) === 'precision' ? 'precision' : 'cronometrado', pace);
const lanes = game.lanes.map((_, k) => new LaneRenderer(k));
let endSince: number | null = null;
let statsSince: number | null = null;

// Cada partida se graba en vídeo con su sonido (?norec lo desactiva). El aviso REC va fuera del
// lienzo, así que no sale en el vídeo.
const recorder = new RunRecorder(canvas, () => sound.stream());
const recOn = !params.has('norec');
const recBadge = document.getElementById('rec')!;
// El cierre del vídeo va con un temporizador, no con el bucle de dibujo: si la pestaña queda en
// segundo plano el navegador congela requestAnimationFrame y el vídeo no se cerraría.
let recStopTimer: number | null = null;
let uploading = false;
const badge = (txt: string, live = false) => {
  recBadge.textContent = txt;
  recBadge.className = live ? 'live' : txt ? 'info' : '';
};

function startRecording() {
  if (!recOn) return;
  recorder.start(`control-seed${game.seed}-${game.mode}${mock ? '-simulado' : ''}-${Date.now()}`);
  if (recorder.recording) badge('● REC', true);
}

async function finishRecording() {
  recStopTimer = null;
  uploading = true;
  badge('GUARDANDO VÍDEO…');
  const file = await recorder.stop();
  uploading = false;
  badge(file ? `VÍDEO RECIBIDO: CONVIRTIENDO A ${file} (1-2 MIN)` : 'NO SE PUDO GUARDAR EL VÍDEO');
  setTimeout(() => badge(''), 8000);
}

function download() {
  const log = game.log();
  const blob = new Blob([JSON.stringify(log, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `control-seed${log.seed}-${log.mode}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function restart(seed = game.seed, mode = game.mode) {
  game.reset(seed, mode);
  endSince = null;
  statsSince = null;
  recorder.cancel();
  if (recStopTimer !== null) clearTimeout(recStopTimer);
  recStopTimer = null;
  badge('');
  sound.stopMusic();
}

// Aviso al cerrar o recargar la pestaña con un vídeo a medias
window.addEventListener('beforeunload', (e) => {
  if (recorder.recording || uploading) e.preventDefault();
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  sound.unlock();
  if (k === ' ') {
    e.preventDefault();
    const wasReady = game.phase === 'listo';
    game.togglePause();
    if (wasReady) {
      sound.startMusic();
      startRecording();
    }
  } else if (k === 'r') restart();
  else if (k === 'n') restart(randomSeed());
  else if (k === 'm' && (game.phase === 'listo' || game.phase === 'fin')) restart(game.seed, game.mode === 'cronometrado' ? 'precision' : 'cronometrado');
  else if (k === 's') download();
  else if (k === 'a') sound.toggleMute();
});

let prev = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(now - prev, 250);
  game.update(now - prev);
  prev = now;
  const t = now / 1000;

  for (const ev of game.events.splice(0)) {
    if (ev.type === 'sello') sound.stamp(ev.lane, ev.correct);
    else if (ev.type === 'perdido') sound.lost(ev.lane);
    else if (ev.type === 'fase') sound.phase(ev.phase);
    else if (ev.type === 'fin') {
      sound.end();
      // El vídeo termina cuando los resultados llevan unos segundos en pantalla y ya se ve la
      // precisión con tiempo (el análisis posterior), sin pasar de 60 s
      const finAt = performance.now();
      const done = game.hindsightDone;
      if (recorder.recording) {
        recStopTimer = window.setTimeout(() => void finishRecording(), 60000);
        void done.then(() => {
          if (recStopTimer === null || game.hindsightDone !== done) return;
          clearTimeout(recStopTimer);
          recStopTimer = window.setTimeout(() => void finishRecording(), Math.max(9000 - (performance.now() - finAt), 6000));
        });
      }
      // Guardado automático en logs/ del proyecto (sólo con el servidor de Vite delante), con el análisis posterior
      void done.then(() => {
        if (game.hindsightDone !== done) return;
        fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(game.log()) }).catch(() => {});
      });
    }
  }

  ctx.drawImage(sceneLayer(), 0, 0);
  game.lanes.forEach((l, k) => lanes[k].draw(ctx, game, l, t, game.phase === 'corriendo' ? dt : 0));
  drawTopStrip(ctx, game, flags);
  drawPhaseBanner(ctx, game);

  if (game.phase === 'listo') drawStart(ctx, game, t, api, flags);
  else if (game.phase === 'pausa') drawPause(ctx);
  if (game.phase === 'fin') {
    endSince ??= now;
    // Pausa breve para que se vean los últimos sellos antes de los resultados
    const sinceEnd = now - endSince - 1200;
    // Las estadísticas esperan al análisis posterior; si hubo pantalla de carga, entran sin volver a fundir
    if (statsReady(game)) statsSince ??= now;
    if (statsSince === null) drawLoading(ctx, game, sinceEnd, t, flags);
    else drawEnd(ctx, game, Math.min(sinceEnd, 400 + now - statsSince), flags);
  }
  recorder.frame();
  requestAnimationFrame(frame);
}

// ?desde=N empieza directamente en la fase N (para ensayar sin esperar)
if (params.has('desde')) game.skipToPhase(Number(params.get('desde')) - 1);
if (params.has('autostart') || params.has('desde')) {
  game.togglePause();
  // Sin gesto del usuario el navegador no deja sonar el audio: el vídeo saldría mudo
  startRecording();
}
requestAnimationFrame(frame);
