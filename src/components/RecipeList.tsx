import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Save } from 'lucide-react';
import { Recipe, RecipeFilters } from '../types';

interface Props { recipes:Recipe[]; onClose:()=>void; onFilter:(f:RecipeFilters)=>void; onAddManual:(r:Recipe)=>void; userRecipes:Recipe[]; }

export default function RecipeList({recipes,onClose,onFilter,onAddManual,userRecipes}:Props) {
  const [showFilters,setShowFilters]=React.useState(false);
  const [showAdd,setShowAdd]=React.useState(false);
  const [filters,setFilters]=React.useState<RecipeFilters>({});
  const [nr,setNr]=React.useState<Recipe>({title:'',ingredients:[],instructions:[],prepTime:''});
  const all=[...userRecipes,...recipes];
  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-2xl font-bold text-white">🍳 Suggestions du chef IA</h3>
        <div className="flex gap-2">
          <button onClick={()=>setShowAdd(true)} className="btn-ghost text-xs">+ Nouvelle recette</button>
          <button onClick={()=>setShowFilters(!showFilters)} className={`btn-icon ${showFilters?'bg-white/15':''}`}><Filter size={16}/></button>
          <button onClick={onClose} className="btn-ghost text-xs">← Stock</button>
        </div>
      </div>
      <AnimatePresence>{showFilters&&(
        <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 glass-card p-5">
            <div><label className="label-glass">Restrictions</label><input type="text" placeholder="Végétarien..." className="input-glass" value={filters.dietary||''} onChange={e=>setFilters({...filters,dietary:e.target.value})}/></div>
            <div><label className="label-glass">Style</label><input type="text" placeholder="Italien..." className="input-glass" value={filters.cuisine||''} onChange={e=>setFilters({...filters,cuisine:e.target.value})}/></div>
            <div className="flex items-end"><button onClick={()=>onFilter(filters)} className="btn-primary w-full">Appliquer</button></div>
          </div>
        </motion.div>
      )}</AnimatePresence>
      <AnimatePresence>{showAdd&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="glass-overlay fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} className="glass-panel w-full max-w-xl max-h-[90dvh] overflow-y-auto custom-scroll">
            <div className="flex justify-between items-center p-6 border-b border-white/8"><h4 className="font-bold text-white">📝 Ajouter une recette</h4><button onClick={()=>setShowAdd(false)} className="btn-icon"><X size={16}/></button></div>
            <div className="p-6 space-y-4">
              <div><label className="label-glass">Titre</label><input type="text" className="input-glass" value={nr.title} onChange={e=>setNr({...nr,title:e.target.value})}/></div>
              <div><label className="label-glass">Temps</label><input type="text" className="input-glass" placeholder="20 min" value={nr.prepTime} onChange={e=>setNr({...nr,prepTime:e.target.value})}/></div>
              <div><label className="label-glass">Ingrédients (1/ligne)</label><textarea className="input-glass h-24 resize-none" onChange={e=>setNr({...nr,ingredients:e.target.value.split('\n').filter(Boolean)})}/></div>
              <div><label className="label-glass">Instructions (1/ligne)</label><textarea className="input-glass h-24 resize-none" onChange={e=>setNr({...nr,instructions:e.target.value.split('\n').filter(Boolean)})}/></div>
              <button onClick={()=>{onAddManual(nr);setShowAdd(false);}} className="btn-primary w-full"><Save size={14}/>Enregistrer</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((r,i)=>(
          <motion.div key={r.id||i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}} className="glass-card-sm p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start gap-2">
              <div>{r.userId&&<span className="badge badge-ok text-[9px] mb-1 inline-flex">Ma recette</span>}<h4 className="text-sm font-bold text-white">{r.title}</h4></div>
              <span className="badge badge-ok shrink-0">{r.prepTime}</span>
            </div>
            <div><p className="label-glass mb-2">Ingrédients</p><div className="flex flex-wrap gap-1.5">{r.ingredients.map((ing,j)=><span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-[var(--color-text-secondary)] border border-white/8">{ing}</span>)}</div></div>
            <div><p className="label-glass mb-2">Étapes</p><div className="space-y-2">{r.instructions.map((s,j)=><div key={j} className="flex gap-2 text-xs"><span className="text-[var(--color-accent-green)] font-bold shrink-0">{j+1}.</span><p className="text-[var(--color-text-secondary)]">{s}</p></div>)}</div></div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}