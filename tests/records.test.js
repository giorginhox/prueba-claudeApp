import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRecordStore } from '../js/records.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const brokenStorage = {
  getItem() {
    throw new Error('bloqueado');
  },
  setItem() {
    throw new Error('bloqueado');
  },
};

describe('récord', () => {
  it('empieza en cero', () => {
    const store = createRecordStore(fakeStorage());
    assert.equal(store.get('normal'), 0);
  });

  it('guarda una puntuación mejor y la marca como nuevo récord', () => {
    const store = createRecordStore(fakeStorage());
    assert.deepEqual(store.submit('normal', 340), { record: 340, previous: 0, isNew: true });
    assert.equal(store.get('normal'), 340);
  });

  it('no sustituye el récord por una puntuación peor o igual', () => {
    const store = createRecordStore(fakeStorage());
    store.submit('normal', 340);
    assert.deepEqual(store.submit('normal', 120), { record: 340, previous: 340, isNew: false });
    assert.deepEqual(store.submit('normal', 340), { record: 340, previous: 340, isNew: false });
    assert.equal(store.get('normal'), 340);
  });

  it('una partida a cero no es récord', () => {
    const store = createRecordStore(fakeStorage());
    assert.equal(store.submit('facil', 0).isNew, false);
  });

  it('cada nivel tiene su propio récord', () => {
    const store = createRecordStore(fakeStorage());
    store.submit('facil', 500);
    store.submit('dificil', 90);
    assert.equal(store.get('facil'), 500);
    assert.equal(store.get('normal'), 0);
    assert.equal(store.get('dificil'), 90);
  });

  it('persiste entre sesiones en el almacenamiento del navegador', () => {
    const storage = fakeStorage();
    createRecordStore(storage).submit('normal', 780);
    assert.equal(createRecordStore(storage).get('normal'), 780);
  });

  it('ignora valores guardados corruptos', () => {
    const store = createRecordStore(
      fakeStorage({
        'travesia-canaria:record:facil': 'abc',
        'travesia-canaria:record:normal': '-20',
      }),
    );
    assert.equal(store.get('facil'), 0);
    assert.equal(store.get('normal'), 0);
  });

  it('sin almacenamiento disponible sigue funcionando en memoria', () => {
    const store = createRecordStore(brokenStorage);
    assert.equal(store.get('normal'), 0);
    assert.equal(store.submit('normal', 150).isNew, true);
    assert.equal(store.get('normal'), 150);
  });

  it('recuerda el último nivel elegido', () => {
    const storage = fakeStorage();
    createRecordStore(storage).setPreferredDifficulty('dificil');
    assert.equal(createRecordStore(storage).getPreferredDifficulty(), 'dificil');
  });
});
