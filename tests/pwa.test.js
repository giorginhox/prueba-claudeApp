// Comprueba que la app está bien configurada para instalarse en iPhone y
// para funcionar publicada en GitHub Pages (que la sirve desde una subcarpeta).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const html = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));

/** Ancho y alto de un PNG, leídos de su cabecera. */
function pngSize(file) {
  const data = readFileSync(join(root, file));
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG', `${file} no es un PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function hasColorType(file, types) {
  // Byte 25 de la cabecera: 2 = RGB sin transparencia, 6 = RGBA.
  return types.includes(readFileSync(join(root, file))[25]);
}

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const tags = (pattern) => html.match(new RegExp(pattern, 'g')) ?? [];

describe('iPhone', () => {
  it('se abre a pantalla completa desde la pantalla de inicio', () => {
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.equal(manifest.display, 'standalone');
  });

  it('usa la barra de la hora opaca para que no quede hueco abajo en iOS 26', () => {
    // Con «black-translucent», iOS 26 dibuja la app más corta que la pantalla (WebKit 301108).
    assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black">/);
  });

  it('respeta la zona de la cámara y la barra de abajo', () => {
    assert.match(html, /name="viewport" content="[^"]*viewport-fit=cover/);
    const css = read('css/app.css');
    assert.match(css, /env\(safe-area-inset-top/);
    assert.match(css, /env\(safe-area-inset-bottom/);
  });

  it('tiene modo oscuro automático', () => {
    assert.match(read('css/app.css'), /@media \(prefers-color-scheme: dark\)/);
    assert.match(html, /<meta name="color-scheme" content="light dark">/);
  });

  it('el icono para iPhone es un PNG de 180 × 180 sin transparencia', () => {
    const [link] = tags('<link rel="apple-touch-icon"[^>]*>');
    assert.ok(link, 'falta el apple-touch-icon');
    const href = attr(link, 'href');
    assert.deepEqual(pngSize(href), { width: 180, height: 180 });
    assert.ok(hasColorType(href, [2]), 'iOS pinta de negro las zonas transparentes');
  });

  it('tiene pantalla de arranque a la medida del iPhone 15 Pro Max', () => {
    const [link] = tags('<link rel="apple-touch-startup-image"[^>]*>');
    assert.ok(link, 'falta la pantalla de arranque');
    assert.match(attr(link, 'media'), /device-width: 430px\) and \(device-height: 932px\) and \(-webkit-device-pixel-ratio: 3\)/);
    // 430 × 932 puntos a 3 píxeles por punto.
    assert.deepEqual(pngSize(attr(link, 'href')), { width: 1290, height: 2796 });
  });

  it('tiene nombre corto bajo el icono', () => {
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="Mi Furgo">/);
    assert.equal(manifest.short_name, 'Mi Furgo');
  });

  it('los campos no hacen zoom al tocarlos (letra de 16 px o más)', () => {
    const css = read('css/app.css');
    for (const [, size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size) >= 16, `font-size ${size}px`);
  });
});

describe('manifiesto', () => {
  it('se llama Mi Furgo y está en español', () => {
    assert.equal(manifest.name, 'Mi Furgo');
    assert.equal(manifest.lang, 'es');
  });

  it('usa rutas relativas para funcionar dentro de la carpeta de GitHub Pages', () => {
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
  });

  it('los iconos existen y miden lo que dicen', () => {
    assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
    assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      assert.deepEqual(pngSize(icon.src), { width: w, height: h }, icon.src);
    }
  });
});

describe('archivos y rutas', () => {
  it('index.html está en la raíz del repositorio', () => {
    assert.ok(existsSync(join(root, 'index.html')));
  });

  it('ninguna ruta empieza por «/» (en GitHub Pages apuntaría fuera de la app)', () => {
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('http'));
    assert.ok(refs.length > 5);
    for (const ref of refs) {
      assert.ok(!ref.startsWith('/'), ref);
      assert.ok(existsSync(join(root, ref)), `no existe ${ref}`);
    }
  });

  it('el service worker guarda todos los archivos de la app para usarla sin cobertura', () => {
    const sw = read('sw.js');
    const list = JSON.parse(sw.match(/const APP_FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
    for (const file of list) assert.ok(existsSync(join(root, file === './' ? 'index.html' : file)), `no existe ${file}`);
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => `./${m[1]}`).filter((r) => !r.includes('http'));
    for (const ref of refs) assert.ok(list.includes(ref), `el service worker no guarda ${ref}`);
    for (const module of ['./js/store.js', './js/storage.js']) assert.ok(list.includes(module));
  });

  it('GitHub Pages no procesa la web con Jekyll', () => {
    assert.ok(existsSync(join(root, '.nojekyll')));
  });
});
