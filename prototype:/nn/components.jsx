/* Nearby & Now — shared UI components. Brand-locked styling.
   All components take a `p` palette object from window.PaletteFor(mode). */

const Pin = ({size=44, p, dotted=false}) => (
  <svg width={size} height={size*1.15} viewBox="0 0 100 115" fill="none" style={{display:'block'}}>
    <path d="M50 14 C32 14 18 28 18 46 C18 70 50 104 50 104 C50 104 82 70 82 46 C82 28 68 14 50 14 Z" fill={p.ink}/>
    <circle cx="50" cy="44" r="14" fill={p.goldDeep}/>
    <circle cx="50" cy="44" r="5" fill={p.ink}/>
  </svg>
);

const Wordmark = ({size=20, p}) => (
  <div style={{fontFamily:'Playfair Display, Georgia, serif', fontWeight:800, fontSize:size,
       letterSpacing:'-0.015em', color:p.ink, lineHeight:1, whiteSpace:'nowrap'}}>
    Nearby <span style={{fontStyle:'italic', fontWeight:500, color:p.gold}}>&amp;</span>{' '}
    <span style={{color:p.gold}}>Now</span>
  </div>
);

const BrandBar = ({p, subtitle, right}) => (
  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px 14px'}}>
    <div style={{display:'flex', alignItems:'center', gap:9}}>
      <Pin size={24} p={p}/>
      <div>
        <Wordmark p={p} size={19}/>
        {subtitle && <div style={{font:'500 9.5px/1 Inter', letterSpacing:'.20em',
          textTransform:'uppercase', color:p.mute, marginTop:5}}>{subtitle}</div>}
      </div>
    </div>
    {right}
  </div>
);

const StatusBar = ({p, tone}) => {
  const ic = tone || p.ink;
  return (
    <div style={{height:44, display:'flex', alignItems:'center', justifyContent:'space-between',
         padding:'0 28px', font:'600 14.5px Inter', color: ic}}>
      <span>9:41</span>
      <span style={{display:'flex',gap:6,alignItems:'center'}}>
        <svg width="18" height="11" viewBox="0 0 18 11"><path d="M1 10h2V7H1zM5 10h2V5H5zM9 10h2V3H9zM13 10h2V0h-2z" fill="currentColor"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 2.2c1.9 0 3.6.7 4.9 2l1.2-1.2A9 9 0 0 0 .9 3l1.2 1.2A7 7 0 0 1 8 2.2zm0 3.4c1 0 2 .4 2.7 1.1l1.2-1.2A6 6 0 0 0 3 5.5l1.2 1.2A4 4 0 0 1 8 5.6zM8 9a1.7 1.7 0 1 0 0 3.4A1.7 1.7 0 0 0 8 9z" fill="currentColor"/></svg>
        <svg width="27" height="12" viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" fill="none"/><rect x="2" y="2" width="18" height="8" rx="1.2" fill="currentColor"/><rect x="23.5" y="3.8" width="2.5" height="4.4" rx="1" fill="currentColor"/></svg>
      </span>
    </div>
  );
};

/* Filter chip used in the filter strip */
const FilterChip = ({chip, p, onClick, isActive}) => {
  const active = isActive ?? chip.active;
  const primary = chip.primary;
  const styleBg = primary && active ? p.ink :
                  primary ? p.surface :
                  active && chip.bordered ? p.surface : p.surface;
  const styleColor = primary && active ? p.gold :
                     active && chip.bordered ? p.goldDeep : p.ink;
  const styleBorder = primary && active ? p.ink :
                      active && chip.bordered ? p.goldDeep : p.border;
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
      background:styleBg, color:styleColor, border:`1.5px solid ${styleBorder}`,
      padding:'9px 14px', borderRadius:999, fontSize:13.5, fontWeight: primary && active ? 700 : 500,
      fontFamily:'Inter', cursor:'pointer', height:36,
    }}>
      <span style={{fontSize:14, filter: p.name==='dark' ? 'saturate(.95) brightness(1.05)' : 'none'}}>
        {chip.emoji}
      </span>
      {chip.label}
      {chip.dropdown && <span style={{fontSize:10, opacity:.6, marginLeft:-2}}>▾</span>}
    </button>
  );
};

const CategoryChip = ({cat, p, selected, onClick}) => (
  <button onClick={onClick} style={{
    display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
    background: selected ? p.ink : p.surface,
    color: selected ? p.gold : p.ink,
    border:`1.5px solid ${selected ? p.ink : p.border}`,
    padding:'9px 14px', borderRadius:999, fontSize:13.5, fontWeight:500,
    fontFamily:'Inter', cursor:'pointer', height:36,
  }}>
    <span style={{fontSize:14}}>{cat.emoji}</span>{cat.label}
  </button>
);

/* The bottom nav — sits absolute, fits the phone shell */
const BottomNav = ({p, active, onChange}) => {
  const items = [
    {id:'feed',   label:'Feed',    icon:'grid'},
    {id:'map',    label:'Map',     icon:'pin'},
    {id:'saved',  label:'Saved',   icon:'heart'},
    {id:'profile',label:'Profile', icon:'circle'},
  ];
  return (
    <div style={{position:'absolute', bottom:0, left:0, right:0, height:86,
        borderTop:`1px solid ${p.border}`, background: p.bg,
        display:'flex', alignItems:'flex-start', justifyContent:'space-around',
        paddingTop:14, fontFamily:'Inter'}}>
      {items.map(it=>{
        const on = it.id===active;
        const c = on ? p.goldDeep : p.mute;
        return (
          <button key={it.id} onClick={()=>onChange(it.id)} style={{
            background:'none', border:'none', cursor:'pointer', color:c,
            display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:0,
          }}>
            <NavIcon kind={it.icon} active={on} p={p}/>
            <div style={{fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', fontWeight:on?600:500}}>{it.label}</div>
          </button>
        );
      })}
    </div>
  );
};

const NavIcon = ({kind, active, p}) => {
  const c = active ? p.goldDeep : p.mute;
  const s = 22;
  if (kind==='grid') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <rect x="12" y="2" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <rect x="2" y="12" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <rect x="12" y="12" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.6"/>
    </svg>
  );
  if (kind==='pin') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke={c} strokeWidth="1.6"/>
      <circle cx="11" cy="11" r="2.4" fill={c}/>
    </svg>
  );
  if (kind==='heart') return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill={active?c:'none'}>
      <path d="M11 19s-7-4.4-7-9.6C4 6.4 6 4.5 8.4 4.5c1.4 0 2.6.8 2.6 2.2 0-1.4 1.2-2.2 2.6-2.2 2.3 0 4.4 1.9 4.4 4.9 0 5.2-7 9.6-7 9.6z"
        stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke={c} strokeWidth="1.6"/>
      <circle cx="11" cy="11" r={active?4:0} fill={c}/>
    </svg>
  );
};

/* Big shaded map for the home screen / map screen backgrounds */
const MapBackground = ({p, mode, opacity=1, includeWater=true}) => (
  <svg viewBox="0 0 390 800" preserveAspectRatio="xMidYMid slice"
    style={{position:'absolute', inset:0, width:'100%', height:'100%', opacity}}>
    <defs>
      <linearGradient id={`mapfade-${mode}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={p.bg} stopOpacity="0"/>
        <stop offset="50%" stopColor={p.bg} stopOpacity=".35"/>
        <stop offset="100%" stopColor={p.bg} stopOpacity="1"/>
      </linearGradient>
      <pattern id={`mapdots-${mode}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill={p.mapDots}/>
      </pattern>
    </defs>
    <rect width="390" height="800" fill={`url(#mapdots-${mode})`} opacity=".55"/>
    {/* blocks */}
    <g fill={p.mapBlocks} opacity={mode==='dark'?.9:.55}>
      <rect x="130" y="240" width="120" height="60" rx="3"/>
      <rect x="20"  y="290" width="60"  height="100" rx="3"/>
      <rect x="135" y="330" width="70"  height="90"  rx="3"/>
      <rect x="230" y="350" width="60"  height="120" rx="3"/>
      <rect x="300" y="180" width="80"  height="60"  rx="3"/>
      <rect x="40" y="610" width="90" height="70" rx="3"/>
      <rect x="260" y="630" width="100" height="80" rx="3"/>
    </g>
    {/* river */}
    {includeWater && <path d="M -20 540 Q 100 480 220 560 T 410 540"
      stroke={p.mapWater} strokeWidth="32" fill="none" opacity={mode==='dark'?.5:.55}/>}
    {/* streets thick */}
    <g stroke={p.mapStreets} strokeWidth="14" fill="none" opacity={mode==='dark'?.85:.55}>
      <path d="M-20 180 L 240 220 L 420 180"/>
      <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
      <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
      <path d="M -20 420 Q 200 400 420 460"/>
      <path d="M -20 660 L 240 700 L 420 670"/>
    </g>
    {/* street lines */}
    <g stroke={p.mapStreetsLine} strokeWidth="1.5" fill="none" opacity=".8">
      <path d="M-20 180 L 240 220 L 420 180"/>
      <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
      <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
      <path d="M -20 420 Q 200 400 420 460"/>
      <path d="M -20 660 L 240 700 L 420 670"/>
    </g>
    <rect width="390" height="800" fill={`url(#mapfade-${mode})`}/>
  </svg>
);

/* Round circular icon button (heart/bell/search) */
const IconButton = ({children, p, onClick, size=42, active=false}) => (
  <button onClick={onClick} style={{
    width:size, height:size, borderRadius:'50%',
    background: active ? p.gold : p.surface,
    border: `1.5px solid ${active ? p.gold : p.border}`,
    display:'grid', placeItems:'center', cursor:'pointer', padding:0,
    color: active ? '#fff' : p.ink,
  }}>{children}</button>
);

const Heart = ({size=18,c='currentColor', filled=false}) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill={filled?c:'none'}>
    <path d="M11 19s-7-4.4-7-9.6C4 6.4 6 4.5 8.4 4.5c1.4 0 2.6.8 2.6 2.2 0-1.4 1.2-2.2 2.6-2.2 2.3 0 4.4 1.9 4.4 4.9 0 5.2-7 9.6-7 9.6z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
);

const Bell = ({size=18,c='currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <path d="M5 16h12l-1.5-1.8V10a4.5 4.5 0 0 0-9 0v4.2L5 16zM9 18.5a2 2 0 0 0 4 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Search = ({size=18,c='currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <circle cx="10" cy="10" r="6" stroke={c} strokeWidth="1.8"/>
    <path d="M14.5 14.5 L 19 19" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

/* Primary CTA */
const PrimaryBtn = ({children, p, onClick}) => (
  <button onClick={onClick} style={{
    width:'100%', height:56, borderRadius:14, border:'none',
    background: p.btnBg, color: p.btnFg, fontWeight:700, fontSize:15, fontFamily:'Inter',
    display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer',
    boxShadow: p.name==='light' ? '0 8px 24px -10px rgba(0,0,0,.35)' : '0 8px 24px -10px rgba(206,156,0,.5)',
  }}>
    <span style={{width:8, height:8, borderRadius:'50%',
      background: p.name==='light' ? p.goldSoft : '#1A1505',
      boxShadow: p.name==='light' ? '0 0 0 4px rgba(240,201,106,.25)' : '0 0 0 4px rgba(26,21,5,.18)'}}/>
    {children}
  </button>
);

const SecondaryBtn = ({children, p, onClick, dashed=false}) => (
  <button onClick={onClick} style={{
    width:'100%', height:50, borderRadius:14,
    background:'transparent', color:p.ink, border:`1.5px ${dashed?'dashed':'solid'} ${p.border}`,
    fontWeight:500, fontSize:14, fontFamily:'Inter', cursor:'pointer',
  }}>{children}</button>
);

/* Feed card with red top accent + colored category eyebrow */
const FeedCard = ({item, p, onSave, onAddToCalendar, saved=false, useEmoji=false}) => {
  const toneColor = p[item.tone] || p.red;
  const iconId = item.cat==='COMMUNITY' ? 'megaphone' : item.cat==='MUSIC' ? 'music' : item.cat==='FOOD & DRINK' ? 'food' : 'events';
  return (
    <div style={{
      background: p.cardBg, border: `1px solid ${p.cardBorder}`,
      borderRadius: 18, overflow:'hidden', position:'relative',
      marginBottom: 14, fontFamily:'Inter', color:p.ink,
    }}>
      <div style={{height:3, background:toneColor, opacity:.95}}/>
      <div style={{padding:'14px 16px 16px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div style={{display:'flex', alignItems:'center', gap:7, fontWeight:700, fontSize:11,
              letterSpacing:'.16em', color: toneColor}}>
            <CategoryIcon id={iconId} size={15} c={toneColor} sw={1.8} useEmoji={useEmoji}/>{item.cat}
          </div>
          <button onClick={onSave} style={{background:'none', border:'none', cursor:'pointer', padding:4, color: saved?toneColor:p.mute}}>
            <Heart size={18} filled={saved}/>
          </button>
        </div>
        <div style={{font:'600 17.5px/1.32 Inter', letterSpacing:'-0.005em', color:p.ink}}>{item.title}</div>
        {item.body && (
          <div style={{font: `400 13px/1.5 Inter`, color: p.soft, marginTop:8,
              overflow:'hidden', display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical'}}>
            {item.body}
          </div>
        )}
        <div style={{display:'flex', alignItems:'center', gap:14, marginTop:14, paddingTop:12,
            borderTop:`1px solid ${p.borderSoft}`,
            fontSize:12.5, color:p.soft}}>
          <div style={{display:'flex', alignItems:'center', gap:5}}>
            <ClockIcon size={13} c={p.mute}/><b style={{fontWeight:600,color:p.ink}}>{item.time}</b>
            <span style={{color:p.mute}}>·</span>
            <span>{item.date}</span>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:12.5, color:p.soft}}>
          <PinDot c={toneColor}/>{item.loc}
        </div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11.5, color:p.mute, letterSpacing:'.06em', minWidth:0}}>
            <span style={{padding:'4px 10px', borderRadius:999, border:`1px solid ${p.border}`,
                fontFamily:'JetBrains Mono', textTransform:'uppercase', whiteSpace:'nowrap'}}>{item.source}</span>
            <span style={{whiteSpace:'nowrap'}}>{item.saves} saves</span>
          </div>
          <div style={{display:'flex', gap:6, flexShrink:0}}>
            {onAddToCalendar && (
              <button onClick={onAddToCalendar} aria-label="Add to calendar" style={{
                width:38, height:36, borderRadius:999,
                background:p.surface, border:`1.5px solid ${p.border}`,
                display:'grid', placeItems:'center', cursor:'pointer',
                color:p.ink, padding:0,
              }}>
                <CategoryIcon id="today" size={17} c={p.ink} sw={1.7} useEmoji={useEmoji}/>
              </button>
            )}
            <button style={{
              background:'transparent', border:`1.5px solid ${p.ink}`, color:p.ink,
              padding:'8px 14px', borderRadius:999, fontFamily:'Inter', fontSize:12.5,
              fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
            }}>{item.action || 'View →'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClockIcon = ({size=13, c='currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke={c} strokeWidth="1.2"/>
    <path d="M7 4 V 7 L 9 8.5" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const PinDot = ({c='currentColor'}) => (
  <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
    <path d="M5.5 1 C 3 1 1 3 1 5 C 1 8 5.5 12 5.5 12 C 5.5 12 10 8 10 5 C 10 3 8 1 5.5 1 Z" fill={c}/>
    <circle cx="5.5" cy="5" r="1.7" fill="#fff"/>
  </svg>
);

Object.assign(window, {
  Pin, Wordmark, BrandBar, StatusBar, FilterChip, CategoryChip, BottomNav,
  MapBackground, IconButton, Heart, Bell, Search, PrimaryBtn, SecondaryBtn,
  FeedCard, ClockIcon, PinDot,
});
