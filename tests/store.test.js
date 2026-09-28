import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORIES,
  MAX_QUANTITY,
  addItem,
  adjustQuantity,
  countItems,
  createItem,
  filterItems,
  groupByCategory,
  isLow,
  missing,
  normalizeText,
  parseBackup,
  removeItem,
  restoreItem,
  serializeBackup,
  toCount,
  updateItem,
  validateDraft,
} from '../js/store.js';

let seq = 0;
const make = (name, category, quantity = 0, min = 0) => createItem({ name, category, quantity, min }, { id: `id-${++seq}`, now: 1 });

const sample = () => [
  make('Tubo multicapa 16', 'tuberia', 12, 5),
  make('Codo cobre 15', 'tuberia', 2, 4),
  make('Cable 2,5 mm', 'electrico', 30, 10),
  make('Regulador butano', 'gas', 1, 2),
  make('Tacos del 8', 'tornilleria', 150, 50),
  make('Llave grifa', 'herramientas', 1, 0),
];

describe('categorías', () => {
  it('son las cinco pedidas, en este orden', () => {
    assert.deepEqual(
      CATEGORIES.map((c) => c.name),
      ['Tubería', 'Eléctrico', 'Gas', 'Tornillería', 'Herramientas'],
    );
  });
});

describe('añadir material', () => {
  it('crea un material con nombre, cantidad, categoría y mínimo', () => {
    const item = createItem({ name: '  Tubo   cobre 18 ', category: 'tuberia', quantity: '7', min: '3' }, { id: 'a', now: 5 });
    assert.deepEqual(item, { id: 'a', name: 'Tubo cobre 18', category: 'tuberia', quantity: 7, min: 3, updatedAt: 5 });
  });

  it('exige nombre', () => {
    const { ok, errors } = validateDraft({ name: '   ', category: 'gas', quantity: 1, min: 0 });
    assert.equal(ok, false);
    assert.match(errors.name, /nombre/);
  });

  it('exige una categoría válida', () => {
    const { ok, errors } = validateDraft({ name: 'Algo', category: 'fontaneria', quantity: 1, min: 0 });
    assert.equal(ok, false);
    assert.match(errors.category, /categoría/);
    assert.throws(() => createItem({ name: 'Algo', category: 'x' }), /categoría/);
  });

  it('avisa si ya existe el mismo material en la misma categoría', () => {
    const items = sample();
    const { ok, errors } = validateDraft({ name: 'tubo MULTICAPA 16', category: 'tuberia', quantity: 1, min: 0 }, items);
    assert.equal(ok, false);
    assert.match(errors.name, /Ya tienes «Tubo multicapa 16» en Tubería/);
  });

  it('el mismo nombre en otra categoría sí se permite', () => {
    const items = sample();
    assert.equal(validateDraft({ name: 'Llave grifa', category: 'gas', quantity: 1, min: 0 }, items).ok, true);
  });

  it('al editar, el propio material no cuenta como repetido', () => {
    const items = sample();
    const tubo = items[0];
    assert.equal(validateDraft({ ...tubo, quantity: 3 }, items, tubo.id).ok, true);
  });

  it('las cantidades raras se convierten en enteros válidos', () => {
    assert.equal(toCount('12'), 12);
    assert.equal(toCount(3.9), 3);
    assert.equal(toCount(-4), 0);
    assert.equal(toCount('abc'), 0);
    assert.equal(toCount(''), 0);
    assert.equal(toCount(10 ** 9), MAX_QUANTITY);
  });

  it('addItem no modifica la lista original', () => {
    const items = sample();
    const next = addItem(items, make('Nuevo', 'gas'));
    assert.equal(items.length, 6);
    assert.equal(next.length, 7);
  });
});

describe('sumar y restar', () => {
  it('+ suma uno y − resta uno', () => {
    let items = sample();
    const id = items[0].id;
    items = adjustQuantity(items, id, 1);
    assert.equal(items[0].quantity, 13);
    items = adjustQuantity(items, id, -1);
    items = adjustQuantity(items, id, -1);
    assert.equal(items[0].quantity, 11);
  });

  it('no baja de cero', () => {
    let items = [make('Junta', 'gas', 1)];
    items = adjustQuantity(items, items[0].id, -1);
    items = adjustQuantity(items, items[0].id, -1);
    assert.equal(items[0].quantity, 0);
  });

  it('no pasa del máximo', () => {
    let items = [make('Tornillo', 'tornilleria', MAX_QUANTITY)];
    items = adjustQuantity(items, items[0].id, 1);
    assert.equal(items[0].quantity, MAX_QUANTITY);
  });

  it('solo cambia el material indicado', () => {
    const items = sample();
    const next = adjustQuantity(items, items[2].id, 5);
    assert.equal(next[2].quantity, 35);
    assert.deepEqual(next.filter((_, i) => i !== 2), items.filter((_, i) => i !== 2));
  });

  it('editar cambia los campos y conserva el id', () => {
    const items = sample();
    const next = updateItem(items, items[0].id, { name: 'Tubo multicapa 20', min: 8 }, 99);
    assert.equal(next[0].id, items[0].id);
    assert.equal(next[0].name, 'Tubo multicapa 20');
    assert.equal(next[0].min, 8);
    assert.equal(next[0].updatedAt, 99);
  });
});

describe('aviso en rojo por debajo del mínimo', () => {
  it('se pone en rojo cuando la cantidad baja del mínimo', () => {
    assert.equal(isLow(make('A', 'gas', 4, 5)), true);
    assert.equal(missing(make('A', 'gas', 4, 5)), 1);
  });

  it('justo en el mínimo todavía no avisa', () => {
    assert.equal(isLow(make('A', 'gas', 5, 5)), false);
    assert.equal(missing(make('A', 'gas', 5, 5)), 0);
  });

  it('con mínimo 0 nunca avisa, ni siquiera sin existencias', () => {
    assert.equal(isLow(make('A', 'gas', 0, 0)), false);
  });

  it('restar hasta bajar del mínimo activa el aviso y sumar lo quita', () => {
    let items = [make('Codo', 'tuberia', 3, 3)];
    const id = items[0].id;
    assert.equal(isLow(items[0]), false);
    items = adjustQuantity(items, id, -1);
    assert.equal(isLow(items[0]), true);
    items = adjustQuantity(items, id, 1);
    assert.equal(isLow(items[0]), false);
  });

  it('cuenta cuántos materiales están bajo mínimo', () => {
    const counts = countItems(sample());
    assert.equal(counts.total, 6);
    assert.equal(counts.low, 2); // Codo cobre 15 y Regulador butano
    assert.equal(counts.byCategory.tuberia, 2);
    assert.equal(counts.byCategory.herramientas, 1);
  });
});

describe('buscador y filtros', () => {
  const names = (list) => list.map((i) => i.name).sort();

  it('busca sin distinguir mayúsculas ni tildes', () => {
    assert.deepEqual(names(filterItems(sample(), { query: 'TUBO' })), ['Tubo multicapa 16']);
    assert.deepEqual(names(filterItems(sample(), { query: 'electrico' })), ['Cable 2,5 mm']);
  });

  it('todas las palabras tienen que aparecer', () => {
    assert.deepEqual(names(filterItems(sample(), { query: 'cobre 15' })), ['Codo cobre 15']);
    assert.deepEqual(filterItems(sample(), { query: 'cobre 22' }), []);
  });

  it('también encuentra por el nombre de la categoría', () => {
    assert.deepEqual(names(filterItems(sample(), { query: 'tubería' })), ['Codo cobre 15', 'Tubo multicapa 16']);
  });

  it('una búsqueda vacía lo muestra todo', () => {
    assert.equal(filterItems(sample(), { query: '   ' }).length, 6);
  });

  it('el filtro «Faltan» muestra solo lo que está bajo mínimo', () => {
    assert.deepEqual(names(filterItems(sample(), { filter: 'low' })), ['Codo cobre 15', 'Regulador butano']);
  });

  it('filtra por categoría y se combina con la búsqueda', () => {
    assert.deepEqual(names(filterItems(sample(), { filter: 'tuberia' })), ['Codo cobre 15', 'Tubo multicapa 16']);
    assert.deepEqual(names(filterItems(sample(), { filter: 'tuberia', query: 'codo' })), ['Codo cobre 15']);
  });

  it('normaliza el texto', () => {
    assert.equal(normalizeText('  Tornillería   ÁNCLAJE '), 'tornilleria anclaje');
  });
});

describe('agrupación', () => {
  it('agrupa por categoría en orden fijo y omite las vacías', () => {
    const groups = groupByCategory(sample().filter((i) => i.category !== 'gas'));
    assert.deepEqual(
      groups.map((g) => g.category.id),
      ['tuberia', 'electrico', 'tornilleria', 'herramientas'],
    );
  });

  it('ordena por nombre respetando los números', () => {
    const items = [make('Tubo 110', 'tuberia'), make('tubo 16', 'tuberia'), make('Codo', 'tuberia'), make('Tubo 20', 'tuberia')];
    assert.deepEqual(
      groupByCategory(items)[0].items.map((i) => i.name),
      ['Codo', 'tubo 16', 'Tubo 20', 'Tubo 110'],
    );
  });
});

describe('borrar y deshacer', () => {
  it('borra un material y lo puede recuperar en su sitio', () => {
    const items = sample();
    const { items: after, removed, index } = removeItem(items, items[2].id);
    assert.equal(after.length, 5);
    assert.equal(removed.name, 'Cable 2,5 mm');
    const restored = restoreItem(after, removed, index);
    assert.deepEqual(restored, items);
  });

  it('borrar un id que no existe no cambia nada', () => {
    const items = sample();
    const result = removeItem(items, 'nope');
    assert.equal(result.removed, null);
    assert.equal(result.items, items);
  });

  it('no duplica al deshacer dos veces', () => {
    const items = sample();
    const { items: after, removed, index } = removeItem(items, items[0].id);
    const once = restoreItem(after, removed, index);
    assert.equal(restoreItem(once, removed, index).length, 6);
  });
});

describe('copia de seguridad', () => {
  it('exportar e importar devuelve el mismo inventario', () => {
    const items = sample();
    assert.deepEqual(parseBackup(serializeBackup(items)), items);
  });

  it('rechaza archivos que no son una copia', () => {
    assert.throws(() => parseBackup('hola'), /no es una copia/);
    assert.throws(() => parseBackup('{"items": []}'), /no es una copia/);
  });

  it('descarta materiales dañados de la copia', () => {
    const text = JSON.stringify({
      app: 'mi-furgo',
      version: 1,
      items: [
        { id: 'ok', name: 'Bien', category: 'gas', quantity: 3, min: 1 },
        { id: 'sin-nombre', name: '', category: 'gas', quantity: 3 },
        { id: 'mala-cat', name: 'X', category: 'comida', quantity: 3 },
        { id: 'ok', name: 'Repetido', category: 'gas', quantity: 1 },
        null,
      ],
    });
    const items = parseBackup(text);
    assert.deepEqual(
      items.map((i) => i.id),
      ['ok'],
    );
  });
});
