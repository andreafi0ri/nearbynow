/* Home / Onboarding — Hybrid C+D visual treatment but with the ORIGINAL copy:
   centered wordmark, "What's happening near you" eyebrow, original body, original CTAs.
   Map background underneath, hero pin with halo, category chips floating in the middle. */

const ScreenHome = ({p, mode, onContinue, onManual, useEmoji}) => {
  return (
    <div style={{position:'relative', height:'100%', overflow:'hidden', background:p.bg, color:p.ink}}>
      <MapBackground p={p} mode={mode} opacity={0.7}/>

      <div style={{position:'relative', height:'100%', display:'flex', flexDirection:'column',
          alignItems:'center', textAlign:'center', padding:'42px 28px 30px'}}>

        {/* Hero pin with gold halo */}
        <div style={{position:'relative', width:140, height:140, display:'grid', placeItems:'center'}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(closest-side, ${p.haloIn}, transparent 70%)`}}/>
          <div style={{position:'absolute', inset:16, borderRadius:'50%',
            border:`1px dashed ${p.goldDeep}`, opacity:.55, animation:'nn-pulse 3.5s ease-in-out infinite'}}/>
          <div style={{position:'absolute', inset:36, borderRadius:'50%',
            border:`1px solid ${p.goldDeep}`, opacity:.75}}/>
          <Pin size={82} p={p}/>
        </div>

        {/* Wordmark */}
        <div style={{marginTop:18, fontFamily:'Playfair Display, Georgia, serif', fontWeight:800,
          fontSize:44, letterSpacing:'-0.02em', color:p.ink, lineHeight:1, whiteSpace:'nowrap'}}>
          Nearby <span style={{fontStyle:'italic', fontWeight:500, color:p.gold}}>&amp;</span>{' '}
          <span style={{color:p.gold}}>Now</span>
        </div>

        {/* Tagline */}
        <div style={{font:'500 11.5px/1 Inter', letterSpacing:'.22em', textTransform:'uppercase',
            color:p.mute, marginTop:14}}>
          What's happening near you
        </div>

        {/* Body copy */}
        <p style={{font:'400 15px/1.55 Inter', color:p.soft, maxWidth:300, margin:'22px 0 0'}}>
          Local events, news, and recommendations from across the web — all in one feed.
        </p>

        {/* Chip cluster — centered in the middle */}
        <div style={{display:'flex', flexWrap:'wrap', gap:7, justifyContent:'center',
            margin:'30px auto 0', maxWidth:330}}>
          {[
            {id:'events', label:'Events'},
            {id:'music', label:'Music'},
            {id:'food', label:'Food & Drink'},
            {id:'arts', label:'Arts'},
            {id:'community', label:'Community'},
            {id:'outdoors', label:'Outdoors'},
            {id:'cinema', label:'Cinema'},
            {id:'sport', label:'Sport'},
          ].map(c=>(
            <div key={c.id} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background: mode==='dark' ? 'rgba(28,26,22,0.85)' : 'rgba(255,255,255,0.92)',
              border:`1px solid ${p.border}`,
              padding:'8px 12px', borderRadius:999, fontSize:13, color:p.ink, whiteSpace:'nowrap',
            }}>
              <CategoryIcon id={c.id} size={14} c={p.ink} sw={1.6} useEmoji={useEmoji}/>
              {c.label}
            </div>
          ))}
        </div>

        <div style={{flex:1}}/>

        {/* CTA stack */}
        <div style={{width:'100%'}}>
          <PrimaryBtn p={p} onClick={onContinue}>Use my location</PrimaryBtn>
          <div style={{height:10}}/>
          <SecondaryBtn p={p} onClick={onManual}>Enter area manually</SecondaryBtn>
          <p style={{font:'400 11.5px/1.5 Inter', color:p.mute, textAlign:'center', marginTop:14, maxWidth:280, marginLeft:'auto', marginRight:'auto'}}>
            Your location is never stored or shared with third parties.
          </p>
        </div>
      </div>

      <style>{`@keyframes nn-pulse { 0%,100%{transform:scale(1); opacity:.55} 50%{transform:scale(1.08); opacity:.85} }`}</style>
    </div>
  );
};

window.ScreenHome = ScreenHome;
