// Guarda el inventario en el propio móvil (localStorage). Si el navegador no deja
// guardar, la app sigue funcionando y avisa.

import { sanitizeItems } from './store.js';

export const STORAGE_KEY = 'mi-furgo:materiales';
const PREFS_KEY = 'mi-furgo:preferencias';

export function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadItems(storage = defaultStorage()) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return [];
    const data = JSON.parse(text);
    return sanitizeItems(Array.isArray(data) ? data : data?.items);
  } catch {
    return [];
  }
}

/** Devuelve true si se ha guardado. */
export function saveItems(items, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(storage = defaultStorage()) {
  try {
    const data = JSON.parse(storage?.getItem(PREFS_KEY) ?? '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function savePrefs(prefs, storage = defaultStorage()) {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Las preferencias son una comodidad; si no se guardan no pasa nada.
  }
}

/** Pide a Safari que no borre los datos por falta de espacio. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
