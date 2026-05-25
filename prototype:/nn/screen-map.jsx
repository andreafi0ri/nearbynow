/* Map screen — large map with category pin markers, list of items below.
   Uses the new DATE | FILTERS | SOURCES bar. */

const MapMarker = ({pin, p, useEmoji}) => {
  const c = p[pin.tone] || p.ink;
  const size = pin.size==='lg' ? 40 : 32;
  const iconId = pin.tone==='music' ? 'music' : pin.tone==='food' ? 'food' : 'cinema';
  return (
    <g transform={`translate(${pin.x},${pin.y})`}>
      <circle r={size/2+5} fill={c} opacity=".22"/>
      <circle r={size/2} fill={p.ink} stroke={c} strokeWidth="2.5"/>
      {useEmoji ? (
        <text x="0" y="2" fontSize={size*0.5} textAnchor="middle" dominantBaseline="middle">{pin.emoji}</text>
      ) : (
        <g transform={`translate(${-size*0.27},${-size*0.27}) scale(${size*0.022})`}>
          <foreignObject width="24" height="24" x="0" y="0" style={{overflow:'visible'}}>
            <div style={{width:24, height:24, color: c, display:'grid', placeItems:'center'}}>
              <CategoryIcon id={iconId} size={size*0.5} c={c} sw={2}/>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
};

const ScreenMap = ({p, mode, area, useEmoji}) => {
  const D = window.NN_DATA;
  return (
    <div style={{position:'relative', height:'100%', overflowY:'auto', background:p.bg, color:p.ink,
        paddingBottom: 100, fontFamily:'Inter'}}>
      <BrandBar p={p} subtitle="Map view"/>

      {/* Area search bar */}
      <div style={{padding:'2px 22px 14px'}}>
        <div style={{
          display:'flex', alignItems:'center', gap:10, height:46,
          background:p.surface, border:`1.5px solid ${p.border}`, borderRadius:14,
          padding:'0 16px',
        }}>
          <PinDot c={p.red}/>
          <span style={{fontWeight:600, fontSize:14, color:p.ink}}>{area.name}</span>
          <span style={{marginLeft:'auto', color:p.mute, fontSize:13}}>▾</span>
        </div>
      </div>

      <FilterBar p={p} useEmoji={useEmoji}/>

      {/* The big map */}
      <div style={{margin:'0 16px 16px', borderRadius:18, border:`1.5px solid ${p.border}`,
          overflow:'hidden', position:'relative', height:340, background:p.bg2}}>
        <svg viewBox="0 0 390 480" preserveAspectRatio="xMidYMid slice"
          style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
          <rect width="390" height="480" fill={p.bg2}/>
          <g fill={p.mapBlocks}>
            <rect x="-10" y="100" width="80" height="60" rx="4"/>
            <rect x="280" y="60"  width="120" height="80" rx="4"/>
            <rect x="160" y="200" width="80" height="40" rx="4"/>
          </g>
          <path d="M 300 -20 Q 250 120 280 240 T 380 480" stroke={p.mapWater} strokeWidth="34" fill="none" opacity=".9"/>
          <g stroke={p.mapStreets} strokeWidth="10" fill="none" opacity=".75">
            <path d="M-20 90 Q 200 110 410 90"/>
            <path d="M-20 200 L 410 220"/>
            <path d="M-20 340 Q 200 360 410 340"/>
            <path d="M 60 -20 L 80 480"/>
            <path d="M 170 -20 L 200 480"/>
            <path d="M 280 -20 L 310 480"/>
          </g>
          <g stroke={p.mapStreetsLine} strokeWidth="1.2" fill="none" opacity=".7">
            <path d="M-20 90 Q 200 110 410 90"/>
            <path d="M-20 200 L 410 220"/>
            <path d="M-20 340 Q 200 360 410 340"/>
            <path d="M 60 -20 L 80 480"/>
            <path d="M 170 -20 L 200 480"/>
            <path d="M 280 -20 L 310 480"/>
          </g>
          <g fontFamily="Inter" fontSize="9" fill={p.mute} fontWeight="500">
            <text x="20" y="86" transform="rotate(-2 20 86)">11th Ave N</text>
            <text x="20" y="196">Charlotte Ave</text>
            <text x="60" y="40" transform="rotate(80 60 40)">7th Ave N</text>
            <text x="250" y="30">1st Ave N</text>
            <text x="170" y="335">Main St</text>
          </g>
          {D.pinned.map(pin => <MapMarker key={pin.id} pin={pin} p={p} useEmoji={useEmoji}/>)}
        </svg>
        <div style={{position:'absolute', bottom:8, left:10, fontSize:10, color:p.mute,
          background: p.name==='dark' ? 'rgba(14,14,16,.8)' : 'rgba(255,255,255,.8)',
          padding:'3px 7px', borderRadius:4}}>©  mapbox</div>
        <div style={{position:'absolute', bottom:8, right:10, width:24, height:24,
            background: p.surface, borderRadius:'50%', display:'grid', placeItems:'center',
            border:`1px solid ${p.border}`, fontSize:11, fontWeight:700, color:p.ink}}>i</div>
      </div>

      <div style={{padding:'0 16px'}}>
        {D.feed.slice(0,5).map((item)=>{
          const accent = p[item.tone] || p.red;
          const iconId = item.cat==='COMMUNITY' ? 'megaphone' : item.cat==='MUSIC' ? 'music' : 'food';
          return (
            <button key={item.id} style={{
              display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 14px',
              background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:14,
              marginBottom:8, cursor:'pointer', textAlign:'left', color:p.ink, fontFamily:'Inter',
            }}>
              <div style={{
                width:40, height:40, borderRadius:10,
                background: `${accent}1A`,
                display:'grid', placeItems:'center', flexShrink:0,
                border:`1px solid ${accent}33`,
                color: accent,
              }}>
                <CategoryIcon id={iconId} size={20} c={accent} sw={1.7} useEmoji={useEmoji}/>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{font:'600 14px/1.3 Inter', color:p.ink,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.title}</div>
                <div style={{font:'400 11.5px Inter', color:p.mute, marginTop:3}}>{item.time}</div>
              </div>
              <span style={{color:p.mute, fontSize:18}}>→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

window.ScreenMap = ScreenMap;
