/* Sample data — Nashville, the same content shown in the user's existing screenshots,
   plus a few extras so the feed feels alive. */

window.NN_DATA = {
  area: { name: 'Nashville, Tennessee', short: 'Nashville', radius: 9.9, lat: 36.16, lon: -86.78 },

  // Top filter row (status of each chip — active flags, etc.)
  primaryFilters: [
    { id: 'date',    emoji: '📅', label: 'Date',    active: true,  bordered: true },
    { id: 'sources', emoji: '▾',  label: 'Sources', dropdown: true },
    { id: 'all',     emoji: '✦',  label: 'All',     primary: true, active: true },
    { id: 'free',    emoji: '🆓', label: 'Free' },
  ],
  // Category row
  categories: [
    { id: 'nearby',    emoji: '📍', label: 'Nearby',     tone: 'red'   },
    { id: 'today',     emoji: '📅', label: 'Today',      tone: 'news'  },
    { id: 'events',    emoji: '💌', label: 'Events',     tone: 'red'   },
    { id: 'food',      emoji: '🍽', label: 'Food & Drink', tone:'food' },
    { id: 'music',     emoji: '🎸', label: 'Music',      tone: 'music' },
    { id: 'culture',   emoji: '🎭', label: 'Culture',    tone: 'arts'  },
    { id: 'arts',      emoji: '🎨', label: 'Arts',       tone: 'arts'  },
    { id: 'sport',     emoji: '🏃', label: 'Sport',      tone: 'sport' },
    { id: 'community', emoji: '🤝', label: 'Community',  tone: 'red'   },
    { id: 'outdoors',  emoji: '🌳', label: 'Outdoors',   tone: 'sport' },
    { id: 'cinema',    emoji: '🎬', label: 'Cinema',     tone: 'news'  },
  ],

  feed: [
    {
      id: 1, cat: 'COMMUNITY', tone: 'red', emoji: '📣',
      title: "Shout-out to the bananas at the Electric Callboy show",
      body: 'https://v.redd.it/ag5qo6ixvc2h1',
      time: '1d ago', date: '05/20/26', loc: 'Nashville',
      source: 'r/nashville', saves: 22, action: 'View on Reddit',
    },
    {
      id: 2, cat: 'COMMUNITY', tone: 'red', emoji: '📣',
      title: "HELP NEEDED Looking for info about neo-Confederate groups holding events this Memorial weekend.",
      body: "I recently found out my brother is part of a neo-Confederate group and he just told our mother we can't visit this weekend because he's \"going to an event in Nashville for an activist group.\" This genius has a spouse and an infant child and he",
      time: '1d ago', date: '05/21/26', loc: 'Nashville',
      source: 'r/nashville', saves: 154, action: 'View →',
    },
    {
      id: 3, cat: 'COMMUNITY', tone: 'red', emoji: '📣',
      title: "Who is going to see Rickshaw Billie's Burger Patrol at the Blue Room this Saturday?",
      time: '18h ago', date: '05/21/26', loc: 'East Nashville',
      source: 'r/nashville', saves: 41, action: 'View →',
    },
    {
      id: 4, cat: 'MUSIC', tone: 'music', emoji: '🎵',
      title: "WMOT Finally Friday — Lynne Hanson, The Resentments",
      time: 'Fri', date: '12:00 PM', loc: 'Music City Roots',
      source: 'WMOT.org', saves: 8, action: 'Details →',
    },
    {
      id: 5, cat: 'MUSIC', tone: 'music', emoji: '🎵',
      title: "In The Round with David Seger, Jeremy Bussey, Jet Hannah",
      time: 'Fri', date: '6:00 PM', loc: 'The Bluebird Cafe',
      source: 'BluebirdCafe.com', saves: 14, action: 'RSVP →',
    },
    {
      id: 6, cat: 'MUSIC', tone: 'music', emoji: '🎵',
      title: "Frail Talk & Emily Hines",
      time: 'Fri', date: '7:00 PM', loc: 'The Blue Room',
      source: 'Songkick', saves: 26, action: 'Tickets →',
    },
    {
      id: 7, cat: 'FOOD & DRINK', tone: 'food', emoji: '🍽',
      title: "Harpeth River cleanup volunteers — coffee from Barista Parlor",
      time: '2h ago', date: '05/22/26', loc: 'Shelby Park',
      source: 'Nashville Scene', saves: 9, action: 'Sign up →',
    },
  ],

  pinned: [
    {id:1, x: 200, y: 290, emoji: '🎵', tone: 'music', size: 'lg'},
    {id:2, x: 185, y: 360, emoji: '🎵', tone: 'music'},
    {id:3, x: 295, y: 360, emoji: '🍽', tone: 'food'},
    {id:4, x: 65, y: 415, emoji: '🎵', tone: 'music'},
    {id:5, x: 215, y: 430, emoji: '🎬', tone: 'news'},
    {id:6, x: 250, y: 455, emoji: '🍽', tone: 'food', size: 'lg'},
    {id:7, x: 215, y: 470, emoji: '🍽', tone: 'food', size: 'lg'},
    {id:8, x: 305, y: 480, emoji: '🍽', tone: 'food'},
    {id:9, x: 130, y: 478, emoji: '🍽', tone: 'food'},
    {id:10, x: 100, y: 515, emoji: '🍽', tone: 'food'},
    {id:11, x: 175, y: 530, emoji: '🍽', tone: 'food'},
    {id:12, x: 320, y: 530, emoji: '🎵', tone: 'music'},
  ],

  user: { name: 'andrea', email: 'andrea.fioriniello@gmail.com', avatar: '🙂' },
  areas: [ { name: 'Nashville, Tennessee', active: true } ],
};
