import { Category, FoodItem, StorageLocation } from "../types";

/**
 * Service OpenFoodFacts
 * Récupère les métadonnées d'un produit alimentaire à partir de son code-barres.
 * Documentation API : https://world.openfoodfacts.org/
 */

const OFF_API_BASE = "https://world.openfoodfacts.org/api/v2/product";

// ─── Types internes ──────────────────────────────────────────────────────────

interface OFFProduct {
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  image_front_small_url?: string;
  image_url?: string;
  quantity?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number>;
}

interface OFFResponse {
  status: number; // 1 = trouvé, 0 = non trouvé
  product?: OFFProduct;
}

// ─── Mappage de catégorie ────────────────────────────────────────────────────

/**
 * Tente de déduire une Category alimentaire depuis les tags OpenFoodFacts.
 */
const mapCategoryFromTags = (tags: string[] = []): Category => {
  const joined = tags.join(" ");
  if (joined.includes("frozen") || joined.includes("congelé") || joined.includes("surgel")) {
    return Category.FRAIS; // Sera reclassé si mis au congélo
  }
  if (
    joined.includes("fresh") ||
    joined.includes("frais") ||
    joined.includes("dairy") ||
    joined.includes("laitier") ||
    joined.includes("meat") ||
    joined.includes("viande")
  ) {
    return Category.FRAIS;
  }
  if (
    joined.includes("dry") ||
    joined.includes("sec") ||
    joined.includes("conserve") ||
    joined.includes("pasta") ||
    joined.includes("cereal")
  ) {
    return Category.SEC;
  }
  return Category.AUTRE;
};

// ─── Fonction principale ─────────────────────────────────────────────────────

export interface ProductLookupResult {
  found: boolean;
  name?: string;
  brand?: string;
  imageUrl?: string;
  category?: Category;
  /**
   * Quantité et unité extraites du champ "quantity" d'OpenFoodFacts
   * ex: "500g" -> { quantity: 500, unit: "g" }
   */
  quantity?: number;
  unit?: string;
}

/**
 * Recherche un produit dans la base OpenFoodFacts via son code-barres.
 * En cas d'échec (réseau ou produit inconnu), retourne { found: false }.
 */
export const fetchProductByBarcode = async (
  barcode: string
): Promise<ProductLookupResult> => {
  try {
    const url = \`\${OFF_API_BASE}/\${encodeURIComponent(barcode)}.json?fields=product_name,product_name_fr,brands,image_front_small_url,image_url,quantity,categories_tags\`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(\`[OpenFoodFacts] HTTP \${response.status} pour le code-barres \${barcode}\`);
      return { found: false };
    }

    const data: OFFResponse = await response.json();

    if (data.status !== 1 || !data.product) {
      console.info(\`[OpenFoodFacts] Produit \${barcode} non trouvé dans la base.\`);
      return { found: false };
    }

    const p = data.product;
    const name = p.product_name_fr || p.product_name || undefined;
    const brand = p.brands?.split(",")[0].trim() || undefined;
    const imageUrl = p.image_front_small_url || p.image_url || undefined;
    const category = mapCategoryFromTags(p.categories_tags);

    // Extraire la quantité depuis le champ ex: "500 g", "1 L", "6 x 50 g"
    let quantity: number | undefined;
    let unit: string | undefined;
    if (p.quantity) {
      const match = p.quantity.match(/^[\\d.,]+\\s*([a-zA-ZµΩ]+)/);
      if (match) {
        quantity = parseFloat(p.quantity.replace(",", "."));
        unit = match[1].toLowerCase();
      }
    }

    return { found: true, name, brand, imageUrl, category, quantity, unit };
  } catch (error) {
    console.error("[OpenFoodFacts] Erreur réseau:", error);
    return { found: false };
  }
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Crée un FoodItem partiel pré-rempli à partir d'un résultat OpenFoodFacts.
 * Les champs manquants (expiryDate, userId, etc.) devront être complétés
 * par l'utilisateur ou par Gemini (extraction de la DLC).
 */
export const offResultToFoodItem = (
  result: ProductLookupResult,
  barcode: string
): Partial<FoodItem> => {
  const item: Partial<FoodItem> = {
    category: result.category ?? Category.AUTRE,
    location: StorageLocation.PANTRY, // Valeur par défaut
    barcode,
    quantity: result.quantity ?? 1,
    unit: result.unit ?? "unité",
    isFrozen: false,
    expiryDate: "",
    addedAt: new Date().toISOString(),
    userId: "",
  };
  
  // N'ajouter ces champs que s'ils sont réellement présents 
  // pour ne pas écraser les données trouvées par Gemini
  if (result.name && result.name.trim() !== "") item.name = result.name;
  if (result.brand && result.brand.trim() !== "") item.brand = result.brand;
  if (result.imageUrl && result.imageUrl.trim() !== "") item.imageUrl = result.imageUrl;

  return item;
};