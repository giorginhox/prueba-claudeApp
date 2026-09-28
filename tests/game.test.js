import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOAT, COAST, DIFFICULTIES, DIFFICULTY_ORDER, FISH, ISLAND_BONUS, WORLD_WIDTH } from '../js/config.js';
import {
  boatY,
  createGame,
  fishPoints,
  islandBonus,
  nextIsland,
  screenY,
  setSteer,
  setTarget,
  speedFor,
  step,
} from '../js/game.js';
import { createRng } from '../js/random.js';
import { seaBounds } from '../js/route.js';

/** Partida sin obstáculos automáticos, para colocar a mano lo que haga falta. */
function quietGame(difficulty = 'normal') {
  const game = createGame({ difficulty, height: 700, rng: createRng(1) });
  game.nextRowAt = Infinity;
  return game;
}

let nextTestId = 1000;
/** Coloca un objeto `ahead` unidades por delante del barco (0 = a su altura). */
function place(game, object, ahead = 0) {
  const o = { id: nextTestId++, x: game.boat.x, wd: game.distance + ahead, ...object };
  game.objects.push(o);
  return o;
}

const rock = (extra = {}) => ({ type: 'rock', r: 22, ...extra });
const wave = (extra = {}) => ({ type: 'wave', w: 96, h: 26, vx: 0, ...extra });
const fish = (kind = 'caballa', extra = {}) => ({ type: 'fish', kind, r: FISH[kind].radius, ...extra });

const TICK = 1 / 60;

describe('choques', () => {
  it('chocar con una roca quita un salvavidas y activa la invulnerabilidad', () => {
    const game = quietGame();
    place(game, rock());
    const events = step(game, TICK);
    assert.equal(game.lives, DIFFICULTIES.normal.lives - 1);
    assert.ok(game.boat.invulnerable > 0);
    assert.deepEqual(
      events.map((e) => e.type),
      ['hit'],
    );
    assert.equal(events[0].obstacle, 'rock');
  });

  it('chocar con una ola también quita un salvavidas', () => {
    const game = quietGame();
    place(game, wave());
    const events = step(game, TICK);
    assert.equal(game.lives, DIFFICULTIES.normal.lives - 1);
    assert.equal(events[0].obstacle, 'wave');
  });

  it('una roca que pasa por el carril de al lado no hace daño', () => {
    const game = quietGame();
    place(game, rock({ x: game.boat.x + 60 }), 300);
    step(game, 3);
    assert.equal(game.lives, DIFFICULTIES.normal.lives);
  });

  it('durante la invulnerabilidad no se pierden más salvavidas', () => {
    const game = quietGame();
    place(game, rock());
    step(game, TICK);
    place(game, rock());
    step(game, TICK);
    assert.equal(game.lives, DIFFICULTIES.normal.lives - 1);
  });

  it('pasada la invulnerabilidad, otro choque vuelve a contar', () => {
    const game = quietGame();
    place(game, rock());
    step(game, TICK);
    step(game, BOAT.invulnerableTime + 0.1);
    place(game, rock());
    step(game, TICK);
    assert.equal(game.lives, DIFFICULTIES.normal.lives - 2);
  });

  it('perder el último salvavidas termina la partida', () => {
    const game = quietGame('dificil'); // 2 salvavidas
    place(game, rock());
    step(game, TICK);
    step(game, BOAT.invulnerableTime + 0.1);
    place(game, rock());
    const events = step(game, TICK);
    assert.equal(game.lives, 0);
    assert.equal(game.status, 'over');
    assert.deepEqual(
      events.map((e) => e.type),
      ['hit', 'gameover'],
    );
  });

  it('tras el naufragio la partida queda detenida', () => {
    const game = quietGame('dificil');
    game.lives = 1;
    place(game, rock());
    step(game, TICK);
    const { distance, score } = game;
    assert.deepEqual(step(game, 1), []);
    assert.equal(game.distance, distance);
    assert.equal(game.score, score);
  });

  it('un paso largo se trocea y la roca no se atraviesa', () => {
    const game = quietGame();
    place(game, rock(), 300);
    // En 3 s el mar avanza ~660 unidades: la roca pasa de largo si no se trocea el paso.
    step(game, 3);
    assert.equal(game.lives, DIFFICULTIES.normal.lives - 1);
  });

  it('las olas se desplazan de lado y rebotan en los bordes', () => {
    const game = quietGame();
    const o = place(game, wave({ x: WORLD_WIDTH - 60, vx: 100 }), 2000);
    step(game, 0.5);
    assert.ok(o.x + o.w / 2 <= WORLD_WIDTH);
    assert.ok(o.vx < 0, 'la ola debería volver hacia la izquierda');
  });
});

describe('puntos', () => {
  for (const id of DIFFICULTY_ORDER) {
    const difficulty = DIFFICULTIES[id];

    it(`${difficulty.name}: una caballa vale ${FISH.caballa.points} × ${difficulty.multiplier}`, () => {
      const game = quietGame(id);
      place(game, fish('caballa'));
      const events = step(game, TICK);
      assert.equal(game.score, FISH.caballa.points * difficulty.multiplier);
      assert.equal(events[0].type, 'fish');
      assert.equal(events[0].points, game.score);
    });
  }

  it('una vieja vale más que una caballa', () => {
    const game = quietGame();
    place(game, fish('vieja'));
    step(game, TICK);
    assert.equal(game.score, fishPoints('vieja', DIFFICULTIES.normal));
    assert.ok(fishPoints('vieja', DIFFICULTIES.normal) > fishPoints('caballa', DIFFICULTIES.normal));
  });

  it('el pez desaparece al pescarlo y no puntúa dos veces', () => {
    const game = quietGame();
    place(game, fish());
    step(game, TICK);
    step(game, TICK);
    assert.equal(game.score, fishPoints('caballa', DIFFICULTIES.normal));
    assert.equal(game.fishCaught, 1);
    assert.equal(game.objects.length, 0);
  });

  it('pescar no quita salvavidas, ni siquiera siendo invulnerable', () => {
    const game = quietGame();
    game.boat.invulnerable = 1;
    place(game, fish());
    step(game, TICK);
    assert.equal(game.lives, DIFFICULTIES.normal.lives);
    assert.equal(game.fishCaught, 1);
  });

  it('un pez lejos del barco no se pesca', () => {
    const game = quietGame();
    place(game, fish('caballa', { x: game.boat.x + 90 }));
    step(game, TICK);
    assert.equal(game.score, 0);
  });

  it('alcanzar una isla suma el bonus del nivel', () => {
    const game = quietGame('dificil');
    game.distance = game.legEnd - 1;
    const events = step(game, TICK);
    const island = events.find((e) => e.type === 'island');
    assert.equal(island.island.name, 'La Palma');
    assert.equal(island.bonus, ISLAND_BONUS * DIFFICULTIES.dificil.multiplier);
    assert.equal(game.score, islandBonus(DIFFICULTIES.dificil));
    assert.equal(game.islandsReached, 1);
  });
});

describe('niveles', () => {
  it('existen tres niveles ordenados de más fácil a más difícil', () => {
    assert.deepEqual(DIFFICULTY_ORDER, ['facil', 'normal', 'dificil']);
    const [facil, normal, dificil] = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id]);
    assert.ok(facil.baseSpeed < normal.baseSpeed && normal.baseSpeed < dificil.baseSpeed);
    assert.ok(facil.rowInterval > normal.rowInterval && normal.rowInterval > dificil.rowInterval);
    assert.ok(facil.waveChance < normal.waveChance && normal.waveChance < dificil.waveChance);
    assert.ok(facil.lives >= normal.lives && normal.lives >= dificil.lives);
    assert.ok(facil.multiplier < normal.multiplier && normal.multiplier < dificil.multiplier);
  });

  it('cada partida empieza con los salvavidas y la velocidad de su nivel', () => {
    for (const id of DIFFICULTY_ORDER) {
      const game = createGame({ difficulty: id });
      assert.equal(game.lives, DIFFICULTIES[id].lives);
      assert.equal(game.speed, DIFFICULTIES[id].baseSpeed);
      assert.equal(game.score, 0);
    }
  });

  it('rechaza un nivel desconocido', () => {
    assert.throws(() => createGame({ difficulty: 'huracan' }), /desconocida/);
  });

  it('cada isla alcanzada acelera el barco', () => {
    const game = quietGame();
    const before = game.speed;
    game.distance = game.legEnd;
    step(game, TICK);
    assert.equal(game.speed, speedFor(DIFFICULTIES.normal, 1));
    assert.ok(game.speed > before);
  });

  it('la velocidad tiene un tope por nivel', () => {
    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      assert.equal(speedFor(d, 1000), d.baseSpeed * d.maxSpeedFactor);
    }
  });

  it('tras Lanzarote empieza la vuelta hacia El Hierro', () => {
    const game = quietGame();
    const reached = [];
    for (let i = 0; i < 8; i++) {
      game.distance = game.legEnd;
      for (const e of step(game, TICK)) if (e.type === 'island') reached.push(e.island.name);
    }
    assert.deepEqual(reached, [
      'La Palma',
      'La Gomera',
      'Tenerife',
      'Gran Canaria',
      'Fuerteventura',
      'Lanzarote',
      'Fuerteventura',
      'Gran Canaria',
    ]);
    assert.equal(nextIsland(game).name, 'Tenerife');
  });
});

describe('timón', () => {
  it('el barco va hacia el dedo sin pasar de su velocidad máxima', () => {
    const game = quietGame();
    const start = game.boat.x;
    setTarget(game, WORLD_WIDTH);
    step(game, 0.1);
    assert.ok(Math.abs(game.boat.x - (start + DIFFICULTIES.normal.boatSpeed * 0.1)) < 1e-6);
  });

  it('se detiene en el punto tocado', () => {
    const game = quietGame();
    setTarget(game, 260);
    step(game, 1);
    assert.equal(game.boat.x, 260);
  });

  it('no puede salir del mar', () => {
    const game = quietGame();
    game.distance = 2000; // lejos de cualquier isla
    game.nextRowAt = Infinity;
    setTarget(game, WORLD_WIDTH + 500);
    step(game, 2);
    assert.equal(game.boat.x, WORLD_WIDTH - BOAT.width / 2);
  });

  it('la costa de la isla empuja al barco hacia el mar', () => {
    const game = quietGame();
    // Al zarpar, El Hierro queda a la izquierda: el barco no puede meterse en tierra.
    game.boat.x = 5;
    setTarget(game, 0);
    step(game, TICK);
    const coast = seaBounds(game.marks, game.distance, WORLD_WIDTH).left;
    assert.ok(coast > COAST.depth * 0.99, `costa en ${coast}`);
    assert.equal(game.boat.x, coast + BOAT.width / 2);
  });

  it('lejos de las islas el barco puede llegar al borde izquierdo', () => {
    const game = quietGame();
    game.distance = 2000;
    setTarget(game, 0);
    step(game, 2);
    assert.equal(game.boat.x, BOAT.width / 2);
  });

  it('las flechas del teclado mueven el barco', () => {
    const game = quietGame();
    const start = game.boat.x;
    setSteer(game, -1);
    step(game, 0.1);
    assert.ok(game.boat.x < start);
    setSteer(game, 0);
    const stopped = game.boat.x;
    step(game, 0.1);
    assert.equal(game.boat.x, stopped);
  });
});

describe('partida completa simulada', () => {
  function autopilot(seed, id, seconds) {
    const game = createGame({ difficulty: id, height: 760, rng: createRng(seed) });
    const rng = createRng(seed + 1);
    for (let t = 0; t < seconds && game.status === 'playing'; t += TICK) {
      if (rng() < 0.02) setTarget(game, rng() * WORLD_WIDTH);
      step(game, TICK);
      assert.ok(game.lives >= 0 && game.lives <= DIFFICULTIES[id].lives);
      assert.ok(game.score >= 0);
      for (const o of game.objects) assert.ok(screenY(game, o.wd) <= game.height + 80);
    }
    return game;
  }

  it('con la misma semilla y los mismos toques el resultado es idéntico', () => {
    const a = autopilot(42, 'normal', 60);
    const b = autopilot(42, 'normal', 60);
    assert.equal(a.score, b.score);
    assert.equal(a.distance, b.distance);
    assert.equal(a.lives, b.lives);
  });

  it('los objetos que quedan atrás se eliminan', () => {
    for (const id of DIFFICULTY_ORDER) {
      const game = autopilot(9, id, 90);
      assert.ok(game.objects.length < 40, `${game.objects.length} objetos en ${id}`);
    }
  });

  it('el barco siempre está a su altura fija', () => {
    const game = createGame({ height: 800 });
    assert.equal(boatY(game), 800 - BOAT.bottomOffset);
  });
});
