import React from 'react';
import { X, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserPreferences } from '../types';

interface Props { preferences:UserPreferences; onSave:(p:UserPreferences)=>void; onClose:()=>void; }
const Toggle=({checked,onChange}:{checked:boolean;onChange:(v:boolean)=>void})=>(
  <button type="button" onClick={()=>onChange(!checked)} className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${checked?'bg-[var(--color-accent-green)]':'bg-white/10'}`}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked?'translate-x-4':'translate-x-0.5'}`}/>
  </button>
);
const Row=({label,sub,children}:{label:string;sub?:string;children:React.ReactNode})=>(
  <div className="flex items-center justify-between gap-4 py-3"><div className="flex-1"><p className="text-sm font-semibold text-white">{label}</p>{sub&&<p className="text-xs text-[var(--color-text-muted)]">{sub}</p>}</div>{children}</div>
);

export default function SettingsModal({preferences,onSave,onClose}:Props) {
  const [f,setF]=React.useState<UserPreferences>(preferences);
  const set=(p:Partial<UserPreferences>)=>setF(prev=>({...prev,...p}));
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="glass-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}} className="glass-panel w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-6 border-b border-white/8"><div><h3 className="text-lg font-bold text-white">⚙️ Préférences</h3><p className="text-xs text-[var(--color-text-muted)]">Alertes, seuils et congélation</p></div><button onClick={onClose} className="btn-icon"><X size={16}/></button></div>
        <div className="p-6 space-y-4">
          <p className="label-glass">🔔 Alertes</p>
          <div className="glass-card-sm px-4 divide-y divide-white/5">
            <Row label="Alertes péremption" sub="Prévenir avant la DLC"><Toggle checked={f.enableExpiryAlerts} onChange={v=>set({enableExpiryAlerts:v})}/></Row>
            {f.enableExpiryAlerts&&<Row label="Délai d'alerte" sub="Jours avant DLC"><div className="flex items-center gap-2"><input type="number" min={1} max={30} className="input-glass w-16 text-center py-1.5 text-sm" value={f.expiryAlertDays} onChange={e=>set({expiryAlertDays:parseInt(e.target.value)||3})}/><span className="text-xs text-[var(--color-text-muted)]">j</span></div></Row>}
            <Row label="Alertes stock bas"><Toggle checked={f.enableLowStockAlerts} onChange={v=>set({enableLowStockAlerts:v})}/></Row>
          </div>
          <p className="label-glass">🧊 Congélation</p>
          <div className="glass-card-sm px-4">
            <Row label="Prolongation DLC" sub="Mois ajoutés"><div className="flex items-center gap-2"><input type="number" min={1} max={24} className="input-glass w-16 text-center py-1.5 text-sm" value={f.freezerExtensionMonths} onChange={e=>set({freezerExtensionMonths:parseInt(e.target.value)||6})}/><span className="text-xs text-[var(--color-text-muted)]">mois</span></div></Row>
          </div>
          <p className="label-glass">🍳 Recettes</p>
          <div className="glass-card-sm px-4"><Row label="Suggestions IA"><Toggle checked={f.enableRecipeSuggestions} onChange={v=>set({enableRecipeSuggestions:v})}/></Row></div>
          <button onClick={()=>onSave(f)} className="btn-primary w-full mt-2"><Save size={14}/>Enregistrer</button>
        </div>
      </motion.div>
    </motion.div>
  );
}