# prueba-claudeApp

## Travesía Canaria

Juego web para móvil. Un barquillo con vela latina navega de El Hierro a Lanzarote (y vuelta)
esquivando rocas volcánicas y olas, y pesca caballas y viejas para sumar puntos.

### Cómo se juega

- **Toca o arrastra** el dedo por la pantalla: el barco navega hacia donde tocas.
  En ordenador también valen las flechas o A/D.
- **Rocas y olas** te quitan un salvavidas. Tras un choque tienes 1,5 s de invulnerabilidad.
  Sin salvavidas, naufragas.
- **Peces**: caballa 10 puntos, vieja 25. **Cada isla alcanzada** suma 50 y el barco acelera un poco.
  Todos los puntos se multiplican según el nivel.
- **Pausa** con el botón del marcador, o con Espacio, P o Escape. El juego se pausa solo si cambias de app.

| Nivel   | Mar          | Salvavidas | Puntos | Velocidad | Obstáculos      |
| ------- | ------------ | ---------- | ------ | --------- | --------------- |
| Fácil   | Calma chicha | 3          | ×1     | lenta     | 1–2 rocas, pocas olas |
| Normal  | Alisio       | 3          | ×2     | media     | 1–3 rocas, más olas   |
| Difícil | Temporal     | 2          | ×3     | rápida    | 2–3 rocas, muchas olas |

El récord se guarda en el navegador (`localStorage`), uno por nivel.

Cada fila de obstáculos deja siempre un paso libre al alcance del barco, así que ninguna partida
se vuelve imposible.

### Arrancarlo

El juego usa módulos ES, así que hay que servirlo por HTTP (abrir `index.html` con doble clic no funciona):

```sh
npm start            # sirve la carpeta con `serve`
# o bien
python3 -m http.server 8000
```

Para jugar desde el móvil, abre la dirección del ordenador en la misma red Wi-Fi
(por ejemplo `http://192.168.1.20:8000`), o publica la carpeta en cualquier hosting estático.

### Pruebas

```sh
npm test
```

Usan el ejecutor de pruebas de Node (18 o superior) y no necesitan dependencias. Cubren:

- **Choques**: rocas y olas quitan salvavidas, invulnerabilidad, naufragio, pasos largos que no atraviesan rocas, costa de las islas.
- **Puntos**: valor de cada pez según el nivel, que no puntúe dos veces, bonus por isla.
- **Niveles**: los tres niveles escalan velocidad, obstáculos, salvavidas y multiplicador; aceleración por isla con tope; ruta de ida y vuelta.
- **Generación de obstáculos**: siempre queda un paso libre y alcanzable, y nada aparece sobre la costa.
- **Récord**: se guarda por nivel, solo si mejora, y funciona aunque el navegador bloquee el almacenamiento.

### Estructura

```
index.html          pantallas y marcador
css/styles.css      estilos
js/config.js        mundo, islas y niveles de dificultad
js/game.js          reglas de la partida (sin DOM, se prueba en Node)
js/spawner.js       filas de rocas, olas y peces
js/route.js         ruta entre islas y costas
js/geometry.js      choques y distancias
js/random.js        aleatorio con semilla
js/records.js       récord guardado
js/renderer.js      dibujo en canvas
js/input.js         controles táctiles y de teclado
js/ui.js            menú, marcador y mapa de la ruta
js/main.js          bucle del juego
tests/              pruebas automáticas
```
