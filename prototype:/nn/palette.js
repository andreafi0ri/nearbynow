/* Nearby & Now palette + design tokens. Shared across all screens.
   Used by both light and dark modes — every screen calls PaletteFor(mode). */

window.PaletteFor = function(mode) {
  if (mode === 'dark') return {
    name:'dark',
    bg:'#0E0E10', bg2:'#161617', bg3:'#1A1815',
    surface:'#161617', surfaceRaised:'#1C1A16',
    border:'#2A2823', borderSoft:'#1F1E1C',
    ink:'#F4F4F6', soft:'#BFBCB1', mute:'#7E7B72', dim:'#525049',
    gold:'#E2C997', goldDeep:'#CE9C00', goldSoft:'#F0C96A', goldDim:'#8B6A00',
    btnBg:'#CE9C00', btnFg:'#1A1505',
    btnSecondaryBg:'transparent', btnSecondaryBorder:'#2A2823',
    cardBg:'#16140F', cardBorder:'#2A2823',
    red:'#FF6B5E', music:'#B49AFF', food:'#FFA866', news:'#FFC061', arts:'#FF85B8', sport:'#7BE0B8',
    mapStreets:'#1F1E1C', mapStreetsLine:'#2D2A24', mapBlocks:'#1A1815',
    mapWater:'#13151A', mapDots:'#1C1A16',
    haloOut:'rgba(206,156,0,0.16)', haloIn:'rgba(206,156,0,0.34)',
  };
  return {
    name:'light',
    bg:'#FAF7F3', bg2:'#F2EDE3', bg3:'#E9E2D2',
    surface:'#FFFFFF', surfaceRaised:'#FFFFFF',
    border:'#E5DECF', borderSoft:'#EFE9DA',
    ink:'#111111', soft:'#3a3633', mute:'#7d786d', dim:'#a8a298',
    gold:'#B8920A', goldDeep:'#B8920A', goldSoft:'#E2C997', goldDim:'#CFB55C',
    btnBg:'#111111', btnFg:'#FAF7F3',
    btnSecondaryBg:'transparent', btnSecondaryBorder:'#E5DECF',
    cardBg:'#FFFFFF', cardBorder:'#EFE9DA',
    red:'#E0392A', music:'#7B5BD8', food:'#E07A2A', news:'#C77B00', arts:'#D63A7E', sport:'#1F8A5B',
    mapStreets:'#D7CFBE', mapStreetsLine:'#C6BDA8', mapBlocks:'#E7DFC9',
    mapWater:'#DDE6EC', mapDots:'#D7CFBE',
    haloOut:'rgba(184,146,10,0.15)', haloIn:'rgba(184,146,10,0.32)',
  };
};
