/* FilterBar — compact DATE | FILTERS | SOURCES strip + the bottom sheets.
   Manages its own open/close state and the selection state for each. */

const FilterBar = ({p, useEmoji}) => {
  const D = window.NN_DATA;
  const [open, setOpen] = React.useState(null);   // 'date'|'filters'|'sources'|null
  const [date, setDate] = React.useState('anytime');   // 'today'|'weekend'|'week'|'anytime'
  const [cats, setCats] = React.useState(new Set());   // category ids selected
  const [free, setFree] = React.useState(false);
  const [sources, setSources] = React.useState(new Set(['reddit','localnews','eventbrite','meetup','ticketmaster','googleplaces','facebook','viator']));

  const dateLabel = ({today:'Today', weekend:'This weekend', week:'This week', anytime:'Anytime'})[date];
  const filterCount = cats.size + (free?1:0);
  const sourceCount = sources.size;

  return (
    <>
      <div style={{display:'flex', gap:8, padding:'0 22px 14px'}}>
        <PillBtn p={p} onClick={()=>setOpen('date')} icon="date" label="Date" value={dateLabel} active={date!=='anytime'}/>
        <PillBtn p={p} onClick={()=>setOpen('filters')} icon="filters" label="Filters" value={filterCount?`${filterCount}`:'All'} active={filterCount>0}/>
        <PillBtn p={p} onClick={()=>setOpen('sources')} icon="sources" label="Sources" value={`${sourceCount}`} active={sourceCount<8}/>
      </div>

      {/* Date sheet */}
      <BottomSheet open={open==='date'} onClose={()=>setOpen(null)} p={p} title="When">
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          {[
            {id:'anytime', label:'Anytime', sub:'No date filter'},
            {id:'today',   label:'Today',   sub:'Friday, May 22'},
            {id:'weekend', label:'This weekend', sub:'Sat – Sun'},
            {id:'week',    label:'This week', sub:'Mon – Sun'},
            {id:'custom',  label:'Pick a date…', sub:'Custom range'},
          ].map(opt => (
            <button key={opt.id} onClick={()=>{ setDate(opt.id); setOpen(null); }} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px', borderRadius:12,
              background: date===opt.id ? p.surface : 'transparent',
              border: `1.5px solid ${date===opt.id ? p.goldDeep : 'transparent'}`,
              color:p.ink, cursor:'pointer', textAlign:'left', fontFamily:'Inter',
            }}>
              <div>
                <div style={{font:'600 15px Inter', color:p.ink}}>{opt.label}</div>
                <div style={{font:'400 12.5px Inter', color:p.mute, marginTop:2}}>{opt.sub}</div>
              </div>
              {date===opt.id && <span style={{color:p.goldDeep, fontSize:18}}>✓</span>}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Filters sheet — categories grid */}
      <BottomSheet open={open==='filters'} onClose={()=>setOpen(null)} p={p} title="Filter by category" maxHeight="80%">
        {/* Free toggle */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 16px', borderRadius:12, background:p.surface,
          border:`1.5px solid ${free?p.goldDeep:p.border}`, marginBottom:16,
        }}>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <CategoryIcon id="free" size={20} c={p.ink} useEmoji={useEmoji}/>
            <div>
              <div style={{font:'600 14.5px Inter', color:p.ink}}>Free only</div>
              <div style={{font:'400 12px Inter', color:p.mute, marginTop:1}}>Hide ticketed events</div>
            </div>
          </div>
          <Toggle on={free} onClick={()=>setFree(!free)} p={p}/>
        </div>

        <div style={{font:'500 11px Inter', letterSpacing:'.18em', textTransform:'uppercase',
            color:p.mute, marginBottom:10}}>Categories</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
          {D.categories.filter(c => !['nearby','today'].includes(c.id)).map(c => {
            const on = cats.has(c.id);
            const accent = p[c.tone] || p.ink;
            return (
              <button key={c.id} onClick={()=>{
                const next = new Set(cats);
                next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                setCats(next);
              }} style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                padding:'14px 8px', borderRadius:14,
                background: on ? p.surface : p.bg2,
                border: `1.5px solid ${on?accent:'transparent'}`,
                cursor:'pointer', fontFamily:'Inter',
                position:'relative',
              }}>
                <div style={{
                  width:44, height:44, borderRadius:12,
                  background: `${accent}1A`,
                  display:'grid', placeItems:'center',
                  border:`1px solid ${accent}33`,
                  color: accent,
                }}>
                  <CategoryIcon id={c.id} size={22} c={accent} useEmoji={useEmoji}/>
                </div>
                <div style={{font:'600 13px Inter', color:p.ink, textAlign:'center'}}>{c.label}</div>
                {on && <div style={{position:'absolute', top:6, right:6,
                    width:18, height:18, borderRadius:'50%', background:accent,
                    color:p.bg, fontSize:11, fontWeight:700,
                    display:'grid', placeItems:'center'}}>✓</div>}
              </button>
            );
          })}
        </div>

        <div style={{display:'flex', gap:10, marginTop:20}}>
          <button onClick={()=>{ setCats(new Set()); setFree(false); }} style={{
            flex:1, height:48, borderRadius:14, background:'transparent',
            border:`1.5px solid ${p.border}`, color:p.ink,
            fontWeight:600, fontSize:14, cursor:'pointer',
          }}>Reset</button>
          <button onClick={()=>setOpen(null)} style={{
            flex:2, height:48, borderRadius:14, background:p.btnBg,
            border:'none', color:p.btnFg,
            fontWeight:700, fontSize:14, cursor:'pointer',
          }}>
            Show {cats.size>0 ? `${cats.size} categor${cats.size===1?'y':'ies'}` : 'all results'}
          </button>
        </div>
      </BottomSheet>

      {/* Sources sheet */}
      <BottomSheet open={open==='sources'} onClose={()=>setOpen(null)} p={p} title="Sources">
        <p style={{font:'400 13px/1.5 Inter', color:p.soft, margin:'0 0 16px'}}>
          We aggregate from these places. Untick to mute any of them.
        </p>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {[
            {id:'reddit',       emoji:'👽', name:'Reddit',         sub:'r/nashville and local subs'},
            {id:'localnews',    emoji:'📰', name:'Local news',     sub:'Nashville Scene · The Tennessean'},
            {id:'eventbrite',   emoji:'🎟', name:'Eventbrite',     sub:'Ticketed events & workshops'},
            {id:'meetup',       emoji:'👥', name:'Meetup',         sub:'Groups and gatherings'},
            {id:'ticketmaster', emoji:'🎫', name:'Ticketmaster',   sub:'Concerts, sports, theater'},
            {id:'googleplaces', emoji:'📍', name:'Google Places',  sub:'Restaurants, venues, points of interest'},
            {id:'facebook',     emoji:'📘', name:'Facebook',       sub:'Public events from local pages'},
            {id:'viator',       emoji:'🗺',  name:'Viator',         sub:'Tours and experiences'},
          ].map(s => {
            const on = sources.has(s.id);
            return (
              <button key={s.id} onClick={()=>{
                const next = new Set(sources);
                next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                setSources(next);
              }} style={{
                display:'flex', alignItems:'center', gap:14, padding:'12px 14px',
                borderRadius:12, background:p.surface,
                border:`1.5px solid ${on?p.goldDeep:p.border}`,
                cursor:'pointer', textAlign:'left',
              }}>
                <div style={{width:36, height:36, borderRadius:10, background:p.bg2,
                    display:'grid', placeItems:'center', fontSize:18, flexShrink:0,
                    border:`1px solid ${p.border}`}}>{s.emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{font:'600 14.5px Inter', color:p.ink}}>{s.name}</div>
                  <div style={{font:'400 12px Inter', color:p.mute, marginTop:2}}>{s.sub}</div>
                </div>
                <div style={{
                  width:22, height:22, borderRadius:6,
                  border:`1.5px solid ${on?p.goldDeep:p.border}`,
                  background: on?p.goldDeep:'transparent',
                  display:'grid', placeItems:'center', flexShrink:0,
                }}>{on && <span style={{color:p.bg, fontSize:13, fontWeight:700}}>✓</span>}</div>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};

const PillBtn = ({p, onClick, icon, label, value, active}) => (
  <button onClick={onClick} style={{
    flex:1, display:'flex', alignItems:'center', gap:7,
    padding:'10px 12px', borderRadius:12,
    background: active ? p.surface : p.surface,
    border:`1.5px solid ${active ? p.goldDeep : p.border}`,
    color:p.ink, cursor:'pointer', fontFamily:'Inter',
    height:44, justifyContent:'flex-start',
  }}>
    <CategoryIcon id={icon} size={16} c={active ? p.goldDeep : p.ink} sw={1.7}/>
    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', minWidth:0, flex:1}}>
      <div style={{font:'500 9.5px Inter', letterSpacing:'.14em', textTransform:'uppercase', color:p.mute, lineHeight:1}}>{label}</div>
      <div style={{font: `600 13px Inter`, color: active ? p.goldDeep : p.ink, lineHeight:1.1, marginTop:2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%'}}>{value}</div>
    </div>
    <span style={{color:p.mute, fontSize:10}}>▾</span>
  </button>
);

const Toggle = ({on, onClick, p}) => (
  <button onClick={onClick} style={{
    width:46, height:26, borderRadius:999, border:'none',
    background: on ? p.sport : p.dim, position:'relative', cursor:'pointer',
    padding:0, transition:'background .2s', flexShrink:0,
  }}>
    <div style={{
      position:'absolute', top:3, left: on ? 23 : 3,
      width:20, height:20, borderRadius:'50%',
      background: on ? p.ink : '#fff',
      transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.25)',
    }}/>
  </button>
);

window.FilterBar = FilterBar;
