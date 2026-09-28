// Controles: tocar o arrastrar el dedo (o el ratón) marca hacia dónde navega el barco.
// En ordenador también sirven las flechas o A/D, y Espacio, P o Escape para pausar.

export function bindInput(surface, { toWorldX, onTarget, onSteer, onPause }) {
  let activePointer = null;

  surface.addEventListener('pointerdown', (event) => {
    activePointer = event.pointerId;
    surface.setPointerCapture?.(event.pointerId);
    onTarget(toWorldX(event.clientX));
    event.preventDefault();
  });

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return;
    onTarget(toWorldX(event.clientX));
  });

  const release = (event) => {
    if (event.pointerId === activePointer) activePointer = null;
  };
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);

  // Evita el menú contextual de pulsación larga en móviles.
  surface.addEventListener('contextmenu', (event) => event.preventDefault());

  const held = new Set();
  const LEFT = new Set(['ArrowLeft', 'KeyA']);
  const RIGHT = new Set(['ArrowRight', 'KeyD']);
  const steerFromKeys = () => {
    const left = [...held].some((code) => LEFT.has(code));
    const right = [...held].some((code) => RIGHT.has(code));
    onSteer((right ? 1 : 0) - (left ? 1 : 0));
  };

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      steerFromKeys();
      event.preventDefault();
    } else if (['Space', 'KeyP', 'Escape'].includes(event.code) && !event.repeat) {
      if (onPause()) event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (held.delete(event.code)) steerFromKeys();
  });

  window.addEventListener('blur', () => {
    held.clear();
    onSteer(0);
  });
}
