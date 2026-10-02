---
name: Control de seguridad · DeepSeek vs Jev
description: A pixel-art airport security checkpoint with two identical lanes, DeepSeek and Jev; the belt is the chart. 480x270 logical pixels, integer-scaled.
colors:
  night: "#1a1c2c"
  slate: "#333c57"
  stone: "#566c86"
  stone-light: "#94b0c2"
  parchment: "#f4f4f4"
  wood-dark: "#5a3a2a"
  wood: "#a0683a"
  fire: "#ef7d57"
  green: "#38b764"
  red: "#b13e53"
  yellow: "#ffcd75"
  purple: "#5d275d"
  blue: "#41a6f6"
  cyan: "#73eff7"
  lime: "#a7f070"
  navy: "#29366f"
  lane-llm: "#41a6f6"
  lane-jev: "#ef7d57"
  mascot-outline: "#0b222e"
  jev-orange: "#ff7331"
  jev-shadow: "#c44a16"
  jev-spark: "#fdd17a"
  decision-pasa: "#38b764"
  decision-retirar: "#b13e53"
  decision-revisar: "#ffcd75"
  decision-alerta: "#5d275d"
typography:
  display:
    fontFamily: "Authored 5x7 bitmap font (src/render/px/font.ts), uppercase only"
    fontSize: "28px"
    lineHeight: "36px"
    letterSpacing: "4px"
  headline:
    fontFamily: "Authored 5x7 bitmap font (src/render/px/font.ts), uppercase only"
    fontSize: "21px"
    lineHeight: "27px"
    letterSpacing: "3px"
  title:
    fontFamily: "Authored 5x7 bitmap font (src/render/px/font.ts), uppercase only"
    fontSize: "14px"
    lineHeight: "18px"
    letterSpacing: "2px"
  label:
    fontFamily: "Authored 5x7 bitmap font (src/render/px/font.ts), uppercase only"
    fontSize: "7px"
    lineHeight: "9px"
    letterSpacing: "1px"
rounded:
  none: "0px"
spacing:
  px: "1px"
  inset: "4px"
  gutter: "5px"
  lane: "240px"
  tile: "16px"
components:
  plate:
    backgroundColor: "{colors.slate}"
    rounded: "{rounded.none}"
  xray-monitor:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    width: "150px"
    height: "52px"
  stats-strip:
    backgroundColor: "{colors.night}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    height: "22px"
  decision-stamp:
    backgroundColor: "{colors.parchment}"
    typography: "{typography.label}"
    height: "18px"
  wait-bubble:
    backgroundColor: "{colors.parchment}"
    width: "30px"
    height: "13px"
  wait-seconds:
    textColor: "{colors.parchment}"
    typography: "{typography.title}"
  points-plate:
    backgroundColor: "{colors.night}"
    textColor: "{colors.lane-jev}"
    typography: "{typography.display}"
    width: "150px"
    height: "44px"
  phase-banner:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.parchment}"
    typography: "{typography.title}"
    height: "50px"
  simulated-tag:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    height: "11px"
  decision-badge:
    width: "16px"
    height: "16px"
  bin:
    backgroundColor: "{colors.wood}"
    width: "32px"
    height: "24px"
---

# Design System: Control de seguridad · DeepSeek vs Jev

## Overview

**Creative North Star: "The belt is the chart"**

An airport security checkpoint at night, two identical lanes side by side. Each lane holds one mascot agent, one X-ray monitor, one belt that starts at the X-ray machine, four grey decision tubs and a wire cart for trays nobody decided in time. The two lanes receive the same luggage at the same instant, so the viewer reads latency as a consequence: trays heap in the DeepSeek cart while the Jev belt stays clear. Numbers exist, but the picture tells the story first.

Everything is drawn into a 480x270 logical canvas and upscaled with nearest-neighbour sampling (x4 at the 1920x1080 recording target, integer scale whenever it fits). All units here are logical pixels. The palette is the 16-colour Sweetie 16 variant from PLAN.md 6.3 and nothing else; every pixel of art (clerks, parcels, seals, bins, belt, pit, background) is authored in code.

This is the sibling of "Jev vs DeepSeek · Evacuación" and shares its grammar: authored bitmap capitals, flat pixel plates, stepped motion, a results screen that reports only the run's own numbers. It refuses the dashboard-with-a-game-skin default: no KPI tiles floating over a decorative scene.

**Key Characteristics:**
- One logical canvas (480x270), two 240 px lanes, 16 px luggage tiles.
- One authored 5x7 uppercase bitmap font, integer scales 1 to 4, Spanish decimal comma in every figure.
- Flat plates with 1 px edges; no bevel, no blur, no radius, no gradient.
- One colour per lane; four decision colours, each with its own shape and icon.
- Red means error. Yellow marks the phase and the best value of each results row.

## Colors

A night terminal: navy windows with runway lights, dark wall panels, a dark checker floor, metal columns; colour is spent on the two lanes and the four decisions.

### Counters
- **DeepSeek Blue** (`lane-llm`) and **Jev Orange** (`lane-jev`): each counter's name, its points number (scale 4, its own number) and its line in the results chart. They match the mascots: the blue whale and Jev's orange robot.

### Mascots
- **Jev** is a 12x16 orange character, kept in its original colours (`mascot-outline`, `jev-orange`, `jev-shadow`, `jev-spark`, white). This is the one deliberate exception to the palette lock: it is the author's existing character.
- **DeepSeek** is a whale built on the same grid and outline: palette blue body, navy shading, cyan spout instead of the spark, a tail fluke instead of the thruster. Generic whale, not the company logo.
- Both are drawn at x3 (36x48). States: idle float with flickering spark or spout; reading, eyes sweep the visor; stamping, 80 ms hop then slam with the seal under them; error, red cross eyes and a shake for 700 ms; jam (queue over 3), sweat drops.

### Decisions
- **PASA green** circle with a check, **RETIRAR red** square with a cross, **REVISAR yellow** octagon with a magnifier, **ALERTA purple** triangle with an exclamation mark. Every badge has a 1 px stone-light rim so purple reads on night. Colour is never the only signal.

### Signal roles
- **Seal red** (`red`) is reserved for errors: the 2 px cross over a wrong stamp, the lost count, negative points, the SIN DECIDIR flash, the pit rim flash, parcels about to fall, API errors.
- **Yellow** (`yellow`): the phase line in the top strip, the phase banner rules, "PULSA ESPACIO", the results headline and the best value of each results row.
- **Wait escalation**: elapsed seconds go parchment (<1 s), yellow (<2 s), fire (<3 s), red (3 s and over).

### Materials
- **Navy** windows and monitor screens, **night** wall, **slate/night** checker floor, **stone/stone-light** columns, X-ray machine and tubs, **parchment** text and bubbles.

### Named Rules
**The One Red Rule.** Red always means something went wrong. Labels (such as SIMULADO) never use it; they sit on slate.

**The Palette Lock.** No colour outside the sixteen, except the Jev mascot's own source colours. Overlays only darken with `rgba(26,28,44,a)` (night).

## Typography

**Font:** the authored 5x7 bitmap capitals from `src/render/px/font.ts`, with two extra rows above for Spanish accents (Á É Í Ó Ú Ñ Ü). Lower case is drawn upper case.

- **Display** (scale 4): points. **Headline** (scale 3): title card, queue count. **Title** (scale 2): counter names, phase name, wait seconds, results headline, lost count. **Label** (scale 1): cards, stats, tables.
- Outline: 1 px night around anything drawn over art.
- The points odometer uses fixed 6xscale cells, right-aligned, so a rolling digit never shifts its neighbours.

## Layout

Per counter (local x 0..240): name at scale 3, y 20; night stats strip at y 42-55 (hits, errors, lost on the left; mean latency and cost on the right); X-ray monitor at y 58, 228x44, four lines of report; mascot centred at x 120 standing on the belt, wait bubble to its right and wait seconds to its left; belt at y 150 from x 3, trays emerge from the X-ray machine (x 4..44) and travel 186 px; wire cart at the belt end (x 200, 34x15) with the lost count under it; decision tubs at y 184; points plate at y 216. Parcel x is always its true time-to-deadline: the jam is shown by the pit heap and the waiting signal, never by faking belt spacing.

## Motion

- **Stamp (signature):** 80 ms raise, slam; 200 ms ink ring; 120 ms 1 px lane shake; 34 ms hit-stop (belt and trays freeze); 300 ms ease-in-out arc into the tub; tub flashes and jiggles 250 ms. A wrong stamp adds a red cross over the stamp plate and a 700 ms grimace.
- **Undecided tray:** flashes red in the last 20 % of the belt, falls 260 ms into the cart, smoke for 640 ms, one more block on the heap.
- **Belt:** tread speed equals tray speed in the current phase.
- **Phase banner:** 200 ms ease-out reveal from the centre, 2 s hold, 140 ms exit.
- **Odometer:** 80 ms ease-out roll of changed digits only.
- **Results:** 400 ms cover, rows staggered 40 ms, chart lines drawn left to right over 900 ms.
- Easing: cubic ease-out for entries, cubic ease-in-out for travel. Nothing animates on keyboard actions.

## Components

- **X-ray monitor:** slate bezel, navy screen, parchment text while being read, stone-light once decided; the decision lands bottom right as a coloured frame with badge and label.
- **Wait bubble:** parchment, three 4 px dots cycling.
- **SIN DECIDIR cart:** stone-light wire frame (red on a loss) with a slate grid; a heap of 2x2 blocks grows with every undecided tray.
- **X-ray machine:** stone-light housing at the start of the belt, blinking green power light, cyan scan bar, slatted curtain that sways.
- **Simulated tag:** parchment text on a slate plate, in the top strip, start card and results footer whenever `?mock` is on.

## Do's and Don'ts

- Do keep both counters identical in layout; only the colour and the mascot differ.
- Do show where the LLM wins (precision per decision) in yellow like any other best value.
- Don't use em-dashes, eyebrow labels or decorative dots.
- Don't draw anything off the 16-colour palette or with smoothing.
- Don't pack or reorder trays on the belt to dramatise the jam.
- Don't bring back fantasy or arcane theming (author's explicit request).
