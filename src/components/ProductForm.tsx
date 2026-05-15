import React from 'react';
import { X, Save } from 'lucide-react';
import { FoodItem, Category, StorageLocation } from '../types';
import { motion } from 'framer-motion';

interface Props { onSave:(item:Partial<FoodItem>)=>void; onClose:()=>void; initialData?:Partial<FoodItem>; }
const UNITS=['pièce','kg','g','l','ml','paquet','boîte','bouteille'];

export default function ProductForm({onSave,onClose,initialData}:Props) {
  const [form,setForm]=React.useState<Partial<FoodItem>>({name:'',brand:'',category:Category.SEC,location:StorageLocation.PANTRY,expiryDate:'',quantity:1,unit:'pièce',isFrozen:false,...initialData});
  const set=(p:Partial<FoodItem>)=>setForm(prev=>({...prev,...p}));
  const handleLoc=(loc:StorageLocation)=>set({location:loc,isFrozen:loc===StorageLocation.FREEZER});
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="glass-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}} className="glass-panel w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <h3 className="text-lg font-bold text-white">{initialData?.id?'✏️ Modifier':'➕ Nouveau produit'}</h3>
          <button onClick={onClose} className="btn-icon"><X size={16}/></button>
        </div>
        <form onSubmit={e=>{e.preventDefault();onSave(form);}} className="p-6 space-y-5">
          <div><label className="label-glass">Nom *</label><input required type="text" className="input-glass" placeholder="Ex: Pâtes penne" value={form.name} onChange={e=>set({name:e.target.value})}/></div>
          <div><label className="label-glass">Marque</label><input type="text" className="input-glass" placeholder="Ex: Barilla" value={form.brand??''} onChange={e=>set({brand:e.target.value})}/></div>
          <div>
            <label className="label-glass">Emplacement</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[{loc:StorageLocation.FRIDGE,label:'❄️ Frigo',cls:'fridge'},{loc:StorageLocation.PANTRY,label:'🥫 Placard',cls:'pantry'},{loc:StorageLocation.FREEZER,label:'🧊 Congélo',cls:'freezer'}].map(({loc,label,cls})=>(
                <button key={loc} type="button" onClick={()=>handleLoc(loc)} className={`storage-tab ${form.location===loc?`active ${cls}`:''}`} style={{flex:'none'}}>{label}</button>
              ))}
            </div>
          </div>
          <div><label className="label-glass">Date limite</label><input type="date" className="input-glass" value={form.expiryDate??''} onChange={e=>set({expiryDate:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-glass">Quantité</label><input required type="number" min="0" step="0.01" className="input-glass" value={form.quantity??1} onChange={e=>set({quantity:parseFloat(e.target.value)})}/></div>
            <div><label className="label-glass">Unité</label><select className="input-glass" value={form.unit??'pièce'} onChange={e=>set({unit:e.target.value})}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <div><label className="label-glass">Catégorie</label><select className="input-glass" value={form.category} onChange={e=>set({category:e.target.value as Category})}><option value={Category.SEC}>🌾 Sec</option><option value={Category.FRAIS}>🥛 Frais</option><option value={Category.AUTRE}>📦 Autre</option></select></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="btn-ghost flex-1">Annuler</button><button type="submit" className="btn-primary flex-[2]"><Save size={14}/>Enregistrer</button></div>
        </form>
      </motion.div>
    </motion.div>
  );
}