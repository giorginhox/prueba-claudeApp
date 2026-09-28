// Geometría: choques entre círculos y rectángulos, y distancias en el mapa.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Rectángulos { x, y, w, h } con (x, y) en el centro. Tocarse por el borde no cuenta. */
export function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

/** Círculo { x, y, r } contra rectángulo centrado { x, y, w, h }. */
export function circleRectOverlap(circle, rect) {
  const nearestX = clamp(circle.x, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const nearestY = clamp(circle.y, rect.y - rect.h / 2, rect.y + rect.h / 2);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

const EARTH_RADIUS_NM = 3440.065;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Distancia ortodrómica en millas náuticas entre dos puntos { lat, lon }. */
export function nauticalMiles(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
