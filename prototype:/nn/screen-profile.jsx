/* Profile screen — profile card, areas, theme switcher (controls global mode!),
   notification toggles, account links. */

const ScreenProfile = ({p, mode, onChangeMode, user, areas}) => {
  const [notif, setNotif] = React.useState({
    news: true, events: true, recs: true, digest: true,
  });

  return (
    <div style={{position:'relative', height:'100%', overflowY:'auto', background:p.bg, color:p.ink,
        paddingBottom: 100, fontFamily:'Inter'}}>
      <BrandBar p={p} subtitle="Your profile"/>

      <div style={{height:1, background:p.border, margin:'0 22px 18px'}}/>

      <div style={{padding:'0 16px'}}>
        {/* Profile card */}
        <div style={{
          background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:18,
          padding:'18px 18px 16px',
        }}>
          <div style={{display:'flex', gap:14, alignItems:'center'}}>
            <div style={{
              width:64, height:64, borderRadius:'50%',
              background: `radial-gradient(closest-side, ${p.goldSoft}, ${p.gold}88)`,
              border:`2px solid ${p.goldDeep}`, position:'relative',
              display:'grid', placeItems:'center', fontSize:30, color:p.ink,
            }}>
              {user.avatar}
              <div style={{position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%',
                background:p.ink, color:p.gold, fontFamily:'Inter', fontSize:11, fontWeight:700,
                display:'grid', placeItems:'center', border:`2px solid ${p.bg}`}}>
                <span style={{fontSize:10}}>📍</span>
              </div>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{font:'700 17px Inter', color:p.ink}}>{user.name}</div>
                <button style={{
                  background:'transparent', border:`1.5px solid ${p.goldDeep}`, color:p.goldDeep,
                  padding:'2px 10px', borderRadius:999, fontSize:11.5, fontWeight:600, cursor:'pointer',
                }}>Edit</button>
              </div>
              <div style={{font:'400 13px Inter', color:p.mute, marginTop:3, overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user.email}</div>
            </div>
          </div>

          <div style={{height:1, background:p.border, margin:'16px 0 12px'}}/>

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
            <div style={{font:'500 11px Inter', letterSpacing:'.18em', textTransform:'uppercase', color:p.mute}}>Your areas</div>
            <button style={{
              background:p.ink, color:p.gold, border:'none',
              padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:600,
              display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer',
            }}>+ Add</button>
          </div>
          {areas.map(a => (
            <div key={a.name} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 14px', borderRadius:12, border:`1.5px solid ${a.active?p.goldDeep:p.border}`,
              background: p.surface, marginBottom:8,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <PinDot c={p.red}/>
                <span style={{font:'600 14px Inter', color:p.ink}}>{a.name}</span>
              </div>
              {a.active && <span style={{color:p.goldDeep, font:'600 12px Inter'}}>✓ active</span>}
            </div>
          ))}
        </div>

        {/* Appearance */}
        <SectionLabel p={p}>Appearance</SectionLabel>
        <div style={{
          background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:18, padding:16,
        }}>
          <div style={{font:'600 15px Inter', color:p.ink}}>Theme</div>
          <div style={{font:'400 12.5px Inter', color:p.mute, marginTop:2}}>
            {mode === 'dark' ? 'Dark mode is on' : 'Light mode is on'}
          </div>

          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0,
            marginTop:14, padding:4, borderRadius:14,
            background:p.bg2, border:`1px solid ${p.border}`,
          }}>
            <ThemeBtn p={p} active={mode==='light'} onClick={()=>onChangeMode('light')}
              label="Light" emoji="☀️" tone="light"/>
            <ThemeBtn p={p} active={false} onClick={()=>{}} label="Auto" emoji="⚙️" tone="auto" disabled/>
            <ThemeBtn p={p} active={mode==='dark'} onClick={()=>onChangeMode('dark')}
              label="Dark" emoji="🌙" tone="dark"/>
          </div>
        </div>

        {/* Notifications */}
        <SectionLabel p={p}>Notifications</SectionLabel>
        <div style={{
          background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:18, overflow:'hidden',
        }}>
          {[
            {k:'news', title:'Breaking local news', sub:'Incidents, closures, urgent updates'},
            {k:'events', title:'New events nearby', sub:'When new events appear in your area'},
            {k:'recs', title:'Recommendations', sub:'New restaurants and places to try'},
            {k:'digest', title:'Weekly digest email', sub:'Every Monday morning summary'},
          ].map((row, i, arr) => (
            <div key={row.k} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'16px 16px', borderBottom: i<arr.length-1 ? `1px solid ${p.borderSoft}` : 'none',
            }}>
              <div>
                <div style={{font:'600 14.5px Inter', color:p.ink}}>{row.title}</div>
                <div style={{font:'400 12.5px Inter', color:p.mute, marginTop:2}}>{row.sub}</div>
              </div>
              <Toggle on={notif[row.k]} onClick={()=>setNotif(n=>({...n, [row.k]: !n[row.k]}))} p={p}/>
            </div>
          ))}
        </div>

        {/* Account */}
        <SectionLabel p={p}>Account</SectionLabel>
        <div style={{
          background:p.cardBg, border:`1px solid ${p.cardBorder}`, borderRadius:18, overflow:'hidden',
        }}>
          {[
            {label:'Privacy Policy', arrow:true},
            {label:'Terms of Service', arrow:true},
            {label:'Send feedback', arrow:true},
            {label:'Sign in with magic link', gold:true},
          ].map((row,i,arr)=>(
            <div key={row.label} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'16px 16px', borderBottom: i<arr.length-1 ? `1px solid ${p.borderSoft}` : 'none',
              cursor:'pointer',
            }}>
              <div style={{font:'500 14.5px Inter', color: row.gold ? p.goldDeep : p.ink}}>{row.label}</div>
              {row.arrow && <span style={{color:p.mute, fontSize:16}}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SectionLabel = ({children, p}) => (
  <div style={{font:'500 11px Inter', letterSpacing:'.18em', textTransform:'uppercase',
      color:p.mute, margin:'24px 0 10px 4px'}}>{children}</div>
);

const ThemeBtn = ({p, active, onClick, label, emoji, tone, disabled}) => (
  <button onClick={disabled?undefined:onClick} disabled={disabled} style={{
    padding:'14px 8px 10px', borderRadius:11,
    background: active ? p.ink : 'transparent',
    color: active ? p.gold : (disabled ? p.dim : p.ink),
    border: active ? `1.5px solid ${p.gold}` : '1.5px solid transparent',
    fontFamily:'Inter', fontWeight:600, fontSize:13,
    cursor: disabled ? 'default' : 'pointer',
    display:'flex', flexDirection:'column', alignItems:'center', gap:5,
    opacity: disabled ? 0.5 : 1,
  }}>
    <span style={{fontSize:20}}>{emoji}</span>
    {label}
  </button>
);

const Toggle = ({on, onClick, p}) => (
  <button onClick={onClick} style={{
    width:46, height:26, borderRadius:999, border:'none',
    background: on ? p.sport : p.dim, position:'relative', cursor:'pointer',
    padding:0, transition:'background .2s',
  }}>
    <div style={{
      position:'absolute', top:3, left: on ? 23 : 3,
      width:20, height:20, borderRadius:'50%',
      background: on ? p.ink : '#fff',
      transition:'left .2s',
      boxShadow:'0 1px 3px rgba(0,0,0,.25)',
    }}/>
  </button>
);

window.ScreenProfile = ScreenProfile;
