import { hash01 } from '../../sim/rng';
import { L } from './lane';
import { LANE_W, LH, LW, P } from './palette';

// Fondo estático de la terminal: ventanales de noche con luces de pista arriba, paneles de
// pared, suelo de baldosa y columnas metálicas entre controles. Poco contraste a propósito para
// no competir con la acción.

let cached: HTMLCanvasElement | null = null;

export function sceneLayer(): HTMLCanvasElement {
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = LW;
  cv.height = LH;
  const ctx = cv.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  rect(0, 0, LW, LH, P.night);

  // Ventanal: cielo de noche, montantes y luces de pista a lo lejos
  const winTop = 14;
  const winBot = 40;
  rect(0, winTop, LW, winBot - winTop, P.navy);
  rect(0, winBot - 5, LW, 5, P.night);
  for (let x = 3; x < LW; x += 7) if (hash01(x, 4) < 0.5) rect(x, winBot - 3, 1, 1, hash01(x, 9) < 0.3 ? P.fire : P.yellow);
  for (let x = 0; x < LW; x += 24) rect(x, winTop, 2, winBot - winTop, P.slate);
  rect(0, winBot, LW, 1, P.stone);

  // Pared de paneles hasta la cinta
  const wallBottom = L.beltY + 12;
  for (let x = 0; x < LW; x += 20) rect(x + 19, winBot + 1, 1, wallBottom - winBot - 1, P.slate);
  rect(0, winBot + 30, LW, 1, P.slate);

  // Suelo de baldosa en damero oscuro
  for (let y = wallBottom; y < LH; y += 12) {
    for (let x = 0; x < LW; x += 16) {
      if ((x / 16 + (y - wallBottom) / 12) % 2) rect(x, y, 16, 12, P.slate);
      rect(x, y, 16, 1, P.night);
    }
  }

  // Columnas metálicas entre controles
  for (let k = 0; k <= LW / LANE_W; k++) {
    const x = k * LANE_W - 3;
    rect(x, 14, 6, LH - 14, P.stone);
    rect(x + 1, 14, 1, LH - 14, P.stoneLight);
    rect(x, 14, 1, LH - 14, P.night);
    rect(x + 5, 14, 1, LH - 14, P.night);
  }

  // Barra superior
  rect(0, 0, LW, 13, P.navy);
  rect(0, 13, LW, 1, P.night);

  cached = cv;
  return cv;
}
