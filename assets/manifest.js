// Master asset manifest. [path, placeholderW, placeholderH]
// Every key renders as a procedural placeholder until its file exists,
// so the full game runs before art generation.

const M = (n) => [`assets/img/maps/${n}.png`, 1536, 1024];
const B = (n) => [`assets/img/battle/${n}.png`, 1536, 1024];
const C = (n) => [`assets/img/cutscenes/${n}.png`, 1536, 1024];
const S = (n, w = 220, h = 220) => [`assets/img/sprites/${n}.png`, w, h];
const P = (n) => [`assets/img/portraits/${n}.png`, 512, 512];
const E = (n, s = 480) => [`assets/img/enemies/${n}.png`, s, s];

export const IMAGES = {
  // map backdrops (camera-scrolled paintings)
  map_cottage: M('map_cottage'),
  map_cottage_morning: M('map_cottage_morning'),
  map_harbor: M('map_harbor'),
  map_orchard: M('map_orchard'),
  map_sea: M('map_sea'),
  map_whiterooms: M('map_whiterooms'),
  map_lighthouse: M('map_lighthouse'),

  // battle backdrops
  bbg_orchard: B('bbg_orchard'),
  bbg_sea: B('bbg_sea'),
  bbg_white: B('bbg_white'),
  bbg_fog: B('bbg_fog'),

  // party overworld sprites (front/back/side; side is mirrored in code)
  spr_poppy_front: S('spr_poppy_front'), spr_poppy_back: S('spr_poppy_back'), spr_poppy_side: S('spr_poppy_side'),
  spr_buttons_front: S('spr_buttons_front'), spr_buttons_back: S('spr_buttons_back'), spr_buttons_side: S('spr_buttons_side'),
  spr_captain_front: S('spr_captain_front'), spr_captain_back: S('spr_captain_back'), spr_captain_side: S('spr_captain_side'),

  // NPCs & props
  spr_mum: S('spr_mum'),
  spr_nana: S('spr_nana', 260, 260),          // in her armchair
  spr_thimble: S('spr_thimble'),              // Mrs. Thimble, button-folk baker
  spr_folk_a: S('spr_folk_a'),
  spr_folk_b: S('spr_folk_b'),
  spr_postmoth: S('spr_postmoth'),
  spr_hollow: S('spr_hollow'),                // hollow-folk, button eyes missing
  spr_coat: S('spr_coat', 240, 260),          // Grandpa Ted's empty coat at the table
  spr_boat: S('spr_boat', 300, 220),          // paper boat
  spr_savequilt: S('spr_savequilt', 220, 160),

  // battle sprites (party, seen from behind-ish / three-quarter)

  // portraits
  por_poppy_neutral: P('por_poppy_neutral'), por_poppy_happy: P('por_poppy_happy'),
  por_poppy_sad: P('por_poppy_sad'), por_poppy_scared: P('por_poppy_scared'),
  por_buttons_neutral: P('por_buttons_neutral'), por_buttons_smug: P('por_buttons_smug'), por_buttons_sad: P('por_buttons_sad'),
  por_captain_neutral: P('por_captain_neutral'), por_captain_stern: P('por_captain_stern'), por_captain_soft: P('por_captain_soft'),
  por_nana_warm: P('por_nana_warm'), por_nana_lost: P('por_nana_lost'),
  por_mum: P('por_mum'),

  // enemies
  en_moth: E('en_moth'), en_dust: E('en_dust'), en_sock: E('en_sock'),
  en_fogpup: E('en_fogpup'), en_whistler: E('en_whistler'), en_unraveler: E('en_unraveler'),
  en_frame: E('en_frame'), en_urchin: E('en_urchin'),
  en_mothqueen: E('en_mothqueen', 640), en_tangle: E('en_tangle', 640),
  en_fog1: E('en_fog1', 640), en_fog2: E('en_fog2', 700),

  // full-screen stills
  cut_title: C('cut_title'),
  cut_quilt: C('cut_quilt'),
  cut_coat: C('cut_coat'),
  cut_photowall: C('cut_photowall'),
  cut_unravel: C('cut_unravel'),
  cut_lamp: C('cut_lamp'),
  cut_ending: C('cut_ending'),
  cut_gameover: C('cut_gameover'),
};

export const MUSIC = [
  'mus_title', 'mus_cottage', 'mus_harbor', 'mus_orchard', 'mus_sea',
  'mus_white', 'mus_battle', 'mus_boss', 'mus_fog', 'mus_ending', 'mus_gameover',
];

export const SFX = [
  'sfx_blip1', 'sfx_blip2', 'sfx_blip3', 'sfx_blip4',
  'sfx_ok', 'sfx_cancel', 'sfx_move',
  'sfx_hit', 'sfx_heal', 'sfx_fade', 'sfx_remind', 'sfx_flutter',
  'sfx_static', 'sfx_lamp', 'sfx_save', 'sfx_battlestart', 'sfx_unravel',
  'sfx_levelup', 'sfx_item', 'sfx_talk', 'sfx_waves',
];
