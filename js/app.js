// Interfaz de Mi Furgo: lista, buscador, filtros, hoja de añadir/editar y copias de seguridad.

import {
  CATEGORIES,
  MAX_QUANTITY,
  addItem,
  adjustQuantity,
  categoryName,
  countItems,
  createItem,
  filterItems,
  groupByCategory,
  isLow,
  missing,
  parseBackup,
  removeItem,
  restoreItem,
  serializeBackup,
  toCount,
  updateItem,
  validateDraft,
} from './store.js';
import { loadItems, loadPrefs, requestPersistence, saveItems, savePrefs } from './storage.js';

const $ = (id) => document.getElementById(id);
const content = $('content');
const filtersNav = $('filters');
const lowPill = $('low-pill');
const searchInput = $('search');
const sheet = $('sheet');
const form = $('item-form');
const nameInput = $('f-name');
const quantityInput = $('f-quantity');
const minInput = $('f-min');
const deleteButton = $('delete-button');
const importInput = $('import-file');

const VAN_PATH =
  'M88 196Q88 168 116 168L292 168Q310 168 322 182L378 248L404 258Q424 266 424 288L424 336Q424 356 404 356L108 356Q88 356 88 336Z';

let items = loadItems();
const prefs = loadPrefs();
let query = '';
let filter = 'all';
let editingId = null;
let lastCategory = CATEGORIES.some((c) => c.id === prefs.lastCategory) ? prefs.lastCategory : CATEGORIES[0].id;
let warnedStorage = false;
let askedPersistence = false;

/** Crea un elemento. Los textos siempre van como texto, nunca como HTML. */
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

function vanIcon(className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '80 160 352 240');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${VAN_PATH}"/><circle cx="160" cy="356" r="34"/><circle cx="352" cy="356" r="34"/>`;
  return svg;
}

function persist() {
  const saved = saveItems(items);
  if (!saved && !warnedStorage) {
    warnedStorage = true;
    showToast('No se ha podido guardar en el móvil. Revisa que Safari no esté en navegación privada.');
  }
  if (saved && !askedPersistence) {
    askedPersistence = true;
    requestPersistence();
  }
}

/* ---------- Lista ---------- */

function metaParts(item) {
  const parts = [h('span', { text: item.min > 0 ? `Mín. ${item.min}` : 'Sin mínimo' })];
  if (isLow(item)) parts.push(h('span', { class: 'item__warn', text: `Faltan ${missing(item)}` }));
  return parts;
}

function itemRow(item) {
  return h(
    'li',
    { class: isLow(item) ? 'item is-low' : 'item', 'data-id': item.id },
    h(
      'button',
      { class: 'item__main', type: 'button', 'data-edit': item.id },
      h('span', { class: 'item__name', text: item.name }),
      h('span', { class: 'item__meta' }, metaParts(item)),
    ),
    h(
      'div',
      { class: 'stepper' },
      h(
        'button',
        {
          class: 'step',
          type: 'button',
          'data-step': '-1',
          'data-id': item.id,
          'aria-label': `Restar uno a ${item.name}`,
          disabled: item.quantity === 0,
        },
        '−',
      ),
      h('output', { class: 'qty', text: String(item.quantity) }),
      h(
        'button',
        { class: 'step', type: 'button', 'data-step': '1', 'data-id': item.id, 'aria-label': `Sumar uno a ${item.name}` },
        '+',
      ),
    ),
  );
}

function emptyState({ title, text, action, onAction }) {
  const button = action ? h('button', { class: 'button button--primary', type: 'button', text: action }) : null;
  button?.addEventListener('click', onAction);
  return h('div', { class: 'empty' }, vanIcon('empty__van'), h('h2', { class: 'empty__title', text: title }), h('p', { text }), button);
}

function backupRow() {
  const exportButton = h('button', { class: 'link-button', type: 'button', text: 'Exportar' });
  const importButton = h('button', { class: 'link-button', type: 'button', text: 'Importar' });
  exportButton.addEventListener('click', exportBackup);
  importButton.addEventListener('click', () => importInput.click());
  return h('p', { class: 'backup' }, h('span', { text: 'Copia de seguridad:' }), items.length > 0 ? exportButton : null, importButton);
}

function renderList() {
  if (items.length === 0) {
    content.replaceChildren(
      emptyState({
        title: 'Tu furgo está vacía',
        text: 'Añade el material que llevas y controla con + y − lo que vas gastando.',
        action: 'Añadir el primer material',
        onAction: () => openSheet(),
      }),
      backupRow(),
    );
    return;
  }

  const visible = filterItems(items, { query, filter });
  if (visible.length === 0) {
    let state;
    if (query.trim()) {
      state = {
        title: `Nada con «${query.trim()}»`,
        text: 'Prueba con otra palabra o añádelo ahora.',
        action: `Añadir «${query.trim()}»`,
        onAction: () => openSheet(null, { name: query.trim() }),
      };
    } else if (filter === 'low') {
      state = { title: 'Todo en orden', text: 'Ningún material está por debajo de su mínimo.' };
    } else {
      state = {
        title: `Sin material de ${categoryName(filter)}`,
        text: 'Todavía no has añadido nada en esta categoría.',
        action: `Añadir en ${categoryName(filter)}`,
        onAction: () => openSheet(null, { category: filter }),
      };
    }
    content.replaceChildren(emptyState(state), backupRow());
    return;
  }

  const groups = groupByCategory(visible).map(({ category, items: groupItems }) =>
    h(
      'section',
      { class: 'group', 'aria-label': category.name },
      h(
        'h2',
        { class: 'group__title' },
        h('span', { class: 'group__name' }, h('span', { class: `dot dot--${category.id}` }), category.name),
        h('span', { text: String(groupItems.length) }),
      ),
      h('ul', { class: 'group__list' }, groupItems.map(itemRow)),
    ),
  );
  content.replaceChildren(...groups, backupRow());
}

/* ---------- Filtros y resumen ---------- */

const chips = new Map();

function buildFilters() {
  const defs = [
    { id: 'all', label: 'Todo' },
    { id: 'low', label: 'Faltan' },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.name, dot: c.id })),
  ];
  for (const def of defs) {
    const count = h('span', { class: 'chip__count' });
    const chip = h(
      'button',
      { class: def.id === 'low' ? 'chip chip--low' : 'chip', type: 'button', 'data-filter': def.id },
      def.dot ? h('span', { class: `dot dot--${def.dot}` }) : null,
      def.label,
      count,
    );
    chips.set(def.id, { chip, count });
    filtersNav.append(chip);
  }
}

function renderFilters() {
  const counts = countItems(items);
  for (const [id, { chip, count }] of chips) {
    count.textContent = String(id === 'all' ? counts.total : id === 'low' ? counts.low : counts.byCategory[id]);
    chip.setAttribute('aria-pressed', String(filter === id));
    if (id === 'low') chip.classList.toggle('has-low', counts.low > 0);
  }
  lowPill.hidden = counts.low === 0;
  lowPill.textContent = `${counts.low} bajo mínimo`;
  lowPill.setAttribute('aria-pressed', String(filter === 'low'));
}

function render() {
  renderFilters();
  renderList();
}

function setFilter(next) {
  filter = filter === next && next !== 'all' ? 'all' : next;
  render();
  window.scrollTo({ top: 0 });
}

/* ---------- Sumar y restar, también manteniendo pulsado ---------- */

/** Llama a `action(boton)` al tocar y, si se mantiene pulsado, lo repite cada vez más rápido. */
function bindRepeat(container, selector, action) {
  let hold = null;
  // Tras una repetición, el "click" que llega al soltar no debe sumar otra vez.
  let ignoreClickUntil = 0;

  const stop = () => {
    if (!hold) return;
    clearTimeout(hold.timer);
    if (hold.repeated) ignoreClickUntil = performance.now() + 400;
    hold = null;
  };

  const repeat = (button, count) => {
    hold.repeated = true;
    if (!action(button)) return stop();
    const delay = count < 4 ? 160 : count < 12 ? 90 : 45;
    hold.timer = setTimeout(() => repeat(button, count + 1), delay);
  };

  container.addEventListener('pointerdown', (event) => {
    ignoreClickUntil = 0;
    const button = event.target.closest(selector);
    if (!button || button.disabled || event.button !== 0) return;
    stop();
    hold = { repeated: false, timer: setTimeout(() => repeat(button, 0), 420) };
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerout']) container.addEventListener(type, stop);

  container.addEventListener('click', (event) => {
    const button = event.target.closest(selector);
    if (!button) return;
    if (performance.now() < ignoreClickUntil) {
      ignoreClickUntil = 0;
      return;
    }
    action(button);
  });
}

function bump(node) {
  node.classList.remove('bump');
  void node.offsetWidth; // reinicia la animación
  node.classList.add('bump');
}

function stepItem(button) {
  const id = button.dataset.id;
  const delta = Number(button.dataset.step);
  const item = items.find((i) => i.id === id);
  if (!item) return false;
  if ((delta < 0 && item.quantity === 0) || (delta > 0 && item.quantity >= MAX_QUANTITY)) return false;
  items = adjustQuantity(items, id, delta);
  persist();
  updateRow(id);
  return true;
}

function updateRow(id) {
  const item = items.find((i) => i.id === id);
  const row = content.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  if (!item || !row) return render();
  row.classList.toggle('is-low', isLow(item));
  row.querySelector('.item__meta').replaceChildren(...metaParts(item));
  const qty = row.querySelector('.qty');
  qty.textContent = String(item.quantity);
  bump(qty);
  row.querySelector('[data-step="-1"]').disabled = item.quantity === 0;
  renderFilters();
}

/* ---------- Hoja de añadir / editar ---------- */

const categoryInputs = new Map();
for (const c of CATEGORIES) {
  const input = h('input', { type: 'radio', name: 'category', value: c.id });
  categoryInputs.set(c.id, input);
  $('f-categories').append(
    h('label', { class: 'choice' }, input, h('span', { class: 'choice__box' }, h('span', { class: `dot dot--${c.id}` }), c.name)),
  );
}

function setError(input, errorEl, message) {
  errorEl.hidden = !message;
  errorEl.textContent = message ?? '';
  if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
}

function openSheet(id = null, preset = {}) {
  const item = id ? items.find((i) => i.id === id) : null;
  editingId = item?.id ?? null;
  $('sheet-title').textContent = item ? 'Editar material' : 'Nuevo material';
  nameInput.value = item?.name ?? preset.name ?? '';
  const category = item?.category ?? preset.category ?? (categoryInputs.has(filter) ? filter : lastCategory);
  categoryInputs.get(category).checked = true;
  quantityInput.value = String(item?.quantity ?? 1);
  minInput.value = String(item?.min ?? 0);
  deleteButton.hidden = !item;
  setError(nameInput, $('f-name-error'), null);
  setError(null, $('f-category-error'), null);
  sheet.showModal();
  sheet.querySelector('.sheet__body').scrollTop = 0;
  if (!item) nameInput.focus();
}

function closeSheet() {
  if (sheet.open) sheet.close();
  editingId = null;
}

function readForm() {
  return {
    name: nameInput.value,
    category: form.elements.category.value,
    quantity: quantityInput.value,
    min: minInput.value,
  };
}

function highlight(id) {
  const row = content.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('is-new');
  setTimeout(() => row.classList.remove('is-new'), 1400);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const { ok, errors, value } = validateDraft(readForm(), items, editingId);
  setError(nameInput, $('f-name-error'), errors.name);
  setError(null, $('f-category-error'), errors.category);
  if (!ok) {
    if (errors.name) nameInput.focus();
    return;
  }

  let id = editingId;
  if (editingId) {
    items = updateItem(items, editingId, value);
  } else {
    const item = createItem(value);
    items = addItem(items, item);
    id = item.id;
  }
  lastCategory = value.category;
  savePrefs({ ...prefs, lastCategory });
  persist();
  closeSheet();

  // Si el buscador o el filtro esconden el material, se quitan para poder verlo.
  if (!filterItems([items.find((i) => i.id === id)], { query, filter }).length) {
    query = '';
    searchInput.value = '';
    filter = 'all';
  }
  render();
  highlight(id);
});

bindRepeat(form, '[data-delta]', (button) => {
  const input = $(button.dataset.target);
  const current = toCount(input.value);
  const next = toCount(current + Number(button.dataset.delta));
  input.value = String(next);
  return next !== current;
});

for (const input of [quantityInput, minInput]) {
  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => {
    input.value = String(toCount(input.value));
  });
}

sheet.querySelector('[data-close]').addEventListener('click', closeSheet);
sheet.addEventListener('click', (event) => {
  if (event.target === sheet) closeSheet(); // toque fuera de la hoja
});
sheet.addEventListener('close', () => {
  editingId = null;
});

deleteButton.addEventListener('click', () => {
  const { items: next, removed, index } = removeItem(items, editingId);
  if (!removed) return;
  items = next;
  persist();
  closeSheet();
  render();
  showToast(`Borrado: ${removed.name}`, 'Deshacer', () => {
    items = restoreItem(items, removed, index);
    persist();
    render();
    highlight(removed.id);
  });
});

/* ---------- Aviso temporal ---------- */

let toastTimer = null;
function showToast(text, actionLabel = null, onAction = null) {
  const toast = $('toast');
  const action = $('toast-action');
  $('toast-text').textContent = text;
  action.hidden = !actionLabel;
  action.textContent = actionLabel ?? '';
  action.onclick = () => {
    hideToast();
    onAction?.();
  };
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 4000);
}

function hideToast() {
  $('toast').hidden = true;
}

/* ---------- Copia de seguridad ---------- */

async function exportBackup() {
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([serializeBackup(items)], `mi-furgo-${date}.json`, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de Mi Furgo' });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (!file) return;
  try {
    const imported = parseBackup(await file.text());
    if (
      items.length > 0 &&
      !window.confirm(`Se cambiarán tus ${items.length} materiales por los ${imported.length} de la copia. ¿Seguir?`)
    ) {
      return;
    }
    items = imported;
    persist();
    query = '';
    searchInput.value = '';
    filter = 'all';
    render();
    showToast(`Copia cargada: ${imported.length} materiales`);
  } catch (error) {
    showToast(error.message);
  }
});

/* ---------- Arranque ---------- */

buildFilters();
bindRepeat(content, '[data-step]', stepItem);

content.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  if (edit) openSheet(edit.dataset.edit);
});
filtersNav.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter]');
  if (chip) setFilter(chip.dataset.filter);
});
lowPill.addEventListener('click', () => setFilter('low'));
$('add-button').addEventListener('click', () => openSheet());

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  renderList();
});
$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  searchInput.blur(); // cierra el teclado
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin modo sin conexión; la app sigue funcionando.
    });
  });
}
