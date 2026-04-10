import { useState, useEffect, useRef, useCallback } from "react";

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;

if (tg) {
  // 1. Сначала говорим Telegram, что приложение готово
  tg.ready();

  // 2. Растягиваем на максимальную высоту (старый способ)
  tg.expand();

  // 3. Пытаемся перейти в настоящий Fullscreen (новый способ)
  if (tg.requestFullscreen && !tg.isFullscreen) {
    tg.requestFullscreen()
      .catch((err) => {
        console.warn('requestFullscreen не сработал:', err);
        // Здесь можно обработать ошибку, например показать пользователю кнопку
      });
  }

  // 4. Слушаем события (полезно для отладки)
  tg.onEvent('fullscreenChanged', () => {
    console.log('Fullscreen состояние изменилось:', tg.isFullscreen);
  });

  tg.onEvent('fullscreenFailed', (data) => {
    console.error('Fullscreen failed:', data.error); // UNSUPPORTED или ALREADY_FULLSCREEN
  });
}

// Получаем пользователя
const TG_USER = tg?.initDataUnsafe?.user || null;
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
  GripV:       p=><Icon {...p} d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" strokeWidth={3}/>,
};

// ─── INTERVAL CONFIG ──────────────────────────────────────────────────────────
const IV = {
  slow:   {label:"Медленно", emoji:"🐢", color:"#4ade80", glow:"rgba(74,222,128,0.45)", bg:"rgba(74,222,128,0.12)", desc:"Разминка / восстановление"},
  medium: {label:"Средне",   emoji:"🚴", color:"#facc15", glow:"rgba(250,204,21,0.45)",  bg:"rgba(250,204,21,0.12)",  desc:"Рабочий темп"},
  fast:   {label:"Быстро",   emoji:"⚡", color:"#c0392b", glow:"rgba(192,57,43,0.45)",   bg:"rgba(192,57,43,0.12)",   desc:"Спринт"},
};

// ─── PROGRAMS ─────────────────────────────────────────────────────────────────
const PROGRAMS = [
  {id:"b1",level:"beginner",levelLabel:"Новичок",goal:"fat",goalLabel:"Жиросжигание",name:"Старт: сжигание жира",duration:25,description:"Мягкий вход в тренировки. Длинные медленные интервалы с короткими ускорениями. Пульс 60–70% от максимума — идеальная зона для сжигания жира.",intervals:[{id:"b1a",type:"slow",duration:300},{id:"b1b",type:"medium",duration:120},{id:"b1c",type:"slow",duration:180},{id:"b1d",type:"medium",duration:120},{id:"b1e",type:"slow",duration:180},{id:"b1f",type:"medium",duration:120},{id:"b1g",type:"slow",duration:480}]},
  {id:"b2",level:"beginner",levelLabel:"Новичок",goal:"endurance",goalLabel:"Выносливость",name:"Базовая выносливость",duration:20,description:"Равномерная нагрузка для тренировки сердечно-сосудистой системы. Без резких скачков пульса — безопасно для начинающих.",intervals:[{id:"b2a",type:"slow",duration:240},{id:"b2b",type:"medium",duration:240},{id:"b2c",type:"slow",duration:120},{id:"b2d",type:"medium",duration:240},{id:"b2e",type:"slow",duration:120},{id:"b2f",type:"medium",duration:240}]},
  {id:"i1",level:"intermediate",levelLabel:"Опытный",goal:"fat",goalLabel:"Жиросжигание",name:"HIIT: жиросжигание",duration:30,description:"Классические интервалы высокой интенсивности. Чередование спринтов и восстановления разгоняет метаболизм на 24–48 часов после тренировки.",intervals:[{id:"i1w",type:"slow",duration:300},...Array.from({length:7},(_,i)=>[{id:`i1f${i}`,type:"fast",duration:30},{id:`i1r${i}`,type:"slow",duration:90}]).flat(),{id:"i1c",type:"slow",duration:300}]},
  {id:"i2",level:"intermediate",levelLabel:"Опытный",goal:"endurance",goalLabel:"Выносливость",name:"Пирамида выносливости",duration:35,description:"Нагрузка нарастает и спадает волнами. Отличный способ увеличить аэробную мощность без риска перетренироваться.",intervals:[{id:"i2a",type:"slow",duration:300},{id:"i2b",type:"medium",duration:120},{id:"i2c",type:"fast",duration:60},{id:"i2d",type:"medium",duration:120},{id:"i2e",type:"fast",duration:90},{id:"i2f",type:"medium",duration:120},{id:"i2g",type:"fast",duration:120},{id:"i2h",type:"medium",duration:120},{id:"i2i",type:"fast",duration:90},{id:"i2j",type:"medium",duration:120},{id:"i2k",type:"fast",duration:60},{id:"i2l",type:"medium",duration:120},{id:"i2m",type:"slow",duration:300}]},
  {id:"p1",level:"pro",levelLabel:"Профи",goal:"fat",goalLabel:"Жиросжигание",name:"Табата на велосипеде",duration:20,description:"Японский протокол Табата: 20 сек максимального усилия, 10 сек отдыха. Научно доказан как самый эффективный метод жиросжигания. Не рекомендуется при проблемах с сердцем.",intervals:[{id:"p1w",type:"slow",duration:300},...Array.from({length:8},(_,i)=>[{id:`p1f${i}`,type:"fast",duration:20},{id:`p1r${i}`,type:"slow",duration:10}]).flat(),{id:"p1m",type:"slow",duration:180},...Array.from({length:8},(_,i)=>[{id:`p1g${i}`,type:"fast",duration:20},{id:`p1s${i}`,type:"slow",duration:10}]).flat(),{id:"p1c",type:"slow",duration:300}]},
  {id:"p2",level:"pro",levelLabel:"Профи",goal:"endurance",goalLabel:"Выносливость",name:"VO2max — предел возможного",duration:45,description:"Интервалы на уровне максимального потребления кислорода. Развивает пиковую аэробную мощность. Только для подготовленных спортсменов.",intervals:[{id:"p2a",type:"slow",duration:600},{id:"p2b",type:"medium",duration:180},{id:"p2c",type:"fast",duration:180},{id:"p2d",type:"medium",duration:180},{id:"p2e",type:"fast",duration:180},{id:"p2f",type:"medium",duration:180},{id:"p2g",type:"fast",duration:180},{id:"p2h",type:"medium",duration:180},{id:"p2i",type:"fast",duration:180},{id:"p2j",type:"medium",duration:180},{id:"p2k",type:"slow",duration:600}]},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtD = (s) => { const m=Math.floor(s/60),sec=s%60; if(m&&sec) return `${m} мин ${sec} сек`; if(m) return `${m} мин`; return `${sec} сек`; };
const fmtT = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const pageSt  = {minHeight:"100vh",background:"linear-gradient(160deg,#0a0a14,#0d1117,#060608)",color:"#fff",padding:"20px",boxSizing:"border-box"};
const iconBtn = {width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",cursor:"pointer",flexShrink:0};
const fldLbl  = {fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,letterSpacing:"0.08em",textTransform:"uppercase"};
const inputSt = {width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:"#fff",fontSize:16,padding:"13px 16px",outline:"none",boxSizing:"border-box"};
const greenBt = {width:"100%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:14,padding:"16px",color:"#000",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 24px rgba(74,222,128,0.25)"};
const menuBSt = {display:"block",width:"100%",background:"none",border:"none",color:"#fff",padding:"13px 18px",textAlign:"left",cursor:"pointer",fontSize:15};
const LVLC    = {beginner:"#4ade80",intermediate:"#facc15",pro:"#f43f5e"};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{...pageSt,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>🚴</div><div style={{color:"rgba(255,255,255,0.3)",fontSize:15}}>Загрузка...</div></div>
    </div>
  );
}

function IntervalBar({intervals,height=5}) {
  if(!intervals?.length) return null;
  return (
    <div style={{display:"flex",gap:2,height,borderRadius:height/2,overflow:"hidden"}}>
      {intervals.map((iv,i)=><div key={i} style={{flex:iv.duration||1,background:IV[iv.type]?.color||"#4ade80",minWidth:3,borderRadius:height/2}}/>)}
    </div>
  );
}

function CircularTimer({timeRemaining,totalTime,intervalType,isWarning}) {
  const cfg=IV[intervalType]||IV.slow, R=128, circ=2*Math.PI*R;
  const offset=circ*(1-(totalTime>0?timeRemaining/totalTime:0));
  const color=isWarning?"#ef4444":cfg.color, glow=isWarning?"rgba(239,68,68,0.5)":cfg.glow;
  return (
    <div style={{position:"relative",width:296,height:296}}>
      <svg width={296} height={296} style={{transform:"rotate(-90deg)"}}>
        <circle cx={148} cy={148} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14}/>
        <circle cx={148} cy={148} r={R} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{transition:"stroke-dashoffset 0.85s cubic-bezier(0.4,0,0.2,1),stroke 0.4s",filter:`drop-shadow(0 0 18px ${glow})`}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:28,marginBottom:4}}>{cfg.emoji}</div>
        <div style={{fontSize:13,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color,marginBottom:6}}>{cfg.label}</div>
        <div style={{fontSize:68,fontWeight:200,color:"#fff",fontVariantNumeric:"tabular-nums",lineHeight:1,letterSpacing:"-0.02em"}}>{fmtT(timeRemaining)}</div>
      </div>
    </div>
  );
}

function WorkoutCard({workout,onStart,onEdit,onDelete}) {
  const total=workout.intervals.reduce((s,i)=>s+i.duration,0);
  const [pressed,setP]=useState(false),[menu,setM]=useState(false);
  return (
    <div style={{position:"relative"}}>
      <div onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)} onClick={onStart}
        style={{background:"linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"16px 18px",cursor:"pointer",transform:pressed?"scale(0.98)":"scale(1)",transition:"transform 0.15s",boxShadow:pressed?"none":"0 4px 20px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,marginRight:8}}>
            <div style={{fontSize:17,fontWeight:500,color:"#fff",marginBottom:6}}>{workout.name}</div>
            <div style={{display:"flex",gap:14,marginBottom:10}}>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.4)",fontSize:13}}><Icons.Clock size={13}/>{fmtD(total)}</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.4)",fontSize:13}}><Icons.Zap size={13}/>{workout.intervals.length} инт.</span>
            </div>
            <IntervalBar intervals={workout.intervals}/>
          </div>
          <button onClick={e=>{e.stopPropagation();setM(v=>!v);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",padding:"0 0 0 8px",fontSize:22,lineHeight:1,flexShrink:0}}>···</button>
        </div>
      </div>
      {menu&&<>
        <div onClick={()=>setM(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
        <div style={{position:"absolute",right:0,top:"100%",marginTop:6,background:"#1a1a26",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,overflow:"hidden",zIndex:100,minWidth:160,boxShadow:"0 16px 40px rgba(0,0,0,0.5)"}}>
          <button onClick={()=>{setM(false);onEdit();}} style={menuBSt}>Редактировать</button>
          <div style={{height:1,background:"rgba(255,255,255,0.06)"}}/>
          <button onClick={()=>{setM(false);onDelete();}} style={{...menuBSt,color:"#f43f5e"}}>Удалить</button>
        </div>
      </>}
    </div>
  );
}

function HistoryCard({result,onClick}) {
  const done=result.completedIntervals===result.totalIntervals;
  const fmt=new Date(result.completedAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const [pressed,setP]=useState(false);
  return (
    <div onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)} onClick={onClick}
      style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 16px",cursor:"pointer",transform:pressed?"scale(0.98)":"scale(1)",transition:"transform 0.15s"}}>
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

function ProgramCard({prog,onUse}) {
  const [open,setO]=useState(false),[pressed,setP]=useState(false);
  const lc=LVLC[prog.level]||"#fff";
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,overflow:"hidden"}}>
      <div onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)} onClick={()=>setO(v=>!v)}
        style={{padding:"16px 18px",cursor:"pointer",transform:pressed?"scale(0.99)":"scale(1)",transition:"transform 0.15s"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:lc,background:`${lc}18`,borderRadius:6,padding:"2px 8px"}}>{prog.levelLabel.toUpperCase()}</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{prog.goalLabel}</span>
            </div>
            <div style={{fontSize:16,fontWeight:500,color:"#fff",marginBottom:6}}>{prog.name}</div>
            <div style={{display:"flex",gap:12}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{prog.duration} мин</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{prog.intervals.length} интервалов</span>
            </div>
          </div>
          <div style={{fontSize:18,color:"rgba(255,255,255,0.3)",transform:open?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s"}}>›</div>
        </div>
        <div style={{marginTop:10}}><IntervalBar intervals={prog.intervals}/></div>
      </div>
      {open&&(
        <div style={{padding:"0 18px 18px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:"14px 0"}}>{prog.description}</p>
          <button onClick={()=>onUse(prog)} style={{width:"100%",background:`linear-gradient(135deg,${lc},${lc}99)`,border:"none",borderRadius:12,padding:"12px",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            Начать тренировку →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SWIPEABLE INTERVAL ROW ───────────────────────────────────────────────────
// Свайп влево → показывает кнопку-корзину
// Нажать на корзину → удалить
// Свайп вправо или тап в другом месте → закрыть
const DELETE_BTN_W = 72; // ширина открытой зоны удаления

function IntervalRow({interval,index,total,onChange,onDelete,onMoveUp,onMoveDown}) {
  const mins=Math.floor(interval.duration/60), secs=interval.duration%60;
  const cfg=IV[interval.type]||IV.slow;

  const startX=useRef(null);
  const startSwipeX=useRef(0);
  const [open,setOpen]=useState(false);   // кнопка удаления открыта
  const [deleting,setDeleting]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [dragDx,setDragDx]=useState(0);   // смещение во время активного свайпа

  const currentX = deleting ? -300 : open ? -DELETE_BTN_W + dragDx : dragDx;
  const isAnimated = !dragging || deleting;

  const onTouchStart=(e)=>{
    startX.current=e.touches[0].clientX;
    startSwipeX.current=open?-DELETE_BTN_W:0;
    setDragging(true);
    setDragDx(0);
  };
  const onTouchMove=(e)=>{
    if(startX.current===null) return;
    const dx=e.touches[0].clientX-startX.current;
    const total=startSwipeX.current+dx;
    // ограничиваем: влево до -DELETE_BTN_W, вправо до 0
    const clamped=Math.max(-DELETE_BTN_W, Math.min(0, total));
    setDragDx(clamped-(open?-DELETE_BTN_W:0));
  };
  const onTouchEnd=()=>{
    setDragging(false);
    const finalX=open?-DELETE_BTN_W+dragDx:dragDx;
    if(finalX<-DELETE_BTN_W/2) setOpen(true);
    else setOpen(false);
    setDragDx(0);
    startX.current=null;
  };

  const handleDelete=()=>{
    setDeleting(true);
    setTimeout(onDelete,280);
  };

  return (
    <div style={{position:"relative",marginBottom:8,borderRadius:16,overflow:"hidden",height:66}}>

      {/* Кнопка удаления — всегда за строкой, но видна только когда open */}
      {open&&(
        <div style={{
          position:"absolute",right:0,top:0,bottom:0,width:DELETE_BTN_W,
          background:"#8b0000",borderRadius:16,
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",zIndex:0,
        }} onClick={handleDelete}>
          <Icons.Trash size={22} style={{color:"#fff"}}/>
        </div>
      )}

      {/* Основная строка */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          background:"rgba(255,255,255,0.05)",
          border:`1px solid ${cfg.color}30`,
          borderRadius:16,
          padding:"12px 12px",
          display:"flex",
          alignItems:"center",
          gap:8,
          height:"100%",
          boxSizing:"border-box",
          transform:`translateX(${currentX}px)`,
          transition:isAnimated?"transform 0.25s ease":"none",
          position:"relative",
          zIndex:1,
          userSelect:"none",
          touchAction:"pan-y",
        }}
      >
        {/* Стрелки */}
        <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
          <button onClick={onMoveUp} disabled={index===0}
            style={{background:"none",border:"none",color:index===0?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.35)",cursor:index===0?"default":"pointer",padding:"3px 5px",fontSize:11,lineHeight:1}}>▲</button>
          <button onClick={onMoveDown} disabled={index===total-1}
            style={{background:"none",border:"none",color:index===total-1?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.35)",cursor:index===total-1?"default":"pointer",padding:"3px 5px",fontSize:11,lineHeight:1}}>▼</button>
        </div>

        {/* Номер */}
        <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",minWidth:14,textAlign:"center",flexShrink:0}}>{index+1}</div>

        {/* Тип интервала */}
        <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:12,padding:3,gap:2,flexShrink:0}}>
          {Object.entries(IV).map(([t,c])=>(
            <button key={t} onClick={()=>onChange({type:t})}
              style={{background:interval.type===t?c.color:"transparent",border:"none",borderRadius:9,width:38,height:38,fontSize:20,cursor:"pointer",transition:"background 0.18s",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {c.emoji}
            </button>
          ))}
        </div>

        {/* Название */}
        <div style={{fontSize:12,color:cfg.color,fontWeight:600,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cfg.label}</div>

        {/* Время */}
        <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
          <input type="number" min={0} max={99} value={mins}
            onChange={e=>onChange({duration:(parseInt(e.target.value)||0)*60+secs})}
            style={{width:38,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#fff",textAlign:"center",fontSize:16,padding:"7px 1px",outline:"none"}}/>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:17}}>:</span>
          <input type="number" min={0} max={59} value={String(secs).padStart(2,"0")}
            onChange={e=>onChange({duration:mins*60+(parseInt(e.target.value)||0)})}
            style={{width:38,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#fff",textAlign:"center",fontSize:16,padding:"7px 1px",outline:"none"}}/>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
function ProfilePage({navigate}) {
  const [profile,setProfile]=useState({name:"",age:"",weight:""});
  const [editing,setEditing]=useState(false);
  const [hasProfile,setHasProfile]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const p=await storage.getProfile();
      if(p&&(p.name||p.age||p.weight)){
        setProfile(p); setHasProfile(true); setEditing(false);
      } else {
        // Pre-fill name from Telegram
        const name=TG_USER?`${TG_USER.first_name||""} ${TG_USER.last_name||""}`.trim():"";
        setProfile(pr=>({...pr,name}));
        setEditing(true); setHasProfile(false);
      }
      setLoading(false);
    })();
  },[]);

  const save=async()=>{
    await storage.saveProfile(profile);
    setHasProfile(true); setEditing(false);
  };

  const tgPhoto=TG_USER?.photo_url;
  const initials=(profile.name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

  if(loading) return <Loader/>;

  return (
    <div style={pageSt}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
        <button onClick={()=>navigate("home")} style={iconBtn}><Icons.ArrowLeft size={20}/></button>
        <h1 style={{fontSize:22,fontWeight:400,color:"#fff",margin:0,flex:1}}>Профиль</h1>
        {hasProfile&&!editing&&(
          <button onClick={()=>setEditing(true)} style={{...iconBtn,background:"rgba(255,255,255,0.06)"}}>
            <Icons.Edit size={17}/>
          </button>
        )}
      </div>

      {/* Avatar */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
        <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,overflow:"hidden",boxShadow:"0 0 32px rgba(74,222,128,0.3)"}}>
          {tgPhoto
            ? <img src={tgPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <div style={{fontSize:28,fontWeight:600,color:"#000"}}>{initials}</div>}
        </div>
        {TG_USER?.username&&<div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginTop:2}}>@{TG_USER.username}</div>}
      </div>

      {/* VIEW MODE — карточка с данными */}
      {hasProfile&&!editing&&(
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
          {[
            {label:"Имя",value:profile.name||"—"},
            {label:"Возраст",value:profile.age?`${profile.age} лет`:"—"},
            {label:"Вес",value:profile.weight?`${profile.weight} кг`:"—"},
          ].map((f,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
              <div style={{fontSize:17,color:"#fff",fontWeight:500}}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODE */}
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
            {hasProfile&&(
              <button onClick={()=>setEditing(false)} style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"15px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>
                Отмена
              </button>
            )}
            <button onClick={save} style={{...greenBt,flex:2}}>Сохранить</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
const TABS=[{id:"my",label:"Мои",icon:<Icons.Star size={14}/>},{id:"programs",label:"Программы",icon:<Icons.BookOpen size={14}/>},{id:"history",label:"История",icon:<Icons.Clock size={14}/>}];

function HomePage({navigate}) {
  const [tab,setTab]=useState("my");
  const [workouts,setWS]=useState([]);
  const [history,setHist]=useState([]);
  const [lvl,setLvl]=useState("all");
  const [loading,setLoad]=useState(true);
  const [profile,setProfile]=useState(null);

  const load=useCallback(async()=>{
    const [ws,rs,pr]=await Promise.all([storage.getWorkouts(),storage.getResults(),storage.getProfile()]);
    setWS(ws); setHist([...rs].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))); setProfile(pr); setLoad(false);
  },[]);

  useEffect(()=>{ load(); window.addEventListener("focus",load); return()=>window.removeEventListener("focus",load); },[load]);

  const startProgram=async(prog)=>{ const w={id:uid(),name:prog.name,intervals:prog.intervals.map(iv=>({...iv,id:uid()}))}; await storage.saveWorkout(w); navigate("workout",w.id); };
  const delW=async(id)=>{ await storage.deleteWorkout(id); load(); };
  const filtered=lvl==="all"?PROGRAMS:PROGRAMS.filter(p=>p.level===lvl);

  // Имя для приветствия
  const rawName=profile?.name||TG_USER?.first_name||"";
  const firstName=rawName.trim().split(" ")[0];

  if(loading) return <Loader/>;

  return (
    <div style={pageSt}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div>
          <div style={{fontSize:11,letterSpacing:"0.14em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:4}}>Велотренировки</div>
          <h1 style={{fontSize:28,fontWeight:300,color:"#fff",margin:0}}>
            {firstName ? `Привет,\u00A0${firstName}!` : "Тренировки"}
          </h1>
        </div>
        <button onClick={()=>navigate("profile")} style={{...iconBtn,background:tg?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.06)",borderColor:tg?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.08)"}}>
          <Icons.User size={18} style={{color:tg?"#4ade80":"#fff"}}/>
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:14,padding:3,marginBottom:22,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px 6px",borderRadius:11,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.2s",background:tab===t.id?"rgba(255,255,255,0.1)":"transparent",color:tab===t.id?"#fff":"rgba(255,255,255,0.4)"}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab==="my"&&<>
        <button onClick={()=>navigate("create")} style={{width:"100%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",borderRadius:18,padding:"17px 20px",cursor:"pointer",marginBottom:18,display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 28px rgba(74,222,128,0.28)"}}
          onPointerDown={e=>e.currentTarget.style.transform="scale(0.97)"} onPointerUp={e=>e.currentTarget.style.transform="scale(1)"} onPointerLeave={e=>e.currentTarget.style.transform="scale(1)"}>
          <div style={{width:34,height:34,background:"rgba(0,0,0,0.15)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}><Icons.Plus size={18} style={{color:"#000"}}/></div>
          <span style={{fontSize:16,fontWeight:700,color:"#000"}}>Создать тренировку</span>
        </button>
        {workouts.length>0
          ? <div style={{display:"flex",flexDirection:"column",gap:10}}>{workouts.map(w=><WorkoutCard key={w.id} workout={w} onStart={()=>navigate("workout",w.id)} onEdit={()=>navigate("edit",w.id)} onDelete={()=>delW(w.id)}/>)}</div>
          : <div style={{textAlign:"center",padding:"48px 0",color:"rgba(255,255,255,0.2)"}}><div style={{fontSize:44,marginBottom:10}}>🚴</div><div style={{fontSize:16,marginBottom:6}}>Нет сохранённых тренировок</div><div style={{fontSize:13}}>Создайте свою или выберите готовую программу</div></div>
        }
      </>}

      {tab==="programs"&&<>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {[["all","Все"],["beginner","Новичок"],["intermediate","Опытный"],["pro","Профи"]].map(([v,l])=>(
            <button key={v} onClick={()=>setLvl(v)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,transition:"all 0.2s",background:lvl===v?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)",color:lvl===v?"#fff":"rgba(255,255,255,0.4)"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>{filtered.map(p=><ProgramCard key={p.id} prog={p} onUse={startProgram}/>)}</div>
      </>}

      {tab==="history"&&(history.length>0
        ? <div style={{display:"flex",flexDirection:"column",gap:8}}>{history.map(r=><HistoryCard key={r.id} result={r} onClick={()=>navigate("details",r.id)}/>)}</div>
        : <div style={{textAlign:"center",padding:"64px 0",color:"rgba(255,255,255,0.2)"}}><div style={{fontSize:44,marginBottom:10}}>📋</div><div style={{fontSize:16,marginBottom:6}}>История пуста</div><div style={{fontSize:13}}>Завершите первую тренировку</div></div>
      )}
    </div>
  );
}

// ─── CREATE / EDIT ────────────────────────────────────────────────────────────
function CreatePage({navigate,editId}) {
  const [name,setName]=useState(""), [intervals,setIV]=useState([]), [loading,setLoad]=useState(!!editId);

  useEffect(()=>{
    (async()=>{
      if(editId){ const w=await storage.getWorkoutById(editId); if(w){setName(w.name);setIV(w.intervals);} }
      else setIV([{id:uid(),type:"slow",duration:180},{id:uid(),type:"fast",duration:60},{id:uid(),type:"slow",duration:120}]);
      setLoad(false);
    })();
  },[editId]);

  const total=intervals.reduce((s,i)=>s+i.duration,0);

  const moveUp=(i)=>{ if(i===0) return; const a=[...intervals]; [a[i-1],a[i]]=[a[i],a[i-1]]; setIV(a); };
  const moveDown=(i)=>{ if(i===intervals.length-1) return; const a=[...intervals]; [a[i],a[i+1]]=[a[i+1],a[i]]; setIV(a); };

  const save=async()=>{
    if(!name.trim()){alert("Введите название");return;}
    if(!intervals.length){alert("Добавьте интервал");return;}
    await storage.saveWorkout({id:editId||uid(),name:name.trim(),intervals});
    navigate("home");
  };

  if(loading) return <Loader/>;

  return (
    <div style={pageSt}>
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

        {intervals.length>0&&<div style={{marginBottom:14}}><IntervalBar intervals={intervals} height={6}/></div>}

        {/* Hint */}
        <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:12}}>
          ← Свайп влево для удаления · ▲▼ для перемещения
        </div>

        {intervals.map((iv,i)=>(
          <IntervalRow key={iv.id} interval={iv} index={i} total={intervals.length}
            onChange={u=>setIV(p=>p.map(x=>x.id===iv.id?{...x,...u}:x))}
            onDelete={()=>setIV(p=>p.filter(x=>x.id!==iv.id))}
            onMoveUp={()=>moveUp(i)}
            onMoveDown={()=>moveDown(i)}
          />
        ))}

        <button onClick={()=>setIV(p=>[...p,{id:uid(),type:"medium",duration:60}])}
          style={{width:"100%",background:"transparent",border:"2px dashed rgba(255,255,255,0.1)",borderRadius:14,color:"rgba(255,255,255,0.35)",fontSize:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(250,204,21,0.4)";e.currentTarget.style.color="#facc15";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="rgba(255,255,255,0.35)";}}>
          <Icons.Plus size={16}/>Добавить интервал
        </button>
      </div>

      <button onClick={save} style={greenBt}>Сохранить тренировку</button>
    </div>
  );
}

// ─── ACTIVE WORKOUT ───────────────────────────────────────────────────────────
function ActiveWorkoutPage({navigate,workoutId}) {
  const [workout,setWO]=useState(null),[phase,setPhase]=useState("ready"),[countdown,setCD]=useState(3);
  const [ivIdx,setIdx]=useState(0),[timeLeft,setTL]=useState(0),[elapsed,setEl]=useState(0);
  const timerRef=useRef(null),elRef=useRef(0),ivRef=useRef(0),woRef=useRef(null);

  useEffect(()=>{ (async()=>{ const w=await storage.getWorkoutById(workoutId); if(!w){navigate("home");return;} setWO(w);woRef.current=w;setTL(w.intervals[0]?.duration||0); })(); },[workoutId]);

  useEffect(()=>{
    if(phase!=="countdown") return;
    if(countdown<=0){ setTL(woRef.current.intervals[0].duration); setPhase("running"); return; }
    const t=setTimeout(()=>setCD(c=>c-1),1000); return()=>clearTimeout(t);
  },[phase,countdown]);

  useEffect(()=>{
    if(phase!=="running"||!woRef.current) return;
    timerRef.current=setInterval(()=>{
      elRef.current++; setEl(elRef.current);
      setTL(prev=>{
        if(prev<=1){
          const next=ivRef.current+1;
          if(next<woRef.current.intervals.length){ ivRef.current=next; setIdx(next); return woRef.current.intervals[next].duration; }
          clearInterval(timerRef.current); setPhase("done");
          const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elRef.current,completedIntervals:woRef.current.intervals.length,totalIntervals:woRef.current.intervals.length,completedAt:new Date()};
          storage.saveResult(r).then(()=>setTimeout(()=>navigate("results",r.id),400));
          return 0;
        }
        return prev-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[phase]);

  const playPause=()=>{ if(phase==="ready"){setCD(3);setPhase("countdown");} else if(phase==="running"){clearInterval(timerRef.current);setPhase("paused");} else if(phase==="paused") setPhase("running"); };
  const stop=async()=>{ clearInterval(timerRef.current); if(phase==="ready"){navigate("home");return;} const r={id:uid(),workoutId:woRef.current.id,workoutName:woRef.current.name,totalDuration:elRef.current,completedIntervals:ivRef.current,totalIntervals:woRef.current.intervals.length,completedAt:new Date()}; await storage.saveResult(r); navigate("results",r.id); };

  if(!workout) return <Loader/>;
  const curr=workout.intervals[ivIdx],next=workout.intervals[ivIdx+1],nextCfg=next?IV[next.type]:null;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#08080f,#0d1117,#060608)",color:"#fff",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:17,fontWeight:400}}>{workout.name}</div><div style={{fontSize:13,color:"rgba(255,255,255,0.3)",marginTop:2}}>{ivIdx+1} / {workout.intervals.length} интервал</div></div>
        <button onClick={stop} style={iconBtn}><Icons.X size={20}/></button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
        {phase==="countdown"
          ? <div style={{textAlign:"center"}}><div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:16,letterSpacing:"0.12em"}}>ПРИГОТОВЬТЕСЬ</div><div style={{fontSize:120,fontWeight:200,lineHeight:1,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{countdown||"GO!"}</div></div>
          : <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
              <CircularTimer timeRemaining={timeLeft} totalTime={curr.duration} intervalType={curr.type} isWarning={timeLeft<=5&&phase==="running"}/>
              {next&&<div style={{marginTop:20,textAlign:"center",opacity:0.55}}><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4,letterSpacing:"0.1em"}}>СЛЕДУЮЩИЙ</div><div style={{fontSize:14,color:nextCfg?.color||"#fff"}}>{nextCfg?.emoji} {nextCfg?.label} — {fmtT(next.duration)}</div></div>}
              <div style={{display:"flex",gap:5,marginTop:24,alignItems:"center"}}>{workout.intervals.map((_,i)=><div key={i} style={{height:5,width:i===ivIdx?22:i<ivIdx?14:10,borderRadius:3,background:i<ivIdx?IV[workout.intervals[i].type]?.color||"#4ade80":i===ivIdx?"#fff":"rgba(255,255,255,0.12)",transition:"all 0.3s"}}/>)}</div>
            </div>
        }
      </div>
      {phase!=="countdown"&&(
        <div style={{padding:"20px 20px 44px",display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
          <button onClick={stop} style={{width:54,height:54,borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}><Icons.Stop size={20}/></button>
          <button onClick={playPause} style={{width:78,height:78,borderRadius:"50%",background:"linear-gradient(135deg,#4ade80,#22d3ee)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 0 36px rgba(74,222,128,0.4)",color:"#000"}}>
            {phase==="running"?<Icons.Pause size={28}/>:<Icons.Play size={28}/>}
          </button>
          <div style={{width:54,textAlign:"center"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginBottom:3,letterSpacing:"0.1em"}}>ПРОШЛО</div><div style={{fontSize:15,fontWeight:500,color:"rgba(255,255,255,0.5)",fontVariantNumeric:"tabular-nums"}}>{fmtT(elapsed)}</div></div>
        </div>
      )}
    </div>
  );
}

// ─── RESULTS PAGE ─────────────────────────────────────────────────────────────
function ResultsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  useEffect(()=>{ storage.getResultById(resultId).then(r=>{ if(!r) navigate("home"); else setR(r); }); },[resultId]);
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
          <div key={i} style={{background:s.bg,border:`1px solid ${s.brd}`,borderRadius:16,padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:42,height:42,background:"rgba(255,255,255,0.06)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.icon}</div>
            <div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{s.label}</div><div style={{fontSize:18,fontWeight:500,color:s.vc}}>{s.val}</div></div>
          </div>
        ))}
      </div>
      <button onClick={()=>navigate("home")} style={{...greenBt,maxWidth:400}}>На главную</button>
    </div>
  );
}

// ─── DETAILS PAGE ─────────────────────────────────────────────────────────────
function DetailsPage({navigate,resultId}) {
  const [result,setR]=useState(null);
  useEffect(()=>{ storage.getResultById(resultId).then(r=>{ if(!r) navigate("home"); else setR(r); }); },[resultId]);
  if(!result) return <Loader/>;
  const done=result.completedIntervals===result.totalIntervals;
  const date=new Date(result.completedAt);
  return (
    <div style={{...pageSt,paddingTop:0}}>
      <div style={{padding:"20px 20px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:22}}>
        <button onClick={()=>navigate("home")} style={iconBtn}><Icons.ArrowLeft size={20}/></button>
        <h1 style={{fontSize:19,fontWeight:400,margin:0}}>Детали тренировки</h1>
      </div>
      <div style={{padding:"0 20px"}}>
        <div style={{textAlign:"center",padding:"20px 0 28px"}}>
          <h2 style={{fontSize:26,fontWeight:400,marginBottom:10,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{result.workoutName}</h2>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:done?"#4ade80":"#fb923c",fontSize:14}}>
            {done?<Icons.CheckCircle size={16}/>:<Icons.Target size={16}/>}<span>{done?"Завершено полностью":"Частично завершено"}</span>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {icon:<Icons.Calendar size={20} style={{color:"#60a5fa"}}/>,bg:"rgba(96,165,250,0.12)",label:"Дата и время",val:<><div style={{fontSize:15,textTransform:"capitalize"}}>{date.toLocaleDateString("ru-RU",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div><div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>{date.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></>},
            {icon:<Icons.Clock size={20} style={{color:"#4ade80"}}/>,bg:"rgba(74,222,128,0.12)",label:"Длительность",val:<div style={{fontSize:21}}>{fmtD(result.totalDuration)}</div>},
            {icon:<Icons.Target size={20} style={{color:"#a78bfa"}}/>,bg:"rgba(167,139,250,0.12)",label:"Интервалы",val:<><div style={{fontSize:21}}>{result.completedIntervals} из {result.totalIntervals}</div><div style={{display:"flex",gap:3,marginTop:8}}>{Array.from({length:result.totalIntervals}).map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<result.completedIntervals?"#4ade80":"rgba(255,255,255,0.08)"}}/>)}</div></>},
          ].map((c,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:15,padding:"14px 16px",display:"flex",gap:13}}>
              <div style={{width:42,height:42,background:c.bg,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.icon}</div>
              <div style={{flex:1}}><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:5}}>{c.label}</div>{c.val}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>navigate("home")} style={{...greenBt,marginTop:22}}>На главную</button>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage]=useState("home"),[param,setParam]=useState(null);
  const navigate=(to,p=null)=>{ setParam(p); setPage(to); window.scrollTo(0,0); };

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}body{margin:0;padding:0;background:#060608;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}@keyframes scaleIn{from{transform:scale(0.4);opacity:0;}to{transform:scale(1);opacity:1;}}`;
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
