import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); if (tg.requestFullscreen) tg.requestFullscreen(); }
const TG_USER = tg?.initDataUnsafe?.user || null;
const SAFE_TOP = tg ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tg-safe-area-inset-top"))||20) : 20;

// ─── CLOUD STORAGE ────────────────────────────────────────────────────────────
const cloudGet = (key) => new Promise((resolve) => {
  if (tg?.CloudStorage) tg.CloudStorage.getItem(key, (err, val) => resolve(err ? null : val));
  else resolve(localStorage.getItem(key));
});
const cloudSet = (key, value) => new Promise((resolve) => {
  if (tg?.CloudStorage) tg.CloudStorage.setItem(key, value, (err) => resolve(!err));
  else { localStorage.setItem(key, value); resolve(true); }
});

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const KEYS = { workouts:"bw_workouts_v1", results:"bw_results_v1", profile:"bw_profile_v1" };
const storage = {
  getWorkouts:    async () => { const d=await cloudGet(KEYS.workouts);  try{return d?JSON.parse(d):[];}catch{return[];} },
  saveWorkouts:   async (l) => cloudSet(KEYS.workouts, JSON.stringify(l)),
  saveWorkout:    async (w) => { const a=await storage.getWorkouts(); const i=a.findIndex(x=>x.id===w.id); if(i!==-1)a[i]=w;else a.push(w); await storage.saveWorkouts(a); },
  deleteWorkout:  async (id) => { const a=await storage.getWorkouts(); await storage.saveWorkouts(a.filter(w=>w.id!==id)); },
  getWorkoutById: async (id) => { const a=await storage.getWorkouts(); return a.find(w=>w.id===id); },
  getResults:     async () => { const d=await cloudGet(KEYS.results);   try{return d?JSON.parse(d):[];}catch{return[];} },
  saveResult:     async (r) => { const a=await storage.getResults(); a.push(r); await cloudSet(KEYS.results,JSON.stringify(a)); },
  getResultById:  async (id) => { const a=await storage.getResults(); return a.find(r=>r.id===id); },
  getProfile:     async () => { const d=await cloudGet(KEYS.profile);   try{return d?JSON.parse(d):null;}catch{return null;} },
  saveProfile:    async (p) => cloudSet(KEYS.profile, JSON.stringify(p)),
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({d,size=24,stroke="currentColor",strokeWidth=2,fill="none"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const Icons = {
  Plus:        p=><Icon {...p} d="M12 5v14M5 12h14"/>,
  ArrowLeft:   p=><Icon {...p} d="M19 12H5M12 19l-7-7 7-7"/>,
  X:           p=><Icon {...p} d="M18 6 6 18M6 6l12 12"/>,
  Play:        p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>,
  Pause:       p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Stop:        p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Clock:       p=><Icon {...p} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-10V7l3 3"/>,
  Zap:         p=><Icon {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill={p.fill||"none"}/>,
  Trash:       p=><Icon {...p} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>,
  CheckCircle: p=><Icon {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"/>,
  Calendar:    p=><Icon {...p} d="M8 2v4M16 2v4M3 10h18M21 8H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>,
  Target:      p=><svg width={p.size||24} height={p.size||24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  Star:        p=><Icon {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
  BookOpen:    p=><Icon {...p} d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>,
  Trophy:      p=><Icon {...p} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>,
  User:        p=><Icon {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>,
  Edit:        p=><Icon {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>,
  Check:       p=><Icon {...p} d="M20 6 9 17l-5-5"/>,
};

// ─── INTERVAL CONFIG ──────────────────────────────────────────────────────────
const IV = {
  slow:   {label:"Медленно", emoji:"🐢", color:"#4ade80", glow:"rgba(74,222,128,0.45)",  bg:"rgba(74,222,128,0.12)",  desc:"Разминка / восстановление"},
  medium: {label:"Средне",   emoji:"🚴", color:"#facc15", glow:"rgba(250,204,21,0.45)",  bg:"rgba(250,204,21,0.12)",  desc:"Рабочий темп"},
  fast:   {label:"Быстро",   emoji:"⚡", color:"#c0392b", glow:"rgba(192,57,43,0.45)",   bg:"rgba(192,57,43,0.12)",   desc:"Спринт"},
};

// ─── PROGRAMS ─────────────────────────────────────────────────────────────────
const PROGRAMS = [
  {id:"b1",level:"beginner",levelLabel:"Новичок",goal:"fat",goalLabel:"Жиросжигание",name:"Старт: сжигание жира",duration:25,description:"Мягкий вход в тренировки. Пульс 60–70% от максимума — идеальная зона для сжигания жира.",intervals:[{id:"b1a",type:"slow",duration:300},{id:"b1b",type:"medium",duration:120},{id:"b1c",type:"slow",duration:180},{id:"b1d",type:"medium",duration:120},{id:"b1e",type:"slow",duration:180},{id:"b1f",type:"medium",duration:120},{id:"b1g",type:"slow",duration:480}]},
  {id:"b2",level:"beginner",levelLabel:"Новичок",goal:"endurance",goalLabel:"Выносливость",name:"Базовая выносливость",duration:20,description:"Равномерная нагрузка. Без резких скачков пульса — безопасно для начинающих.",intervals:[{id:"b2a",type:"slow",duration:240},{id:"b2b",type:"medium",duration:240},{id:"b2c",type:"slow",duration:120},{id:"b2d",type:"medium",duration:240},{id:"b2e",type:"slow",duration:120},{id:"b2f",type:"medium",duration:240}]},
  {id:"i1",level:"intermediate",levelLabel:"Опытный",goal:"fat",goalLabel:"Жиросжигание",name:"HIIT: жиросжигание",duration:30,description:"Классические интервалы высокой интенсивности. Разгоняет метаболизм на 24–48 часов после тренировки.",intervals:[{id:"i1w",type:"slow",duration:300},...Array.from({length:7},(_,i)=>[{id:`i1f${i}`,type:"fast",duration:30},{id:`i1r${i}`,type:"slow",duration:90}]).flat(),{id:"i1c",type:"slow",duration:300}]},
  {id:"i2",level:"intermediate",levelLabel:"Опытный",goal:"endurance",goalLabel:"Выносливость",name:"Пирамида выносливости",duration:35,description:"Нагрузка нарастает и спадает волнами. Отличный способ увеличить аэробную мощность.",intervals:[{id:"i2a",type:"slow",duration:300},{id:"i2b",type:"medium",duration:120},{id:"i2c",type:"fast",duration:60},{id:"i2d",type:"medium",duration:120},{id:"i2e",type:"fast",duration:90},{id:"i2f",type:"medium",duration:120},{id:"i2g",type:"fast",duration:120},{id:"i2h",type:"medium",duration:120},{id:"i2i",type:"fast",duration:90},{id:"i2j",type:"medium",duration:120},{id:"i2k",type:"fast",duration:60},{id:"i2l",type:"medium",duration:120},{id:"i2m",type:"slow",duration:300}]},
  {id:"p1",level:"pro",levelLabel:"Профи",goal:"fat",goalLabel:"Жиросжигание",name:"Табата на велосипеде",duration:20,description:"20 сек максимального усилия, 10 сек отдыха. Не рекомендуется при проблемах с сердцем.",intervals:[{id:"p1w",type:"slow",duration:300},...Array.from({length:8},(_,i)=>[{id:`p1f${i}`,type:"fast",duration:20},{id:`p1r${i}`,type:"slow",duration:10}]).flat(),{id:"p1m",type:"slow",duration:180},...Array.from({length:8},(_,i)=>[{id:`p1g${i}`,type:"fast",duration:20},{id:`p1s${i}`,type:"slow",duration:10}]).flat(),{id:"p1c",type:"slow",duration:300}]},
  {id:"p2",level:"pro",levelLabel:"Профи",goal:"endurance",goalLabel:"Выносливость",name:"VO2max — предел возможного",duration:45,description:"Интервалы на уровне максимального потребления кислорода. Только для подготовленных спортсменов.",intervals:[{id:"p2a",type:"slow",duration:600},{id:"p2b",type:"medium",duration:180},{id:"p2c",type:"fast",duration:180},{id:"p2d",type:"medium",duration:180},{id:"p2e",type:"fast",duration:180},{id:"p2f",type:"medium",duration:180},{id:"p2g",type:"fast",duration:180},{id:"p2h",type:"medium",duration:180},{id:"p2i",type:"fast",duration:180},{id:"p2j",type:"medium",duration:180},{id:"p2k",type:"slow",duration:600}]},
];
const PROGRAM_IDS = new Set(PROGRAMS.map(p=>p.id));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtD = (s) => { const m=Math.floor(s/60),sec=s%60; if(m&&sec) return `${m} мин ${sec} сек`; if(m) return `${m} мин`; return `${sec} сек`; };
const fmtT = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const pageSt  = {minHeight:"100vh",background:"linear-gradient(160deg,#0a0a14,#0d1117,#060608)",color:"#fff",padding:`${SAFE_TOP+12}px 20px 20px`,boxSizing:"border-box"};
const iconBtn = {width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",cursor:"pointer",flexShrink:0,transition:"background 0.15s,transform 0.1s"};
const fldLbl  = {fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,letterSpacing:"0.08em",textTransform:"uppercase"};
const inputSt = {width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:"#fff",fontSize:16,padding:"13px 16px",outline:"none",boxSizing:"border-box"};
const greenBt = {width:"100%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:14,padding:"16px",color:"#000",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 24px rgba(74,222,128,0.25)",transition:"transform 0.12s"};
const LVLC    = {beginner:"#4ade80",intermediate:"#facc15",pro:"#f43f5e"};

function usePress(scale=0.97) {
  const [p,setP]=useState(false);
  const h={onPointerDown:()=>setP(true),onPointerUp:()=>setP(false),onPointerLeave:()=>setP(false)};
  return [h,{transform:p?`scale(${scale})`:"scale(1)",transition:"transform 0.12s ease"}];
}

function Page({children,style={}}) {
  return <div style={{...pageSt,...style,animation:"pageIn 0.22s ease both"}}>{children}</div>;
}

function Loader() {
  return <div style={{...pageSt,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>🚴</div><div style={{color:"rgba(255,255,255,0.3)",fontSize:15}}>Загрузка...</div></div></div>;
}

function IntervalBar({intervals,height=5}) {
  if(!intervals?.length) return null;
  return <div style={{display:"flex",gap:2,height,borderRadius:height/2,overflow:"hidden"}}>{intervals.map((iv,i)=><div key={i} style={{flex:iv.duration||1,background:IV[iv.type]?.color||"#4ade80",minWidth:3,transition:"flex 0.3s"}}/>)}</div>;
}

// ─── WHEEL TIME PICKER ────────────────────────────────────────────────────────
function WheelPicker({value, max, label, onChange}) {
  const ITEM_H = 36;
  const VISIBLE = 5;
  const listRef = useRef(null);
  const startY = useRef(null);
  const startVal = useRef(value);
  const items = Array.from({length: max+1}, (_,i) => i);

  // Sync scroll position to value
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = value * ITEM_H;
    }
  }, [value]);

  const onScroll = () => {
    if (!listRef.current) return;
    const idx = Math.round(listRef.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(max, idx));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1}}>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
      <div style={{position:"relative",width:"100%",height:ITEM_H*VISIBLE,overflow:"hidden",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)"}}>
        {/* Selection highlight */}
        <div style={{position:"absolute",left:0,right:0,top:ITEM_H*2,height:ITEM_H,background:"rgba(74,222,128,0.12)",borderTop:"1px solid rgba(74,222,128,0.3)",borderBottom:"1px solid rgba(74,222,128,0.3)",zIndex:2,pointerEvents:"none"}}/>
        {/* Fade top */}
        <div style={{position:"absolute",left:0,right:0,top:0,height:ITEM_H*2,background:"linear-gradient(to bottom,rgba(10,10,20,0.95),transparent)",zIndex:3,pointerEvents:"none"}}/>
        {/* Fade bottom */}
        <div style={{position:"absolute",left:0,right:0,bottom:0,height:ITEM_H*2,background:"linear-gradient(to top,rgba(10,10,20,0.95),transparent)",zIndex:3,pointerEvents:"none"}}/>
        {/* Scrollable list */}
        <div
          ref={listRef}
          onScroll={onScroll}
          style={{height:"100%",overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",position:"relative",zIndex:1}}
        >
          {/* padding top/bottom so first/last item can center */}
          <div style={{height:ITEM_H*2}}/>
          {items.map(v=>(
            <div key={v} style={{height:ITEM_H,display:"flex",alignItems:"center",justifyContent:"center",scrollSnapAlign:"start",fontSize:22,fontWeight:v===value?600:400,color:v===value?"#fff":"rgba(255,255,255,0.3)",transition:"color 0.15s,font-weight 0.15s",cursor:"pointer",userSelect:"none"}}
              onClick={()=>{ onChange(v); listRef.current.scrollTop=v*ITEM_H; }}>
              {String(v).padStart(2,"0")}
            </div>
          ))}
          <div style={{height:ITEM_H*2}}/>
        </div>
      </div>
    </div>
  );
}

function DurationPicker({duration, onChange}) {
  const mins = Math.floor(duration/60);
  const secs = duration%60;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <WheelPicker value={mins} max={99} label="мин" onChange={m=>onChange(m*60+secs)}/>
      <div style={{fontSize:28,fontWeight:200,color:"rgba(255,255,255,0.3)",marginTop:16,flexShrink:0}}>:</div>
      <WheelPicker value={secs} max={59} label="сек" onChange={s=>onChange(mins*60+s)}/>
    </div>
  );
}

// ─── CIRCULAR TIMER ───────────────────────────────────────────────────────────
function CircularTimer({timeRemaining,totalTime,intervalType,isWarning}) {
  const cfg=IV[intervalType]||IV.slow,R=128,circ=2*Math.PI*R;
  const offset=circ*(1-(totalTime>0?timeRemaining/totalTime:0));
  const color=isWarning?"#ef4444":cfg.color,glow=isWarning?"rgba(239,68,68,0.5)":cfg.glow;
  return (
    <div style={{position:"relative",width:296,height:296}}>
      <svg width={296} height={296} style={{transform:"rotate(-90deg)"}}>
        <circle cx={148} cy={148} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14}/>
        <circle cx={148} cy={148} r={R} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{transition:"stroke-dashoffset 0.85s cubic-bezier(0.4,0,0.2,1),stroke 0.4s",filter:`drop-shadow(0 0 18px ${glow})`}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:28,marginBottom:4}}>{cfg.emoji}</div>
        <div style={{fontSize:13,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color,marginBottom:6}}>{cfg.label}</div>
        <div style={{fontSize:68,fontWeight:200,color:"#fff",fontVariantNumeric:"tabular-nums",lineHeight:1,letterSpacing:"-0.02em"}}>{fmtT(timeRemaining)}</div>
      </div>
    </div>
  );
}

// ─── WORKOUT CARD ─────────────────────────────────────────────────────────────
function WorkoutCard({workout, onStart, onEdit, onDelete}) {
  const total = workout.intervals.reduce((s,i)=>s+i.duration,0);
  const [ph,phSt] = usePress(0.98);
  const [menu,setMenu] = useState(false);
  const [menuPos,setMenuPos] = useState({top:0,right:0});
  const btnRef = useRef(null);
  const isProgram = PROGRAM_IDS.has(workout.id);

  const openMenu = (e) => {
    e.stopPropagation();
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({top:r.bottom+6, right:window.innerWidth-r.right});
    setMenu(true);
  };

  return (
    <div style={{animation:"slideUp 0.22s ease both"}}>
      <div {...ph} onClick={onStart}
        style={{...phSt,background:"linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"16px 18px",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,marginRight:8}}>
            <div style={{fontSize:17,fontWeight:500,color:"#fff",marginBottom:6}}>{workout.name}</div>
            <div style={{display:"flex",gap:14,marginBottom:10}}>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.4)",fontSize:13}}><Icons.Clock size={13}/>{fmtD(total)}</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.4)",fontSize:13}}><Icons.Zap size={13}/>{workout.intervals.length} инт.</span>
            </div>
            <IntervalBar intervals={workout.intervals}/>
          </div>
          {/* Только ··· — без отдельной кнопки редактирования */}
          <button ref={btnRef} onClick={openMenu}
            style={{background:"none",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",padding:"4px 6px",fontSize:20,lineHeight:1,letterSpacing:2,flexShrink:0}}>···</button>
        </div>
      </div>

      {menu && createPortal(
        <>
          <div onClick={()=>setMenu(false)} style={{position:"fixed",inset:0,zIndex:9998}}/>
          <div style={{position:"fixed",top:menuPos.top,right:menuPos.right,zIndex:9999,background:"#1e1e2e",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,overflow:"hidden",minWidth:180,boxShadow:"0 20px 48px rgba(0,0,0,0.8)",animation:"fadeIn 0.15s ease"}}>
            {!isProgram && (
              <button onClick={()=>{setMenu(false);onEdit();}} style={{display:"block",width:"100%",background:"none",border:"none",color:"#fff",padding:"13px 18px",textAlign:"left",cursor:"pointer",fontSize:15}}>
                ✏️ Редактировать
              </button>
            )}
            {!isProgram && <div style={{height:1,background:"rgba(255,255,255,0.07)"}}/>}
            <button onClick={()=>{setMenu(false);onDelete();}} style={{display:"block",width:"100%",background:"none",border:"none",color:"#f43f5e",padding:"13px 18px",textAlign:"left",cursor:"pointer",fontSize:15}}>
              🗑 Удалить
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── HISTORY CARD ─────────────────────────────────────────────────────────────
function HistoryCard({result,onClick}) {
  const done=result.completedIntervals===result.totalIntervals;
  const fmt=new Date(result.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const [ph,phSt]=usePress(0.98);
  return (
    <div {...ph} onClick={onClick} style={{...phSt,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 16px",cursor:"pointer",animation:"slideUp 0.2s ease both"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
        <div><div style={{fontSize:15,fontWeight:500,color:"#fff",marginBottom:3}}>{result.workoutName}</div>
          <div style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.3)",fontSize:12}}><Icons.Calendar size={11}/>{fmt}</div>
        </div>
        {done&&<Icons.CheckCircle size={18} style={{color:"#4ade80",flexShrink:0}}/>}
      </div>
      <div style={{display:"flex",gap:16}}>
        <span style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.4)",fontSize:13}}><Icons.Clock size={13}/>{fmtD(result.totalDuration)}</span>
        <span style={{fontSize:13,color:done?"#4ade80":"#fb923c"}}>{result.completedIntervals}/{result.totalIntervals} интервалов</span>
      </div>
    </div>
  );
}

// ─── PROGRAM CARD ─────────────────────────────────────────────────────────────
function ProgramCard({prog, onUse, alreadyAdded}) {
  const [open,setO]=useState(false);
  const [ph,phSt]=usePress(0.99);
  const lc=LVLC[prog.level]||"#fff";
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,overflow:"hidden",animation:"slideUp 0.2s ease both"}}>
      <div {...ph} onClick={()=>setO(v=>!v)} style={{...phSt,padding:"16px 18px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:lc,background:`${lc}18`,borderRadius:6,padding:"2px 8px"}}>{prog.levelLabel.toUpperCase()}</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{prog.goalLabel}</span>
              {alreadyAdded&&<span style={{fontSize:11,color:"#4ade80",background:"rgba(74,222,128,0.12)",borderRadius:6,padding:"2px 8px"}}>✓ В списке</span>}
            </div>
            <div style={{fontSize:16,fontWeight:500,color:"#fff",marginBottom:6}}>{prog.name}</div>
            <div style={{display:"flex",gap:12}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{prog.duration} мин</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{prog.intervals.length} интервалов</span>
            </div>
          </div>
          <div style={{fontSize:18,color:"rgba(255,255,255,0.3)",transform:open?"rotate(90deg)":"rotate(0)",transition:"transform 0.25s"}}>›</div>
        </div>
        <div style={{marginTop:10}}><IntervalBar intervals={prog.intervals}/></div>
      </div>
      {open&&(
        <div style={{padding:"0 18px 18px",borderTop:"1px solid rgba(255,255,255,0.06)",animation:"fadeIn 0.2s ease"}}>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:"14px 0"}}>{prog.description}</p>
          <button onClick={()=>onUse(prog)} disabled={alreadyAdded}
            style={{width:"100%",background:alreadyAdded?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${lc},${lc}99)`,border:"none",borderRadius:12,padding:"12px",color:alreadyAdded?"rgba(255,255,255,0.3)":"#000",fontSize:14,fontWeight:700,cursor:alreadyAdded?"default":"pointer"}}
            onPointerDown={e=>!alreadyAdded&&(e.currentTarget.style.transform="scale(0.97)")} onPointerUp={e=>e.currentTarget.style.transform="scale(1)"} onPointerLeave={e=>e.currentTarget.style.transform="scale(1)"}>
            {alreadyAdded ? "Уже добавлена в Мои" : "Начать / Добавить в Мои →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── INTERVAL ROW WITH DRAG ───────────────────────────────────────────────────
const SLIDE_W = 82;

function IntervalRow({interval, index, onChange, onDelete, dragProps, isDragging, dragOverIndex}) {
  const mins=Math.floor(interval.duration/60), secs=interval.duration%60;
  const cfg=IV[interval.type]||IV.slow;
  const startX=useRef(null), baseX=useRef(0), swiping=useRef(false);
  const [open,setOpen]=useState(false);
  const [liveOff,setLiveOff]=useState(0);
  const tx = open ? -SLIDE_W+liveOff : liveOff;
  const animated = !swiping.current;

  const [durationOpen, setDurationOpen] = useState(false);

  const onTS=(e)=>{
    // If this touch started on drag handle, skip swipe
    if(e.target.closest("[data-drag-handle]")) return;
    startX.current=e.touches[0].clientX; baseX.current=open?-SLIDE_W:0; swiping.current=true;
  };
  const onTM=(e)=>{
    if(startX.current===null||e.target.closest("[data-drag-handle]")) return;
    const dx=e.touches[0].clientX-startX.current;
    const next=Math.max(-SLIDE_W,Math.min(0,baseX.current+dx));
    setLiveOff(next-baseX.current);
  };
  const onTE=()=>{
    swiping.current=false;
    const final=baseX.current+liveOff;
    setOpen(final<-SLIDE_W/2);
    setLiveOff(0);
    startX.current=null;
  };

  return (
    <div style={{
      position:"relative", borderRadius:16, overflow:"hidden", marginBottom:10,
      transform: isDragging ? "scale(1.03)" : "scale(1)",
      opacity: isDragging ? 0.85 : 1,
      zIndex: isDragging ? 10 : 1,
      boxShadow: isDragging ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
      transition: isDragging ? "none" : "transform 0.2s ease, opacity 0.2s, box-shadow 0.2s",
    }}>
      {/* Delete button behind */}
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:70,background:"#7b1c1c",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3,opacity:open?1:0,transition:"opacity 0.2s",zIndex:0}}>
        <button onClick={()=>{setOpen(false);setTimeout(onDelete,180);}} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 12px"}}>
          <Icons.Trash size={18}/><span style={{fontSize:10,fontWeight:700}}>УДАЛИТЬ</span>
        </button>
      </div>

      {/* Main row */}
      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${cfg.color}28`,borderRadius:16,padding:"10px 12px",display:"flex",alignItems:"center",gap:8,transform:`translateX(${tx}px)`,transition:animated?"transform 0.25s cubic-bezier(0.4,0,0.2,1)":"none",position:"relative",zIndex:1,userSelect:"none",touchAction:"pan-y"}}>

        {/* Drag handle = номер */}
        <div data-drag-handle="1" {...dragProps}
          style={{minWidth:30,height:30,borderRadius:9,background:isDragging?"rgba(74,222,128,0.2)":"rgba(255,255,255,0.08)",border:`1px solid ${isDragging?"rgba(74,222,128,0.4)":"rgba(255,255,255,0.12)"}`,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:600,cursor:"grab",flexShrink:0,touchAction:"none",transition:"background 0.15s,border-color 0.15s"}}>
          {index+1}
        </div>

        {/* Type */}
        <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:11,padding:3,gap:2,flexShrink:0}}>
          {Object.entries(IV).map(([t,c])=>(
            <button key={t} onClick={()=>onChange({type:t})}
              style={{background:interval.type===t?c.color:"transparent",border:"none",borderRadius:8,width:34,height:34,fontSize:18,cursor:"pointer",transition:"background 0.18s",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {c.emoji}
            </button>
          ))}
        </div>

        {/* Label */}
        <div style={{fontSize:12,color:cfg.color,fontWeight:600,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cfg.label}</div>

        {/* Duration display — tap to open picker */}
        <button onClick={()=>setDurationOpen(true)}
          style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"6px 12px",color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>
          {fmtT(interval.duration)}
        </button>
      </div>

      {/* Duration picker modal */}
      {durationOpen && createPortal(
        <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,0.6)"}} onClick={()=>setDurationOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",animation:"slideUp 0.25s ease"}}>
            <div style={{fontSize:16,fontWeight:500,color:"#fff",marginBottom:20,textAlign:"center"}}>Длительность интервала</div>
            <DurationPicker duration={interval.duration} onChange={d=>onChange({duration:d})}/>
            <button onClick={()=>setDurationOpen(false)} style={{...greenBt,marginTop:24}}>Готово</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── DRAG-TO-REORDER LIST ─────────────────────────────────────────────────────
function SortableList({intervals, onChange, onDelete}) {
  const [dragging, setDragging] = useState(null);   // индекс
  const [dragOver, setDragOver] = useState(null);
  const [ghostY, setGhostY] = useState(0);
  const rowRefs = useRef([]);
  const startY = useRef(0);
  const startIdx = useRef(null);

  const handleDragStart = (index, e) => {
    const touch = e.touches[0];
    startY.current = touch.clientY;
    startIdx.current = index;
    setDragging(index);
    setDragOver(index);
    setGhostY(0);
  };

  const handleDragMove = useCallback((e) => {
    if (dragging === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy = touch.clientY - startY.current;
    setGhostY(dy);

    // Determine which row we're over
    const y = touch.clientY;
    let overIdx = dragging;
    rowRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      if (y > rect.top && y < rect.bottom) overIdx = i;
    });
    overIdx = Math.max(0, Math.min(intervals.length-1, overIdx));
    if (overIdx !== dragOver) setDragOver(overIdx);
  }, [dragging, dragOver, intervals.length]);

  const handleDragEnd = useCallback(() => {
    if (dragging !== null && dragOver !== null && dragging !== dragOver) {
      const arr = [...intervals];
      const [item] = arr.splice(dragging, 1);
      arr.splice(dragOver, 0, item);
      onChange(arr);
    }
    setDragging(null);
    setDragOver(null);
    setGhostY(0);
    startIdx.current = null;
  }, [dragging, dragOver, intervals, onChange]);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener("touchmove", handleDragMove, {passive:false});
      window.addEventListener("touchend", handleDragEnd);
      return () => {
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // Visual order: swap dragging and dragOver for preview
  const displayOrder = intervals.map((_,i)=>i);
  if (dragging !== null && dragOver !== null && dragging !== dragOver) {
    const arr = [...displayOrder];
    const [item] = arr.splice(dragging, 1);
    arr.splice(dragOver, 0, item);
    // We want to show intervals in this order
  }

  return (
    <div>
      {intervals.map((iv, i) => {
        const isDragging = dragging === i;
        const isDragTarget = dragOver === i && dragging !== null && dragging !== i;
        return (
          <div key={iv.id} ref={el=>rowRefs.current[i]=el}
            style={{
              transform: isDragging ? `translateY(${ghostY}px)` : isDragTarget ? "translateY(4px)" : "translateY(0)",
              transition: isDragging ? "none" : "transform 0.18s ease",
              zIndex: isDragging ? 10 : 1,
              position: "relative",
            }}>
            <IntervalRow
              interval={iv}
              index={i}
              onChange={u=>onChange(intervals.map(x=>x.id===iv.id?{...x,...u}:x))}
              onDelete={()=>onChange(intervals.filter(x=>x.id!==iv.id))}
              isDragging={isDragging}
              dragOverIndex={dragOver}
              dragProps={{
                onTouchStart: (e)=>{ e.stopPropagation(); handleDragStart(i,e); }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfilePage({navigate}) {
  const [profile,setProfile]=useState({name:"",age:"",weight:""});
  const [editing,setEditing]=useState(false);
  const [hasProfile,setHasProfile]=useState(false);
  const [loading,setLoading]=useState(true);
  const [ph,phSt]=usePress();

  useEffect(()=>{
    (async()=>{
      const p=await storage.getProfile();
      if(p&&(p.name||p.age||p.weight)){setProfile(p);setHasProfile(true);}
      else{const name=TG_USER?`${TG_USER.first_name||""} ${TG_USER.last_name||""}`.trim():"";setProfile(pr=>({...pr,name}));setEditing(true);}
      setLoading(false);
    })();
  },[]);

  const save=async()=>{await storage.saveProfile(profile);setHasProfile(true);setEditing(false);};
  const initials=(profile.name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  if(loading) return <Loader/>;

  return (
    <Page>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
        <button onClick={()=>navigate("home")} style={iconBtn}><Icons.ArrowLeft size={20}/></button>
        <h1 style={{fontSize:22,fontWeight:400,color:"#fff",margin:0,flex:1}}>Профиль</h1>
        {hasProfile&&!editing&&<button onClick={()=>setEditing(true)} style={iconBtn}><Icons.Edit size={17}/></button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
        <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,overflow:"hidden",boxShadow:"0 0 32px rgba(74,222,128,0.3)",animation:"scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>
          {TG_USER?.photo_url?<img src={TG_USER.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                              :<div style={{fontSize:28,fontWeight:600,color:"#000"}}>{initials}</div>}
        </div>
        {TG_USER&&<div style={{fontSize:14,color:"#fff",fontWeight:500,marginBottom:3}}>{`${TG_USER.first_name||""} ${TG_USER.last_name||""}`.trim()}</div>}
        {TG_USER?.username&&<div style={{fontSize:13,color:"rgba(255,255,255,0.35)"}}>@{TG_USER.username}</div>}
      </div>
      <div style={{background:tg?"rgba(74,222,128,0.07)":"rgba(255,255,255,0.03)",border:`1px solid ${tg?"rgba(74,222,128,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:14,padding:"11px 16px",marginBottom:24,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:tg?"#4ade80":"rgba(255,255,255,0.2)",flexShrink:0}}/>
        <div style={{fontSize:13,color:tg?"#4ade80":"rgba(255,255,255,0.35)"}}>{tg?"Данные синхронизируются через Telegram":"Локальное хранилище"}</div>
      </div>
      {hasProfile&&!editing&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[{label:"Имя",value:profile.name||"—"},{label:"Возраст",value:profile.age?`${profile.age} лет`:"—"},{label:"Вес",value:profile.weight?`${profile.weight} кг`:"—"}].map((f,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
              <div style={{fontSize:17,color:"#fff",fontWeight:500}}>{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {editing&&(
        <>
          <div style={{marginBottom:16}}>
            <div style={fldLbl}>Имя</div>
            <input value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} placeholder="Введите имя" style={inputSt}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            {[{k:"age",l:"Возраст",s:"лет"},{k:"weight",l:"Вес",s:"кг"}].map(f=>(
              <div key={f.k}>
                <div style={fldLbl}>{f.l}</div>
                <div style={{position:"relative"}}>
                  <input type="number" value={profile[f.k]} onChange={e=>setProfile(p=>({...p,[f.k]:e.target.value}))} placeholder="—" style={{...inputSt,paddingRight:36}}/>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:13,pointerEvents:"none"}}>{f.s}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            {hasProfile&&<button onClick={()=>setEditing(false)} style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>Отмена</button>}
            <button onClick={save} {...ph} style={{...greenBt,...phSt,flex:2}}>Сохранить</button>
          </div>
        </>
      )}
    </Page>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
const TABS=[{id:"my",label:"Мои",icon:<Icons.Star size={14}/>},{id:"programs",label:"Программы",icon:<Icons.BookOpen size={14}/>},{id:"history",label:"История",icon:<Icons.Clock size={14}/>}];

function HomePage({navigate}) {
  const [tab,setTab]=useState("my");
  const [workouts,setWS]=useState([]);
  const [history,setHist]=useState([]);
  const [lvl,setLvl]=useState("all");
  const [loading,setLoad]=useState(true);
  const [profile,setProfile]=useState(null);
  const [cph,cphSt]=usePress(0.97);

  const load=useCallback(async()=>{
    const [ws,rs,pr]=await Promise.all([storage.getWorkouts(),storage.getResults(),storage.getProfile()]);
    setWS(ws);setHist([...rs].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)));setProfile(pr);setLoad(false);
  },[]);

  useEffect(()=>{load();window.addEventListener("focus",load);return()=>window.removeEventListener("focus",load);},[load]);

  const startProg=async(prog)=>{
    // Проверяем — если уже есть такая программа, просто запускаем
    const existing=workouts.find(w=>w.id===prog.id);
    if(existing){navigate("workout",existing.id);return;}
    // Сохраняем с ID программы — чтобы не дублировать
    const w={id:prog.id,name:prog.name,intervals:prog.intervals.map(iv=>({...iv,id:uid()}))};
    await storage.saveWorkout(w);
    navigate("workout",w.id);
  };

  const delW=async(id)=>{await storage.deleteWorkout(id);load();};
  const filtered=lvl==="all"?PROGRAMS:PROGRAMS.filter(p=>p.level===lvl);
  const firstName=(profile?.name||TG_USER?.first_name||"").trim().split(" ")[0];
  const addedProgramIds=new Set(workouts.filter(w=>PROGRAM_IDS.has(w.id)).map(w=>w.id));

  if(loading) return <Loader/>;

  return (
    <Page>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div>
          <div style={{fontSize:11,letterSpacing:"0.14em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:4}}>Велотренировки</div>
          <h1 style={{fontSize:28,fontWeight:300,color:"#fff",margin:0}}>{firstName?`Привет,\u00A0${firstName}!`:"Тренировки"}</h1>
        </div>
        <button onClick={()=>navigate("profile")} style={{...iconBtn,background:tg?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.06)",borderColor:tg?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.08)"}}>
          <Icons.User size={18} style={{color:tg?"#4ade80":"#fff"}}/>
        </button>
      </div>
      <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:14,padding:3,marginBottom:22,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 6px",borderRadius:11,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.2s",background:tab===t.id?"rgba(255,255,255,0.1)":"transparent",color:tab===t.id?"#fff":"rgba(255,255,255,0.4)"}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab==="my"&&<>
        <button onClick={()=>navigate("create")} {...cph} style={{...cphSt,width:"100%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:18,padding:"17px 20px",cursor:"pointer",marginBottom:18,display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 28px rgba(74,222,128,0.28)"}}>
          <div style={{width:34,height:34,background:"rgba(0,0,0,0.15)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}><Icons.Plus size={18} style={{color:"#000"}}/></div>
          <span style={{fontSize:16,fontWeight:700,color:"#000"}}>Создать тренировку</span>
        </button>
        {workouts.length>0
          ?<div style={{display:"flex",flexDirection:"column",gap:10}}>{workouts.map(w=><WorkoutCard key={w.id} workout={w} onStart={()=>navigate("workout",w.id)} onEdit={()=>navigate("edit",w.id)} onDelete={()=>delW(w.id)}/>)}</div>
          :<div style={{textAlign:"center",padding:"48px 0",color:"rgba(255,255,255,0.2)"}}><div style={{fontSize:44,marginBottom:10}}>🚴</div><div style={{fontSize:16,marginBottom:6}}>Нет тренировок</div><div style={{fontSize:13}}>Создайте свою или выберите программу</div></div>
        }
      </>}

      {tab==="programs"&&<>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {[["all","Все"],["beginner","Новичок"],["intermediate","Опытный"],["pro","Профи"]].map(([v,l])=>(
            <button key={v} onClick={()=>setLvl(v)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,transition:"all 0.2s",background:lvl===v?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)",color:lvl===v?"#fff":"rgba(255,255,255,0.4)"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>{filtered.map(p=><ProgramCard key={p.id} prog={p} onUse={startProg} alreadyAdded={addedProgramIds.has(p.id)}/>)}</div>
      </>}

      {tab==="history"&&(history.length>0
        ?<div style={{display:"flex",flexDirection:"column",gap:8}}>{history.map(r=><HistoryCard key={r.id} result={r} onClick={()=>navigate("details",r.id)}/>)}</div>
        :<div style={{textAlign:"center",padding:"64px 0",color:"rgba(255,255,255,0.2)"}}><div style={{fontSize:44,marginBottom:10}}>📋</div><div style={{fontSize:16,marginBottom:6}}>История пуста</div></div>
      )}
    </Page>
  );
}

// ─── CREATE / EDIT ────────────────────────────────────────────────────────────
function CreatePage({navigate,editId}) {
  const [name,setName]=useState("");
  const [intervals,setIV]=useState([]);
  const [loading,setLoad]=useState(!!editId);
  const [sph,sphSt]=usePress();

  useEffect(()=>{
    (async()=>{
      if(editId){const w=await storage.getWorkoutById(editId);if(w){setName(w.name);setIV(w.intervals);}}
      else setIV([{id:uid(),type:"slow",duration:180},{id:uid(),type:"fast",duration:60},{id:uid(),type:"slow",duration:120}]);
      setLoad(false);
    })();
  },[editId]);

  const total=intervals.reduce((s,i)=>s+i.duration,0);

  const save=async()=>{
    if(!name.trim()){alert("Введите название");return;}
    if(!intervals.length){alert("Добавьте интервал");return;}
    await storage.saveWorkout({id:editId||uid(),name:name.trim(),intervals});
    navigate("home");
  };

  if(loading) return <Loader/>;

  return (
    <Page>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={()=>navigate("home")} style={iconBtn}><Icons.ArrowLeft size={20}/></button>
        <h1 style={{fontSize:22,fontWeight:400,color:"#fff",margin:0}}>{editId?"Редактировать":"Создать тренировку"}</h1>
      </div>
      <div style={{marginBottom:20}}>
        <div style={fldLbl}>Название</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Моя тренировка" style={inputSt}/>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={fldLbl}>Интервалы</div>
          {total>0&&<div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>{fmtD(total)}</div>}
        </div>
        {intervals.length>0&&<div style={{marginBottom:12}}><IntervalBar intervals={intervals} height={6}/></div>}
        <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",marginBottom:14}}>Зажмите номер и тащите · Свайп влево — удалить · Нажмите время — выбрать</div>
        <SortableList intervals={intervals} onChange={setIV} onDelete={id=>setIV(p=>p.filter(x=>x.id!==id))}/>
        <button onClick={()=>setIV(p=>[...p,{id:uid(),type:"medium",duration:60}])}
          style={{width:"100%",background:"transparent",border:"2px dashed rgba(255,255,255,0.1)",borderRadius:14,color:"rgba(255,255,255,0.35)",fontSize:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"border-color 0.2s,color 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(250,204,21,0.4)";e.currentTarget.style.color="#facc15";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="rgba(255,255,255,0.35)";}}>
          <Icons.Plus size={16}/>Добавить интервал
        </button>
      </div>
      <button onClick={save} {...sph} style={{...greenBt,...sphSt}}>Сохранить тренировку</button>
    </Page>
  );
}

// ─── ACTIVE WORKOUT (с фоновым таймером) ─────────────────────────────────────
// Сохраняем состояние таймера в localStorage — если приложение перезагрузится,
// таймер восстановится с правильного места на основе реального времени.
const TIMER_KEY = "bw_active_timer";

function saveTimerState(state) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(state));
}
function clearTimerState() {
  localStorage.removeItem(TIMER_KEY);
}
function loadTimerState() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
}

function ActiveWorkoutPage({navigate,workoutId}) {
  const [workout,setWO]=useState(null);
  const [phase,setPhase]=useState("ready");
  const [countdown,setCD]=useState(3);
  const [ivIdx,setIdx]=useState(0);
  const [timeLeft,setTL]=useState(0);
  const [elapsed,setElapsed]=useState(0);

  const timerRef  = useRef(null);
  const elRef     = useRef(0);
  const ivRef     = useRef(0);
  const woRef     = useRef(null);
  // Реальное время старта текущего интервала (для восстановления после сворачивания)
  const intervalStartTs = useRef(null);
  const intervalInitDur = useRef(0);
  const workoutStartTs  = useRef(null);

  const [pph,pphSt]=usePress(0.93);
  const [sph2,sphSt2]=usePress(0.93);

  // Загрузка тренировки + восстановление из localStorage
  useEffect(()=>{
    (async()=>{
      const w=await storage.getWorkoutById(workoutId);
      if(!w){navigate("home");return;}
      setWO(w);woRef.current=w;

      // Пытаемся восстановить сохранённый таймер
      const saved=loadTimerState();
      if(saved && saved.workoutId===workoutId && saved.phase==="running"){
        const now=Date.now();
        const passedSinceIntervalStart=Math.floor((now-saved.intervalStartTs)/1000);
        const remaining=Math.max(0,saved.intervalInitDur-passedSinceIntervalStart);
        const totalElapsed=Math.floor((now-saved.workoutStartTs)/1000);

        ivRef.current=saved.ivIdx;
        elRef.current=totalElapsed;
        intervalStartTs.current=saved.intervalStartTs;
        intervalInitDur.current=saved.intervalInitDur;
        workoutStartTs.current=saved.workoutStartTs;

        setIdx(saved.ivIdx);
        setElapsed(totalElapsed);
        setTL(remaining);
        setPhase("running");
      } else {
        setTL(w.intervals[0]?.duration||0);
      }
    })();
  },[workoutId]);

  // Countdown
  useEffect(()=>{
    if(phase!=="countdown") return;
    if(countdown<=0){
      const dur=woRef.current.intervals[0].duration;
      intervalStartTs.current=Date.now();
      intervalInitDur.current=dur;
      workoutStartTs.current=Date.now();
      setTL(dur);
      setPhase("running");
      return;
    }
    const t=setTimeout(()=>setCD(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[phase,countdown]);

  // Main interval timer
  useEffect(()=>{
    if(phase!=="running"||!woRef.current) return;

    const tick=()=>{
      const now=Date.now();
      // Рассчитываем оставшееся время на основе реального времени
      const passedInInterval=Math.floor((now-intervalStartTs.current)/1000);
      const remaining=Math.max(0,intervalInitDur.current-passedInInterval);
      const totalEl=Math.floor((now-(workoutStartTs.current||now))/1000);

      elRef.current=totalEl;
      setElapsed(totalEl);
      setTL(remaining);

      // Сохраняем состояние для восстановления
      saveTimerState({
        workoutId:woRef.current.id,
        phase:"running",
        ivIdx:ivRef.current,
        intervalStartTs:intervalStartTs.current,
        intervalInitDur:intervalInitDur.current,
        workoutStartTs:workoutStartTs.current,
      });

      if(remaining<=0){
        const next=ivRef.current+1;
        if(next<woRef.current.intervals.length){
          ivRef.current=next;
          intervalStartTs.current=Date.now();
          intervalInitDur.current=woRef.current.intervals[next].duration;
          setIdx(next);
        } else {
          clearInterval(timerRef.current);
          clearTimerState();
          setPhase("done");
          const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elRef.current,completedIntervals:woRef.current.intervals.length,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
          storage.saveResult(r).then(()=>setTimeout(()=>navigate("results",r.id),400));
        }
      }
    };

    timerRef.current=setInterval(tick,500); // обновляем каждые 500мс для точности
    return()=>clearInterval(timerRef.current);
  },[phase,ivIdx]);

  // Восстановление после выхода из фона (Page Visibility API)
  useEffect(()=>{
    const onVisibility=()=>{
      if(!document.hidden && phase==="running"){
        // Принудительно пересчитать — следующий тик сам всё обновит
        // Просто перезапускаем, чтобы интервал не задержался
      }
    };
    document.addEventListener("visibilitychange",onVisibility);
    return()=>document.removeEventListener("visibilitychange",onVisibility);
  },[phase]);

  const playPause=()=>{
    if(phase==="ready"){setCD(3);setPhase("countdown");}
    else if(phase==="running"){
      clearInterval(timerRef.current);
      clearTimerState();
      setPhase("paused");
    }
    else if(phase==="paused"){
      // При снятии с паузы сдвигаем intervalStartTs
      intervalStartTs.current=Date.now()-(intervalInitDur.current-timeLeft)*1000;
      setPhase("running");
    }
  };

  const stop=async()=>{
    clearInterval(timerRef.current);
    clearTimerState();
    if(phase==="ready"){navigate("home");return;}
    const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elRef.current,completedIntervals:ivRef.current,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
    await storage.saveResult(r);
    navigate("results",r.id);
  };

  if(!workout) return <Loader/>;
  const curr=workout.intervals[ivIdx],next=workout.intervals[ivIdx+1],nc=next?IV[next.type]:null;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#08080f,#0d1117,#060608)",color:"#fff",display:"flex",flexDirection:"column",paddingTop:SAFE_TOP}}>
      <div style={{padding:"12px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:17,fontWeight:400}}>{workout.name}</div><div style={{fontSize:13,color:"rgba(255,255,255,0.3)",marginTop:2}}>{ivIdx+1} / {workout.intervals.length} интервал</div></div>
        <button onClick={stop} style={iconBtn}><Icons.X size={20}/></button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
        {phase==="countdown"
          ?<div style={{textAlign:"center",animation:"scaleIn 0.3s ease"}}><div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:16,letterSpacing:"0.12em"}}>ПРИГОТОВЬТЕСЬ</div><div style={{fontSize:120,fontWeight:200,lineHeight:1,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{countdown||"GO!"}</div></div>
          :<div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
            <CircularTimer timeRemaining={timeLeft} totalTime={curr.duration} intervalType={curr.type} isWarning={timeLeft<=5&&phase==="running"}/>
            {next&&<div style={{marginTop:20,textAlign:"center",opacity:0.55}}><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4,letterSpacing:"0.1em"}}>СЛЕДУЮЩИЙ</div><div style={{fontSize:14,color:nc?.color||"#fff"}}>{nc?.emoji} {nc?.label} — {fmtT(next.duration)}</div></div>}
            <div style={{display:"flex",gap:5,marginTop:24,alignItems:"center"}}>{workout.intervals.map((_,i)=><div key={i} style={{height:5,width:i===ivIdx?22:i<ivIdx?14:10,borderRadius:3,background:i<ivIdx?IV[workout.intervals[i].type]?.color||"#4ade80":i===ivIdx?"#fff":"rgba(255,255,255,0.12)",transition:"all 0.4s"}}/>)}</div>
            {phase==="paused"&&<div style={{marginTop:16,fontSize:13,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em"}}>⏸ ПАУЗА</div>}
          </div>
        }
      </div>
      {phase!=="countdown"&&(
        <div style={{padding:"20px 20px 44px",display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
          <button onClick={stop} {...sph2} style={{...sphSt2,width:54,height:54,borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}><Icons.Stop size={20}/></button>
          <button onClick={playPause} {...pph} style={{...pphSt,width:78,height:78,borderRadius:"50%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 0 36px rgba(74,222,128,0.4)",color:"#000"}}>
            {phase==="running"?<Icons.Pause size={28}/>:<Icons.Play size={28}/>}
          </button>
          <div style={{width:54,textAlign:"center"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginBottom:3,letterSpacing:"0.1em"}}>ПРОШЛО</div><div style={{fontSize:15,fontWeight:500,color:"rgba(255,255,255,0.5)",fontVariantNumeric:"tabular-nums"}}>{fmtT(elapsed)}</div></div>
        </div>
      )}
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  const [ph,phSt]=usePress();
  useEffect(()=>{storage.getResultById(resultId).then(r=>{if(!r)navigate("home");else setR(r);});},[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#08080f,#060608)",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px"}}>
      <div style={{width:110,height:110,borderRadius:"50%",background:done?"linear-gradient(135deg,#4ade80,#22d3ee)":"linear-gradient(135deg,#fb923c,#f43f5e)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:done?"0 0 60px rgba(74,222,128,0.4)":"0 0 60px rgba(251,146,60,0.4)",marginBottom:24,animation:"scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
        {done?<Icons.Trophy size={52} style={{color:"#000"}}/>:<Icons.Target size={46} style={{color:"#fff"}}/>}
      </div>
      <h1 style={{fontSize:32,fontWeight:300,marginBottom:8,textAlign:"center"}}>{done?"Отличная работа!":"Тренировка завершена"}</h1>
      <p style={{color:"rgba(255,255,255,0.4)",marginBottom:32,textAlign:"center",fontSize:15}}>{done?"Все интервалы выполнены":"Результат сохранён"}</p>
      <div style={{width:"100%",maxWidth:400,display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
        {[
          {icon:<Icons.Zap size={20} style={{color:"#4ade80"}} fill="#4ade80"/>,bg:"rgba(74,222,128,0.1)",brd:"rgba(74,222,128,0.2)",label:"Тренировка",val:result.workoutName,vc:"#4ade80"},
          {icon:<Icons.Clock size={20} style={{color:"#22d3ee"}}/>,bg:"rgba(255,255,255,0.04)",brd:"rgba(255,255,255,0.07)",label:"Время",val:fmtD(result.totalDuration),vc:"#fff"},
          {icon:<Icons.Target size={20} style={{color:"#a78bfa"}}/>,bg:"rgba(255,255,255,0.04)",brd:"rgba(255,255,255,0.07)",label:"Интервалы",val:`${result.completedIntervals} / ${result.totalIntervals}`,vc:"#fff"},
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,border:`1px solid ${s.brd}`,borderRadius:16,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,animation:`slideUp 0.3s ${0.15+i*0.07}s ease both`}}>
            <div style={{width:42,height:42,background:"rgba(255,255,255,0.06)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.icon}</div>
            <div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{s.label}</div><div style={{fontSize:18,fontWeight:500,color:s.vc}}>{s.val}</div></div>
          </div>
        ))}
      </div>
      <button onClick={()=>navigate("home")} {...ph} style={{...greenBt,...phSt,maxWidth:400}}>На главную</button>
    </div>
  );
}

// ─── DETAILS ──────────────────────────────────────────────────────────────────
function DetailsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  const [ph,phSt]=usePress();
  useEffect(()=>{storage.getResultById(resultId).then(r=>{if(!r)navigate("home");else setR(r);});},[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  const date=new Date(result.completedAt);
  return (
    <div style={{...pageSt,paddingTop:SAFE_TOP+8,animation:"pageIn 0.22s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.07)",paddingBottom:16,marginBottom:22}}>
        <button onClick={()=>navigate("home")} style={iconBtn}><Icons.ArrowLeft size={20}/></button>
        <h1 style={{fontSize:19,fontWeight:400,margin:0}}>Детали тренировки</h1>
      </div>
      <div style={{textAlign:"center",padding:"16px 0 24px"}}>
        <h2 style={{fontSize:24,fontWeight:400,marginBottom:10,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{result.workoutName}</h2>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:done?"#4ade80":"#fb923c",fontSize:14}}>
          {done?<Icons.CheckCircle size={16}/>:<Icons.Target size={16}/>}<span>{done?"Завершено":"Частично завершено"}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {icon:<Icons.Calendar size={20} style={{color:"#60a5fa"}}/>,bg:"rgba(96,165,250,0.12)",label:"Дата",val:<><div style={{fontSize:14,textTransform:"capitalize"}}>{date.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</div><div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>{date.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></>},
          {icon:<Icons.Clock size={20} style={{color:"#4ade80"}}/>,bg:"rgba(74,222,128,0.12)",label:"Длительность",val:<div style={{fontSize:20}}>{fmtD(result.totalDuration)}</div>},
          {icon:<Icons.Target size={20} style={{color:"#a78bfa"}}/>,bg:"rgba(167,139,250,0.12)",label:"Интервалы",val:<><div style={{fontSize:20}}>{result.completedIntervals} из {result.totalIntervals}</div><div style={{display:"flex",gap:3,marginTop:8}}>{Array.from({length:result.totalIntervals}).map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<result.completedIntervals?"#4ade80":"rgba(255,255,255,0.08)"}}/>)}</div></>},
        ].map((c,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:15,padding:"14px 16px",display:"flex",gap:13}}>
            <div style={{width:42,height:42,background:c.bg,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:5}}>{c.label}</div>{c.val}</div>
          </div>
        ))}
      </div>
      <button onClick={()=>navigate("home")} {...ph} style={{...greenBt,...phSt,marginTop:22}}>На главную</button>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage]=useState(()=>{
    // Если при запуске есть сохранённый активный таймер — идём прямо в тренировку
    const saved=loadTimerState();
    return saved ? "workout" : "home";
  });
  const [param,setParam]=useState(()=>{
    const saved=loadTimerState();
    return saved ? saved.workoutId : null;
  });

  const navigate=(to,p=null)=>{setParam(p);setPage(to);window.scrollTo(0,0);};

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=`
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      body{margin:0;padding:0;background:#060608;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;}
      ::-webkit-scrollbar{display:none;}
      @keyframes scaleIn{from{transform:scale(0.4);opacity:0;}to{transform:scale(1);opacity:1;}}
      @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
      @keyframes slideUp{from{transform:translateY(14px);opacity:0;}to{transform:translateY(0);opacity:1;}}
      @keyframes pageIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    `;
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);

  if(page==="home")    return <HomePage    navigate={navigate}/>;
  if(page==="create")  return <CreatePage  navigate={navigate} editId={null}/>;
  if(page==="edit")    return <CreatePage  navigate={navigate} editId={param}/>;
  if(page==="workout") return <ActiveWorkoutPage navigate={navigate} workoutId={param}/>;
  if(page==="results") return <ResultsPage navigate={navigate} resultId={param}/>;
  if(page==="details") return <DetailsPage navigate={navigate} resultId={param}/>;
  if(page==="profile") return <ProfilePage navigate={navigate}/>;
  return <HomePage navigate={navigate}/>;
}
