/* Email opt-in screen — slots between Home and Feed.
   Editorial "Stay in the loop", hero envelope with gold halo (mirroring the pin),
   email input with live validation, primary CTA + skip. */

const ScreenEmail = ({p, mode, onSubmit, onSkip}) => {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = () => {
    if (!valid) return;
    setSent(true);
    setTimeout(()=>{ onSubmit && onSubmit(email); }, 1100);
  };

  return (
    <div style={{position:'relative', height:'100%', overflow:'hidden', background:p.bg, color:p.ink}}>
      <MapBackground p={p} mode={mode} opacity={0.45}/>

      <div style={{position:'relative', height:'100%', display:'flex', flexDirection:'column',
          alignItems:'center', textAlign:'center', padding:'48px 28px 32px'}}>

        {/* Brand bar (centered, small) */}
        <div style={{display:'flex', alignItems:'center', gap:9, marginBottom:28, whiteSpace:'nowrap'}}>
          <Pin size={22} p={p}/>
          <Wordmark p={p} size={18}/>
        </div>

        <div style={{flex:0.45}}/>

        {/* Hero envelope with halo */}
        <div style={{position:'relative', width:120, height:120, display:'grid', placeItems:'center'}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%',
            background:`radial-gradient(closest-side, ${p.haloIn}, transparent 70%)`}}/>
          <div style={{position:'absolute', inset:14, borderRadius:'50%',
            border:`1.5px solid ${p.goldDeep}`, opacity:.7}}/>
          <div style={{position:'relative', width:74, height:74, borderRadius:'50%',
            background: p.surface, border:`1.5px solid ${p.goldDeep}`,
            display:'grid', placeItems:'center'}}>
            <EnvelopeIcon size={36} c={p.ink}/>
            {/* tiny red notification badge */}
            <div style={{position:'absolute', top:-2, right:-2, width:22, height:22, borderRadius:6,
              background:p.red, display:'grid', placeItems:'center',
              boxShadow:`0 0 0 3px ${p.bg}`}}>
              <span style={{color:'#fff', fontSize:11, letterSpacing:'1px', fontWeight:700, lineHeight:1}}>•••</span>
            </div>
          </div>
        </div>

        <div style={{marginTop:20, fontFamily:'Playfair Display, Georgia, serif', fontWeight:800,
            fontSize:34, letterSpacing:'-0.02em', color:p.ink, lineHeight:1.05}}>
          Stay in the <span style={{fontStyle:'italic', fontWeight:500, color:p.gold}}>loop</span>.
        </div>
        <p style={{font:'400 14.5px/1.55 Inter', color:p.soft, maxWidth:300, margin:'14px auto 0'}}>
          Get your weekly local digest — the best events and spots in your area, curated for you.
        </p>

        <div style={{flex:0.55}}/>

        {/* Email field */}
        <div style={{width:'100%', position:'relative'}}>
          <input
            value={email}
            onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter' && handleSubmit()}
            disabled={sent}
            placeholder="your@email.com"
            type="email"
            style={{
              width:'100%', height:56, borderRadius:14, padding:'0 56px 0 18px',
              background: p.surface, border:`1.5px solid ${valid ? p.goldDeep : p.border}`,
              color: p.ink, fontSize:15, fontFamily:'Inter', fontWeight:500,
              outline:'none', transition:'border-color .2s',
            }}
          />
          <div style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            width:36, height:36, borderRadius:8, background: valid ? p.goldDeep : p.red,
            display:'grid', placeItems:'center', pointerEvents:'none', transition:'background .25s'}}>
            {valid ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 12 L 10 17 L 19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span style={{color:'#fff', fontSize:14, letterSpacing:'2px', fontWeight:700, lineHeight:1}}>•••</span>
            )}
          </div>
        </div>

        <div style={{height:12}}/>

        {/* Send magic link */}
        <button onClick={handleSubmit} disabled={!valid || sent} style={{
          width:'100%', height:56, borderRadius:14, border:'none',
          background: valid && !sent ? p.btnBg : (p.name==='dark' ? '#3A372E' : '#A8A29A'),
          color: valid && !sent ? p.btnFg : (p.name==='dark' ? '#6B6760' : '#F2EFE9'),
          fontWeight:700, fontSize:15, fontFamily:'Inter',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          cursor: valid && !sent ? 'pointer' : 'default',
          transition:'all .2s',
          boxShadow: valid && !sent ? (p.name==='light' ? '0 8px 24px -10px rgba(0,0,0,.35)' : '0 8px 24px -10px rgba(206,156,0,.5)') : 'none',
        }}>
          {sent ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="20" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </circle>
              </svg>
              Sending magic link…
            </>
          ) : (
            <>Send magic link <span style={{fontSize:18}}>→</span></>
          )}
        </button>

        <button onClick={onSkip} style={{
          background:'none', border:'none', cursor:'pointer',
          color:p.goldDeep, fontWeight:500, fontSize:13.5, fontFamily:'Inter',
          marginTop:18, padding:8, textDecoration:'underline', textUnderlineOffset:4,
        }}>Skip for now</button>

        <p style={{font:'400 11.5px/1.5 Inter', color:p.mute, textAlign:'center', marginTop:14, maxWidth:280}}>
          No spam. Unsubscribe any time. We never sell your data.
        </p>
      </div>
    </div>
  );
};

const EnvelopeIcon = ({size=32, c='currentColor', sw=1.6}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect x="4" y="8" width="24" height="17" rx="2.5" stroke={c} strokeWidth={sw} fill="none"/>
    <path d="M4.5 9 L 16 18 L 27.5 9" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

window.ScreenEmail = ScreenEmail;
