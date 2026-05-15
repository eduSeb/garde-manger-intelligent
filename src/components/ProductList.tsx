import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, CheckCircle, Snowflake } from 'lucide-react';
import { FoodItem, StorageLocation } from '../types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props { items:FoodItem[]; onDelete:(id:string)=>void; onEdit:(item:FoodItem)=>void; onConsume:(item:FoodItem)=>void; onFreeze:(item:FoodItem)=>void; getExpiryStatus:(d:string,f:boolean)=>string; }
const LOC:Record<StorageLocation,{emoji:string}> = {[StorageLocation.FRIDGE]:{emoji:'❄️'},[StorageLocation.PANTRY]:{emoji:'🥫'},[StorageLocation.FREEZER]:{emoji:'🧊'}};
const BADGE:Record<string,string> = {ok:'badge badge-ok',warning:'badge badge-warning',danger:'badge badge-danger',expired:'badge badge-danger'};

export default function ProductList({items,onDelete,onEdit,onConsume,onFreeze,getExpiryStatus}:Props) {
  const sorted=[...items].sort((a,b)=>{ if(a.isFrozen&&!b.isFrozen) return 1; if(!a.isFrozen&&b.isFrozen) return -1; if(!a.expiryDate) return 1; if(!b.expiryDate) return -1; return a.expiryDate.localeCompare(b.expiryDate); });
  if(!sorted.length) return <div className="glass-card flex flex-col items-center justify-center py-20 text-center"><p className="text-4xl mb-3">📦</p><p className="text-[var(--color-text-secondary)] font-medium">Cet espace est vide.</p></div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((item,i)=>{
        const status=getExpiryStatus(item.expiryDate,item.isFrozen);
        const loc=LOC[item.location]??LOC[StorageLocation.PANTRY];
        const fmt=item.expiryDate?format(parseISO(item.expiryDate),'dd MMM yyyy',{locale:fr}):'—';
        return (
          <motion.div key={item.id} layout initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}} className="glass-card-sm group p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span>{loc.emoji}</span><h4 className="text-sm font-bold text-white truncate">{item.name}</h4></div>
                {item.brand&&<p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{item.brand}</p>}
              </div>
              {item.isFrozen&&<span className="badge badge-frozen shrink-0"><Snowflake size={10}/>Congelé</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-muted)]">{item.quantity} {item.unit}</span>
              {item.expiryDate&&<span className={BADGE[status]||'badge badge-ok'}>{status==='expired'?'⚠ ':''}{fmt}</span>}
            </div>
            {item.isFrozen&&item.originalExpiryDate&&<p className="text-[10px] text-[var(--color-text-muted)]">DLC initiale: {format(parseISO(item.originalExpiryDate),'dd MMM yyyy',{locale:fr})}</p>}
            <div className="flex gap-2 pt-1 border-t border-white/5">
              <button onClick={()=>onConsume(item)} className="btn-icon flex-1 h-8 rounded-lg text-[var(--color-accent-green)] border-[var(--color-accent-green)]/20 hover:bg-[var(--color-accent-green)]/10 text-xs gap-1"><CheckCircle size={13}/>Consommé</button>
              {!item.isFrozen&&<button onClick={()=>onFreeze(item)} className="btn-icon w-8 h-8 rounded-lg text-[var(--color-accent-purple)]"><Snowflake size={13}/></button>}
              <button onClick={()=>onEdit(item)} className="btn-icon w-8 h-8 rounded-lg"><Edit2 size={13}/></button>
              <button onClick={()=>item.id&&onDelete(item.id)} className="btn-icon btn-danger w-8 h-8 rounded-lg"><Trash2 size={13}/></button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}