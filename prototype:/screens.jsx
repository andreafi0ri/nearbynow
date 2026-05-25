/* Nearby & Now — five phone-screen variants used inside the design canvas */

const PinIcon = ({size=44, accent='var(--gold-mid)', body='var(--ink-2)', dot='var(--ink-2)', rings=true, ringColor='var(--gold-deep)'}) => (
  <svg width={size} height={size*1.15} viewBox="0 0 100 115" fill="none" style={{display:'block'}}>
    {rings && <circle cx="50" cy="56" r="46" stroke={ringColor} strokeWidth="1.2" opacity=".28" />}
    {rings && <circle cx="50" cy="56" r="34" stroke={ringColor} strokeWidth="1" opacity=".5" />}
    <path d="M50 14 C32 14 18 28 18 46 C18 70 50 104 50 104 C50 104 82 70 82 46 C82 28 68 14 50 14 Z" fill={body}/>
    <circle cx="50" cy="44" r="14" fill={accent}/>
    <circle cx="50" cy="44" r="5" fill={dot}/>
  </svg>
);

const StatusBar = ({tone='dark'}) => (
  <div className="status" style={{color: tone==='dark' ? '#F4F4F6' : '#111'}}>
    <span>9:41</span>
    <span className="icons">
      <svg width="18" height="10" viewBox="0 0 18 10"><path d="M1 9h2V6H1zM5 9h2V4H5zM9 9h2V2H9zM13 9h2V0h-2z" fill="currentColor"/></svg>
      <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 2c1.6 0 3.1.6 4.2 1.7l1-1A8 8 0 0 0 1.8 2.7l1 1A6 6 0 0 1 7 2zm0 3c.8 0 1.6.3 2.1.9l1-1A5 5 0 0 0 4 5l.9.9A3 3 0 0 1 7 5zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="currentColor"/></svg>
      <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="20" height="10" rx="2" stroke="currentColor" fill="none"/><rect x="2" y="2" width="16" height="7" rx="1" fill="currentColor"/><rect x="21" y="3.5" width="2" height="4" rx="1" fill="currentColor"/></svg>
    </span>
  </div>
);

const BottomNav = ({active='feed', tone='cream'}) => {
  const items=[['feed','Feed','grid'],['map','Map','map'],['saved','Saved','heart'],['profile','Profile','dot']];
  const c = tone==='cream' ? {ink:'var(--ink)', muted:'#999', gold:'var(--gold-deep)', bg:'rgba(250,247,243,.92)', line:'var(--cream-3)'}
                           : {ink:'#F4F4F6', muted:'#666', gold:'var(--gold-soft)', bg:'rgba(14,14,16,.92)', line:'#222'};
  return (
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:72,
      borderTop:`1px solid ${c.line}`, background:c.bg, backdropFilter:'blur(12px)',
      display:'flex', alignItems:'center', justifyContent:'space-around', padding:'8px 0 18px',
      fontSize:11, letterSpacing:'.14em', textTransform:'uppercase'}}>
      {items.map(([k,label])=> (
        <div key={k} style={{textAlign:'center', color: k===active ? c.gold : c.muted, fontWeight: k===active?600:500}}>
          <div style={{width:20,height:20,margin:'0 auto 4px',borderRadius:k==='profile'?'50%':4,
            border:`1.5px solid ${k===active?c.gold:c.muted}`,
            background:k==='saved' && k===active ? c.gold : 'transparent'}}/>
          <div>{label}</div>
        </div>
      ))}
    </div>
  );
};

/* ───────────────────────────────────── V0 — Original (recreated) ──────────────── */
const V0_Original = () => (
  <div className="phone dark">
    <StatusBar tone="dark"/>
    <div className="pad" style={{justifyContent:'center', alignItems:'center', textAlign:'center', paddingBottom:120}}>
      <div style={{marginBottom:24}}><PinIcon size={56} body="#FFF" accent="var(--gold-soft)" dot="#0E0E10" ringColor="var(--gold-deep)" /></div>
      <div className="wordmark" style={{fontSize:38, color:'#F4F4F6'}}>
        Nearby <span className="amp">&amp;</span> <span className="now">Now</span>
      </div>
      <div className="tag" style={{color:'#7E7B72', marginTop:14}}>What's happening near you</div>
      <p style={{font:'400 15px/1.55 var(--sans)', color:'#BFBCB1', maxWidth:280, marginTop:30}}>
        Local events, news, and recommendations from across the web — all in one feed.
      </p>
      <button style={{marginTop:36, width:'100%', height:54, borderRadius:14, border:'none',
        background:'#F4F2EE', color:'var(--gold-mid)', fontWeight:600, fontSize:15, fontFamily:'var(--sans)', cursor:'pointer'}}>Use my location</button>
      <button style={{marginTop:10, width:'100%', height:54, borderRadius:14,
        background:'transparent', color:'#F4F4F6', border:'1px solid #2F2D28', fontWeight:500, fontSize:15, fontFamily:'var(--sans)', cursor:'pointer'}}>Enter area manually</button>
      <p style={{font:'400 12px/1.55 var(--sans)', color:'#777267', maxWidth:240, marginTop:22}}>
        Your location is never stored or shared with third parties.
      </p>
    </div>
  </div>
);

/* ───────────────────────────────── V1 — Cream / match the app ─────────────────── */
const V1_Cream = () => (
  <div className="phone cream">
    <StatusBar tone="light"/>
    <div className="pad" style={{paddingTop:90, alignItems:'flex-start'}}>
      <PinIcon size={38} body="var(--ink-2)" accent="var(--gold-mid)" dot="var(--ink-2)" rings={false}/>
      <div style={{marginTop:48}}>
        <div className="eyebrow" style={{color:'var(--gold-deep)'}}>·  Welcome</div>
        <div className="wordmark" style={{fontSize:54, marginTop:14, color:'var(--ink)'}}>
          Nearby<br/><span className="amp" style={{color:'var(--gold-deep)'}}>&amp;</span> <span className="now" style={{color:'var(--gold-deep)'}}>Now.</span>
        </div>
        <p style={{font:'400 16px/1.55 var(--sans)', color:'var(--ink-soft)', marginTop:24, maxWidth:300}}>
          Everything happening around you — events, local news, food, music — pulled from across the web into one quiet feed.
        </p>
      </div>
      <div style={{marginTop:'auto', width:'100%'}}>
        <button style={{width:'100%', height:56, borderRadius:14, border:'none',
          background:'var(--ink)', color:'#FAF7F3', fontWeight:600, fontSize:15, fontFamily:'var(--sans)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'var(--gold-soft)',boxShadow:'0 0 0 4px rgba(240,201,106,.2)'}}/>
          Find what's near me
        </button>
        <button style={{marginTop:10, width:'100%', height:50, borderRadius:14,
          background:'transparent', color:'var(--ink)', border:'1px solid var(--cream-3)',
          fontWeight:500, fontSize:14, fontFamily:'var(--sans)', cursor:'pointer'}}>
          Type a city instead
        </button>
        <p style={{font:'400 11.5px/1.5 var(--sans)', color:'var(--muted-2)', textAlign:'center', marginTop:14}}>
          We never store or share your location.
        </p>
      </div>
    </div>
  </div>
);

/* ─────────────────────────── V2 — Editorial peek (show real content) ────────── */
const V2_Editorial = () => {
  const peeks = [
    {cat:'EVENTS', tone:'#E0392A', title:'Frail Talk & Emily Hines tonight at The Blue Room', meta:'Fri · 7:00 PM · East Nashville'},
    {cat:'FOOD',   tone:'#1F8A5B', title:'Rickshaw Billie\'s Burger Patrol pops up Saturday', meta:'Saturday · Five Points'},
    {cat:'NEWS',   tone:'#C77B00', title:'Harpeth River cleanup volunteers wanted', meta:'1d ago · r/nashville'},
  ];
  return (
    <div className="phone cream">
      <StatusBar tone="light"/>
      <div className="pad" style={{paddingTop:84}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <PinIcon size={28} body="var(--ink-2)" accent="var(--gold-mid)" dot="var(--ink-2)" rings={false}/>
          <div className="wordmark" style={{fontSize:22}}>
            Nearby <span className="amp" style={{color:'var(--gold-deep)'}}>&amp;</span> <span className="now" style={{color:'var(--gold-deep)'}}>Now</span>
          </div>
        </div>
        <div style={{marginTop:36}}>
          <div className="wordmark" style={{fontSize:44, lineHeight:1.02, letterSpacing:'-0.02em'}}>
            Today,<br/>within <span style={{fontStyle:'italic', color:'var(--gold-deep)'}}>10 miles</span> of you.
          </div>
          <p style={{font:'400 14.5px/1.55 var(--sans)', color:'var(--ink-soft)', marginTop:14, maxWidth:300}}>
            A quiet, curated feed of what's actually happening — pulled from local subreddits, venues, papers and Mastodon.
          </p>
        </div>

        {/* peek stack */}
        <div style={{position:'relative', marginTop:24, marginLeft:-6, marginRight:-6}}>
          {peeks.map((p,i)=>(
            <div key={i} style={{
              background:'#FFF', border:'1px solid var(--cream-3)', borderRadius:14,
              padding:'12px 14px', marginBottom:8, position:'relative', overflow:'hidden',
              opacity: 1 - i*0.18,
              transform:`translateX(${i*4}px)`,
            }}>
              <div style={{height:3, position:'absolute', top:0,left:0,right:0, background:p.tone}}/>
              <div style={{font:'600 9.5px/1 var(--sans)', letterSpacing:'.16em', color:p.tone, paddingTop:4}}>{p.cat}</div>
              <div style={{font:'600 13px/1.35 var(--serif)', color:'var(--ink)', marginTop:6, fontFamily:'var(--sans)'}}>{p.title}</div>
              <div style={{font:'400 11px/1.3 var(--sans)', color:'var(--muted)', marginTop:4}}>{p.meta}</div>
            </div>
          ))}
          <div style={{position:'absolute', left:0, right:0, bottom:-4, height:90,
            background:'linear-gradient(to bottom, rgba(250,247,243,0), rgba(250,247,243,1) 70%)'}}/>
        </div>

        <div style={{marginTop:'auto', paddingTop:14}}>
          <button style={{width:'100%', height:54, borderRadius:14, border:'none',
            background:'var(--ink)', color:'var(--cream)', fontWeight:600, fontSize:15,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer'}}>
            <PinIcon size={16} body="var(--gold-soft)" accent="var(--cream)" dot="var(--ink)" rings={false}/>
            Show me my feed
          </button>
          <p style={{font:'400 11.5px/1.5 var(--sans)', color:'var(--muted-2)', textAlign:'center', marginTop:10}}>
            Location used only on-device · <span style={{textDecoration:'underline'}}>set a city manually</span>
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── V3 — Dark, refined (the user's direction but fixed) ────────── */
const V3_DarkRefined = () => {
  const chips = [
    ['📅','Events'], ['🎵','Music'], ['🍽','Food'], ['📰','News'], ['🌳','Outdoors'], ['🎨','Arts']
  ];
  return (
    <div className="phone dark">
      <StatusBar tone="dark"/>
      <div className="pad" style={{paddingTop:84, alignItems:'center', textAlign:'center'}}>
        <div style={{position:'relative', width:120, height:120, display:'grid', placeItems:'center'}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:'radial-gradient(closest-side, rgba(206,156,0,.18), transparent 70%)'}}/>
          <PinIcon size={78} body="#F4F4F6" accent="var(--gold-soft)" dot="#0E0E10" ringColor="var(--gold-soft)"/>
        </div>
        <div className="wordmark" style={{fontSize:48, color:'#F4F4F6', marginTop:14}}>
          Nearby <span className="amp">&amp;</span> <span className="now">Now</span>
        </div>
        <p style={{font:'400 15px/1.55 var(--sans)', color:'#BFBCB1', maxWidth:300, marginTop:18}}>
          One quiet feed for everything happening within walking, driving, or scrolling distance of you.
        </p>

        {/* category chip preview */}
        <div style={{display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:24, maxWidth:320}}>
          {chips.map(([e,l])=>(
            <div key={l} style={{display:'inline-flex', alignItems:'center', gap:6,
              background:'rgba(255,255,255,.04)', border:'1px solid #26241F',
              padding:'7px 12px', borderRadius:999, fontSize:12, color:'#D8D5C9'}}>
              <span style={{fontSize:13}}>{e}</span>{l}
            </div>
          ))}
        </div>

        <div style={{marginTop:'auto', width:'100%'}}>
          <button style={{width:'100%', height:56, borderRadius:14, border:'none',
            background:'var(--gold-mid)', color:'#1A1505', fontWeight:700, fontSize:15, fontFamily:'var(--sans)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#1A1505'}}/>
            Use my location
          </button>
          <button style={{marginTop:10, width:'100%', height:50, borderRadius:14,
            background:'transparent', color:'#F4F4F6', border:'1px solid #2A2823',
            fontWeight:500, fontSize:14, fontFamily:'var(--sans)', cursor:'pointer'}}>
            Enter area manually
          </button>
          <p style={{font:'400 11.5px/1.5 var(--sans)', color:'#7E7B72', marginTop:12}}>
            Location stays on your device. Always.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── V4 — Map context ────────── */
const V4_Map = () => (
  <div className="phone cream">
    <StatusBar tone="light"/>
    {/* map background */}
    <svg viewBox="0 0 390 800" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
      <defs>
        <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(250,247,243,0)"/>
          <stop offset="55%" stopColor="rgba(250,247,243,.4)"/>
          <stop offset="100%" stopColor="rgba(250,247,243,1)"/>
        </linearGradient>
        <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#D7CFBE"/>
        </pattern>
      </defs>
      <rect width="390" height="800" fill="url(#dots)" opacity=".6"/>
      {/* abstract streets */}
      <g stroke="#D7CFBE" strokeWidth="14" fill="none" opacity=".55">
        <path d="M-20 180 L 240 220 L 420 180"/>
        <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
        <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
        <path d="M -20 420 Q 200 400 420 460"/>
      </g>
      <g stroke="#C6BDA8" strokeWidth="2" fill="none" opacity=".7">
        <path d="M -20 180 L 240 220 L 420 180"/>
        <path d="M 90 -20 L 110 260 L 60 520 L 120 820"/>
        <path d="M 260 -20 L 280 320 L 220 560 L 300 820"/>
        <path d="M -20 420 Q 200 400 420 460"/>
      </g>
      {/* blocks */}
      <g fill="#E7DFC9" opacity=".55">
        <rect x="130" y="240" width="120" height="60" rx="3"/>
        <rect x="20" y="290" width="60" height="100" rx="3"/>
        <rect x="135" y="330" width="70" height="90" rx="3"/>
        <rect x="230" y="350" width="60" height="120" rx="3"/>
      </g>
      <rect width="390" height="800" fill="url(#fade)"/>
    </svg>

    <StatusBar tone="light"/>
    <div className="pad" style={{paddingTop:84, position:'relative'}}>
      <div className="eyebrow" style={{color:'var(--gold-deep)'}}>·  Locating you</div>
      <div className="wordmark" style={{fontSize:52, marginTop:10, lineHeight:1, letterSpacing:'-0.02em'}}>
        Nearby<br/>
        <span className="amp" style={{color:'var(--gold-deep)'}}>&amp;</span> <span style={{color:'var(--gold-deep)'}}>Now.</span>
      </div>

      {/* central pin floating on the "map" */}
      <div style={{position:'absolute', right:36, top:240, transform:'translateY(-20%)'}}>
        <div style={{position:'relative', width:120, height:120}}>
          <div style={{position:'absolute', inset:10, borderRadius:'50%',
            border:'1px dashed var(--gold-deep)', opacity:.4, animation:'pulse 3s ease-in-out infinite'}}/>
          <div style={{position:'absolute', inset:26, borderRadius:'50%',
            border:'1px solid var(--gold-deep)', opacity:.6}}/>
          <div style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-58%)'}}>
            <PinIcon size={46} body="var(--ink)" accent="var(--gold-mid)" dot="var(--ink)" rings={false}/>
          </div>
        </div>
      </div>

      <p style={{font:'400 15px/1.55 var(--sans)', color:'var(--ink-soft)', marginTop:170, maxWidth:300}}>
        A single feed of local events, news, and recommendations — pulled from across the web, centered on wherever you are.
      </p>

      <div style={{marginTop:'auto', paddingTop:30, width:'100%'}}>
        <button style={{width:'100%', height:56, borderRadius:14, border:'none',
          background:'var(--ink)', color:'var(--cream)', fontWeight:600, fontSize:15,
          display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', cursor:'pointer'}}>
          <span style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'var(--gold-soft)',boxShadow:'0 0 0 4px rgba(240,201,106,.25)'}}/>
            Drop me on the map
          </span>
          <span style={{color:'var(--gold-soft)', fontSize:18}}>→</span>
        </button>
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginTop:14, color:'var(--muted)', fontSize:12.5}}>
          <span style={{height:1, width:32, background:'var(--cream-3)'}}/>
          or
          <span style={{height:1, width:32, background:'var(--cream-3)'}}/>
        </div>
        <button style={{marginTop:14, width:'100%', height:48, borderRadius:14,
          background:'transparent', color:'var(--ink)', border:'1px dashed var(--cream-3)',
          fontWeight:500, fontSize:14, cursor:'pointer'}}>
          Type a city or zip
        </button>
      </div>
    </div>
    <style>{`@keyframes pulse { 0%,100%{transform:scale(1); opacity:.4} 50%{transform:scale(1.08); opacity:.7} }`}</style>
  </div>
);

Object.assign(window, { V0_Original, V1_Cream, V2_Editorial, V3_DarkRefined, V4_Map });
