---
version: 1
slug: "src-render-px"
primary_target: "src/render/px"
related_targets: ["src/main.ts"]
---

Scope: the whole canvas game surface (src/render/px, rendered by src/main.ts). Visitor mode: Experience (viewers watch the work itself; the interface recedes).
Audience and job: social-video viewers on a phone, partly muted; they must read who keeps up within ten seconds. Operator records with OBS.
Constraints: 480x270 logical px, integer scale; 16-colour palette from PLAN.md; pixel art authored in code; seals carry colour + shape + icon.
Pinned by brief: PLAN.md 6.2 layout (three identical counters), palette 6.3, sprite list 6.4, game feel 6.6. No concept roll: the world is pinned.

## Direction contract
THESIS: the belt is the chart. Latency is read from parcels piling up and dropping into the pit, not from numbers; refuses the dashboard-with-a-game-skin default (KPI tiles over a decorative scene).
OWN-WORLD: night airport security checkpoint: navy windows with runway lights, dark wall panels, dark checker floor, metal columns; an X-ray machine feeds each belt; navy X-ray monitor with the report; grey decision tubs; wire cart for undecided trays. Sweetie-16 palette; one colour per lane (DeepSeek blue, Jev orange); decisions green/red/yellow/purple each with its own shape. Mascots: Jev and a DeepSeek whale. No fantasy theming.
STORY: viewer sees three clerks doing the same job fairly, then watches the left belt clog while the centre stays empty, and leaves knowing Jev seals more parcels per minute; the end screen shows the honest table, including where the LLM is more accurate.
FIRST VIEWPORT: two 240px columns; top: big counter name over a night strip with hits, errors, lost, cost and mean latency; parchment card mid-height; clerk over a full-width belt, with the wait in seconds at scale 2 beside him (the largest moving signal while a model thinks); pit at the belt end that heaps lost parcels and shows their count; four seal bins; bottom plate with points (scale 4, in the counter colour) and queue.
FORM: pixel-art arcade cabinet split screen, position 1 of 1 (brief-pinned), seed key: none (pinned world, no roll).
Signature interaction: the stamp. 80ms raise, slam, ink ring, 1px lane shake, parcel arcs into its bin; wrong stamp shows a red cross and grimace.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
