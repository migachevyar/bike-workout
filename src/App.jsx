import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.requestFullscreen) tg.requestFullscreen();
  if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  if (tg.setBottomBarColor) tg.setBottomBarColor("#0d0d0f");
  if (tg.setHeaderColor)    tg.setHeaderColor("#0d0d0f");
  if (tg.setBackgroundColor) tg.setBackgroundColor("#0d0d0f");
}

// Глобальный запрет случайного сворачивания — перехватываем все вертикальные свайпы вниз
// которые начались не в скроллируемом элементе
(function() {
  let startY = 0, startX = 0;
  document.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    // Если движение преимущественно вертикальное вниз — блокируем
    if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      // Разрешаем только если внутри скроллируемого контейнера
      const el = e.target.closest("[data-scrollable]");
      if (!el) { e.preventDefault(); return; }
      // Если скролл уже на верху — тоже блокируем
      if (el.scrollTop <= 0 && dy > 0) e.preventDefault();
    }
  }, { passive: false });
})();
const TG_USER = tg?.initDataUnsafe?.user || null;

// CSS переменная которую Telegram выставляет сам — высота его шапки
const ST  = "calc(var(--tg-content-safe-area-inset-top, 88px) + env(safe-area-inset-top, 0px))";
const SB  = "calc(env(safe-area-inset-bottom, 0px) + 60px)";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const cGet = k => new Promise(r => {
  if (tg?.CloudStorage) tg.CloudStorage.getItem(k,(e,v)=>r(e?null:v));
  else r(localStorage.getItem(k));
});
const cSet = (k,v) => new Promise(r => {
  if (tg?.CloudStorage) tg.CloudStorage.setItem(k,v,e=>r(!e));
  else { localStorage.setItem(k,v); r(true); }
});
const KEYS = { w:"ybw1", r:"ybr1", p:"ybp1", wt:"ybwt1" };
const db = {
  getW:     async()=>{ const d=await cGet(KEYS.w); try{return d?JSON.parse(d):[]}catch{return[]} },
  setW:     async l =>cSet(KEYS.w,JSON.stringify(l)),
  saveW:    async w =>{ const a=await db.getW(); const i=a.findIndex(x=>x.id===w.id); i!==-1?a[i]=w:a.push(w); await db.setW(a) },
  delW:     async id=>{ const a=await db.getW(); await db.setW(a.filter(w=>w.id!==id)) },
  getWById: async id=>{ const a=await db.getW(); return a.find(w=>w.id===id) },
  getR:     async()=>{ const d=await cGet(KEYS.r); try{return d?JSON.parse(d):[]}catch{return[]} },
  saveR:    async r =>{ const a=await db.getR(); a.push(r); await cSet(KEYS.r,JSON.stringify(a)) },
  delR:     async id=>{ const a=await db.getR(); await cSet(KEYS.r,JSON.stringify(a.filter(r=>r.id!==id))) },
  getRById: async id=>{ const a=await db.getR(); return a.find(r=>r.id===id) },
  getP:     async()=>{ const d=await cGet(KEYS.p); try{return d?JSON.parse(d):null}catch{return null} },
  saveP:    async p =>cSet(KEYS.p,JSON.stringify(p)),
  getWT:    async()=>{ const d=await cGet(KEYS.wt); try{return d?JSON.parse(d):[]}catch{return[]} },
  saveWT:   async l =>cSet(KEYS.wt,JSON.stringify(l)),
};

// ─── TIMER ────────────────────────────────────────────────────────────────────
const TK="ybti1";
const saveTimer  = s=>localStorage.setItem(TK,JSON.stringify(s));
const clearTimer = ()=>localStorage.removeItem(TK);
const loadTimer  = ()=>{ try{return JSON.parse(localStorage.getItem(TK))}catch{return null} };

// ─── PROGRAMS ─────────────────────────────────────────────────────────────────
// Иконки — тематические, не ядовитые, спортивные
const PROGS = [
  { id:"b1", iconType:"flame",  iconBg:"linear-gradient(135deg,#f97316,#c2410c)", name:"Сжигание жира",    dur:25, kcal:"250–300", level:"beginner",     ll:"Новичок",
    desc:"Мягкий вход. Пульс 60–70% — жиросжигающая зона.",
    iv:[{id:"b1a",t:"slow",d:300},{id:"b1b",t:"medium",d:120},{id:"b1c",t:"slow",d:180},{id:"b1d",t:"medium",d:120},{id:"b1e",t:"slow",d:180},{id:"b1f",t:"medium",d:120},{id:"b1g",t:"slow",d:480}] },
  { id:"i1", iconType:"zap",    iconBg:"linear-gradient(135deg,#3b82f6,#1d4ed8)", name:"HIIT Sprint",        dur:20, kcal:"300–400", level:"intermediate", ll:"Опытный",
    desc:"Чередование спринтов и восстановления. Разгоняет метаболизм на 24–48 ч.",
    iv:[{id:"i1w",t:"slow",d:300},...Array.from({length:7},(_,i)=>[{id:`i1f${i}`,t:"fast",d:30},{id:`i1r${i}`,t:"slow",d:90}]).flat(),{id:"i1c",t:"slow",d:300}] },
  { id:"p2", iconType:"heart",  iconBg:"linear-gradient(135deg,#a855f7,#7c3aed)", name:"Выносливость",       dur:30, kcal:"350–450", level:"pro",          ll:"Профи",
    desc:"VO2max — интервалы на уровне максимального потребления кислорода.",
    iv:[{id:"p2a",t:"slow",d:600},{id:"p2b",t:"medium",d:180},{id:"p2c",t:"fast",d:180},{id:"p2d",t:"medium",d:180},{id:"p2e",t:"fast",d:180},{id:"p2f",t:"medium",d:180},{id:"p2g",t:"fast",d:180},{id:"p2h",t:"medium",d:180},{id:"p2i",t:"fast",d:180},{id:"p2j",t:"medium",d:180},{id:"p2k",t:"slow",d:600}] },
  { id:"p1", iconType:"timer",  iconBg:"linear-gradient(135deg,#ef4444,#b91c1c)", name:"Табата",             dur:15, kcal:"200–250", level:"intermediate", ll:"Опытный",
    desc:"20 сек максимально, 10 сек отдыха. Научно доказан как лучший для жиросжигания.",
    iv:[{id:"p1w",t:"slow",d:180},...Array.from({length:8},(_,i)=>[{id:`p1f${i}`,t:"fast",d:20},{id:`p1r${i}`,t:"slow",d:10}]).flat(),{id:"p1m",t:"slow",d:120},...Array.from({length:8},(_,i)=>[{id:`p1g${i}`,t:"fast",d:20},{id:`p1s${i}`,t:"slow",d:10}]).flat(),{id:"p1c",t:"slow",d:180}] },
  { id:"b2", iconType:"bike",   iconBg:"linear-gradient(135deg,#06b6d4,#0e7490)", name:"Кардио старт",      dur:20, kcal:"180–220", level:"beginner",     ll:"Новичок",
    desc:"Равномерная нагрузка без скачков пульса. Идеально для начинающих.",
    iv:[{id:"b2a",t:"slow",d:240},{id:"b2b",t:"medium",d:240},{id:"b2c",t:"slow",d:120},{id:"b2d",t:"medium",d:240},{id:"b2e",t:"slow",d:120},{id:"b2f",t:"medium",d:240}] },
  { id:"i2", iconType:"trend",  iconBg:"linear-gradient(135deg,#22c55e,#15803d)", name:"Энергия",            dur:25, kcal:"400–500", level:"pro",          ll:"Профи",
    desc:"Пирамида нагрузок. Нарастание и спад — для максимальной аэробной мощности.",
    iv:[{id:"i2a",t:"slow",d:300},{id:"i2b",t:"medium",d:120},{id:"i2c",t:"fast",d:60},{id:"i2d",t:"medium",d:120},{id:"i2e",t:"fast",d:90},{id:"i2f",t:"medium",d:120},{id:"i2g",t:"fast",d:120},{id:"i2h",t:"medium",d:120},{id:"i2i",t:"fast",d:90},{id:"i2j",t:"medium",d:120},{id:"i2k",t:"fast",d:60},{id:"i2l",t:"medium",d:120},{id:"i2m",t:"slow",d:300}] },
];
const PROG_IDS = new Set(PROGS.map(p=>p.id));

// ─── INTERVAL CONFIG ──────────────────────────────────────────────────────────
const IV = {
  slow:   { label:"Медленно", emoji:"🐢", color:"#4ade80" },
  medium: { label:"Средне",   emoji:"🚴", color:"#facc15" },
  fast:   { label:"Спринт",   emoji:"⚡", color:"#f87171" },
};

const LEVEL_COLOR = { beginner:"#4ade80", intermediate:"#facc15", pro:"#f87171" };
const LEVEL_LABEL = { beginner:"Новичок", intermediate:"Опытный", pro:"Профи" };

// ─── UTILS ────────────────────────────────────────────────────────────────────
const uid  = ()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtD = s=>{ const m=Math.floor(s/60),sec=s%60; if(m&&sec)return`${m} мин ${sec} сек`; if(m)return`${m} мин`; return`${sec} сек` };
const fmtT = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

// ─── COLORS ───────────────────────────────────────────────────────────────────
const BG    = "#0d0d0f";
const CARD  = "#161618";
const CARD2 = "#1c1c1f";
const LINE  = "#2a2a2e";
const TXT   = "#f4f4f5";
const SUB   = "#71717a";
const MUTED = "#3f3f46";
const BLUE  = "#3b82f6";
const ACCENT= "#3b82f6";

// ─── HAPTIC ───────────────────────────────────────────────────────────────────
const haptic=(type='light')=>{
  if(!tg?.HapticFeedback)return;
  if(type==='success')tg.HapticFeedback.notificationOccurred('success');
  else if(type==='warning')tg.HapticFeedback.notificationOccurred('warning');
  else if(type==='heavy')tg.HapticFeedback.impactOccurred('heavy');
  else if(type==='medium')tg.HapticFeedback.impactOccurred('medium');
  else tg.HapticFeedback.impactOccurred('light');
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function usePress(scale=0.96) {
  const [p,setP]=useState(false);
  return [
    {onPointerDown:()=>setP(true),onPointerUp:()=>setP(false),onPointerLeave:()=>setP(false)},
    {transform:p?`scale(${scale})`:"scale(1)",transition:"transform 0.1s ease"},
  ];
}

function useCountUp(target,duration=1100,delay=0){
  const [val,setVal]=useState(0);
  useEffect(()=>{
    let raf,timeout;
    const start=()=>{
      const t0=Date.now();
      const tick=()=>{
        const p=Math.min((Date.now()-t0)/duration,1);
        const e=1-Math.pow(1-p,3);
        setVal(Math.round(e*target));
        if(p<1)raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
    };
    timeout=setTimeout(start,delay);
    return()=>{cancelAnimationFrame(raf);clearTimeout(timeout);};
  },[target,delay]);
  return val;
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti({active}){
  const ref=useRef(null);
  useEffect(()=>{
    if(!active||!ref.current)return;
    const cv=ref.current, ctx=cv.getContext('2d');
    cv.width=window.innerWidth; cv.height=window.innerHeight;
    const COLORS=['#3b82f6','#f97316','#a855f7','#22c55e','#facc15','#ef4444','#06b6d4','#f472b6'];
    const ps=Array.from({length:140},()=>({
      x:Math.random()*cv.width, y:-20-Math.random()*120,
      vx:(Math.random()-0.5)*5, vy:1.5+Math.random()*4,
      color:COLORS[Math.floor(Math.random()*COLORS.length)],
      w:5+Math.random()*7, h:3+Math.random()*5,
      rot:Math.random()*360, rv:(Math.random()-0.5)*9,
      alpha:1,
    }));
    let raf; const t0=Date.now();
    const draw=()=>{
      const elapsed=Date.now()-t0;
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.rot+=p.rv;
        p.alpha=elapsed<1800?1:Math.max(0,1-(elapsed-1800)/900);
        ctx.save(); ctx.globalAlpha=p.alpha;
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,2); ctx.fill();
        ctx.restore();
      });
      if(elapsed<2800)raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(raf);
  },[active]);
  if(!active)return null;
  return <canvas ref={ref} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9999}}/>;
}

// Большой заполненный плэй — скруглённые углы, оптически центрован
const BigPlay = ({size=22,color="#fff"})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 4.8C6 3.7 7.2 3 8.1 3.6L20.1 10.8C21 11.4 21 12.6 20.1 13.2L8.1 20.4C7.2 21 6 20.3 6 19.2V4.8Z" fill={color} stroke="none"/>
  </svg>
);
function AnimNum({target,suffix="",style={}}){
  const v=useCountUp(target,900,0);
  return <div style={style}>{v.toLocaleString("ru-RU")}{suffix}</div>;
}
function StatGridCard({label,num,sub,delay}){
  const v=useCountUp(num,900,delay);
  return (
    <div style={{background:CARD,borderRadius:16,padding:"16px",animation:`statIn 0.4s ease ${delay}ms both`}}>
      <div style={{fontSize:12,color:SUB,marginBottom:8,lineHeight:1.3}}>{label}</div>
      <div style={{fontSize:26,fontWeight:700}}>{v.toLocaleString("ru-RU")}</div>
      <div style={{fontSize:13,color:MUTED}}>{sub}</div>
    </div>
  );
}
const Svg=({size=20,children,...p})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>;
const I={
  Back:   p=><Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7"/></Svg>,
  X:      p=><Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>,
  Plus:   p=><Svg {...p}><path d="M12 5v14M5 12h14"/></Svg>,
  Trash:  p=><Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></Svg>,
  Edit:   p=><Svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>,
  User:   p=><Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></Svg>,
  Play:   p=><svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" style={p.style}><path d="M6 4.8C6 3.7 7.2 3 8.1 3.6L20.1 10.8C21 11.4 21 12.6 20.1 13.2L8.1 20.4C7.2 21 6 20.3 6 19.2V4.8Z" fill={p.fill||"currentColor"} stroke="none"/></svg>,
  Pause:  p=><svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Stop:   p=><svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Check:  p=><Svg {...p}><path d="M20 6 9 17l-5-5"/></Svg>,
  Clock:  p=><Svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Svg>,
  Bar:    p=><Svg {...p}><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></Svg>,
  Trophy: p=><Svg {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></Svg>,
  Target: p=><Svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></Svg>,
  Flag:   p=><Svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></Svg>,
  Cal:    p=><Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>,
  Zap:    p=><Svg {...p} fill={p.fill||"none"}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></Svg>,
  Weight: p=><Svg {...p}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></Svg>,
  Refresh:p=><Svg {...p}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Svg>,
  Camera: p=><Svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></Svg>,
  Flame:  p=><Svg {...p}><path d="M12 2s-5 6.5-5 10.5a5 5 0 0 0 10 0C17 8.5 12 2 12 2zm0 13.5a2 2 0 0 1-2-2c0-1.5 2-4 2-4s2 2.5 2 4a2 2 0 0 1-2 2z" fill="currentColor" stroke="none"/></Svg>,
  Bike:   p=><Svg {...p}><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17l3-8 3 3h-3l-3 5"/><path d="M18 17l-3-8H9"/><circle cx="15" cy="6" r="1" fill="currentColor"/></Svg>,
  Heart:  p=><Svg {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" stroke="none"/></Svg>,
  Timer:  p=><Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M10 2h4"/></Svg>,
  Trend:  p=><Svg {...p}><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></Svg>,
  Star:   p=><Svg {...p}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="currentColor" stroke="none"/></Svg>,
  Dumbbell:p=><Svg {...p}><path d="M6 4v16M18 4v16M8 8h8M8 16h8"/><circle cx="4" cy="8" r="2" fill="currentColor"/><circle cx="4" cy="16" r="2" fill="currentColor"/><circle cx="20" cy="8" r="2" fill="currentColor"/><circle cx="20" cy="16" r="2" fill="currentColor"/></Svg>,
  Run:    p=><Svg {...p}><circle cx="12" cy="4" r="2" fill="currentColor"/><path d="M14.5 8.5L17 12l-3 1-2-4.5"/><path d="M9 12l-2 5h5l1-3"/><path d="M12 7l-2 5 2 2"/></Svg>,
  Mountain:p=><Svg {...p}><polyline points="23,21 1,21"/><polyline points="9,21 12,8 20,21"/><polyline points="2,21 9,21 5,14"/></Svg>,
  Shield: p=><Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" stroke="none" fillOpacity="0.8"/></Svg>,
  Sun:    p=><Svg {...p}><circle cx="12" cy="12" r="5" fill="currentColor"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Svg>,
  Award:  p=><Svg {...p}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></Svg>,
  Wind:   p=><Svg {...p}><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></Svg>,
  Diamond:p=><Svg {...p}><polyline points="6,3 18,3 22,9 12,22 2,9" fill="currentColor" stroke="none" fillOpacity="0.85"/></Svg>,
};

// ─── PROGRAM ICON ─────────────────────────────────────────────────────────────
const PRESET_ICON_MAP = {
  b1:{type:"flame",bg:"linear-gradient(135deg,#f97316,#c2410c)"},
  i1:{type:"zap",  bg:"linear-gradient(135deg,#3b82f6,#1d4ed8)"},
  p2:{type:"heart",bg:"linear-gradient(135deg,#a855f7,#7c3aed)"},
  p1:{type:"timer",bg:"linear-gradient(135deg,#ef4444,#b91c1c)"},
  b2:{type:"bike", bg:"linear-gradient(135deg,#06b6d4,#0e7490)"},
  i2:{type:"trend",bg:"linear-gradient(135deg,#22c55e,#15803d)"},
};
const CUSTOM_ICON_LIST = [
  {type:"star",    bg:"linear-gradient(135deg,#f59e0b,#d97706)"},
  {type:"dumbbell",bg:"linear-gradient(135deg,#6b7280,#374151)"},
  {type:"run",     bg:"linear-gradient(135deg,#10b981,#059669)"},
  {type:"mountain",bg:"linear-gradient(135deg,#64748b,#334155)"},
  {type:"shield",  bg:"linear-gradient(135deg,#06b6d4,#0284c7)"},
  {type:"sun",     bg:"linear-gradient(135deg,#f59e0b,#ea580c)"},
  {type:"award",   bg:"linear-gradient(135deg,#8b5cf6,#6d28d9)"},
  {type:"wind",    bg:"linear-gradient(135deg,#38bdf8,#0ea5e9)"},
  {type:"diamond", bg:"linear-gradient(135deg,#ec4899,#be185d)"},
  {type:"target",  bg:"linear-gradient(135deg,#a855f7,#9333ea)"},
];
const ICON_COMP_MAP = {
  flame:I.Flame, zap:I.Zap, heart:I.Heart, timer:I.Timer, bike:I.Bike, trend:I.Trend,
  star:I.Star, dumbbell:I.Dumbbell, run:I.Run, mountain:I.Mountain, shield:I.Shield,
  sun:I.Sun, award:I.Award, wind:I.Wind, diamond:I.Diamond, target:I.Target,
};
function ProgSvgIcon({id, iconType, size=50}) {
  // For preset programs, look up by id
  const preset = PRESET_ICON_MAP[id];
  // For custom, use iconType field or cycle through CUSTOM_ICON_LIST
  let cfg;
  if (preset) {
    cfg = preset;
  } else if (iconType && CUSTOM_ICON_LIST.find(c=>c.type===iconType)) {
    cfg = CUSTOM_ICON_LIST.find(c=>c.type===iconType);
  } else {
    // Deterministic fallback based on id string
    const hash = (id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
    cfg = CUSTOM_ICON_LIST[hash % CUSTOM_ICON_LIST.length];
  }
  const IconComp = ICON_COMP_MAP[cfg.type] || I.Star;
  return (
    <div style={{width:size,height:size,borderRadius:14,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <IconComp size={22} style={{color:"#fff"}} fill="#fff" stroke="#fff" strokeWidth={1.5}/>
    </div>
  );
}

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Loader=()=>(
  <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>⏱</div><div style={{color:SUB,fontSize:14}}>Загрузка...</div></div>
  </div>
);

const Page=({children,style={}})=>(
  <div data-scrollable="1" style={{minHeight:"100vh",background:BG,color:TXT,paddingTop:ST,paddingBottom:SB,boxSizing:"border-box",overflowY:"auto",...style}}>
    {children}
  </div>
);

function IvBar({intervals=[],h=4}) {
  const ivs=intervals.map(iv=>({t:iv.t||iv.type,d:iv.d||iv.duration||1}));
  if(!ivs.length) return null;
  return <div style={{display:"flex",gap:2,height:h,borderRadius:h/2,overflow:"hidden"}}>{ivs.map((iv,i)=><div key={i} style={{flex:iv.d,background:IV[iv.t]?.color||"#4ade80",minWidth:2}}/>)}</div>;
}

const Btn=({onClick,children,disabled,variant="primary",style={}})=>{
  const [ph,ps]=usePress(0.97);
  const [ripples,setRipples]=useState([]);
  const bg=disabled?"#27272a":variant==="primary"?BLUE:CARD2;
  const addRipple=e=>{
    if(disabled)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const id=Date.now();
    setRipples(r=>[...r,{id,x,y}]);
    setTimeout(()=>setRipples(r=>r.filter(r=>r.id!==id)),600);
    if(onClick)onClick(e);
  };
  return <button onClick={addRipple} disabled={disabled} {...ph} style={{width:"100%",background:bg,border:`1px solid ${disabled?"#27272a":variant==="primary"?BLUE:LINE}`,borderRadius:12,padding:"13px",color:disabled?MUTED:TXT,fontSize:14,fontWeight:600,cursor:disabled?"default":"pointer",position:"relative",overflow:"hidden",...ps,...style}}>
    {ripples.map(r=>(
      <span key={r.id} style={{position:"absolute",left:r.x,top:r.y,width:12,height:12,borderRadius:"50%",background:"rgba(255,255,255,0.35)",transform:"translate(-50%,-50%) scale(0)",animation:"ripple 0.55s ease-out forwards",pointerEvents:"none"}}/>
    ))}
    {children}
  </button>;
};

const RndBtn=({onClick,children,style={}})=>{
  const [ph,ps]=usePress(0.9);
  return <button onClick={onClick} {...ph} style={{width:38,height:38,borderRadius:"50%",background:CARD2,border:`1px solid ${LINE}`,display:"flex",alignItems:"center",justifyContent:"center",color:TXT,cursor:"pointer",flexShrink:0,...ps,...style}}>{children}</button>;
};

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({view,setView}) {
  const tabs=[
    {id:"home",   icon:<I.Play size={22}/>,  label:"Тренировки"},
    {id:"stats",  icon:<I.Bar size={22}/>,   label:"Статистика"},
    {id:"profile",icon:<I.User size={22}/>,  label:"Профиль"},
  ];
  return (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:BG,borderTop:`1px solid ${LINE}`,zIndex:100}}>
      <div style={{display:"flex",justifyContent:"space-around",padding:"10px 0 0"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px",background:"none",border:"none",cursor:"pointer",color:view===t.id?TXT:MUTED,transition:"color 0.18s"}}>
            <div style={{transition:"transform 0.18s",transform:view===t.id?"scale(1.1)":"scale(1)"}}>{t.icon}</div>
            <span style={{fontSize:11,fontWeight:view===t.id?600:400}}>{t.label}</span>
            {view===t.id&&<div style={{width:4,height:4,borderRadius:"50%",background:BLUE,marginTop:1}}/>}
          </button>
        ))}
      </div>
      {/* Полностью перекрываем зону home indicator */}
      <div style={{height:"max(env(safe-area-inset-bottom,34px),34px)",background:BG}}/>
    </nav>
  );
}

// ─── WHEEL PICKER ─────────────────────────────────────────────────────────────
function WheelCol({value,max,onChange,renderValue}) {
  const H=44, ref=useRef(null), settling=useRef(false), settleT=useRef(null);
  const scrollTo=useCallback((v,smooth=true)=>{ if(ref.current) ref.current.scrollTo({top:v*H,behavior:smooth?"smooth":"auto"}); },[]);
  useEffect(()=>{ scrollTo(value,false); },[]);
  const onScroll=()=>{
    if(settling.current||!ref.current)return;
    onChange(Math.max(0,Math.min(max,Math.round(ref.current.scrollTop/H))));
    clearTimeout(settleT.current);
    settleT.current=setTimeout(()=>{
      if(!ref.current)return;
      const i=Math.max(0,Math.min(max,Math.round(ref.current.scrollTop/H)));
      settling.current=true; scrollTo(i,true); onChange(i);
      setTimeout(()=>{ settling.current=false; },300);
    },80);
  };
  return (
    <div style={{position:"relative",flex:1,height:H*5,overflow:"hidden",borderRadius:10}}>
      <div ref={ref} data-scrollable="1" onScroll={onScroll} style={{height:"100%",overflowY:"scroll",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        <div style={{height:H*2}}/>
        {Array.from({length:max+1},(_,v)=>(
          <div key={v} onClick={()=>{onChange(v);scrollTo(v);}}
            style={{height:H,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:v===value?700:300,color:v===value?TXT:"rgba(255,255,255,0.18)",fontVariantNumeric:"tabular-nums",cursor:"pointer",userSelect:"none",transition:"all 0.1s"}}>
            {renderValue ? renderValue(v) : String(v).padStart(2,"0")}
          </div>
        ))}
        <div style={{height:H*2}}/>
      </div>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",background:`linear-gradient(to bottom,${BG} 0%,transparent 35%,transparent 65%,${BG} 100%)`,zIndex:2}}/>
      <div style={{position:"absolute",left:6,right:6,top:H*2,height:H,border:`1px solid ${ACCENT}44`,borderRadius:8,zIndex:1,pointerEvents:"none"}}/>
    </div>
  );
}

function DurPicker({duration,onChange,onClose}) {
  const [m,setM]=useState(Math.floor(duration/60));
  const [s,setS]=useState(duration%60);
  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:CARD,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px"}}>
        <div style={{width:36,height:4,background:MUTED,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{fontSize:16,fontWeight:600,marginBottom:20,textAlign:"center"}}>Длительность интервала</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <WheelCol value={m} max={99} onChange={setM}/>
          <div style={{fontSize:28,fontWeight:200,color:MUTED,flexShrink:0}}>:</div>
          <WheelCol value={s} max={59} onChange={setS}/>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <div style={{flex:1,textAlign:"center",color:SUB,fontSize:13}}>{m} мин</div>
          <div style={{flex:1,textAlign:"center",color:SUB,fontSize:13}}>{s} сек</div>
        </div>
        <Btn onClick={()=>{onChange(m*60+s);onClose();}} style={{marginTop:10}}>Готово</Btn>
      </div>
    </div>,
    document.body
  );
}

// ─── INTERVAL ROW ─────────────────────────────────────────────────────────────
function IvRow({iv,index,onChange,onDelete,dragHandle}) {
  const cfg=IV[iv.t||iv.type]||IV.slow;
  const dur=iv.d||iv.duration||0;
  const [po,setPO]=useState(false);
  const [open,setOpen]=useState(false), [tx,setTx]=useState(0);
  const sx=useRef(null),sy=useRef(null),isH=useRef(false),drag=useRef(false);
  const SLIDE=74;

  const onTS=e=>{ if(e.target.closest("[data-drag]"))return; sx.current=e.touches[0].clientX; sy.current=e.touches[0].clientY; isH.current=false; drag.current=false; };
  const onTM=e=>{
    if(e.target.closest("[data-drag]")||sx.current===null)return;
    const dx=e.touches[0].clientX-sx.current, dy=e.touches[0].clientY-sy.current;
    if(!drag.current){if(Math.abs(dx)<4&&Math.abs(dy)<4)return; isH.current=Math.abs(dx)>Math.abs(dy); drag.current=true;}
    if(!isH.current)return;
    e.preventDefault(); e.stopPropagation();
    setTx(Math.max(-SLIDE,Math.min(0,(open?-SLIDE:0)+dx)));
  };
  const onTE=()=>{ if(!drag.current||!isH.current){sx.current=null;return;} drag.current=false; const o=tx<-SLIDE/2; setOpen(o); setTx(o?-SLIDE:0); sx.current=null; };

  const upd=u=>{ const n={...iv,...u,t:u.type||iv.t,type:u.type||iv.t,d:u.duration||iv.d,duration:u.duration||iv.d}; onChange(n); };

  return (
    <div style={{position:"relative",marginBottom:8,borderRadius:14,overflow:"hidden"}}>
      {/* Delete zone */}
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:SLIDE-6,background:"linear-gradient(135deg,#7f1d1d,#991b1b)",borderRadius:"0 14px 14px 0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:0}}>
        <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onDelete,150)}}
          style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"0 14px",opacity:open?1:0,transform:open?"scale(1)":"scale(0.7)",transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <I.Trash size={16} style={{color:"#fff"}}/>
          </div>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:"0.05em"}}>Удалить</span>
        </button>
      </div>

      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{background:CARD2,border:`1px solid ${LINE}`,borderRadius:14,padding:"11px 12px",display:"flex",alignItems:"center",gap:8,transform:`translateX(${tx}px)`,transition:(drag.current&&isH.current)?"none":"transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",position:"relative",zIndex:1,userSelect:"none",touchAction:open?"none":"pan-y"}}>
        {/* Drag handle */}
        <div data-drag="1" {...dragHandle} style={{width:28,height:28,borderRadius:8,background:CARD,border:`1px solid ${LINE}`,display:"flex",alignItems:"center",justifyContent:"center",color:SUB,fontSize:12,fontWeight:700,cursor:"grab",flexShrink:0,touchAction:"none"}}>
          {index+1}
        </div>
        {/* Type */}
        <div style={{display:"flex",gap:3,flexShrink:0}}>
          {Object.entries(IV).map(([t,c])=>(
            <button key={t} onClick={()=>upd({type:t,duration:dur})}
              style={{width:32,height:32,borderRadius:9,border:"none",background:(iv.t||iv.type)===t?c.color+"22":"#27272a",outline:(iv.t||iv.type)===t?`1px solid ${c.color}55`:"none",fontSize:17,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {c.emoji}
            </button>
          ))}
        </div>
        {/* Label */}
        <div style={{flex:1,fontSize:13,fontWeight:600,color:cfg.color,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{cfg.label}</div>
        {/* Duration */}
        <button onClick={()=>setPO(true)} style={{background:CARD,border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 10px",color:TXT,fontSize:14,fontWeight:500,cursor:"pointer",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>
          {fmtT(dur)}
        </button>
      </div>
      {po&&<DurPicker duration={dur} onChange={d=>upd({type:iv.t||iv.type,duration:d})} onClose={()=>setPO(false)}/>}
    </div>
  );
}

// ─── SORTABLE LIST ────────────────────────────────────────────────────────────
function SortList({intervals,onChange}) {
  const [dragging,setDragging]=useState(null);
  const [overIdx,setOverIdx]=useState(null);
  const [dragY,setDragY]=useState(0);
  const itemRefs=useRef({});
  const startClientY=useRef(0);

  const startDrag=(idx,e)=>{
    e.stopPropagation();
    startClientY.current=e.touches[0].clientY;
    setDragging(idx); setOverIdx(idx); setDragY(0);
    haptic('light');
  };

  const onMove=useCallback(e=>{
    if(dragging===null)return;
    e.preventDefault();
    const dy=e.touches[0].clientY-startClientY.current;
    setDragY(dy);
    const y=e.touches[0].clientY;
    let best=dragging, bestDist=Infinity;
    intervals.forEach((iv,i)=>{
      const el=itemRefs.current[iv.id];
      if(!el||i===dragging)return;
      const rect=el.getBoundingClientRect();
      const mid=rect.top+rect.height/2;
      const dist=Math.abs(y-mid);
      if(dist<bestDist){bestDist=dist;best=i;}
    });
    setOverIdx(Math.max(0,Math.min(intervals.length-1,best)));
  },[dragging,intervals]);

  const onEnd=useCallback(()=>{
    if(dragging!==null&&overIdx!==null&&dragging!==overIdx){
      const arr=[...intervals],[item]=arr.splice(dragging,1);
      arr.splice(overIdx,0,item); onChange(arr);
    }
    setDragging(null); setOverIdx(null); setDragY(0);
  },[dragging,overIdx,intervals,onChange]);

  useEffect(()=>{
    if(dragging!==null){
      window.addEventListener("touchmove",onMove,{passive:false});
      window.addEventListener("touchend",onEnd);
      return()=>{window.removeEventListener("touchmove",onMove);window.removeEventListener("touchend",onEnd);};
    }
  },[dragging,onMove,onEnd]);

  let order=intervals.map((_,i)=>i);
  if(dragging!==null&&overIdx!==null&&dragging!==overIdx){
    order=[...order];const[item]=order.splice(dragging,1);order.splice(overIdx,0,item);
  }

  return (
    <div>
      {order.map((origIdx,dispIdx)=>{
        const iv=intervals[origIdx];
        const isDrag=dragging===origIdx;
        const isGap=overIdx===dispIdx&&dragging!==null&&!isDrag;
        return (
          <div key={iv.id} ref={el=>{itemRefs.current[iv.id]=el;}}
            style={{transform:isDrag?`translateY(${dragY}px) scale(1.02)`:isGap?"translateY(3px)":"translateY(0)",
              transition:isDrag?"none":"transform 0.18s ease",
              zIndex:isDrag?20:1,position:"relative",
              boxShadow:isDrag?"0 8px 32px rgba(0,0,0,0.6)":"none",
              opacity:isDrag?0.92:1}}>
            <IvRow iv={iv} index={dispIdx}
              onChange={u=>onChange(intervals.map((x,i)=>i===origIdx?u:x))}
              onDelete={()=>onChange(intervals.filter((_,i)=>i!==origIdx))}
              dragHandle={{onTouchStart:e=>{e.stopPropagation();startDrag(origIdx,e);}}}/>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROGRAM CARD (Figma style) ───────────────────────────────────────────────
function ProgCard({prog,onStart,added}) {
  const [ph,ps]=usePress(0.97);
  const [open,setOpen]=useState(false);
  const lc=LEVEL_COLOR[prog.level]||"#4ade80";

  return (
    <div style={{background:CARD,borderRadius:16,overflow:"hidden",marginBottom:10,animation:"slideUp 0.18s ease both"}}>
      {/* Main row */}
      <div {...ph} onClick={()=>setOpen(v=>!v)} style={{...ps,display:"flex",alignItems:"center",gap:12,padding:"14px",cursor:"pointer"}}>
        {/* Icon */}
        <ProgSvgIcon id={prog.id}/>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:4,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{prog.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{display:"flex",alignItems:"center",gap:4,color:SUB,fontSize:12}}><I.Clock size={11}/>{prog.dur} мин</span>
            <span style={{display:"flex",alignItems:"center",gap:3,color:SUB,fontSize:12}}>
              <I.Zap size={11} fill={SUB} stroke={SUB}/>{prog.kcal} ккал
            </span>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:lc,background:lc+"18",borderRadius:5,padding:"2px 8px"}}>
            {prog.ll}
          </span>
        </div>
        {/* Play button */}
        <button onClick={e=>{e.stopPropagation();onStart(prog);}}
          style={{width:44,height:44,borderRadius:"50%",background:BLUE,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <BigPlay size={22}/>
        </button>
      </div>

      {/* Expanded */}
      {open&&(
        <div style={{padding:"0 14px 14px",borderTop:`1px solid ${LINE}`,animation:"fadeIn 0.15s ease"}}>
          <p style={{fontSize:13,color:SUB,lineHeight:1.6,margin:"12px 0 10px"}}>{prog.desc}</p>
          <IvBar intervals={prog.iv.map(iv=>({t:iv.t,d:iv.d}))} h={4}/>
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
            {Object.entries(IV).map(([t,c])=>{ const cnt=prog.iv.filter(i=>i.t===t).length; if(!cnt)return null; return <span key={t} style={{fontSize:11,color:c.color,background:c.color+"14",borderRadius:6,padding:"2px 8px"}}>{c.emoji} {cnt}</span>; })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WORKOUT CARD ─────────────────────────────────────────────────────────────
function WCard({workout,onStart,onEdit,onDelete}) {
  const total=(workout.intervals||[]).reduce((s,i)=>s+(i.d||i.duration||0),0);
  const [ph,ps]=usePress(0.97);
  const [open,setOpen]=useState(false), [tx,setTx]=useState(0);
  const sx=useRef(null),sy=useRef(null),isH=useRef(false),drag=useRef(false);
  const isP=PROG_IDS.has(workout.id);
  const ivs=(workout.intervals||[]).map(iv=>({t:iv.t||iv.type,d:iv.d||iv.duration||1}));
  const SLIDE=148;

  const onTS=e=>{ if(isP)return; sx.current=e.touches[0].clientX;sy.current=e.touches[0].clientY;isH.current=false;drag.current=false;};
  const onTM=e=>{
    if(isP||sx.current===null)return;
    const dx=e.touches[0].clientX-sx.current,dy=e.touches[0].clientY-sy.current;
    if(!drag.current){if(Math.abs(dx)<4&&Math.abs(dy)<4)return;isH.current=Math.abs(dx)>Math.abs(dy);drag.current=true;}
    if(!isH.current)return; e.preventDefault(); e.stopPropagation();
    setTx(Math.max(-SLIDE,Math.min(0,(open?-SLIDE:0)+dx)));
  };
  const onTE=()=>{ if(isP){sx.current=null;return;} if(!drag.current||!isH.current){sx.current=null;return;}drag.current=false;const o=tx<-SLIDE/2;setOpen(o);setTx(o?-SLIDE:0);sx.current=null;};

  return (
    <div style={{position:"relative",marginBottom:10,borderRadius:16,overflow:"hidden",animation:"slideUp 0.2s ease both"}}>
      {/* Кнопки за карточкой — только для кастомных тренировок */}
      {!isP&&(
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:SLIDE,display:"flex",borderRadius:"0 16px 16px 0",overflow:"hidden",zIndex:0}}>
          <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onEdit,150)}}
            style={{flex:1,background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <I.Edit size={16} style={{color:"#fff"}}/>
            </div>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:"0.05em"}}>Изменить</span>
          </button>
          <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onDelete,150)}}
            style={{flex:1,background:"linear-gradient(135deg,#7f1d1d,#991b1b)",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <I.Trash size={16} style={{color:"#fff"}}/>
            </div>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:"0.05em"}}>Удалить</span>
          </button>
        </div>
      )}
      {/* Карточка */}
      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{background:CARD,borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:12,
          transform:`translateX(${tx}px)`,
          transition:(drag.current&&isH.current)?"none":"transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
          position:"relative",zIndex:1,userSelect:"none",touchAction:(!isP&&open)?"none":"pan-y"}}>
        <ProgSvgIcon id={workout.id} iconType={workout.iconType}/>
        <div {...ph} onClick={()=>{if(!open)onStart();}} style={{...ps,flex:1,minWidth:0,cursor:"pointer"}}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:4,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{workout.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{display:"flex",alignItems:"center",gap:4,color:SUB,fontSize:12}}><I.Clock size={11}/>{fmtD(total)}</span>
            <span style={{fontSize:12,color:SUB}}>{ivs.length} инт.</span>
          </div>
          <IvBar intervals={ivs} h={3}/>
        </div>
        <button onClick={()=>{if(!open)onStart();}}
          style={{width:44,height:44,borderRadius:"50%",background:BLUE,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <BigPlay size={22}/>
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY CARD (swipe-to-delete) ──────────────────────────────────────────
function HCard({result,onClick,onDelete}) {
  const done=result.completedIntervals===result.totalIntervals;
  const fmt=new Date(result.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const [ph,ps]=usePress(0.97);
  const [open,setOpen]=useState(false), [tx,setTx]=useState(0);
  const sx=useRef(null),sy=useRef(null),isH=useRef(false),drag=useRef(false);
  const SLIDE=74;

  const onTS=e=>{sx.current=e.touches[0].clientX;sy.current=e.touches[0].clientY;isH.current=false;drag.current=false;};
  const onTM=e=>{
    if(sx.current===null)return;
    const dx=e.touches[0].clientX-sx.current,dy=e.touches[0].clientY-sy.current;
    if(!drag.current){if(Math.abs(dx)<4&&Math.abs(dy)<4)return;isH.current=Math.abs(dx)>Math.abs(dy);drag.current=true;}
    if(!isH.current)return; e.preventDefault(); e.stopPropagation();
    setTx(Math.max(-SLIDE,Math.min(0,(open?-SLIDE:0)+dx)));
  };
  const onTE=()=>{if(!drag.current||!isH.current){sx.current=null;return;}drag.current=false;const o=tx<-SLIDE/2;setOpen(o);setTx(o?-SLIDE:0);sx.current=null;};

  return (
    <div style={{position:"relative",marginBottom:8,borderRadius:14,overflow:"hidden"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:SLIDE,background:"linear-gradient(135deg,#7f1d1d,#991b1b)",borderRadius:"0 14px 14px 0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:0}}>
        <button onClick={()=>{setOpen(false);setTx(0);setTimeout(onDelete,150)}}
          style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"0 14px",opacity:open?1:0,transform:open?"scale(1)":"scale(0.7)",transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <I.Trash size={16} style={{color:"#fff"}}/>
          </div>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:600,letterSpacing:"0.05em"}}>Удалить</span>
        </button>
      </div>
      <div {...ph} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={()=>!open&&onClick()}
        style={{...ps,background:CARD,borderRadius:14,padding:"13px 14px",cursor:"pointer",transform:`translateX(${tx}px)`,transition:(drag.current&&isH.current)?"none":"transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",position:"relative",zIndex:1,userSelect:"none",touchAction:open?"none":"pan-y"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:15,fontWeight:600,flex:1,marginRight:8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{result.workoutName}</div>
          <div style={{fontSize:15,fontWeight:700,color:TXT,flexShrink:0}}>{Math.round(result.totalDuration/60)} мин</div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:12,color:SUB}}>{fmt}</span>
          <span style={{fontSize:12,color:done?"#4ade80":"#fb923c"}}>{result.completedIntervals}/{result.totalIntervals} инт.</span>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────
function HomeView({navigate}) {
  const [workouts,setWS]=useState([]);
  const [loading,setLoad]=useState(true);
  const [userLevel,setUL]=useState(()=>localStorage.getItem("bw_ul")||"");
  const [addedIds,setAI]=useState(new Set());
  const [lvlSheet,setLvlSheet]=useState(false);
  const [ph,ps]=usePress(0.97);

  const load=useCallback(async()=>{
    const [ws,rs]=await Promise.all([db.getW(),db.getR()]);
    setWS(ws); setAI(new Set(ws.filter(w=>PROG_IDS.has(w.id)).map(w=>w.id))); setLoad(false);
  },[]);

  useEffect(()=>{load();window.addEventListener("focus",load);return()=>window.removeEventListener("focus",load);},[load]);

  const startProg=async prog=>{ const ex=workouts.find(w=>w.id===prog.id); if(ex){navigate("workout",ex.id);return;} const w={id:prog.id,name:prog.name,intervals:prog.iv.map(iv=>({...iv,id:uid()}))}; await db.saveW(w); navigate("workout",w.id); };
  const chooseLevel=l=>{ localStorage.setItem("bw_ul",l); setUL(l); setLvlSheet(false); };
  const myWorkouts=workouts.filter(w=>!PROG_IDS.has(w.id));
  const filtProgs=userLevel?PROGS.filter(p=>p.level===userLevel):PROGS;

  if(loading) return <Loader/>;

  return (
    <Page>
      <div style={{padding:"16px 16px 0"}}>
        {/* Create button — первая строка */}
        <button onClick={()=>navigate("create")} {...ph}
          style={{...ps,width:"100%",background:BLUE,border:"none",borderRadius:14,padding:"14px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",fontSize:15,fontWeight:700,color:"#fff",boxShadow:`0 4px 20px ${BLUE}44`}}>
          <I.Plus size={18} style={{color:"#fff"}}/>Создать тренировку
        </button>
      </div>

      <div style={{padding:"0 16px"}}>
        {/* Мои тренировки — только если есть */}
        {myWorkouts.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:18,fontWeight:700}}>Мои программы</div>
            </div>
            {myWorkouts.map(w=><WCard key={w.id} workout={w} onStart={()=>navigate("workout",w.id)} onEdit={()=>navigate("edit",w.id)} onDelete={async()=>{await db.delW(w.id);load();}}/>)}
          </div>
        )}

        {/* Программы */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:18,fontWeight:700}}>Программы</div>
          <button onClick={()=>setLvlSheet(true)}
            style={{background:CARD2,border:`1px solid ${LINE}`,borderRadius:20,padding:"5px 12px",color:userLevel?BLUE:SUB,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            {userLevel?LEVEL_LABEL[userLevel]:"Уровень"} <span style={{fontSize:11}}>▾</span>
          </button>
        </div>
        {filtProgs.map(p=><ProgCard key={p.id} prog={p} onStart={startProg} added={addedIds.has(p.id)}/>)}
      </div>

      {/* Level sheet через портал — zIndex 9999 чтобы точно поверх */}
      {lvlSheet&&createPortal(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end"}} onClick={()=>setLvlSheet(false)}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:CARD,borderRadius:"20px 20px 0 0",padding:"20px 16px",paddingBottom:"max(32px,env(safe-area-inset-bottom,32px))"}}>
            <div style={{width:36,height:4,background:MUTED,borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontSize:17,fontWeight:700,marginBottom:16}}>Ваш уровень</div>
            {[{l:"beginner",label:"Новичок",emoji:"🌱",desc:"Первые тренировки, безопасная нагрузка"},
              {l:"intermediate",label:"Опытный",emoji:"⚡",desc:"HIIT, интервалы, смешанная нагрузка"},
              {l:"pro",label:"Профи",emoji:"🏆",desc:"Максимальная интенсивность, VO2max"}].map(lv=>(
              <button key={lv.l} onClick={()=>chooseLevel(lv.l)}
                style={{width:"100%",background:userLevel===lv.l?BLUE+"18":CARD2,border:`1px solid ${userLevel===lv.l?BLUE+"44":LINE}`,borderRadius:14,padding:"14px",display:"flex",alignItems:"center",gap:12,marginBottom:8,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:22}}>{lv.emoji}</span>
                <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:userLevel===lv.l?BLUE:TXT}}>{lv.label}</div><div style={{fontSize:12,color:SUB}}>{lv.desc}</div></div>
                {userLevel===lv.l&&<I.Check size={18} style={{color:BLUE}}/>}
              </button>
            ))}
            {userLevel&&<button onClick={()=>chooseLevel("")} style={{width:"100%",background:"none",border:"none",color:SUB,fontSize:13,cursor:"pointer",marginTop:8,padding:"8px"}}>Сбросить уровень</button>}
          </div>
        </div>,
        document.body
      )}
    </Page>
  );
}

// ─── STATS VIEW ───────────────────────────────────────────────────────────────
function StatsView({navigate}) {
  const [history,setH]=useState([]);
  const [loading,setLoad]=useState(true);

  useEffect(()=>{(async()=>{ const rs=await db.getR(); setH([...rs].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))); setLoad(false); })();},[]);

  const delR=async id=>{ await db.delR(id); const rs=await db.getR(); setH([...rs].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))); };

  if(loading) return <Loader/>;

  const totalMins=Math.round(history.reduce((s,r)=>s+r.totalDuration,0)/60);
  const totalCount=history.length;
  const avgMins=totalCount>0?Math.round(totalMins/totalCount):0;
  // Калории: примерно 8 ккал/мин на велотренажёре
  const totalKcal=Math.round(totalMins*8);

  // Последние 7 дней
  const DAY_RU=["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  const today=new Date();
  const weekData=Array.from({length:7},(_,i)=>{
    const d=new Date(today); d.setDate(d.getDate()-6+i);
    const mins=history.filter(r=>{ const rd=new Date(r.completedAt); return rd.toDateString()===d.toDateString(); }).reduce((s,r)=>s+Math.round(r.totalDuration/60),0);
    return {day:DAY_RU[d.getDay()], mins, hasTrain:mins>0};
  });
  const maxMins=Math.max(...weekData.map(d=>d.mins),1);
  const weekMins=weekData.reduce((s,d)=>s+d.mins,0);
  const weekCount=history.filter(r=>{ const d=new Date(r.completedAt),t=new Date(); t.setDate(t.getDate()-6); return d>=t; }).length;

  return (
    <Page>
      <div style={{padding:"0 16px"}}>
        {/* Week chart card */}
        <div style={{background:CARD,borderRadius:20,padding:"18px",marginBottom:14,marginTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{fontSize:13,color:SUB,marginBottom:4}}>Эта неделя</div>
              <AnimNum target={weekMins} suffix=" минут" style={{fontSize:28,fontWeight:700}}/>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,color:SUB,marginBottom:4}}>Тренировок</div>
              <AnimNum target={weekCount} style={{fontSize:28,fontWeight:700}}/>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:8}}>
            {weekData.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                <div style={{width:"100%",borderRadius:"5px 5px 0 0",
                  background:d.mins>0?BLUE:"#27272a",
                  height:d.mins>0?`${Math.max(10,(d.mins/maxMins)*68)}px`:"6px",
                  transformOrigin:"bottom",
                  animation:`barGrow 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i*60}ms both`,
                  boxShadow:d.mins>0?`0 0 12px ${BLUE}55`:"none"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            {weekData.map((d,i)=>(
              <div key={i} style={{flex:1,textAlign:"center",fontSize:11,color:d.hasTrain?SUB:MUTED}}>{d.day}</div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[
            {label:"Всего калорий",num:totalKcal,sub:"ккал",delay:200},
            {label:"Средняя длительность",num:avgMins,sub:"мин",delay:320},
          ].map((s,i)=><StatGridCard key={i} {...s}/>)}
        </div>

        {/* Recent workouts */}
        {history.length>0&&(
          <>
            <div style={{fontSize:18,fontWeight:700,marginBottom:12,animation:"fadeIn 0.4s ease both"}}>Последние тренировки</div>
            {history.map((r,i)=>(
              <HCard key={r.id} result={r} onClick={()=>navigate("details",r.id)} onDelete={()=>delR(r.id)}/>
            ))}
          </>
        )}

        {history.length===0&&(
          <div style={{textAlign:"center",padding:"48px 0",color:MUTED}}>
            <div style={{fontSize:40,marginBottom:10}}>📊</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Нет данных</div>
            <div style={{fontSize:13}}>Завершите первую тренировку</div>
          </div>
        )}
      </div>
    </Page>
  );
}

// ─── WEIGHT PICKER ────────────────────────────────────────────────────────────
function WeightPicker({current, onSave, onClose}) {
  const parsed = parseFloat(String(current).replace(",",".")) || 70;
  const [kg, setKg]   = useState(Math.floor(parsed));
  const [dec, setDec] = useState(Math.round((parsed % 1) * 10)); // 0-9 → 0г-900г

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:CARD,borderRadius:"20px 20px 0 0",padding:"20px 20px",paddingBottom:"max(32px,env(safe-area-inset-bottom,32px))"}}>
        <div style={{width:36,height:4,background:MUTED,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{fontSize:16,fontWeight:600,marginBottom:4,textAlign:"center"}}>Текущий вес</div>
        <div style={{fontSize:13,color:SUB,textAlign:"center",marginBottom:20}}>{kg} кг {dec*100} г</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1}}>
            <WheelCol value={kg} max={200} onChange={setKg} renderValue={v=>String(v)}/>
            <div style={{textAlign:"center",fontSize:12,color:SUB,marginTop:6}}>кг</div>
          </div>
          <div style={{fontSize:28,fontWeight:200,color:MUTED,flexShrink:0,paddingBottom:24}}>·</div>
          <div style={{flex:1}}>
            <WheelCol value={dec} max={9} onChange={setDec} renderValue={v=>String(v*100)}/>
            <div style={{textAlign:"center",fontSize:12,color:SUB,marginTop:6}}>граммы</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,background:CARD2,border:`1px solid ${LINE}`,borderRadius:12,padding:"13px",color:TXT,fontSize:14,fontWeight:600,cursor:"pointer"}}>Отмена</button>
          <Btn onClick={()=>{ onSave(`${kg}.${dec}`); onClose(); }} style={{flex:2}}>Сохранить</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}
function ProfileView() {
  const [profile,setProfile]=useState({name:"",age:"",weight:"",targetWeight:""});
  const [editing,setEditing]=useState(false);
  const [has,setHas]=useState(false);
  const [loading,setLoad]=useState(true);
  const [weightHistory,setWH]=useState([]); // [{date, weight}]
  const [newWeight,setNW]=useState("");
  const [photoOk,setPhotoOk]=useState(true);
  const userLevel=localStorage.getItem("bw_ul")||"";
  const lc=LEVEL_COLOR[userLevel]||SUB;

  useEffect(()=>{(async()=>{
    const [p,wh]=await Promise.all([db.getP(),db.getWT()]);
    if(p&&(p.name||p.age||p.weight)){setProfile(p);setHas(true);if(p.weight)setNW(p.weight);}
    else{const n=TG_USER?`${TG_USER.first_name||""} ${TG_USER.last_name||""}`.trim():"";setProfile(pr=>({...pr,name:n}));setEditing(true);}
    setWH(wh||[]);
    setLoad(false);
  })();},[]);

  const save=async()=>{ await db.saveP(profile); setHas(true); setEditing(false); };

  const [weightPickerOpen, setWPO] = useState(false);

  const updateWeight = async (val) => {
    const w = parseFloat(val);
    if (isNaN(w)||w<=0) return;
    const entry = {date:new Date().toISOString(), weight:w};
    const newWH = [...weightHistory, entry];
    await db.saveWT(newWH);
    await db.saveP({...profile, weight:String(w)});
    setWH(newWH);
    setProfile(p=>({...p, weight:String(w)}));
  };

  const displayName=profile.name||TG_USER?.first_name||"";
  const initials=displayName.split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2)||"?";
  const photoUrl=TG_USER?.photo_url||null;

  // Динамика веса — последние 7 записей
  const wPoints=weightHistory.slice(-7);
  const curWeight=parseFloat(profile.weight)||0;
  const targetWeight=parseFloat(profile.targetWeight)||0;
  const weightDiff=wPoints.length>=2?(wPoints[wPoints.length-1].weight-wPoints[0].weight).toFixed(1):null;

  if(loading) return <Loader/>;

  // Mini line chart
  const LineChart=({points})=>{
    if(points.length<2) return <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",color:MUTED,fontSize:13}}>Недостаточно данных</div>;
    const W=280,H=80,pad=8;
    const weights=points.map(p=>p.weight);
    const minW=Math.min(...weights)-0.5, maxW=Math.max(...weights)+0.5;
    const xScale=(W-pad*2)/(points.length-1);
    const yScale=(H-pad*2)/(maxW-minW||1);
    const pts=points.map((p,i)=>({x:pad+i*xScale,y:H-pad-(p.weight-minW)*yScale}));
    const path=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
    const areaPath=`${path} L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={BLUE} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#wg)"/>
        <path d={path} fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={BLUE} stroke={CARD} strokeWidth="2"/>)}
        {/* Y labels */}
        <text x={pad} y={pad+4} fontSize="9" fill={MUTED}>{maxW.toFixed(1)}</text>
        <text x={pad} y={H-2} fontSize="9" fill={MUTED}>{minW.toFixed(1)}</text>
      </svg>
    );
  };

  return (
    <Page>
      {/* Header */}
      <div style={{padding:"16px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:22,fontWeight:700}}>Профиль</div>
        {has&&!editing&&<RndBtn onClick={()=>setEditing(true)}><I.Edit size={16}/></RndBtn>}
      </div>

      <div style={{padding:"0 16px"}}>
        {/* Profile card */}
        <div style={{background:CARD,borderRadius:20,padding:"18px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:has&&!editing?14:0}}>
            {/* Photo */}
            <div style={{width:62,height:62,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
              {photoUrl&&photoOk
                ?<img src={photoUrl} referrerPolicy="no-referrer" alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={()=>setPhotoOk(false)}/>
                :<div style={{fontSize:22,fontWeight:700,color:"#fff"}}>{initials}</div>
              }
            </div>
            {/* Info — имя и возраст рядом с фото */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:19,fontWeight:700,marginBottom:4}}>{displayName||"—"}</div>
              {profile.age&&<div style={{fontSize:14,color:SUB}}>{profile.age} лет</div>}
            </div>
          </div>

          {/* Weight update */}
          {has&&!editing&&(
            <div style={{borderTop:`1px solid ${LINE}`,paddingTop:14}}>
              <div style={{fontSize:13,color:SUB,marginBottom:8}}>Текущий вес</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:24,fontWeight:700}}>{curWeight?`${curWeight} кг`:"—"}</div>
                <button onClick={()=>setWPO(true)}
                  style={{background:BLUE,border:"none",borderRadius:10,padding:"9px 14px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  <I.Refresh size={14}/>Обновить
                </button>
              </div>
            </div>
          )}
          {weightPickerOpen&&<WeightPicker current={curWeight||70} onSave={updateWeight} onClose={()=>setWPO(false)}/>}
        </div>

        {/* Weight chart */}
        {has&&!editing&&wPoints.length>0&&(
          <div style={{background:CARD,borderRadius:20,padding:"18px",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>Динамика веса</div>
            <LineChart points={wPoints}/>
            {weightDiff!==null&&(
              <div style={{marginTop:10,fontSize:14,fontWeight:600,color:parseFloat(weightDiff)<0?"#4ade80":"#f87171"}}>
                {parseFloat(weightDiff)<0?"":"+"}{weightDiff} кг за период
              </div>
            )}
          </div>
        )}

        {/* Target weight */}
        {has&&!editing&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {label:"Целевой вес",val:targetWeight?`${targetWeight} кг`:"Не задан"},
              {label:"Осталось",val:targetWeight&&curWeight?`${Math.abs(curWeight-targetWeight).toFixed(1)} кг`:"—"},
            ].map((s,i)=>(
              <div key={i} style={{background:CARD,borderRadius:16,padding:"14px"}}>
                <div style={{fontSize:12,color:SUB,marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:20,fontWeight:700}}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Edit form — без поля веса */}
        {editing&&(
          <div style={{background:CARD,borderRadius:20,padding:"18px",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Редактировать</div>
            {[
              {k:"name",       l:"Имя",         pl:"Введите имя", type:"text"},
              {k:"age",        l:"Возраст",     pl:"—",           type:"number", s:"лет"},
              {k:"targetWeight",l:"Целевой вес",pl:"—",           type:"number", s:"кг"},
            ].map(f=>(
              <div key={f.k} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:SUB,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{f.l}</div>
                <div style={{position:"relative"}}>
                  <input value={profile[f.k]||""} type={f.type} onChange={e=>setProfile(p=>({...p,[f.k]:e.target.value}))} placeholder={f.pl}
                    style={{width:"100%",background:CARD2,border:`1px solid ${LINE}`,borderRadius:12,color:TXT,fontSize:15,padding:`12px ${f.s?"40px":14}px 12px 14px`,outline:"none",boxSizing:"border-box"}}/>
                  {f.s&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:MUTED,fontSize:13}}>{f.s}</span>}
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:10}}>
              {has&&<button onClick={()=>setEditing(false)} style={{flex:1,background:CARD2,border:`1px solid ${LINE}`,borderRadius:12,padding:"13px",color:TXT,fontSize:14,fontWeight:600,cursor:"pointer"}}>Отмена</button>}
              <Btn onClick={save} style={{flex:2}}>Сохранить</Btn>
            </div>
          </div>
        )}

      </div>
    </Page>
  );
}

// ─── CREATE / EDIT ────────────────────────────────────────────────────────────
function CreatePage({navigate,editId}) {
  const [name,setName]=useState("");
  const [intervals,setIV]=useState([]);
  const [iconType,setIconType]=useState(CUSTOM_ICON_LIST[0].type);
  const [loading,setLoad]=useState(!!editId);

  useEffect(()=>{(async()=>{
    if(editId){
      const w=await db.getWById(editId);
      if(w){
        setName(w.name);
        setIV(w.intervals.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration,type:iv.t||iv.type,duration:iv.d||iv.duration})));
        if(w.iconType)setIconType(w.iconType);
      }
    } else {
      setIV([{id:uid(),t:"slow",type:"slow",d:180,duration:180},{id:uid(),t:"fast",type:"fast",d:60,duration:60},{id:uid(),t:"slow",type:"slow",d:120,duration:120}]);
    }
    setLoad(false);
  })();},[editId]);

  const total=intervals.reduce((s,i)=>s+(i.d||0),0);
  const save=async()=>{
    if(!name.trim()){alert("Введите название");return;}
    if(!intervals.length){alert("Добавьте интервал");return;}
    await db.saveW({id:editId||uid(),name:name.trim(),intervals,iconType});
    navigate("home");
  };
  const norm=arr=>arr.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration,type:iv.t||iv.type,duration:iv.d||iv.duration}));

  if(loading) return <Loader/>;

  return (
    <div style={{minHeight:"100vh",background:BG,color:TXT,boxSizing:"border-box",paddingTop:ST}}>
      {/* Sticky header — только назад + заголовок */}
      <div style={{position:"sticky",top:ST,background:"rgba(13,13,15,0.97)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${LINE}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,zIndex:10}}>
        <RndBtn onClick={()=>navigate("home")}><I.Back size={18}/></RndBtn>
        <div style={{fontSize:16,fontWeight:700}}>{editId?"Редактировать":"Создать тренировку"}</div>
      </div>

      <div style={{padding:"20px 16px 32px"}}>
        {/* Иконка */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:SUB,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Иконка</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {CUSTOM_ICON_LIST.map(ic=>{
              const sel=ic.type===iconType;
              const Comp=ICON_COMP_MAP[ic.type]||I.Star;
              return (
                <button key={ic.type} onClick={()=>setIconType(ic.type)}
                  style={{width:48,height:48,borderRadius:13,background:ic.bg,border:sel?`2px solid #fff`:"2px solid transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                    boxShadow:sel?"0 0 0 3px rgba(255,255,255,0.25)":"none",
                    transition:"all 0.15s",transform:sel?"scale(1.1)":"scale(1)"}}>
                  <Comp size={20} style={{color:"#fff"}} fill="#fff" stroke="#fff" strokeWidth={1.5}/>
                </button>
              );
            })}
          </div>
        </div>

        {/* Название */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:SUB,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Название</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Моя тренировка"
            style={{width:"100%",background:CARD,border:`1px solid ${LINE}`,borderRadius:14,color:TXT,fontSize:16,padding:"14px",outline:"none",boxSizing:"border-box"}}/>
        </div>

        {/* Интервалы */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:12,color:SUB,textTransform:"uppercase",letterSpacing:"0.07em"}}>Интервалы</div>
            {total>0&&<div style={{fontSize:13,color:MUTED}}>{fmtD(total)}</div>}
          </div>
          {intervals.length>0&&<div style={{marginBottom:12}}><IvBar intervals={intervals} h={5}/></div>}
          <div style={{fontSize:11,color:MUTED,marginBottom:14}}>Зажмите номер — переместить · Свайп влево — удалить · Нажмите время — изменить</div>
          <SortList intervals={intervals} onChange={a=>setIV(norm(a))}/>
          <button onClick={()=>setIV(p=>norm([...p,{id:uid(),t:"medium",type:"medium",d:60,duration:60}]))}
            style={{width:"100%",background:"transparent",border:`2px dashed ${LINE}`,borderRadius:14,color:MUTED,fontSize:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"border-color 0.2s,color 0.2s"}}
            onPointerEnter={e=>{e.currentTarget.style.borderColor=BLUE;e.currentTarget.style.color=BLUE;}}
            onPointerLeave={e=>{e.currentTarget.style.borderColor=LINE;e.currentTarget.style.color=MUTED;}}>
            <I.Plus size={15}/>Добавить интервал
          </button>
        </div>

        {/* Кнопка Сохранить внизу */}
        <Btn onClick={save} disabled={!name.trim()||!intervals.length}>Сохранить</Btn>
      </div>
    </div>
  );
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
  const wakeLock=useRef(null);
  const [pph,pps]=usePress(0.93), [sph,sps]=usePress(0.93);

  // Не давать экрану гаснуть во время тренировки
  useEffect(()=>{
    const acquire=async()=>{
      try{
        if("wakeLock" in navigator){
          wakeLock.current=await navigator.wakeLock.request("screen");
        }
      }catch(e){}
    };
    const release=()=>{ wakeLock.current?.release(); wakeLock.current=null; };

    if(phase==="running"||phase==="countdown"){
      acquire();
    } else {
      release();
    }
    // Переактивировать если вкладка снова становится видимой
    const onVisible=()=>{ if(phase==="running"&&document.visibilityState==="visible") acquire(); };
    document.addEventListener("visibilitychange",onVisible);
    return()=>{ release(); document.removeEventListener("visibilitychange",onVisible); };
  },[phase]);
  const [flash,setFlash]=useState(false);
  const [playRipples,setPlayRipples]=useState([]);
  const [stopConfirm,setStopConfirm]=useState(false);
  const addPlayRipple=()=>{const id=Date.now();setPlayRipples(r=>[...r,id]);setTimeout(()=>setPlayRipples(r=>r.filter(x=>x!==id)),600);};

  const confirmStop=()=>{
    haptic('light');
    clearInterval(timer.current);clearTimer();
    if(phase==="ready"||phase==="countdown"){navigate("home");return;}
    const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elapsed,completedIntervals:ivRef.current,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
    db.saveR(r).then(()=>navigate("results",r.id));
  };

  // Вспышка + haptic при смене интервала
  useEffect(()=>{
    if(ivIdx===0)return;
    setFlash(true); haptic('medium');
    const t=setTimeout(()=>setFlash(false),350); return()=>clearTimeout(t);
  },[ivIdx]);

  useEffect(()=>{(async()=>{
    const w=await db.getWById(workoutId);
    if(!w){navigate("home");return;}
    w.intervals=w.intervals.map(iv=>({...iv,t:iv.t||iv.type,d:iv.d||iv.duration}));
    setWO(w);woRef.current=w;
    const saved=loadTimer();
    if(saved&&saved.workoutId===workoutId&&saved.phase==="running"){
      const now=Date.now();
      ivRef.current=saved.ivIdx;ivStartTs.current=saved.ivStartTs;ivInitDur.current=saved.ivInitDur;wStartTs.current=saved.wStartTs;
      setIdx(saved.ivIdx);setEl(Math.floor((now-saved.wStartTs)/1000));setTL(Math.max(0,saved.ivInitDur-Math.floor((now-saved.ivStartTs)/1000)));setPhase("running");
    } else {setTL(w.intervals[0]?.d||0);}
  })();},[workoutId]);

  useEffect(()=>{
    if(phase!=="countdown")return;
    if(cd<=0){const d=woRef.current.intervals[0].d;ivStartTs.current=Date.now();ivInitDur.current=d;wStartTs.current=Date.now();setTL(d);setPhase("running");return;}
    const t=setTimeout(()=>setCd(c=>c-1),1000);return()=>clearTimeout(t);
  },[phase,cd]);

  useEffect(()=>{
    if(phase!=="running"||!woRef.current)return;
    const tick=()=>{
      const now=Date.now();
      const rem=Math.max(0,ivInitDur.current-Math.floor((now-ivStartTs.current)/1000));
      const tot=Math.floor((now-(wStartTs.current||now))/1000);
      setEl(tot);setTL(rem);
      saveTimer({workoutId:woRef.current.id,phase:"running",ivIdx:ivRef.current,ivStartTs:ivStartTs.current,ivInitDur:ivInitDur.current,wStartTs:wStartTs.current});
      if(rem<=0){
        const next=ivRef.current+1;
        if(next<woRef.current.intervals.length){ivRef.current=next;ivStartTs.current=Date.now();ivInitDur.current=woRef.current.intervals[next].d;setIdx(next);}
        else{clearInterval(timer.current);clearTimer();haptic('success');setPhase("done");const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:tot,completedIntervals:woRef.current.intervals.length,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};db.saveR(r).then(()=>setTimeout(()=>navigate("results",r.id),400));}
      }
    };
    timer.current=setInterval(tick,250);return()=>clearInterval(timer.current);
  },[phase,ivIdx]);

  const playPause=()=>{
    haptic('medium');
    if(phase==="ready"){setCd(3);setPhase("countdown");}
    else if(phase==="running"){clearInterval(timer.current);clearTimer();setPhase("paused");}
    else if(phase==="paused"){ivStartTs.current=Date.now()-(ivInitDur.current-tLeft)*1000;setPhase("running");}
  };
  const stop=()=>{ haptic('light'); setStopConfirm(true); };

  if(!workout) return <Loader/>;
  const curr=workout.intervals[ivIdx], next=workout.intervals[ivIdx+1];
  const cfg=IV[curr.t]||IV.slow, nc=next?IV[next.t]:null;
  const R=116, circ=2*Math.PI*R;
  // Прогресс: убывает от 1 до 0 — кольцо уменьшается
  const prog=curr.d>0?tLeft/curr.d:0;
  // При смене интервала (flash) — моментально полное, без анимации заполнения
  const ringTransition=flash?"none":"stroke-dashoffset 0.55s linear,stroke 0.3s";

  return (
    <div style={{height:"100vh",background:BG,color:TXT,display:"flex",flexDirection:"column",paddingTop:ST,boxSizing:"border-box",overflow:"hidden"}}>

      {/* Confirm stop modal */}
      {stopConfirm&&createPortal(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
          <div style={{background:CARD,borderRadius:22,padding:"28px 22px",width:"100%",maxWidth:320,animation:"popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both"}}>
            <div style={{fontSize:20,fontWeight:700,marginBottom:10,textAlign:"center"}}>Остановить?</div>
            <div style={{fontSize:14,color:SUB,textAlign:"center",marginBottom:22,lineHeight:1.5}}>Прогресс будет сохранён</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStopConfirm(false)} style={{flex:1,background:CARD2,border:`1px solid ${LINE}`,borderRadius:12,padding:"14px",color:TXT,fontSize:15,fontWeight:600,cursor:"pointer"}}>Продолжить</button>
              <button onClick={()=>{setStopConfirm(false);confirmStop();}} style={{flex:1,background:"linear-gradient(135deg,#7f1d1d,#dc2626)",border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>Остановить</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Header: по центру всегда ── */}
      <div style={{padding:"6px 14px 4px",flexShrink:0,textAlign:"center",position:"relative"}}>
        {phase==="ready"&&(
          <button onClick={()=>navigate("home")} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",width:36,height:36,borderRadius:"50%",background:CARD2,border:`1px solid ${LINE}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <I.Back size={16}/>
          </button>
        )}
        <div style={{fontSize:15,fontWeight:700}}>{workout.name}</div>
        <div style={{fontSize:12,color:SUB,marginTop:1}}>Интервал {ivIdx+1} из {workout.intervals.length}</div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{margin:"0 14px 0",height:3,background:CARD2,borderRadius:2,flexShrink:0,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(ivIdx/workout.intervals.length)*100}%`,background:BLUE,borderRadius:2,transition:"width 0.6s ease"}}/>
      </div>

      {/* ── Countdown экран ── */}
      {phase==="countdown" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingBottom:"15vh"}}>
          <div style={{fontSize:13,color:SUB,letterSpacing:"0.14em",marginBottom:8,animation:"fadeIn 0.3s ease"}}>ПРИГОТОВЬТЕСЬ</div>
          <div key={cd} style={{fontSize:130,fontWeight:100,lineHeight:1,color:cd>0?BLUE:"#4ade80",animation:cd>0?"cdBounce 0.45s cubic-bezier(0.34,1.56,0.64,1) both":"cdGo 0.5s cubic-bezier(0.34,1.56,0.64,1) both",display:"inline-block"}}>{cd||"GO!"}</div>
        </div>
      )}

      {/* ── Workout экран ── */}
      {phase!=="countdown" && (
        <>
          {/* Ring — без тряски, transition только убывает */}
          <div style={{display:"flex",justifyContent:"center",paddingTop:10,flexShrink:0}}>
            <div style={{position:"relative",width:256,height:256,animation:flash?"ivFlash 0.3s ease":"none"}}>
              <svg width={256} height={256} style={{transform:"rotate(-90deg)"}}>
                <circle cx={128} cy={128} r={R} fill="none" stroke={CARD2} strokeWidth={16}/>
                <circle cx={128} cy={128} r={R} fill="none" stroke={cfg.color} strokeWidth={16} strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ*(1-prog)}
                  style={{transition:ringTransition,filter:`drop-shadow(0 0 16px ${cfg.color}80)`}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                <div style={{fontSize:26}}>{cfg.emoji}</div>
                <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:cfg.color}}>{cfg.label}</div>
                <div style={{fontSize:64,fontWeight:100,fontVariantNumeric:"tabular-nums",lineHeight:1,letterSpacing:"-0.02em"}}>{fmtT(tLeft)}</div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:"flex",gap:8,margin:"10px 14px 0",flexShrink:0}}>
            {[
              {l:"ПРОШЛО",   v:fmtT(elapsed), a:false},
              {l:"ИНТЕРВАЛ", v:`${ivIdx+1}/${workout.intervals.length}`, a:true},
              {l:"ОСТАЛОСЬ", v:fmtT(Math.max(0,workout.intervals.slice(ivIdx).reduce((s,i)=>s+i.d,0)-ivInitDur.current+tLeft)), a:false},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,background:s.a?cfg.color+"14":CARD,border:s.a?`1px solid ${cfg.color}44`:`1px solid ${LINE}`,borderRadius:12,padding:"9px 6px",textAlign:"center"}}>
                <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",marginBottom:4}}>{s.l}</div>
                <div style={{fontSize:16,fontWeight:600,color:s.a?cfg.color:TXT,fontVariantNumeric:"tabular-nums"}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Next interval / pause */}
          <div style={{margin:"8px 14px 0",height:42,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {phase==="paused"
              ? <div style={{fontSize:16,color:SUB,fontWeight:500}}>⏸ Пауза</div>
              : next
                ? <div style={{textAlign:"center"}}>
                    <div style={{fontSize:12,color:SUB,letterSpacing:"0.06em",marginBottom:2}}>Следующий этап:</div>
                    <div style={{fontSize:17,color:nc?.color,fontWeight:700}}>{nc?.emoji} {nc?.label} — {fmtT(next.d)}</div>
                  </div>
                : <div style={{fontSize:17,color:"#4ade80",fontWeight:700}}>🏁 Финиш!</div>
            }
          </div>

          {/* Цветные полосы — без маркера */}
          <div style={{margin:"6px 14px 0",flexShrink:0}}>
            <IvBar intervals={workout.intervals.map((iv,i)=>({t:iv.t,d:iv.d}))} h={6}/>
          </div>

          {/* Spacer */}
          <div style={{flex:1,minHeight:4}}/>

          {/* Controls — кнопка СТАРТ/ПАУЗА всегда синяя */}
          <div style={{flexShrink:0,padding:"0 20px",paddingBottom:"max(24px,env(safe-area-inset-bottom,24px))",display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
            <button onClick={stop} {...sph} style={{...sps,width:60,height:60,borderRadius:"50%",background:CARD,border:`1px solid ${LINE}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer"}}>
              <I.Stop size={20} fill={TXT} stroke="none"/>
              <span style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:"0.04em"}}>СТОП</span>
            </button>
            <button onClick={()=>{addPlayRipple();playPause();}} {...pph} style={{...pps,width:84,height:84,borderRadius:"50%",background:BLUE,border:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer",boxShadow:`0 0 32px ${BLUE}60`,position:"relative",overflow:"hidden"}}>
              {playRipples.map(r=><span key={r} style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(255,255,255,0.25)",animation:"ripple 0.55s ease-out forwards"}}/>)}
              {phase==="running"
                ? <I.Pause size={26} fill="#fff" stroke="#fff"/>
                : <BigPlay size={28} color="#fff"/>
              }
              <span style={{fontSize:11,letterSpacing:"0.06em",fontWeight:700,color:"#fff"}}>{phase==="running"?"ПАУЗА":"СТАРТ"}</span>
            </button>
            <div style={{width:60,height:60,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}>
              <div style={{fontSize:28}}>{cfg.emoji}</div>
              <span style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:"0.04em"}}>ТЕМП</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  const [show,setShow]=useState(false);
  const [ph,ps]=usePress();
  useEffect(()=>{db.getRById(resultId).then(r=>{if(!r)navigate("home");else{setR(r);setTimeout(()=>setShow(true),100);}});},[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  return (
    <div style={{minHeight:"100vh",background:BG,color:TXT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",overflow:"hidden"}}>
      <Confetti active={done&&show}/>
      {/* Trophy */}
      <div style={{width:96,height:96,borderRadius:"50%",background:done?BLUE:"#f97316",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:done?`0 0 40px ${BLUE}66`:"0 0 40px #f9731644",marginBottom:20,animation:done?"scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both, trophyGlow 2s ease-in-out 0.6s infinite":"scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both"}}>
        {done?<I.Trophy size={44} style={{color:"#fff"}}/>:<I.Target size={40} style={{color:"#fff"}}/>}
      </div>
      <div style={{fontSize:26,fontWeight:700,marginBottom:6,textAlign:"center",animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both"}}>{done?"Отличная работа! 💪":"Тренировка завершена"}</div>
      <div style={{color:SUB,marginBottom:24,textAlign:"center",fontSize:14,animation:"fadeIn 0.4s ease 0.4s both"}}>{done?"Все интервалы выполнены":"Результат сохранён"}</div>
      <div style={{width:"100%",maxWidth:360,display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {[
          {emoji:"🏃",label:"Тренировка",val:result.workoutName,num:null,delay:300},
          {emoji:"⏱",label:"Время",val:null,num:result.totalDuration,fmt:v=>fmtD(v),delay:420},
          {emoji:"🎯",label:"Интервалы",val:`${result.completedIntervals} / ${result.totalIntervals}`,num:null,delay:540},
          {emoji:"🔥",label:"Калории ~",val:null,num:Math.round(result.totalDuration/60*8),fmt:v=>`${v} ккал`,delay:660},
        ].map((s,i)=>(
          <ResultStatCard key={i} {...s}/>
        ))}
      </div>
      <div style={{width:"100%",maxWidth:360,animation:"fadeIn 0.4s ease 0.8s both"}}>
        <Btn onClick={()=>navigate("home")} {...ph} style={{...ps}}>На главную</Btn>
      </div>
    </div>
  );
}

function ResultStatCard({emoji,label,val,num,fmt,delay}){
  const counted=useCountUp(num||0,1000,delay);
  const display=num!=null?fmt(counted):val;
  return (
    <div style={{background:CARD,borderRadius:14,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,animation:`popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`}}>
      <div style={{width:38,height:38,background:CARD2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{emoji}</div>
      <div><div style={{fontSize:11,color:MUTED,marginBottom:2}}>{label}</div><div style={{fontSize:15,fontWeight:600}}>{display}</div></div>
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
    <div style={{minHeight:"100vh",background:BG,color:TXT,paddingTop:ST,paddingLeft:16,paddingRight:16,paddingBottom:32,boxSizing:"border-box"}}>
      <div style={{paddingTop:ST,display:"flex",alignItems:"center",gap:12,marginBottom:22,paddingBottom:16,borderBottom:`1px solid ${LINE}`}}>
        <RndBtn onClick={()=>navigate("home")}><I.Back size={18}/></RndBtn>
        <div style={{fontSize:17,fontWeight:700}}>Детали тренировки</div>
      </div>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>{result.workoutName}</div>
        <div style={{fontSize:14,color:done?"#4ade80":"#fb923c",fontWeight:600}}>{done?"✅ Выполнено":"⏱ Частично"}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {emoji:"📅",label:"Дата",val:<><div style={{fontSize:14}}>{date.toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"long"})}</div><div style={{color:SUB,fontSize:12}}>{date.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></>},
          {emoji:"⏱",label:"Длительность",val:<div style={{fontSize:19,fontWeight:700}}>{fmtD(result.totalDuration)}</div>},
          {emoji:"🎯",label:"Интервалы",val:<><div style={{fontSize:19,fontWeight:700}}>{result.completedIntervals} из {result.totalIntervals}</div><div style={{display:"flex",gap:3,marginTop:6}}>{Array.from({length:result.totalIntervals}).map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<result.completedIntervals?BLUE:MUTED}}/>)}</div></>},
        ].map((c,i)=>(
          <div key={i} style={{background:CARD,borderRadius:14,padding:"14px",display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:38,height:38,background:CARD2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{c.emoji}</div>
            <div style={{flex:1}}><div style={{fontSize:11,color:MUTED,marginBottom:4}}>{c.label}</div>{c.val}</div>
          </div>
        ))}
      </div>
      <Btn onClick={()=>navigate("home")} style={{marginTop:20,...ps}} {...ph}>На главную</Btn>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]=useState("home");
  const [page,setPage]=useState(()=>{ const s=loadTimer(); return s?"workout":"main"; });
  const [param,setParam]=useState(()=>{ const s=loadTimer(); return s?s.workoutId:null; });

  const navigate=(to,p=null)=>{
    setParam(p); window.scrollTo(0,0);
    if(["home","stats","profile"].includes(to)){setPage("main");setView(to);}
    else setPage(to);
  };

  useEffect(()=>{
    // Запрет зума
    const meta=document.createElement("meta");
    meta.name="viewport";
    meta.content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(meta);

    // Global styles
    const s=document.createElement("style");
    s.textContent=`
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      body{margin:0;padding:0;background:#0d0d0f;color:#f4f4f5;font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior:none;touch-action:pan-x pan-y;}
      ::-webkit-scrollbar{display:none;}
      input,button{font-family:inherit;}
      input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
      @keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes scaleIn{from{transform:scale(0.82);opacity:0}to{transform:scale(1);opacity:1}}
      @keyframes pulseWarn{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
      @keyframes ivFlash{0%{opacity:1}20%{opacity:0.15}100%{opacity:1}}
      @keyframes popIn{0%{transform:scale(0.7) translateY(6px);opacity:0}70%{transform:scale(1.06) translateY(-2px)}100%{transform:scale(1) translateY(0);opacity:1}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes trophyGlow{0%,100%{filter:drop-shadow(0 0 8px rgba(59,130,246,0.6))}50%{filter:drop-shadow(0 0 24px rgba(59,130,246,0.95))}}
      @keyframes cdBounce{0%{transform:scale(0.3) rotate(-8deg);opacity:0}55%{transform:scale(1.18) rotate(3deg);opacity:1}75%{transform:scale(0.92) rotate(-1deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
      @keyframes cdGo{0%{transform:scale(0.5);opacity:0}40%{transform:scale(1.3);opacity:1}65%{transform:scale(0.9)}85%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
      @keyframes ripple{0%{transform:scale(0);opacity:0.5}100%{transform:scale(4);opacity:0}}
      @keyframes barGrow{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}
      @keyframes statIn{0%{transform:translateX(-14px);opacity:0}100%{transform:translateX(0);opacity:1}}
      @keyframes goFloat{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-12px) scale(1.1)}60%{transform:translateY(-4px) scale(1.05)}100%{transform:translateY(0) scale(1)}}
    `;
    document.head.appendChild(s);
    return()=>{ document.head.removeChild(s); document.head.removeChild(meta); };
  },[]);

  if(page==="create")  return <CreatePage  navigate={navigate} editId={null}/>;
  if(page==="edit")    return <CreatePage  navigate={navigate} editId={param}/>;
  if(page==="workout") return <ActivePage  navigate={navigate} workoutId={param}/>;
  if(page==="results") return <ResultsPage navigate={navigate} resultId={param}/>;
  if(page==="details") return <DetailsPage navigate={navigate} resultId={param}/>;

  return (
    <div style={{background:BG,minHeight:"100vh"}}>
      {view==="home"    &&<HomeView    navigate={navigate}/>}
      {view==="stats"   &&<StatsView   navigate={navigate}/>}
      {view==="profile" &&<ProfileView navigate={navigate}/>}
      <BottomNav view={view} setView={v=>{setView(v);setPage("main");}}/>
    </div>
  );
}
