import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.requestFullscreen) tg.requestFullscreen();
  if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
}
const TG_USER = tg?.initDataUnsafe?.user || null;

// Отступ сверху — шапка Telegram (60px) + выемка iPhone
const SAFE_TOP_CSS = "calc(60px + env(safe-area-inset-top, 0px))";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const cloudGet = (k) => new Promise(res => {
  if (tg?.CloudStorage) tg.CloudStorage.getItem(k, (e,v) => res(e?null:v));
  else res(localStorage.getItem(k));
});
const cloudSet = (k,v) => new Promise(res => {
  if (tg?.CloudStorage) tg.CloudStorage.setItem(k, v, e => res(!e));
  else { localStorage.setItem(k,v); res(true); }
});

const KEYS = { w:"bw_workouts_v1", r:"bw_results_v1", p:"bw_profile_v1" };
const db = {
  getW:    async()=>{ const d=await cloudGet(KEYS.w); try{return d?JSON.parse(d):[]}catch{return[]} },
  setW:    async(l)=>cloudSet(KEYS.w,JSON.stringify(l)),
  saveW:   async(w)=>{ const a=await db.getW(); const i=a.findIndex(x=>x.id===w.id); i!==-1?a[i]=w:a.push(w); await db.setW(a) },
  delW:    async(id)=>{ const a=await db.getW(); await db.setW(a.filter(w=>w.id!==id)) },
  getWById:async(id)=>{ const a=await db.getW(); return a.find(w=>w.id===id) },
  getR:    async()=>{ const d=await cloudGet(KEYS.r); try{return d?JSON.parse(d):[]}catch{return[]} },
  saveR:   async(r)=>{ const a=await db.getR(); a.push(r); await cloudSet(KEYS.r,JSON.stringify(a)) },
  delR:    async(id)=>{ const a=await db.getR(); await cloudSet(KEYS.r,JSON.stringify(a.filter(r=>r.id!==id))) },
  getRById:async(id)=>{ const a=await db.getR(); return a.find(r=>r.id===id) },
  getP:    async()=>{ const d=await cloudGet(KEYS.p); try{return d?JSON.parse(d):null}catch{return null} },
  saveP:   async(p)=>cloudSet(KEYS.p,JSON.stringify(p)),
};

// ─── PROGRAMS ─────────────────────────────────────────────────────────────────
const PROGS = [
  {id:"b1",level:"beginner",ll:"Новичок",goal:"fat",gl:"Жиросжигание",name:"Старт: сжигание жира",dur:25,desc:"Мягкий вход в тренировки. Пульс 60–70% от максимума — идеальная зона сжигания жира.",iv:[{id:"b1a",t:"slow",d:300},{id:"b1b",t:"medium",d:120},{id:"b1c",t:"slow",d:180},{id:"b1d",t:"medium",d:120},{id:"b1e",t:"slow",d:180},{id:"b1f",t:"medium",d:120},{id:"b1g",t:"slow",d:480}]},
  {id:"b2",level:"beginner",ll:"Новичок",goal:"endurance",gl:"Выносливость",name:"Базовая выносливость",dur:20,desc:"Равномерная нагрузка без резких скачков пульса. Безопасно для начинающих.",iv:[{id:"b2a",t:"slow",d:240},{id:"b2b",t:"medium",d:240},{id:"b2c",t:"slow",d:120},{id:"b2d",t:"medium",d:240},{id:"b2e",t:"slow",d:120},{id:"b2f",t:"medium",d:240}]},
  {id:"i1",level:"intermediate",ll:"Опытный",goal:"fat",gl:"Жиросжигание",name:"HIIT: жиросжигание",dur:30,desc:"Чередование спринтов и восстановления. Разгоняет метаболизм на 24–48 часов.",iv:[{id:"i1w",t:"slow",d:300},...Array.from({length:7},(_,i)=>[{id:`i1f${i}`,t:"fast",d:30},{id:`i1r${i}`,t:"slow",d:90}]).flat(),{id:"i1c",t:"slow",d:300}]},
  {id:"i2",level:"intermediate",ll:"Опытный",goal:"endurance",gl:"Выносливость",name:"Пирамида выносливости",dur:35,desc:"Нагрузка нарастает и спадает волнами. Увеличивает аэробную мощность.",iv:[{id:"i2a",t:"slow",d:300},{id:"i2b",t:"medium",d:120},{id:"i2c",t:"fast",d:60},{id:"i2d",t:"medium",d:120},{id:"i2e",t:"fast",d:90},{id:"i2f",t:"medium",d:120},{id:"i2g",t:"fast",d:120},{id:"i2h",t:"medium",d:120},{id:"i2i",t:"fast",d:90},{id:"i2j",t:"medium",d:120},{id:"i2k",t:"fast",d:60},{id:"i2l",t:"medium",d:120},{id:"i2m",t:"slow",d:300}]},
  {id:"p1",level:"pro",ll:"Профи",goal:"fat",gl:"Жиросжигание",name:"Табата",dur:20,desc:"20 сек максимально, 10 сек отдыха. Не рекомендуется при проблемах с сердцем.",iv:[{id:"p1w",t:"slow",d:300},...Array.from({length:8},(_,i)=>[{id:`p1f${i}`,t:"fast",d:20},{id:`p1r${i}`,t:"slow",d:10}]).flat(),{id:"p1m",t:"slow",d:180},...Array.from({length:8},(_,i)=>[{id:`p1g${i}`,t:"fast",d:20},{id:`p1s${i}`,t:"slow",d:10}]).flat(),{id:"p1c",t:"slow",d:300}]},
  {id:"p2",level:"pro",ll:"Профи",goal:"endurance",gl:"Выносливость",name:"VO2max",dur:45,desc:"Интервалы на уровне максимального потребления кислорода. Только для подготовленных.",iv:[{id:"p2a",t:"slow",d:600},{id:"p2b",t:"medium",d:180},{id:"p2c",t:"fast",d:180},{id:"p2d",t:"medium",d:180},{id:"p2e",t:"fast",d:180},{id:"p2f",t:"medium",d:180},{id:"p2g",t:"fast",d:180},{id:"p2h",t:"medium",d:180},{id:"p2i",t:"fast",d:180},{id:"p2j",t:"medium",d:180},{id:"p2k",t:"slow",d:600}]},
];
const PROG_IDS = new Set(PROGS.map(p=>p.id));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtD = s => { const m=Math.floor(s/60),sec=s%60; if(m&&sec)return`${m} мин ${sec} сек`; if(m)return`${m} мин`; return`${sec} сек` };
const fmtT = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ─── TIMER PERSISTENCE ────────────────────────────────────────────────────────
const TK = "bw_timer_v2";
const saveTimer  = s => localStorage.setItem(TK, JSON.stringify(s));
const clearTimer = () => localStorage.removeItem(TK);
const loadTimer  = () => { try{return JSON.parse(localStorage.getItem(TK))}catch{return null} };

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#09090f",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text: "#fff",
  sub: "rgba(255,255,255,0.4)",
  muted: "rgba(255,255,255,0.18)",
  green: "#4ade80",
  cyan: "#22d3ee",
  yellow: "#facc15",
  red: "#c0392b",
};

const IV = {
  slow:   { label:"Медленно", emoji:"🐢", color:C.green,  glow:"rgba(74,222,128,0.5)"  },
  medium: { label:"Средне",   emoji:"🚴", color:C.yellow, glow:"rgba(250,204,21,0.5)"  },
  fast:   { label:"Быстро",   emoji:"⚡", color:C.red,    glow:"rgba(192,57,43,0.5)"   },
};

const LVC = { beginner:C.green, intermediate:C.yellow, pro:C.red };

// ─── SHARED ───────────────────────────────────────────────────────────────────
function usePress(scale=0.96) {
  const [p,setP] = useState(false);
  return [
    { onPointerDown:()=>setP(true), onPointerUp:()=>setP(false), onPointerLeave:()=>setP(false) },
    { transform:p?`scale(${scale})`:"scale(1)", transition:"transform 0.1s ease" }
  ];
}

const Page = ({children, pad=true}) => (
  <div style={{
    minHeight:"100vh", background:C.bg, color:C.text, boxSizing:"border-box",
    paddingTop: pad ? SAFE_TOP_CSS : 0,
    paddingLeft: pad ? 16 : 0,
    paddingRight: pad ? 16 : 0,
    paddingBottom: pad ? 24 : 0,
    animation:"pageIn 0.22s ease both"
  }}>
    {children}
  </div>
);

const Loader = () => (
  <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🚴</div><div style={{color:C.muted,fontSize:14}}>Загрузка...</div></div>
  </div>
);

// Icon components
const Svg = ({size=20,children,...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>;
const I = {
  Back:  p=><Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7"/></Svg>,
  X:     p=><Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>,
  Plus:  p=><Svg {...p}><path d="M12 5v14M5 12h14"/></Svg>,
  Trash: p=><Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></Svg>,
  Edit:  p=><Svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>,
  User:  p=><Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></Svg>,
  Clock: p=><Svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Svg>,
  Star:  p=><Svg {...p}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></Svg>,
  Book:  p=><Svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></Svg>,
  Check: p=><Svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"/></Svg>,
  Cal:   p=><Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>,
  Zap:   p=><Svg {...p} fill={p.fill||"none"}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></Svg>,
  Trophy:p=><Svg {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></Svg>,
  Play:  p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>,
  Pause: p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Stop:  p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Target:p=><Svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></Svg>,
  Flag:  p=><Svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></Svg>,
};

const IconBtn = ({onClick,children,style={}}) => {
  const [ph,ps]=usePress(0.9);
  return <button onClick={onClick} {...ph} style={{width:38,height:38,borderRadius:"50%",background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.text,cursor:"pointer",flexShrink:0,...ps,...style}}>{children}</button>;
};

const GreenBtn = ({onClick,children,style={},disabled=false,...rest}) => {
  const [ph,ps]=usePress(0.97);
  return <button onClick={onClick} disabled={disabled} {...ph} {...rest} style={{width:"100%",background:disabled?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:14,padding:"15px",color:disabled?"rgba(255,255,255,0.3)":"#000",fontSize:15,fontWeight:700,cursor:disabled?"default":"pointer",boxShadow:disabled?"none":"0 4px 20px rgba(74,222,128,0.2)",...ps,...style}}>{children}</button>;
};

function IvBar({intervals=[],h=5}) {
  if(!intervals.length) return null;
  return <div style={{display:"flex",gap:2,height:h,borderRadius:h/2,overflow:"hidden"}}>
    {intervals.map((iv,i)=><div key={i} style={{flex:iv.d||iv.duration||1,background:IV[iv.t||iv.type]?.color||C.green,minWidth:3,transition:"flex 0.3s"}}/>)}
  </div>;
}

// ─── IOS-STYLE WHEEL PICKER ───────────────────────────────────────────────────
function WheelColumn({value, max, onChange}) {
  const ITEM_H = 44;
  const ref = useRef(null);
  const settling = useRef(false);

  const scrollTo = useCallback((v, smooth=true) => {
    if (!ref.current) return;
    ref.current.scrollTo({ top: v * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Init scroll position
  useEffect(() => { scrollTo(value, false); }, []);

  const handleScroll = useCallback(() => {
    if (settling.current || !ref.current) return;
    const raw = ref.current.scrollTop;
    const idx = Math.round(raw / ITEM_H);
    const clamped = Math.max(0, Math.min(max, idx));
    if (clamped !== value) onChange(clamped);
  }, [value, max, onChange]);

  // Settle on scroll end
  const settleTimer = useRef(null);
  const handleScrollWithSettle = () => {
    handleScroll();
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(max, idx));
      settling.current = true;
      scrollTo(clamped, true);
      onChange(clamped);
      setTimeout(() => { settling.current = false; }, 350);
    }, 80);
  };

  const items = Array.from({length: max+1}, (_,i)=>i);

  return (
    <div style={{position:"relative",flex:1,height:ITEM_H*5,overflow:"hidden",borderRadius:12}}>
      {/* Scroll container */}
      <div
        ref={ref}
        onScroll={handleScrollWithSettle}
        style={{height:"100%",overflowY:"scroll",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        <div style={{height:ITEM_H*2}}/>
        {items.map(v => (
          <div key={v} onClick={()=>{ onChange(v); scrollTo(v); }}
            style={{height:ITEM_H,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:v===value?600:300,color:v===value?"#fff":"rgba(255,255,255,0.25)",letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums",cursor:"pointer",userSelect:"none",transition:"color 0.12s,font-weight 0.12s"}}>
            {String(v).padStart(2,"0")}
          </div>
        ))}
        <div style={{height:ITEM_H*2}}/>
      </div>
      {/* Fades */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",background:`linear-gradient(to bottom, ${C.bg} 0%, transparent 35%, transparent 65%, ${C.bg} 100%)`,zIndex:2}}/>
      {/* Selection line */}
      <div style={{position:"absolute",left:8,right:8,top:ITEM_H*2,height:ITEM_H,border:`1px solid rgba(74,222,128,0.3)`,borderRadius:8,zIndex:1,pointerEvents:"none"}}/>
    </div>
  );
}

function DurPicker({duration, onChange, onClose}) {
  const mins = Math.floor(duration/60);
  const secs = duration%60;
  const [m,setM] = useState(mins);
  const [s,setS] = useState(secs);

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"#141420",borderRadius:"20px 20px 0 0",padding:"16px 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom,24px))",animation:"slideUp 0.25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>Длительность интервала</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:14}}>Отмена</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          <WheelColumn value={m} max={99} onChange={setM}/>
          <div style={{fontSize:22,color:C.muted,padding:"0 8px",flexShrink:0}}>:</div>
          <WheelColumn value={s} max={59} onChange={setS}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <div style={{flex:1,textAlign:"center",color:C.sub,fontSize:13}}>{m} мин</div>
          <div style={{flex:1,textAlign:"center",color:C.sub,fontSize:13}}>{s} сек</div>
        </div>
        <GreenBtn onClick={()=>{ onChange(m*60+s); onClose(); }} style={{marginTop:14}}>Готово</GreenBtn>
      </div>
    </div>,
    document.body
  );
}

// ─── INTERVAL ROW ─────────────────────────────────────────────────────────────
const SLIDE = 78;

function IvRow({iv, index, total, onChange, onDelete, dragHandle}) {
  const cfg = IV[iv.t||iv.type] || IV.slow;
  const dur = iv.d || iv.duration || 0;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState(0);
  const startX = useRef(null);
  const startY = useRef(null);
  const baseX = useRef(0);
  const isHoriz = useRef(false); // определили направление?
  const dragging = useRef(false);

  const onTS = e => {
    if (e.target.closest("[data-drag]")) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseX.current = open ? -SLIDE : 0;
    isHoriz.current = false;
    dragging.current = false;
  };

  const onTM = e => {
    if (e.target.closest("[data-drag]")) return;
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Определяем направление только один раз, по первым 6px
    if (!dragging.current) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      isHoriz.current = Math.abs(dx) > Math.abs(dy);
      dragging.current = true;
    }

    if (!isHoriz.current) return; // вертикальный — не мешаем скроллу

    // Горизонтальный свайп — блокируем скролл и закрытие TG
    e.preventDefault();
    e.stopPropagation();
    const next = Math.max(-SLIDE, Math.min(0, baseX.current + dx));
    setTx(next);
  };

  const onTE = () => {
    if (!dragging.current || !isHoriz.current) {
      startX.current = null;
      return;
    }
    dragging.current = false;
    const opened = tx < -SLIDE / 2;
    setOpen(opened);
    setTx(opened ? -SLIDE : 0);
    startX.current = null;
  };

  return (
    <div style={{position:"relative",marginBottom:8,borderRadius:14,overflow:"hidden"}}>
      {/* Delete bg */}
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:SLIDE-8,background:"#6b1515",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",opacity:open?1:0,transition:"opacity 0.2s",zIndex:0}}>
        <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onDelete,150)}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <I.Trash size={18}/><span style={{fontSize:10,fontWeight:600}}>УДАЛИТЬ</span>
        </button>
      </div>

      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${cfg.color}22`,borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",gap:8,
          transform:`translateX(${tx}px)`,
          transition:(dragging.current && isHoriz.current)?"none":"transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)",
          position:"relative",zIndex:1,userSelect:"none",
          touchAction: open ? "none" : "pan-y",
          willChange:"transform",
        }}>

        {/* Drag handle */}
        <div data-drag="1" {...dragHandle}
          style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.07)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:12,fontWeight:700,cursor:"grab",flexShrink:0,touchAction:"none"}}>
          {index+1}
        </div>

        {/* Type selector */}
        <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:2,gap:1,flexShrink:0}}>
          {Object.entries(IV).map(([t,c])=>(
            <button key={t} onClick={()=>onChange({...iv,t,type:t})}
              style={{background:(iv.t||iv.type)===t?c.color:"transparent",border:"none",borderRadius:8,width:32,height:32,fontSize:17,cursor:"pointer",transition:"background 0.15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {c.emoji}
            </button>
          ))}
        </div>

        {/* Label */}
        <div style={{fontSize:12,color:cfg.color,fontWeight:600,flex:1,minWidth:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{cfg.label}</div>

        {/* Duration button */}
        <button onClick={()=>setPickerOpen(true)}
          style={{background:"rgba(255,255,255,0.07)",border:`1px solid ${C.border}`,borderRadius:9,padding:"6px 10px",color:"#fff",fontSize:14,fontWeight:500,cursor:"pointer",flexShrink:0,fontVariantNumeric:"tabular-nums",minWidth:58,textAlign:"center"}}>
          {fmtT(dur)}
        </button>
      </div>

      {pickerOpen && (
        <DurPicker duration={dur} onChange={d=>onChange({...iv,d,duration:d})} onClose={()=>setPickerOpen(false)}/>
      )}
    </div>
  );
}

// ─── SORTABLE LIST — simple touch drag ────────────────────────────────────────
function SortList({intervals, onChange, onDelete}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [ghostY, setGhostY] = useState(0);
  const rowRefs = useRef([]);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const startDrag = (idx, e) => {
    startY.current = e.touches[0].clientY;
    setDragIdx(idx);
    setOverIdx(idx);
  };

  const onMove = useCallback(e => {
    if (dragIdx === null) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    setGhostY(y - startY.current);

    // find which row we're over
    let best = dragIdx;
    rowRefs.current.forEach((r, i) => {
      if (!r) return;
      const rect = r.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (Math.abs(y - mid) < rect.height * 0.6) best = i;
    });
    setOverIdx(Math.max(0, Math.min(intervals.length-1, best)));
  }, [dragIdx, intervals.length]);

  const onEnd = useCallback(() => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const arr = [...intervals];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(overIdx, 0, item);
      onChange(arr);
    }
    setDragIdx(null);
    setOverIdx(null);
    setGhostY(0);
  }, [dragIdx, overIdx, intervals, onChange]);

  useEffect(() => {
    if (dragIdx !== null) {
      window.addEventListener("touchmove", onMove, {passive:false});
      window.addEventListener("touchend", onEnd);
      return () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };
    }
  }, [dragIdx, onMove, onEnd]);

  // Build display: preview swap
  let display = intervals.map((_,i)=>i);
  if (dragIdx!==null && overIdx!==null && dragIdx!==overIdx) {
    display = [...display];
    const [item] = display.splice(dragIdx, 1);
    display.splice(overIdx, 0, item);
  }

  return (
    <div ref={containerRef}>
      {display.map((origIdx, dispIdx) => {
        const iv = intervals[origIdx];
        const isDragging = dragIdx === origIdx;
        const isTarget = overIdx === dispIdx && dragIdx !== null && dragIdx !== origIdx;

        return (
          <div key={iv.id} ref={el => rowRefs.current[dispIdx] = el}
            style={{
              transform: isDragging ? `translateY(${ghostY}px) scale(1.02)` : isTarget ? "translateY(2px)" : "translateY(0)",
              transition: isDragging ? "none" : "transform 0.18s ease",
              zIndex: isDragging ? 20 : 1,
              position: "relative",
              boxShadow: isDragging ? "0 8px 32px rgba(0,0,0,0.6)" : "none",
              opacity: isDragging ? 0.9 : 1,
            }}>
            <IvRow
              iv={iv} index={dispIdx} total={intervals.length}
              onChange={updated => onChange(intervals.map((x,i)=>i===origIdx?updated:x))}
              onDelete={() => onChange(intervals.filter((_,i)=>i!==origIdx))}
              dragHandle={{ onTouchStart: e => { e.stopPropagation(); startDrag(origIdx, e); } }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── HISTORY CARD ─────────────────────────────────────────────────────────────
function HistCard({result, onClick, onDelete}) {
  const done = result.completedIntervals === result.totalIntervals;
  const fmt = new Date(result.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const [ph,ps] = usePress(0.97);
  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState(0);
  const startX = useRef(null), startY = useRef(null);
  const isHoriz = useRef(false), dragging = useRef(false);
  const SLIDE = 78;

  const onTS = e => { startX.current=e.touches[0].clientX; startY.current=e.touches[0].clientY; isHoriz.current=false; dragging.current=false; };
  const onTM = e => {
    if (startX.current===null) return;
    const dx=e.touches[0].clientX-startX.current;
    const dy=e.touches[0].clientY-startY.current;
    if (!dragging.current) {
      if (Math.abs(dx)<4&&Math.abs(dy)<4) return;
      isHoriz.current = Math.abs(dx)>Math.abs(dy);
      dragging.current = true;
    }
    if (!isHoriz.current) return;
    e.preventDefault(); e.stopPropagation();
    setTx(Math.max(-SLIDE,Math.min(0,(open?-SLIDE:0)+dx)));
  };
  const onTE = () => {
    if (!dragging.current||!isHoriz.current){startX.current=null;return;}
    dragging.current=false;
    const o=tx<-SLIDE/2; setOpen(o); setTx(o?-SLIDE:0); startX.current=null;
  };

  return (
    <div style={{position:"relative",marginBottom:8,borderRadius:14,overflow:"hidden"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:SLIDE-8,background:"#6b1515",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",opacity:open?1:0,transition:"opacity 0.2s",zIndex:0}}>
        <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onDelete,150)}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <I.Trash size={18}/><span style={{fontSize:10,fontWeight:600}}>УДАЛИТЬ</span>
        </button>
      </div>
      <div {...ph} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={()=>!open&&onClick()}
        style={{...ps,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",cursor:"pointer",transform:`translateX(${tx}px)`,transition:(dragging.current&&isHoriz.current)?"none":"transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)",position:"relative",zIndex:1,userSelect:"none",touchAction:open?"none":"pan-y"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{fontSize:14,fontWeight:500}}>{result.workoutName}</div>
          {done && <I.Check size={16} style={{color:C.green,flexShrink:0}}/>}
        </div>
        <div style={{display:"flex",gap:14}}>
          <span style={{display:"flex",alignItems:"center",gap:4,color:C.sub,fontSize:12}}><I.Clock size={11}/>{fmtD(result.totalDuration)}</span>
          <span style={{fontSize:12,color:done?C.green:"#fb923c"}}>{result.completedIntervals}/{result.totalIntervals} инт.</span>
          <span style={{display:"flex",alignItems:"center",gap:4,color:C.muted,fontSize:12}}><I.Cal size={11}/>{fmt}</span>
        </div>
      </div>
    </div>
  );
}

// ─── WORKOUT CARD ─────────────────────────────────────────────────────────────
function WCard({workout, onStart, onEdit, onDelete}) {
  const total = workout.intervals?.reduce((s,i)=>s+(i.d||i.duration),0)||0;
  const [ph,ps] = usePress(0.97);
  const [menu, setMenu] = useState(false);
  const [mPos, setMPos] = useState({top:0,right:0});
  const btnRef = useRef(null);
  const isP = PROG_IDS.has(workout.id);

  const openMenu = e => { e.stopPropagation(); const r=btnRef.current.getBoundingClientRect(); setMPos({top:r.bottom+6,right:window.innerWidth-r.right}); setMenu(true); };

  const ivs = workout.intervals?.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration})) || [];

  return (
    <div style={{animation:"slideUp 0.2s ease both"}}>
      <div {...ph} onClick={onStart}
        style={{...ps,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 16px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,marginRight:8}}>
            <div style={{fontSize:16,fontWeight:500,marginBottom:5}}>{workout.name}</div>
            <div style={{display:"flex",gap:12,marginBottom:10}}>
              <span style={{display:"flex",alignItems:"center",gap:4,color:C.sub,fontSize:12}}><I.Clock size={11}/>{fmtD(total)}</span>
              <span style={{display:"flex",alignItems:"center",gap:4,color:C.sub,fontSize:12}}><I.Zap size={11}/>{workout.intervals?.length||0} инт.</span>
            </div>
            <IvBar intervals={ivs}/>
          </div>
          <button ref={btnRef} onClick={openMenu} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:"2px 6px",fontSize:18,letterSpacing:2,flexShrink:0}}>···</button>
        </div>
      </div>
      {menu && createPortal(<>
        <div onClick={()=>setMenu(false)} style={{position:"fixed",inset:0,zIndex:9998}}/>
        <div style={{position:"fixed",top:mPos.top,right:mPos.right,zIndex:9999,background:"#1c1c2a",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",minWidth:170,boxShadow:"0 20px 48px rgba(0,0,0,0.8)",animation:"fadeIn 0.15s ease"}}>
          {!isP && <button onClick={()=>{setMenu(false);onEdit()}} style={{display:"block",width:"100%",background:"none",border:"none",color:"#fff",padding:"13px 16px",textAlign:"left",cursor:"pointer",fontSize:14}}>✏️ Редактировать</button>}
          {!isP && <div style={{height:1,background:C.border}}/>}
          <button onClick={()=>{setMenu(false);onDelete()}} style={{display:"block",width:"100%",background:"none",border:"none",color:"#f43f5e",padding:"13px 16px",textAlign:"left",cursor:"pointer",fontSize:14}}>🗑 Удалить</button>
        </div>
      </>, document.body)}
    </div>
  );
}

// ─── PROGRAM CARD ─────────────────────────────────────────────────────────────
function PCard({prog, onUse, added}) {
  const [open, setO] = useState(false);
  const [ph,ps] = usePress(0.98);
  const lc = LVC[prog.level]||C.green;
  const ivs = prog.iv.map(iv=>({...iv,t:iv.t,d:iv.d}));
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",animation:"slideUp 0.18s ease both"}}>
      <div {...ph} onClick={()=>setO(v=>!v)} style={{...ps,padding:"14px 16px",cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:lc,background:`${lc}18`,borderRadius:5,padding:"2px 7px"}}>{prog.ll.toUpperCase()}</span>
              <span style={{fontSize:11,color:C.sub}}>{prog.gl}</span>
              {added && <span style={{fontSize:10,color:C.green,background:"rgba(74,222,128,0.12)",borderRadius:5,padding:"2px 7px"}}>✓ В Моих</span>}
            </div>
            <div style={{fontSize:15,fontWeight:500,marginBottom:5}}>{prog.name}</div>
            <div style={{display:"flex",gap:10}}><span style={{fontSize:12,color:C.sub}}>{prog.dur} мин</span><span style={{fontSize:12,color:C.sub}}>{prog.iv.length} инт.</span></div>
          </div>
          <div style={{color:C.muted,transform:open?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s",fontSize:16}}>›</div>
        </div>
        <div style={{marginTop:10}}><IvBar intervals={ivs}/></div>
      </div>
      {open && <div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`,animation:"fadeIn 0.18s ease"}}>
        <p style={{fontSize:13,color:C.sub,lineHeight:1.6,margin:"12px 0"}}>{prog.desc}</p>
        <GreenBtn onClick={()=>onUse(prog)} disabled={added} style={{fontSize:14}}>
          {added ? "Уже в Моих тренировках" : "Начать →"}
        </GreenBtn>
      </div>}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfilePage({navigate}) {
  const [profile,setProfile] = useState({name:"",age:"",weight:""});
  const [editing,setEditing] = useState(false);
  const [has,setHas] = useState(false);
  const [loading,setLoad] = useState(true);
  const userLevel = localStorage.getItem("bw_user_level")||"";
  const levelLabel = {beginner:"Новичок",intermediate:"Опытный",pro:"Профи"}[userLevel]||"";

  useEffect(()=>{(async()=>{
    const p=await db.getP();
    if(p&&(p.name||p.age||p.weight)){setProfile(p);setHas(true);}
    else{
      const n=TG_USER?`${TG_USER.first_name||""} ${TG_USER.last_name||""}`.trim():"";
      setProfile(pr=>({...pr,name:n}));
      setEditing(true);
    }
    setLoad(false);
  })();},[]);

  const save=async()=>{await db.saveP(profile);setHas(true);setEditing(false);};
  const initials=(profile.name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  if(loading) return <Loader/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,boxSizing:"border-box",paddingTop:SAFE_TOP_CSS,paddingLeft:16,paddingRight:16,paddingBottom:32}}>

      {/* Header с кнопками — фиксированная высота строки */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28,height:44}}>
        <IconBtn onClick={()=>navigate("home")} style={{flexShrink:0}}><I.Back size={18}/></IconBtn>
        <div style={{fontSize:20,fontWeight:600,flex:1}}>Профиль</div>
        {has&&!editing&&<IconBtn onClick={()=>setEditing(true)} style={{flexShrink:0}}><I.Edit size={16}/></IconBtn>}
      </div>

      {/* Аватар слева + инфо справа */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28,padding:"18px 16px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:18}}>
        {/* Фото */}
        <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",flexShrink:0,overflow:"hidden",boxShadow:"0 0 20px rgba(74,222,128,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {TG_USER?.photo_url
            ?<img src={TG_USER.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<div style={{fontSize:24,fontWeight:700,color:"#000"}}>{initials}</div>
          }
        </div>
        {/* Инфо */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:18,fontWeight:600,color:"#fff",marginBottom:4,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
            {profile.name || TG_USER?.first_name || "—"}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {profile.age&&<span style={{fontSize:13,color:C.sub}}>{profile.age} лет</span>}
            {profile.weight&&<span style={{fontSize:13,color:C.sub}}>· {profile.weight} кг</span>}
            {levelLabel&&<span style={{fontSize:12,fontWeight:600,color:LVC[userLevel]||C.green,background:`${LVC[userLevel]||C.green}15`,borderRadius:6,padding:"2px 8px"}}>{levelLabel}</span>}
          </div>
          {TG_USER?.username&&<div style={{fontSize:12,color:C.muted,marginTop:4}}>@{TG_USER.username}</div>}
        </div>
      </div>

      {/* View mode */}
      {has&&!editing&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {[
            {l:"Имя",    v:profile.name||"—"},
            {l:"Возраст",v:profile.age?`${profile.age} лет`:"—"},
            {l:"Вес",    v:profile.weight?`${profile.weight} кг`:"—"},
            {l:"Уровень",v:levelLabel||"Не выбран"},
          ].map((f,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:C.sub,textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.l}</div>
              <div style={{fontSize:16,fontWeight:500}}>{f.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Edit mode */}
      {editing&&(
        <>
          {[
            {k:"name",  l:"Имя",     pl:"Введите имя", type:"text"},
            {k:"age",   l:"Возраст", pl:"—",            type:"number", s:"лет"},
            {k:"weight",l:"Вес",     pl:"—",            type:"number", s:"кг"},
          ].map(f=>(
            <div key={f.k} style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.sub,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>{f.l}</div>
              <div style={{position:"relative"}}>
                <input
                  value={profile[f.k]||""} type={f.type}
                  onChange={e=>setProfile(p=>({...p,[f.k]:e.target.value}))}
                  placeholder={f.pl}
                  style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:12,color:"#fff",fontSize:15,padding:`13px ${f.s?"40px":16}px 13px 16px`,outline:"none",boxSizing:"border-box"}}
                />
                {f.s&&<span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:13,pointerEvents:"none"}}>{f.s}</span>}
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:10,marginTop:8}}>
            {has&&<button onClick={()=>setEditing(false)} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",color:C.text,fontSize:15,fontWeight:600,cursor:"pointer"}}>Отмена</button>}
            <GreenBtn onClick={save} style={{flex:2}}>Сохранить</GreenBtn>
          </div>
        </>
      )}
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function SectionHeader({title}) {
  return (
    <div style={{fontSize:17,fontWeight:600,color:"#fff",marginBottom:12,letterSpacing:"-0.01em"}}>{title}</div>
  );
}

function RecoCard({prog, onStart}) {
  const lc = LVC[prog.level]||C.green;
  const [ph,ps] = usePress(0.96);
  const ivs = prog.iv.map(iv=>({...iv,t:iv.t,d:iv.d}));
  return (
    <div {...ph} onClick={()=>onStart(prog)}
      style={{...ps,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",cursor:"pointer",flexShrink:0,width:190}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:lc,background:`${lc}18`,borderRadius:5,padding:"2px 8px",letterSpacing:"0.07em"}}>{prog.ll.toUpperCase()}</span>
        <span style={{fontSize:11,color:C.muted}}>{prog.dur} мин</span>
      </div>
      <div style={{fontSize:15,fontWeight:500,color:"#fff",marginBottom:10,lineHeight:1.3}}>{prog.name}</div>
      <IvBar intervals={ivs} h={4}/>
    </div>
  );
}

function LastResultCard({result, onClick}) {
  const done = result.completedIntervals===result.totalIntervals;
  const date = new Date(result.completedAt);
  const fmt = date.toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
  const [ph,ps]=usePress(0.97);
  return (
    <div {...ph} onClick={onClick}
      style={{...ps,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:42,height:42,borderRadius:12,background:done?"rgba(74,222,128,0.12)":"rgba(251,146,60,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>
        {done?"✅":"⏱"}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:500,color:"#fff",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{result.workoutName}</div>
        <div style={{fontSize:13,color:C.sub,marginTop:3,display:"flex",gap:10}}>
          <span>{fmtD(result.totalDuration)}</span>
          <span style={{color:done?C.green:"#fb923c"}}>{result.completedIntervals}/{result.totalIntervals} инт.</span>
        </div>
      </div>
      <div style={{fontSize:12,color:C.muted,flexShrink:0}}>{fmt}</div>
    </div>
  );
}

// Выбор уровня — показывается если уровень ещё не выбран
function LevelPicker({onSelect}) {
  return (
    <div style={{animation:"slideUp 0.25s ease both"}}>
      <div style={{fontSize:18,fontWeight:600,color:"#fff",marginBottom:6}}>Выберите уровень</div>
      <div style={{fontSize:14,color:C.sub,marginBottom:20,lineHeight:1.5}}>Мы подберём программы, которые подойдут именно вам</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {level:"beginner", label:"Новичок", desc:"Первые тренировки, безопасная нагрузка, пульс в норме", emoji:"🌱", color:C.green},
          {level:"intermediate", label:"Опытный", desc:"HIIT, пирамиды, смешанные интервалы, 2–3 раза в неделю", emoji:"⚡", color:C.yellow},
          {level:"pro", label:"Профи", desc:"Табата, VO2max — максимальная интенсивность", emoji:"🏆", color:C.red},
        ].map(l=>{
          const [ph,ps]=usePress(0.97);
          return (
            <button key={l.level} {...ph} onClick={()=>onSelect(l.level)}
              style={{...ps,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,textAlign:"left",cursor:"pointer",width:"100%"}}>
              <div style={{width:46,height:46,borderRadius:13,background:`${l.color}14`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:24}}>{l.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:600,color:"#fff",marginBottom:4}}>{l.label}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.4}}>{l.desc}</div>
              </div>
              <div style={{color:C.muted,fontSize:18,flexShrink:0}}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TABS = [{id:"my",l:"Мои",icon:<I.Star size={13}/>},{id:"programs",l:"Программы",icon:<I.Book size={13}/>},{id:"history",l:"История",icon:<I.Clock size={13}/>}];

function HomePage({navigate}) {
  const [tab,setTab]=useState("my");
  const [workouts,setWS]=useState([]);
  const [history,setHist]=useState([]);
  const [lvl,setLvl]=useState("all");
  const [loading,setLoad]=useState(true);
  const [profile,setPr]=useState(null);
  // Уровень пользователя — хранится в localStorage, не в облаке
  const [userLevel,setUserLevel]=useState(()=>localStorage.getItem("bw_user_level")||"");
  const [cph,cps]=usePress(0.97);

  const load=useCallback(async()=>{
    const [ws,rs,pr]=await Promise.all([db.getW(),db.getR(),db.getP()]);
    setWS(ws);setHist([...rs].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)));setPr(pr);setLoad(false);
  },[]);

  useEffect(()=>{load();window.addEventListener("focus",load);return()=>window.removeEventListener("focus",load);},[load]);

  const chooseLevel=(l)=>{
    localStorage.setItem("bw_user_level",l);
    setUserLevel(l);
  };

  const startProg=async(prog)=>{
    const ex=workouts.find(w=>w.id===prog.id);
    if(ex){navigate("workout",ex.id);return;}
    const w={id:prog.id,name:prog.name,intervals:prog.iv.map(iv=>({...iv,id:uid()}))};
    await db.saveW(w);navigate("workout",w.id);
  };
  const delW=async(id)=>{await db.delW(id);load();};
  const delR=async(id)=>{await db.delR(id);load();};

  const filtered=lvl==="all"?PROGS:PROGS.filter(p=>p.level===lvl);
  const firstName=(profile?.name||TG_USER?.first_name||"").trim().split(" ")[0];
  const addedIds=new Set(workouts.filter(w=>PROG_IDS.has(w.id)).map(w=>w.id));
  const myWorkouts=workouts.filter(w=>!PROG_IDS.has(w.id));
  const myProgs=workouts.filter(w=>PROG_IDS.has(w.id));
  const hasMyStuff=myWorkouts.length>0||myProgs.length>0;

  // Рекомендации: фильтруем по уровню пользователя
  const recoProgs = userLevel
    ? PROGS.filter(p=>p.level===userLevel)
    : PROGS.slice(0,4);

  if(loading) return <Loader/>;

  return <Page>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
      <div style={{fontSize:28,fontWeight:300,lineHeight:1.1}}>{firstName?`Привет,\u00A0${firstName}!`:"Тренировки"}</div>
      <button onClick={()=>navigate("profile")} style={{width:42,height:42,borderRadius:"50%",background:tg?"rgba(74,222,128,0.1)":C.surface,border:`1px solid ${tg?"rgba(74,222,128,0.25)":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:tg?C.green:C.text,flexShrink:0}}>
        <I.User size={18}/>
      </button>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:12,padding:3,marginBottom:22,gap:2}}>
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.18s",background:tab===t.id?"rgba(255,255,255,0.1)":"transparent",color:tab===t.id?"#fff":C.muted}}>
          {t.icon}{t.l}
        </button>
      ))}
    </div>

    {/* ══ МОИ ══ */}
    {tab==="my"&&<>
      {/* Кнопка создать */}
      <button onClick={()=>navigate("create")} {...cph}
        style={{...cps,width:"100%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:14,padding:"15px 18px",cursor:"pointer",marginBottom:22,display:"flex",alignItems:"center",gap:12,boxShadow:"0 6px 20px rgba(74,222,128,0.2)"}}>
        <div style={{width:30,height:30,background:"rgba(0,0,0,0.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}><I.Plus size={17} style={{color:"#000"}}/></div>
        <span style={{fontSize:16,fontWeight:700,color:"#000"}}>Создать тренировку</span>
      </button>

      {/* Мои тренировки — если есть */}
      {myWorkouts.length>0&&<>
        <SectionHeader title="Мои тренировки"/>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {myWorkouts.map(w=><WCard key={w.id} workout={w} onStart={()=>navigate("workout",w.id)} onEdit={()=>navigate("edit",w.id)} onDelete={()=>delW(w.id)}/>)}
        </div>
      </>}

      {/* Сохранённые программы — если есть */}
      {myProgs.length>0&&<>
        <SectionHeader title="Сохранённые программы"/>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {myProgs.map(w=><WCard key={w.id} workout={w} onStart={()=>navigate("workout",w.id)} onEdit={()=>{}} onDelete={()=>delW(w.id)}/>)}
        </div>
      </>}

      {/* Рекомендации — всегда показываем */}
      {!userLevel
        ? <LevelPicker onSelect={chooseLevel}/>
        : <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:17,fontWeight:600,color:"#fff"}}>Рекомендации</div>
              <button onClick={()=>chooseLevel("")} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                {({beginner:"Новичок",intermediate:"Опытный",pro:"Профи"})[userLevel]} <span style={{color:C.sub}}>· изменить</span>
              </button>
            </div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6,marginBottom:24,scrollbarWidth:"none"}}>
              {recoProgs.map(p=><RecoCard key={p.id} prog={p} onStart={startProg}/>)}
            </div>
          </>
      }

      {/* История — последние 3 */}
      {history.length>0&&<>
        <SectionHeader title="История"/>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {history.slice(0,3).map(r=><LastResultCard key={r.id} result={r} onClick={()=>navigate("details",r.id)}/>)}
          {history.length>3&&<button onClick={()=>setTab("history")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px",color:C.sub,fontSize:13,cursor:"pointer",textAlign:"center"}}>
            Показать всю историю ({history.length})
          </button>}
        </div>
      </>}
    </>}

    {/* ══ ПРОГРАММЫ ══ */}
    {tab==="programs"&&<>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {[["all","Все"],["beginner","Новичок"],["intermediate","Опытный"],["pro","Профи"]].map(([v,l])=>(
          <button key={v} onClick={()=>setLvl(v)} style={{padding:"6px 14px",borderRadius:16,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,transition:"all 0.18s",background:lvl===v?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.05)",color:lvl===v?"#fff":C.sub}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>{filtered.map(p=><PCard key={p.id} prog={p} onUse={startProg} added={addedIds.has(p.id)}/>)}</div>
    </>}

    {/* ══ ИСТОРИЯ ══ */}
    {tab==="history"&&(history.length>0
      ?<div style={{display:"flex",flexDirection:"column",gap:8}}>{history.map(r=><HistCard key={r.id} result={r} onClick={()=>navigate("details",r.id)} onDelete={()=>delR(r.id)}/>)}</div>
      :<div style={{textAlign:"center",padding:"48px 0",color:C.muted}}>
        <div style={{fontSize:44,marginBottom:12}}>📋</div>
        <div style={{fontSize:17,marginBottom:6}}>История пуста</div>
        <div style={{fontSize:14}}>Завершите первую тренировку</div>
      </div>
    )}
  </Page>;
}

// ─── CREATE / EDIT ────────────────────────────────────────────────────────────
function CreatePage({navigate,editId}) {
  const [name,setName]=useState("");
  const [intervals,setIV]=useState([]);
  const [loading,setLoad]=useState(!!editId);

  useEffect(()=>{(async()=>{
    if(editId){const w=await db.getWById(editId);if(w){setName(w.name);setIV(w.intervals?.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration}))||[]);}}
    else setIV([{id:uid(),t:"slow",type:"slow",d:180,duration:180},{id:uid(),t:"fast",type:"fast",d:60,duration:60},{id:uid(),t:"slow",type:"slow",d:120,duration:120}]);
    setLoad(false);
  })();},[editId]);

  const total=intervals.reduce((s,i)=>s+(i.d||0),0);
  const save=async()=>{
    if(!name.trim()){alert("Введите название");return;}
    if(!intervals.length){alert("Добавьте интервал");return;}
    await db.saveW({id:editId||uid(),name:name.trim(),intervals});
    navigate("home");
  };

  const handleChange=arr=>setIV(arr.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration,type:iv.t||iv.type,duration:iv.d||iv.duration})));

  if(loading) return <Loader/>;

  return <Page>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
      <IconBtn onClick={()=>navigate("home")}><I.Back size={18}/></IconBtn>
      <div style={{fontSize:19,fontWeight:500,flex:1}}>{editId?"Редактировать":"Создать тренировку"}</div>
    </div>

    <div style={{marginBottom:18}}>
      <div style={{fontSize:11,color:C.sub,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Название</div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Моя тренировка"
        style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:12,color:"#fff",fontSize:15,padding:"12px 14px",outline:"none",boxSizing:"border-box"}}/>
    </div>

    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:C.sub,letterSpacing:"0.07em",textTransform:"uppercase"}}>Интервалы</div>
        {total>0&&<div style={{fontSize:12,color:C.muted}}>{fmtD(total)}</div>}
      </div>
      {intervals.length>0&&<div style={{marginBottom:10}}><IvBar intervals={intervals} h={5}/></div>}
      <div style={{fontSize:11,color:C.muted,marginBottom:12}}>Зажмите номер и тащите · Свайп влево — удалить · Нажмите время — изменить</div>
      <SortList intervals={intervals} onChange={handleChange}/>
      <button onClick={()=>setIV(p=>[...p,{id:uid(),t:"medium",type:"medium",d:60,duration:60}])}
        style={{width:"100%",background:"transparent",border:`2px dashed ${C.border}`,borderRadius:12,color:C.muted,fontSize:13,padding:"13px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"border-color 0.2s,color 0.2s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(250,204,21,0.4)";e.currentTarget.style.color=C.yellow;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>
        <I.Plus size={15}/>Добавить интервал
      </button>
    </div>
    <GreenBtn onClick={save}>Сохранить тренировку</GreenBtn>
  </Page>;
}

// ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────────
function ActivePage({navigate,workoutId}) {
  const [workout,setWO]=useState(null);
  const [phase,setPhase]=useState("ready");
  const [cd,setCd]=useState(3);
  const [ivIdx,setIdx]=useState(0);
  const [tLeft,setTL]=useState(0);
  const [elapsed,setEl]=useState(0);
  const timer=useRef(null);
  const ivRef=useRef(0),woRef=useRef(null);
  const ivStartTs=useRef(null),ivInitDur=useRef(0),wStartTs=useRef(null);

  const [pph,pps]=usePress(0.93);
  const [sph,sps]=usePress(0.93);

  useEffect(()=>{(async()=>{
    const w=await db.getWById(workoutId);
    if(!w){navigate("home");return;}
    // Normalize intervals
    w.intervals=w.intervals?.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration}));
    setWO(w);woRef.current=w;

    const saved=loadTimer();
    if(saved&&saved.workoutId===workoutId&&saved.phase==="running"){
      const now=Date.now();
      const passedInIv=Math.floor((now-saved.ivStartTs)/1000);
      const rem=Math.max(0,saved.ivInitDur-passedInIv);
      const totalEl=Math.floor((now-saved.wStartTs)/1000);
      ivRef.current=saved.ivIdx;
      ivStartTs.current=saved.ivStartTs;
      ivInitDur.current=saved.ivInitDur;
      wStartTs.current=saved.wStartTs;
      setIdx(saved.ivIdx);setEl(totalEl);setTL(rem);setPhase("running");
    } else {
      setTL(w.intervals?.[0]?.d||0);
    }
  })();},[workoutId]);

  // Countdown
  useEffect(()=>{
    if(phase!=="countdown") return;
    if(cd<=0){
      const dur=woRef.current.intervals[0].d;
      ivStartTs.current=Date.now();ivInitDur.current=dur;wStartTs.current=Date.now();
      setTL(dur);setPhase("running");return;
    }
    const t=setTimeout(()=>setCd(c=>c-1),1000);return()=>clearTimeout(t);
  },[phase,cd]);

  // Timer based on real time
  useEffect(()=>{
    if(phase!=="running"||!woRef.current) return;
    const tick=()=>{
      const now=Date.now();
      const passedInIv=Math.floor((now-ivStartTs.current)/1000);
      const rem=Math.max(0,ivInitDur.current-passedInIv);
      const totalEl=Math.floor((now-(wStartTs.current||now))/1000);
      setEl(totalEl);setTL(rem);
      saveTimer({workoutId:woRef.current.id,phase:"running",ivIdx:ivRef.current,ivStartTs:ivStartTs.current,ivInitDur:ivInitDur.current,wStartTs:wStartTs.current});
      if(rem<=0){
        const next=ivRef.current+1;
        if(next<woRef.current.intervals.length){
          ivRef.current=next;
          ivStartTs.current=Date.now();
          ivInitDur.current=woRef.current.intervals[next].d;
          setIdx(next);
        } else {
          clearInterval(timer.current);clearTimer();setPhase("done");
          const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:totalEl,completedIntervals:woRef.current.intervals.length,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
          db.saveR(r).then(()=>setTimeout(()=>navigate("results",r.id),400));
        }
      }
    };
    timer.current=setInterval(tick,500);return()=>clearInterval(timer.current);
  },[phase,ivIdx]);

  const playPause=()=>{
    if(phase==="ready"){setCd(3);setPhase("countdown");}
    else if(phase==="running"){clearInterval(timer.current);clearTimer();setPhase("paused");}
    else if(phase==="paused"){
      ivStartTs.current=Date.now()-(ivInitDur.current-tLeft)*1000;
      setPhase("running");
    }
  };

  const stop=async()=>{
    clearInterval(timer.current);clearTimer();
    if(phase==="ready"){navigate("home");return;}
    const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elapsed,completedIntervals:ivRef.current,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
    await db.saveR(r);navigate("results",r.id);
  };

  if(!workout) return <Loader/>;
  const curr=workout.intervals[ivIdx];
  const next=workout.intervals[ivIdx+1];
  const nc=next?IV[next.t]:null;
  const cfg=IV[curr.t]||IV.slow;
  const isLast=ivIdx===workout.intervals.length-1;
  const isWarn=tLeft<=5&&phase==="running";

  const R=128,circ=2*Math.PI*R;
  const prog=curr.d>0?tLeft/curr.d:0;
  const color=isWarn?"#ef4444":cfg.color;
  const glow=isWarn?"rgba(239,68,68,0.5)":cfg.glow;

  return (
    <div style={{height:"100vh",background:"linear-gradient(170deg,#08080f 0%,#0d1117 60%,#060608 100%)",color:"#fff",display:"flex",flexDirection:"column",paddingTop:SAFE_TOP_CSS,boxSizing:"border-box",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontSize:15,fontWeight:500}}>{workout.name}</div>
          <div style={{fontSize:11,color:C.sub,marginTop:1}}>Интервал {ivIdx+1} из {workout.intervals.length}</div>
        </div>
        <IconBtn onClick={stop} style={{background:"rgba(255,255,255,0.05)"}}><I.X size={18}/></IconBtn>
      </div>
      {/* Thin progress bar */}
      <div style={{margin:"8px 16px 0",height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,flexShrink:0,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${((ivIdx)/workout.intervals.length)*100}%`,background:cfg.color,borderRadius:2,transition:"width 0.6s ease"}}/>
      </div>
      {/* Timer */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 20px",minHeight:0}}>
        {phase==="countdown"
          ?<div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:C.sub,marginBottom:14,letterSpacing:"0.14em"}}>ПРИГОТОВЬТЕСЬ</div>
            <div style={{fontSize:120,fontWeight:100,lineHeight:1,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{cd||"GO!"}</div>
          </div>
          :<div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
            {/* Timer ring */}
            {(()=>{
              const Rr=118,cr=2*Math.PI*Rr,pr=curr.d>0?tLeft/curr.d:0;
              const col=isWarn?"#ef4444":cfg.color,gl=isWarn?"rgba(239,68,68,0.5)":cfg.glow;
              return (
                <div style={{position:"relative",width:268,height:268,flexShrink:0}}>
                  <svg width={268} height={268} style={{transform:"rotate(-90deg)"}}>
                    <circle cx={134} cy={134} r={Rr} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={18}/>
                    <circle cx={134} cy={134} r={Rr} fill="none" stroke={col} strokeWidth={18} strokeLinecap="round"
                      strokeDasharray={cr} strokeDashoffset={cr*(1-pr)}
                      style={{transition:"stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1),stroke 0.4s",filter:`drop-shadow(0 0 22px ${gl})`}}/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:30,marginBottom:4}}>{cfg.emoji}</div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:col,marginBottom:8}}>{cfg.label}</div>
                    <div style={{fontSize:66,fontWeight:100,fontVariantNumeric:"tabular-nums",lineHeight:1,letterSpacing:"-0.03em"}}>{fmtT(tLeft)}</div>
                  </div>
                </div>
              );
            })()}
            {/* Stats */}
            <div style={{display:"flex",gap:10,marginTop:16,width:"100%",maxWidth:268}}>
              {[
                {label:"ПРОШЛО", val:fmtT(elapsed), accent:false},
                {label:"ИНТЕРВАЛ", val:`${ivIdx+1}/${workout.intervals.length}`, accent:true},
                {label:"ОСТАЛОСЬ", val:fmtT(Math.max(0,workout.intervals.slice(ivIdx).reduce((s,i)=>s+i.d,0)-ivInitDur.current+tLeft)), accent:false},
              ].map((s,i)=>(
                <div key={i} style={{flex:1,background:s.accent?`${cfg.color}12`:"rgba(255,255,255,0.05)",border:s.accent?`1px solid ${cfg.color}25`:"none",borderRadius:12,padding:"9px 8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:"0.1em",marginBottom:3}}>{s.label}</div>
                  <div style={{fontSize:16,fontWeight:300,color:s.accent?cfg.color:"#fff",fontVariantNumeric:"tabular-nums"}}>{s.val}</div>
                </div>
              ))}
            </div>
            {/* Next/Pause/Finish */}
            <div style={{height:40,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginTop:10}}>
              {phase==="paused"
                ?<div style={{fontSize:12,color:C.sub,letterSpacing:"0.12em"}}>⏸ ПАУЗА</div>
                :next
                  ?<div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.muted,marginBottom:2,letterSpacing:"0.1em"}}>СЛЕДУЮЩИЙ</div><div style={{fontSize:13,color:nc?.color||"#fff",fontWeight:500}}>{nc?.emoji} {nc?.label} — {fmtT(next.d)}</div></div>
                  :<div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.muted,marginBottom:2,letterSpacing:"0.1em"}}>ДАЛЬШЕ</div><div style={{fontSize:13,color:C.green,fontWeight:500}}>🏁 Финиш!</div></div>
              }
            </div>
            {/* Dots */}
            <div style={{display:"flex",gap:3,marginTop:8,alignItems:"center",flexWrap:"wrap",justifyContent:"center",maxWidth:250}}>
              {workout.intervals.map((_,i)=>(
                <div key={i} style={{height:4,width:i===ivIdx?18:i<ivIdx?10:7,borderRadius:2,background:i<ivIdx?IV[workout.intervals[i].t]?.color||C.green:i===ivIdx?"#fff":"rgba(255,255,255,0.1)",transition:"all 0.4s cubic-bezier(0.4,0,0.2,1)"}}/>
              ))}
            </div>
          </div>
        }
      </div>
      {/* Controls */}
      {phase!=="countdown"&&(
        <div style={{flexShrink:0,padding:"14px 20px",paddingBottom:"max(20px,env(safe-area-inset-bottom,20px))",display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
          <button onClick={stop} {...sph} style={{...sps,width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:`1px solid rgba(255,255,255,0.1)`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}>
            <I.Stop size={19}/>
          </button>
          <button onClick={playPause} {...pph} style={{...pps,width:78,height:78,borderRadius:"50%",background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:`0 0 36px ${cfg.glow}`,color:"#000"}}>
            {phase==="running"?<I.Pause size={27}/>:<I.Play size={27}/>}
          </button>
          <div style={{width:52,textAlign:"center"}}>
            <div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:"0.1em"}}>ТЕМП</div>
            <div style={{fontSize:20}}>{cfg.emoji}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  const [ph,ps]=usePress();
  useEffect(()=>{db.getRById(resultId).then(r=>{if(!r)navigate("home");else setR(r);});},[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px"}}>
      <div style={{width:100,height:100,borderRadius:"50%",background:done?"linear-gradient(135deg,#4ade80,#22d3ee)":"linear-gradient(135deg,#fb923c,#f43f5e)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:done?"0 0 48px rgba(74,222,128,0.35)":"0 0 48px rgba(251,146,60,0.35)",marginBottom:20,animation:"scaleIn 0.45s cubic-bezier(0.34,1.56,0.64,1)"}}>
        {done?<I.Trophy size={46} style={{color:"#000"}}/>:<I.Target size={40} style={{color:"#fff"}}/>}
      </div>
      <div style={{fontSize:28,fontWeight:300,marginBottom:6,textAlign:"center",animation:"slideUp 0.3s 0.1s ease both"}}>{done?"Отличная работа!":"Тренировка завершена"}</div>
      <div style={{color:C.sub,marginBottom:28,textAlign:"center",fontSize:14,animation:"slideUp 0.3s 0.15s ease both"}}>{done?"Все интервалы выполнены":"Результат сохранён"}</div>
      <div style={{width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
        {[
          {icon:<I.Zap size={18} style={{color:C.green}} fill={C.green}/>,bg:"rgba(74,222,128,0.08)",brd:"rgba(74,222,128,0.18)",label:"Тренировка",val:result.workoutName,vc:C.green},
          {icon:<I.Clock size={18} style={{color:C.cyan}}/>,bg:"rgba(255,255,255,0.03)",brd:C.border,label:"Время",val:fmtD(result.totalDuration),vc:"#fff"},
          {icon:<I.Target size={18} style={{color:"#a78bfa"}}/>,bg:"rgba(255,255,255,0.03)",brd:C.border,label:"Интервалы",val:`${result.completedIntervals} / ${result.totalIntervals}`,vc:"#fff"},
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,border:`1px solid ${s.brd}`,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,animation:`slideUp 0.3s ${0.18+i*0.07}s ease both`}}>
            <div style={{width:38,height:38,background:"rgba(255,255,255,0.05)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.icon}</div>
            <div><div style={{fontSize:10,color:C.muted,marginBottom:2}}>{s.label}</div><div style={{fontSize:16,fontWeight:500,color:s.vc}}>{s.val}</div></div>
          </div>
        ))}
      </div>
      <GreenBtn onClick={()=>navigate("home")} style={{maxWidth:380,...ps}} {...ph}>На главную</GreenBtn>
    </div>
  );
}

// ─── DETAILS ──────────────────────────────────────────────────────────────────
function DetailsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  const [ph,ps]=usePress();
  useEffect(()=>{db.getRById(resultId).then(r=>{if(!r)navigate("home");else setR(r);});},[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  const date=new Date(result.completedAt);
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,paddingTop:SAFE_TOP_CSS,paddingLeft:16,paddingRight:16,paddingBottom:24,boxSizing:"border-box",animation:"pageIn 0.2s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
        <IconBtn onClick={()=>navigate("home")}><I.Back size={18}/></IconBtn>
        <div style={{fontSize:18,fontWeight:500}}>Детали тренировки</div>
      </div>
      <div style={{textAlign:"center",padding:"16px 0 22px"}}>
        <div style={{fontSize:22,fontWeight:400,marginBottom:8,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{result.workoutName}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:done?C.green:"#fb923c",fontSize:13}}>
          {done?<I.Check size={14}/>:<I.Target size={14}/>}{done?"Завершено":"Частично завершено"}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {icon:<I.Cal size={18} style={{color:"#60a5fa"}}/>,bg:"rgba(96,165,250,0.1)",label:"Дата",val:<><div style={{fontSize:14}}>{date.toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"long"})}</div><div style={{color:C.sub,fontSize:12}}>{date.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></>},
          {icon:<I.Clock size={18} style={{color:C.green}}/>,bg:"rgba(74,222,128,0.1)",label:"Длительность",val:<div style={{fontSize:18}}>{fmtD(result.totalDuration)}</div>},
          {icon:<I.Target size={18} style={{color:"#a78bfa"}}/>,bg:"rgba(167,139,250,0.1)",label:"Интервалы",val:<><div style={{fontSize:18}}>{result.completedIntervals} из {result.totalIntervals}</div><div style={{display:"flex",gap:3,marginTop:6}}>{Array.from({length:result.totalIntervals}).map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<result.completedIntervals?C.green:"rgba(255,255,255,0.07)"}}/>)}</div></>},
        ].map((c,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:13,padding:"13px 14px",display:"flex",gap:12}}>
            <div style={{width:38,height:38,background:c.bg,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,marginBottom:4}}>{c.label}</div>{c.val}</div>
          </div>
        ))}
      </div>
      <GreenBtn onClick={()=>navigate("home")} style={{marginTop:20,...ps}} {...ph}>На главную</GreenBtn>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage] = useState(()=>{ const s=loadTimer(); return s?"workout":"home"; });
  const [param,setParam] = useState(()=>{ const s=loadTimer(); return s?s.workoutId:null; });
  const navigate = (to,p=null) => { setParam(p); setPage(to); window.scrollTo(0,0); };

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=`
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      body{margin:0;padding:0;background:#09090f;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;}
      ::-webkit-scrollbar{display:none;}
      @keyframes scaleIn{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    `;
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);

  if(page==="home")    return <HomePage    navigate={navigate}/>;
  if(page==="create")  return <CreatePage  navigate={navigate} editId={null}/>;
  if(page==="edit")    return <CreatePage  navigate={navigate} editId={param}/>;
  if(page==="workout") return <ActivePage  navigate={navigate} workoutId={param}/>;
  if(page==="results") return <ResultsPage navigate={navigate} resultId={param}/>;
  if(page==="details") return <DetailsPage navigate={navigate} resultId={param}/>;
  if(page==="profile") return <ProfilePage navigate={navigate}/>;
  return <HomePage navigate={navigate}/>;
}
