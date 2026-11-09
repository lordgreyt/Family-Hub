import { mockDb } from '../services/mockDb';
import type { PantryItem, ShoppingItem, ShoppingList } from '../services/mockDb';
import { getCategory, guessCatalogItem, normalizeName } from '../data/foodCatalog';

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const isLowStock = (p: PantryItem): boolean =>
  p.minQuantity !== undefined && p.minQuantity !== null && p.quantity <= p.minQuantity;

// Tage bis zum MHD (negativ = abgelaufen), null ohne Datum.
export const daysUntilExpiry = (p: PantryItem): number | null => {
  if (!p.expiryDate) return null;
  const target = new Date(`${p.expiryDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

export const EXPIRY_WARN_DAYS = 7;

export const isExpiringSoon = (p: PantryItem): boolean => {
  const d = daysUntilExpiry(p);
  return d !== null && d <= EXPIRY_WARN_DAYS && p.quantity > 0;
};

export const formatQty = (n: number): string => {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
};

export const findPantryMatch = (
  pantry: PantryItem[],
  ref: { pantryId?: string; catalogId?: string; name: string; barcode?: string },
): PantryItem | undefined => {
  if (ref.pantryId) {
    const byId = pantry.find(p => p.id === ref.pantryId);
    if (byId) return byId;
  }
  if (ref.barcode) {
    const byCode = pantry.find(p => p.barcode && p.barcode === ref.barcode);
    if (byCode) return byCode;
  }
  const n = normalizeName(ref.name);
  return pantry.find(p => (ref.catalogId && p.catalogId === ref.catalogId) || normalizeName(p.name) === n);
};

export interface NewShoppingEntry {
  name: string;
  emoji?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  pantryId?: string;
  catalogId?: string;
  note?: string;
}

// Legt einen Artikel auf der Liste an; gleicher offener Artikel wird zusammengeführt.
export const addToShoppingList = (
  listId: string,
  entry: NewShoppingEntry,
  userId?: string,
): ShoppingItem => {
  const existing = mockDb.getShoppingItems().find(
    i => i.listId === listId && !i.checked && normalizeName(i.name) === normalizeName(entry.name),
  );
  const quantity = entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
  if (existing) {
    const merged: ShoppingItem = { ...existing, quantity: existing.quantity + quantity };
    mockDb.saveShoppingItem(merged);
    return merged;
  }
  const guess = guessCatalogItem(entry.name);
  const category = entry.category || guess?.category || 'sonstiges';
  const item: ShoppingItem = {
    id: newId(),
    listId,
    name: entry.name.trim(),
    emoji: entry.emoji || guess?.emoji || getCategory(category).emoji,
    category,
    quantity,
    unit: entry.unit || guess?.unit || 'Stk',
    checked: false,
    pantryId: entry.pantryId,
    catalogId: entry.catalogId || guess?.id,
    note: entry.note,
    addedBy: userId,
    createdAt: Date.now(),
  };
  mockDb.saveShoppingItem(item);
  return item;
};

// Artikel mit Bestand unter Mindestmenge, die noch nicht offen auf der Liste stehen.
export const getRestockCandidates = (listId: string): PantryItem[] => {
  const open = mockDb.getShoppingItems().filter(i => i.listId === listId && !i.checked);
  return mockDb
    .getPantry()
    .filter(isLowStock)
    .filter(p => !open.some(i => i.pantryId === p.id || normalizeName(i.name) === normalizeName(p.name)));
};

export const restockQuantity = (p: PantryItem): number =>
  Math.max(1, (p.minQuantity ?? 0) + 1 - p.quantity);

export const addPantryItemToList = (listId: string, p: PantryItem, userId?: string) =>
  addToShoppingList(
    listId,
    {
      name: p.name,
      emoji: p.emoji,
      category: p.category,
      unit: p.unit,
      quantity: restockQuantity(p),
      pantryId: p.id,
      catalogId: p.catalogId,
    },
    userId,
  );

export const ensureDefaultList = (): ShoppingList => {
  const lists = mockDb.getShoppingLists();
  if (lists.length > 0) return lists[0];
  // Feste ID: gleichzeitiges Anlegen auf zwei Geräten ergibt keine doppelte Liste.
  const list: ShoppingList = { id: 'liste-supermarkt', name: 'Supermarkt', emoji: '🛒', createdAt: Date.now() };
  mockDb.saveShoppingList(list);
  return list;
};

// --- Automatischer Nachkauf --------------------------------------------------------------
// Fällt ein Artikel auf/unter seinen Mindestbestand, kommt er von selbst auf die Einkaufsliste.
// Gleiche Regel steckt im Scanner-Endpunkt (server/pantryRules.cjs) – beide Seiten nutzen dieselbe
// feste ID („auto-<Artikel>“), damit nie ein Artikel doppelt auf der Liste landet.
export const autoRestockId = (pantryId: string): string => `auto-${pantryId}`;

// Setzt den Artikel auf die Liste, sofern er nicht schon offen irgendwo steht.
// Gibt die Liste zurück, auf die er gesetzt wurde (sonst null).
export const putOnRestockList = (p: PantryItem, userId?: string): ShoppingList | null => {
  const lists = mockDb.getShoppingLists();
  const list = lists.find(l => l.id === p.restockListId) || lists[0] || ensureDefaultList();
  const n = normalizeName(p.name);
  const alreadyOpen = mockDb
    .getShoppingItems()
    .some(i => !i.checked && (i.pantryId === p.id || (i.listId === list.id && normalizeName(i.name) === n)));
  if (alreadyOpen) return null;
  mockDb.saveShoppingItem({
    id: autoRestockId(p.id),
    listId: list.id,
    name: p.name,
    emoji: p.emoji,
    category: p.category,
    quantity: restockQuantity(p),
    unit: p.unit,
    checked: false,
    pantryId: p.id,
    catalogId: p.catalogId,
    addedBy: userId,
    auto: true,
    createdAt: Date.now(),
  });
  return list;
};

// Nur beim Unterschreiten (vorher nicht niedrig) – wer den Eintrag von der Liste löscht,
// bekommt ihn nicht sofort wieder zurück.
export const maybeAutoRestock = (p: PantryItem, wasLow: boolean, userId?: string): ShoppingList | null => {
  if (wasLow || !isLowStock(p)) return null;
  return putOnRestockList(p, userId);
};

// --- Buchungen mit Verlauf ---------------------------------------------------------------
type StockSource = 'app' | 'shopping' | 'inbox';

const logMovement = (
  p: PantryItem,
  delta: number,
  quantityAfter: number,
  source: StockSource,
  userId?: string,
  note?: string,
) => {
  if (delta === 0) return;
  mockDb.addPantryLog({
    id: newId(),
    at: Date.now(),
    pantryId: p.id,
    name: p.name,
    emoji: p.emoji,
    unit: p.unit,
    delta,
    quantityAfter,
    source,
    userId,
    barcode: p.barcode,
    note,
  });
};

export interface StockChange {
  applied: number;
  restockList: ShoppingList | null;
}

// Ändert den Bestand atomar, schreibt den Verlauf und löst bei Bedarf den Nachkauf aus.
export const changeStock = (
  pantryId: string,
  delta: number,
  ctx: { userId?: string; source?: StockSource; note?: string } = {},
): StockChange => {
  const item = mockDb.getPantry().find(p => p.id === pantryId);
  if (!item) return { applied: 0, restockList: null };
  const applied = mockDb.adjustPantryQuantity(pantryId, delta);
  if (applied === 0) return { applied: 0, restockList: null };
  const after = { ...item, quantity: item.quantity + applied };
  logMovement(after, applied, after.quantity, ctx.source || 'app', ctx.userId, ctx.note);
  const restockList = applied < 0 ? maybeAutoRestock(after, isLowStock(item), ctx.userId) : null;
  return { applied, restockList };
};

// Speichert einen Artikel aus dem Bearbeiten-Dialog (inkl. Verlauf und Nachkauf-Prüfung).
export const savePantryWithRules = (item: PantryItem, userId?: string): ShoppingList | null => {
  const prev = mockDb.getPantry().find(p => p.id === item.id);
  mockDb.savePantryItem(item);
  const delta = item.quantity - (prev?.quantity ?? 0);
  logMovement(item, delta, item.quantity, 'app', userId, prev ? 'Bearbeitet' : 'Neu angelegt');
  return maybeAutoRestock(item, prev ? isLowStock(prev) : false, userId);
};

// Haken gesetzt: bucht `quantity` in den Vorrat (legt den Artikel bei Bedarf an).
export const checkOffAndStock = (item: ShoppingItem, quantity: number, userId?: string): void => {
  const qty = Math.max(0, quantity);
  let stocked = 0;
  let pantryId = item.pantryId;
  if (qty > 0) {
    const pantry = mockDb.getPantry();
    const match = findPantryMatch(pantry, { pantryId: item.pantryId, catalogId: item.catalogId, name: item.name });
    if (match) {
      pantryId = match.id;
      stocked = changeStock(match.id, qty, { userId, source: 'shopping', note: 'Einkauf' }).applied;
    } else {
      const guess = guessCatalogItem(item.name);
      const now = Date.now();
      const created: PantryItem = {
        id: newId(),
        name: item.name,
        emoji: item.emoji,
        category: item.category,
        unit: item.unit,
        quantity: qty,
        location: guess?.location || getCategory(item.category).location,
        catalogId: item.catalogId || guess?.id,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      };
      mockDb.savePantryItem(created);
      mockDb.addPantryLog({
        id: newId(), at: now, pantryId: created.id, name: created.name, emoji: created.emoji, unit: created.unit,
        delta: qty, quantityAfter: qty, source: 'shopping', userId, note: 'Einkauf (neu im Vorrat)',
      });
      stocked = qty;
      pantryId = created.id;
    }
  }
  mockDb.saveShoppingItem({
    ...item,
    checked: true,
    checkedAt: Date.now(),
    stockedQty: stocked,
    pantryId,
  });
};

// Haken entfernt: nimmt die zuvor gebuchte Menge wieder aus dem Vorrat.
export const uncheckAndUnstock = (item: ShoppingItem, userId?: string): void => {
  if (item.stockedQty && item.stockedQty > 0 && item.pantryId) {
    changeStock(item.pantryId, -item.stockedQty, { userId, source: 'shopping', note: 'Haken entfernt' });
  }
  mockDb.saveShoppingItem({ ...item, checked: false, checkedAt: undefined, stockedQty: undefined });
};
