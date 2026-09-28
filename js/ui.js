// Interfaz HTML: menú, marcador, mapa de la ruta, pausa y fin de partida.

import { DIFFICULTIES, DIFFICULTY_ORDER, ISLANDS } from './config.js';
import { legProgress, milesSailed, milesToNextIsland, nextIsland } from './game.js';
import { islandAt } from './route.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const numberFormat = new Intl.NumberFormat('es-ES');
const formatNumber = (n) => numberFormat.format(Math.round(n));

// Proyección sencilla del archipiélago: longitud corregida por la latitud media.
const MAP = { lonMin: -18.35, lonMax: -13.1, latMin: 27.45, latMax: 29.4, unit: 100 };
const LON_SCALE = Math.cos((28.3 * Math.PI) / 180);
const MAP_WIDTH = (MAP.lonMax - MAP.lonMin) * LON_SCALE * MAP.unit;
const MAP_HEIGHT = (MAP.latMax - MAP.latMin) * MAP.unit;
const LABEL_BELOW = new Set(['hierro', 'gomera', 'granCanaria', 'fuerteventura']);

function project({ lat, lon }) {
  return { x: (lon - MAP.lonMin) * LON_SCALE * MAP.unit, y: (MAP.latMax - lat) * MAP.unit };
}

/** Radio en el mapa de un círculo con la misma superficie que la isla. */
function islandRadius(island) {
  return (Math.sqrt(island.area / Math.PI) / 111) * MAP.unit;
}

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function buildRouteMap(root, { labels }) {
  root.setAttribute('viewBox', `0 0 ${MAP_WIDTH.toFixed(1)} ${MAP_HEIGHT.toFixed(1)}`);
  root.replaceChildren();
  const points = ISLANDS.map(project);
  root.append(
    svg('polyline', {
      class: 'route-map__line',
      points: points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    }),
  );
  const dots = new Map();
  ISLANDS.forEach((island, i) => {
    const { x, y } = points[i];
    const r = islandRadius(island);
    const dot = svg('circle', { class: 'route-map__island', cx: x, cy: y, r });
    dot.append(svg('title'));
    dot.firstChild.textContent = island.name;
    root.append(dot);
    dots.set(island.id, dot);
    if (labels) {
      const below = LABEL_BELOW.has(island.id);
      // Junto a los bordes del mapa el nombre se alinea hacia dentro para no cortarse.
      const nearLeft = x < 50;
      const nearRight = x > MAP_WIDTH - 50;
      const label = svg('text', {
        class: 'route-map__label',
        x: nearLeft ? x - r : nearRight ? x + r : x,
        y: below ? y + r + 15 : y - r - 6,
        'text-anchor': nearLeft ? 'start' : nearRight ? 'end' : 'middle',
      });
      label.textContent = island.name;
      root.append(label);
    }
  });
  const boat = svg('circle', { class: 'route-map__boat', r: labels ? 7 : 9 });
  root.append(boat);
  return { dots, boat, points };
}

export function createUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const screens = { menu: $('screen-menu'), pause: $('screen-pause'), over: $('screen-over') };
  const hud = $('hud');
  const hudScore = $('hud-score');
  const hudDestination = $('hud-destination');
  const hudMiles = $('hud-miles');
  const hudLives = $('hud-lives');
  const banner = $('banner');
  const levelList = $('levels');

  const menuMap = buildRouteMap($('menu-map'), { labels: true });
  const hudMap = buildRouteMap($('hud-map'), { labels: false });
  const start = menuMap.points[0];
  menuMap.boat.setAttribute('cx', start.x);
  menuMap.boat.setAttribute('cy', start.y);

  // Niveles de dificultad a partir de la configuración.
  const recordEls = new Map();
  for (const id of DIFFICULTY_ORDER) {
    const d = DIFFICULTIES[id];
    const label = document.createElement('label');
    label.className = 'level';
    label.innerHTML = `
      <input type="radio" name="nivel" id="nivel-${id}" value="${id}">
      <span class="level__name">${d.name}</span>
      <span class="level__sea">${d.sea}</span>
      <span class="level__meta">${d.lives} salvavidas · puntos ×${d.multiplier}</span>
      <span class="level__record">Récord <b>0</b></span>`;
    label.querySelector('input').addEventListener('change', () => handlers.onSelectDifficulty(id));
    recordEls.set(id, label.querySelector('.level__record b'));
    levelList.append(label);
  }

  $('btn-start').addEventListener('click', handlers.onStart);
  $('btn-pause').addEventListener('click', handlers.onPause);
  $('btn-resume').addEventListener('click', handlers.onResume);
  $('btn-quit').addEventListener('click', handlers.onMenu);
  $('btn-retry').addEventListener('click', handlers.onStart);
  $('btn-menu').addEventListener('click', handlers.onMenu);

  let shown = {};
  let bannerTimer = null;

  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    const focusTarget = name && screens[name].querySelector('[data-autofocus]');
    focusTarget?.focus({ preventScroll: true });
  }

  function setRecords(records) {
    for (const [id, el] of recordEls) el.textContent = formatNumber(records.get(id));
  }

  function setDifficulty(id) {
    const input = $(`nivel-${id}`);
    if (input) input.checked = true;
  }

  function renderLives(lives, max) {
    hudLives.replaceChildren();
    for (let i = 0; i < max; i++) {
      const ring = document.createElement('span');
      ring.className = i < lives ? 'ring' : 'ring ring--lost';
      hudLives.append(ring);
    }
    hudLives.setAttribute('aria-label', `${lives} de ${max} salvavidas`);
  }

  function updateHud(game) {
    const miles = Math.ceil(milesToNextIsland(game));
    const destination = nextIsland(game).name;
    const next = { score: game.score, lives: game.lives, destination, miles };
    if (next.score !== shown.score) hudScore.textContent = formatNumber(next.score);
    if (next.lives !== shown.lives) renderLives(next.lives, game.difficulty.lives);
    if (next.destination !== shown.destination) {
      hudDestination.textContent = destination;
      const current = islandAt(game.leg).id;
      for (const [id, dot] of hudMap.dots) {
        dot.classList.toggle('is-target', id === nextIsland(game).id);
        dot.classList.toggle('is-current', id === current);
      }
    }
    if (next.miles !== shown.miles) hudMiles.textContent = `${next.miles} mn`;
    shown = next;

    const from = hudMap.points[ISLANDS.indexOf(islandAt(game.leg))];
    const to = hudMap.points[ISLANDS.indexOf(nextIsland(game))];
    const k = legProgress(game);
    hudMap.boat.setAttribute('cx', (from.x + (to.x - from.x) * k).toFixed(1));
    hudMap.boat.setAttribute('cy', (from.y + (to.y - from.y) * k).toFixed(1));
  }

  function showBanner(title, detail) {
    banner.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('span');
    small.textContent = detail;
    banner.append(strong, small);
    banner.classList.remove('is-visible');
    void banner.offsetWidth; // reinicia la animación
    banner.classList.add('is-visible');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 2200);
  }

  return {
    setRecords,
    setDifficulty,
    updateHud,
    showBanner,
    showMenu() {
      hud.hidden = true;
      banner.classList.remove('is-visible');
      showScreen('menu');
    },
    showPlaying() {
      shown = {};
      hud.hidden = false;
      showScreen(null);
    },
    showPause() {
      showScreen('pause');
    },
    showGameOver(game, result) {
      $('over-kicker').textContent = `Naufragio rumbo a ${nextIsland(game).name}`;
      $('over-score').textContent = formatNumber(game.score);
      $('over-record').textContent = `Récord en ${game.difficulty.name.toLowerCase()}: ${formatNumber(result.record)}`;
      $('over-new').hidden = !result.isNew;
      $('over-fish').textContent = formatNumber(game.fishCaught);
      $('over-islands').textContent = formatNumber(game.islandsReached);
      $('over-miles').textContent = numberFormat.format(Math.round(milesSailed(game) * 10) / 10);
      showScreen('over');
    },
  };
}
