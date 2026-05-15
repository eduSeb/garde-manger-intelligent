import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem, Recipe, RecipeFilters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
const MODEL = "gemini-3-flash-preview";

// ─── Extraction de DLC (OCR) ─────────────────────────────────────────────────

/**
 * Tâche 2.2 – Prompt optimisé, ciblé uniquement sur l'extraction de la date.
 * Ne reçoit qu'UNE image (la zone de la date) pour plus de précision et rapidité.
 */
export const analyzeExpiryDate = async (
  dlcImageBase64: string
): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            {
              text: `Tu es un OCR spécialisé dans la lecture de dates de péremption sur des emballages alimentaires.
Analyse cette image et extrais la date limite de consommation (DLC, DLUO, BBD, Best Before, Use By, à consommer avant...).
IMPORTANT : Le format imprimé sur l'emballage ressemble souvent à --/--/-- ou JJ/MM/AA.
Réponds UNIQUEMENT avec la date formatée en YYYY-MM-DD.
Si tu vois plusieurs dates, prends la plus récente.
Si tu ne vois aucune date, réponds exactement: null`,
            },
            {
              inlineData: {
                data: dlcImageBase64.split(",")[1] || dlcImageBase64,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expiryDate: {
              type: Type.STRING,
              description: "Date au format YYYY-MM-DD, ou null si non trouvée",
            },
          },
          required: ["expiryDate"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return parsed.expiryDate && parsed.expiryDate !== "null"
      ? parsed.expiryDate
      : null;
  } catch (error) {
    console.error("[Gemini] Erreur analyzeExpiryDate:", error);
    return null;
  }
};

/**
 * Analyse l'image du produit pour extraire le nom et/ou le code-barres.
 */
export const analyzeProductImage = async (
  productImageBase64: string
): Promise<{ name?: string; barcode?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            {
              text: `Analyse cette image d'un produit alimentaire. 
Extrais le nom du produit (marque + nom) de façon concise.
Si un code-barres est visible sur l'image (série de chiffres sous des barres verticales), extrais uniquement les chiffres sans espaces.`,
            },
            {
              inlineData: {
                data: productImageBase64.split(",")[1] || productImageBase64,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            barcode: { type: Type.STRING },
          },
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("[Gemini] Erreur analyzeProductImage:", error);
    return {};
  }
};

/**
 * @deprecated Utiliser analyzeExpiryDate() + fetchProductByBarcode() à la place.
 * Conservé pour compatibilité ascendante pendant la migration.
 * Analyse deux images pour extraire nom de produit ET date de péremption.
 */
export const analyzeImage = async (
  productBase64: string,
  dlcBase64: string
): Promise<Partial<FoodItem> | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            {
              text: "Analyse ces deux images d'un même produit alimentaire. La première image montre le produit (nom, marque, code-barres). La deuxième image se focalise sur la date limite de consommation (DLC / BBD). Extrais le nom précis, le code-barres (si visible) et la date au format YYYY-MM-DD. Si tu ne trouves pas la date précisément, laisse vide.",
            },
            {
              inlineData: {
                data: productBase64.split(",")[1] || productBase64,
                mimeType: "image/jpeg",
              },
            },
            {
              inlineData: {
                data: dlcBase64.split(",")[1] || dlcBase64,
                mimeType: "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            barcode: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            category: {
              type: Type.STRING,
              description: "Catégorie: sec, frais, autre",
            },
          },
          required: ["name"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("[Gemini] Erreur analyzeImage:", error);
    return null;
  }
};

// ─── Suggestion de Recettes ──────────────────────────────────────────────────

/**
 * Tâche 2.2 – Raffinement du prompt de recettes.
 * Si \`priorityItems\` est fourni, le modèle est instruit de PRIORISER ces
 * ingrédients (les produits bientôt périmés) pour réduire le gaspillage.
 */
export const suggestRecipes = async (
  items: FoodItem[],
  filters?: RecipeFilters
): Promise<Recipe[]> => {
  try {
    // Séparer les produits urgents des autres pour le prompt
    const priorityNames = filters?.priorityItems ?? [];
    const urgentItems = items.filter((i) => priorityNames.includes(i.name));
    const otherItems = items.filter((i) => !priorityNames.includes(i.name));

    const urgentStr =
      urgentItems.length > 0
        ? \`URGENTS (bientôt périmés – à utiliser impérativement): \${urgentItems
            .map((i) => \`\${i.name} (DLC: \${i.expiryDate})\`)
            .join(", ")}.\`
        : "";

    const otherStr =
      otherItems.length > 0
        ? \`Disponibles en complément: \${otherItems.map((i) => i.name).join(", ")}.\`
        : "";

    let prompt = \`Tu es un chef cuisinier expert en cuisine anti-gaspillage.
Propose 3 recettes réalistes et appétissantes en utilisant les ingrédients suivants.
\${urgentStr}
\${otherStr}
Adapte les recettes pour utiliser un maximum des ingrédients URGENTS.\`;

    if (filters) {
      if (filters.dietary)
        prompt += \` Restrictions alimentaires: \${filters.dietary}.\`;
      if (filters.cuisine)
        prompt += \` Style de cuisine: \${filters.cuisine}.\`;
      if (filters.maxTime)
        prompt += \` Temps de préparation maximum: \${filters.maxTime}.\`;
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              prepTime: { type: Type.STRING },
            },
            required: ["title", "ingredients", "instructions", "prepTime"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("[Gemini] Erreur suggestRecipes:", error);
    return [];
  }
};