import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Servidor proxy: las claves viven sólo aquí y la latencia se mide aquí, desde que sale la
// petición hacia la API hasta que llega la respuesta completa (sin la red del espectador).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Jev: API directa de TypeSafe si hay TYPESAFE_API_KEY; si no, a través de Vercel AI Gateway.
  const jev = env.TYPESAFE_API_KEY
    ? { backend: 'typesafe', url: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', key: env.TYPESAFE_API_KEY }
    : { backend: 'gateway', url: 'https://ai-gateway.vercel.sh/v1/evaluate', model: 'typesafe-ai/jev', key: env.AI_GATEWAY_API_KEY };

  // LLM tradicional: cualquier API compatible con /chat/completions (DeepSeek por defecto).
  const llmBase = (env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const llm = {
    url: `${llmBase}/chat/completions`,
    model: env.LLM_MODEL || 'deepseek-flash',
    name: env.LLM_NAME || 'DeepSeek',
    key: env.LLM_API_KEY || env.DEEPSEEK_API_KEY,
    deepseek: llmBase.includes('deepseek'),
    // Razonamiento del LLM: off por defecto (la forma más rápida); low, high o max lo activan con ese
    // esfuerzo (DeepSeek trata "minimal" como low y "on" se toma como high, su valor por defecto)
    thinking: (({ on: 'high', minimal: 'low', low: 'low', high: 'high', max: 'max' }) as Record<string, string>)[env.LLM_THINKING ?? ''] ?? null,
    extra: env.LLM_EXTRA ? (JSON.parse(env.LLM_EXTRA) as Record<string, unknown>) : {},
  };

  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  const status = {
    jev: Boolean(jev.key),
    jevBackend: jev.backend,
    jevModel: jev.model,
    llm: Boolean(llm.key),
    llmName: llm.name,
    llmThinking: llm.thinking ?? 'off',
    llmModel: llm.model + (llm.thinking ? ` con razonamiento ${({ low: 'bajo', high: 'alto', max: 'máximo' } as Record<string, string>)[llm.thinking]}` : ''),
    prices: {
      llmIn: num(env.LLM_PRICE_IN, 0.15),
      llmCached: num(env.LLM_PRICE_CACHED, 0.003),
      llmOut: num(env.LLM_PRICE_OUT, 0.6),
      jevIn: num(env.JEV_PRICE_IN, 0.042),
    },
  };

  const MAX_JSON_BYTES = 2_000_000;
  const MAX_VIDEO_BYTES = 1_000_000_000;

  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (c) => {
        data += c;
        if (data.length > MAX_JSON_BYTES) {
          req.destroy();
          reject(new Error('cuerpo demasiado grande'));
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  const fail = (res: ServerResponse, code: number, message: string) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { message } }));
  };

  // Sólo POST y sólo desde la propia página (o sin Origin, como los scripts de npm run latency):
  // así otra web abierta en el navegador no puede gastar las claves llamando a localhost.
  const allowed = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    let sameOrigin = !origin;
    try {
      sameOrigin ||= new URL(origin!).host === req.headers.host;
    } catch {}
    if (req.method !== 'POST') fail(res, 405, 'sólo POST');
    else if (!sameOrigin) fail(res, 403, 'origen no permitido');
    else return true;
    return false;
  };

  // Lee el cuerpo JSON; si es inválido responde 400 en vez de tumbar el servidor
  async function readJson(req: IncomingMessage, res: ServerResponse): Promise<{ raw: string; json: any } | null> {
    try {
      const raw = await readBody(req);
      return { raw, json: JSON.parse(raw || '{}') };
    } catch (e) {
      fail(res, 400, String((e as Error).message || e));
      return null;
    }
  }

  async function forward(req: IncomingMessage, res: ServerResponse, url: string, key: string | undefined, body: unknown) {
    const ctrl = new AbortController();
    // Si el juego abandona la llamada (paquete perdido), se corta también hacia la API
    res.on('close', () => !res.writableEnded && ctrl.abort());
    const t0 = performance.now();
    try {
      const up = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key ?? ''}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await up.text();
      res.statusCode = up.status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Latency-Ms', (performance.now() - t0).toFixed(1));
      res.end(text);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: String((e as Error).message || e) } }));
    }
  }

  const proxy: Plugin = {
    name: 'control-proxy',
    configureServer(server) {
      server.middlewares.use('/api/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(status));
      });
      // Cada partida terminada se guarda sola en logs/ para analizarla después (npm run summary)
      server.middlewares.use('/api/log', async (req, res) => {
        if (!allowed(req, res)) return;
        const parsed = await readJson(req, res);
        if (!parsed) return;
        const { raw: body, json: log } = parsed;
        // seed y mode vienen del navegador: se limpian para que no puedan salir de logs/
        const safe = (v: unknown) => String(v ?? '').replace(/[^\w-]/g, '_').slice(0, 32);
        mkdirSync('logs', { recursive: true });
        const file = `logs/control-seed${safe(log.seed)}-${safe(log.mode)}-${Date.now()}.json`;
        writeFileSync(file, body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ file }));
      });
      // Vídeo de cada partida: se guarda en videos/ y se recodifica a MP4 para LinkedIn: H.264 a
      // 60 fps constantes, AAC con el volumen normalizado a -16 LUFS e inicio rápido.
      // Sin ffmpeg queda el archivo original del navegador.
      server.middlewares.use('/api/video', (req, res) => {
        if (!allowed(req, res)) return;
        const name = String(req.headers['x-name'] || `control-${Date.now()}`).replace(/[^\w-]/g, '_').slice(0, 100);
        const webm = String(req.headers['content-type'] || '').includes('webm');
        mkdirSync('videos', { recursive: true });
        const raw = `videos/${name}.${webm ? 'webm' : 'grabado.mp4'}`;
        const out = `videos/${name}.mp4`;
        const file = createWriteStream(raw);
        // Límite de tamaño: una partida pesa unos cientos de MB; más que eso no es un vídeo del juego
        let bytes = 0;
        req.on('data', (c: Buffer) => {
          bytes += c.length;
          if (bytes <= MAX_VIDEO_BYTES) return;
          req.unpipe(file);
          file.destroy();
          file.on('close', () => rmSync(raw, { force: true }));
          fail(res, 413, 'vídeo demasiado grande');
          req.destroy();
        });
        req.pipe(file);
        file.on('finish', () => {
          const ff = spawn('ffmpeg', [
            '-y', '-loglevel', 'error', '-i', raw,
            '-vf', 'scale=out_range=tv:flags=neighbor,format=yuv420p', '-color_range', 'tv',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-fps_mode', 'cfr', '-r', '60',
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
            '-movflags', '+faststart', out,
          ]);
          ff.on('error', () => server.config.logger.warn(`[video] sin ffmpeg: queda ${raw}`));
          ff.on('close', (code) => {
            if (code === 0) {
              unlinkSync(raw);
              server.config.logger.info(`[video] ${out}`);
            } else server.config.logger.warn(`[video] ffmpeg falló (${code}); queda ${raw}`);
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ file: out }));
        });
      });
      server.middlewares.use('/api/jev', async (req, res) => {
        if (!allowed(req, res)) return;
        const b = (await readJson(req, res))?.json;
        if (!b) return;
        await forward(req, res, jev.url, jev.key, { model: jev.model, state: b.state, questions: b.questions });
      });
      server.middlewares.use('/api/llm', async (req, res) => {
        if (!allowed(req, res)) return;
        const b = (await readJson(req, res))?.json;
        if (!b) return;
        await forward(req, res, llm.url, llm.key, {
          model: llm.model,
          messages: b.messages,
          // Sin razonamiento: respuesta determinista; con razonamiento DeepSeek no admite temperature
          ...(llm.thinking ? { reasoning_effort: llm.thinking } : { temperature: 0 }),
          // Salida mínima: sólo el JSON con el sello, sin razonamiento previo
          max_tokens: llm.thinking ? 4000 : 20,
          response_format: { type: 'json_object' },
          stream: false,
          ...(llm.deepseek ? { thinking: { type: llm.thinking ? 'enabled' : 'disabled' } } : {}),
          ...llm.extra,
        });
      });
    },
  };

  return {
    plugins: [proxy],
    server: { port: 5173 },
    build: { target: 'es2022' },
  };
});
