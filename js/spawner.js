// Generación de filas de rocas, olas y peces. Cada fila deja siempre un carril libre
// (el "paso seguro") al alcance del paso seguro de la fila anterior.

import { FISH, LANE_WIDTH, LANES, MAX_SAFE_SHIFT, ROCK, VIEJA_CHANCE, WAVE } from './config.js';
import { pickOne, randInt, randRange, shuffle } from './random.js';

export function laneCenter(lane) {
  return (lane + 0.5) * LANE_WIDTH;
}

/** Carriles que quedan enteros dentro del mar navegable. */
export function availableLanes(bounds) {
  const lanes = [];
  for (let lane = 0; lane < LANES; lane++) {
    const start = lane * LANE_WIDTH;
    if (start >= bounds.left && start + LANE_WIDTH <= bounds.right) lanes.push(lane);
  }
  return lanes;
}

export function chooseSafeLane(rng, lanes, prevSafeLane) {
  if (prevSafeLane == null) return pickOne(rng, lanes);
  const reachable = lanes.filter((lane) => Math.abs(lane - prevSafeLane) <= MAX_SAFE_SHIFT);
  if (reachable.length > 0) return pickOne(rng, reachable);
  // Si la costa tapa los carriles cercanos, el libre más próximo.
  return lanes.reduce((best, lane) =>
    Math.abs(lane - prevSafeLane) < Math.abs(best - prevSafeLane) ? lane : best,
  );
}

/**
 * Crea una fila de objetos a la distancia `wd` del viaje.
 * Devuelve { objects, safeLane }; los objetos aún no tienen id.
 */
export function generateRow({ difficulty, rng, wd, bounds, prevSafeLane = null }) {
  const lanes = availableLanes(bounds);
  if (lanes.length === 0) return { objects: [], safeLane: prevSafeLane };

  const safeLane = chooseSafeLane(rng, lanes, prevSafeLane);
  const free = shuffle(
    rng,
    lanes.filter((lane) => lane !== safeLane),
  );
  const hasWave = free.length >= 2 && rng() < difficulty.waveChance;
  const rockCap = Math.min(difficulty.maxRocks, free.length - (hasWave ? 1 : 0));
  const rockCount = Math.min(rockCap, randInt(rng, difficulty.minRocks, difficulty.maxRocks));
  const objects = [];

  for (const lane of free.splice(0, rockCount)) {
    objects.push({
      type: 'rock',
      lane,
      x: laneCenter(lane) + randRange(rng, -8, 8),
      wd: wd + randRange(rng, -25, 25),
      r: randRange(rng, ROCK.minRadius, ROCK.maxRadius),
    });
  }

  if (hasWave) {
    const lane = free.shift();
    objects.push({
      type: 'wave',
      lane,
      x: laneCenter(lane),
      wd,
      w: WAVE.width,
      h: WAVE.height,
      vx: (rng() < 0.5 ? -1 : 1) * difficulty.waveSpeed,
    });
  }

  if (rng() < difficulty.fishChance) {
    // Casi siempre en el paso seguro, para premiar la ruta limpia.
    const lane = free.length > 0 && rng() < 0.35 ? free[0] : safeLane;
    const kind = rng() < VIEJA_CHANCE ? 'vieja' : 'caballa';
    objects.push({
      type: 'fish',
      kind,
      lane,
      x: laneCenter(lane),
      wd: wd + randRange(rng, -10, 10),
      r: FISH[kind].radius,
    });
  }

  return { objects, safeLane };
}
