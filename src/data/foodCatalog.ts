// Vorbefüllter Katalog für Vorrat und Einkaufslisten.
// Emojis dienen als Icons; Kategorien sind nach typischer Supermarkt-Laufrichtung sortiert.

export type FoodCategoryId =
  | 'obst' | 'gemuese' | 'backwaren' | 'milch' | 'fleisch' | 'fisch' | 'tiefkuehl'
  | 'konserven' | 'nudeln' | 'fruehstueck' | 'snacks' | 'getraenke' | 'gewuerze'
  | 'drogerie' | 'haushalt' | 'baby' | 'tier' | 'sonstiges';

export type StorageLocationId = 'kuehlschrank' | 'gefrierschrank' | 'vorratsschrank' | 'haushalt';

export type FoodUnit = 'Stk' | 'Pck' | 'g' | 'kg' | 'ml' | 'l' | 'Fl' | 'Dose' | 'Glas' | 'Bund' | 'Rolle';

export const FOOD_UNITS: FoodUnit[] = ['Stk', 'Pck', 'Fl', 'Dose', 'Glas', 'Bund', 'Rolle', 'g', 'kg', 'ml', 'l'];

export interface FoodCategory {
  id: FoodCategoryId;
  label: string;
  emoji: string;
  location: StorageLocationId;
}

export interface StorageLocation {
  id: StorageLocationId;
  label: string;
  emoji: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
  category: FoodCategoryId;
  unit: FoodUnit;
  location?: StorageLocationId;
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: 'obst', label: 'Obst', emoji: '🍎', location: 'kuehlschrank' },
  { id: 'gemuese', label: 'Gemüse', emoji: '🥕', location: 'kuehlschrank' },
  { id: 'backwaren', label: 'Brot & Backwaren', emoji: '🥖', location: 'vorratsschrank' },
  { id: 'milch', label: 'Milch, Käse & Eier', emoji: '🥛', location: 'kuehlschrank' },
  { id: 'fleisch', label: 'Fleisch & Wurst', emoji: '🥩', location: 'kuehlschrank' },
  { id: 'fisch', label: 'Fisch', emoji: '🐟', location: 'kuehlschrank' },
  { id: 'tiefkuehl', label: 'Tiefkühl', emoji: '❄️', location: 'gefrierschrank' },
  { id: 'konserven', label: 'Konserven & Saucen', emoji: '🥫', location: 'vorratsschrank' },
  { id: 'nudeln', label: 'Nudeln, Reis & Co.', emoji: '🍝', location: 'vorratsschrank' },
  { id: 'fruehstueck', label: 'Frühstück & Backen', emoji: '🥣', location: 'vorratsschrank' },
  { id: 'snacks', label: 'Snacks & Süßes', emoji: '🍫', location: 'vorratsschrank' },
  { id: 'getraenke', label: 'Getränke', emoji: '🥤', location: 'vorratsschrank' },
  { id: 'gewuerze', label: 'Gewürze & Öle', emoji: '🧂', location: 'vorratsschrank' },
  { id: 'drogerie', label: 'Drogerie', emoji: '🧴', location: 'haushalt' },
  { id: 'haushalt', label: 'Haushalt', emoji: '🧻', location: 'haushalt' },
  { id: 'baby', label: 'Baby & Kind', emoji: '🍼', location: 'haushalt' },
  { id: 'tier', label: 'Haustier', emoji: '🐾', location: 'haushalt' },
  { id: 'sonstiges', label: 'Sonstiges', emoji: '📦', location: 'vorratsschrank' },
];

export const STORAGE_LOCATIONS: StorageLocation[] = [
  { id: 'kuehlschrank', label: 'Kühlschrank', emoji: '🧊' },
  { id: 'gefrierschrank', label: 'Gefrierschrank', emoji: '❄️' },
  { id: 'vorratsschrank', label: 'Vorratsschrank', emoji: '🗄️' },
  { id: 'haushalt', label: 'Haushalt', emoji: '🧺' },
];

export const getCategory = (id: string | undefined): FoodCategory =>
  FOOD_CATEGORIES.find(c => c.id === id) || FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1];

export const getLocation = (id: string | undefined): StorageLocation =>
  STORAGE_LOCATIONS.find(l => l.id === id) || STORAGE_LOCATIONS[2];

export const categoryOrder = (id: string | undefined): number => {
  const idx = FOOD_CATEGORIES.findIndex(c => c.id === id);
  return idx === -1 ? FOOD_CATEGORIES.length : idx;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// [Name, Emoji, Kategorie, Einheit, (optional) Lagerort]
type Row = [string, string, FoodCategoryId, FoodUnit, StorageLocationId?];

const ROWS: Row[] = [
  // Obst
  ['Äpfel', '🍎', 'obst', 'Stk'], ['Birnen', '🍐', 'obst', 'Stk'], ['Bananen', '🍌', 'obst', 'Stk', 'vorratsschrank'],
  ['Orangen', '🍊', 'obst', 'Stk'], ['Zitronen', '🍋', 'obst', 'Stk'], ['Limetten', '🍋', 'obst', 'Stk'],
  ['Trauben', '🍇', 'obst', 'Pck'], ['Erdbeeren', '🍓', 'obst', 'Pck'], ['Blaubeeren', '🫐', 'obst', 'Pck'],
  ['Himbeeren', '🍓', 'obst', 'Pck'], ['Kiwi', '🥝', 'obst', 'Stk'], ['Ananas', '🍍', 'obst', 'Stk', 'vorratsschrank'],
  ['Mango', '🥭', 'obst', 'Stk'], ['Wassermelone', '🍉', 'obst', 'Stk'], ['Pfirsiche', '🍑', 'obst', 'Stk'],
  ['Kirschen', '🍒', 'obst', 'Pck'], ['Avocado', '🥑', 'obst', 'Stk', 'vorratsschrank'], ['Mandarinen', '🍊', 'obst', 'Stk'],
  // Gemüse
  ['Tomaten', '🍅', 'gemuese', 'Stk'], ['Gurke', '🥒', 'gemuese', 'Stk'], ['Paprika', '🫑', 'gemuese', 'Stk'],
  ['Karotten', '🥕', 'gemuese', 'Pck'], ['Kartoffeln', '🥔', 'gemuese', 'kg', 'vorratsschrank'], ['Zwiebeln', '🧅', 'gemuese', 'Pck', 'vorratsschrank'],
  ['Knoblauch', '🧄', 'gemuese', 'Stk', 'vorratsschrank'], ['Brokkoli', '🥦', 'gemuese', 'Stk'], ['Blumenkohl', '🥦', 'gemuese', 'Stk'],
  ['Salat', '🥬', 'gemuese', 'Stk'], ['Spinat', '🥬', 'gemuese', 'Pck'], ['Zucchini', '🥒', 'gemuese', 'Stk'],
  ['Champignons', '🍄', 'gemuese', 'Pck'], ['Mais', '🌽', 'gemuese', 'Dose', 'vorratsschrank'], ['Süßkartoffeln', '🍠', 'gemuese', 'Stk', 'vorratsschrank'],
  ['Aubergine', '🍆', 'gemuese', 'Stk'], ['Lauch', '🥬', 'gemuese', 'Stk'], ['Kohlrabi', '🥬', 'gemuese', 'Stk'],
  ['Radieschen', '🌱', 'gemuese', 'Bund'], ['Petersilie', '🌿', 'gemuese', 'Bund'], ['Schnittlauch', '🌿', 'gemuese', 'Bund'],
  ['Basilikum', '🌿', 'gemuese', 'Stk'], ['Ingwer', '🌱', 'gemuese', 'Stk'], ['Erbsen', '🌱', 'gemuese', 'Pck'],
  // Brot & Backwaren
  ['Brot', '🍞', 'backwaren', 'Stk'], ['Toast', '🍞', 'backwaren', 'Pck'], ['Brötchen', '🥖', 'backwaren', 'Stk'],
  ['Brezeln', '🥨', 'backwaren', 'Stk'], ['Croissants', '🥐', 'backwaren', 'Stk'], ['Wraps', '🫓', 'backwaren', 'Pck'],
  ['Knäckebrot', '🍘', 'backwaren', 'Pck'], ['Fladenbrot', '🫓', 'backwaren', 'Stk'], ['Kuchen', '🍰', 'backwaren', 'Stk'],
  // Milch, Käse & Eier
  ['Milch', '🥛', 'milch', 'l'], ['Hafermilch', '🥛', 'milch', 'l', 'vorratsschrank'], ['Butter', '🧈', 'milch', 'Pck'],
  ['Eier', '🥚', 'milch', 'Pck'], ['Joghurt', '🥣', 'milch', 'Stk'], ['Naturjoghurt', '🥣', 'milch', 'Stk'],
  ['Quark', '🥣', 'milch', 'Pck'], ['Sahne', '🥛', 'milch', 'Pck'], ['Schmand', '🥣', 'milch', 'Pck'],
  ['Frischkäse', '🧀', 'milch', 'Pck'], ['Gouda', '🧀', 'milch', 'Pck'], ['Mozzarella', '🧀', 'milch', 'Pck'],
  ['Parmesan', '🧀', 'milch', 'Pck'], ['Feta', '🧀', 'milch', 'Pck'], ['Reibekäse', '🧀', 'milch', 'Pck'],
  ['Kefir', '🥛', 'milch', 'Fl'], ['Pudding', '🍮', 'milch', 'Stk'],
  // Fleisch & Wurst
  ['Hähnchenbrust', '🍗', 'fleisch', 'Pck'], ['Hackfleisch', '🥩', 'fleisch', 'Pck'], ['Schnitzel', '🥩', 'fleisch', 'Pck'],
  ['Steak', '🥩', 'fleisch', 'Pck'], ['Bratwurst', '🌭', 'fleisch', 'Pck'], ['Würstchen', '🌭', 'fleisch', 'Pck'],
  ['Schinken', '🥓', 'fleisch', 'Pck'], ['Salami', '🥓', 'fleisch', 'Pck'], ['Speck', '🥓', 'fleisch', 'Pck'],
  ['Aufschnitt', '🥓', 'fleisch', 'Pck'], ['Leberwurst', '🥫', 'fleisch', 'Glas', 'kuehlschrank'],
  // Fisch
  ['Lachs', '🍣', 'fisch', 'Pck'], ['Fischstäbchen', '🐟', 'tiefkuehl', 'Pck'], ['Thunfisch', '🐟', 'konserven', 'Dose'],
  ['Garnelen', '🦐', 'fisch', 'Pck'],
  // Tiefkühl
  ['Tiefkühlpizza', '🍕', 'tiefkuehl', 'Stk'], ['Pommes', '🍟', 'tiefkuehl', 'Pck'], ['Tiefkühlgemüse', '🥦', 'tiefkuehl', 'Pck'],
  ['Eiscreme', '🍨', 'tiefkuehl', 'Pck'], ['Tiefkühlbeeren', '🫐', 'tiefkuehl', 'Pck'], ['Spinat (TK)', '🥬', 'tiefkuehl', 'Pck'],
  ['Nuggets', '🍗', 'tiefkuehl', 'Pck'], ['Kroketten', '🥔', 'tiefkuehl', 'Pck'], ['Brötchen (TK)', '🥖', 'tiefkuehl', 'Pck'],
  // Konserven & Saucen
  ['Tomaten (Dose)', '🥫', 'konserven', 'Dose'], ['Passierte Tomaten', '🍅', 'konserven', 'Pck'], ['Tomatenmark', '🍅', 'konserven', 'Stk'],
  ['Kidneybohnen', '🫘', 'konserven', 'Dose'], ['Kichererbsen', '🫘', 'konserven', 'Dose'], ['Linsen', '🫘', 'konserven', 'Pck'],
  ['Kokosmilch', '🥥', 'konserven', 'Dose'], ['Ketchup', '🍅', 'konserven', 'Fl'], ['Senf', '🌭', 'konserven', 'Stk'],
  ['Mayonnaise', '🥚', 'konserven', 'Stk'], ['Pesto', '🌿', 'konserven', 'Glas'], ['Sojasauce', '🍶', 'konserven', 'Fl'],
  ['Gurken (Glas)', '🥒', 'konserven', 'Glas'], ['Tomatensauce', '🍅', 'konserven', 'Glas'], ['Suppe (Dose)', '🍲', 'konserven', 'Dose'],
  // Nudeln, Reis & Co.
  ['Spaghetti', '🍝', 'nudeln', 'Pck'], ['Penne', '🍝', 'nudeln', 'Pck'], ['Fusilli', '🍝', 'nudeln', 'Pck'],
  ['Reis', '🍚', 'nudeln', 'Pck'], ['Couscous', '🍚', 'nudeln', 'Pck'], ['Bulgur', '🌾', 'nudeln', 'Pck'],
  ['Kartoffelpüree', '🥔', 'nudeln', 'Pck'], ['Mehl', '🌾', 'nudeln', 'kg'], ['Haferflocken', '🥣', 'fruehstueck', 'Pck'],
  // Frühstück & Backen
  ['Müsli', '🥣', 'fruehstueck', 'Pck'], ['Cornflakes', '🥣', 'fruehstueck', 'Pck'], ['Marmelade', '🍓', 'fruehstueck', 'Glas'],
  ['Honig', '🍯', 'fruehstueck', 'Glas'], ['Nuss-Nougat-Creme', '🍫', 'fruehstueck', 'Glas'], ['Erdnussbutter', '🥜', 'fruehstueck', 'Glas'],
  ['Zucker', '🍬', 'fruehstueck', 'kg'], ['Backpulver', '🧁', 'fruehstueck', 'Pck'], ['Vanillezucker', '🧁', 'fruehstueck', 'Pck'],
  ['Hefe', '🍞', 'fruehstueck', 'Pck'], ['Puderzucker', '🧁', 'fruehstueck', 'Pck'], ['Kakao', '🍫', 'fruehstueck', 'Pck'],
  // Snacks & Süßes
  ['Schokolade', '🍫', 'snacks', 'Stk'], ['Chips', '🥔', 'snacks', 'Pck'], ['Kekse', '🍪', 'snacks', 'Pck'],
  ['Gummibärchen', '🍬', 'snacks', 'Pck'], ['Nüsse', '🥜', 'snacks', 'Pck'], ['Salzstangen', '🥨', 'snacks', 'Pck'],
  ['Müsliriegel', '🍫', 'snacks', 'Pck'], ['Popcorn', '🍿', 'snacks', 'Pck'], ['Reiswaffeln', '🍘', 'snacks', 'Pck'],
  ['Trockenfrüchte', '🍇', 'snacks', 'Pck'],
  // Getränke
  ['Wasser', '💧', 'getraenke', 'Fl'], ['Mineralwasser', '💧', 'getraenke', 'Fl'], ['Apfelsaft', '🧃', 'getraenke', 'Fl'],
  ['Orangensaft', '🧃', 'getraenke', 'Fl'], ['Cola', '🥤', 'getraenke', 'Fl'], ['Limonade', '🥤', 'getraenke', 'Fl'],
  ['Eistee', '🧋', 'getraenke', 'Fl'], ['Bier', '🍺', 'getraenke', 'Fl'], ['Wein', '🍷', 'getraenke', 'Fl'],
  ['Kaffee', '☕', 'getraenke', 'Pck'], ['Tee', '🍵', 'getraenke', 'Pck'], ['Kaffeekapseln', '☕', 'getraenke', 'Pck'],
  ['Sprudel', '🫧', 'getraenke', 'Fl'], ['Sirup', '🍹', 'getraenke', 'Fl'],
  // Gewürze & Öle
  ['Salz', '🧂', 'gewuerze', 'Pck'], ['Pfeffer', '🌶️', 'gewuerze', 'Stk'], ['Olivenöl', '🫒', 'gewuerze', 'Fl'],
  ['Rapsöl', '🛢️', 'gewuerze', 'Fl'], ['Essig', '🍶', 'gewuerze', 'Fl'], ['Paprikapulver', '🌶️', 'gewuerze', 'Stk'],
  ['Zimt', '🍂', 'gewuerze', 'Stk'], ['Oregano', '🌿', 'gewuerze', 'Stk'], ['Brühe', '🍲', 'gewuerze', 'Pck'],
  ['Currypulver', '🍛', 'gewuerze', 'Stk'], ['Muskat', '🌰', 'gewuerze', 'Stk'],
  // Drogerie
  ['Zahnpasta', '🪥', 'drogerie', 'Stk'], ['Zahnbürsten', '🪥', 'drogerie', 'Stk'], ['Shampoo', '🧴', 'drogerie', 'Fl'],
  ['Duschgel', '🧴', 'drogerie', 'Fl'], ['Seife', '🧼', 'drogerie', 'Stk'], ['Deo', '🧴', 'drogerie', 'Stk'],
  ['Feuchttücher', '🧻', 'drogerie', 'Pck'], ['Taschentücher', '🤧', 'drogerie', 'Pck'], ['Wattepads', '🧻', 'drogerie', 'Pck'],
  ['Sonnencreme', '🧴', 'drogerie', 'Fl'], ['Pflaster', '🩹', 'drogerie', 'Pck'], ['Binden', '🩸', 'drogerie', 'Pck'],
  // Haushalt
  ['Toilettenpapier', '🧻', 'haushalt', 'Pck'], ['Küchenrolle', '🧻', 'haushalt', 'Rolle'], ['Spülmittel', '🫧', 'haushalt', 'Fl'],
  ['Spülmaschinentabs', '🍽️', 'haushalt', 'Pck'], ['Waschmittel', '🧺', 'haushalt', 'Pck'], ['Weichspüler', '🧺', 'haushalt', 'Fl'],
  ['Müllbeutel', '🗑️', 'haushalt', 'Rolle'], ['Allzweckreiniger', '🧽', 'haushalt', 'Fl'], ['Schwämme', '🧽', 'haushalt', 'Pck'],
  ['Backpapier', '📄', 'haushalt', 'Rolle'], ['Alufolie', '📄', 'haushalt', 'Rolle'], ['Frischhaltefolie', '📄', 'haushalt', 'Rolle'],
  ['Batterien', '🔋', 'haushalt', 'Pck'], ['Glühbirnen', '💡', 'haushalt', 'Stk'], ['Kerzen', '🕯️', 'haushalt', 'Pck'],
  ['Gefrierbeutel', '🛍️', 'haushalt', 'Pck'], ['WC-Reiniger', '🚽', 'haushalt', 'Fl'], ['Salz (Spülmaschine)', '🧂', 'haushalt', 'Pck'],
  // Baby & Kind
  ['Windeln', '👶', 'baby', 'Pck'], ['Babybrei', '🍼', 'baby', 'Glas'], ['Babynahrung', '🍼', 'baby', 'Pck'],
  // Haustier
  ['Katzenfutter', '🐱', 'tier', 'Pck'], ['Hundefutter', '🐶', 'tier', 'Pck'], ['Katzenstreu', '🐾', 'tier', 'Pck'],
];

export const FOOD_CATALOG: CatalogItem[] = ROWS.map(([name, emoji, category, unit, location]) => ({
  id: slug(name),
  name,
  emoji,
  category,
  unit,
  location: location ?? getCategory(category).location,
}));

const normalize = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').trim();

export const normalizeName = normalize;

export const findCatalogByName = (name: string): CatalogItem | undefined => {
  const n = normalize(name);
  if (!n) return undefined;
  return FOOD_CATALOG.find(c => normalize(c.name) === n);
};

export const searchCatalog = (query: string, limit = 12): CatalogItem[] => {
  const q = normalize(query);
  if (!q) return [];
  const starts: CatalogItem[] = [];
  const contains: CatalogItem[] = [];
  for (const item of FOOD_CATALOG) {
    const n = normalize(item.name);
    if (n.startsWith(q)) starts.push(item);
    else if (n.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
};

// Emoji-Vorschlag für frei eingegebene Artikel: erst exakter Treffer, dann Teilwort, sonst Kategorie.
export const guessCatalogItem = (name: string): CatalogItem | undefined => {
  const exact = findCatalogByName(name);
  if (exact) return exact;
  const n = normalize(name);
  if (n.length < 3) return undefined;
  return FOOD_CATALOG.find(c => {
    const cn = normalize(c.name);
    return n.includes(cn) || (cn.length >= 4 && cn.includes(n));
  });
};

export interface ShoppingListPreset {
  name: string;
  emoji: string;
}

export const SHOPPING_LIST_PRESETS: ShoppingListPreset[] = [
  { name: 'Supermarkt', emoji: '🛒' },
  { name: 'Drogerie', emoji: '🧴' },
  { name: 'Bäcker', emoji: '🥖' },
  { name: 'Getränkemarkt', emoji: '🥤' },
  { name: 'Wochenmarkt', emoji: '🥕' },
  { name: 'Metzger', emoji: '🥩' },
  { name: 'Baumarkt', emoji: '🛠️' },
  { name: 'Apotheke', emoji: '💊' },
];
