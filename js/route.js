// Ruta entre islas: ida de El Hierro a Lanzarote, vuelta a El Hierro, y así sucesivamente.
// Cada "parada" es una isla alcanzada; la parada 0 es El Hierro, desde donde se zarpa.

import { COAST, ISLANDS, UNITS_PER_MILE } from './config.js';
import { nauticalMiles } from './geometry.js';

const LAST = ISLANDS.length - 1;

/** Índice en ISLANDS de la parada `stop`: 0, 1, …, 6, 5, …, 0, 1, … */
export function islandIndexAt(stop) {
  const m = stop % (2 * LAST);
  return m <= LAST ? m : 2 * LAST - m;
}

export function islandAt(stop) {
  return ISLANDS[islandIndexAt(stop)];
}

/** Millas de la travesía que empieza en la parada `stop`. */
export function legMiles(stop) {
  return nauticalMiles(islandAt(stop), islandAt(stop + 1));
}

/** Largo en unidades de mundo de la travesía que empieza en la parada `stop`. */
export function legLength(stop) {
  return Math.round(legMiles(stop) * UNITS_PER_MILE);
}

/** Lado de la pantalla por el que pasa la costa de cada parada (alternan). */
export function coastSide(stop) {
  return stop % 2 === 0 ? 'left' : 'right';
}

/**
 * Cuánto entra la costa de una isla en el mar a una distancia del viaje dada.
 * `at` es la distancia a la que se alcanza la isla; el perfil es suave y
 * vale 0 fuera de ±COAST.halfLength.
 */
export function coastIntrusion(at, worldDist) {
  const t = (worldDist - at) / COAST.halfLength;
  if (t <= -1 || t >= 1) return 0;
  return COAST.depth * Math.cos((Math.PI / 2) * t);
}

/**
 * Límites navegables { left, right } a una distancia del viaje, teniendo en cuenta
 * las islas cercanas (`marks`: lista de { stop, at }).
 */
export function seaBounds(marks, worldDist, width) {
  let left = 0;
  let right = width;
  for (const mark of marks) {
    const depth = coastIntrusion(mark.at, worldDist);
    if (depth <= 0) continue;
    if (coastSide(mark.stop) === 'left') left = Math.max(left, depth);
    else right = Math.min(right, width - depth);
  }
  return { left, right };
}
