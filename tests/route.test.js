import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COAST, ISLANDS, WORLD_WIDTH } from '../js/config.js';
import { coastIntrusion, coastSide, islandAt, islandIndexAt, legLength, seaBounds } from '../js/route.js';

describe('ruta de ida y vuelta', () => {
  it('va de El Hierro a Lanzarote y vuelve', () => {
    const names = Array.from({ length: 14 }, (_, stop) => islandAt(stop).name);
    assert.deepEqual(names, [
      'El Hierro',
      'La Palma',
      'La Gomera',
      'Tenerife',
      'Gran Canaria',
      'Fuerteventura',
      'Lanzarote',
      'Fuerteventura',
      'Gran Canaria',
      'Tenerife',
      'La Gomera',
      'La Palma',
      'El Hierro',
      'La Palma',
    ]);
  });

  it('cada índice apunta a una isla existente', () => {
    for (let stop = 0; stop < 100; stop++) {
      const i = islandIndexAt(stop);
      assert.ok(i >= 0 && i < ISLANDS.length);
    }
  });

  it('la travesía de vuelta mide lo mismo que la de ida', () => {
    // Parada 0: El Hierro → La Palma. Parada 11: La Palma → El Hierro.
    assert.equal(legLength(0), legLength(11));
    // Parada 5: Fuerteventura → Lanzarote. Parada 6: Lanzarote → Fuerteventura.
    assert.equal(legLength(5), legLength(6));
  });

  it('todas las travesías tienen longitud positiva', () => {
    for (let stop = 0; stop < 12; stop++) assert.ok(legLength(stop) > 0);
  });

  it('las costas se alternan a izquierda y derecha', () => {
    assert.equal(coastSide(0), 'left');
    assert.equal(coastSide(1), 'right');
    assert.equal(coastSide(2), 'left');
  });
});

describe('costa de las islas', () => {
  it('entra al máximo justo al pasar la isla y desaparece lejos de ella', () => {
    assert.equal(coastIntrusion(1000, 1000), COAST.depth);
    assert.equal(coastIntrusion(1000, 1000 + COAST.halfLength), 0);
    assert.equal(coastIntrusion(1000, 1000 - COAST.halfLength - 50), 0);
  });

  it('es simétrica antes y después de la isla', () => {
    assert.ok(Math.abs(coastIntrusion(1000, 900) - coastIntrusion(1000, 1100)) < 1e-9);
  });

  it('estrecha el mar por el lado de la isla', () => {
    const marks = [
      { stop: 0, at: 0 },
      { stop: 1, at: 5000 },
    ];
    assert.deepEqual(seaBounds(marks, 0, WORLD_WIDTH), { left: COAST.depth, right: WORLD_WIDTH });
    assert.deepEqual(seaBounds(marks, 5000, WORLD_WIDTH), { left: 0, right: WORLD_WIDTH - COAST.depth });
    assert.deepEqual(seaBounds(marks, 2500, WORLD_WIDTH), { left: 0, right: WORLD_WIDTH });
  });
});
