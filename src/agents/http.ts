import { AGENT_TIMEOUT_MS } from '../config';

/** POST al proxy. Devuelve el JSON y la latencia medida en el servidor. */
export async function post(url: string, body: unknown, signal: AbortSignal) {
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(AGENT_TIMEOUT_MS)]),
  });
  const clientMs = performance.now() - t0;
  const json = await res.json().catch(() => ({}));
  const server = Number(res.headers.get('x-latency-ms'));
  return { ok: res.ok, status: res.status, json, latencyMs: Number.isFinite(server) && server > 0 ? server : clientMs };
}

export const errMsg = (e: unknown) => String((e as Error)?.message || e);
