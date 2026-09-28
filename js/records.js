// Récord por nivel de dificultad, guardado en el navegador (localStorage).
// Si el almacenamiento no está disponible (modo privado, bloqueado…), el récord
// se mantiene en memoria mientras la página siga abierta.

const RECORD_PREFIX = 'travesia-canaria:record:';
const DIFFICULTY_KEY = 'travesia-canaria:dificultad';

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createRecordStore(storage = browserStorage()) {
  const memory = new Map();

  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    memory.set(key, value);
    try {
      storage?.setItem(key, value);
    } catch {
      // Sin almacenamiento persistente: nos quedamos con la copia en memoria.
    }
  }

  function get(difficultyId) {
    const value = Number.parseInt(read(RECORD_PREFIX + difficultyId), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** Registra una puntuación. Devuelve { record, previous, isNew }. */
  function submit(difficultyId, score) {
    const previous = get(difficultyId);
    const value = Math.max(0, Math.floor(Number(score) || 0));
    if (value > previous) {
      write(RECORD_PREFIX + difficultyId, String(value));
      return { record: value, previous, isNew: true };
    }
    return { record: previous, previous, isNew: false };
  }

  return {
    get,
    submit,
    getPreferredDifficulty: () => read(DIFFICULTY_KEY),
    setPreferredDifficulty: (difficultyId) => write(DIFFICULTY_KEY, difficultyId),
  };
}
