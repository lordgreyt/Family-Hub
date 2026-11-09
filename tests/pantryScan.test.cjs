'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeScanEvent, normalizeBarcode, barcodeKey, parseDeviceTokens, applyToItem,
  crossedBelowMinimum, buildAutoRestockItem, processScan, ScanRequestError,
} = require('../server/pantryScan.cjs');

// Minimaler Speicher im Arbeitsspeicher mit derselben Schnittstelle wie der Firebase-Adapter.
function memoryStore({ pantry = {}, lists = {}, items = {} } = {}) {
  const state = { pantry, lists, items, log: {}, unknown: {} };
  return {
    state,
    async claimEvent(logId, placeholder, canClaim) {
      const existing = state.log[logId] ?? null;
      if (!canClaim(existing)) return { claimed: false, existing };
      state.log[logId] = placeholder;
      return { claimed: true };
    },
    async releaseEvent(logId) { delete state.log[logId]; },
    async getPantry() { return structuredClone(state.pantry); },
    async transactPantryItem(id, update) {
      const next = update(structuredClone(state.pantry[id] ?? null));
      if (next !== undefined) state.pantry[id] = next;
    },
    async touchUnknown(barcode, update) { state.unknown[barcode] = update(structuredClone(state.unknown[barcode] ?? null)); },
    async getShopping() { return { lists: structuredClone(state.lists), items: structuredClone(state.items) }; },
    async ensureDefaultList(now) {
      const list = { id: 'liste-supermarkt', name: 'Supermarkt', emoji: '🛒', createdAt: now };
      state.lists[list.id] ??= list;
      return state.lists[list.id];
    },
    async putAutoItem(item) {
      const current = state.items[item.id];
      if (current && !current.checked) return false;
      state.items[item.id] = item;
      return true;
    },
    async updateLog(logId, entry) { state.log[logId] = entry; },
    async pruneLog() {},
  };
}

const milk = (over = {}) => ({
  id: 'p-milk', name: 'Milch', emoji: '🥛', category: 'milch', unit: 'Stk', quantity: 3, minQuantity: 1,
  barcode: '4000000000017', location: 'kuehlschrank', createdAt: 1, updatedAt: 1, ...over,
});
const scan = (over = {}) => normalizeScanEvent({ event_id: 'evt-000001', barcode: '4000000000017', action: 'remove', quantity: 1, ...over });
const NOW = 1_800_000_000_000;

test('normalizeScanEvent validates the payload', () => {
  assert.deepEqual(scan({ quantity: undefined }), { eventId: 'evt-000001', barcode: '4000000000017', action: 'remove', quantity: 1 });
  for (const bad of [
    { event_id: 'x' }, { barcode: 'abc' }, { barcode: '123' }, { action: 'delete' }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 100 },
  ]) {
    assert.throws(() => scan(bad), ScanRequestError, JSON.stringify(bad));
  }
});

test('barcodes compare independent of leading zeros', () => {
  assert.equal(normalizeBarcode(' 4000000000017 '), '4000000000017');
  assert.equal(barcodeKey('0012345678905'), barcodeKey('12345678905'));
  assert.equal(normalizeBarcode('12 34'), null);
});

test('device tokens: invalid entries are ignored', () => {
  assert.deepEqual(parseDeviceTokens('{"kueche-1":"0123456789abcdef","bad id":"0123456789abcdef","kurz":"x"}'), { 'kueche-1': '0123456789abcdef' });
  assert.deepEqual(parseDeviceTokens('kaputt'), {});
  assert.deepEqual(parseDeviceTokens(undefined), {});
});

test('applyToItem: add, remove, clamp and empty stock', () => {
  assert.equal(applyToItem(milk(), scan({ action: 'add', quantity: 2 }), NOW).next.quantity, 5);
  const removed = applyToItem(milk({ quantity: 1 }), scan({ quantity: 3 }), NOW);
  assert.equal(removed.status, 'ok');
  assert.equal(removed.delta, -1);
  assert.equal(removed.next.quantity, 0);
  assert.equal(applyToItem(milk({ quantity: 0 }), scan(), NOW).status, 'not_in_stock');
  assert.equal(applyToItem(null, scan(), NOW).status, 'unknown_product');
});

test('crossedBelowMinimum fires only when dropping to or below the minimum', () => {
  assert.equal(crossedBelowMinimum(2, 1, { minQuantity: 1 }), true);
  assert.equal(crossedBelowMinimum(1, 0, { minQuantity: 1 }), false); // war schon niedrig
  assert.equal(crossedBelowMinimum(3, 2, { minQuantity: 1 }), false);
  assert.equal(crossedBelowMinimum(1, 0, {}), false);
  assert.equal(crossedBelowMinimum(1, 0, { minQuantity: 0 }), true);
});

test('remove below minimum puts the item on the shopping list exactly once', async () => {
  const store = memoryStore({
    pantry: { 'p-milk': milk({ quantity: 2 }) },
    lists: { 'liste-supermarkt': { id: 'liste-supermarkt', name: 'Supermarkt', emoji: '🛒', createdAt: 1 } },
  });
  const first = await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW });
  assert.equal(first.status, 'ok');
  assert.equal(first.quantity_after, 1);
  assert.equal(first.restocked, true);
  assert.equal(store.state.pantry['p-milk'].quantity, 1);
  const item = store.state.items['auto-p-milk'];
  assert.equal(item.listId, 'liste-supermarkt');
  assert.equal(item.auto, true);
  assert.equal(item.quantity, 1); // min 1 + 1 - 1

  const second = await processScan({ store, deviceId: 'kueche-1', event: scan({ event_id: 'evt-000002' }), now: NOW + 1000 });
  assert.equal(second.status, 'ok');
  assert.equal(second.restocked, undefined);
  assert.equal(Object.keys(store.state.items).length, 1);
});

test('the same event_id is applied only once', async () => {
  const store = memoryStore({ pantry: { 'p-milk': milk() } });
  const first = await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW });
  const again = await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW + 5000 });
  assert.equal(first.status, 'ok');
  assert.equal(again.status, 'duplicate');
  assert.equal(again.original_status, 'ok');
  assert.equal(store.state.pantry['p-milk'].quantity, 2);
  assert.equal(Object.keys(store.state.log).length, 1);
});

test('events of different devices do not collide', async () => {
  const store = memoryStore({ pantry: { 'p-milk': milk() } });
  await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW });
  const other = await processScan({ store, deviceId: 'keller-1', event: scan(), now: NOW });
  assert.equal(other.status, 'ok');
  assert.equal(store.state.pantry['p-milk'].quantity, 1);
});

test('unknown barcode lands in the inbox and books nothing', async () => {
  const store = memoryStore({ pantry: { 'p-milk': milk() } });
  const res = await processScan({ store, deviceId: 'kueche-1', event: scan({ barcode: '5000000000000', action: 'add', quantity: 2 }), now: NOW });
  assert.equal(res.status, 'unknown_product');
  assert.equal(res.quantity_after, undefined);
  assert.equal(store.state.pantry['p-milk'].quantity, 3);
  const entry = store.state.unknown['5000000000000'];
  assert.equal(entry.count, 1);
  assert.equal(entry.pendingQty, 2);

  await processScan({ store, deviceId: 'kueche-1', event: scan({ event_id: 'evt-000009', barcode: '5000000000000', action: 'remove' }), now: NOW + 1 });
  assert.equal(store.state.unknown['5000000000000'].count, 2);
  assert.equal(store.state.unknown['5000000000000'].pendingQty, 2); // Entnahmen zählen nicht
});

test('removing from empty stock is rejected without changing anything', async () => {
  const store = memoryStore({ pantry: { 'p-milk': milk({ quantity: 0 }) } });
  const res = await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW });
  assert.equal(res.status, 'not_in_stock');
  assert.equal(store.state.pantry['p-milk'].quantity, 0);
  assert.equal(store.state.log['dev-kueche-1-evt-000001'].status, 'not_in_stock');
});

test('a failed booking releases the event so the retry can succeed', async () => {
  const store = memoryStore({ pantry: { 'p-milk': milk() } });
  const original = store.transactPantryItem;
  store.transactPantryItem = async () => { throw new Error('db down'); };
  await assert.rejects(processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW }), /db down/);
  store.transactPantryItem = original;
  const retry = await processScan({ store, deviceId: 'kueche-1', event: scan(), now: NOW + 1000 });
  assert.equal(retry.status, 'ok');
  assert.equal(store.state.pantry['p-milk'].quantity, 2);
});

test('auto restock respects an already open item and the chosen list', () => {
  const list = { id: 'drogerie', name: 'Drogerie' };
  assert.equal(buildAutoRestockItem(milk(), list, { a: { id: 'a', pantryId: 'p-milk', checked: false, listId: 'x' } }, NOW), null);
  const item = buildAutoRestockItem(milk({ quantity: 0, minQuantity: 2 }), list, {}, NOW);
  assert.equal(item.listId, 'drogerie');
  assert.equal(item.quantity, 3);
});

test('scan endpoint rejects bad credentials before touching the database', async () => {
  const previous = process.env.KITCHEN_SCANNER_DEVICES;
  process.env.KITCHEN_SCANNER_DEVICES = JSON.stringify({ 'kueche-1': 'correct-token-0123456789' });
  try {
    const { createHandler } = await import('../api/pantry/scan.js');
    const handler = createHandler(() => { throw new Error('store must not be created'); });
    const call = async (headers, body) => {
      let statusCode = 200; let json;
      const res = {
        setHeader() { return this; },
        status(code) { statusCode = code; return this; },
        json(value) { json = value; return this; },
        end() { return this; },
      };
      await handler({ method: 'POST', headers, body }, res);
      return { statusCode, json };
    };
    const good = { event_id: 'evt-000001', barcode: '4000000000017', action: 'add' };
    assert.equal((await call({}, good)).statusCode, 401);
    assert.equal((await call({ authorization: 'Bearer wrong-token-0123456789' }, good)).statusCode, 401);
    const auth = { authorization: 'Bearer correct-token-0123456789' };
    assert.equal((await call(auth, { ...good, device_id: 'anderes-geraet' })).statusCode, 403);
    assert.equal((await call(auth, { ...good, action: 'steal' })).statusCode, 400);
  } finally {
    if (previous === undefined) delete process.env.KITCHEN_SCANNER_DEVICES;
    else process.env.KITCHEN_SCANNER_DEVICES = previous;
  }
});
