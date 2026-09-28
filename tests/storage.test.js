import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STORAGE_KEY, loadItems, loadPrefs, saveItems, savePrefs } from '../js/storage.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const blocked = {
  getItem() {
    throw new Error('bloqueado');
  },
  setItem() {
    throw new Error('bloqueado');
  },
};

const tubo = { id: 't1', name: 'Tubo cobre 15', category: 'tuberia', quantity: 4, min: 5, updatedAt: 1 };

describe('guardado en el móvil', () => {
  it('sin datos guardados empieza vacío', () => {
    assert.deepEqual(loadItems(fakeStorage()), []);
  });

  it('lo guardado se recupera al volver a abrir la app', () => {
    const storage = fakeStorage();
    assert.equal(saveItems([tubo], storage), true);
    assert.deepEqual(loadItems(storage), [tubo]);
  });

  it('datos corruptos no rompen la app', () => {
    assert.deepEqual(loadItems(fakeStorage({ [STORAGE_KEY]: '{roto' })), []);
    assert.deepEqual(loadItems(fakeStorage({ [STORAGE_KEY]: '"texto"' })), []);
  });

  it('descarta materiales inválidos guardados', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, items: [tubo, { id: 'x', name: '', category: 'gas' }] }),
    });
    assert.deepEqual(loadItems(storage), [tubo]);
  });

  it('si el navegador bloquea el guardado, avisa sin romperse', () => {
    assert.equal(saveItems([tubo], blocked), false);
    assert.deepEqual(loadItems(blocked), []);
    assert.equal(saveItems([tubo], null), false);
  });

  it('recuerda las preferencias', () => {
    const storage = fakeStorage();
    savePrefs({ lastCategory: 'gas' }, storage);
    assert.deepEqual(loadPrefs(storage), { lastCategory: 'gas' });
    assert.deepEqual(loadPrefs(blocked), {});
  });
});
