# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Viewers of a recorded video published on social networks (YouTube, LinkedIn, X), landscape 16:9. They watch passively, often on a phone and partly muted, and must understand who is keeping up within ten seconds, without explanation. The operator (the author) runs the app locally in Docker, picks a seed, and records the screen with OBS.

## Product Purpose
"Control de seguridad": a pixel-art airport security checkpoint where two identical lanes receive the same luggage on an X-ray belt. Each lane is run by an AI model that reads the X-ray report and decides PASA (clear), REVISAR (manual search), RETIRAR (confiscate) or ALERTA (call the police) before the tray reaches the end of the belt. The theme was changed on 2026-10-02 from a fantasy customs office ("La Aduana Arcana") at the author's request: no fantasy or arcane theming. Left: a traditional LLM (DeepSeek), drawn as a blue whale. Right: Jev (TypeSafe AI, typed decisions), drawn as an orange mascot. A hybrid counter was tried and dropped on 2026-10-02 at the author's request. The thesis: in bounded, repetitive decisions under time pressure, Jev processes more cases correctly per minute than an LLM, even if the LLM may be more accurate per decision. Success means a viewer can retell that result after one watch.

## Positioning
Speed is shown as consequences (trays piling up and dropping into the SIN DECIDIR cart), not as a number. The comparison is visibly fair: same luggage, same moment, same rulebook, and the LLM is configured as fast as reasonably possible and given the best parcel-picking policy.

## Operating Context
Recorded in one take at 1920x1080 in a full-screen browser. Game-like framing: spectacle first, the comparison is the excuse. Few, large signals during play; detail is saved for the result screen. A run lasts about three minutes across four phases that speed up. Also a precision mode with no time limit, to report per-decision accuracy honestly.

## Capabilities and Constraints
- Canvas 2D app (Vite + TypeScript) served by Docker; API keys stay server-side in a Vite proxy, which also measures latency.
- Jev via TypeSafe API or Vercel AI Gateway (one `choice` question per tray, with confidence); LLM via an OpenAI-compatible `/chat/completions` endpoint, DeepSeek by default, JSON output restricted to the four seals.
- Sequential processing: each agent handles one tray at a time.
- Seeded, deterministic case sequence; rules include traps so keyword matching does not solve them.
- Parallel mode (LLM firing concurrent calls) is deliberately out of scope for now.
- Graphics are pixel art at 480x270 logical pixels, integer-scaled; all art is authored in code (no image generation).

## Brand Commitments
- Pixel-art graphics (explicit requirement in the plan).
- Sixteen-colour palette from the plan (Sweetie 16 variant with two browns); the four decision colours must stay distinct and each decision carries its own icon and shape for colour-blind viewers.
- Model names shown as "DeepSeek" and "Jev". Jev's mascot is an orange character (author-supplied). DeepSeek is a generic blue whale in the same style, not its logo.
- Sibling project "Jev vs DeepSeek · Evacuación" (same author) sets the family style: authored bitmap font, bevelled pixel UI, code-drawn sprites.

## Evidence on Hand
Only live measurements produced by the app itself: latency measured at the proxy, cost from API usage, hits, errors, undecided trays and points per run. No benchmark claims beyond what each run measures; simulated (`?mock`) runs must be labelled as such everywhere.

## Product Principles
1. The belt never waits: latency must always be visible as a consequence.
2. Fairness is visible: same luggage, same moment, same rulebook, best-case LLM setup.
3. Readable in ten seconds on a phone: few, large signals during play.
4. Show where the LLM is better (per-decision accuracy) instead of hiding it.
5. Spectacle serves the truth: game framing is allowed, invented numbers are not.
