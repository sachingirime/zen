

/*
 ╔══════════════════════════════════════════════════════════════╗
 ║         Zen · Digital Twin Dashboard                         ║
 ║  Burnout Prevention & Peak State Tracking                    ║
 ╚══════════════════════════════════════════════════════════════╝
*/

import { useState, useEffect, useRef, useMemo } from "react";
import Papa from "papaparse";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from "recharts";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:"#f3f4f8", surf:"#ffffff", surf2:"#fafafc", border:"#eef0f5",
  text:"#1e293b", text2:"#475569", text3:"#94a3b8",
  accent:"#8075e5", cyan:"#38bdf8", emerald:"#34d399",
  amber:"#fbbf24", red:"#f87171", purple:"#c084fc",
  shadow: "0 10px 40px -10px rgba(0,0,0,0.06)"
};

// ─── CSV files expected in /public ───────────────────────────────────────────
const CSV_FILES = [
  { key:"daily",     path:"/dailyActivity_merged.csv",      label:"dailyActivity_merged.csv",     required:true  },
  { key:"sleep",     path:"/minuteSleep_merged.csv",         label:"minuteSleep_merged.csv",        required:true  },
  { key:"heartrate", path:"/heartrate_seconds_merged.csv",   label:"heartrate_seconds_merged.csv",  required:false },
  { key:"steps",     path:"/hourlySteps_merged.csv",         label:"hourlySteps_merged.csv",        required:true  },
];

// ─── SIMULATED SCHEDULE: CONTRASTING GOOD VS BAD DAYS ─────────────────────────
const WORK_SCHEDULE = {
  "2016-03-23":{ label:"Balanced Start", stress:"medium", totalHours:8,
    events:[{h:9,dur:1,label:"Team Sync",type:"meeting"},{h:10,dur:4,label:"Deep Work",type:"deep"},{h:15,dur:2,label:"Code Review",type:"focus"}] },
  "2016-03-24":{ label:"Flow State Achieved!", stress:"low", totalHours:7,
    events:[{h:9,dur:.5,label:"Standup",type:"meeting"},{h:9.5,dur:5,label:"Uninterrupted Build",type:"deep"},{h:15,dur:1.5,label:"Learning",type:"light"}] },
  "2016-03-25":{ label:"Active Recovery & Light Work", stress:"low", totalHours:6,
    events:[{h:10,dur:2,label:"Planning",type:"meeting"},{h:13,dur:3,label:"Design Tasks",type:"light"}] },
  "2016-03-26":{ label:"Ramping Up", stress:"medium", totalHours:8.5,
    events:[{h:9,dur:2,label:"Architecture",type:"meeting"},{h:12,dur:5,label:"Core Dev",type:"focus"}] },
  "2016-03-27":{ label:"Hackathon Kickoff", stress:"high", totalHours:12,
    events:[{h:17,dur:1,label:"Opening",type:"meeting"},{h:18,dur:6,label:"Furious Coding",type:"deep"}] },
  "2016-03-28":{ label:"The Grind (Burnout Risk)", stress:"high", totalHours:15,
    events:[{h:8,dur:1,label:"Panic Sync",type:"meeting"},{h:9,dur:6,label:"Feature Sprint",type:"deep"},{h:16,dur:6,label:"Debugging Hell",type:"focus"}] },
  "2016-03-29":{ label:"Submission & Rest", stress:"medium", totalHours:5,
    events:[{h:10,dur:3,label:"Final Polish",type:"focus"},{h:14,dur:1,label:"Demo Video",type:"meeting"}] },
};
const EV_COLORS = { meeting:"#8075e5", focus:T.cyan, deep:"#e53e3e", light:T.emerald, break:T.amber };

// ─── SCORING ──────────────────────────────────────────────────────────────────
const sSleep  = h => h>=8?10:h>=7?8.5:h>=6?7:h>=5?5:h>=4?3:1;
const sSleepQ = e => e>=95?10:e>=90?8:e>=80?6:4;
const sSteps  = s => s>=10000?10:s>=7500?8:s>=5000?6:4;
const sSed    = m => m<600?10:m<800?8:m<1000?6:3;
const sWork   = w => ({none:10,low:9,medium:7,high:4})[w]??7;
const sRHR    = r => r<55?10:r<60?9:r<65?8:r<70?6:r<75?4:r<80?3:2;
const sHRV    = v => v>60?10:v>45?8:v>30?6:v>20?4:2;
const score   = d => Math.round((
  0.22*sSleep(d.sleepH)+0.10*sSleepQ(d.sleepEff)+0.15*sSteps(d.steps)+
  0.10*sSed(d.sedMin)+0.13*sWork(d.workStress)+0.13*sRHR(d.restHR)+0.17*sHRV(d.hrv)
)*10)/10;

const mpc = ss => {
  if(ss.length<3) return null;
  const w=[.15,.35,.50], l=ss.slice(-3);
  return Math.min(10,Math.max(1,Math.round((l.reduce((a,s,i)=>a+s*w[i],0)+(l[2]-l[0])/2*.4)*10)/10));
};

// ─── HR HELPERS ───────────────────────────────────────────────────────────────
function rmssd(vals) {
  if(!vals||vals.length<10) return 30;
  const rr=vals.map(v=>60000/Math.max(v,30));
  const d=rr.slice(1).map((v,i)=>(v-rr[i])**2);
  return Math.round(Math.sqrt(d.reduce((a,b)=>a+b)/d.length));
}

function synthHR(iso, sleepH, stepsH) {
  const sch=WORK_SCHEDULE[iso]??{stress:"none",events:[]};
  return Array.from({length:24},(_,h)=>{
    let hr=64-sleepH*.8;
    if(h>=1&&h<=5)hr-=6; if(h>=7&&h<=9)hr+=10; if(h>=14&&h<=16)hr+=4;
    (sch.events||[]).forEach(ev=>{
      if(h>=Math.floor(ev.h)&&h<=Math.ceil(ev.h+ev.dur))
        hr+={deep:22,meeting:12,focus:10,light:5,break:-3}[ev.type]??8;
    });
    hr+=Math.min((stepsH[h]||0)/80,18);
    if(sch.stress==="high")hr+=6;
    if(sch.stress==="low")hr-=4;
    return{hour:h,hr:Math.round(Math.max(50,Math.min(130,hr+(Math.random()-.5)*5)))};
  });
}

// ─── DISPLAY HELPERS ─────────────────────────────────────────────────────────
const sc    = s=>s>=7.5?T.emerald:s>=5.5?T.amber:T.red;
const slbl  = s=>s>=7.5?"Peak State":s>=5.5?"Room to Recharge":"Needs Some Care";
const strc  = w=>({none:T.emerald,low:T.emerald,medium:T.amber,high:T.red})[w]??T.amber;

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen({progress,statuses}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg, #f3f4f8 0%, #e2e8f0 100%)",display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:24}}>
      <div style={{width:"100%",maxWidth:540, background: T.surf, padding: "clamp(24px, 5vw, 48px)", borderRadius: 32, boxShadow: T.shadow}}>
        <div style={{fontSize:48,marginBottom:16}}>🌿</div>
        <div style={{fontSize:"clamp(24px, 5vw, 32px)",fontWeight:800,color:T.text,marginBottom:8,letterSpacing:"-.02em"}}>Waking up Zen...</div>
        <div style={{fontSize:16,color:T.text2,marginBottom:32,lineHeight:1.7}}>
          Taking a moment to gently sync your wellness data. 
        </div>
        <div style={{height:8,background:T.border,borderRadius:8,marginBottom:32,overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg, ${T.accent}, ${T.emerald})`,borderRadius:8,width:`${progress}%`,transition:"width .4s ease"}}/>
        </div>
        {CSV_FILES.map(f=>{
          const s=statuses[f.key];
          const col=s?.startsWith("✓")?T.emerald:s?.startsWith("✗")?T.red:s?T.amber:T.text3;
          return(
            <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              background:T.surf2,borderRadius:16,padding:"16px 24px",marginBottom:12}}>
              <div style={{overflow:"hidden",textOverflow:"ellipsis"}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>{f.label}</div>
              </div>
              <div style={{fontSize:13,color:col,fontWeight:700, whiteSpace:"nowrap", marginLeft:10}}>{s??"Waiting…"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── GAUGE ────────────────────────────────────────────────────────────────────
function Gauge({s,size=240}){
  const r=96,cx=size/2,cy=size/2+10,toRad=a=>a*Math.PI/180;
  const pt=a=>({x:cx+r*Math.cos(toRad(a)),y:cy+r*Math.sin(toRad(a))});
  const start=-210,sweep=240,fill=start+sweep*(s/10);
  const sp=pt(start),ep=pt(fill),bp=pt(start+sweep),la=sweep*(s/10)>180?1:0;
  const col=sc(s);
  return(
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size+10}`} style={{maxWidth:size, maxHeight:size+10}}>
      <path d={`M${sp.x},${sp.y} A${r},${r} 0 1 1 ${bp.x},${bp.y}`}
        fill="none" stroke={T.border} strokeWidth="16" strokeLinecap="round"/>
      <path d={`M${sp.x},${sp.y} A${r},${r} 0 ${la} 1 ${ep.x},${ep.y}`}
        fill="none" stroke={col} strokeWidth="16" strokeLinecap="round"
        style={{transition:"all .6s ease"}}/>
      <text x={cx} y={cy+12} textAnchor="middle" fill={col} fontSize="56" fontWeight="800" letterSpacing="-0.03em">{s.toFixed(1)}</text>
      <text x={cx} y={cy+40} textAnchor="middle" fill={T.text3} fontSize="14" fontWeight="700" textTransform="uppercase" letterSpacing="0.05em">{slbl(s)}</text>
    </svg>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function Card({icon,label,value,unit,note,nc=T.amber,hi}){
  return(
    <div style={{background:hi?`${hi}08`:T.surf,
      borderRadius:24,padding:"clamp(20px, 3vw, 28px)",
      boxShadow: hi ? `0 10px 40px -10px ${hi}30` : T.shadow, border: hi ? `2px solid ${hi}30` : `2px solid transparent`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <span style={{fontSize:24}}>{icon}</span>
        <span style={{fontSize:13,color:T.text3,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</span>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:6, flexWrap:"wrap"}}>
        <span style={{fontSize:"clamp(32px, 4vw, 42px)",fontWeight:800,color:hi||T.text,letterSpacing:"-.03em", lineHeight:1}}>{value}</span>
        <span style={{fontSize:16,color:T.text3, fontWeight:700}}>{unit}</span>
      </div>
      {note&&<div style={{fontSize:14,color:nc,marginTop:10,fontWeight:700}}>{note}</div>}
    </div>
  );
}

// ─── SCORE CHART ─────────────────────────────────────────────────────────────
function ScoreChart({weekData,selIdx,onSel}){
  const data=weekData.map(d=>({date:d.date,score:d.score}));
  return(
    <div style={{background:T.surf,borderRadius:32,padding:"clamp(24px, 4vw, 36px)", boxShadow:T.shadow}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:24, flexWrap:"wrap", gap:10}}>
        <span style={{fontSize:"clamp(18px, 3vw, 20px)",fontWeight:800,color:T.text}}>Your Week in Review</span>
        <div style={{fontSize:13,color:T.text3,display:"flex",alignItems:"center",gap:8, fontWeight:700}}>
          <span style={{width:20,height:3,background:T.red,borderRadius:2,display:"inline-block"}}/>gentle rest threshold (5.5)
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{top:10,right:10,bottom:0,left:-20}}
          onClick={p=>p?.activeTooltipIndex!=null&&onSel(p.activeTooltipIndex)}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={T.accent} stopOpacity={.3}/>
              <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="6 6" stroke={T.border} vertical={false}/>
          <XAxis dataKey="date" tick={{fontSize:12,fill:T.text3, fontWeight:700}} axisLine={false} tickLine={false} dy={12}/>
          <YAxis domain={[0,10]} tick={{fontSize:12,fill:T.text3, fontWeight:700}} axisLine={false} tickLine={false} tickCount={6}/>
          <Tooltip contentStyle={{background:T.surf,border:`none`,borderRadius:16,boxShadow:T.shadow,fontSize:15,color:T.text,fontWeight:800}}
            formatter={v=>[`${v}/10`,"Score"]}/>
          <ReferenceLine y={5.5} stroke={T.red} strokeDasharray="6 6" strokeWidth={2} strokeOpacity={.5}/>
          <Area type="monotone" dataKey="score" stroke={T.accent} strokeWidth={4} fill="url(#sg)"
            dot={(p)=>{
              const{cx,cy,payload,index}=p, c=sc(payload.score);
              return<circle key={cx} cx={cx} cy={cy} r={index===selIdx?8:5} fill={c} stroke={T.surf} strokeWidth={3}/>;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── HR CHART ─────────────────────────────────────────────────────────────────
function HRChart({hourlyHR,liveH}){
  const data=hourlyHR.map(p=>({h:`${String(p.hour).padStart(2,"0")}:00`,hr:p.hr}));
  return(
    <div style={{background:T.surf,borderRadius:32,padding:"clamp(24px, 4vw, 36px)",boxShadow:T.shadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24, flexWrap:"wrap", gap:10}}>
        <span style={{fontSize:"clamp(18px, 3vw, 20px)",fontWeight:800,color:T.text}}>Heart Rate Rhythm</span>
        <span style={{fontSize:15,color:T.cyan,fontWeight:800}}>{data[liveH]?.hr??"—"} bpm at {data[liveH]?.h}</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{top:10,right:10,bottom:0,left:-20}}>
          <CartesianGrid strokeDasharray="6 6" stroke={T.border} vertical={false}/>
          <XAxis dataKey="h" tick={{fontSize:12,fill:T.text3,fontWeight:700}} tickLine={false} axisLine={false} interval={3} dy={12}/>
          <YAxis domain={[50,130]} tick={{fontSize:12,fill:T.text3,fontWeight:700}} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={{background:T.surf,border:`none`,borderRadius:16,boxShadow:T.shadow,fontSize:15,color:T.text,fontWeight:800}}
            formatter={v=>[`${v} bpm`,"HR"]}/>
          <ReferenceLine y={100} stroke={T.red} strokeDasharray="6 6" strokeWidth={2} strokeOpacity={.3}/>
          <ReferenceLine x={data[liveH]?.h} stroke={T.cyan} strokeDasharray="6 6" strokeWidth={3} strokeOpacity={.4}/>
          <Line type="monotone" dataKey="hr" stroke={T.cyan} strokeWidth={4}
            dot={(p)=>{
              if(p.index!==liveH)return<circle key={p.cx} cx={p.cx} cy={p.cy} r={0} fill={T.cyan}/>;
              return<circle key={p.cx} cx={p.cx} cy={p.cy} r={8} fill={T.cyan} stroke={T.surf} strokeWidth={3}/>;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── BREAKDOWN ───────────────────────────────────────────────────────────────
function Breakdown({day}){
  const items=[
    {label:"Sleep duration",    val:sSleep(day.sleepH),    color:"#6366f1"},
    {label:"Sleep quality",     val:sSleepQ(day.sleepEff), color:"#8b5cf6"},
    {label:"Physical activity", val:sSteps(day.steps),     color:T.cyan},
    {label:"Movement",          val:sSed(day.sedMin),      color:T.emerald},
    {label:"Work rhythm",       val:sWork(day.workStress), color:T.amber},
    {label:"Resting HR",        val:sRHR(day.restHR),      color:T.red},
    {label:"Recovery / HRV",    val:sHRV(day.hrv),         color:T.purple},
  ];
  return(
    <div style={{background:T.surf,borderRadius:32,padding:"clamp(24px, 4vw, 36px)",boxShadow:T.shadow, display:"flex", flexDirection:"column", justifyContent:"center"}}>
      <div style={{fontSize:"clamp(18px, 3vw, 20px)",fontWeight:800,color:T.text,marginBottom:28}}>How You're Doing Today</div>
      {items.map((it,i)=>(
        <div key={i} style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:14,color:T.text2,fontWeight:700}}>{it.label}</span>
            <span style={{fontSize:14,color:T.text,fontWeight:800}}>{it.val.toFixed(1)}</span>
          </div>
          <div style={{height:8,background:T.surf2,borderRadius:4,overflow:"hidden", border:`1px solid ${T.border}`}}>
            <div style={{height:"100%",width:`${it.val*10}%`,background:it.color,borderRadius:4,transition:"width .5s ease"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MPC FORECAST ────────────────────────────────────────────────────────────
function MPC({scores}){
  const pred=mpc(scores); if(!pred)return null;
  const diff=pred-scores[scores.length-1], col=sc(pred);
  const trend=diff>.3?"↗ Trending up":diff<-.3?"↘ Dipping down":"→ Steady";
  const tc=diff>.3?T.emerald:diff<-.3?T.red:T.amber;
  return(
    <div style={{background:`${col}08`,border:`2px solid ${col}20`,borderRadius:32,padding:"clamp(24px, 4vw, 36px)",
      display:"flex",alignItems:"center",gap:32,boxShadow:T.shadow, height:"100%", flexWrap:"wrap"}}>
      <div style={{flex:1, minWidth:200}}>
        <div style={{fontSize:14,color:T.text2,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>
          Forecast (Next 24h)
        </div>
        <div style={{fontSize:16,color:T.text2,lineHeight:1.6,fontWeight:600}}>
          Looking ahead based on your recent 3-day recovery patterns.
        </div>
        <div style={{marginTop:12,fontSize:16,color:tc,fontWeight:800}}>
          {trend} · {Math.abs(diff).toFixed(1)} pts vs today
        </div>
      </div>
      <div style={{textAlign:"center", minWidth:120}}>
        <div style={{fontSize:"clamp(48px, 6vw, 64px)",fontWeight:800,color:col,letterSpacing:"-.04em",lineHeight:1}}>{pred.toFixed(1)}</div>
        <div style={{fontSize:14,color:T.text3,marginTop:8,fontWeight:700, textTransform:"uppercase", letterSpacing:".05em"}}>predicted</div>
      </div>
    </div>
  );
}


// ─── WELLNESS COMPANION ──────────────────────────────────────────────────────
function AICheckin({day,dayScore,apiKey}){
  const [msgs,setMsgs]=useState([]);
  const [inp,setInp]=useState("");
  const [loading,setLoading]=useState(false);
  const [started,setStarted]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{setMsgs([]);setStarted(false);setInp("");},[day.isoDate]);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[msgs]);

  const ctx=()=>{
    const sch=WORK_SCHEDULE[day.isoDate]??{label:"—",stress:"medium"};
    return`Date: ${day.day}, ${day.date}
Wellness score: ${dayScore}/10 (${slbl(dayScore)})
Sleep: ${day.sleepH}h | Efficiency: ${day.sleepEff}%
Steps: ${day.steps?.toLocaleString()} | Sedentary: ${(day.sedMin/60).toFixed(1)}h
Resting HR: ${day.restHR} bpm | HRV (RMSSD): ${day.hrv} ms
Work: ${sch.label} | Stress: ${sch.stress} | Hours: ${day.workH}
${dayScore>=8.0?"\nNote: The user had a wonderful day. Celebrate their light and joy if they mention it.":""}
${dayScore<5.5?"\nNote: The user's wellness score is low today. Please offer deep, gentle support and validation.":""}`;
  };

  const start=()=>{
    if(started)return; setStarted(true);
    
    // The bot initiates the conversation with deep warmth and an open floor
    const initialGreeting = dayScore < 5.5 
      ? "Oh, sweet friend... I'm gently checking in because I noticed your body's battery seems a little low today. Wrap yourself in a cozy blanket—how are you really feeling right now? I'm just here to hold space and listen." 
      : dayScore >= 8.0 
      ? "Hello beautiful soul! Your energy and stats are absolutely glowing today. I'm smiling just looking at them! I'd love to hear all about how your wonderful day is going, or if there's anything in your heart you'd like to share?" 
      : "Hi there, lovely. I'm just stopping by to gently check in on you. How has your beautiful day been treating you so far? I'm always here whenever you're ready to chat.";
      
    setMsgs([{ role: "assistant", content: initialGreeting }]);
  };

  const call=async(msg)=>{
    if(!apiKey){
      setMsgs(m=>[...m,{role:"user",content:msg},
        {role:"assistant",content:"To chat with me, just make sure your API key is added at the top!"}]);
      return;
    }
    setLoading(true);
    const history=[...msgs,{role:"user",content:msg}];
    setMsgs(history);
    
    try{
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 280,
          messages: [
            { role: "system", content: `You are an incredibly warm, deeply compassionate, and nurturing companion inside a personal wellbeing app. Think of yourself as a safe haven or a trusted, lovingly caring friend.
Here is the user's data for today:
${ctx()}

Guidelines:
- Your tone is exceptionally gentle, loving, and emotionally safe.
- Never rush to "fix" their problems. Always hold space for their feelings and wrap them in validation first.
- Speak like a caring friend sitting close by with a warm cup of tea. Use words that evoke deep comfort and care.
- When things look tough, offer soft validation and immense reassurance. 
- When things look great, celebrate their joy and radiate happiness for them.
- Keep responses to 1-3 short sentences. Conversational, cozy, and highly empathetic.
- Avoid robotic language, tech terms, or medical jargon entirely.` },
            ...history
          ]
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? `Something went wrong on my end. Check back in a sec!`;
      setMsgs(m=>[...m,{role:"assistant",content:reply}]);
    } catch(e){
      setMsgs(m=>[...m,{role:"assistant",content:`Hmm, I couldn't connect just now. Want to try again in a moment?`}]);
    }
    setLoading(false);
  };

  return(
    <div style={{background:T.surf,borderRadius:32,overflow:"hidden",boxShadow:T.shadow, height:"100%", display:"flex", flexDirection:"column"}}>
      <div style={{padding:"24px clamp(20px, 4vw, 32px)",
        display:"flex",alignItems:"center",justifyContent:"space-between", flexWrap:"wrap", gap:10,
        background:T.surf2, borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>💭</span>
          <span style={{fontSize:20,fontWeight:800,color:T.text}}>Wellness Check-in</span>
        </div>
        {!started&&(
          <button onClick={start} style={{fontSize:14,color:"#fff",background:T.accent,
            border:"none",borderRadius:16,padding:"10px 20px",cursor:"pointer",fontWeight:700}}>
            Start chat
          </button>
        )}
      </div>
      <div ref={ref} style={{flex:1, minHeight: 280, overflowY:"auto",padding:"clamp(20px, 4vw, 32px)",
        display:"flex",flexDirection:"column",gap:20,background:T.bg}}>
        {msgs.length===0&&(
          <div style={{margin:"auto",textAlign:"center",color:T.text3,lineHeight:1.8}}>
            <div style={{fontSize:48,marginBottom:16}}>🤗</div>
            <div style={{fontWeight:800,color:T.text2,marginBottom:8,fontSize:20}}>Your safe space</div>
            <div style={{fontSize:16, fontWeight:600}}>Tap "Start chat" to check in and<br/>let me know how you're feeling.</div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",fontSize:16,lineHeight:1.6,fontWeight:500,
              borderRadius: m.role==="user"?"24px 24px 6px 24px":"24px 24px 24px 6px",
              padding:"16px 24px",
              background:m.role==="user"?T.accent:T.surf,
              color:m.role==="user"?"#fff":T.text,
              boxShadow: m.role==="user"?"none":T.shadow}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"18px 24px",background:T.surf,
            borderRadius:"24px 24px 24px 6px",width:"fit-content",boxShadow:T.shadow}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:10,height:10,borderRadius:"50%",background:T.accent,
                animation:"pulse 1.2s ease infinite",animationDelay:`${i*.2}s`}}/>
            ))}
          </div>
        )}
      </div>
      <div style={{padding:"20px clamp(20px, 4vw, 32px)",background:T.surf, borderTop:`1px solid ${T.border}`, display:"flex",gap:16}}>
        <input value={inp} onChange={e=>setInp(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&inp.trim()&&!loading){e.preventDefault();call(inp);setInp("");}}}
          placeholder="I'm feeling..."
          style={{flex:1,background:T.bg,border:`none`,borderRadius:20,
            padding:"16px 24px",fontSize:16,color:T.text,outline:"none",fontWeight:500, minWidth:0}}/>
        <button onClick={()=>{if(inp.trim()&&!loading){call(inp);setInp("");}}}
          disabled={!inp.trim()||loading}
          style={{background:T.accent,color:"#fff",border:"none",borderRadius:20,
            padding:"0 24px",fontSize:16,fontWeight:800,cursor:"pointer",
            opacity:(!inp.trim()||loading)?.5:1}}>Send</button>
      </div>
    </div>
  );
}

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
function useWeek(raw){
  return useMemo(()=>{
    if(!raw)return[];
    const{daily,sleep,steps,heartrate}=raw;
    const WEEK=["2016-03-23","2016-03-24","2016-03-25","2016-03-26","2016-03-27","2016-03-28","2016-03-29"];
    
    const OVERRIDE_DAYS = {
      "2016-03-23":"Monday",
      "2016-03-24":"Tuesday",
      "2016-03-25":"Wednesday",
      "2016-03-26":"Thursday",
      "2016-03-27":"Friday",
      "2016-03-28":"Saturday",
      "2016-03-29":"Sunday"
    };

    const cov={};
    (daily||[]).forEach(r=>{
      const d=new Date(r.ActivityDate); if(isNaN(d))return;
      const iso=d.toISOString().slice(0,10); if(!WEEK.includes(iso))return;
      cov[String(r.Id)]=(cov[String(r.Id)]||0)+1;
    });
    const uid=Object.entries(cov).sort((a,b)=>b[1]-a[1])[0]?.[0];

    const act={};
    (daily||[]).forEach(r=>{
      if(String(r.Id)!==uid)return;
      const d=new Date(r.ActivityDate); if(isNaN(d))return;
      act[d.toISOString().slice(0,10)]=r;
    });

    const slp={};
    (sleep||[]).forEach(r=>{
      if(String(r.Id)!==uid)return;
      const d=new Date(r.date); if(isNaN(d))return;
      const iso=d.toISOString().slice(0,10);
      if(!slp[iso])slp[iso]=[];
      slp[iso].push(Number(r.value));
    });

    const sth={};
    (steps||[]).forEach(r=>{
      if(String(r.Id)!==uid)return;
      const d=new Date(r.ActivityHour); if(isNaN(d))return;
      const iso=d.toISOString().slice(0,10), h=d.getHours();
      if(!sth[iso])sth[iso]={};
      sth[iso][h]=(sth[iso][h]||0)+Number(r.StepTotal||0);
    });

    const hrU={};
    (heartrate||[]).forEach(r=>{
      const d=new Date(r.Time); if(isNaN(d))return;
      const iso=d.toISOString().slice(0,10); if(!WEEK.includes(iso))return;
      const id=String(r.Id), h=d.getHours();
      if(!hrU[id])hrU[id]={};
      if(!hrU[id][iso])hrU[id][iso]={};
      if(!hrU[id][iso][h])hrU[id][iso][h]=[];
      hrU[id][iso][h].push(Number(r.Value));
    });
    const hrUid=Object.entries(hrU).sort((a,b)=>Object.keys(b[1]).length-Object.keys(a[1]).length)[0]?.[0]??uid;

    return WEEK.map(iso=>{
      const a=act[iso]??{}, sv=slp[iso]??[], sh=sth[iso]??{}, hd=hrU[hrUid]?.[iso];
      const sch=WORK_SCHEDULE[iso]??{stress:"none",totalHours:0};
      const d=new Date(iso+"T12:00:00");

      const sm=sv.filter(v=>v===1).length, rs=sv.filter(v=>v===2).length, aw=sv.filter(v=>v===3).length;
      
      let sleepH=Math.round((sm+rs)/60*10)/10;
      let sleepEff=Math.round(sm/Math.max(1,sm+rs+aw)*1000)/10;
      const wakes=sv.reduce((acc,v,i,a)=>acc+(v===3&&i>0&&a[i-1]!==3?1:0),0);

      let steps=Number(a.TotalSteps)||0;
      let sedMin=Number(a.SedentaryMinutes)||0;
      let activeMin=Number(a.VeryActiveMinutes)||0;

      // SYNTHETIC FALLBACK: If there's no CSV data, inject realistic metrics based on the schedule stress
      if(sleepH === 0) {
        if(sch.stress === "low") { sleepH = 8.5; sleepEff = 94; steps = 10500; sedMin = 500; activeMin = 45; }
        else if(sch.stress === "medium") { sleepH = 6.8; sleepEff = 85; steps = 7000; sedMin = 750; activeMin = 20; }
        else { sleepH = 4.2; sleepEff = 68; steps = 3000; sedMin = 1050; activeMin = 5; }
      }

      let hourlyHR,restHR,hrv;
      if(hd&&Object.keys(hd).length>4){
        hourlyHR=Array.from({length:24},(_,h)=>{
          const v=hd[h]??[]; return{hour:h,hr:v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):65};
        });
        const nv=[0,1,2,3,4,5,6].flatMap(h=>hd[h]??[]).sort((a,b)=>a-b);
        restHR=nv.length?nv[Math.floor(nv.length*.05)]:65;
        hrv=rmssd(Object.values(hd).flat());
      }else{
        hourlyHR=synthHR(iso,sleepH,sh);
        const nh=hourlyHR.filter(p=>p.hour<=6).map(p=>p.hr).sort((a,b)=>a-b);
        restHR=nh[Math.floor(nh.length*.05)]??65;
        hrv=Math.max(10,Math.min(80,60-(sch.stress==="high"?25:sch.stress==="medium"?10:sch.stress==="low"?-15:0)+Math.round(sleepH*2)));
      }

      const obj={isoDate:iso,date:d.toLocaleDateString("en-US",{month:"short",day:"numeric"}),
        day:OVERRIDE_DAYS[iso],sleepH,sleepEff,wakes,
        steps,sedMin,activeMin,calories:Number(a.Calories)||0,
        workH:sch.totalHours,workStress:sch.stress,restHR,hrv,hourlyHR};
      obj.score=score(obj);
      return obj;
    });
  },[raw]);
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({raw,hasRealHR}){
  const week=useWeek(raw);
  const[sel,setSel]=useState(1); // Default to Tuesday (A Great Day!)
  const[liveH,setLiveH]=useState(9);
  const[playing,setPlaying]=useState(false);
  const[apiKey,setApiKey]=useState(import.meta.env.VITE_GROQ_API_KEY || ""); // KEEP YOUR KEY
  const iv=useRef(null);

  useEffect(()=>{
    if(playing){iv.current=setInterval(()=>setLiveH(h=>{if(h>=23){setPlaying(false);return 23;}return h+1;}),1100);}
    else clearInterval(iv.current);
    return()=>clearInterval(iv.current);
  },[playing]);
  useEffect(()=>{setLiveH(9);setPlaying(false);},[sel]);

  if(!week.length)return<div style={{minHeight:"100vh",background:T.bg,display:"flex",
    alignItems:"center",justifyContent:"center",color:T.text,fontFamily:"system-ui"}}>Processing…</div>;

  const day=week[sel], scores=week.map(d=>d.score);
  const avg=Math.round(scores.reduce((a,b)=>a+b)/scores.length*10)/10;
  
  const isBurnout = day.score < 5.5;
  const isPeakState = day.score >= 8.0;

  const liveScore=useMemo(()=>{
    const lRHR=day.hourlyHR.filter(p=>p.hour<=6).map(p=>p.hr).sort((a,b)=>a-b)[0]??day.restHR;
    return score({...day,restHR:lRHR,hrv:Math.max(10,day.hrv-(liveH>14?4:0))});
  },[day,liveH]);

  return(
    <div style={{fontFamily:"'Inter', system-ui, sans-serif",background:T.bg,minHeight:"100vh",color:T.text}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box} input::placeholder{color:${T.text3}}
      `}</style>

      {/* Header */}
      <div style={{background:T.surf,padding:"clamp(24px, 4vw, 32px) 5%",boxShadow:T.shadow,position:"relative",zIndex:10}}>
        <div style={{maxWidth:1600,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"space-between",flexWrap:"wrap",gap:24}}>
          <div>
            {/* Logo and App Title Container */}
            <div style={{display:"flex", alignItems:"center", gap: 12, marginBottom: 8}}>
              <img 
                src="/logo.png" 
                alt="App Logo" 
                style={{height: 200, objectFit: "contain", borderRadius: 8}} 
                onError={(e) => e.target.style.display = 'none'} 
              />
              {/* <div style={{fontSize:64,color:T.accent,letterSpacing:".1em",textTransform:"uppercase",fontWeight:800}}>
                Zen
              </div> */}
            </div>
            
            <div style={{fontSize:"clamp(24px, 4vw, 32px)",fontWeight:800,letterSpacing:"-.02em",color:T.text}}>Welcome to Your Wellness Space</div>
            <div style={{fontSize:15,color:T.text3,marginTop:6,fontWeight:600}}>
              {day.day}, {day.date} · {hasRealHR?"":"Estimated Patterns Active"}
            </div>
          </div>
          <div style={{textAlign:"right",background:T.surf2,padding:"16px 28px",borderRadius:24,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:13,color:T.text3,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em"}}>Week Average</div>
            <div style={{fontSize:"clamp(36px, 5vw, 48px)",fontWeight:800,color:sc(avg),letterSpacing:"-.04em",lineHeight:1.1,marginTop:4}}>
              {avg}<span style={{fontSize:20,color:T.text3}}>/10</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{maxWidth:1600,margin:"0 auto",padding:"clamp(24px, 5vw, 40px) 5% 80px",display:"flex",flexDirection:"column",gap:32}}>

        {/* Burnout Warning Banner */}
        {isBurnout&&(
          <div style={{background:`${T.red}10`,borderRadius:24,
            padding:"20px 28px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:T.red,flexShrink:0,animation:"blink 1.5s ease infinite"}}/>
            <div style={{fontSize:16,color:T.red,lineHeight:1.6, fontWeight:500}}>
              <strong>Gentle Check-in:</strong>{" "}
              Your body's battery is running low today. With a resting heart rate of {day.restHR} bpm and only {day.sleepH}h of sleep, consider taking things extra slow.
            </div>
          </div>
        )}

        {/* Peak State Banner */}
        {isPeakState&&(
          <div style={{background:`${T.emerald}10`,borderRadius:24,
            padding:"20px 28px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:T.emerald,flexShrink:0}}/>
            <div style={{fontSize:16,color:T.emerald,lineHeight:1.6, fontWeight:500}}>
              <strong>Peak State Reached:</strong>{" "}
              You are crushing it today! With {day.sleepH}h of sleep and an excellent recovery score, this is your optimal zone. Let's look at what habits we can replicate for tomorrow.
            </div>
          </div>
        )}

        {/* Day tabs */}
        <div style={{display:"flex",gap:16,overflowX:"auto",paddingBottom:8, paddingTop: 10, flexWrap:"nowrap"}}>
          {week.map((d,i)=>{
            const a=i===sel, c=sc(d.score);
            return(
              <button key={i} onClick={()=>setSel(i)} style={{flexShrink:0,
                border:`1px solid ${a?T.accent:T.border}`,borderRadius:24,
                padding:"16px 28px",cursor:"pointer",textAlign:"center",
                background:a?`${T.accent}15`:T.surf,color:T.text,outline:"none",
                minWidth:120,transition:"all .2s",boxShadow: a?"none":T.shadow}}>
                <div style={{fontSize:13,fontWeight:800,color:a?T.accent:T.text3,marginBottom:6}}>
                  {d.day.slice(0,3).toUpperCase()}</div>
                <div style={{fontSize:24,fontWeight:800,color:a?T.accent:c}}>{d.score.toFixed(1)}</div>
                <div style={{fontSize:13,color:T.text3,fontWeight:600,marginTop:4}}>{d.date}</div>
              </button>
            );
          })}
        </div>

        {/* Gauge + Breakdown side-by-side */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 350px), 1fr))", gap:32}}>
          <div style={{background:T.surf,borderRadius:32,
            padding:"clamp(24px, 4vw, 40px)",display:"flex",flexDirection:"column",alignItems:"center",boxShadow:T.shadow}}>
            <div style={{fontSize:24,fontWeight:800,color:T.text,marginBottom:6}}>{day.day}</div>
            <div style={{fontSize:16,color:T.text3,marginBottom:24,fontWeight:600}}>{day.date}</div>
            <Gauge s={liveScore} size={220}/>
            <div style={{marginTop:32,display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%",maxWidth:300}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:T.cyan,
                  animation:playing?"blink 1s infinite":"none"}}/>
                <span style={{fontSize:15,color:T.text2,fontWeight:700}}>
                  {String(liveH).padStart(2,"0")}:00 · {day.hourlyHR[liveH]?.hr??"—"} bpm
                </span>
              </div>
              <input type="range" min={0} max={23} value={liveH}
                onChange={e=>setLiveH(Number(e.target.value))} style={{width:"100%",accentColor:T.cyan}}/>
              <button onClick={()=>setPlaying(p=>!p)} style={{background:`${T.cyan}15`,color:T.cyan,
                border:`none`,borderRadius:16,padding:"10px 24px",fontSize:15,cursor:"pointer",fontWeight:800,marginTop:8}}>
                {playing?"⏸ Pause Day":"▶ Play Day"}
              </button>
            </div>
          </div>
          <Breakdown day={day}/>
        </div>

        {/* Metric cards */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap:20}}>
          <Card icon="🌙" label="Sleep" value={day.sleepH} unit="hrs"
            note={day.sleepH<3?"Needs attention":day.sleepH<6?"A bit short":day.sleepH>=8?"Perfect rest":null}
            nc={day.sleepH<3?T.red:day.sleepH>=8?T.emerald:T.amber} hi={day.sleepH<4?T.red:null}/>
          <Card icon="❤️" label="Resting HR" value={day.restHR} unit="bpm"
            note={day.restHR>72?"Working hard":day.restHR<60?"Nice & relaxed":null}
            nc={day.restHR>72?T.red:T.emerald} hi={day.restHR>72?T.red:null}/>
          <Card icon="💜" label="Recovery" value={day.hrv} unit="ms"
            note={day.hrv<25?"Needs rest":day.hrv<35?"A bit low":day.hrv>50?"Well recovered":null}
            nc={day.hrv<25?T.red:day.hrv<35?T.amber:T.emerald} hi={day.hrv<25?T.purple:null}/>
          <Card icon="👟" label="Steps" value={day.steps.toLocaleString()} unit=""
            note={day.steps>=10000?"Great movement":null} nc={T.emerald}/>
          <Card icon="🪑" label="Sedentary" value={Math.round(day.sedMin/60*10)/10} unit="hrs"
            note={day.sedMin>1000?"Time for a stretch":null} nc={T.red} hi={day.sedMin>1000?T.red:null}/>
          <Card icon="💼" label="Work" value={day.workH} unit="hrs"
            note={WORK_SCHEDULE[day.isoDate]?.label?.slice(0,24)}
            nc={strc(day.workStress)} hi={day.workStress==="high"?T.red:null}/>
        </div>

        {/* Calendar Integration Indicator */}
        <div style={{background:T.surf,borderRadius:32,padding:"clamp(24px, 4vw, 36px)",boxShadow:T.shadow, display:"flex", alignItems:"center", gap: 20}}>
          <div style={{fontSize: "clamp(36px, 5vw, 48px)", background:`${T.accent}15`, padding: "16px", borderRadius: "24px"}}>📅</div>
          <div>
            <div style={{fontSize:"clamp(18px, 3vw, 20px)",fontWeight:800,color:T.text}}>Calendar & Work Integration Active</div>
            <div style={{fontSize:15,color:T.text2,fontWeight:600,marginTop:6,lineHeight: 1.5}}>Your daily rhythm, meetings, and deep work sessions are securely synced with Zen to monitor your wellbeing flow.</div>
          </div>
        </div>
        
        {/* Charts */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap:32}}>
          <ScoreChart weekData={week} selIdx={sel} onSel={setSel}/>
          <HRChart hourlyHR={day.hourlyHR} liveH={liveH}/>
        </div>

        {/* AI & Forecast */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 350px), 1fr))", gap:32}}>
          <AICheckin day={day} dayScore={day.score} apiKey={apiKey}/>
          {sel <= 5 && <MPC scores={scores.slice(0, sel + 2)}/>}
        </div>

      </div>
    </div>
  );
}

// ─── CSV LOADER ───────────────────────────────────────────────────────────────
async function loadCSV(path){
  const res=await fetch(path);
  if(!res.ok)throw new Error(`${res.status}`);
  return new Promise((ok,err)=>
    Papa.parse(res.body??"",{
      download:true,header:true,skipEmptyLines:true,
      complete:r=>ok(r.data),error:e=>err(e)
    })
  );
}
// fallback: parse text directly
async function loadCSVText(path){
  const res=await fetch(path);
  if(!res.ok)throw new Error(`${res.status}`);
  const text=await res.text();
  return new Promise((ok,err)=>
    Papa.parse(text,{header:true,skipEmptyLines:true,complete:r=>ok(r.data),error:e=>err(e)})
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const[raw,setRaw]=useState(null);
  const[statuses,setStatuses]=useState({});
  const[progress,setProgress]=useState(0);
  const[hasRealHR,setHasRealHR]=useState(false);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    async function run(){
      const result={};
      for(let i=0;i<CSV_FILES.length;i++){
        if(cancelled)return;
        const f=CSV_FILES[i];
        setStatuses(s=>({...s,[f.key]:"Loading…"}));
        try{
          const data=await loadCSVText(f.path);
          result[f.key]=data;
          setStatuses(s=>({...s,[f.key]:`✓ ${data.length.toLocaleString()} rows`}));
          if(f.key==="heartrate")setHasRealHR(true);
        }catch(e){
          result[f.key]=null;
          setStatuses(s=>({...s,[f.key]:f.required?"✗ Not found — copy to public/":"✗ Not found — using estimated HR"}));
        }
        setProgress(Math.round((i+1)/CSV_FILES.length*100));
      }
      if(!cancelled){
        await new Promise(r=>setTimeout(r,500));
        setRaw(result); setLoading(false);
      }
    }
    run();
    return()=>{cancelled=true;};
  },[]);

  if(loading||!raw)return<LoadingScreen progress={progress} statuses={statuses}/>;
  return<Dashboard raw={raw} hasRealHR={hasRealHR}/>;
}