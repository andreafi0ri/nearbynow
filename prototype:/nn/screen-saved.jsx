/* Saved screen — list of saved items with empty state */

const ScreenSaved = ({p, savedIds, onToggleSave, useEmoji}) => {
  const D = window.NN_DATA;
  const items = D.feed.filter(it => savedIds.includes(it.id));

  return (
    <div style={{position:'relative', height:'100%', overflowY:'auto', background:p.bg, color:p.ink,
        paddingBottom: 100, fontFamily:'Inter'}}>
      <BrandBar p={p}/>

      <div style={{padding:'4px 22px 18px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:12}}>
          <span style={{font:'500 12px/1 Inter', letterSpacing:'.18em', textTransform:'uppercase', color:p.mute}}>Saved</span>
          <span style={{
            background:p.ink, color:p.gold, fontFamily:'Inter', fontSize:12, fontWeight:700,
            padding:'4px 11px', borderRadius:999, minWidth:28, textAlign:'center'
          }}>{items.length}</span>
        </div>
        <IconButton p={p}><Search c={p.ink}/></IconButton>
      </div>

      <div style={{height:1, background:p.border, margin:'0 22px 18px'}}/>

      {items.length === 0 ? (
        <div style={{textAlign:'center', padding:'80px 24px 0'}}>
          <div style={{display:'inline-block', position:'relative', marginBottom:20}}>
            <div style={{width:80, height:80, borderRadius:'50%',
              background:`radial-gradient(closest-side, ${p.haloIn}, transparent 70%)`,
              display:'grid', placeItems:'center'}}>
              <Heart size={28} c={p.goldDeep}/>
            </div>
          </div>
          <div style={{fontFamily:'Playfair Display, Georgia, serif', fontWeight:700,
              fontSize:22, color:p.ink, letterSpacing:'-0.01em', marginBottom:8}}>
            Nothing saved <span style={{fontStyle:'italic', color:p.gold}}>yet.</span>
          </div>
          <div style={{font:'400 14px/1.5 Inter', color:p.soft, maxWidth:280, margin:'0 auto'}}>
            Tap the heart on any feed item to keep it here. Saved items sync across devices.
          </div>
        </div>
      ) : (
        <div style={{padding:'0 16px'}}>
          {items.map(item => (
            <div key={item.id} style={{
              display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px',
              background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:14,
              marginBottom:10,
            }}>
              <div style={{
                width:42, height:42, borderRadius:10,
                background: `${p[item.tone] || p.red}22`,
                display:'grid', placeItems:'center', flexShrink:0,
                border:`1px solid ${p[item.tone] || p.red}44`,
                color: p[item.tone] || p.red,
              }}>
                <CategoryIcon
                  id={item.cat==='COMMUNITY' ? 'megaphone' : item.cat==='MUSIC' ? 'music' : 'food'}
                  size={20} c={p[item.tone] || p.red} sw={1.7} useEmoji={useEmoji}/>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{font:'600 14.5px/1.32 Inter', color:p.ink,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                  {item.title}
                </div>
                <div style={{font:'400 11.5px Inter', color:p.mute, marginTop:4}}>
                  {item.time} · {item.source}
                </div>
              </div>
              <button onClick={()=>onToggleSave(item.id)} style={{
                background:'none', border:'none', cursor:'pointer', padding:4, color:p[item.tone] || p.red
              }}>
                <Heart filled={true} size={20}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

window.ScreenSaved = ScreenSaved;
