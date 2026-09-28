# Mi Furgo

Control del material de la furgoneta, pensado para iPhone.

- Añade material con **nombre, cantidad, categoría** (tubería, eléctrico, gas, tornillería,
  herramientas) y un **mínimo**.
- Botones grandes de **+ y −**. Mantén pulsado para sumar o restar rápido.
- Cuando la cantidad **baja del mínimo**, el material se pone **en rojo** y te dice cuántos faltan.
  El filtro «Faltan» te enseña solo esos (útil para ir a comprar).
- **Buscador** arriba: no importan las tildes ni las mayúsculas.
- Toca el nombre de un material para **editarlo o borrarlo** (al borrar puedes deshacer).
- Los datos se guardan **en el propio móvil** y funciona **sin cobertura**.
- Modo oscuro automático.
- Adaptada al **iPhone 15 Pro Max**: pantalla de arranque a su medida (también sirve para
  14 Pro Max, 15 Plus y 16 Plus) y botones de + y − más grandes en los iPhone grandes.

## Publicarla con GitHub Pages

1. **Haz público el repositorio.** GitHub Pages gratis solo funciona con repos públicos
   (tus datos no están en el repo, se quedan en el móvil). En GitHub: **Settings → General →**
   abajo del todo, **Change visibility → Public**. Si tienes GitHub Pro puedes dejarlo privado.
2. **Lleva los cambios a `main`**: fusiona la pull request de la rama `claude/github-repository-access-hd73w8`.
   (Si prefieres no fusionar, en el paso 4 elige esa rama en lugar de `main`.)
3. En el repositorio, ve a **Settings → Pages**.
4. En *Build and deployment*: **Source: Deploy from a branch**, **Branch: `main`**, carpeta **`/ (root)`**. Pulsa **Save**.
5. Espera 1 o 2 minutos y recarga. Arriba aparecerá la dirección:
   **https://giorginhox.github.io/prueba-claudeApp/**

## Añadirla a la pantalla de inicio del iPhone

1. Abre la dirección en **Safari** (tiene que ser Safari).
2. Toca el botón **Compartir** (el cuadrado con una flecha hacia arriba).
   En las versiones más nuevas de iOS puede estar dentro del botón **«···»**.
3. Baja y toca **«Añadir a pantalla de inicio»**.
4. Si aparece la opción **«Abrir como app web»**, déjala activada. Toca **Añadir**.
5. Abre **Mi Furgo** desde el icono de la furgoneta: se abre a pantalla completa, sin la barra de Safari.

## Tus datos

- Se guardan solo en tu iPhone. No se suben a ningún sitio.
- La app del icono y Safari guardan los datos por separado: **usa siempre el icono**.
- **Si borras el icono, se borran los datos.** Para no perderlos, al final de la lista tienes
  **Copia de seguridad → Exportar** (guárdala en Archivos o mándatela). Con **Importar** la recuperas,
  también en un iPhone nuevo.
- Cuando cambies algo de la app y lo publiques, el móvil recibe la versión nueva la próxima vez
  que la abras con conexión. Lo único que iOS guarda al instalarla es el icono y la pantalla de
  arranque: para que cambien, quita el icono y vuelve a añadirlo (exporta antes una copia).

## Para desarrolladores

```sh
npm test     # pruebas automáticas (Node 18 o superior, sin dependencias)
npm start    # sirve la carpeta en local para probarla en el navegador
```

Las pruebas cubren la lógica (añadir, sumar/restar, aviso de mínimo, buscador, filtros, borrar y
deshacer, copias), el guardado en el móvil y la configuración para iPhone y GitHub Pages
(iconos y sus tamaños, pantalla completa, zonas seguras, modo oscuro, rutas relativas y
archivos disponibles sin conexión).

```
index.html             página de la app
manifest.webmanifest   nombre, icono y pantalla completa al instalarla
sw.js                  service worker: funciona sin cobertura
css/app.css            estilos (modo claro y oscuro)
js/app.js              interfaz
js/store.js            lógica del inventario (sin DOM)
js/storage.js          guardado en el móvil
icons/                 icono: furgoneta blanca sobre azul (icon.svg y sus PNG)
tests/                 pruebas automáticas
.nojekyll              evita que GitHub Pages procese la web con Jekyll
```
