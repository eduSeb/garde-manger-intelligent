import { GoogleGenAI, Type } from '@google/genai';
import { FoodItem, Recipe, RecipeFilters } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
const MODEL = 'gemini-2.0-flash';

export const analyzeExpiryDate = async (dlcImageBase64: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [
        { text: 'Tu es un OCR spécialisé DLC. Extrais la date limite de consommation. Réponds UNIQUEMENT au format YYYY-MM-DD ou null.' },
        { inlineData: { data: dlcImageBase64.split(',')[1] || dlcImageBase64, mimeType: 'image/jpeg' } },
      ]}],
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: { expiryDate: { type: Type.STRING } }, required: ['expiryDate'] },
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    return parsed.expiryDate && parsed.expiryDate !== 'null' ? parsed.expiryDate : null;
  } catch (e) { console.error('[Gemini]', e); return null; }
};

export const suggestRecipes = async (items: FoodItem[], filters?: RecipeFilters): Promise<Recipe[]> => {
  try {
    const priority = filters?.priorityItems ?? [];
    const urgent = items.filter(i => priority.includes(i.name));
    const other = items.filter(i => !priority.includes(i.name));
    const urgentStr = urgent.length ? `URGENTS: ${urgent.map(i => `${i.name} (DLC:${i.expiryDate})`).join(', ')}.` : '';
    const otherStr = other.length ? `Autres: ${other.map(i => i.name).join(', ')}.` : '';
    let prompt = `Chef anti-gaspillage. 3 recettes réalistes.\n${urgentStr}\n${otherStr}`;
    if (filters?.dietary) prompt += ` Restrictions: ${filters.dietary}.`;
    if (filters?.cuisine) prompt += ` Style: ${filters.cuisine}.`;
    const response = await ai.models.generateContent({
      model: MODEL, contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            prepTime: { type: Type.STRING },
          }, required: ['title', 'ingredients', 'instructions', 'prepTime'] },
        },
      },
    });
    return JSON.parse(response.text || '[]');
  } catch (e) { console.error('[Gemini]', e); return []; }
};
