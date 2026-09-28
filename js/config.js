// Configuración del juego: mundo, barco, obstáculos, peces, islas y niveles de dificultad.
// Todas las medidas están en "unidades de mundo": el mar mide siempre 400 de ancho
// y el alto depende de la proporción de la pantalla.

export const WORLD_WIDTH = 400;
export const LANES = 5;
export const LANE_WIDTH = WORLD_WIDTH / LANES;

/** Paso máximo de simulación en segundos. Los pasos más largos se trocean. */
export const MAX_STEP = 1 / 60;

export const BOAT = {
  width: 38, // ancho dibujado; limita cuánto se acerca a la costa
  height: 64,
  hitWidth: 26, // caja de choque, algo menor que el dibujo para perdonar roces
  hitHeight: 50,
  bottomOffset: 150, // distancia del centro del barco al borde inferior
  invulnerableTime: 1.5,
};

export const ROCK = { minRadius: 18, maxRadius: 26, hitInset: 3 };
export const WAVE = { width: 96, height: 26, hitInsetX: 10, hitInsetY: 5 };

export const FISH = {
  caballa: { name: 'Caballa', points: 10, radius: 12 },
  vieja: { name: 'Vieja', points: 25, radius: 13 },
};
/** Probabilidad de que un pez sea una vieja en lugar de una caballa. */
export const VIEJA_CHANCE = 0.2;
/** Margen extra alrededor del pez para que pescar sea fácil con el dedo. */
export const FISH_PICKUP_MARGIN = 6;

/** Puntos por alcanzar una isla (se multiplican por el nivel). */
export const ISLAND_BONUS = 50;

/** Unidades de mundo por milla náutica. */
export const UNITS_PER_MILE = 60;
/** Mar libre al zarpar antes de la primera fila de obstáculos. */
export const START_CLEARANCE = 250;
/** Distancia por encima del borde superior a la que aparecen los objetos. */
export const SPAWN_MARGIN = 60;
/** Carriles que puede desplazarse el paso libre entre dos filas seguidas. */
export const MAX_SAFE_SHIFT = 2;

/** Costa de cada isla junto a la ruta: largo a lo largo del viaje y cuánto entra en el mar. */
export const COAST = { halfLength: 230, depth: 100 };

// Centros aproximados de cada isla y superficie en km². La ruta de ida va de oeste a este.
export const ISLANDS = [
  { id: 'hierro', name: 'El Hierro', lat: 27.74, lon: -18.02, area: 269 },
  { id: 'palma', name: 'La Palma', lat: 28.66, lon: -17.87, area: 708 },
  { id: 'gomera', name: 'La Gomera', lat: 28.11, lon: -17.23, area: 370 },
  { id: 'tenerife', name: 'Tenerife', lat: 28.27, lon: -16.6, area: 2034 },
  { id: 'granCanaria', name: 'Gran Canaria', lat: 27.96, lon: -15.59, area: 1560 },
  { id: 'fuerteventura', name: 'Fuerteventura', lat: 28.36, lon: -14.05, area: 1660 },
  { id: 'lanzarote', name: 'Lanzarote', lat: 29.04, lon: -13.63, area: 846 },
];

export const DIFFICULTIES = {
  facil: {
    id: 'facil',
    name: 'Fácil',
    sea: 'Calma chicha',
    lives: 3,
    multiplier: 1,
    baseSpeed: 170, // avance en unidades/s
    speedStep: 0.05, // +5 % de velocidad por isla alcanzada
    maxSpeedFactor: 1.5,
    boatSpeed: 380, // velocidad lateral máxima del barco
    rowInterval: 1.35, // segundos entre filas de obstáculos
    minRocks: 1,
    maxRocks: 2,
    waveChance: 0.1,
    waveSpeed: 35,
    fishChance: 0.75,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    sea: 'Alisio',
    lives: 3,
    multiplier: 2,
    baseSpeed: 220,
    speedStep: 0.06,
    maxSpeedFactor: 1.6,
    boatSpeed: 420,
    rowInterval: 1.1,
    minRocks: 1,
    maxRocks: 3,
    waveChance: 0.22,
    waveSpeed: 60,
    fishChance: 0.65,
  },
  dificil: {
    id: 'dificil',
    name: 'Difícil',
    sea: 'Temporal',
    lives: 2,
    multiplier: 3,
    baseSpeed: 280,
    speedStep: 0.07,
    maxSpeedFactor: 1.75,
    boatSpeed: 470,
    rowInterval: 0.9,
    minRocks: 2,
    maxRocks: 3,
    waveChance: 0.35,
    waveSpeed: 90,
    fishChance: 0.6,
  },
};

export const DIFFICULTY_ORDER = ['facil', 'normal', 'dificil'];
