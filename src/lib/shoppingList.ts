import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { FoodItem, ShoppingListItem } from '../types';

const COL = 'shopping_list';

export const subscribeToShoppingList = (userId: string, onUpdate: (items: ShoppingListItem[]) => void, onError?: (e: Error) => void) =>
  onSnapshot(query(collection(db, COL), where('userId', '==', userId)),
    snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ShoppingListItem[]),
    error => { handleFirestoreError(error, OperationType.LIST, COL); onError?.(error); }
  );

export const addToShoppingList = async (item: Omit<ShoppingListItem, 'id' | 'addedAt' | 'checked'>) => {
  try { await addDoc(collection(db, COL), { ...item, checked: false, addedAt: new Date().toISOString() }); }
  catch (e) { handleFirestoreError(e, OperationType.WRITE, COL); }
};

export const addConsumedItemToShoppingList = (item: FoodItem, userId: string) =>
  addToShoppingList({ name: item.name, brand: item.brand, barcode: item.barcode, quantity: item.quantity, unit: item.unit, userId, sourceItemId: item.id });

export const toggleShoppingItem = async (id: string, checked: boolean) => {
  try { await updateDoc(doc(db, COL, id), { checked }); }
  catch (e) { handleFirestoreError(e, OperationType.UPDATE, `${COL}/${id}`); }
};

export const removeFromShoppingList = async (id: string) => {
  try { await deleteDoc(doc(db, COL, id)); }
  catch (e) { handleFirestoreError(e, OperationType.DELETE, `${COL}/${id}`); }
};

export const clearCheckedItems = async (items: ShoppingListItem[]) => {
  try {
    const batch = writeBatch(db);
    items.filter(i => i.checked && i.id).forEach(i => batch.delete(doc(db, COL, i.id!)));
    await batch.commit();
  } catch (e) { handleFirestoreError(e, OperationType.DELETE, COL); }
};

export const computeFrozenExpiryDate = (months = 6): string => {
  const d = new Date(); d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};
