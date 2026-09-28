// Generador pseudoaleatorio con semilla (mulberry32), para partidas y pruebas reproducibles.

export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** Entero entre min y max, ambos incluidos. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickOne(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Devuelve una copia barajada (Fisher-Yates). */
export function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
