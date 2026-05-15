import React from 'react';
import { Plus, Camera, LogOut, ChefHat, Bell, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, signOut, handleFirestoreError, OperationType } from './lib/firebase';
import { analyzeExpiryDate, suggestRecipes } from './lib/gemini';
import { fetchProductByBarcode, offResultToFoodItem } from './lib/openfoodfacts';
import { subscribeToShoppingList, addConsumedItemToShoppingList, toggleShoppingItem, removeFromShoppingList, clearCheckedItems, computeFrozenExpiryDate } from './lib/shoppingList';
import { FoodItem, Category, Recipe, UserPreferences, RecipeFilters, StorageLocation, ShoppingListItem } from './types';
import CameraModal from './components/CameraModal';
import ProductList from './components/ProductList';
import ProductForm from './components/ProductForm';
import RecipeList from './components/RecipeList';
import SettingsModal from './components/SettingsModal';

const DEFAULT_PREFS: UserPreferences = { userId:'', expiryAlertDays:3, lowStockThreshold:2, enableExpiryAlerts:true, enableLowStockAlerts:true, enableRecipeSuggestions:true, freezerExtensionMonths:6 };

const getExpiryStatus = (expiryDate: string, isFrozen: boolean) => {
  if (!expiryDate || isFrozen) return 'ok';
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  return 'ok';
};

type Tab = 'stock'|'recipes'|'shopping';

function AuthScreen() {
  return (
    <div className="relative min-h-dvh flex items-center justify-center p-6">
      <div className="mesh-bg"><div className="mesh-blob-amber" /></div>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="relative z-10 glass-panel p-10 w-full max-w-sm text-center">
        <div className="text-6xl mb-2">🥗</div>
        <h1 className="text-3xl font-black text-gradient-green mb-1">Garde-Manger</h1>
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-8">Intelligent v2</p>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 leading-relaxed">Gérez votre stock, évitez le gaspillage, cuisinez malin.</p>
        <button onClick={signIn} className="btn-primary w-full">Se connecter avec Google</button>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = React.useState<User|null>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const [items, setItems] = React.useState<FoodItem[]>([]);
  const [userRecipes, setUserRecipes] = React.useState<Recipe[]>([]);
  const [shoppingList, setShoppingList] = React.useState<ShoppingListItem[]>([]);
  const [preferences, setPreferences] = React.useState<UserPreferences>(DEFAULT_PREFS);
  const [activeTab, setActiveTab] = React.useState<Tab>('stock');
  const [storageFilter, setStorageFilter] = React.useState<StorageLocation|'all'>('all');
  const [isScanning, setIsScanning] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<FoodItem|null>(null);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isRecipeLoading, setIsRecipeLoading] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [consumeTarget, setConsumeTarget] = React.useState<FoodItem|null>(null);

  React.useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setIsAuthLoading(false); }), []);

  React.useEffect(() => {
    if (!user) { setItems([]); setShoppingList([]); return; }
    const unsubItems = onSnapshot(query(collection(db,'items'),where('userId','==',user.uid)), snap => setItems(snap.docs.map(d=>({id:d.id,...d.data()})) as FoodItem[]), e=>handleFirestoreError(e,OperationType.LIST,'items'));
    const unsubRecipes = onSnapshot(query(collection(db,'recipes'),where('userId','==',user.uid)), snap => setUserRecipes(snap.docs.map(d=>({id:d.id,...d.data()})) as Recipe[]));
    const unsubShopping = subscribeToShoppingList(user.uid, setShoppingList);
    getDoc(doc(db,'preferences',user.uid)).then(snap => setPreferences(snap.exists() ? snap.data() as UserPreferences : {...DEFAULT_PREFS,userId:user.uid}));
    return () => { unsubItems(); unsubRecipes(); unsubShopping(); };
  }, [user]);

  const urgentItems = items.filter(i => { if (!i.expiryDate||i.isFrozen) return false; return Math.ceil((new Date(i.expiryDate).getTime()-Date.now())/86400000) <= (preferences.expiryAlertDays||3); });
  const filteredItems = storageFilter==='all' ? items : items.filter(i=>i.location===storageFilter);
  const uncheckedShopping = shoppingList.filter(i=>!i.checked).length;

  const handleCapture = async (productBase64: string, dlcBase64: string, barcode?: string) => {
    setIsAnalyzing(true);
    let partial: Partial<FoodItem> = {};
    if (barcode) { const r = await fetchProductByBarcode(barcode); if (r.found) partial = offResultToFoodItem(r,barcode); }
    const expiry = await analyzeExpiryDate(dlcBase64);
    if (expiry) partial.expiryDate = expiry;
    setIsAnalyzing(false); setIsScanning(false); setEditingItem(partial as FoodItem); setShowForm(true);
  };

  const handleSaveProduct = async (data: Partial<FoodItem>) => {
    if (!user) return;
    try {
      if (data.id) { const {id,...clean}=data; await updateDoc(doc(db,'items',id),clean); }
      else await addDoc(collection(db,'items'),{...data,userId:user.uid,addedAt:new Date().toISOString()});
      setShowForm(false); setEditingItem(null);
    } catch(e){handleFirestoreError(e,OperationType.WRITE,'items');}
  };

  const handleDelete = async (id:string) => { if(!window.confirm('Supprimer ?')) return; try{await deleteDoc(doc(db,'items',id));}catch(e){handleFirestoreError(e,OperationType.DELETE,`items/${id}`);} };
  const handleConsume = (item:FoodItem) => setConsumeTarget(item);
  const confirmConsume = async (addToList:boolean) => {
    if(!consumeTarget||!user) return;
    try { await deleteDoc(doc(db,'items',consumeTarget.id!)); if(addToList) await addConsumedItemToShoppingList(consumeTarget,user.uid); }
    catch(e){handleFirestoreError(e,OperationType.DELETE,`items/${consumeTarget.id}`);}
    setConsumeTarget(null);
  };

  const handleFreeze = async (item:FoodItem) => {
    if(!item.id) return;
    try { await updateDoc(doc(db,'items',item.id),{isFrozen:true,location:StorageLocation.FREEZER,originalExpiryDate:item.expiryDate,frozenAt:new Date().toISOString(),expiryDate:computeFrozenExpiryDate(preferences.freezerExtensionMonths)}); }
    catch(e){handleFirestoreError(e,OperationType.UPDATE,`items/${item.id}`);}
  };

  const handleSuggestRecipes = async (filters?:RecipeFilters) => {
    if(items.length===0) return;
    setActiveTab('recipes'); setIsRecipeLoading(true);
    setRecipes(await suggestRecipes(items,{...filters,priorityItems:urgentItems.map(i=>i.name)}));
    setIsRecipeLoading(false);
  };

  const handleSavePreferences = async (prefs:UserPreferences) => {
    if(!user) return;
    try { await setDoc(doc(db,'preferences',user.uid),prefs); setPreferences(prefs); setShowSettings(false); }
    catch(e){handleFirestoreError(e,OperationType.WRITE,'preferences');}
  };

  const handleAddUserRecipe = async (recipe:Recipe) => { if(!user) return; try{await addDoc(collection(db,'recipes'),{...recipe,userId:user.uid});}catch(e){handleFirestoreError(e,OperationType.WRITE,'recipes');} };

  if (isAuthLoading) return <div className="min-h-dvh flex items-center justify-center bg-[var(--color-brand-bg)]"><div className="w-10 h-10 rounded-full border-2 border-[var(--color-accent-green)] border-t-transparent animate-spin" /></div>;
  if (!user) return <AuthScreen />;

  const STORAGE_TABS = [
    {key:'all' as const,label:'Tout',emoji:'📦'},
    {key:StorageLocation.FRIDGE,label:'Frigo',emoji:'❄️',cls:'fridge'},
    {key:StorageLocation.PANTRY,label:'Placard',emoji:'🥫',cls:'pantry'},
    {key:StorageLocation.FREEZER,label:'Congélo',emoji:'🧊',cls:'freezer'},
  ];

  return (
    <div className="relative min-h-dvh flex flex-col">
      <div className="mesh-bg"><div className="mesh-blob-amber" /></div>
      <header className="glass-nav sticky top-0 z-50 h-16 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥗</span>
          <div><h1 className="text-base font-black text-gradient-green leading-none">Garde-Manger</h1><p className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] leading-none mt-0.5">Intelligent v2</p></div>
        </div>
        <nav className="hidden md:flex gap-1 glass-card-sm p-1">
          {(['stock','recipes','shopping'] as const).map(tab=>(
            <button key={tab} onClick={()=>tab==='recipes'?handleSuggestRecipes():setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeTab===tab?'bg-white/10 text-white':'text-[var(--color-text-muted)] hover:text-white'}`}>
              {tab==='stock'?'Inventaire':tab==='recipes'?'Recettes':(
                <span className="flex items-center gap-1.5">Courses{uncheckedShopping>0&&<span className="bg-[var(--color-accent-amber)] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{uncheckedShopping}</span>}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="btn-icon" onClick={()=>setShowNotifications(v=>!v)}><Bell size={16} />{urgentItems.length>0&&<span className="notification-dot absolute top-0.5 right-0.5" />}</button>
            <AnimatePresence>{showNotifications&&urgentItems.length>0&&(
              <motion.div initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}} className="absolute right-0 top-12 glass-panel p-4 w-72 z-50">
                <p className="label-glass mb-3">⚠️ Bientôt périmés</p>
                <div className="space-y-2">{urgentItems.map(i=><div key={i.id} className="glass-card-sm px-3 py-2 flex items-center justify-between"><span className="text-xs font-semibold text-white truncate">{i.name}</span><span className="badge badge-danger ml-2 shrink-0">{i.expiryDate}</span></div>)}</div>
                <button onClick={()=>{handleSuggestRecipes();setShowNotifications(false);}} className="btn-primary w-full mt-3 text-xs">Recettes anti-gaspillage</button>
              </motion.div>
            )}</AnimatePresence>
          </div>
          <button className="btn-icon" onClick={()=>setShowSettings(true)}><Settings size={16}/></button>
          <button className="btn-primary gap-2 hidden md:inline-flex" onClick={()=>setIsScanning(true)}><Camera size={14}/>Scanner</button>
          <button className="btn-icon btn-danger" onClick={signOut}><LogOut size={15}/></button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside className="glass-sidebar w-full md:w-72 shrink-0 p-6 flex flex-col gap-6">
          <div className="glass-card p-5 text-center">
            <p className="text-5xl font-black text-gradient-warm leading-none">{String(urgentItems.length).padStart(2,'0')}</p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mt-1">Alertes péremption</p>
            {urgentItems.length>0&&<button onClick={()=>handleSuggestRecipes()} className="btn-primary w-full mt-4 text-xs"><ChefHat size={13}/>Recettes de sauvetage</button>}
          </div>
          <div className="glass-card p-5 space-y-3">
            <p className="label-glass">Répartition du stock</p>
            {[{loc:StorageLocation.FRIDGE,label:'Frigo',emoji:'❄️',color:'var(--color-accent-blue)'},{loc:StorageLocation.PANTRY,label:'Placard',emoji:'🥫',color:'var(--color-accent-amber)'},{loc:StorageLocation.FREEZER,label:'Congélo',emoji:'🧊',color:'var(--color-accent-purple)'}].map(({loc,label,emoji,color})=>{
              const count=items.filter(i=>i.location===loc).length;
              const pct=items.length?Math.round((count/items.length)*100):0;
              return <div key={loc}><div className="flex justify-between text-xs mb-1"><span className="text-[var(--color-text-secondary)]">{emoji} {label}</span><span className="font-bold text-white">{count}</span></div><div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:color}} /></div></div>;
            })}
          </div>
          <div className="md:hidden grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={()=>setIsScanning(true)}><Camera size={14}/>Scanner</button>
            <button className="btn-ghost" onClick={()=>{setEditingItem(null);setShowForm(true);}}><Plus size={14}/>Manuel</button>
          </div>
        </aside>

        <section className="flex-1 p-6 overflow-y-auto custom-scroll">
          {activeTab==='stock'&&(
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="storage-tabs">{STORAGE_TABS.map(t=>(
                  <button key={t.key} onClick={()=>setStorageFilter(t.key)} className={`storage-tab ${storageFilter===t.key?'active '+(t.cls||''):''}`}>
                    {t.emoji} {t.label}<span className="opacity-60 text-[10px]">({t.key==='all'?items.length:items.filter(i=>i.location===t.key).length})</span>
                  </button>
                ))}</div>
                <button className="btn-ghost hidden md:inline-flex" onClick={()=>{setEditingItem(null);setShowForm(true);}}><Plus size={14}/>Ajouter manuellement</button>
              </div>
              <ProductList items={filteredItems} onDelete={handleDelete} onEdit={item=>{setEditingItem(item);setShowForm(true);}} onConsume={handleConsume} onFreeze={handleFreeze} getExpiryStatus={getExpiryStatus}/>
            </div>
          )}
          {activeTab==='recipes'&&(
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isRecipeLoading?(
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="text-5xl mb-4 animate-bounce">👨‍🍳</div>
                  <h3 className="text-2xl font-black text-gradient-green">Préparation...</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-2">L'IA analyse votre stock</p>
                </div>
              ):(
                <RecipeList recipes={recipes} userRecipes={userRecipes} onClose={()=>setActiveTab('stock')} onFilter={handleSuggestRecipes} onAddManual={handleAddUserRecipe}/>
              )}
            </div>
          )}
          {activeTab==='shopping'&&<ShoppingListView items={shoppingList} onToggle={toggleShoppingItem} onRemove={removeFromShoppingList} onClearChecked={()=>clearCheckedItems(shoppingList)}/>}
        </section>
      </main>

      <nav className="glass-nav md:hidden fixed bottom-0 inset-x-0 z-50 flex">
        {([{key:'stock',emoji:'📦',label:'Stock'},{key:'recipes',emoji:'🍳',label:'Recettes'},{key:'shopping',emoji:'🛒',label:`Courses${uncheckedShopping>0?` (${uncheckedShopping})`:''}`}] as const).map(t=>(
          <button key={t.key} onClick={()=>t.key==='recipes'?handleSuggestRecipes():setActiveTab(t.key)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-[10px] uppercase tracking-wider transition-colors ${activeTab===t.key?'text-[var(--color-accent-green)]':'text-[var(--color-text-muted)]'}`}>
            <span className="text-lg">{t.emoji}</span>{t.label}
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {isScanning&&<CameraModal onClose={()=>setIsScanning(false)} onCapture={handleCapture} isLoading={isAnalyzing}/>}
        {showForm&&<ProductForm initialData={editingItem||undefined} onClose={()=>{setShowForm(false);setEditingItem(null);}} onSave={handleSaveProduct}/>}
        {showSettings&&<SettingsModal preferences={preferences} onClose={()=>setShowSettings(false)} onSave={handleSavePreferences}/>}
        {consumeTarget&&<ConsumeModal item={consumeTarget} onCancel={()=>setConsumeTarget(null)} onConfirm={confirmConsume}/>}
      </AnimatePresence>
    </div>
  );
}

function ShoppingListView({items,onToggle,onRemove,onClearChecked}:{items:ShoppingListItem[];onToggle:(id:string,checked:boolean)=>void;onRemove:(id:string)=>void;onClearChecked:()=>void}) {
  const unchecked=items.filter(i=>!i.checked);
  const checked=items.filter(i=>i.checked);
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">🛒 Liste de courses</h2>
        {checked.length>0&&<button onClick={onClearChecked} className="btn-ghost text-xs">Effacer les cochés ({checked.length})</button>}
      </div>
      {items.length===0?(
        <div className="glass-card p-12 text-center"><p className="text-4xl mb-3">🛒</p><p className="text-[var(--color-text-muted)] text-sm">Votre liste est vide.<br/>Elle se remplira quand vous consommerez des produits.</p></div>
      ):(
        <>
          {unchecked.length>0&&<div className="space-y-2">{unchecked.map(item=>(
            <div key={item.id} className="glass-card-sm flex items-center gap-3 px-4 py-3">
              <button onClick={()=>onToggle(item.id!,true)} className="w-5 h-5 rounded-full border-2 border-[var(--color-accent-green)] shrink-0 hover:bg-[var(--color-accent-green)] transition-colors"/>
              <span className="flex-1 text-sm font-medium text-white">{item.name}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{item.quantity} {item.unit}</span>
              <button onClick={()=>onRemove(item.id!)} className="btn-icon btn-danger w-7 h-7">✕</button>
            </div>
          ))}</div>}
          {checked.length>0&&<div className="space-y-2 opacity-50"><p className="label-glass">Achetés</p>{checked.map(item=>(
            <div key={item.id} className="glass-card-sm flex items-center gap-3 px-4 py-3">
              <button onClick={()=>onToggle(item.id!,false)} className="w-5 h-5 rounded-full bg-[var(--color-accent-green)] shrink-0"/>
              <span className="flex-1 text-sm line-through text-[var(--color-text-muted)]">{item.name}</span>
              <button onClick={()=>onRemove(item.id!)} className="btn-icon btn-danger w-7 h-7">✕</button>
            </div>
          ))}</div>}
        </>
      )}
    </div>
  );
}

function ConsumeModal({item,onCancel,onConfirm}:{item:FoodItem;onCancel:()=>void;onConfirm:(addToList:boolean)=>void}) {
  return (
    <motion.div className="glass-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="glass-panel w-full max-w-sm p-6" initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}}>
        <p className="text-2xl mb-1">✅</p>
        <h3 className="text-lg font-bold text-white mb-1">Produit consommé</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">Voulez-vous ajouter <strong className="text-white">"{item.name}"</strong> à votre liste de courses ?</p>
        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={()=>onConfirm(true)}>🛒 Oui, ajouter à la liste</button>
          <button className="btn-ghost" onClick={()=>onConfirm(false)}>Non merci</button>
          <button className="btn-ghost" onClick={onCancel} style={{color:'var(--color-text-muted)'}}>Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
