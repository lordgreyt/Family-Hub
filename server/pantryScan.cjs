'use strict';

// Verarbeitung der Scan-Ereignisse vom Küchenscanner (ESP32).
// Alles hier ist unabhängig von Firebase: der Zugriff läuft über ein `store`-Objekt, damit die
// Regeln (Idempotenz, Statuscodes, Nachkauf) ohne Datenbank getestet werden können.

const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const PENDING_RECLAIM_MS = 60_000;
const MAX_QUANTITY = 99;
const LOG_LIMIT = 300;

class ScanRequestError extends Error {
  constructor(message, code = 'invalid_request') {
    super(message);
    this.name = 'ScanRequestError';
    this.code = code;
  }
}

// Nur Ziffern, 6–14 Stellen (EAN-8, UPC-A, EAN-13, ITF-14). Alles andere ist kein Produktcode.
function normalizeBarcode(value) {
  const text = String(value ?? '').trim();
  return /^\d{6,14}$/.test(text) ? text : null;
}

// UPC-A (12) und EAN-13 mit führender Null bezeichnen dasselbe Produkt.
function barcodeKey(value) {
  const code = normalizeBarcode(value);
  return code ? code.replace(/^0+/, '') : null;
}

function normalizeScanEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ScanRequestError('Body muss ein JSON-Objekt sein.');
  }
  const eventId = String(body.event_id ?? '');
  if (!EVENT_ID_PATTERN.test(eventId)) throw new ScanRequestError('event_id fehlt oder ist ungültig.', 'invalid_event_id');
  const barcode = normalizeBarcode(body.barcode);
  if (!barcode) throw new ScanRequestError('barcode fehlt oder ist ungültig.', 'invalid_barcode');
  if (body.action !== 'add' && body.action !== 'remove') {
    throw new ScanRequestError('action muss "add" oder "remove" sein.', 'invalid_action');
  }
  const rawQty = body.quantity === undefined ? 1 : Number(body.quantity);
  if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > MAX_QUANTITY) {
    throw new ScanRequestError(`quantity muss eine ganze Zahl von 1 bis ${MAX_QUANTITY} sein.`, 'invalid_quantity');
  }
  return { eventId, barcode, action: body.action, quantity: rawQty };
}

function parseDeviceTokens(raw) {
  if (!raw) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return {}; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const devices = {};
  for (const [id, token] of Object.entries(parsed)) {
    if (DEVICE_ID_PATTERN.test(id) && typeof token === 'string' && token.length >= 16) devices[id] = token;
  }
  return devices;
}

function findPantryByBarcode(pantry, barcode) {
  const key = barcodeKey(barcode);
  if (!key || !pantry || typeof pantry !== 'object') return null;
  for (const item of Object.values(pantry)) {
    if (item && typeof item === 'object' && typeof item.id === 'string' && barcodeKey(item.barcode) === key) return item;
  }
  return null;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Wird innerhalb der Datenbank-Transaktion auf den aktuellen Artikel angewendet.
function applyToItem(current, event, now) {
  if (!current || typeof current !== 'object') return { status: 'unknown_product' };
  const before = Number(current.quantity) || 0;
  if (event.action === 'add') {
    const after = round2(before + event.quantity);
    return { status: 'ok', next: { ...current, quantity: after, updatedAt: now }, before, after, delta: round2(after - before) };
  }
  if (before <= 0) return { status: 'not_in_stock', before, after: before, delta: 0 };
  const take = Math.min(before, event.quantity);
  const after = round2(before - take);
  return { status: 'ok', next: { ...current, quantity: after, updatedAt: now }, before, after, delta: -take };
}

// Nachkauf nur beim Unterschreiten (vorher über dem Mindestbestand).
function crossedBelowMinimum(before, after, item) {
  if (item.minQuantity === undefined || item.minQuantity === null) return false;
  const min = Number(item.minQuantity);
  return before > min && after <= min;
}

function pickRestockList(lists, item) {
  const all = Object.values(lists || {}).filter((l) => l && typeof l === 'object' && l.id && l.name);
  all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return all.find((l) => l.id === item.restockListId) || all[0] || null;
}

// Gleiche Regel wie in der App (src/utils/pantry.ts): feste ID, keine Dopplung mit offenen Einträgen.
function buildAutoRestockItem(pantryItem, list, openItems, now) {
  const name = String(pantryItem.name || '').trim().toLocaleLowerCase();
  const alreadyOpen = Object.values(openItems || {}).some((i) => i && !i.checked
    && (i.pantryId === pantryItem.id || (i.listId === list.id && String(i.name || '').trim().toLocaleLowerCase() === name)));
  if (alreadyOpen) return null;
  const min = Number(pantryItem.minQuantity) || 0;
  return clean({
    id: `auto-${pantryItem.id}`,
    listId: list.id,
    name: pantryItem.name,
    emoji: pantryItem.emoji,
    category: pantryItem.category,
    quantity: Math.max(1, round2(min + 1 - Number(pantryItem.quantity))),
    unit: pantryItem.unit,
    checked: false,
    pantryId: pantryItem.id,
    catalogId: pantryItem.catalogId,
    auto: true,
    createdAt: now,
  });
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function mergeUnknown(current, event, deviceId, now) {
  const prev = current && typeof current === 'object' ? current : null;
  return clean({
    id: event.barcode,
    barcode: event.barcode,
    count: (prev?.count || 0) + 1,
    // Nur Einlagerungen werden später bei der Zuordnung gebucht.
    pendingQty: (prev?.pendingQty || 0) + (event.action === 'add' ? event.quantity : 0),
    firstSeenAt: prev?.firstSeenAt || now,
    lastSeenAt: now,
    deviceId,
    name: prev?.name,
    brand: prev?.brand,
  });
}

function responseFromLog(entry, status, eventId) {
  return clean({
    status,
    event_id: eventId,
    original_status: status === 'duplicate' ? entry?.status : undefined,
    name: entry?.name && entry.status !== 'unknown_product' ? entry.name : undefined,
    unit: entry?.unit || undefined,
    applied: typeof entry?.delta === 'number' ? entry.delta : undefined,
    quantity_after: typeof entry?.quantityAfter === 'number' && entry.status === 'ok' ? entry.quantityAfter : undefined,
  });
}

async function processScan({ store, deviceId, event, now = Date.now() }) {
  const logId = `dev-${deviceId}-${event.eventId}`;
  const placeholder = {
    id: logId, at: now, name: event.barcode, emoji: '📦', unit: '', delta: 0, quantityAfter: 0,
    source: 'device', deviceId, barcode: event.barcode, status: 'pending', eventId: event.eventId,
  };
  const canClaim = (existing) => !existing || (existing.status === 'pending' && now - (existing.at || 0) > PENDING_RECLAIM_MS);

  const claim = await store.claimEvent(logId, placeholder, canClaim);
  if (!claim.claimed) return responseFromLog(claim.existing, 'duplicate', event.eventId);

  try {
    const pantry = await store.getPantry();
    const match = findPantryByBarcode(pantry, event.barcode);

    let status = 'unknown_product';
    let entry = { ...placeholder, status };
    let restocked = false;

    if (match) {
      let outcome = { status: 'unknown_product' };
      await store.transactPantryItem(match.id, (current) => {
        outcome = applyToItem(current, event, now);
        return outcome.next;
      });
      status = outcome.status;
      entry = {
        ...placeholder,
        pantryId: match.id,
        name: match.name,
        emoji: match.emoji || '📦',
        unit: match.unit || '',
        delta: outcome.delta || 0,
        quantityAfter: outcome.after ?? 0,
        status,
      };
      if (status === 'ok' && outcome.delta < 0 && crossedBelowMinimum(outcome.before, outcome.after, match)) {
        const { lists, items } = await store.getShopping();
        const list = pickRestockList(lists, match) || await store.ensureDefaultList(now);
        const item = buildAutoRestockItem({ ...match, quantity: outcome.after }, list, items, now);
        if (item) restocked = await store.putAutoItem(item);
      }
    }
    if (status === 'unknown_product') {
      await store.touchUnknown(event.barcode, (current) => mergeUnknown(current, event, deviceId, now));
    }

    await store.updateLog(logId, clean(entry));
    await store.pruneLog(LOG_LIMIT);
    return { ...responseFromLog(entry, status, event.eventId), restocked: restocked || undefined };
  } catch (error) {
    // Ereignis wieder freigeben, damit der Wiederholungsversuch des Geräts nicht als Duplikat endet.
    await store.releaseEvent(logId).catch(() => {});
    throw error;
  }
}

module.exports = {
  ScanRequestError,
  LOG_LIMIT,
  normalizeBarcode,
  barcodeKey,
  normalizeScanEvent,
  parseDeviceTokens,
  findPantryByBarcode,
  applyToItem,
  crossedBelowMinimum,
  pickRestockList,
  buildAutoRestockItem,
  mergeUnknown,
  processScan,
};
