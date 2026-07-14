// Skill definitions for party and enemies.
// target: 'enemy' | 'ally' | 'self' | 'allEnemies' | 'allAllies' | 'downedAlly'
// Effects are interpreted by battle_logic.resolveSkill.

export const SKILLS = {
  // ——— Poppy ———
  sunbeam: {
    name: 'Sunbeam', ink: 3, target: 'enemy', mult: 0.9,
    selfMood: 'sunny',
    desc: 'A warm ray. Poppy feels SUNNY.',
    flavor: '{a} cups her hands around something bright!',
  },
  peptalk: {
    name: 'Pep Talk', ink: 2, target: 'ally', mood: 'sunny',
    desc: 'Cheer someone up: they turn SUNNY.',
    flavor: '{a} says exactly the right thing.',
  },
  brightside: {
    name: 'Bright Side', ink: 4, target: 'ally', heal: 0.32, cureFade: 1,
    desc: 'Heal an ally and stitch back a faded memory.',
    flavor: '{a} points out the bright side.',
  },
  lullaby: {
    name: 'The Lullaby', ink: 0, target: 'allEnemies', mood: 'misty', mult: 0,
    desc: 'The oldest, strongest stitch.',
    flavor: '{a} hums, small and clear, into the white…',
  },

  // ——— Buttons ———
  pounce: {
    name: 'Pounce', ink: 3, target: 'enemy', mult: 1.35,
    selfMood: 'stormy',
    desc: 'A big dramatic leap. Buttons gets STORMY.',
    flavor: '{a} wiggles… wiggles… POUNCES!',
  },
  yarnwhip: {
    name: 'Yarn Whip', ink: 4, target: 'enemy', mult: 1.0, clearTargetMood: true,
    desc: 'Damage and tangle away the target’s mood.',
    flavor: '{a} lashes a loose thread like a whip!',
  },
  purr: {
    name: 'Purr', ink: 3, target: 'ally', heal: 0.26, mood: 'misty',
    desc: 'A rumbly purr. Heals and calms an ally to MISTY.',
    flavor: '{a} curls up close, rumbling like weather.',
  },
  clawstorm: {
    name: 'Claw Storm', ink: 5, target: 'enemy', mult: 1.7, selfMoodClear: true,
    desc: 'Everything Buttons has. Very rude.',
    flavor: '{a} becomes a small furious cloud of claws!',
  },

  // ——— The Captain ———
  squall: {
    name: 'Squall', ink: 4, target: 'allEnemies', mult: 0.8, selfMood: 'stormy',
    desc: 'A gust across all enemies. The Captain turns STORMY.',
    flavor: '{a} whistles up a squall!',
  },
  steady: {
    name: 'Steady', ink: 3, target: 'ally', cureFade: 3, mood: 'misty',
    desc: 'Cure all FADE on an ally; they turn MISTY.',
    flavor: '"Steady now," says {a}. "I’ve got you."',
  },
  lanternoil: {
    name: 'Lantern Oil', ink: 2, target: 'ally', giveInk: 6,
    desc: 'Refill an ally’s Ink.',
    flavor: '{a} tops up the little lamp.',
  },
  foghorn: {
    name: 'Foghorn', ink: 5, target: 'enemy', mult: 1.5, clearTargetMood: true,
    desc: 'Heavy blast; blows the target’s mood away.',
    flavor: '{a} sounds the horn. The air shivers.',
  },

  // ——— Enemy moves ———
  e_flutter: { name: 'Flutter', target: 'enemy', mult: 1.0, flavor: '{a} flutters right in your face!' },
  e_dustwing: { name: 'Dust Wing', target: 'enemy', mult: 0.6, fade: 0.45, flavor: '{a} sheds a puff of grey dust…' },
  e_bounce: { name: 'Bounce', target: 'enemy', mult: 0.95, flavor: '{a} bounces off someone’s head!' },
  e_fluff: { name: 'Fluff Up', target: 'self', mood: 'misty', flavor: '{a} fluffs itself into a calm little cloud.' },
  e_slam: { name: 'Slam', target: 'enemy', mult: 1.25, flavor: '{a} flops down HARD.' },
  e_lint: { name: 'Lint Spray', target: 'enemy', mult: 0.4, fade: 0.5, flavor: '{a} sprays itchy lint everywhere!' },
  e_nip: { name: 'Nip', target: 'enemy', mult: 1.1, flavor: '{a} nips at your heels!' },
  e_howl: { name: 'Howl', target: 'allEnemies', mult: 0.3, fade: 0.3, flavor: '{a} howls a long, grey note…' },
  e_static: { name: 'Static Whine', target: 'enemy', mult: 0.9, fade: 0.55, flavor: '{a} crackles an awful whine!' },
  e_tune: { name: 'Wrong Tune', target: 'self', mood: 'stormy', flavor: '{a} plays the song… wrong. On purpose.' },
  e_pullthread: { name: 'Pull Thread', target: 'enemy', mult: 1.15, fade: 0.5, flavor: '{a} finds a loose thread and PULLS.' },
  e_unpick: { name: 'Unpick', target: 'enemy', mult: 1.1, bonusVsFade: 0.6, flavor: '{a} unpicks the seam, stitch by stitch…' },
  e_blankstare: { name: 'Blank Stare', target: 'enemy', mult: 0.8, clearTargetMood: true, flavor: '{a} stares. There is nothing behind it.' },
  e_prick: { name: 'Prick', target: 'enemy', mult: 1.0, flavor: '{a} jabs with a hundred pins!' },

  // boss moves
  e_wingstorm: { name: 'Wing Storm', target: 'allEnemies', mult: 0.8, flavor: 'The air fills with beating wings!' },
  e_lullwind: { name: 'Lull Wind', target: 'enemy', mood: 'misty', mult: 0.5, flavor: 'A slow wind that makes your eyes heavy…' },
  e_dustcrown: { name: 'Dust Crown', target: 'allEnemies', mult: 0.35, fade: 0.35, flavor: 'Her crown sheds a halo of forgetting-dust.' },
  e_brood: { name: 'Brood Call', target: 'self', summon: 'moth', flavor: 'She calls her little ones home.' },
  e_knotfist: { name: 'Knot Fist', target: 'enemy', mult: 1.35, flavor: 'A fist of knots swings down!' },
  e_snarl: { name: 'Snarl', target: 'self', mood: 'stormy', flavor: 'The Tangle pulls itself tighter and tighter.' },
  e_lash: { name: 'Thread Lash', target: 'allEnemies', mult: 0.85, flavor: 'Loose ends whip across everyone!' },
  e_coldbreath: { name: 'Cold Breath', target: 'allEnemies', mult: 1.0, flavor: 'The Fog breathes in. The colour goes out.' },
  e_whiteout: { name: 'White-out', target: 'allEnemies', mult: 0.2, fade: 0.65, flavor: 'Everything, everywhere, goes quiet and white.' },
  e_hush: { name: 'Hush', target: 'enemy', mult: 0.7, fade: 1.0, flavor: '"Hush now," says a voice you know.' },
  e_selfremind: { name: 'Remembers Itself', target: 'self', healFlat: 70, flavor: 'The Fog remembers itself whole.' },
};
