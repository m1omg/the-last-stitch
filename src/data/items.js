// Items ("Stitches" in the menu), charms, and key items.

export const ITEMS = {
  biscuit: {
    name: 'Ginger Biscuit', price: 6, heal: 20,
    desc: 'Nana’s recipe. Slightly burnt on one edge, like always.',
    use: 'crunch — warmth spreads from the middle outward.',
  },
  tea: {
    name: 'Thimble of Tea', price: 12, heal: 32, cureFade: 1,
    desc: 'Chamomile, in a thimble. Steam curls like handwriting.',
    use: 'sip — the edges of things come back into focus.',
  },
  honeydrop: {
    name: 'Honey Drop', price: 10, giveInk: 8,
    desc: 'A sticky amber bead from the Orchard. Hums faintly.',
    use: 'the hum settles behind the ribs. Ink refilled.',
  },
  buttonshine: {
    name: 'Button Polish', price: 14, cureFade: 3,
    desc: 'For when someone’s going grey around the edges.',
    use: 'polish, polish — there you are again.',
  },
  warmsock: {
    name: 'Warm Sock', price: 25, revive: 0.5,
    desc: 'Fresh off the radiator. Impossibly comforting.',
    use: 'a warmth that argues, convincingly, for continuing.',
  },
  jamtoast: {
    name: 'Jam Soldiers', price: 18, healAll: 15,
    desc: 'Toast cut into soldiers. They stand at attention.',
    use: 'everyone takes one. Everyone feels braver.',
  },

  // key items (not usable in battle)
  thread_sun: { name: 'Sun Thread', key: true, desc: 'A warm gold strand. It remembers every picnic at once.' },
  thread_storm: { name: 'Storm Thread', key: true, desc: 'A blue-black strand, still crackling with an old argument.' },
  thread_mist: { name: 'Mist Thread', key: true, desc: 'A pale strand, soft as breath on a window.' },
  lamp_letter: { name: 'The Unsent Letter', key: true, desc: 'Folded into a paper hat for a very long time.' },
};

export const CHARMS = {
  charm_thimble: { name: 'Tin Thimble', price: 30, guard: 2, desc: 'A little armour for one fingertip’s worth of courage.' },
  charm_ribbon: { name: 'Race-day Ribbon', price: 30, zip: 2, desc: 'Whoever wears it walks a little quicker.' },
  charm_acorn: { name: 'Iron Acorn', price: 30, grit: 2, desc: 'Heavier than it looks. So are you.' },
  charm_locket: { name: 'Fog Locket', price: 45, fadeResist: 0.5, desc: 'Keeps a face inside where the fog can’t touch it.' },
  charm_teacosy: { name: 'Tea Cosy Hat', price: 40, healBoost: 1.5, desc: 'Ridiculous. Warm. Healing works half again as well.' },
};
