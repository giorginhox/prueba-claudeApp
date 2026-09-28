// Dibujo en canvas: mar, islas, estela, rocas, olas, peces, barco y efectos.
// Trabaja en unidades de mundo; `scale` las pasa a píxeles del canvas.

import { BOAT, COAST, WORLD_WIDTH } from './config.js';
import { boatY, screenY } from './game.js';
import { clamp } from './geometry.js';
import { coastIntrusion, coastSide, islandAt } from './route.js';

const TAU = Math.PI * 2;
const DISPLAY_FONT = '"Alfa Slab One", Rockwell, "Roboto Slab", Georgia, serif';

const COLORS = {
  seaTop: '#0F5B87',
  seaBottom: '#0A3350',
  swell: 'rgba(233, 244, 248, 0.16)',
  foam: '#F3F7F4',
  sand: '#E4CF9C',
  basalt: '#26272D',
  basaltLight: '#4B4B55',
  hull: '#F3F7F4',
  stripe: '#1C5FA8',
  trim: '#FFC62E',
  deck: '#9A6A3E',
  sail: '#FBF8EE',
  yard: '#6B4A2B',
  waveBody: '#1A6C9A',
  waveShade: 'rgba(4, 24, 40, 0.35)',
  caballaBack: '#2F6F86',
  caballaBelly: '#D7E6EA',
  vieja: '#E0603A',
  viejaFin: '#FFC62E',
  coral: '#E5533D',
  shadow: 'rgba(4, 20, 34, 0.35)',
};

// Colores de tierra de cada isla: laurisilva en las occidentales, malpaís en Lanzarote,
// jable en Fuerteventura; Tenerife lleva el Teide nevado.
const ISLAND_LOOK = {
  hierro: { land: '#56663F', relief: '#7A8A55' },
  palma: { land: '#3C7446', relief: '#5E9A5C' },
  gomera: { land: '#467A43', relief: '#6C9E5A' },
  tenerife: { land: '#6A5846', relief: '#8C7660', teide: true },
  granCanaria: { land: '#7F6746', relief: '#A28760' },
  fuerteventura: { land: '#C29B62', relief: '#DDBB82' },
  lanzarote: { land: '#553A31', relief: '#7C5446' },
};

/** Ruido determinista 0..1 para texturas que no parpadean entre fotogramas. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let scale = 1;
  let worldHeight = 700;
  let clock = 0;
  let shake = 0;
  let flash = 0;
  let effects = [];
  const rockShapes = new WeakMap();

  function resize(cssWidth, cssHeight) {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    scale = canvas.width / WORLD_WIDTH;
    worldHeight = (cssHeight / cssWidth) * WORLD_WIDTH;
    return worldHeight;
  }

  function reset() {
    effects = [];
    shake = 0;
    flash = 0;
  }

  function popup(x, y, text, color = COLORS.foam) {
    effects.push({ kind: 'popup', x, y, text, color, age: 0, life: 0.9 });
  }

  function splash(x, y, color = COLORS.foam, count = 10) {
    const n = reduceMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * TAU + Math.random() * 0.5;
      const speed = 60 + Math.random() * 90;
      effects.push({
        kind: 'drop',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        color,
        age: 0,
        life: 0.5 + Math.random() * 0.3,
      });
    }
  }

  function hit(x, y) {
    shake = reduceMotion ? 0 : 0.35;
    flash = 0.45;
    splash(x, y, COLORS.foam, 14);
  }

  function draw(state, dt) {
    clock += dt;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      const m = 7 * (shake / 0.35);
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    drawSea(state);
    drawIslands(state);
    drawWake(state);
    for (const type of ['fish', 'rock', 'wave']) {
      for (const o of state.objects) {
        if (o.type !== type) continue;
        const y = screenY(state, o.wd);
        if (y < -90 || y > state.height + 90) continue;
        if (type === 'fish') drawFish(o, y);
        else if (type === 'rock') drawRock(o, y);
        else drawWave(o, y);
      }
    }
    drawBoat(state);
    drawEffects(state, dt);
    drawFlash(state, dt);
  }

  function drawSea(state) {
    const { width: W, height: H } = state;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, COLORS.seaTop);
    gradient.addColorStop(1, COLORS.seaBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Marejadilla: trazos cortos que avanzan con el mar.
    const period = H + 60;
    ctx.strokeStyle = COLORS.swell;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 48; i++) {
      const base = hash(i * 3.1) * period + state.distance;
      const tile = Math.floor(base / period);
      const y = (base % period) - 30;
      const x = hash(i * 7.7 + tile * 13.3) * W;
      const len = 7 + hash(i + tile * 2.1) * 15;
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.quadraticCurveTo(x, y + 5, x + len, y);
      ctx.stroke();
    }
  }

  function coastPath(state, mark, sy, grow, ragged) {
    const left = coastSide(mark.stop) === 'left';
    const W = state.width;
    const L = COAST.halfLength;
    const edge = left ? -30 : W + 30;
    const steps = 32;
    ctx.beginPath();
    ctx.moveTo(edge, sy + L + grow);
    for (let i = 0; i <= steps; i++) {
      const t = -1 + (2 * i) / steps;
      const bite = ragged ? hash(mark.stop * 17.3 + i) * 7 * Math.sin(((t + 1) * Math.PI) / 2) : 0;
      const depth = Math.max(0, coastIntrusion(mark.at, mark.at + t * L) + grow - bite);
      ctx.lineTo(left ? depth : W - depth, sy - t * L);
    }
    ctx.lineTo(edge, sy - L - grow);
    ctx.closePath();
  }

  function drawIslands(state) {
    const L = COAST.halfLength;
    for (const mark of state.marks) {
      const sy = screenY(state, mark.at);
      if (sy < -L - 40 || sy > state.height + L + 40) continue;
      const island = islandAt(mark.stop);
      const look = ISLAND_LOOK[island.id];
      const left = coastSide(mark.stop) === 'left';
      const inland = (d) => (left ? d : state.width - d);

      ctx.fillStyle = 'rgba(243, 247, 244, 0.22)';
      coastPath(state, mark, sy, 12 + Math.sin(clock * 2 + mark.stop) * 2, false);
      ctx.fill();
      ctx.fillStyle = COLORS.sand;
      coastPath(state, mark, sy, 4, true);
      ctx.fill();
      ctx.fillStyle = look.land;
      coastPath(state, mark, sy, 0, true);
      ctx.fill();

      ctx.save();
      coastPath(state, mark, sy, 0, true);
      ctx.clip();
      // Relieve: manchas más claras hacia el interior.
      for (let i = 0; i < 4; i++) {
        const ry = sy + (hash(mark.stop * 5 + i) - 0.5) * L * 1.2;
        const r = 40 + hash(mark.stop * 9 + i) * 40;
        const blob = ctx.createRadialGradient(inland(10), ry, 0, inland(10), ry, r);
        blob.addColorStop(0, look.relief);
        blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = blob;
        ctx.fillRect(inland(10) - r, ry - r, r * 2, r * 2);
      }
      if (look.teide) {
        const px = inland(38);
        const py = sy - 70;
        const peak = ctx.createRadialGradient(px, py, 0, px, py, 46);
        peak.addColorStop(0, '#FFFFFF');
        peak.addColorStop(0.22, '#E9E4DC');
        peak.addColorStop(0.45, '#9A8168');
        peak.addColorStop(1, 'rgba(106, 88, 70, 0)');
        ctx.fillStyle = peak;
        ctx.beginPath();
        ctx.arc(px, py, 46, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(inland(COAST.depth * 0.36), look.teide ? sy + 70 : sy);
      ctx.rotate(left ? -Math.PI / 2 : Math.PI / 2);
      ctx.font = `17px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(8, 24, 34, 0.45)';
      ctx.fillText(island.name, 1.5, 1.5);
      ctx.fillStyle = 'rgba(243, 247, 244, 0.95)';
      ctx.fillText(island.name, 0, 0);
      ctx.restore();
    }
  }

  function drawWake(state) {
    const x = state.boat.x;
    const y = boatY(state);
    const drift = clamp(state.boat.vx * 0.12, -40, 40);
    const spread = 22 + Math.sin(clock * 3) * 3;
    ctx.lineCap = 'round';
    for (const [alpha, width, reach] of [
      [0.14, 9, 150],
      [0.4, 3, 125],
    ]) {
      ctx.strokeStyle = `rgba(243, 247, 244, ${alpha})`;
      ctx.lineWidth = width;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * 9, y + 24);
        ctx.quadraticCurveTo(x + side * 14 - drift * 0.4, y + 70, x + side * spread * 1.6 - drift, y + reach);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(243, 247, 244, 0.3)';
    for (let i = 0; i < 6; i++) {
      const k = (clock * 1.6 + i / 6) % 1;
      ctx.beginPath();
      ctx.arc(x - drift * k + Math.sin(i * 2.3) * 6, y + 34 + k * 90, 2.2 * (1 - k) + 0.6, 0, TAU);
      ctx.fill();
    }
  }

  function rockShape(o) {
    let shape = rockShapes.get(o);
    if (!shape) {
      shape = Array.from({ length: 8 }, (_, i) => 0.8 + hash(o.id * 3.7 + i) * 0.28);
      rockShapes.set(o, shape);
    }
    return shape;
  }

  function rockPath(o, y, shape, k, dx = 0, dy = 0) {
    ctx.beginPath();
    shape.forEach((f, i) => {
      const a = (i / shape.length) * TAU + o.id;
      const px = o.x + dx + Math.cos(a) * o.r * f * k;
      const py = y + dy + Math.sin(a) * o.r * f * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  function drawRock(o, y) {
    const shape = rockShape(o);
    const pulse = 1 + 0.07 * Math.sin(clock * 3 + o.id);
    ctx.fillStyle = 'rgba(243, 247, 244, 0.26)';
    ctx.beginPath();
    ctx.arc(o.x, y, o.r * 1.38 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.shadow;
    rockPath(o, y, shape, 1.02, 3, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.basalt;
    rockPath(o, y, shape, 1);
    ctx.fill();
    ctx.fillStyle = COLORS.basaltLight;
    rockPath(o, y, shape, 0.55, -o.r * 0.18, -o.r * 0.2);
    ctx.fill();
  }

  function drawWave(o, y) {
    const { w, h } = o;
    ctx.save();
    ctx.translate(o.x, y);
    ctx.fillStyle = COLORS.waveShade;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.waveBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
    // Cresta de espuma y rociones hacia donde avanza la ola.
    ctx.fillStyle = COLORS.foam;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const px = -w / 2 + 10 + (i * (w - 20)) / (n - 1);
      const lift = Math.sin(clock * 7 + i * 1.3 + o.id) * 2;
      const r = 6.5 - Math.abs(i - (n - 1) / 2) * 0.7;
      ctx.beginPath();
      ctx.arc(px, -h * 0.18 + lift, r, 0, TAU);
      ctx.fill();
    }
    const dir = Math.sign(o.vx) || 1;
    ctx.fillStyle = 'rgba(243, 247, 244, 0.55)';
    for (let i = 0; i < 3; i++) {
      const k = (clock * 2 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(dir * (w / 2 + 4 + k * 12), -4 + i * 4, 2.4 * (1 - k) + 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFish(o, y) {
    const vieja = o.kind === 'vieja';
    const facing = o.id % 2 === 0 ? 1 : -1;
    const bob = Math.sin(clock * 4 + o.id) * 2;
    const wiggle = Math.sin(clock * 12 + o.id) * 0.35;
    const r = o.r;
    ctx.save();
    ctx.translate(o.x, y + bob);

    // Brillo que avisa de que se puede pescar.
    ctx.strokeStyle = `rgba(255, 198, 46, ${0.35 + 0.25 * Math.sin(clock * 5 + o.id)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 7, 0, TAU);
    ctx.stroke();

    ctx.scale(facing, 1);
    ctx.fillStyle = vieja ? COLORS.viejaFin : COLORS.caballaBack;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.55, -r * 0.6 + wiggle * r);
    ctx.lineTo(-r * 1.55, r * 0.6 + wiggle * r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = vieja ? COLORS.vieja : COLORS.caballaBelly;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.55, 0, 0, TAU);
    ctx.fill();
    if (vieja) {
      ctx.fillStyle = 'rgba(255, 198, 46, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, r * 0.2, r * 0.6, r * 0.2, 0, 0, TAU);
      ctx.fill();
    } else {
      // Lomo azul con las rayas de la caballa.
      ctx.fillStyle = COLORS.caballaBack;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.18, r * 0.95, r * 0.34, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = '#173F52';
      ctx.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.28, -r * 0.5);
        ctx.lineTo(i * r * 0.28 + r * 0.12, -r * 0.2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#0B2236';
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.1, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function hullPath() {
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.bezierCurveTo(14, -22, 19, -4, 18, 12);
    ctx.quadraticCurveTo(17, 30, 0, 31);
    ctx.quadraticCurveTo(-17, 30, -18, 12);
    ctx.bezierCurveTo(-19, -4, -14, -22, 0, -32);
    ctx.closePath();
  }

  function drawBoat(state) {
    const { boat } = state;
    const tilt = clamp(boat.vx / state.difficulty.boatSpeed, -1, 1) * 0.2;
    const blinking = boat.invulnerable > 0 && Math.floor(clock * 12) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blinking ? 0.35 : 1;
    ctx.translate(boat.x, boatY(state));
    ctx.rotate(tilt);

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(3, 6, BOAT.width / 2 - 2, BOAT.height / 2 - 1, 0, 0, TAU);
    ctx.fill();

    // Casco blanco con franja azul, como los barquillos pintados de los puertos canarios.
    hullPath();
    ctx.fillStyle = COLORS.hull;
    ctx.fill();
    ctx.strokeStyle = COLORS.stripe;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(0, 2);
    ctx.scale(0.74, 0.8);
    hullPath();
    ctx.restore();
    ctx.fillStyle = COLORS.deck;
    ctx.fill();
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vela latina: una entena en diagonal y el paño hinchado por el alisio.
    ctx.fillStyle = COLORS.sail;
    ctx.strokeStyle = 'rgba(11, 34, 54, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-13, 20);
    ctx.lineTo(11, -27);
    ctx.quadraticCurveTo(17, 2, -13, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = COLORS.yard;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-14, 22);
    ctx.lineTo(12, -29);
    ctx.stroke();
    ctx.fillStyle = COLORS.yard;
    ctx.beginPath();
    ctx.arc(-1, -2, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects(state, dt) {
    effects = effects.filter((e) => (e.age += dt) < e.life);
    for (const e of effects) {
      const k = e.age / e.life;
      if (e.kind === 'popup') {
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `20px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const py = e.y - 46 * k;
        ctx.fillStyle = 'rgba(8, 24, 34, 0.55)';
        ctx.fillText(e.text, e.x + 1.5, py + 1.5);
        ctx.fillStyle = e.color;
        ctx.fillText(e.text, e.x, py);
      } else {
        e.x += e.vx * dt;
        e.y += (e.vy + state.speed * 0.5) * dt;
        e.vy += 260 * dt;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 3 * (1 - k) + 0.8, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash(state, dt) {
    if (flash <= 0) return;
    flash = Math.max(0, flash - dt);
    const W = state.width;
    const H = state.height;
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    vignette.addColorStop(0, 'rgba(229, 83, 61, 0)');
    vignette.addColorStop(1, `rgba(229, 83, 61, ${flash * 1.2})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }

  return {
    resize,
    reset,
    popup,
    splash,
    hit,
    draw,
    get worldHeight() {
      return worldHeight;
    },
  };
}
