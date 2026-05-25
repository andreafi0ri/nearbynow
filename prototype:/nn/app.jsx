/* App shell — router, state, phone wrapper, tweaks panel.
   Flow: Home (location) → Email (digest signup) → Feed
   Bottom nav switches Feed/Map/Saved/Profile. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "light",
  "startScreen": "home",
  "showBezel": true,
  "scale": 1,
  "iconStyle": "emoji"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState(t.startScreen || 'home');
  const [savedIds, setSavedIds] = React.useState([1, 2]);
  const [mode, setMode] = React.useState(t.mode);
  React.useEffect(() => { setMode(t.mode); }, [t.mode]);

  const p = window.PaletteFor(mode);
  const area = window.NN_DATA.area;
  const useEmoji = t.iconStyle === 'emoji';

  const toggleSave = (id) => setSavedIds(arr =>
    arr.includes(id) ? arr.filter(x => x!==id) : [...arr, id]
  );

  const changeMode = (m) => { setMode(m); setTweak('mode', m); };

  const showBottomNav = !['home','email'].includes(screen);

  return (
    <div style={{
      minHeight:'100vh', background: mode==='dark' ? '#0A0A0B' : '#E9E4D8',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 0',
      fontFamily:'Inter', transition:'background .3s',
    }}>
      <PhoneShell p={p} showBezel={t.showBezel} scale={t.scale}>
        {screen === 'home' && (
          <ScreenHome p={p} mode={mode} useEmoji={useEmoji}
            onContinue={()=>setScreen('email')}
            onManual={()=>setScreen('email')}/>
        )}
        {screen === 'email' && (
          <ScreenEmail p={p} mode={mode}
            onSubmit={()=>setScreen('feed')}
            onSkip={()=>setScreen('feed')}/>
        )}
        {screen === 'feed' && (
          <ScreenFeed p={p} area={area}
            savedIds={savedIds} onToggleSave={toggleSave}
            onSwitchArea={()=>{}} useEmoji={useEmoji}/>
        )}
        {screen === 'map' && (
          <ScreenMap p={p} mode={mode} area={area} useEmoji={useEmoji}/>
        )}
        {screen === 'saved' && (
          <ScreenSaved p={p} savedIds={savedIds} onToggleSave={toggleSave} useEmoji={useEmoji}/>
        )}
        {screen === 'profile' && (
          <ScreenProfile p={p} mode={mode} onChangeMode={changeMode}
            user={window.NN_DATA.user} areas={window.NN_DATA.areas}/>
        )}
        {showBottomNav && <BottomNav p={p} active={screen} onChange={setScreen}/>}
      </PhoneShell>

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="Theme">
          <window.TweakRadio label="Mode" value={t.mode}
            options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'}]}
            onChange={v=>{ setTweak('mode', v); }}/>
        </window.TweakSection>
        <window.TweakSection title="Icons">
          <window.TweakRadio label="Style" value={t.iconStyle}
            options={[{value:'custom',label:'Mono-line'},{value:'emoji',label:'Emoji'}]}
            onChange={v=>setTweak('iconStyle', v)}/>
        </window.TweakSection>
        <window.TweakSection title="Navigation">
          <window.TweakSelect label="Jump to screen" value={screen}
            options={[
              {value:'home', label:'Home (location)'},
              {value:'email', label:'Email opt-in'},
              {value:'feed', label:'Feed'},
              {value:'map', label:'Map'},
              {value:'saved', label:'Saved'},
              {value:'profile', label:'Profile'},
            ]}
            onChange={v=>{ setScreen(v); setTweak('startScreen', v); }}/>
        </window.TweakSection>
        <window.TweakSection title="Frame">
          <window.TweakToggle label="Phone bezel" value={t.showBezel}
            onChange={v=>setTweak('showBezel', v)}/>
          <window.TweakSlider label="Scale" value={t.scale} min={0.6} max={1.2} step={0.05}
            onChange={v=>setTweak('scale', v)}/>
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

const PhoneShell = ({children, p, showBezel, scale=1}) => (
  <div style={{
    width:390, height:844, borderRadius: showBezel?52:34, overflow:'hidden',
    background: p.bg, color: p.ink, position:'relative',
    boxShadow: showBezel
      ? '0 0 0 12px #0A0A0B, 0 0 0 13px #2a2622, 0 50px 80px -30px rgba(0,0,0,.55)'
      : '0 1px 0 rgba(0,0,0,.06), 0 20px 50px -20px rgba(0,0,0,.25)',
    transform:`scale(${scale})`, transformOrigin:'center center',
  }}>
    <StatusBar p={p}/>
    <div style={{position:'absolute', top:44, left:0, right:0, bottom:0}}>
      {children}
    </div>
    {showBezel && (
      <div style={{position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
          width:118, height:34, borderRadius:18, background:'#0A0A0B', zIndex:5}}/>
    )}
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
