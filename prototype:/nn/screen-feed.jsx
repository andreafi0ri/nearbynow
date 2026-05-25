/* Feed screen — magazine layout with compact filter bar, scrollable cards,
   and an "add to calendar" bottom sheet that floats above the scroll area. */

const ScreenFeed = ({p, area, onSwitchArea, savedIds, onToggleSave, useEmoji}) => {
  const D = window.NN_DATA;
  const [calItem, setCalItem] = React.useState(null);
  return (
    <div style={{position:'relative', height:'100%', background:p.bg, color:p.ink, fontFamily:'Inter'}}>
      <div style={{position:'absolute', inset:0, overflowY:'auto', paddingBottom:100}}>
        <BrandBar p={p} subtitle="Now browsing" right={
          <div style={{display:'flex', gap:8}}>
            <IconButton p={p}><Heart c={p.ink}/></IconButton>
            <IconButton p={p}><Bell c={p.ink}/></IconButton>
          </div>
        }/>

        {/* Area header */}
        <div style={{padding:'4px 22px 16px'}}>
          <div style={{display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
            <div style={{fontFamily:'Playfair Display, Georgia, serif', fontWeight:800, fontSize:25,
                letterSpacing:'-0.01em', color:p.ink, whiteSpace:'nowrap'}}>
              {area.name.split(',')[0]},<span style={{fontStyle:'italic',fontWeight:500,color:p.gold}}> {area.name.split(',')[1]?.trim()}</span>
            </div>
            <button onClick={onSwitchArea} style={{
              display:'inline-flex', alignItems:'center', gap:5,
              background:'transparent', border:`1.5px solid ${p.goldDeep}`, color:p.goldDeep,
              padding:'4px 10px', borderRadius:999, fontSize:11.5, fontWeight:600, cursor:'pointer'
            }}>
              <span style={{fontSize:9}}>▾</span> switch
            </button>
          </div>
          <div style={{font:'400 13px Inter', color:p.mute, marginTop:6}}>
            Within {area.radius} miles (16km)
          </div>
        </div>

        <FilterBar p={p} useEmoji={useEmoji}/>

        <div style={{height:1, background:p.border, margin:'2px 22px 14px'}}/>

        <div style={{font:'600 11px Inter', letterSpacing:'.18em', textTransform:'uppercase',
            color:p.mute, padding:'0 22px 12px'}}>
          {D.feed.length} results + 4 nearby
        </div>

        <div style={{padding:'0 16px'}}>
          {D.feed.map(item => (
            <FeedCard key={item.id} item={item} p={p}
              saved={savedIds.includes(item.id)}
              onSave={()=>onToggleSave(item.id)}
              onAddToCalendar={()=>setCalItem(item)}
              useEmoji={useEmoji}/>
          ))}
        </div>
      </div>

      <CalendarSheet open={!!calItem} item={calItem} onClose={()=>setCalItem(null)} p={p} useEmoji={useEmoji}/>
    </div>
  );
};

/* Calendar bottom sheet — Google Calendar / Apple Calendar (iCal) */
const CalendarSheet = ({open, item, onClose, p, useEmoji}) => {
  if (!item && !open) return null;
  return (
    <BottomSheet open={open} onClose={onClose} p={p}>
      {item && (
        <>
          <div style={{font:'500 11px Inter', letterSpacing:'.18em', textTransform:'uppercase',
              color:p.mute, marginBottom:8}}>Add to calendar</div>
          <div style={{fontFamily:'Playfair Display, Georgia, serif', fontWeight:700, fontSize:20,
              letterSpacing:'-0.01em', color:p.ink, lineHeight:1.25, marginBottom:14}}>
            {item.title}
          </div>
          <div style={{display:'flex', gap:14, fontSize:13, color:p.soft, paddingBottom:14, borderBottom:`1px solid ${p.borderSoft}`}}>
            <span style={{display:'flex',alignItems:'center',gap:6}}>
              <ClockIcon c={p.mute}/><b style={{color:p.ink, fontWeight:600}}>{item.time}</b>
            </span>
            <span style={{display:'flex',alignItems:'center',gap:6}}>
              <PinDot c={p.red}/>{item.loc}
            </span>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
            <CalOption p={p} icon="📅" iconBg={'#FFE4E0'} iconBorder={'#E07A6D'}
              title="Google Calendar" sub="Opens in browser — tap Save"
              useEmoji={useEmoji} customIcon={
                <svg width="26" height="26" viewBox="0 0 26 26">
                  <rect x="3" y="4" width="20" height="18" rx="3" fill="#fff" stroke="#E07A6D" strokeWidth="1.5"/>
                  <rect x="3" y="4" width="20" height="5" rx="3" fill="#E07A6D"/>
                  <text x="13" y="18.5" textAnchor="middle" fontFamily="Inter" fontSize="9" fontWeight="700" fill="#E07A6D">17</text>
                </svg>
              }/>
            <CalOption p={p} icon="🍎" iconBg={'#FFE9E5'} iconBorder={'#E03A2F'}
              title="Apple Calendar (iCal)" sub="Downloads .ics file"
              useEmoji={useEmoji} customIcon={
                <svg width="26" height="26" viewBox="0 0 26 26">
                  <path d="M16 6 c -2 0 -3 1 -3 1 s -1-1-3-1 c -3 0 -5 3 -5 7 c 0 5 4 8 5 8 c 1 0 2-1 3-1 s 2 1 3 1 c 1 0 5-3 5-8 c 0-4-2-7-5-7 Z" fill="#E03A2F"/>
                  <path d="M14 4 c 1-1 2-1 3-1 c 0 1 0 2-1 3 c -1 1-2 1-3 1 c 0-1 0-2 1-3 Z" fill="#E03A2F"/>
                </svg>
              }/>
          </div>

          <button onClick={onClose} style={{
            width:'100%', height:52, marginTop:18, borderRadius:14,
            background:p.surface, border:`1.5px solid ${p.border}`, color:p.ink,
            fontWeight:600, fontSize:14, fontFamily:'Inter', cursor:'pointer'
          }}>Cancel</button>
        </>
      )}
    </BottomSheet>
  );
};

const CalOption = ({p, customIcon, title, sub}) => (
  <button style={{
    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
    background:p.surface, border:`1.5px solid ${p.border}`, borderRadius:14,
    cursor:'pointer', textAlign:'left', color:p.ink,
  }}>
    <div style={{width:42, height:42, borderRadius:11, background:p.bg2,
        display:'grid', placeItems:'center', flexShrink:0, border:`1px solid ${p.border}`}}>
      {customIcon}
    </div>
    <div style={{flex:1}}>
      <div style={{font:'700 14.5px Inter', color:p.ink}}>{title}</div>
      <div style={{font:'400 12px Inter', color:p.mute, marginTop:2}}>{sub}</div>
    </div>
    <span style={{color:p.mute, fontSize:16}}>→</span>
  </button>
);

window.ScreenFeed = ScreenFeed;
