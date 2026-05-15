import { Category, FoodItem, StorageLocation } from '../types';
const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2/product';

interface OFFProduct { product_name?: string; product_name_fr?: string; brands?: string; image_front_small_url?: string; quantity?: string; categories_tags?: string[]; }
interface OFFResponse { status: number; product?: OFFProduct; }

const mapCategory = (tags: string[] = []): Category => {
  const j = tags.join(' ');
  if (j.includes('fresh') || j.includes('frais') || j.includes('dairy') || j.includes('meat')) return Category.FRAIS;
  if (j.includes('dry') || j.includes('sec') || j.includes('conserve') || j.includes('pasta')) return Category.SEC;
  return Category.AUTRE;
};

export interface ProductLookupResult { found: boolean; name?: string; brand?: string; imageUrl?: string; category?: Category; quantity?: number; unit?: string; }

export const fetchProductByBarcode = async (barcode: string): Promise<ProductLookupResult> => {
  try {
    const res = await fetch(`${OFF_API_BASE}/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_fr,brands,image_front_small_url,quantity,categories_tags`);
    if (!res.ok) return { found: false };
    const data: OFFResponse = await res.json();
    if (data.status !== 1 || !data.product) return { found: false };
    const p = data.product;
    let quantity: number | undefined; let unit: string | undefined;
    if (p.quantity) { const m = p.quantity.match(/^[\d.,]+\s*([a-zA-Z]+)/); if (m) { quantity = parseFloat(p.quantity); unit = m[1].toLowerCase(); } }
    return { found: true, name: p.product_name_fr || p.product_name, brand: p.brands?.split(',')[0].trim(), imageUrl: p.image_front_small_url, category: mapCategory(p.categories_tags), quantity, unit };
  } catch { return { found: false }; }
};

export const offResultToFoodItem = (result: ProductLookupResult, barcode: string): Partial<FoodItem> => ({
  name: result.name ?? '', brand: result.brand, imageUrl: result.imageUrl,
  category: result.category ?? Category.AUTRE, location: StorageLocation.PANTRY, barcode,
  quantity: result.quantity ?? 1, unit: result.unit ?? 'unité', isFrozen: false, expiryDate: '',
  addedAt: new Date().toISOString(), userId: '',
});
