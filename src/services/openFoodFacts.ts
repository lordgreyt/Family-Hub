/**
 * Open Food Facts API — Lookup products by barcode (EAN-13).
 * Returns parsed product info suitable for PantryItem creation.
 */

const API_BASE = 'https://world.openfoodfacts.org/api/v2';

export interface OffProduct {
  code: string;
  product_name: string;
  product_name_de?: string;
  generic_name?: string;
  generic_name_de?: string;
  image_url?: string;
  image_front_url?: string;
  categories_tags?: string[];
  quantity?: string;
  brands?: string;
  brands_tags?: string[];
}

export interface ProductInfo {
  barcode: string;
  name: string;
  emoji: string;
  category: string;
  imageUrl?: string;
  brand?: string;
  quantity?: string;
}

/** Map common food categories to emojis */
function categoryToEmoji(categories: string[]): string {
  const joined = categories.join(' ').toLowerCase();
  if (joined.includes('pasta') || joined.includes('nudel')) return '🍝';
  if (joined.includes('pizza')) return '🍕';
  if (joined.includes('rice') || joined.includes('reis')) return '🍚';
  if (joined.includes('bread') || joined.includes('brot') || joined.includes('toast')) return '🍞';
  if (joined.includes('milk') || joined.includes('milch')) return '🥛';
  if (joined.includes('cheese') || joined.includes('kase') || joined.includes('käse')) return '🧀';
  if (joined.includes('egg') || joined.includes('eier')) return '🥚';
  if (joined.includes('butter')) return '🧈';
  if (joined.includes('yogurt') || joined.includes('joghurt')) return '🍦';
  if (joined.includes('fruit') || joined.includes('obst') || joined.includes('apple')) return '🍎';
  if (joined.includes('vegetable') || joined.includes('gemuse') || joined.includes('gemüse')) return '🥕';
  if (joined.includes('tomato') || joined.includes('tomate')) return '🍅';
  if (joined.includes('potato') || joined.includes('kartoffel')) return '🥔';
  if (joined.includes('meat') || joined.includes('fleisch') || joined.includes('chicken')) return '🍗';
  if (joined.includes('fish') || joined.includes('fisch')) return '🐟';
  if (joined.includes('chocolate') || joined.includes('schokolade')) return '🍫';
  if (joined.includes('candy') || joined.includes('bonbon') || joined.includes('sweets')) return '🍬';
  if (joined.includes('cookie') || joined.includes('keks')) return '🍪';
  if (joined.includes('cake') || joined.includes('kuchen')) return '🎂';
  if (joined.includes('sauce') || joined.includes('sosse') || joined.includes('soße')) return '🫙';
  if (joined.includes('oil') || joined.includes('ol')) return '🫒';
  if (joined.includes('salt') || joined.includes('salz')) return '🧂';
  if (joined.includes('spice') || joined.includes('gewurz') || joined.includes('gewürz')) return '🌶️';
  if (joined.includes('coffee') || joined.includes('kaffee')) return '☕';
  if (joined.includes('tea') || joined.includes('tee')) return '🍵';
  if (joined.includes('juice') || joined.includes('saft')) return '🧃';
  if (joined.includes('water') || joined.includes('wasser')) return '💧';
  if (joined.includes('beer') || joined.includes('bier')) return '🍺';
  if (joined.includes('wine') || joined.includes('wein')) return '🍷';
  if (joined.includes('soda') || joined.includes('lemonade') || joined.includes('limonade')) return '🥤';
  if (joined.includes('cereal') || joined.includes('musli') || joined.includes('müsli')) return '🥣';
  if (joined.includes('nut') || joined.includes('nuss')) return '🥜';
  if (joined.includes('chips') || joined.includes('snack')) return '🍿';
  if (joined.includes('soup') || joined.includes('suppe')) return '🍲';
  if (joined.includes('honey') || joined.includes('honig')) return '🍯';
  if (joined.includes('jam') || joined.includes('marmelade')) return '🫐';
  if (joined.includes('flour') || joined.includes('mehl')) return '🌾';
  if (joined.includes('sugar') || joined.includes('zucker')) return '🍬';
  if (joined.includes('frozen') || joined.includes('tiefkuhl') || joined.includes('tiefkühl')) return '❄️';
  if (joined.includes('canned') || joined.includes('konserve') || joined.includes('dose')) return '🥫';
  return '📦';
}

/** Map Open Food Facts category tags to a simple category string */
function pickCategory(categories: string[]): string {
  const joined = categories.join(' ').toLowerCase();
  if (joined.includes('getranke') || joined.includes('beverage') || joined.includes('drink')) return 'Getränke';
  if (joined.includes('milch') || joined.includes('milk') || joined.includes('dairy')) return 'Milchprodukte';
  if (joined.includes('fleisch') || joined.includes('meat')) return 'Fleisch & Fisch';
  if (joined.includes('obst') || joined.includes('fruit')) return 'Obst & Gemüse';
  if (joined.includes('brot') || joined.includes('bread') || joined.includes('backwaren')) return 'Backwaren';
  if (joined.includes('pasta') || joined.includes('nudel') || joined.includes('reis') || joined.includes('rice')) return 'Nudeln & Reis';
  if (joined.includes('suß') || joined.includes('sweet') || joined.includes('snack') || joined.includes('schokolade')) return 'Süßwaren';
  if (joined.includes('gewurz') || joined.includes('gewürz') || joined.includes('spice') || joined.includes('sauce') || joined.includes('soße')) return 'Gewürze & Saucen';
  if (joined.includes('konserve') || joined.includes('canned')) return 'Konserven';
  if (joined.includes('tiefkuhl') || joined.includes('tiefkühl') || joined.includes('frozen')) return 'Tiefkühl';
  return 'Sonstiges';
}

/**
 * Look up a product by its EAN-13 barcode using the Open Food Facts API.
 * Returns null if the product was not found or the request failed.
 */
export async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  try {
    const url = `${API_BASE}/product/${encodeURIComponent(barcode)}.json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.status === 0 || !data.product) return null;

    const p = data.product as OffProduct;
    const categories: string[] = p.categories_tags || [];
    const cleanedCategories = categories
      .map(c => c.replace(/^en:/, '').replace(/^de:/, '').replace(/-/g, ' '))
      .filter(Boolean);

    const name = p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || 'Unbekanntes Produkt';
    const emoji = categoryToEmoji(categories);
    const category = pickCategory(categories);
    const imageUrl = p.image_front_url || p.image_url || undefined;

    return {
      barcode: p.code || barcode,
      name,
      emoji,
      category,
      imageUrl,
      brand: p.brands || undefined,
      quantity: p.quantity || undefined,
    };
  } catch (err) {
    console.error('Open Food Facts API error:', err);
    return null;
  }
}
