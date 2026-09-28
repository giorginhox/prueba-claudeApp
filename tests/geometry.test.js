import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { circleRectOverlap, clamp, nauticalMiles, rectsOverlap } from '../js/geometry.js';

describe('rectsOverlap', () => {
  const boat = { x: 100, y: 100, w: 20, h: 40 };

  it('detecta rectángulos que se solapan', () => {
    assert.equal(rectsOverlap(boat, { x: 110, y: 110, w: 20, h: 20 }), true);
  });

  it('ignora rectángulos separados', () => {
    assert.equal(rectsOverlap(boat, { x: 200, y: 100, w: 20, h: 20 }), false);
    assert.equal(rectsOverlap(boat, { x: 100, y: 200, w: 20, h: 20 }), false);
  });

  it('tocarse justo por el borde no es choque', () => {
    assert.equal(rectsOverlap(boat, { x: 120, y: 100, w: 20, h: 20 }), false);
  });
});

describe('circleRectOverlap', () => {
  const boat = { x: 0, y: 0, w: 20, h: 40 };

  it('círculo con el centro dentro del rectángulo', () => {
    assert.equal(circleRectOverlap({ x: 2, y: 5, r: 3 }, boat), true);
  });

  it('círculo pegado al costado dentro de su radio', () => {
    assert.equal(circleRectOverlap({ x: 15, y: 0, r: 6 }, boat), true);
  });

  it('círculo cerca de una esquina pero fuera en diagonal', () => {
    // A 5 unidades en cada eje de la esquina (10, 20): distancia ≈ 7,07 > 6.
    assert.equal(circleRectOverlap({ x: 15, y: 25, r: 6 }, boat), false);
  });

  it('círculo tangente al borde no cuenta como choque', () => {
    assert.equal(circleRectOverlap({ x: 16, y: 0, r: 6 }, boat), false);
  });
});

describe('clamp', () => {
  it('limita un valor a un intervalo', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-3, 0, 10), 0);
    assert.equal(clamp(42, 0, 10), 10);
  });
});

describe('nauticalMiles', () => {
  it('un grado de latitud son unas 60 millas', () => {
    const d = nauticalMiles({ lat: 28, lon: -16 }, { lat: 29, lon: -16 });
    assert.ok(Math.abs(d - 60) < 0.1, `salió ${d}`);
  });

  it('es simétrica y vale cero en el mismo punto', () => {
    const a = { lat: 27.74, lon: -18.02 };
    const b = { lat: 29.04, lon: -13.63 };
    assert.equal(nauticalMiles(a, a), 0);
    assert.ok(Math.abs(nauticalMiles(a, b) - nauticalMiles(b, a)) < 1e-9);
  });
});
