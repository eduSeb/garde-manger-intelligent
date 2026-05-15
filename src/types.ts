export enum Category {
  SEC = 'sec',
  FRAIS = 'frais',
  AUTRE = 'autre'
}

export enum StorageLocation {
  FRIDGE = 'fridge',
  PANTRY = 'pantry',
  FREEZER = 'freezer'
}

export interface FoodItem {
  id?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  category: Category;
  location: StorageLocation;
  barcode?: string;
  expiryDate: string;
  originalExpiryDate?: string;
  isFrozen: boolean;
  frozenAt?: string;
  quantity: number;
  unit: string;
  userId: string;
  addedAt: string;
}

export interface Recipe {
  id?: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  prepTime: string;
  userId?: string;
}

export interface UserPreferences {
  userId: string;
  expiryAlertDays: number;
  lowStockThreshold: number;
  enableExpiryAlerts: boolean;
  enableLowStockAlerts: boolean;
  enableRecipeSuggestions: boolean;
  freezerExtensionMonths: number;
}

export interface RecipeFilters {
  dietary?: string;
  cuisine?: string;
  maxTime?: string;
  priorityItems?: string[];
}

export interface ShoppingListItem {
  id?: string;
  name: string;
  brand?: string;
  barcode?: string;
  quantity: number;
  unit: string;
  checked: boolean;
  userId: string;
  addedAt: string;
  sourceItemId?: string;
}
