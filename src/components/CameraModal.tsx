import React from 'react';
import { Camera, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props { onCapture:(p:string,d:string,b?:string)=>void; onClose:()=>void; isLoading:boolean; }
type Step=1|2;

export default function CameraModal({onCapture,onClose,isLoading}:Props) {
  const [step,setStep]=React.useState<Step>(1);
  const [productPhoto,setProductPhoto]=React.useState<string|null>(null);
  const [barcode,setBarcode]=React.useState('');
  const ref=React.useRef<HTMLInputElement>(null);
  const STEPS=[{step:1 as Step,emoji:'📦',title:'Photo du produit',hint:'Photographiez le produit'},{step:2 as Step,emoji:'📅',title:'Photo de la DLC',hint:'Photographiez la date limite'}];
  const cur=STEPS[step-1];
  const handleFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file) return; e.target.value='';
    const reader=new FileReader(); reader.onloadend=()=>{ const b64=reader.result as string; if(step===1){setProductPhoto(b64);setStep(2);}else{onCapture(productPhoto!,b64,barcode||undefined);} }; reader.readAsDataURL(file);
  };
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="glass-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}} className="glass-panel w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex gap-2">{STEPS.map(s=><div key={s.step} className={`h-1.5 w-8 rounded-full transition-all ${step>=s.step?'bg-[var(--color-accent-green)]':'bg-white/10'}`}/>)}</div>
          <button onClick={onClose} className="btn-icon"><X size={15}/></button>
        </div>
        <div className="p-6 text-center space-y-5">
          <motion.div key={step} initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} className="mx-auto w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl">{cur.emoji}</motion.div>
          <div><p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Étape {step}/2</p><h3 className="text-lg font-bold text-white">{cur.title}</h3><p className="text-xs text-[var(--color-text-secondary)] mt-1">{cur.hint}</p></div>
          {step===1&&<div><label className="label-glass text-left block">Code-barres (optionnel)</label><input type="text" inputMode="numeric" className="input-glass text-center" placeholder="Ex: 3017620422003" value={barcode} onChange={e=>setBarcode(e.target.value)}/></div>}
          <button onClick={()=>ref.current?.click()} disabled={isLoading} className="btn-primary w-full">{isLoading?<div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"/>:<><Camera size={15}/>{step===1?'Photographier le produit':'Photographier la DLC'}</>}</button>
          {step===2&&<button onClick={()=>{setStep(1);setProductPhoto(null);}} className="btn-ghost w-full text-xs">← Recommencer</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile}/>
      </motion.div>
    </motion.div>
  );
}