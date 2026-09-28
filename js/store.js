// Lógica del inventario, sin DOM: crear, sumar/restar, avisos de mínimo, búsqueda,
// agrupación y copias de seguridad. Las funciones no modifican la lista recibida:
// devuelven una nueva.

export const CATEGORIES = [
  { id: 'tuberia', name: 'Tubería' },
  { id: 'electrico', name: 'Eléctrico' },
  { id: 'gas', name: 'Gas' },
  { id: 'tornilleria', name: 'Tornillería' },
  { id: 'herramientas', name: 'Herramientas' },
];

export const MAX_QUANTITY = 99999;
export const MAX_NAME_LENGTH = 60;

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function categoryName(id) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? '';
}

/** Minúsculas, sin tildes y con los espacios normalizados: "Eléctrico " → "electrico". */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte cualquier valor en una cantidad entera válida (0 … MAX_QUANTITY). */
export function toCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_QUANTITY);
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Comprueba los datos de un formulario. Devuelve { ok, errors, value }, donde `value`
 * son los datos ya limpios y `errors` indica qué campo falla y por qué.
 */
export function validateDraft(draft, items = [], exceptId = null) {
  const value = {
    name: String(draft.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH),
    category: draft.category,
    quantity: toCount(draft.quantity),
    min: toCount(draft.min),
  };
  const errors = {};
  if (!value.name) errors.name = 'Escribe el nombre del material.';
  if (!CATEGORY_IDS.has(value.category)) errors.category = 'Elige una categoría.';
  if (!errors.name && !errors.category) {
    const duplicate = findDuplicate(items, value.name, value.category, exceptId);
    if (duplicate) {
      errors.name = `Ya tienes «${duplicate.name}» en ${categoryName(duplicate.category)}. Usa + para sumar.`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function findDuplicate(items, name, category, exceptId = null) {
  const key = normalizeText(name);
  return items.find((item) => item.id !== exceptId && item.category === category && normalizeText(item.name) === key) ?? null;
}

export function createItem(draft, { id = newId(), now = Date.now() } = {}) {
  const { ok, errors, value } = validateDraft(draft);
  if (!ok) throw new Error(Object.values(errors)[0]);
  return { id, ...value, updatedAt: now };
}

export function addItem(items, item) {
  return [...items, item];
}

export function updateItem(items, id, changes, now = Date.now()) {
  return items.map((item) => (item.id === id ? { ...item, ...changes, id, updatedAt: now } : item));
}

/** Suma (delta > 0) o resta (delta < 0) sin bajar de 0 ni pasar del máximo. */
export function adjustQuantity(items, id, delta, now = Date.now()) {
  return items.map((item) =>
    item.id === id ? { ...item, quantity: toCount(item.quantity + delta), updatedAt: now } : item,
  );
}

/** Quita un material. Devuelve la lista nueva y lo necesario para deshacer. */
export function removeItem(items, id) {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { items, removed: null, index: -1 };
  return { items: items.filter((item) => item.id !== id), removed: items[index], index };
}

export function restoreItem(items, item, index) {
  if (items.some((i) => i.id === item.id)) return items;
  const copy = [...items];
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
  return copy;
}

/** En rojo cuando la cantidad baja del mínimo elegido. Con mínimo 0 nunca avisa. */
export function isLow(item) {
  return item.quantity < item.min;
}

/** Cuántos faltan para volver a llegar al mínimo. */
export function missing(item) {
  return isLow(item) ? item.min - item.quantity : 0;
}

/**
 * Filtra por texto (nombre o categoría, sin distinguir tildes ni mayúsculas; todas las
 * palabras deben aparecer) y por `filter`: 'all', 'low' o el id de una categoría.
 */
export function filterItems(items, { query = '', filter = 'all' } = {}) {
  const words = normalizeText(query).split(' ').filter(Boolean);
  return items.filter((item) => {
    if (filter === 'low' && !isLow(item)) return false;
    if (CATEGORY_IDS.has(filter) && item.category !== filter) return false;
    if (words.length === 0) return true;
    const haystack = normalizeText(`${item.name} ${categoryName(item.category)}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Grupos por categoría en el orden fijo de CATEGORIES, con los materiales por nombre. */
export function groupByCategory(items) {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category.id).sort((a, b) => collator.compare(a.name, b.name)),
  })).filter((group) => group.items.length > 0);
}

export function countItems(items) {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  let low = 0;
  for (const item of items) {
    if (item.category in byCategory) byCategory[item.category] += 1;
    if (isLow(item)) low += 1;
  }
  return { total: items.length, low, byCategory };
}

/** Limpia un material leído de fuera (almacenamiento o copia). Devuelve null si no vale. */
export function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { ok, value } = validateDraft(raw);
  if (!ok) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
  const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
  return { id, ...value, updatedAt };
}

/** Limpia una lista completa: descarta lo inválido y los ids repetidos. */
export function sanitizeItems(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of list) {
    const item = sanitizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function serializeBackup(items, now = new Date()) {
  return JSON.stringify({ app: 'mi-furgo', version: 1, exportedAt: now.toISOString(), items }, null, 2);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es una copia de Mi Furgo.');
  }
  if (!data || data.app !== 'mi-furgo' || !Array.isArray(data.items)) {
    throw new Error('El archivo no es una copia de Mi Furgo.');
  }
  return sanitizeItems(data.items);
}
