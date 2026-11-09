// Namens-Vorschlag zu einem Barcode über Open Food Facts (öffentliche API, ohne Schlüssel).
export interface BarcodeSuggestion {
  name: string;
  brand?: string;
}

export const lookupBarcode = async (barcode: string): Promise<BarcodeSuggestion | null> => {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_de,brands`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data.product) return null;
    const name = String(data.product.product_name_de || data.product.product_name || '').trim();
    if (!name) return null;
    const brand = String(data.product.brands || '').split(',')[0].trim();
    return { name, brand: brand || undefined };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
