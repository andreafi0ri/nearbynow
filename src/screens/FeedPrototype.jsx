import { useState, useEffect, useRef } from "react";

// ── Google Fonts ───────────────────────────────────────────────
(() => {
  if (!document.getElementById("hearby-fonts")) {
    const l = document.createElement("link");
    l.id = "hearby-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }
})();

const FD = "'Playfair Display', Georgia, serif";
const FB = "'DM Sans', 'Helvetica Neue', sans-serif";

// ── Theme ──────────────────────────────────────────────────────
const LIGHT = {
  bg:"#FFFFFF", bgSub:"#F5F5F7", bgCard:"#FFFFFF", bgCardHi:"#F9F9FB",
  border:"#1A1A1A", borderSub:"#D0D0D8",
  text:"#111111", textSub:"#444444", muted:"#777788", mutedL:"#AAAABC",
  gold:"#B8920A", goldBri:"#D4A80C", goldLight:"#FFF8E1",
  goldGlow:"rgba(184,146,10,0.15)", goldDim:"#8A6E00",
  red:"#D94040", green:"#2EA864", purple:"#7B5CE0", teal:"#1AADA8",
};
const DARK = {
  bg:"#0E0E10", bgSub:"#18181C", bgCard:"#18181C", bgCardHi:"#1F1F26",
  border:"#C9A84C", borderSub:"#2A2A38",
  text:"#F4F4F6", textSub:"#CCCCDD", muted:"#7A7A90", mutedL:"#4A4A5C",
  gold:"#C9A84C", goldBri:"#F0C96A", goldLight:"rgba(201,168,76,0.12)",
  goldGlow:"rgba(201,168,76,0.20)", goldDim:"#8A6E2F",
  red:"#E05555", green:"#3DBE7A", purple:"#9B6FE8", teal:"#3ABFB8",
};
function useDark() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const [dark, setDark] = useState(mq.matches);
  useEffect(() => { const h = e => setDark(e.matches); mq.addEventListener("change",h); return ()=>mq.removeEventListener("change",h); },[]);
  return dark;
}

// ── Mock data ──────────────────────────────────────────────────
const TODAY = new Date();
const fmt = d => d.toISOString().split("T")[0];
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const makeIso = (dateStr,h,m=0) => `${dateStr}T${String(h).padStart(2,"0")}${String(m).padStart(2,"0")}00`;

const EVENTS = [
  { id:1, type:"event", title:"Brixton Farmers Market", desc:"Fresh local produce, artisan bread, street food and live acoustic music every Saturday morning. Over 40 stalls from local producers across South London.", longDesc:"Running since 2003, the Brixton Farmers Market is one of London's most beloved weekly markets. You'll find everything from heritage vegetables to artisan cheeses, handmade breads, and locally roasted coffee. Live folk and acoustic sets keep the atmosphere buzzing from opening to close.", time:"Sat 9:00 AM – 1:00 PM", location:"Brixton Station Road, SW9", lat:51.4613, lng:-0.1156, date:fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)), startIso:makeIso(fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)),9), endIso:makeIso(fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)),13), source:"Facebook Events", category:"Food & Drink", catColor:"#D43030", catDot:"#FF6B6B", saves:34, img:"🥦", booking:null, tags:["Family friendly","Free entry","Outdoors"] },
  { id:2, type:"event", title:"Open Mic Night @ The Hootananny", desc:"Fancy your chances? Sign up on the door from 7pm. All genres welcome, 5 min slots.", longDesc:"Brixton's longest-running open mic night. The Hootananny has hosted everyone from unknown newcomers to breakthrough artists. Sign up on the door from 7pm, slots are 5 minutes, all genres welcome. Free entry before 8pm.", time:"Fri 7:30 PM", location:"Hootananny, 95 Effra Rd", lat:51.4571, lng:-0.1134, date:fmt(addDays(TODAY,(5-TODAY.getDay()+7)%7||7)), startIso:makeIso(fmt(addDays(TODAY,(5-TODAY.getDay()+7)%7||7)),19,30), endIso:makeIso(fmt(addDays(TODAY,(5-TODAY.getDay()+7)%7||7)),23), source:"Instagram", category:"Music", catColor:"#7B5CE0", catDot:"#A688FF", saves:21, img:"🎸", booking:null, tags:["Free entry","18+","Live music"] },
  { id:3, type:"event", title:"Lambeth Planning Meeting", desc:"Council meeting discussing the proposed mixed-use development on Coldharbour Lane. Public welcome.", longDesc:"Lambeth Council's monthly planning committee will review the proposed 240-unit mixed-use development at 178–194 Coldharbour Lane. The development includes retail units on the ground floor and a new public square. Residents are invited to submit written comments or attend in person.", time:"Mon 6:00 PM", location:"Lambeth Town Hall, SW2", lat:51.4613, lng:-0.1221, date:fmt(addDays(TODAY,(1-TODAY.getDay()+7)%7||7)), startIso:makeIso(fmt(addDays(TODAY,(1-TODAY.getDay()+7)%7||7)),18), endIso:makeIso(fmt(addDays(TODAY,(1-TODAY.getDay()+7)%7||7)),20), source:"r/brixton", category:"Community", catColor:"#2860C8", catDot:"#5A90F8", saves:8, img:"🏛️", booking:null, tags:["Community","Free","Public meeting"] },
  { id:4, type:"recommendation", title:"Nanban", desc:"Japanese soul food in the heart of Brixton. Ramen, katsu, and natural wines.", longDesc:"Chef Tim Anderson's Japanese comfort food restaurant has become one of Brixton's most loved spots. Signature dishes include tantanmen ramen with sesame and chilli, and the Brixton katsu served with a house curry sauce made with local market ingredients. Excellent natural wine list.", time:"Open until 10:30 PM", location:"426 Coldharbour Lane, SW9", lat:51.4603, lng:-0.1143, date:fmt(TODAY), startIso:makeIso(fmt(TODAY),18), endIso:makeIso(fmt(TODAY),22,30), source:"Google Places", category:"Restaurant", catColor:"#B8920A", catDot:"#D4A80C", saves:112, img:"🍜", booking:{label:"Reserve on OpenTable",url:"#",affiliate:true}, rating:4.7, reviews:843, tags:["Japanese","Ramen","Natural wine"] },
  { id:5, type:"event", title:"5km Brockwell Parkrun", desc:"Free weekly timed 5k. All paces welcome — register at parkrun.org.uk.", longDesc:"Brockwell Parkrun is one of the most scenic 5k routes in London, winding through the park past the lido and formal gardens. All abilities welcome — whether you're running, jogging, or walking. You must register once at parkrun.org.uk and bring a printed or digital barcode.", time:"Sat 9:00 AM", location:"Brockwell Park, SE24", lat:51.4540, lng:-0.1083, date:fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)), startIso:makeIso(fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)),9), endIso:makeIso(fmt(addDays(TODAY,(6-TODAY.getDay()+7)%7||7)),10), source:"Eventbrite", category:"Sport", catColor:"#1A9E98", catDot:"#3ABFB8", saves:67, img:"🏃", booking:null, tags:["Free","Running","All abilities"] },
  { id:6, type:"recommendation", title:"BFI Southbank", desc:"Now showing: Wim Wenders retrospective. 4 screens, café bar, and a members' library.", longDesc:"The British Film Institute's flagship cinema on the South Bank is running a major retrospective of Wim Wenders' work, including Paris, Texas and Wings of Desire in 4K restoration. The BFI also has a bookshop, café bar, and free public library of film materials.", time:"Multiple showings today", location:"Belvedere Rd, South Bank, SE1", lat:51.5059, lng:-0.1145, date:fmt(TODAY), startIso:makeIso(fmt(TODAY),14), endIso:makeIso(fmt(TODAY),16), source:"Showtimes", category:"Cinema", catColor:"#7B5CE0", catDot:"#C4A0FF", saves:29, img:"🎬", booking:{label:"Get Tickets",url:"#",affiliate:false}, showings:["11:15","14:00","17:30","20:45"], tags:["Cinema","Retrospective","Bar"] },
  { id:7, type:"recommendation", title:"Black Cultural Archives", desc:"Permanent collection on the history of African and Caribbean people in Britain. Free entry.", longDesc:"The only heritage centre in the UK dedicated to collecting, preserving and celebrating the histories of African and Caribbean people in Britain. The permanent collection spans 400 years, and the current temporary exhibition explores the Windrush generation's cultural contributions to British life.", time:"Open 10am – 6pm", location:"1 Windrush Square, SW2", lat:51.4628, lng:-0.1152, date:fmt(addDays(TODAY,1)), startIso:makeIso(fmt(addDays(TODAY,1)),10), endIso:makeIso(fmt(addDays(TODAY,1)),18), source:"Google Places", category:"Culture", catColor:"#B8920A", catDot:"#D4A80C", saves:44, img:"🏛️", booking:null, rating:4.8, reviews:521, tags:["Free entry","History","Culture"] },
];

const FILTERS = ["All","Events","Food & Drink","Music","Community","Sport","Nearby"];
const DATE_PRESETS = ["Today","Tomorrow","This Weekend","This Week"];
const SRC_COLORS = {"Facebook Events":"#1877F2","Instagram":"#E1306C","r/brixton":"#FF4500","Google Places":"#4285F4","Eventbrite":"#F05537","Showtimes":"#7B5CE0"};

// ── Calendar helpers ───────────────────────────────────────────
const toGCal = iso => iso.replace(/[-:]/g,"");
const buildGoogleUrl = item =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.title)}&dates=${toGCal(item.startIso)}/${toGCal(item.endIso)}&details=${encodeURIComponent(item.desc)}&location=${encodeURIComponent(item.location)}`;
const buildICS = item => {
  const stamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Hearby//EN","BEGIN:VEVENT",`UID:hearby-${item.id}@hearby.app`,`DTSTAMP:${stamp}`,`DTSTART:${toGCal(item.startIso)}`,`DTEND:${toGCal(item.endIso)}`,`SUMMARY:${item.title}`,`DESCRIPTION:${item.desc}`,`LOCATION:${item.location}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
};

// ── Shared components ──────────────────────────────────────────
function GoldButton({children,onClick,disabled,T,small}) {
  return <button onClick={onClick} disabled={disabled} style={{ width:"100%", background:disabled?T.mutedL:T.text, color:disabled?T.muted:T.goldBri, fontSize:small?12:15, fontWeight:700, padding:small?"8px 16px":"15px 24px", borderRadius:small?20:14, border:`2px solid ${disabled?T.mutedL:T.text}`, cursor:disabled?"default":"pointer", fontFamily:FB, letterSpacing:"0.04em", boxShadow:disabled?"none":`0 4px 20px ${T.goldGlow}`, transition:"all 0.2s" }}>{children}</button>;
}

function SourcePill({source,T}) {
  const c = SRC_COLORS[source]||T.muted;
  return <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:c, padding:"2px 8px", borderRadius:20, background:c+"18", border:`1px solid ${c}50`, fontFamily:FB }}>{source}</span>;
}

function CalendarModal({item,onClose,T}) {
  const [added,setAdded] = useState(null);
  const handleGoogle = () => { window.open(buildGoogleUrl(item),"_blank"); setAdded("google"); setTimeout(onClose,1200); };
  const handleICal = () => { const ics=buildICS(item); const blob=new Blob([ics],{type:"text/calendar"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${item.title.replace(/\s+/g,"-")}.ics`; a.click(); URL.revokeObjectURL(url); setAdded("ical"); setTimeout(onClose,1200); };
  return (
    <div style={{ position:"absolute",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%",background:T.bg,borderRadius:"20px 20px 0 0",border:`2px solid ${T.border}`,borderBottom:"none",padding:"20px 20px 32px",boxShadow:`0 -4px 0 ${T.border}` }}>
        <div style={{ width:36,height:4,background:T.borderSub,borderRadius:2,margin:"0 auto 18px" }}/>
        <div style={{ fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FB,marginBottom:4 }}>Add to calendar</div>
        <div style={{ fontSize:16,fontWeight:800,color:T.text,fontFamily:FD,marginBottom:4 }}>{item.title}</div>
        <div style={{ fontSize:12,color:T.muted,fontFamily:FB,marginBottom:14 }}>🕐 {item.time} · 📍 {item.location}</div>
        <div style={{ height:1.5,background:T.borderSub,marginBottom:14 }}/>
        {[{key:"google",icon:"📅",label:"Google Calendar",sub:"Opens in browser — tap Save"},{key:"ical",icon:"🍎",label:"Apple Calendar (iCal)",sub:"Downloads .ics file"}].map(opt=>(
          <button key={opt.key} onClick={opt.key==="google"?handleGoogle:handleICal} style={{ width:"100%",display:"flex",alignItems:"center",gap:14,background:added===opt.key?T.green+"15":T.bgCardHi,border:`2px solid ${added===opt.key?T.green:T.border}`,borderRadius:14,padding:"13px 16px",cursor:"pointer",marginBottom:10,boxShadow:`2px 2px 0 ${added===opt.key?T.green:T.border}`,transition:"all 0.2s" }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"#fff",border:"1.5px solid #E0E0E8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{opt.icon}</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:14,fontWeight:700,color:added===opt.key?T.green:T.text,fontFamily:FB }}>{added===opt.key?`✓ ${opt.key==="google"?"Opening…":"Downloading…"}`:opt.label}</div>
              <div style={{ fontSize:12,color:T.muted,fontFamily:FB }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ width:"100%",background:"transparent",border:`2px solid ${T.borderSub}`,borderRadius:14,padding:"12px",fontSize:13,fontWeight:600,color:T.muted,cursor:"pointer",fontFamily:FB }}>Cancel</button>
      </div>
    </div>
  );
}

// ── EventCard (compact, used in feed) ─────────────────────────
function EventCard({item,saved,onSave,onOpen,T}) {
  const isAff = item.booking?.affiliate;
  const [calOpen,setCalOpen] = useState(false);
  return (
    <div style={{ background:T.bgCard,borderRadius:16,marginBottom:14,overflow:"hidden",border:`2px solid ${isAff?T.gold:T.border}`,boxShadow:`4px 4px 0 ${isAff?T.goldDim:T.border}`,position:"relative" }}>
      <div style={{ height:4,background:isAff?`linear-gradient(90deg,${T.goldDim},${T.goldBri},${T.goldDim})`:item.catColor }}/>
      <div style={{ padding:"14px 16px 16px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            <span style={{ fontSize:12 }}>{item.img}</span>
            <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:item.catDot,fontFamily:FB }}>{item.category}</span>
            {item.type==="recommendation"&&<span style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.goldDim,background:T.goldLight,border:`1px solid ${T.gold}`,padding:"1px 7px",borderRadius:10,fontFamily:FB }}>NEARBY</span>}
          </div>
          <button onClick={()=>onSave(item.id)} style={{ background:saved?T.red+"18":"transparent",border:`1.5px solid ${saved?T.red:T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"4px 10px",fontSize:14,color:saved?T.red:T.muted,transition:"all 0.15s" }}>{saved?"♥":"♡"}</button>
        </div>
        <h3 onClick={()=>onOpen(item)} style={{ margin:"0 0 6px",fontSize:17,fontWeight:800,color:T.text,lineHeight:1.2,fontFamily:FD,letterSpacing:"-0.01em",cursor:"pointer" }}>{item.title}</h3>
        {item.rating&&<div style={{ display:"flex",alignItems:"center",gap:5,marginBottom:6 }}><span style={{ color:T.gold,fontSize:12 }}>{"★".repeat(Math.round(item.rating))}</span><span style={{ fontSize:12,fontWeight:700,color:T.goldDim,fontFamily:FB }}>{item.rating}</span><span style={{ fontSize:11,color:T.muted,fontFamily:FB }}>({item.reviews})</span></div>}
        <p style={{ margin:"0 0 12px",fontSize:13,color:T.textSub,lineHeight:1.6,fontFamily:FB }}>{item.desc}</p>
        {item.showings&&<div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:12 }}>{item.showings.map(t=><span key={t} style={{ fontSize:12,fontWeight:600,color:T.purple,background:T.purple+"15",border:`1.5px solid ${T.purple}50`,padding:"3px 10px",borderRadius:20,fontFamily:FB }}>{t}</span>)}</div>}
        <div style={{ padding:"10px 0",borderTop:`1.5px solid ${T.borderSub}`,marginBottom:12 }}>
          <div style={{ display:"flex",gap:8,marginBottom:4 }}><span>🕐</span><span style={{ fontSize:13,color:T.text,fontWeight:600,fontFamily:FB }}>{item.time}</span></div>
          <div style={{ display:"flex",gap:8 }}><span>📍</span><span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>{item.location}</span></div>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}><SourcePill source={item.source} T={T}/><span style={{ fontSize:11,color:T.muted,fontFamily:FB }}>{item.saves} saves</span></div>
          <div style={{ display:"flex",gap:7,alignItems:"center" }}>
            <button onClick={()=>setCalOpen(true)} style={{ background:T.bgCardHi,border:`2px solid ${T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"6px 10px",fontSize:14,boxShadow:`2px 2px 0 ${T.borderSub}` }}>📅</button>
            <button onClick={()=>onOpen(item)} style={{ background:"transparent",color:T.text,fontSize:12,fontWeight:600,padding:"7px 14px",borderRadius:20,border:`2px solid ${T.borderSub}`,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.borderSub}` }}>View →</button>
          </div>
        </div>
      </div>
      {calOpen&&<CalendarModal item={item} onClose={()=>setCalOpen(false)} T={T}/>}
    </div>
  );
}

// ── EVENT DETAIL SCREEN ────────────────────────────────────────
function EventDetailScreen({item,saved,onSave,onBack,T}) {
  const [calOpen,setCalOpen] = useState(false);
  const [shared,setShared] = useState(false);
  const isAff = item.booking?.affiliate;

  const handleShare = () => {
    setShared(true);
    setTimeout(()=>setShared(false),2000);
  };

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",background:T.bg,overflow:"hidden",position:"relative" }}>
      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, ${item.catColor}22, ${item.catColor}08)`, borderBottom:`2px solid ${item.catColor}`, padding:"16px 18px 20px", position:"relative" }}>
        {/* Back + actions */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <button onClick={onBack} style={{ background:T.bg,border:`2px solid ${T.border}`,borderRadius:20,cursor:"pointer",padding:"6px 14px",fontSize:13,fontWeight:700,color:T.text,fontFamily:FB,boxShadow:`2px 2px 0 ${T.border}`,display:"flex",alignItems:"center",gap:6 }}>← Back</button>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>onSave(item.id)} style={{ background:saved?T.red+"18":"transparent",border:`2px solid ${saved?T.red:T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"6px 12px",fontSize:14,color:saved?T.red:T.muted,transition:"all 0.15s",boxShadow:`2px 2px 0 ${saved?T.red:T.borderSub}` }}>{saved?"♥":"♡"}</button>
            <button onClick={handleShare} style={{ background:shared?T.green+"15":"transparent",border:`2px solid ${shared?T.green:T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"6px 12px",fontSize:14,color:shared?T.green:T.muted,transition:"all 0.2s",boxShadow:`2px 2px 0 ${shared?T.green:T.borderSub}` }}>{shared?"✓":"↗"}</button>
          </div>
        </div>

        {/* Category + emoji */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
          <div style={{ width:52,height:52,borderRadius:14,background:T.bg,border:`2px solid ${item.catColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`3px 3px 0 ${item.catColor}` }}>{item.img}</div>
          <div>
            <div style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:item.catDot,fontFamily:FB }}>{item.category}</div>
            {item.type==="recommendation"&&<div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",color:T.goldDim,background:T.goldLight,border:`1px solid ${T.gold}`,padding:"1px 7px",borderRadius:10,fontFamily:FB,marginTop:3,display:"inline-block" }}>NEARBY</div>}
          </div>
        </div>

        <h1 style={{ margin:"0 0 8px",fontSize:24,fontWeight:800,color:T.text,lineHeight:1.15,fontFamily:FD,letterSpacing:"-0.02em" }}>{item.title}</h1>

        {/* Rating */}
        {item.rating&&<div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}><span style={{ color:T.gold,fontSize:14 }}>{"★".repeat(Math.round(item.rating))}</span><span style={{ fontSize:13,fontWeight:700,color:T.goldDim,fontFamily:FB }}>{item.rating}</span><span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>({item.reviews} reviews)</span></div>}

        {/* Tags */}
        {item.tags&&<div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{item.tags.map(tag=><span key={tag} style={{ fontSize:11,fontWeight:600,color:T.muted,background:T.bgCardHi,border:`1.5px solid ${T.borderSub}`,padding:"3px 10px",borderRadius:20,fontFamily:FB }}>{tag}</span>)}</div>}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1,overflowY:"auto",padding:"20px 18px 120px" }}>
        {/* Time + Location */}
        <div style={{ background:T.bgCardHi,border:`2px solid ${T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:16,boxShadow:`3px 3px 0 ${T.border}` }}>
          <div style={{ display:"flex",gap:10,marginBottom:10 }}>
            <span style={{ fontSize:20 }}>🕐</span>
            <div><div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB }}>Date & Time</div><div style={{ fontSize:13,color:T.textSub,fontFamily:FB }}>{item.time}</div><div style={{ fontSize:12,color:T.muted,fontFamily:FB }}>{item.date}</div></div>
          </div>
          <div style={{ height:1.5,background:T.borderSub,margin:"0 0 10px" }}/>
          <div style={{ display:"flex",gap:10 }}>
            <span style={{ fontSize:20 }}>📍</span>
            <div><div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB }}>Location</div><div style={{ fontSize:13,color:T.textSub,fontFamily:FB }}>{item.location}</div></div>
          </div>
        </div>

        {/* Map placeholder */}
        <div style={{ background:`linear-gradient(135deg,${T.bgCardHi},${T.bgSub})`,border:`2px solid ${T.border}`,borderRadius:14,height:160,marginBottom:16,boxShadow:`3px 3px 0 ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",inset:0,opacity:0.04,backgroundImage:"radial-gradient(circle,#000 1px,transparent 1px)",backgroundSize:"20px 20px" }}/>
          <span style={{ fontSize:32 }}>🗺️</span>
          <span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>Map · {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</span>
          <button style={{ fontSize:11,fontWeight:700,color:T.goldDim,background:T.goldLight,border:`1.5px solid ${T.gold}`,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:FB }}>Open in Maps ↗</button>
        </div>

        {/* Showtime pills */}
        {item.showings&&<div style={{ marginBottom:16 }}><div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.muted,fontFamily:FB,marginBottom:8 }}>Showings today</div><div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>{item.showings.map(t=><button key={t} style={{ fontSize:13,fontWeight:600,color:T.purple,background:T.purple+"15",border:`2px solid ${T.purple}50`,padding:"6px 16px",borderRadius:20,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.purple}30` }}>{t}</button>)}</div></div>}

        {/* About */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:T.muted,fontFamily:FB,marginBottom:10 }}>About</div>
          <p style={{ margin:0,fontSize:14,color:T.textSub,lineHeight:1.7,fontFamily:FB }}>{item.longDesc||item.desc}</p>
        </div>

        {/* Source */}
        <div style={{ display:"flex",alignItems:"center",gap:8,padding:"12px 0",borderTop:`1.5px solid ${T.borderSub}` }}>
          <span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>Source:</span>
          <SourcePill source={item.source} T={T}/>
          <span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>{item.saves} saves</span>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,background:T.bg,borderTop:`2px solid ${T.border}`,padding:"14px 18px 24px",display:"flex",gap:10 }}>
        <button onClick={()=>setCalOpen(true)} style={{ flex:"0 0 auto",background:T.bgCardHi,border:`2px solid ${T.border}`,borderRadius:14,cursor:"pointer",padding:"13px 16px",fontSize:18,boxShadow:`3px 3px 0 ${T.border}` }}>📅</button>
        {item.booking?(
          <a href={item.booking.url} style={{ flex:1,background:isAff?T.text:T.bg,color:isAff?T.goldBri:T.text,border:`2px solid ${T.text}`,fontSize:14,fontWeight:700,padding:"13px",borderRadius:14,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:FB,boxShadow:`3px 3px 0 ${isAff?T.goldDim:T.border}` }}>{item.booking.label}{isAff&&<span style={{color:T.goldBri}}>↗</span>}</a>
        ):(
          <button style={{ flex:1,background:T.text,color:T.goldBri,border:`2px solid ${T.text}`,fontSize:14,fontWeight:700,padding:"13px",borderRadius:14,cursor:"pointer",fontFamily:FB,boxShadow:`3px 3px 0 ${T.goldDim}` }}>Get directions ↗</button>
        )}
      </div>
      {calOpen&&<CalendarModal item={item} onClose={()=>setCalOpen(false)} T={T}/>}
    </div>
  );
}

// ── MAP SCREEN ─────────────────────────────────────────────────
function MapScreen({saved,onSave,onOpen,area,onAreaChange,T}) {
  const [selected,setSelected] = useState(null);
  const [filter,setFilter] = useState("All");
  const [searchVal,setSearchVal] = useState(area||"");
  const [searchFocused,setSearchFocused] = useState(false);
  const [drawMode,setDrawMode] = useState(false);
  const [drawPoints,setDrawPoints] = useState([]);
  const [drawClosed,setDrawClosed] = useState(false);
  const cats = ["All","Events","Nearby"];

  const visible = EVENTS.filter(e=> filter==="All"?true:filter==="Events"?e.type==="event":e.type==="recommendation");

  const mapW=358, mapH=260;
  const minLat=51.450,maxLat=51.515,minLng=-0.130,maxLng=-0.100;
  const project = (lat,lng) => ({
    x:((lng-minLng)/(maxLng-minLng))*mapW,
    y:((maxLat-lat)/(maxLat-minLat))*mapH,
  });

  const handleAreaSubmit = () => {
    if(searchVal.trim()) onAreaChange(searchVal.trim());
  };

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",background:T.bgSub,overflow:"hidden" }}>
      {/* Header with area search */}
      <div style={{ background:T.bg,borderBottom:`2px solid ${T.border}`,padding:"12px 16px 14px" }}>
        {/* Area search bar */}
        <div style={{ position:"relative",marginBottom:12 }}>
          <span style={{ position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none" }}>📍</span>
          <input
            value={searchVal}
            onChange={e=>setSearchVal(e.target.value)}
            onFocus={()=>setSearchFocused(true)}
            onBlur={()=>setSearchFocused(false)}
            onKeyDown={e=>e.key==="Enter"&&handleAreaSubmit()}
            placeholder="Search a new area…"
            style={{ width:"100%",boxSizing:"border-box",background:T.bgCardHi,color:T.text,border:`2px solid ${searchFocused||searchVal!==area?T.text:T.borderSub}`,borderRadius:12,fontSize:14,padding:"11px 44px 11px 40px",outline:"none",fontFamily:FB,transition:"border-color 0.2s" }}
          />
          {searchVal&&searchVal!==area&&(
            <button onClick={handleAreaSubmit} style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:T.text,color:T.goldBri,border:"none",borderRadius:20,cursor:"pointer",padding:"4px 12px",fontSize:12,fontWeight:700,fontFamily:FB }}>Go →</button>
          )}
        </div>
        {/* Filter chips */}
        <div style={{ display:"flex",gap:7 }}>
          {cats.map(c=>{
            const on=filter===c;
            return <button key={c} onClick={()=>{setFilter(c);setSelected(null);}} style={{ padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FB,background:on?T.text:"transparent",border:`2px solid ${on?T.text:T.borderSub}`,color:on?T.goldBri:T.muted,boxShadow:on?`2px 2px 0 ${T.goldDim}`:"none",transition:"all 0.15s" }}>{c}</button>;
          })}
        </div>
      </div>

      {/* Map with tap-to-draw */}
      <div style={{ background:T.bgCard,border:`2px solid ${T.border}`,margin:"12px 12px 0",borderRadius:16,overflow:"hidden",position:"relative",boxShadow:`4px 4px 0 ${T.border}` }}>
        {/* Mode toggle */}
        <div style={{ position:"absolute",top:8,right:8,zIndex:10,display:"flex",gap:6 }}>
          <button onClick={()=>{setDrawMode(false);setDrawPoints([]);setSelected(null);}} style={{ padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:FB,background:!drawMode?T.text:"transparent",border:`2px solid ${!drawMode?T.text:T.borderSub}`,color:!drawMode?T.goldBri:T.muted,boxShadow:!drawMode?`2px 2px 0 ${T.goldDim}`:"none",transition:"all 0.15s" }}>📍 Browse</button>
          <button onClick={()=>{setDrawMode(true);setSelected(null);setDrawPoints([]);}} style={{ padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:FB,background:drawMode?T.text:"transparent",border:`2px solid ${drawMode?T.gold:T.borderSub}`,color:drawMode?T.goldBri:T.gold,boxShadow:drawMode?`2px 2px 0 ${T.goldDim}`:"none",transition:"all 0.15s" }}>✏️ Draw area</button>
        </div>

        {/* Draw hint */}
        {drawMode&&(
          <div style={{ position:"absolute",top:8,left:8,zIndex:10,background:T.goldLight,border:`1.5px solid ${T.gold}`,borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:600,color:T.goldDim,fontFamily:FB }}>
            {drawPoints.length===0?"Tap to start drawing":"Tap to add points · Close to finish"}
          </div>
        )}

        <svg
          width={mapW} height={mapH}
          style={{ display:"block", cursor:drawMode?"crosshair":"default" }}
          onClick={e=>{
            if(!drawMode) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Close shape if clicking near the first point
            if(drawPoints.length>=3) {
              const [fx,fy] = drawPoints[0];
              if(Math.abs(x-fx)<18&&Math.abs(y-fy)<18) { setDrawClosed(true); return; }
            }
            setDrawClosed(false);
            setDrawPoints(p=>[...p,[x,y]]);
          }}
        >
          {/* Grid */}
          {[0,1,2,3].map(i=><line key={`h${i}`} x1={0} y1={i*(mapH/3)} x2={mapW} y2={i*(mapH/3)} stroke={T.borderSub} strokeWidth={1}/>)}
          {[0,1,2,3,4].map(i=><line key={`v${i}`} x1={i*(mapW/4)} y1={0} x2={i*(mapW/4)} y2={mapH} stroke={T.borderSub} strokeWidth={1}/>)}
          {/* Roads */}
          <line x1={0} y1={mapH*0.55} x2={mapW} y2={mapH*0.55} stroke={T.borderSub} strokeWidth={3} opacity={0.4}/>
          <line x1={mapW*0.45} y1={0} x2={mapW*0.45} y2={mapH} stroke={T.borderSub} strokeWidth={3} opacity={0.4}/>

          {/* Drawn polygon */}
          {drawPoints.length>=2&&(
            <polyline
              points={[...drawPoints,drawClosed?drawPoints[0]:drawPoints[drawPoints.length-1]].map(p=>p.join(",")).join(" ")}
              fill={drawClosed?T.gold+"25":"none"}
              stroke={T.gold} strokeWidth={2.5} strokeDasharray={drawClosed?"none":"6 3"}
              strokeLinejoin="round" strokeLinecap="round"
            />
          )}
          {drawClosed&&drawPoints.length>=3&&(
            <polygon points={drawPoints.map(p=>p.join(",")).join(" ")} fill={T.gold+"20"} stroke={T.gold} strokeWidth={2.5}/>
          )}

          {/* Draw points */}
          {drawMode&&drawPoints.map(([x,y],i)=>(
            <g key={i}>
              <circle cx={x} cy={y} r={i===0?8:5} fill={i===0?T.gold:T.goldBri} stroke={T.bg} strokeWidth={2}/>
              {i===0&&drawPoints.length>=3&&!drawClosed&&(
                <circle cx={x} cy={y} r={14} fill="none" stroke={T.gold} strokeWidth={1.5} opacity={0.5} strokeDasharray="3 3"/>
              )}
            </g>
          ))}

          {/* Event pins — dimmed when drawing */}
          {visible.map(item=>{
            const {x,y} = project(item.lat,item.lng);
            const isSel = selected?.id===item.id;
            const color = item.type==="recommendation"?"#B8920A":item.catColor;
            // In draw mode, show pin only if inside drawn area (simplified: always show)
            const dimmed = drawMode&&!drawClosed;
            return (
              <g key={item.id} onClick={e=>{if(drawMode)return;e.stopPropagation();setSelected(isSel?null:item);}} style={{ cursor:drawMode?"crosshair":"pointer", opacity:dimmed?0.3:1, transition:"opacity 0.2s" }}>
                <circle cx={x} cy={y} r={isSel?18:14} fill={color} stroke={isSel?"#fff":T.bg} strokeWidth={isSel?3:2} opacity={0.95}/>
                <text x={x} y={y+5} textAnchor="middle" fontSize={isSel?14:11}>{item.img}</text>
                {isSel&&<circle cx={x} cy={y} r={22} fill="none" stroke={color} strokeWidth={2} opacity={0.4}/>}
              </g>
            );
          })}
        </svg>

        {/* Map footer */}
        <div style={{ position:"absolute",bottom:8,right:10,fontSize:10,color:T.mutedL,fontFamily:FB,background:T.bg+"CC",padding:"2px 8px",borderRadius:10 }}>South London · Demo map</div>
      </div>

      {/* Draw area action bar */}
      {drawMode&&(
        <div style={{ display:"flex",gap:8,padding:"10px 12px 0",alignItems:"center" }}>
          {drawPoints.length===0?(
            <div style={{ fontSize:12,color:T.muted,fontFamily:FB }}>Tap on the map to draw your area of interest</div>
          ):!drawClosed?(
            <>
              <div style={{ fontSize:12,color:T.muted,fontFamily:FB,flex:1 }}>{drawPoints.length} point{drawPoints.length!==1?"s":""} — {drawPoints.length>=3?"tap first point to close":"add more points"}</div>
              <button onClick={()=>setDrawPoints(p=>p.slice(0,-1))} style={{ background:"transparent",border:`2px solid ${T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"5px 12px",fontSize:12,fontWeight:600,color:T.muted,fontFamily:FB }}>Undo</button>
              <button onClick={()=>{setDrawPoints([]);setDrawClosed(false);}} style={{ background:"transparent",border:`2px solid ${T.red}`,borderRadius:20,cursor:"pointer",padding:"5px 12px",fontSize:12,fontWeight:600,color:T.red,fontFamily:FB }}>Clear</button>
            </>
          ):(
            <>
              <div style={{ fontSize:12,color:T.goldDim,fontFamily:FB,flex:1,fontWeight:600 }}>✦ Area selected — {visible.length} results inside</div>
              <button onClick={()=>{setDrawPoints([]);setDrawClosed(false);}} style={{ background:"transparent",border:`2px solid ${T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"5px 12px",fontSize:12,fontWeight:600,color:T.muted,fontFamily:FB }}>Clear</button>
              <button onClick={()=>{setDrawMode(false);}} style={{ background:T.text,border:`2px solid ${T.text}`,borderRadius:20,cursor:"pointer",padding:"5px 12px",fontSize:12,fontWeight:700,color:T.goldBri,fontFamily:FB,boxShadow:`2px 2px 0 ${T.goldDim}` }}>Search this area</button>
            </>
          )}
        </div>
      )}

      {/* Selected card or list */}
      <div style={{ flex:1,overflowY:"auto",padding:"12px 12px 100px" }}>
        {selected ? (
          <div style={{ background:T.bgCard,border:`2px solid ${selected.catColor}`,borderRadius:16,padding:"14px 16px",boxShadow:`4px 4px 0 ${selected.catColor}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <span>{selected.img}</span>
                <span style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",color:selected.catDot,fontFamily:FB }}>{selected.category}</span>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:"transparent",border:"none",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
            </div>
            <h3 style={{ margin:"0 0 6px",fontSize:16,fontWeight:800,color:T.text,fontFamily:FD }}>{selected.title}</h3>
            <p style={{ margin:"0 0 10px",fontSize:13,color:T.textSub,lineHeight:1.5,fontFamily:FB }}>{selected.desc}</p>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <span style={{ fontSize:12 }}>🕐</span><span style={{ fontSize:12,color:T.text,fontWeight:600,fontFamily:FB }}>{selected.time}</span>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>onOpen(selected)} style={{ flex:1,background:T.text,color:T.goldBri,border:`2px solid ${T.text}`,borderRadius:12,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.goldDim}` }}>View details →</button>
              <button onClick={()=>onSave(selected.id)} style={{ background:saved.has(selected.id)?T.red+"15":"transparent",border:`2px solid ${saved.has(selected.id)?T.red:T.borderSub}`,borderRadius:12,padding:"10px 14px",fontSize:16,cursor:"pointer",color:saved.has(selected.id)?T.red:T.muted }}>
                {saved.has(selected.id)?"♥":"♡"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:12,fontWeight:600,color:T.muted,fontFamily:FB,marginBottom:10 }}>{visible.length} places on map — tap a pin to preview</div>
            {visible.map(item=>(
              <button key={item.id} onClick={()=>setSelected(item)} style={{ width:"100%",display:"flex",alignItems:"center",gap:12,background:T.bgCard,border:`2px solid ${T.borderSub}`,borderRadius:12,padding:"10px 14px",marginBottom:8,cursor:"pointer",textAlign:"left",boxShadow:`2px 2px 0 ${T.borderSub}`,transition:"all 0.15s" }}>
                <div style={{ width:36,height:36,borderRadius:10,background:item.catColor+"20",border:`1.5px solid ${item.catColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{item.img}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.title}</div>
                  <div style={{ fontSize:11,color:T.muted,fontFamily:FB }}>{item.time}</div>
                </div>
                <span style={{ fontSize:11,color:item.catDot,fontWeight:600,fontFamily:FB,flexShrink:0 }}>→</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── SEARCH SCREEN ──────────────────────────────────────────────
function SearchScreen({saved,onSave,onOpen,T}) {
  const [query,setQuery] = useState("");
  const [focused,setFocused] = useState(false);
  const inputRef = useRef(null);

  const results = query.trim().length>1
    ? EVENTS.filter(e=>
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        e.desc.toLowerCase().includes(query.toLowerCase()) ||
        e.category.toLowerCase().includes(query.toLowerCase()) ||
        e.location.toLowerCase().includes(query.toLowerCase()) ||
        e.tags?.some(t=>t.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  const recent = EVENTS.slice(0,3);
  const trending = ["Brixton","Open Mic","Parkrun","Japanese food","Cinema","Community"];

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",background:T.bgSub,overflow:"hidden" }}>
      {/* Search bar */}
      <div style={{ background:T.bg,borderBottom:`2px solid ${T.border}`,padding:"12px 16px 14px" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,pointerEvents:"none" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onFocus={()=>setFocused(true)}
            onBlur={()=>setFocused(false)}
            placeholder="Events, places, categories…"
            style={{ width:"100%",boxSizing:"border-box",background:T.bgCardHi,color:T.text,border:`2px solid ${focused||query?T.text:T.borderSub}`,borderRadius:14,fontSize:15,padding:"13px 44px 13px 44px",outline:"none",fontFamily:FB,transition:"border-color 0.2s" }}
          />
          {query&&<button onClick={()=>setQuery("")} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>}
        </div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 100px" }}>
        {query.trim().length>1 ? (
          <>
            <div style={{ fontSize:12,fontWeight:600,color:T.muted,fontFamily:FB,marginBottom:12 }}>
              {results.length>0?`${results.length} result${results.length!==1?"s":""} for "${query}"`:`No results for "${query}"`}
            </div>
            {results.length===0&&(
              <div style={{ textAlign:"center",padding:"40px 20px" }}>
                <div style={{ fontSize:36,marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:6,fontFamily:FD }}>No matches found</div>
                <div style={{ fontSize:13,color:T.muted,fontFamily:FB }}>Try a different keyword or browse the feed</div>
              </div>
            )}
            {results.map(item=>(
              <div key={item.id} onClick={()=>onOpen(item)} style={{ background:T.bgCard,border:`2px solid ${T.border}`,borderRadius:14,padding:"12px 14px",marginBottom:10,cursor:"pointer",boxShadow:`3px 3px 0 ${T.border}`,display:"flex",gap:12,alignItems:"center" }}>
                <div style={{ width:42,height:42,borderRadius:12,background:item.catColor+"18",border:`2px solid ${item.catColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{item.img}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:800,color:T.text,fontFamily:FD,marginBottom:2 }}>{item.title}</div>
                  <div style={{ fontSize:12,color:T.muted,fontFamily:FB,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.time} · {item.location}</div>
                  <div style={{ display:"flex",gap:5,marginTop:4,flexWrap:"wrap" }}>{item.tags?.slice(0,2).map(t=><span key={t} style={{ fontSize:10,color:T.muted,background:T.bgCardHi,border:`1px solid ${T.borderSub}`,padding:"1px 7px",borderRadius:10,fontFamily:FB }}>{t}</span>)}</div>
                </div>
                <span style={{ fontSize:12,color:T.muted }}>→</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Trending */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:T.muted,fontFamily:FB,marginBottom:10 }}>Trending in Brixton</div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {trending.map(t=>(
                  <button key={t} onClick={()=>setQuery(t)} style={{ padding:"7px 14px",borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FB,background:T.bgCard,border:`2px solid ${T.border}`,color:T.text,boxShadow:`2px 2px 0 ${T.border}`,transition:"all 0.15s" }}>#{t}</button>
                ))}
              </div>
            </div>

            {/* Recent */}
            <div>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:T.muted,fontFamily:FB,marginBottom:10 }}>Happening soon</div>
              {recent.map(item=>(
                <div key={item.id} onClick={()=>onOpen(item)} style={{ background:T.bgCard,border:`2px solid ${T.borderSub}`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",gap:12,alignItems:"center",boxShadow:`2px 2px 0 ${T.borderSub}` }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:item.catColor+"18",border:`1.5px solid ${item.catColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{item.img}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.title}</div>
                    <div style={{ fontSize:11,color:T.muted,fontFamily:FB }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── PROFILE SCREEN ─────────────────────────────────────────────
const AVATAR_OPTIONS = ["👤","🦊","🐻","🦁","🐼","🦋","🌟","🎭","🏄","🎨","🎸","🌿"];

function ProfileScreen({saved,onOpen,onChangeArea,area,T}) {
  const savedEvents = EVENTS.filter(e=>saved.has(e.id));
  const [notifs,setNotifs] = useState({ breaking:true, events:true, recs:false, weekly:true });
  const [emailVal] = useState("user@email.com");
  const [username,setUsername] = useState("hearby user");
  const [avatar,setAvatar] = useState("👤");
  const [editingName,setEditingName] = useState(false);
  const [nameInput,setNameInput] = useState(username);
  const [showAvatarPicker,setShowAvatarPicker] = useState(false);

  const toggle = key => setNotifs(n=>({...n,[key]:!n[key]}));
  const saveName = () => { if(nameInput.trim()) setUsername(nameInput.trim()); setEditingName(false); };

  const Toggle = ({on,onToggle}) => (
    <div onClick={onToggle} style={{ width:44,height:24,borderRadius:12,background:on?T.text:T.borderSub,border:`2px solid ${on?T.text:T.borderSub}`,cursor:"pointer",position:"relative",transition:"all 0.2s",flexShrink:0 }}>
      <div style={{ position:"absolute",top:2,left:on?22:2,width:16,height:16,borderRadius:8,background:on?T.goldBri:T.bg,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
    </div>
  );

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",background:T.bgSub,overflow:"hidden" }}>
      <div style={{ background:T.bg,borderBottom:`2px solid ${T.border}`,padding:"14px 18px 16px" }}>
        <div style={{ fontSize:10,fontWeight:700,color:T.mutedL,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:FB }}>Your Profile</div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 100px" }}>
        {/* User card */}
        <div style={{ background:T.bgCard,border:`2px solid ${T.border}`,borderRadius:16,padding:"18px",marginBottom:16,boxShadow:`4px 4px 0 ${T.border}` }}>

          {/* Avatar + name row */}
          <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:14 }}>
            {/* Avatar — tap to change */}
            <div style={{ position:"relative",flexShrink:0 }}>
              <button onClick={()=>setShowAvatarPicker(o=>!o)} style={{ width:60,height:60,borderRadius:"50%",background:`linear-gradient(135deg,${T.goldLight},${T.goldGlow})`,border:`2px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`3px 3px 0 ${T.goldDim}`,cursor:"pointer",position:"relative" }}>
                {avatar}
              </button>
              <div style={{ position:"absolute",bottom:-2,right:-2,width:20,height:20,borderRadius:"50%",background:T.text,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.goldBri,cursor:"pointer",pointerEvents:"none" }}>✎</div>
            </div>

            {/* Name — tap to edit */}
            <div style={{ flex:1,minWidth:0 }}>
              {editingName ? (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <input
                    value={nameInput}
                    onChange={e=>setNameInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape"){setEditingName(false);setNameInput(username);}}}
                    autoFocus
                    style={{ width:"100%",boxSizing:"border-box",background:T.bgCardHi,color:T.text,border:`2px solid ${T.text}`,borderRadius:10,fontSize:15,padding:"9px 12px",outline:"none",fontFamily:FD,fontWeight:800 }}
                  />
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={saveName} style={{ flex:1,background:T.text,color:T.goldBri,border:`2px solid ${T.text}`,borderRadius:10,padding:"8px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.goldDim}` }}>Save</button>
                    <button onClick={()=>{setEditingName(false);setNameInput(username);}} style={{ flex:1,background:"transparent",color:T.muted,border:`2px solid ${T.borderSub}`,borderRadius:10,padding:"8px",fontSize:13,cursor:"pointer",fontFamily:FB }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>{setEditingName(true);setNameInput(username);}} style={{ background:"transparent",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:8,width:"100%" }}>
                  <span style={{ fontSize:17,fontWeight:800,color:T.text,fontFamily:FD,textAlign:"left" }}>{username}</span>
                  <span style={{ fontSize:11,color:T.gold,background:T.goldLight,border:`1px solid ${T.gold}`,borderRadius:10,padding:"1px 7px",fontFamily:FB,fontWeight:600,flexShrink:0 }}>Edit</span>
                </button>
              )}
              <div style={{ fontSize:13,color:T.muted,fontFamily:FB,marginTop:3 }}>{emailVal}</div>
            </div>
          </div>

          {/* Avatar picker */}
          {showAvatarPicker && (
            <div style={{ background:T.bgCardHi,border:`2px solid ${T.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:`3px 3px 0 ${T.border}` }}>
              <div style={{ fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FB,marginBottom:10 }}>Choose your avatar</div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {AVATAR_OPTIONS.map(opt=>(
                  <button key={opt} onClick={()=>{setAvatar(opt);setShowAvatarPicker(false);}} style={{ width:44,height:44,borderRadius:12,fontSize:22,cursor:"pointer",border:`2px solid ${avatar===opt?T.text:T.borderSub}`,background:avatar===opt?T.text+"18":"transparent",boxShadow:avatar===opt?`2px 2px 0 ${T.border}`:"none",transition:"all 0.15s" }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ height:1.5,background:T.borderSub,marginBottom:14 }}/>

          {/* Area row */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:10,fontWeight:600,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FB }}>Your area</div>
              <div style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:FD }}>{area}</div>
            </div>
            <button onClick={onChangeArea} style={{ background:T.text,color:T.goldBri,border:`2px solid ${T.text}`,borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.goldDim}` }}>Change →</button>
          </div>
        </div>

        {/* Saved events */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:T.muted,fontFamily:FB,marginBottom:10 }}>Saved ({savedEvents.length})</div>
          {savedEvents.length===0?(
            <div style={{ background:T.bgCard,border:`2px solid ${T.borderSub}`,borderRadius:14,padding:"24px",textAlign:"center",boxShadow:`2px 2px 0 ${T.borderSub}` }}>
              <div style={{ fontSize:28,marginBottom:8 }}>♡</div>
              <div style={{ fontSize:14,fontWeight:600,color:T.text,fontFamily:FD,marginBottom:4 }}>Nothing saved yet</div>
              <div style={{ fontSize:12,color:T.muted,fontFamily:FB }}>Tap ♡ on any card in the feed</div>
            </div>
          ):(
            savedEvents.map(item=>(
              <div key={item.id} onClick={()=>onOpen(item)} style={{ background:T.bgCard,border:`2px solid ${T.border}`,borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",gap:12,alignItems:"center",boxShadow:`3px 3px 0 ${T.border}` }}>
                <div style={{ width:38,height:38,borderRadius:10,background:item.catColor+"18",border:`1.5px solid ${item.catColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{item.img}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.title}</div>
                  <div style={{ fontSize:11,color:T.muted,fontFamily:FB }}>{item.time}</div>
                </div>
                <span style={{ color:T.muted,fontSize:12 }}>→</span>
              </div>
            ))
          )}
        </div>

        {/* Notifications */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:T.muted,fontFamily:FB,marginBottom:10 }}>Notifications</div>
          <div style={{ background:T.bgCard,border:`2px solid ${T.border}`,borderRadius:16,overflow:"hidden",boxShadow:`3px 3px 0 ${T.border}` }}>
            {[
              {key:"breaking",label:"Breaking local news",sub:"Incidents, closures, urgent updates"},
              {key:"events",label:"New events nearby",sub:"When new events are added in your area"},
              {key:"recs",label:"Recommendations",sub:"New restaurants and places to try"},
              {key:"weekly",label:"Weekly digest email",sub:"Every Monday morning summary"},
            ].map((n,i)=>(
              <div key={n.key} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:i<3?`1.5px solid ${T.borderSub}`:"none" }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:T.text,fontFamily:FB }}>{n.label}</div>
                  <div style={{ fontSize:11,color:T.muted,fontFamily:FB }}>{n.sub}</div>
                </div>
                <Toggle on={notifs[n.key]} onToggle={()=>toggle(n.key)}/>
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:T.muted,fontFamily:FB,marginBottom:10 }}>Account</div>
          <div style={{ background:T.bgCard,border:`2px solid ${T.border}`,borderRadius:16,overflow:"hidden",boxShadow:`3px 3px 0 ${T.border}` }}>
            {["Privacy Policy","Terms of Service","Send feedback","Sign out"].map((label,i)=>(
              <button key={label} style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:i<3?`1.5px solid ${T.borderSub}`:"none",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" }}>
                <span style={{ fontSize:13,fontWeight:i===3?700:500,color:i===3?T.red:T.text,fontFamily:FB }}>{label}</span>
                {i<3&&<span style={{ color:T.muted }}>→</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Version */}
        <div style={{ textAlign:"center",marginTop:24,fontSize:11,color:T.mutedL,fontFamily:FB }}>hearby · MVP v1.0 · made with ♥</div>
      </div>
    </div>
  );
}

// ── FEED SCREEN ────────────────────────────────────────────────
function FeedScreen({area,onChangeArea,saved,setSaved,onOpen,T}) {
  const [filter,setFilter] = useState("All");
  const [showSaved,setShowSaved] = useState(false);
  const [dateOpen,setDateOpen] = useState(false);
  const [datePreset,setDatePreset] = useState(null);
  const [customFrom,setCustomFrom] = useState("");
  const [customTo,setCustomTo] = useState("");

  const toggle = id => setSaved(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  const dateRange = () => {
    const t=fmt(TODAY),tom=fmt(addDays(TODAY,1)),day=TODAY.getDay();
    const satOff=(6-day+7)%7||7,sat=fmt(addDays(TODAY,satOff)),sun=fmt(addDays(TODAY,satOff+1));
    const endWeek=fmt(addDays(TODAY,(7-day)%7||7));
    if(datePreset==="Today") return [t,t];
    if(datePreset==="Tomorrow") return [tom,tom];
    if(datePreset==="This Weekend") return [sat,sun];
    if(datePreset==="This Week") return [t,endWeek];
    if(datePreset==="Custom"&&customFrom&&customTo) return [customFrom,customTo];
    return null;
  };
  const range=dateRange();

  const filtered = EVENTS.filter(item=>{
    if(showSaved) return saved.has(item.id);
    const catOk=filter==="All"?true:filter==="Events"?item.type==="event":filter==="Nearby"?item.type==="recommendation":item.category===filter;
    if(!catOk) return false;
    if(range&&item.date) return item.date>=range[0]&&item.date<=range[1];
    return true;
  });

  const events=filtered.filter(i=>i.type==="event");
  const recs=filtered.filter(i=>i.type==="recommendation");
  const showAll=filter==="All"&&!showSaved;
  const dateLabel=datePreset==="Custom"&&customFrom&&customTo?`${customFrom.slice(5)} – ${customTo.slice(5)}`:datePreset??"Date";
  const dateActive=!!datePreset;
  const clearDate=()=>{setDatePreset(null);setCustomFrom("");setCustomTo("");setDateOpen(false);};

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",background:T.bgSub,overflow:"hidden" }}>
      <div style={{ background:T.bg,borderBottom:`2px solid ${T.border}`,padding:"12px 18px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <div>
            <div style={{ fontSize:10,fontWeight:600,color:T.mutedL,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:FB }}>Now browsing</div>
            <button onClick={onChangeArea} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:7 }}>
              <span style={{ fontSize:19,fontWeight:800,color:T.text,fontFamily:FD }}>{area}</span>
              <span style={{ fontSize:10,color:T.goldDim,fontWeight:700,background:T.goldLight,border:`1.5px solid ${T.gold}`,padding:"2px 8px",borderRadius:10,fontFamily:FB }}>▾ change</span>
            </button>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>{setShowSaved(s=>!s);setFilter("All");setDateOpen(false);}} style={{ background:showSaved?T.red+"15":"transparent",border:`2px solid ${showSaved?T.red:T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"6px 12px",fontSize:13,fontWeight:600,color:showSaved?T.red:T.muted,fontFamily:FB,display:"flex",alignItems:"center",gap:4,boxShadow:showSaved?`2px 2px 0 ${T.red}30`:"none" }}>
              {showSaved?"♥":"♡"}{saved.size>0&&` ${saved.size}`}
            </button>
            <button style={{ background:"transparent",border:`2px solid ${T.borderSub}`,borderRadius:20,cursor:"pointer",padding:"6px 10px",fontSize:15,color:T.text,boxShadow:`2px 2px 0 ${T.borderSub}` }}>🔔</button>
          </div>
        </div>
        <div style={{ display:"flex",gap:7,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none",alignItems:"center" }}>
          <button onClick={()=>setDateOpen(o=>!o)} style={{ flexShrink:0,padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FB,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,background:dateActive?T.text:"transparent",border:`2px solid ${dateActive?T.text:T.gold}`,color:dateActive?T.goldBri:T.gold,boxShadow:dateActive?`2px 2px 0 ${T.goldDim}`:`2px 2px 0 ${T.gold}40`,transition:"all 0.15s" }}>
            📅 {dateLabel}
            {dateActive&&<span onClick={e=>{e.stopPropagation();clearDate();}} style={{ fontSize:14,lineHeight:1,color:T.goldBri,marginLeft:2 }}>×</span>}
          </button>
          <div style={{ width:2,height:22,background:T.borderSub,flexShrink:0,borderRadius:2 }}/>
          {FILTERS.map(f=>{
            const on=filter===f&&!showSaved;
            return <button key={f} onClick={()=>{setFilter(f);setShowSaved(false);setDateOpen(false);}} style={{ flexShrink:0,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FB,whiteSpace:"nowrap",background:on?T.text:"transparent",border:`2px solid ${on?T.text:T.borderSub}`,color:on?T.goldBri:T.muted,boxShadow:on?`2px 2px 0 ${T.goldDim}`:"none",transition:"all 0.15s" }}>{f}</button>;
          })}
        </div>
        {dateOpen&&(
          <div style={{ background:T.bg,border:`2px solid ${T.border}`,borderRadius:14,margin:"0 0 12px",boxShadow:`4px 4px 0 ${T.border}` }}>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,padding:"12px 14px 10px" }}>
              {DATE_PRESETS.map(p=>{ const on=datePreset===p; return <button key={p} onClick={()=>{setDatePreset(p);setDateOpen(false);}} style={{ padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FB,background:on?T.text:T.bgCardHi,border:`2px solid ${on?T.text:T.borderSub}`,color:on?T.goldBri:T.textSub,boxShadow:on?`2px 2px 0 ${T.goldDim}`:"none" }}>{p}</button>; })}
            </div>
            <div style={{ height:1.5,background:T.borderSub,margin:"0 14px" }}/>
            <div style={{ padding:"10px 14px 14px" }}>
              <div style={{ fontSize:10,fontWeight:700,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:FB,marginBottom:8 }}>Custom range</div>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ flex:1,background:T.bgCardHi,color:T.text,border:`2px solid ${customFrom?T.text:T.borderSub}`,borderRadius:10,fontSize:13,padding:"8px 10px",outline:"none",fontFamily:FB,cursor:"pointer" }}/>
                <span style={{ fontSize:12,color:T.muted,fontFamily:FB }}>to</span>
                <input type="date" value={customTo} min={customFrom} onChange={e=>setCustomTo(e.target.value)} style={{ flex:1,background:T.bgCardHi,color:T.text,border:`2px solid ${customTo?T.text:T.borderSub}`,borderRadius:10,fontSize:13,padding:"8px 10px",outline:"none",fontFamily:FB,cursor:"pointer" }}/>
              </div>
              {customFrom&&customTo&&<button onClick={()=>{setDatePreset("Custom");setDateOpen(false);}} style={{ marginTop:10,width:"100%",background:T.text,color:T.goldBri,fontSize:13,fontWeight:700,padding:"10px",borderRadius:10,border:`2px solid ${T.text}`,cursor:"pointer",fontFamily:FB,boxShadow:`2px 2px 0 ${T.goldDim}` }}>Apply date range</button>}
            </div>
          </div>
        )}
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"14px 14px 100px" }}>
        {filtered.length===0?(
          <div style={{ textAlign:"center",padding:"60px 20px" }}>
            <div style={{ fontSize:36,marginBottom:12 }}>{showSaved?"♡":"📅"}</div>
            <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:6,fontFamily:FD }}>{showSaved?"Nothing saved yet":"No results"}</div>
            <div style={{ fontSize:13,color:T.muted,fontFamily:FB }}>{showSaved?"Tap ♡ on any card":"Try a different filter or date"}</div>
          </div>
        ):(
          <>
            {showAll?(
              <>
                {events.map(item=><EventCard key={item.id} item={item} saved={saved.has(item.id)} onSave={toggle} onOpen={onOpen} T={T}/>)}
                {recs.length>0&&(
                  <>
                    <div style={{ display:"flex",alignItems:"center",gap:10,margin:"8px 0 14px",fontFamily:FB }}>
                      <div style={{ flex:1,height:2,background:T.gold }}/>
                      <span style={{ fontSize:12,fontWeight:700,color:T.goldDim,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap" }}>✦ More recommendations for you in the area</span>
                      <div style={{ flex:1,height:2,background:T.gold }}/>
                    </div>
                    {recs.map(item=><EventCard key={item.id} item={item} saved={saved.has(item.id)} onSave={toggle} onOpen={onOpen} T={T}/>)}
                  </>
                )}
              </>
            ):filtered.map(item=><EventCard key={item.id} item={item} saved={saved.has(item.id)} onSave={toggle} onOpen={onOpen} T={T}/>)}
          </>
        )}
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────
export default function HearbyApp() {
  const dark = useDark();
  const T = dark ? DARK : LIGHT;

  const [screen, setScreen] = useState("location");
  const [area, setArea] = useState("");
  const [saved, setSaved] = useState(new Set());
  const [activeTab, setActiveTab] = useState("feed");
  const [detailItem, setDetailItem] = useState(null);
  const [emailCaptured, setEmailCaptured] = useState(false); // never ask again once submitted

  // First-launch flow: location → (email if not yet captured) → feed
  const gotoFeed = a => { setArea(a); setScreen("feed"); setActiveTab("feed"); };
  const gotoEmail = a => {
    setArea(a);
    if (emailCaptured) { gotoFeed(a); } // skip email screen entirely
    else { setScreen("email"); }
  };

  // Change area from within the app — opens map with area search, no email re-prompt
  const changeArea = () => {
    setActiveTab("map");
    setScreen("map");
  };

  const openDetail = item => { setDetailItem(item); setScreen("detail"); };
  const closeDetail = () => { setScreen(activeTab); };
  const switchTab = tab => { setActiveTab(tab); setScreen(tab); };

  const isFeedGroup = ["feed","map","search","profile","detail"].includes(screen);

  return (
    <div style={{ display:"flex",justifyContent:"center",alignItems:"flex-start",minHeight:"100vh",background:dark?"#060608":"#E8E8EE",padding:"24px 0",fontFamily:FB }}>
      <div style={{ width:390,minHeight:760,background:T.bg,borderRadius:48,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:dark?`0 40px 100px rgba(0,0,0,0.75),0 0 0 1px #333,0 0 0 9px #1A1A1A,0 0 0 11px #222`:`0 20px 60px rgba(0,0,0,0.18),0 0 0 1px #CCC,0 0 0 9px #E0E0E8,0 0 0 11px #D0D0D8`,position:"relative" }}>
        {/* Status bar */}
        <div style={{ background:T.bg,padding:"14px 28px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:isFeedGroup?`2px solid ${T.border}`:"none",flexShrink:0 }}>
          <span style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:FB }}>9:41</span>
          {isFeedGroup?(
            <span style={{ fontSize:18,fontWeight:800,color:T.text,fontFamily:FD,letterSpacing:"-0.02em" }}>hear<span style={{ color:T.gold }}>by</span></span>
          ):(
            <div style={{ width:110,height:22,background:dark?"#111":"#E0E0E8",borderRadius:11 }}/>
          )}
          <span style={{ fontSize:11,color:T.muted }}>●●●</span>
        </div>

        {/* Brand mark — onboarding screens */}
        {!isFeedGroup&&(
          <div style={{ padding:"12px 24px 0",display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:10,background:T.goldLight,border:`2px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:`3px 3px 0 ${T.goldDim}` }}>📍</div>
            <span style={{ fontSize:22,fontWeight:800,color:T.text,fontFamily:FD,letterSpacing:"-0.03em" }}>hear<span style={{ color:T.gold }}>by</span></span>
          </div>
        )}

        {/* Screens */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {screen==="location"&&<LocationScreen onAllow={()=>gotoEmail("Brixton, SW9")} onManual={()=>setScreen("manual")} T={T}/>}
          {screen==="manual"&&<ManualScreen onSubmit={v=>gotoEmail(v)} T={T}/>}
          {screen==="email"&&<EmailScreen onSubmit={e=>{ if(e) setEmailCaptured(true); gotoFeed(area); }} T={T}/>}
          {screen==="feed"&&<FeedScreen area={area} onChangeArea={changeArea} saved={saved} setSaved={setSaved} onOpen={openDetail} T={T}/>}
          {screen==="map"&&<MapScreen saved={saved} onSave={id=>setSaved(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} onOpen={openDetail} area={area} onAreaChange={a=>{setArea(a);setScreen("feed");setActiveTab("feed");}} T={T}/>}
          {screen==="search"&&<SearchScreen saved={saved} onSave={id=>setSaved(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} onOpen={openDetail} T={T}/>}
          {screen==="profile"&&<ProfileScreen saved={saved} onOpen={openDetail} onChangeArea={changeArea} area={area} T={T}/>}
          {screen==="detail"&&detailItem&&<EventDetailScreen item={detailItem} saved={saved.has(detailItem.id)} onSave={id=>setSaved(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} onBack={closeDetail} T={T}/>}
        </div>

        {/* Bottom nav */}
        {isFeedGroup&&screen!=="detail"&&(
          <div style={{ background:T.bg,borderTop:`2px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 22px",flexShrink:0 }}>
            {[{id:"feed",icon:"⊞",label:"Feed"},{id:"map",icon:"⊙",label:"Map"},{id:"search",icon:"⌕",label:"Search"},{id:"profile",icon:"◉",label:"Profile"}].map(t=>{
              const on=activeTab===t.id;
              return (
                <button key={t.id} onClick={()=>switchTab(t.id)} style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"0 14px" }}>
                  <span style={{ fontSize:20,color:on?T.gold:T.muted }}>{t.icon}</span>
                  <span style={{ fontSize:10,fontWeight:on?700:500,color:on?T.goldDim:T.muted,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:FB }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onboarding screens (unchanged) ────────────────────────────
function LocationScreen({onAllow,onManual,T}) {
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"36px 28px",textAlign:"center",background:T.bg }}>
      <div style={{ width:88,height:88,borderRadius:"50%",background:T.goldLight,border:`2px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,marginBottom:32,boxShadow:`4px 4px 0 ${T.goldDim}` }}>📍</div>
      <h2 style={{ fontSize:30,fontWeight:800,color:T.text,margin:"0 0 12px",fontFamily:FD,lineHeight:1.15,letterSpacing:"-0.02em" }}>Hear <span style={{ color:T.gold,textDecoration:`underline 2px solid ${T.gold}`,textUnderlineOffset:4 }}>what's nearby</span></h2>
      <p style={{ fontSize:14,color:T.textSub,lineHeight:1.65,margin:"0 0 40px",maxWidth:270,fontFamily:FB }}>Local events, news, and recommendations from across the web — all in one feed.</p>
      <div style={{ width:"100%",maxWidth:300,display:"flex",flexDirection:"column",gap:10 }}>
        <GoldButton onClick={onAllow} T={T}>Use my location</GoldButton>
        <button onClick={onManual} style={{ width:"100%",background:"transparent",color:T.textSub,fontSize:14,fontWeight:500,padding:"13px 24px",borderRadius:14,border:`2px solid ${T.borderSub}`,cursor:"pointer",fontFamily:FB }}>Enter area manually</button>
      </div>
      <p style={{ fontSize:11,color:T.mutedL,marginTop:28,maxWidth:240,lineHeight:1.6,fontFamily:FB }}>Your location is never stored or shared with third parties.</p>
    </div>
  );
}

function ManualScreen({onSubmit,T}) {
  const [val,setVal] = useState("");
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",padding:"40px 24px 24px",background:T.bg }}>
      <h2 style={{ fontSize:24,fontWeight:800,color:T.text,margin:"0 0 8px",fontFamily:FD }}>Your area</h2>
      <p style={{ fontSize:14,color:T.muted,margin:"0 0 28px",fontFamily:FB }}>City, postcode, neighbourhood — anything works.</p>
      <div style={{ position:"relative",marginBottom:14 }}>
        <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16 }}>🔍</span>
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. Brixton, SW9, East Nashville…" style={{ width:"100%",boxSizing:"border-box",background:T.bgCardHi,color:T.text,border:`2px solid ${val?T.text:T.borderSub}`,borderRadius:12,fontSize:15,padding:"14px 16px 14px 44px",outline:"none",fontFamily:FB,transition:"border-color 0.2s" }}/>
      </div>
      <GoldButton onClick={()=>val.trim()&&onSubmit(val.trim())} disabled={!val.trim()} T={T}>Show me what's on →</GoldButton>
    </div>
  );
}

function EmailScreen({onSubmit,T}) {
  const [email,setEmail] = useState("");
  const [error,setError] = useState("");
  const [done,setDone] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const submit = () => { if(!valid){setError("Enter a valid email address");return;} setError("");setDone(true);setTimeout(()=>onSubmit(email),900); };
  if(done) return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.bg,gap:14 }}>
      <div style={{ width:64,height:64,borderRadius:"50%",background:T.green+"18",border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:T.green,boxShadow:`3px 3px 0 ${T.green}50` }}>✓</div>
      <p style={{ fontSize:16,fontWeight:700,color:T.text,margin:0,fontFamily:FD }}>You're in!</p>
      <p style={{ fontSize:13,color:T.muted,margin:0,fontFamily:FB }}>Loading your feed…</p>
    </div>
  );
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"36px 28px",textAlign:"center",background:T.bg }}>
      <div style={{ width:72,height:72,borderRadius:"50%",background:T.goldLight,border:`2px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,marginBottom:24,boxShadow:`4px 4px 0 ${T.goldDim}` }}>✉️</div>
      <h2 style={{ fontSize:24,fontWeight:800,color:T.text,margin:"0 0 10px",fontFamily:FD,lineHeight:1.2 }}>Stay in the loop</h2>
      <p style={{ fontSize:14,color:T.textSub,lineHeight:1.65,margin:"0 0 28px",maxWidth:270,fontFamily:FB }}>Get your weekly local digest — the best events and spots in your area, curated for you.</p>
      <div style={{ width:"100%",maxWidth:300,marginBottom:10 }}>
        <div style={{ position:"relative",marginBottom:6 }}>
          <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15 }}>✉️</span>
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="your@email.com" style={{ width:"100%",boxSizing:"border-box",background:T.bgCardHi,color:T.text,border:`2px solid ${error?T.red:email?T.text:T.borderSub}`,borderRadius:12,fontSize:15,padding:"14px 16px 14px 44px",outline:"none",fontFamily:FB,transition:"border-color 0.2s" }}/>
        </div>
        {error&&<p style={{ fontSize:12,color:T.red,margin:"0 0 8px",textAlign:"left",fontFamily:FB }}>{error}</p>}
      </div>
      <div style={{ width:"100%",maxWidth:300,display:"flex",flexDirection:"column",gap:10 }}>
        <GoldButton onClick={submit} disabled={!valid} T={T}>Continue →</GoldButton>
        <button onClick={()=>onSubmit(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.mutedL,fontFamily:FB,textDecoration:"underline",padding:"4px" }}>Skip for now</button>
      </div>
      <p style={{ fontSize:11,color:T.mutedL,marginTop:24,maxWidth:260,lineHeight:1.6,fontFamily:FB }}>No spam. Unsubscribe any time. We never sell your data.</p>
    </div>
  );
}
