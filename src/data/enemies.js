// Enemy definitions: stats, AI move tables, Talk options, rewards.
// moves: [{ id, w }] weighted; phases override moves below hp fractions.
// talk options: { label, result: 'leave'|'calm'|'enrage'|'nothing', text, glimmer? }

export const ENEMIES = {
  moth: {
    id: 'moth', name: 'Sniffle-moth', img: 'en_moth', scale: 0.42,
    hp: 34, grit: 6, guard: 2, zip: 8,
    xp: 4, glimmer: 3,
    moves: [{ id: 'e_flutter', w: 3 }, { id: 'e_dustwing', w: 2 }],
    talk: [
      { label: 'Offer your light', result: 'leave', glimmer: 4, text: 'The moth settles on your finger, sneezes once, and drifts away content.' },
      { label: 'Shoo it', result: 'enrage', text: 'The moth takes it very personally.' },
      { label: 'Compliment its wings', result: 'calm', text: 'The moth blushes (somehow) and flutters slower.' },
    ],
    intro: 'A Sniffle-moth bumbles in, sneezing dust!',
  },
  dust: {
    id: 'dust', name: 'Dust Bunny', img: 'en_dust', scale: 0.42,
    hp: 44, grit: 5, guard: 4, zip: 4,
    xp: 4, glimmer: 3,
    moves: [{ id: 'e_bounce', w: 3 }, { id: 'e_fluff', w: 1 }, { id: 'e_dustwing', w: 1 }],
    talk: [
      { label: 'Sweep it gently', result: 'leave', glimmer: 4, text: 'It rolls itself neat and tucks under an imaginary bed, satisfied.' },
      { label: 'Threaten the vacuum', result: 'enrage', text: 'You have said the forbidden word.' },
      { label: 'Sneeze at it', result: 'nothing', text: 'It watches you sneeze. Rude, honestly.' },
    ],
    intro: 'A Dust Bunny rolls out from under… something.',
  },
  sock: {
    id: 'sock', name: 'Sock Golem', img: 'en_sock', scale: 0.5,
    hp: 72, grit: 8, guard: 6, zip: 3,
    xp: 8, glimmer: 5,
    moves: [{ id: 'e_slam', w: 3 }, { id: 'e_lint', w: 2 }],
    talk: [
      { label: 'Ask about its pair', result: 'leave', glimmer: 6, text: 'It freezes. Somewhere, a drawer opens. It shuffles off, hopeful.' },
      { label: 'Fold it', result: 'calm', text: 'It finds being folded deeply soothing.' },
      { label: 'Call it "lost laundry"', result: 'enrage', text: 'The Sock Golem has HAD IT with that phrase.' },
    ],
    intro: 'A Sock Golem assembles itself, one sock at a time!',
  },
  fogpup: {
    id: 'fogpup', name: 'Fog-pup', img: 'en_fogpup', scale: 0.45,
    hp: 62, grit: 10, guard: 3, zip: 9,
    xp: 8, glimmer: 5,
    moves: [{ id: 'e_nip', w: 3 }, { id: 'e_howl', w: 1 }],
    talk: [
      { label: 'Whistle for it', result: 'calm', text: 'It perks up! It almost remembers being somebody’s.' },
      { label: 'Play fetch with a button', result: 'leave', glimmer: 6, text: 'It chases the button into the mist, tail going like a metronome.' },
      { label: 'Growl back', result: 'enrage', text: 'Wrong language. Very wrong grammar.' },
    ],
    intro: 'A Fog-pup pads out of the white, nose first!',
  },
  whistler: {
    id: 'whistler', name: 'Whistler', img: 'en_whistler', scale: 0.48,
    hp: 70, grit: 10, guard: 4, zip: 7,
    xp: 12, glimmer: 8,
    moves: [{ id: 'e_static', w: 3 }, { id: 'e_tune', w: 1 }, { id: 'e_flutter', w: 1 }],
    talk: [
      { label: 'Hum the right tune', result: 'leave', glimmer: 9, text: 'The static catches your tune, holds it… and dissolves into it, satisfied.' },
      { label: 'Turn the dial', result: 'calm', text: 'You find a station made entirely of rain sounds. It likes that one.' },
      { label: 'Cover your ears', result: 'enrage', text: 'It plays LOUDER.' },
    ],
    intro: 'An old radio crackles awake. Something whistles inside it.',
  },
  unraveler: {
    id: 'unraveler', name: 'Unraveler', img: 'en_unraveler', scale: 0.52,
    hp: 96, grit: 11, guard: 5, zip: 6,
    xp: 14, glimmer: 9,
    moves: [{ id: 'e_pullthread', w: 3 }, { id: 'e_unpick', w: 2 }],
    talk: [
      { label: 'Hold the seam shut', result: 'calm', text: 'Its long fingers hesitate. It cannot unpick what is held.' },
      { label: 'Ask what it’s making', result: 'nothing', text: 'It looks at its hands. It isn’t making anything. It never was.' },
      { label: 'Offer a loose thread', result: 'enrage', text: 'You have given it an IDEA.' },
    ],
    intro: 'Something with too many fingers slips out of the seam…',
  },
  frame: {
    id: 'frame', name: 'Hollow Frame', img: 'en_frame', scale: 0.5,
    hp: 86, grit: 9, guard: 8, zip: 4,
    xp: 12, glimmer: 8,
    moves: [{ id: 'e_blankstare', w: 3 }, { id: 'e_slam', w: 1 }],
    talk: [
      { label: 'Describe who was inside', result: 'leave', glimmer: 9, text: 'The frame listens. For a moment, the canvas isn’t empty. It hangs itself back up, quiet.' },
      { label: 'Look away', result: 'nothing', text: 'You can feel it not-looking back.' },
      { label: 'Knock on the glass', result: 'enrage', text: 'The knock echoes on and on, somewhere it shouldn’t.' },
    ],
    intro: 'An empty picture frame drags itself upright.',
  },
  urchin: {
    id: 'urchin', name: 'Pincushion Urchin', img: 'en_urchin', scale: 0.44,
    hp: 66, grit: 11, guard: 7, zip: 5,
    xp: 10, glimmer: 6,
    thorns: 0.25,
    moves: [{ id: 'e_prick', w: 3 }, { id: 'e_fluff', w: 1 }],
    talk: [
      { label: 'Sort its pins by colour', result: 'leave', glimmer: 7, text: 'It is SO pleased. It has waited years for someone tidy.' },
      { label: 'Pat it (carefully)', result: 'nothing', text: 'You regret nothing. Your palm regrets everything.' },
      { label: 'Borrow a pin', result: 'enrage', text: 'It counts its pins CONSTANTLY. It noticed.' },
    ],
    intro: 'A Pincushion Urchin bristles at you!',
  },

  // ——— Bosses ———
  mothqueen: {
    id: 'mothqueen', name: 'The Moth Queen', img: 'en_mothqueen', scale: 0.65, boss: true,
    hp: 300, grit: 10, guard: 5, zip: 8,
    xp: 60, glimmer: 40,
    moves: [{ id: 'e_wingstorm', w: 2 }, { id: 'e_lullwind', w: 2 }, { id: 'e_dustcrown', w: 2 }, { id: 'e_brood', w: 1 }],
    phases: [{ below: 0.5, addMood: 'stormy', text: 'The Moth Queen’s wings beat a furious drum!' }],
    talk: [
      { label: 'Ask why she eats the light', result: 'nothing', text: '"Because it is going out anyway, dear. Better in someone’s belly than nowhere at all."' },
      { label: 'Say the orchard needs it', result: 'nothing', text: '"The orchard," she hums, "is already a memory of an orchard."' },
    ],
    intro: 'The Moth Queen descends on wings of grey velvet.',
  },
  tangle: {
    id: 'tangle', name: 'The Tangle', img: 'en_tangle', scale: 0.72, boss: true,
    hp: 460, grit: 11, guard: 6, zip: 5,
    xp: 90, glimmer: 60,
    moves: [{ id: 'e_knotfist', w: 3 }, { id: 'e_lash', w: 2 }, { id: 'e_snarl', w: 1 }],
    phases: [{ below: 0.4, frays: true, text: 'The Tangle FRAYS — wilder, looser, faster!' }],
    talk: [
      { label: 'Ask what it’s a knot of', result: 'nothing', text: '"every argument she never got to mend. pull ONE thread. i dare you."' },
      { label: 'Apologise to it', result: 'nothing', text: 'The knot stops. Somewhere deep inside it, something very small says "oh."' },
    ],
    intro: 'The sea pulls back. THE TANGLE rises, dripping knots.',
  },
  fog1: {
    id: 'fog1', name: 'THE FOG', img: 'en_fog1', scale: 0.72, boss: true,
    hp: 620, grit: 15, guard: 7, zip: 7,
    xp: 0, glimmer: 0,
    moves: [{ id: 'e_coldbreath', w: 3 }, { id: 'e_whiteout', w: 2 }, { id: 'e_hush', w: 2 }, { id: 'e_selfremind', w: 1 }],
    talk: [
      { label: 'Ask it to stop', result: 'nothing', text: '"I am not doing anything, love. I am only what stopping looks like."' },
      { label: 'Shout at it', result: 'nothing', text: 'Your shout comes back to you smaller, and without your name in it.' },
    ],
    intro: 'The lamp room is white. The white is looking at you.',
  },
  // phase 2 is scripted; numbers are irrelevant by design
  fog2: {
    id: 'fog2', name: 'THE FOG', img: 'en_fog2', scale: 0.78, boss: true, scripted: true,
    hp: 9999, grit: 10, guard: 99, zip: 1,
    xp: 0, glimmer: 0,
    moves: [{ id: 'e_coldbreath', w: 1 }],
    talk: [],
    intro: 'The Fog gathers itself into something almost like a person.',
  },
};

// Encounter tables used by maps (M3) and the balance sim.
export const ENCOUNTERS = {
  orchard_easy: ['moth'],
  orchard_pair: ['moth', 'dust'],
  orchard_mixed: ['moth', 'moth', 'dust'],
  orchard_sock: ['sock', 'dust'],
  orchard_boss: ['mothqueen'],
  sea_pup: ['fogpup'],
  sea_pair: ['fogpup', 'urchin'],
  sea_whistler: ['whistler', 'fogpup'],
  sea_boss: ['tangle'],
  white_unraveler: ['unraveler'],
  white_pair: ['frame', 'unraveler'],
  white_trio: ['frame', 'unraveler', 'whistler'],
  fog_p1: ['fog1'],
  fog_p2: ['fog2'],
};
