import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIFFICULTIES, DIFFICULTY_ORDER, LANE_WIDTH, MAX_SAFE_SHIFT, WORLD_WIDTH } from '../js/config.js';
import { createRng } from '../js/random.js';
import { availableLanes, generateRow, laneCenter } from '../js/spawner.js';

const OPEN_SEA = { left: 0, right: WORLD_WIDTH };

/** Genera muchas filas seguidas, con costa a ratos, como en una partida. */
function generateMany(difficulty, count, seed = 7) {
  const rng = createRng(seed);
  const rows = [];
  let prevSafeLane = null;
  for (let i = 0; i < count; i++) {
    const coast = rng() * 100;
    const bounds = i % 5 === 0 ? { left: coast, right: WORLD_WIDTH } : i % 7 === 0 ? { left: 0, right: WORLD_WIDTH - coast } : OPEN_SEA;
    const row = generateRow({ difficulty, rng, wd: i * 300, bounds, prevSafeLane });
    rows.push({ ...row, bounds, prevSafeLane });
    prevSafeLane = row.safeLane;
  }
  return rows;
}

describe('filas de obstáculos', () => {
  for (const id of DIFFICULTY_ORDER) {
    const difficulty = DIFFICULTIES[id];

    it(`${difficulty.name}: siempre queda un paso libre de rocas y olas`, () => {
      for (const row of generateMany(difficulty, 3000)) {
        const blocked = new Set(row.objects.filter((o) => o.type !== 'fish').map((o) => o.lane));
        assert.ok(!blocked.has(row.safeLane), 'el paso seguro tiene un obstáculo');
        assert.ok(availableLanes(row.bounds).includes(row.safeLane), 'el paso seguro está en la costa');
      }
    });

    it(`${difficulty.name}: el paso seguro no salta más de ${MAX_SAFE_SHIFT} carriles`, () => {
      for (const row of generateMany(difficulty, 3000)) {
        if (row.prevSafeLane == null) continue;
        const reachable = availableLanes(row.bounds).some((l) => Math.abs(l - row.prevSafeLane) <= MAX_SAFE_SHIFT);
        if (reachable) assert.ok(Math.abs(row.safeLane - row.prevSafeLane) <= MAX_SAFE_SHIFT);
      }
    });

    it(`${difficulty.name}: nada aparece encima de la costa`, () => {
      for (const row of generateMany(difficulty, 3000)) {
        for (const o of row.objects) {
          const halfWidth = o.type === 'wave' ? 0 : o.r;
          assert.ok(o.x - halfWidth >= row.bounds.left, `${o.type} en x=${o.x} con costa en ${row.bounds.left}`);
          assert.ok(o.x + halfWidth <= row.bounds.right, `${o.type} en x=${o.x} con costa en ${row.bounds.right}`);
        }
      }
    });

    it(`${difficulty.name}: respeta el número de rocas del nivel en mar abierto`, () => {
      const rng = createRng(3);
      for (let i = 0; i < 1000; i++) {
        const { objects } = generateRow({ difficulty, rng, wd: 0, bounds: OPEN_SEA });
        const rocks = objects.filter((o) => o.type === 'rock').length;
        assert.ok(rocks >= difficulty.minRocks && rocks <= difficulty.maxRocks, `${rocks} rocas`);
      }
    });
  }

  it('las rocas no se salen de su carril', () => {
    for (const row of generateMany(DIFFICULTIES.dificil, 2000)) {
      for (const o of row.objects.filter((obj) => obj.type === 'rock')) {
        assert.ok(o.x - o.r >= o.lane * LANE_WIDTH);
        assert.ok(o.x + o.r <= (o.lane + 1) * LANE_WIDTH);
      }
    }
  });

  it('los peces nunca comparten carril con una roca', () => {
    for (const row of generateMany(DIFFICULTIES.normal, 3000)) {
      const rockLanes = new Set(row.objects.filter((o) => o.type === 'rock').map((o) => o.lane));
      for (const fish of row.objects.filter((o) => o.type === 'fish')) assert.ok(!rockLanes.has(fish.lane));
    }
  });

  it('los niveles más difíciles traen más obstáculos', () => {
    const average = (id) => {
      const rows = generateMany(DIFFICULTIES[id], 3000, 11);
      const obstacles = rows.reduce((sum, r) => sum + r.objects.filter((o) => o.type !== 'fish').length, 0);
      return obstacles / rows.length;
    };
    const [facil, normal, dificil] = DIFFICULTY_ORDER.map(average);
    assert.ok(facil < normal && normal < dificil, `fácil ${facil}, normal ${normal}, difícil ${dificil}`);
  });

  it('sin carriles libres no genera nada', () => {
    const rng = createRng(1);
    const { objects } = generateRow({ difficulty: DIFFICULTIES.normal, rng, wd: 0, bounds: { left: 190, right: 210 } });
    assert.deepEqual(objects, []);
  });

  it('el centro de cada carril está en su mitad', () => {
    assert.equal(laneCenter(0), LANE_WIDTH / 2);
    assert.equal(laneCenter(4), WORLD_WIDTH - LANE_WIDTH / 2);
  });
});
