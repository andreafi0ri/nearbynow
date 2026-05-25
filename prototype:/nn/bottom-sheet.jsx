/* BottomSheet — generic slide-up modal used for filter / date / source panels.
   Drag handle, dim backdrop, content scrolls within. */

const BottomSheet = ({open, onClose, p, title, children, maxHeight='75%'}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:30,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'absolute', inset:0,
        background: p.name==='dark' ? 'rgba(0,0,0,.55)' : 'rgba(15,12,8,.45)',
        opacity: open ? 1 : 0,
        transition:'opacity .25s ease',
      }}/>
      {/* Sheet */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0,
        background: p.bg, color: p.ink,
        borderTopLeftRadius:24, borderTopRightRadius:24,
        boxShadow: '0 -20px 60px -20px rgba(0,0,0,.4)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition:'transform .32s cubic-bezier(.22,1,.36,1)',
        maxHeight, overflow:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex', justifyContent:'center', padding:'10px 0 4px'}}>
          <div style={{width:42, height:4, borderRadius:2, background:p.border}}/>
        </div>
        {title && (
          <div style={{padding:'4px 22px 14px', display:'flex',
              alignItems:'baseline', justifyContent:'space-between',
              borderBottom:`1px solid ${p.borderSoft}`}}>
            <div style={{fontFamily:'Playfair Display, Georgia, serif', fontWeight:700,
                fontSize:20, letterSpacing:'-0.01em', color:p.ink}}>{title}</div>
            <button onClick={onClose} style={{
              background:'none', border:'none', cursor:'pointer',
              color:p.mute, fontSize:13, fontWeight:600, letterSpacing:'.05em'
            }}>Close ✕</button>
          </div>
        )}
        <div style={{overflowY:'auto', padding:'18px 22px 24px'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

window.BottomSheet = BottomSheet;
