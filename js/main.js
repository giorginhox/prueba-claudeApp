// Arranque: une la simulación, el dibujo, los controles y la interfaz en un bucle de juego.

import { DIFFICULTIES, WORLD_WIDTH } from './config.js';
import { createGame, setHeight, setSteer, setTarget, step } from './game.js';
import { bindInput } from './input.js';
import { createRecordStore } from './records.js';
import { createRenderer } from './renderer.js';
import { createUI } from './ui.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('sea');
const renderer = createRenderer(canvas);
const records = createRecordStore();

const saved = records.getPreferredDifficulty();
let difficultyId = DIFFICULTIES[saved] ? saved : 'normal';
let mode = 'menu'; // 'menu' | 'playing' | 'paused' | 'over'
let game = createGame({ difficulty: difficultyId, height: renderer.worldHeight });
let overTimer = null;

const ui = createUI({
  onSelectDifficulty(id) {
    difficultyId = id;
    records.setPreferredDifficulty(id);
  },
  onStart: startGame,
  onPause: pauseGame,
  onResume: resumeGame,
  onMenu: showMenu,
});

function startGame() {
  clearTimeout(overTimer);
  records.setPreferredDifficulty(difficultyId);
  game = createGame({ difficulty: difficultyId, height: renderer.worldHeight });
  renderer.reset();
  mode = 'playing';
  ui.showPlaying();
}

function pauseGame() {
  if (mode !== 'playing') return false;
  mode = 'paused';
  setSteer(game, 0);
  ui.showPause();
  return true;
}

function resumeGame() {
  if (mode !== 'paused') return;
  mode = 'playing';
  ui.showPlaying();
}

function showMenu() {
  clearTimeout(overTimer);
  mode = 'menu';
  game = createGame({ difficulty: difficultyId, height: renderer.worldHeight });
  renderer.reset();
  ui.setRecords(records);
  ui.setDifficulty(difficultyId);
  ui.showMenu();
}

function finishGame() {
  mode = 'over';
  const result = records.submit(game.difficulty.id, game.score);
  ui.setRecords(records);
  const finished = game;
  // Un instante para ver el choque antes del resumen.
  overTimer = setTimeout(() => ui.showGameOver(finished, result), 700);
}

function vibrate(ms) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Algunos navegadores no permiten vibrar; no pasa nada.
  }
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'fish') {
      renderer.popup(event.x, event.y, `+${event.points}`, event.kind === 'vieja' ? '#FFC62E' : '#F3F7F4');
      renderer.splash(event.x, event.y, '#F3F7F4', 8);
    } else if (event.type === 'hit') {
      renderer.hit(event.x, event.y);
      vibrate(event.lives > 0 ? 90 : 250);
    } else if (event.type === 'island') {
      ui.showBanner(event.island.name, `Isla alcanzada · +${event.bonus}`);
    } else if (event.type === 'gameover') {
      finishGame();
    }
  }
}

bindInput(canvas, {
  toWorldX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * WORLD_WIDTH;
  },
  onTarget(x) {
    if (mode === 'playing') setTarget(game, x);
  },
  onSteer(dir) {
    if (mode === 'playing') setSteer(game, dir);
  },
  onPause() {
    if (mode === 'playing') return pauseGame();
    if (mode === 'paused') {
      resumeGame();
      return true;
    }
    return false;
  },
});

function fitCanvas() {
  const { width, height } = stage.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  setHeight(game, renderer.resize(width, height));
}
new ResizeObserver(fitCanvas).observe(stage);
fitCanvas();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode === 'playing') {
    handleEvents(step(game, dt));
    ui.updateHud(game);
  } else if (mode === 'menu') {
    // De fondo, el barco sale despacio del puerto de El Hierro.
    game.distance = (game.distance + 26 * dt) % 900;
  }
  renderer.draw(game, mode === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}

showMenu();
requestAnimationFrame(frame);
