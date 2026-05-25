/* Nearby & Now — custom mono-line icon set.
   1.6px stroke, round caps, geometric. Designed to feel editorial — matches
   the Playfair italic ampersand language. Each icon is 24×24 viewBox. */

const _ico = (path, extra={}) => (size=18, c='currentColor', sw=1.6) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...extra}>
    <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {path}
    </g>
  </svg>
);

// Each icon is a fn(size, color, strokeWidth) -> React element.
const NN_ICONS = {
  // EVENTS — ticket with perforated middle
  events: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 8 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v1.5 a2 2 0 0 0 0 4 V15 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-1.5 a2 2 0 0 0 0-4 z"
        stroke={c} strokeWidth={sw} fill="none" strokeLinejoin="round"/>
      <path d="M12 8.5 v1.5 M12 11 v1.5 M12 13.5 v1.5"
        stroke={c} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  ),

  // MUSIC — eighth note
  music: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 17.5 a2.5 2 0 1 0 4 0 a2.5 2 0 1 0 -4 0 Z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill={c}/>
      <path d="M13 17.5 V6 L18 5 V8 L 13 9" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),

  // FOOD & DRINK — wine glass + fork (left/right)
  food: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M5 4 V8 M5 8 c 0 2 2 4 4 4 v 7 M9 19 H 5 M7 4 v4"/>
        <path d="M13 4 h6 a 0 0 0 0 1 0 0 v5 a3 3 0 0 1 -6 0 V4 z M16 12 v7 M14 19 h4"/>
      </g>
    </svg>
  ),

  // ARTS — 4-point star / brush stroke
  arts: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 L 13.5 10.5 L 21 12 L 13.5 13.5 L 12 21 L 10.5 13.5 L 3 12 L 10.5 10.5 Z"
        stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none"/>
    </svg>
  ),

  // COMMUNITY — two people heads + shoulders
  community: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="8" cy="9" r="2.6"/>
        <circle cx="16" cy="9" r="2.6"/>
        <path d="M3 19 a5 5 0 0 1 10 0"/>
        <path d="M11 19 a5 5 0 0 1 10 0"/>
      </g>
    </svg>
  ),

  // OUTDOORS — mountain peaks
  outdoors: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M3 19 L 9 9 L 13 15 L 16 11 L 21 19 Z"/>
        <circle cx="17" cy="6" r="1.6"/>
      </g>
    </svg>
  ),

  // CINEMA — clapper board
  cinema: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3" y="9" width="18" height="12" rx="1.5"/>
        <path d="M3 9 L 21 6 M 8 9 L 11 6 M 13 8.5 L 16 5.5 M 18 8 L 21 5"/>
      </g>
    </svg>
  ),

  // SPORT — figure running
  sport: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="14.5" cy="4.5" r="1.8"/>
        <path d="M13 8 L 9 11 L 11 14 L 9 19"/>
        <path d="M11 14 L 16 13 L 18 17"/>
        <path d="M9 11 L 5 11"/>
      </g>
    </svg>
  ),

  // NEWS — newspaper
  news: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3" y="5" width="14" height="15" rx="1.5"/>
        <path d="M17 9 h3 a1 1 0 0 1 1 1 v8 a2 2 0 0 1 -4 0 V9"/>
        <path d="M6 9 h8 M6 12 h8 M6 15 h5"/>
      </g>
    </svg>
  ),

  // CULTURE — theater masks / temple
  culture: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M3 21 V 11 L 12 4 L 21 11 V 21 Z"/>
        <path d="M9 21 V 14 H 15 V 21"/>
        <circle cx="12" cy="10" r="0.5" fill={c}/>
      </g>
    </svg>
  ),

  // FREE — price tag
  free: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M3 12.5 V 4 H 11.5 L 21 13.5 L 13.5 21 L 4 11.5"/>
        <circle cx="7.5" cy="7.5" r="1.3"/>
      </g>
    </svg>
  ),

  // TODAY — calendar
  today: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3" y="6" width="18" height="15" rx="2"/>
        <path d="M3 11 H 21"/>
        <path d="M8 3 V 7 M 16 3 V 7"/>
        <rect x="9" y="14" width="3" height="3" rx="0.5" fill={c}/>
      </g>
    </svg>
  ),

  // NEARBY — pin
  nearby: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 21 s 7-6 7-12 a 7 7 0 1 0 -14 0 c 0 6 7 12 7 12 Z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </g>
    </svg>
  ),

  // DATE — calendar with check
  date: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="3" y="6" width="18" height="15" rx="2"/>
        <path d="M3 11 H 21"/>
        <path d="M8 3 V 7 M 16 3 V 7"/>
        <path d="M8 16 L 11 19 L 16 13"/>
      </g>
    </svg>
  ),

  // SOURCES — stacked layers
  sources: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 3 L 21 8 L 12 13 L 3 8 Z"/>
        <path d="M3 12 L 12 17 L 21 12"/>
        <path d="M3 16 L 12 21 L 21 16"/>
      </g>
    </svg>
  ),

  // FILTERS — sliders
  filters: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M5 7 H 14 M 19 7 H 20"/>
        <circle cx="16" cy="7" r="2.2"/>
        <path d="M5 17 H 9 M 14 17 H 20"/>
        <circle cx="11" cy="17" r="2.2"/>
      </g>
    </svg>
  ),

  // MEGAPHONE — community card category badge
  megaphone: (size=18, c='currentColor', sw=1.6) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M5 9 v 6 a 1 1 0 0 0 1 1 h 2 L 16 21 V 3 L 8 8 H 6 a 1 1 0 0 0-1 1 Z"/>
        <path d="M19 9 a 4 4 0 0 1 0 6"/>
        <path d="M8 16 V 8"/>
      </g>
    </svg>
  ),
};

const CategoryIcon = ({id, size=18, c='currentColor', sw=1.6, useEmoji=false}) => {
  if (useEmoji) {
    const EMOJI = {
      events:'💌', music:'🎸', food:'🍽', arts:'🎨', community:'🤝',
      outdoors:'🌳', cinema:'🎬', sport:'🏃', news:'📰', culture:'🎭',
      free:'🆓', today:'📅', nearby:'📍', date:'📅', sources:'▾',
      filters:'☰', megaphone:'📣',
    };
    return <span style={{fontSize:size, lineHeight:1}}>{EMOJI[id] || '·'}</span>;
  }
  const fn = NN_ICONS[id];
  return fn ? fn(size, c, sw) : null;
};

Object.assign(window, { NN_ICONS, CategoryIcon });
