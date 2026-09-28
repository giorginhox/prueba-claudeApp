// Estado y reglas de la partida. No toca el DOM: se puede simular y probar en Node.
//
// El viaje es una sola coordenada, `distance`, que crece con la velocidad. Cada objeto guarda
// la distancia del viaje a la que está (`wd`) y su posición lateral `x`; su altura en pantalla
// se deduce de ambas, así que el mar entero avanza sin mover los objetos uno a uno.

import {
  BOAT,
  DIFFICULTIES,
  FISH,
  FISH_PICKUP_MARGIN,
  ISLAND_BONUS,
  MAX_STEP,
  ROCK,
  SPAWN_MARGIN,
  START_CLEARANCE,
  UNITS_PER_MILE,
  WAVE,
  WORLD_WIDTH,
} from './config.js';
import { circleRectOverlap, clamp, rectsOverlap } from './geometry.js';
import { randRange } from './random.js';
import { islandAt, legLength, seaBounds } from './route.js';
import { generateRow } from './spawner.js';

export function speedFor(difficulty, islandsReached) {
  const factor = Math.min(difficulty.maxSpeedFactor, 1 + difficulty.speedStep * islandsReached);
  return difficulty.baseSpeed * factor;
}

export function fishPoints(kind, difficulty) {
  return FISH[kind].points * difficulty.multiplier;
}

export function islandBonus(difficulty) {
  return ISLAND_BONUS * difficulty.multiplier;
}

export function createGame({ difficulty = 'normal', height = 700, rng = Math.random } = {}) {
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new Error(`Dificultad desconocida: ${difficulty}`);

  const state = {
    difficulty: diff,
    rng,
    width: WORLD_WIDTH,
    height,
    status: 'playing', // 'playing' | 'over'
    time: 0,
    distance: 0,
    speed: speedFor(diff, 0),
    score: 0,
    lives: diff.lives,
    fishCaught: 0,
    islandsReached: 0,
    leg: 0, // parada de la que se zarpó en la travesía actual
    legStart: 0,
    legEnd: legLength(0),
    marks: [],
    boat: { x: WORLD_WIDTH / 2, vx: 0, invulnerable: 0 },
    input: { targetX: null, steer: 0 },
    objects: [],
    nextId: 1,
    nextRowAt: 0,
    safeLane: null,
  };
  state.marks = computeMarks(state);
  state.nextRowAt = spawnAhead(state) + START_CLEARANCE;
  return state;
}

export function boatY(state) {
  return state.height - BOAT.bottomOffset;
}

/** Altura en pantalla (unidades de mundo) de algo situado a la distancia `wd` del viaje. */
export function screenY(state, wd) {
  return boatY(state) - (wd - state.distance);
}

export function boatHitbox(state) {
  return { x: state.boat.x, y: boatY(state), w: BOAT.hitWidth, h: BOAT.hitHeight };
}

export function milesSailed(state) {
  return state.distance / UNITS_PER_MILE;
}

export function milesToNextIsland(state) {
  return Math.max(0, state.legEnd - state.distance) / UNITS_PER_MILE;
}

export function nextIsland(state) {
  return islandAt(state.leg + 1);
}

export function legProgress(state) {
  return clamp((state.distance - state.legStart) / (state.legEnd - state.legStart), 0, 1);
}

/** Rumbo hacia una x del mar (dedo o ratón). `null` suelta el timón. */
export function setTarget(state, x) {
  state.input.targetX = x == null ? null : clamp(x, 0, state.width);
  state.input.steer = 0;
}

/** Timón con teclado: -1 izquierda, 0 recto, 1 derecha. */
export function setSteer(state, dir) {
  state.input.steer = clamp(dir, -1, 1);
  if (dir !== 0) state.input.targetX = null;
}

export function setHeight(state, height) {
  state.height = height;
}

/**
 * Avanza la simulación `dt` segundos y devuelve la lista de eventos ocurridos:
 * { type: 'fish' | 'hit' | 'island' | 'gameover', … }.
 */
export function step(state, dt) {
  const events = [];
  if (state.status !== 'playing' || !(dt > 0)) return events;
  let remaining = dt;
  while (remaining > 1e-9 && state.status === 'playing') {
    const h = Math.min(remaining, MAX_STEP);
    tick(state, h, events);
    remaining -= h;
  }
  return events;
}

function tick(state, dt, events) {
  const { boat, input, difficulty } = state;
  state.time += dt;
  boat.invulnerable = Math.max(0, boat.invulnerable - dt);

  const prevX = boat.x;
  const maxMove = difficulty.boatSpeed * dt;
  if (input.targetX != null) boat.x += clamp(input.targetX - boat.x, -maxMove, maxMove);
  else boat.x += input.steer * maxMove;

  state.distance += state.speed * dt;

  const bounds = seaBounds(state.marks, state.distance, state.width);
  const half = BOAT.width / 2;
  boat.x = clamp(boat.x, bounds.left + half, bounds.right - half);
  boat.vx = (boat.x - prevX) / dt;

  moveWaves(state, dt);
  spawnRows(state);
  checkCollisions(state, events);
  if (state.status !== 'playing') return;
  checkIslands(state, events);
  removePassed(state);
}

function spawnAhead(state) {
  return boatY(state) + SPAWN_MARGIN;
}

function computeMarks(state) {
  const afterNext = state.legEnd + legLength(state.leg + 1);
  return [
    { stop: state.leg, at: state.legStart },
    { stop: state.leg + 1, at: state.legEnd },
    { stop: state.leg + 2, at: afterNext },
  ];
}

function moveWaves(state, dt) {
  for (const o of state.objects) {
    if (o.type !== 'wave') continue;
    const bounds = seaBounds(state.marks, o.wd, state.width);
    o.x += o.vx * dt;
    if (o.x - o.w / 2 < bounds.left) {
      o.x = bounds.left + o.w / 2;
      o.vx = Math.abs(o.vx);
    } else if (o.x + o.w / 2 > bounds.right) {
      o.x = bounds.right - o.w / 2;
      o.vx = -Math.abs(o.vx);
    }
  }
}

function spawnRows(state) {
  const { difficulty, rng } = state;
  while (state.distance + spawnAhead(state) >= state.nextRowAt) {
    const wd = state.nextRowAt;
    const bounds = seaBounds(state.marks, wd, state.width);
    const row = generateRow({ difficulty, rng, wd, bounds, prevSafeLane: state.safeLane });
    for (const o of row.objects) state.objects.push({ id: state.nextId++, ...o });
    state.safeLane = row.safeLane;
    state.nextRowAt += state.speed * difficulty.rowInterval * randRange(rng, 0.85, 1.15);
  }
}

function hitsObstacle(o, y, hitbox) {
  if (o.type === 'rock') return circleRectOverlap({ x: o.x, y, r: o.r - ROCK.hitInset }, hitbox);
  if (o.type === 'wave') {
    const rect = { x: o.x, y, w: o.w - 2 * WAVE.hitInsetX, h: o.h - 2 * WAVE.hitInsetY };
    return rectsOverlap(rect, hitbox);
  }
  return false;
}

function checkCollisions(state, events) {
  const hitbox = boatHitbox(state);
  for (const o of state.objects) {
    if (o.collected) continue;
    const y = screenY(state, o.wd);
    if (o.type === 'fish') {
      if (circleRectOverlap({ x: o.x, y, r: o.r + FISH_PICKUP_MARGIN }, hitbox)) {
        o.collected = true;
        const points = fishPoints(o.kind, state.difficulty);
        state.score += points;
        state.fishCaught += 1;
        events.push({ type: 'fish', kind: o.kind, points, x: o.x, y });
      }
    } else if (state.boat.invulnerable <= 0 && hitsObstacle(o, y, hitbox)) {
      state.lives -= 1;
      state.boat.invulnerable = BOAT.invulnerableTime;
      events.push({ type: 'hit', obstacle: o.type, x: o.x, y, lives: state.lives });
      if (state.lives <= 0) {
        state.lives = 0;
        state.status = 'over';
        events.push({ type: 'gameover', score: state.score });
        return;
      }
    }
  }
}

function checkIslands(state, events) {
  while (state.distance >= state.legEnd) {
    state.leg += 1;
    state.islandsReached += 1;
    const bonus = islandBonus(state.difficulty);
    state.score += bonus;
    state.speed = speedFor(state.difficulty, state.islandsReached);
    state.legStart = state.legEnd;
    state.legEnd += legLength(state.leg);
    state.marks = computeMarks(state);
    events.push({ type: 'island', island: islandAt(state.leg), stop: state.leg, bonus });
  }
}

function removePassed(state) {
  const limit = state.height + 80;
  state.objects = state.objects.filter((o) => !o.collected && screenY(state, o.wd) <= limit);
}
