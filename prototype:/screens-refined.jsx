/* Nearby & Now — refined explorations of C (chips) + D (map) + a C+D hybrid.
   Each screen ships in both light and dark, so the user can compare on real terms.
*/

/* ---------- shared bits ---------- */

const PaletteFor = (mode) => mode === 'dark' ? {
  bg:'#0E0E10', bg2:'#161617', surface:'rgba(255,255,255,0.04)', border:'#26241F',
  ink:'#F4F4F6', soft:'#BFBCB1', mute:'#7E7B72',
  gold:'#E2C997', goldDeep:'#CE9C00', goldSoft:'#F0C96A',
  btnBg:'#CE9C00', btnFg:'#1A1505',
  mapStreets:'#1F1E1C', mapStreetsLine:'#2D2A24', mapBlocks:'#1A1815',
  mapDots:'#1C1A16', haloOut:'rgba(206,156,0,0.16)', haloIn:'rgba(206,156,0,0.30)',
} : {
  bg:'#FAF7F3', bg2:'#F2EDE3', surface:'#FFFFFF', border:'#E9E2D2',
  ink:'#111111', soft:'#3a3633', mute:'#8a857a',
  gold:'#B8920A', goldDeep:'#B8920A', goldSoft:'#E2C997',
  btnBg:'#111111', btnFg:'#FAF7F3',
  mapStreets:'#D7CFBE', mapStreetsLine:'#C6BDA8', mapBlocks:'#E7DFC9',
  mapDots:'#D7CFBE', haloOut:'rgba(184,146,10,0.15)', haloIn:'rgba(184,146,10,0.28)',
};

const Pin = ({size=44, p, rings=false}) => (
  <svg width={size} height={size*1.15} viewBox="0 0 100 115" fill="none" style={{display:'block'}}>
    {rings && <>
      <circle cx="50" cy="56" r="46" stroke={p.goldDeep} strokeWidth="1.2" opacity=".28" />
      <circle cx="50" cy="56" r="34" stroke={p.goldDeep} strokeWidth="1" opacity=".5" />
    </>}
    <path d="M50 14 C32 14 18 28 18 46 C18 70 50 104 50 104 C50 104 82 70 82 46 C82 28 68 14 50 14 Z" fill={p.ink}/>
    <circle cx="50" cy="44" r="14" fill={p.goldDeep}/>
    <circle cx="50" cy="44" r="5" fill={p.ink}/>
  </svg>
);

const SmallStatus = ({p}) => (
  <div style={{position:'absolute', top:14, left:0, right:0, display:'flex', justifyContent:'space-between',
       padding:'0 28px', font:'600 13px Inter', color:p.ink, opacity:.85}}>
    <span>9:41</span>
    <span style={{display:'flex',gap:6,alignItems:'center'}}>
      <svg width="18" height="10" viewBox="0 0 18 10"><path d="M1 9h2V6H1zM5 9h2V4H5zM9 9h2V2H9zM13 9h2V0h-2z" fill="currentColor"/></svg>
      <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 2c1.6 0 3.1.6 4.2 1.7l1-1A8 8 0 0 0 1.8 2.7l1 1A6 6 0 0 1 7 2zm0 3c.8 0 1.6.3 2.1.9l1-1A5 5 0 0 0 4 5l.9.9A3 3 0 0 1 7 5zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="currentColor"/></svg>
      <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="20" height="10" rx="2" stroke="currentColor" fill="none"/><rect x="2" y="2" width="16" height="7" rx="1" fill="currentColor"/><rect x="21" y="3.5" width="2" height="4" rx="1" fill="currentColor"/></svg>
    </span>
  </div>
);

const CATS = [
  ['📅','Events'],['🎵','Music'],['🍽','Food & Drink'],
  ['📰','News'],['🎨','Arts'],['🌳','Outdoors'],
  ['🎭','Culture'],['⚽','Sport'],['🎬','Cinema'],
];

/* category chip — pulled from the app's filter style */
const Chip = ({emoji, label, p, accent=false}) => (
  <div style={{
    display:'inline-flex', alignItems:'center', gap:6,
    background: accent ? (p===PaletteFor('dark')?'#1C1A16':'#FFF') : p.surface,
    border:`1px solid ${accent ? p.goldDeep : p.border}`,
    padding:'7px 12px', borderRadius:999, fontSize:12.5,
    color:p.ink, whiteSpace:'nowrap'
  }}>
    <span style={{fontSize:13, filter: p===PaletteFor('dark') ? 'saturate(.85)' : 'none'}}>{emoji}</span>
    {label}
  </div>
);

/* Map SVG background — used by D and hybrid */
const MapBg = ({p, mode}) => (
  <svg viewBox="0 0 390 800" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
    <defs>
      <linearGradient id={`fade-${mode}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={p.bg} stopOpacity="0"/>
        <stop offset="45%" stopColor={p.bg} stopOpacity=".35"/>
        <stop offset="100%" stopColor={p.bg} stopOpacity="1"/>
      </linearGradient>
      <pattern id={`dots-${mode}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill={p.mapDots}/>
      </pattern>
    </defs>
    <rect width="390" height="800" fill={`url(#dots-${mode})`} opacity=".55"/>

    {/* parks / blocks first so streets sit on top */}
    <g fill={p.mapBlocks} opacity={mode==='dark'?.9:.55}>
      <rect x="130" y="240" width="120" height="60" rx="3"/>
      <rect x="20"  y="290" width="60"  height="100" rx="3"/>
      <rect x="135" y="330" width="70"  height="90"  rx="3"/>
      <rect x="230" y="350" width="60"  height="120" rx="3"/>
      <rect x="300" y="180" width="80"  height="60"  rx="3"/>
    </g>
    {/* river */}
    <path d="M -20 540 Q 100 480 220 560 T 410 540" stroke={p.mapBlocks} strokeWidth="34" fill="none" opacity={mode==='dark'?.6:.45}/>
    {/* streets thick base */}
    <g stroke={p.mapStreets} strokeWidth="14" fill="none" opacity={mode==='dark'?.85:.55}>
      <path d="M-20 180 L 240 220 L 420 180"/>
      <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
      <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
      <path d="M -20 420 Q 200 400 420 460"/>
      <path d="M -20 660 L 240 700 L 420 670"/>
    </g>
    {/* streets thin line */}
    <g stroke={p.mapStreetsLine} strokeWidth="1.5" fill="none" opacity=".8">
      <path d="M-20 180 L 240 220 L 420 180"/>
      <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
      <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
      <path d="M -20 420 Q 200 400 420 460"/>
      <path d="M -20 660 L 240 700 L 420 670"/>
    </g>

    <rect width="390" height="800" fill={`url(#fade-${mode})`}/>
  </svg>
);

const PrimaryButton = ({children, p, leading=true}) => (
  <button style={{
    width:'100%', height:56, borderRadius:14, border:'none',
    background:p.btnBg, color:p.btnFg, fontWeight:700, fontSize:15, fontFamily:'Inter',
    display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer',
    boxShadow: p.btnBg === '#111111' ? '0 8px 24px -10px rgba(0,0,0,.4)' : '0 8px 24px -10px rgba(206,156,0,.5)',
  }}>
    {leading && <span style={{width:8,height:8,borderRadius:'50%', background: p.btnBg==='#111111' ? p.goldSoft : '#1A1505',
      boxShadow: p.btnBg==='#111111' ? '0 0 0 4px rgba(240,201,106,.25)' : '0 0 0 4px rgba(26,21,5,.18)'}}/>}
    {children}
  </button>
);

const SecondaryButton = ({children, p}) => (
  <button style={{width:'100%', height:50, borderRadius:14,
    background:'transparent', color:p.ink, border:`1px solid ${p.border}`,
    fontWeight:500, fontSize:14, fontFamily:'Inter', cursor:'pointer'}}>
    {children}
  </button>
);

const Wordmark = ({size=48, p, oneLine=true}) => (
  <div style={{fontFamily:'Playfair Display', fontWeight:800, letterSpacing:'-0.015em', lineHeight:1, color:p.ink, fontSize:size}}>
    {oneLine ? (
      <>Nearby <span style={{fontStyle:'italic',fontWeight:500,color:p.gold}}>&amp;</span> <span style={{color:p.gold}}>Now</span></>
    ) : (
      <>Nearby<br/><span style={{fontStyle:'italic',fontWeight:500,color:p.gold}}>&amp;</span> <span style={{color:p.gold}}>Now.</span></>
    )}
  </div>
);

/* ──────────────────────── Refined C ──────────────────────── */
const RefinedC = ({mode='dark'}) => {
  const p = PaletteFor(mode);
  return (
    <div style={{width:390,height:800,position:'relative',borderRadius:38,overflow:'hidden',background:p.bg,
        boxShadow:'0 1px 0 rgba(0,0,0,.06), 0 20px 50px -20px rgba(0,0,0,.25)', fontFamily:'Inter', color:p.ink}}>
      <SmallStatus p={p}/>
      <div style={{padding:'72px 28px 28px', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
        <div style={{position:'relative', width:138, height:138, display:'grid', placeItems:'center', marginTop:4}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(closest-side, ${p.haloIn}, ${p.haloOut} 60%, transparent 75%)`}}/>
          <div style={{position:'absolute', inset:18, borderRadius:'50%',
            border:`1px dashed ${p.goldDeep}`, opacity:.45}}/>
          <Pin size={82} p={p}/>
        </div>

        <div style={{marginTop:18}}><Wordmark size={46} p={p} oneLine={true}/></div>
        <div style={{font:'500 11px/1 Inter', letterSpacing:'.18em', textTransform:'uppercase',
            color:p.goldDeep, marginTop:14}}>What's happening near you</div>

        <p style={{font:'400 15px/1.55 Inter', color:p.soft, maxWidth:300, marginTop:22}}>
          One quiet feed for everything happening within walking, driving, or scrolling distance.
        </p>

        {/* chip cluster */}
        <div style={{display:'flex', flexWrap:'wrap', gap:7, justifyContent:'center',
            marginTop:22, maxWidth:330}}>
          {CATS.map(([e,l], i)=><Chip key={l} emoji={e} label={l} p={p} accent={i===0 || i===2}/>)}
        </div>

        <div style={{marginTop:'auto', width:'100%'}}>
          <PrimaryButton p={p}>Use my location</PrimaryButton>
          <div style={{height:10}}/>
          <SecondaryButton p={p}>Enter area manually</SecondaryButton>
          <p style={{font:`400 11.5px/1.5 Inter`, color:p.mute, marginTop:12}}>
            Location stays on your device. Always.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────── Refined D ──────────────────────── */
const RefinedD = ({mode='light'}) => {
  const p = PaletteFor(mode);
  return (
    <div style={{width:390,height:800,position:'relative',borderRadius:38,overflow:'hidden',background:p.bg,
        boxShadow:'0 1px 0 rgba(0,0,0,.06), 0 20px 50px -20px rgba(0,0,0,.25)', fontFamily:'Inter', color:p.ink}}>
      <MapBg p={p} mode={mode}/>
      <SmallStatus p={p}/>
      <div style={{position:'relative', padding:'70px 28px 28px', height:'100%', display:'flex', flexDirection:'column'}}>
        <div style={{font:'500 11px/1 Inter', letterSpacing:'.18em', textTransform:'uppercase', color:p.goldDeep}}>
          ·  Locating you
        </div>
        <div style={{marginTop:12}}><Wordmark size={54} p={p} oneLine={false}/></div>

        {/* central pin floating with halo + crosshair */}
        <div style={{position:'absolute', right:36, top:218, width:140, height:140}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(closest-side, ${p.haloIn}, transparent 70%)`}}/>
          <div style={{position:'absolute', inset:16, borderRadius:'50%',
            border:`1px dashed ${p.goldDeep}`, opacity:.5, animation:'pulse 3s ease-in-out infinite'}}/>
          <div style={{position:'absolute', inset:34, borderRadius:'50%',
            border:`1px solid ${p.goldDeep}`, opacity:.7}}/>
          {/* crosshair ticks */}
          {[[70,0,70,8],[70,132,70,140],[0,70,8,70],[132,70,140,70]].map(([x1,y1,x2,y2],i)=>(
            <svg key={i} style={{position:'absolute', inset:0}}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.goldDeep} strokeWidth="1.2" opacity=".7"/>
            </svg>
          ))}
          <div style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-58%)'}}>
            <Pin size={50} p={p}/>
          </div>
        </div>

        <p style={{font:'400 15px/1.55 Inter', color:p.soft, marginTop:200, maxWidth:300}}>
          A single feed of local events, news, food, and recommendations — pulled from across the web, centered on wherever you are.
        </p>

        <div style={{marginTop:'auto', width:'100%'}}>
          <PrimaryButton p={p}>Drop me on the map</PrimaryButton>
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:14, margin:'14px 0',
              color:p.mute, fontSize:12.5}}>
            <span style={{height:1, width:32, background:p.border}}/>or<span style={{height:1, width:32, background:p.border}}/>
          </div>
          <SecondaryButton p={p}>Type a city or zip</SecondaryButton>
          <p style={{font:'400 11.5px/1.5 Inter', color:p.mute, marginTop:12, textAlign:'center'}}>
            We never store or share your location.
          </p>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1); opacity:.5} 50%{transform:scale(1.08); opacity:.85} }`}</style>
    </div>
  );
};

/* ──────────────────────── Hybrid: map + chips (the strongest concept) ──────────────────────── */
const Hybrid = ({mode='dark'}) => {
  const p = PaletteFor(mode);
  return (
    <div style={{width:390,height:800,position:'relative',borderRadius:38,overflow:'hidden',background:p.bg,
        boxShadow:'0 1px 0 rgba(0,0,0,.06), 0 20px 50px -20px rgba(0,0,0,.25)', fontFamily:'Inter', color:p.ink}}>
      <MapBg p={p} mode={mode}/>
      <SmallStatus p={p}/>
      <div style={{position:'relative', padding:'70px 28px 28px', height:'100%', display:'flex', flexDirection:'column'}}>
        {/* small wordmark / brand bar */}
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <Pin size={26} p={p}/>
          <div style={{fontFamily:'Playfair Display', fontWeight:800, fontSize:20, color:p.ink, letterSpacing:'-0.015em'}}>
            Nearby <span style={{fontStyle:'italic',fontWeight:500,color:p.gold}}>&amp;</span> <span style={{color:p.gold}}>Now</span>
          </div>
        </div>

        {/* big editorial wordmark moment */}
        <div style={{marginTop:30}}>
          <div style={{fontFamily:'Playfair Display', fontWeight:800, fontSize:46, lineHeight:1.02,
              letterSpacing:'-0.025em', color:p.ink}}>
            What's<br/>
            <span style={{fontStyle:'italic', color:p.gold, fontWeight:500}}>happening</span><br/>
            within reach.
          </div>
        </div>

        {/* pin marker pinned to map */}
        <div style={{position:'absolute', right:34, top:130, width:110, height:110}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(closest-side, ${p.haloIn}, transparent 70%)`}}/>
          <div style={{position:'absolute', inset:14, borderRadius:'50%',
            border:`1px dashed ${p.goldDeep}`, opacity:.5, animation:'pulse 3s ease-in-out infinite'}}/>
          <div style={{position:'absolute', left:'50%', top:'52%', transform:'translate(-50%,-58%)'}}>
            <Pin size={42} p={p}/>
          </div>
        </div>

        {/* chip cluster floating below the headline */}
        <div style={{marginTop:24, display:'flex', flexWrap:'wrap', gap:7, maxWidth:340}}>
          {CATS.slice(0,8).map(([e,l],i)=>(
            <div key={l} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background: mode==='dark' ? 'rgba(20,18,14,.85)' : 'rgba(255,255,255,.9)',
              border:`1px solid ${p.border}`,
              padding:'7px 12px', borderRadius:999, fontSize:12.5,
              color:p.ink, whiteSpace:'nowrap',
              backdropFilter:'blur(8px)'
            }}>
              <span style={{fontSize:13}}>{e}</span>{l}
            </div>
          ))}
        </div>

        <div style={{marginTop:'auto', width:'100%'}}>
          <p style={{font:'400 13.5px/1.5 Inter', color:p.soft, maxWidth:320, marginBottom:16, textAlign:'left'}}>
            Local events, news, food, and recommendations — pulled from across the web into one quiet feed.
          </p>
          <PrimaryButton p={p}>Use my location</PrimaryButton>
          <div style={{height:10}}/>
          <SecondaryButton p={p}>Enter area manually</SecondaryButton>
          <p style={{font:'400 11.5px/1.5 Inter', color:p.mute, marginTop:12, textAlign:'center'}}>
            Location stays on your device.
          </p>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1); opacity:.5} 50%{transform:scale(1.08); opacity:.85} }`}</style>
    </div>
  );
};

Object.assign(window, { RefinedC, RefinedD, Hybrid });
