// All story content: dialogue, cutscenes, reveals, boss sequences.
//
// Each entry is a function (ctx) => steps[]. Steps are either Dialogue steps
// (strings / {who,face,text} / {choices} / {do} / {if}) or StoryRunner
// commands: {battle}, {still}, {goto}, {theme}, {ending}, {credits}, {wait}…
// ctx = { G, game, scene } — scene is the OverworldScene running the story.

import { makeMember } from './party.js';

export const STORY = {
  // ═══════════ REAL WORLD — NIGHT ═══════════

  intro: ({ G }) => [
    { music: null },
    {
      still: 'cut_quilt', lines: [
        'Winter came to the little cottage by the sea the way it always did: all at once, and smelling of salt.',
        'Poppy had been to Nana Ivy’s a hundred times. A hundred summers stacked like pancakes.',
        'But this visit felt different, in a way nobody would explain to her.',
      ],
    },
    { music: 'mus_cottage' },
    { who: 'mum', text: 'Here we are, sweetheart. Go say hello while I bring the bags in.' },
    { who: 'nana', face: 'warm', text: 'Oh! Oh, look at you. Come in out of the cold, come in—' },
    { who: 'nana', face: 'warm', text: '—Rosie, love, you’ve gotten so small!' },
    { who: 'poppy', face: 'sad', text: '…It’s Poppy, Nana. Rosie is my mum.' },
    { who: 'nana', face: 'lost', text: '…Of course it is. Of course. Poppy. My little poppy-flower.' },
    'Mum smiled the way grown-ups smile when nothing is funny.',
    { do: ({ G }) => { G.setFlag('intro_done'); } },
    'Talk to everyone, if you like. The bed is made up for you when you’re ready to sleep.',
  ],

  mum_night: ({ G }) => [
    { who: 'mum', text: G.flag('asked_mum')
      ? 'Get some sleep soon, alright? Big day of sea air tomorrow.'
      : 'Nana’s just tired, Poppy. Old people get… foggy, sometimes. Like a radio between stations.' },
    { do: ({ G }) => G.setFlag('asked_mum') },
  ],

  nana_night: ({ G }) => [
    { who: 'nana', face: 'warm', text: 'Sit with me a moment. The radio only plays the good songs after dark.' },
    { who: 'nana', face: 'warm', text: 'I used to sing this one to your mum. And to you, when you were a bean.' },
    { who: 'nana', face: 'lost', text: 'Hmm… how did the middle go? It had a middle. I’m sure it had a middle.' },
    { who: 'poppy', face: 'sad', text: '(She hummed it a hundred times. How do you lose a song?)' },
  ],

  radio: () => [
    { sfx: 'sfx_static' },
    'The radio hums an old waltz through the static. Nana’s slippered foot taps along — one, two, three. One, two, three.',
  ],

  photo_shelf: () => [
    'A little shelf of photographs above the window. Nana young on a boat, laughing, Grandpa Ted’s coat around her shoulders.',
    'Poppy is in the newest one — gap-toothed, holding a sandcastle bucket. It is two summers old. There isn’t a newer one.',
  ],

  mantel: () => [
    'On the mantel: a candle, a little wooden boat, and small paintings of the sea.',
    { who: 'poppy', text: '(Nana says the sea never sits still long enough for a photograph. So Grandpa Ted used to paint it for her instead.)' },
  ],

  front_door: () => [
    'The front door, and the whole dark sea behind it. It is loud tonight, like a neighbour with the telly up.',
    { who: 'poppy', text: '(Long past bedtime. The morning can let itself in.)' },
  ],

  front_door_morning: () => [
    'Sea air slips under the front door, cold and clean. Mum’s boots are already waiting by the mat.',
  ],

  kitchen_look: () => [
    'The kettle is still warm. Two cups are draining on the rack — one is the chipped one Nana pretends she doesn’t favour.',
  ],

  dresser_look: () => [
    'Nana’s green dresser. The bottom drawer has been “Poppy’s drawer” since before she could walk.',
    'Inside: spare socks, a shell, and one extremely historical biscuit.',
  ],

  quilt_look: () => [
    'Nana’s patchwork quilt. Every square is a story: a sail, an apple tree, a lighthouse with a yellow window.',
    'The lighthouse square is coming unstitched.',
  ],

  bed: ({ G }) => [
    {
      who: 'poppy', text: 'The bed is warm and smells of lavender. Buttons is already on the pillow, guarding it badly.',
      choices: [{ label: 'Sleep', value: 'sleep' }, { label: 'Not yet', value: 'stay' }],
    },
    {
      if: (c) => c.choice === 'sleep',
      then: [
        { do: ({ G }) => G.setFlag('slept') },
        { music: null },
        'Poppy pulls the quilt up to her nose. Across the room, the radio slips softly between stations.',
        'The dark comes in like a tide. And somewhere in it — one, two, three. One, two, three…',
        { goto: { map: 'harbor', fade: 2.2 } },
      ],
      else: ['Not yet. There are corners of the evening left to check.'],
    },
  ],

  // ═══════════ THE PATCHWORK — HARBOUR ═══════════

  harbor_first: ({ G }) => [
    { wait: 0.6 },
    'Poppy wakes on a pile of rope that is also, somehow, a pile of wool.',
    'The sky is stitched. The sea is a quilt. The moon is a mother-of-pearl button, slightly loose.',
    { who: 'buttons', face: 'smug', text: 'Finally. I’ve been awake for HOURS. Minutes. Some amount of time.' },
    { who: 'poppy', face: 'scared', text: 'BUTTONS?! You’re— you’re walking! And talking!' },
    { who: 'buttons', face: 'smug', text: 'I’ve always been able to. You’ve simply never listened properly before.' },
    { who: 'buttons', face: 'neutral', text: 'Welcome to the Patchwork. Nana made it. Out of everything, as far as I can tell.' },
    { who: 'buttons', face: 'sad', text: '…You should see the harbour, Poppy. While there’s harbour to see.' },
    {
      do: ({ G }) => {
        G.setFlag('met_buttons');
        const b = G.party.find(m => m.id === 'buttons');
        if (b) b.inParty = true; // off the pillow, into the party
      },
    },
  ],

  captain_harbor: ({ G }) => {
    if (!G.flag('orchard_done')) {
      return [
        { who: 'captain', face: 'stern', text: 'Mind the doorstep. It’s dark in there, and dark things are rude about queueing.' },
        { who: 'poppy', text: 'Are you the lighthouse keeper? The lighthouse is… off.' },
        { who: 'captain', face: 'stern', text: 'Aye. The lamp wants three Bright Threads — Sun, Storm and Mist. Wound together, they hold any weather.' },
        { who: 'captain', face: 'neutral', text: 'The Fog took them. Scattered them. Sun’s in the Orchard, east gate. Start there.' },
        { who: 'captain', face: 'soft', text: 'And take the cat. He’s all yarn and yowl, but he’s double-stitched where it counts.' },
        { do: ({ G }) => G.setFlag('quest_started') },
      ];
    }
    return [{ who: 'captain', face: 'neutral', text: 'Sea next, little one. The Storm Thread sulks out on the water.' }];
  },

  captain_joins: ({ G }) => [
    { who: 'captain', face: 'soft', text: 'You came back. With the Sun Thread AND both ears. Better than my first voyage.' },
    { who: 'buttons', face: 'smug', text: 'I supervised.' },
    { who: 'captain', face: 'stern', text: 'The Storm Thread’s out on the Quilted Sea. You’ll want a boat, and someone who can whistle one up.' },
    { who: 'captain', face: 'neutral', text: '…That’s me. I’m coming. Somebody has to hold the lantern steady.' },
    {
      do: ({ G }) => {
        const avg = Math.round(G.party.reduce((a, m) => a + m.level, 0) / G.party.length);
        const cap = makeMember('captain', Math.max(1, avg));
        G.party.push(cap);
        G.setFlag('captain_joined');
      },
    },
    { sfx: 'sfx_levelup' },
    'THE CAPTAIN joined the party! The pier to the Quilted Sea is open.',
  ],

  folk_a: ({ G }) => [
    { who: 'folk', text: G.flag('orchard_done')
      ? 'Old Spool went quiet last week. Stands by the north wall now. We put his scarf on him. He didn’t say anything.'
      : 'Fog’s been eating the edges of town. Mrs. Darn went out past the buoys and came back… blank.' },
  ],

  folk_b: () => [
    { who: 'folk', text: 'Most of the fog-things aren’t wicked, dear. They’re just lost. Try TALKING before you swing.' },
    { who: 'folk', text: 'The moths only ever wanted a bit of light. The dust bunnies want sweeping, but GENTLY.' },
  ],

  postmoth: ({ G }) => [
    { who: 'postmoth', text: 'Post! Post for— hm. Hmm. No. The addresses keep going white.' },
    { who: 'postmoth', text: 'I’ve a whole bag of letters for people I can’t find. I deliver them to the sea now. The sea remembers everyone.' },
    { do: ({ G }) => G.setFlag('met_postmoth') },
  ],

  hollow_harbor: () => [
    { who: 'hollow', text: '… … …' },
    { who: 'buttons', face: 'sad', text: 'Their buttons are gone, Poppy. Don’t stare. It’s not polite to stare at the almost-forgotten.' },
  ],

  white_door_appears: () => [
    { sfx: 'sfx_static' },
    { shake: 6 },
    'Something has changed in the harbour wall. A door stands where no door was — white as a held breath.',
    { who: 'captain', face: 'stern', text: 'That’s… her cottage door. That is EXACTLY her cottage door.' },
    { who: 'captain', face: 'soft', text: 'The Mist Thread will be through there. Poppy… steel yourself. Houses remember loudest.' },
    { do: ({ G }) => G.setFlag('white_door') },
  ],

  sea_locked: () => [
    { who: 'buttons', face: 'neutral', text: 'That’s a lot of water and we are, historically, a cat and a child. We need the Captain.' },
  ],

  lighthouse_locked: ({ G }) => {
    const n = ['thread_sun', 'thread_storm', 'thread_mist'].filter(f => G.flag(f)).length;
    return [
      { who: 'captain', face: 'stern', text: `The lamp takes all three threads. We have ${n}. It has to be ALL kinds of weather, or it won’t hold.` },
      { who: 'captain', face: 'soft', text: 'Sun days, storm days, misty ones. You don’t get to keep only the sunny ones. That’s not a life, that’s a postcard.' },
    ];
  },

  // ═══════════ AREA 1 — ORCHARD ═══════════

  beefolk: () => [
    { who: 'folk', text: 'The bee-choir’s down to four voices. They keep humming her song wrong and the apples come out grey.' },
    { who: 'folk', text: 'The Moth Queen roosts up the hill. She’s not evil, love. She’s just decided eating the light is kinder than watching it go out.' },
  ],

  coat_table: ({ G }) => [
    'A little table under the apple boughs, set for two. Tea for two, cups gone cold a long time ago.',
    'Across one chair hangs a heavy coat. Sea-grey. Patient. Empty.',
    {
      if: ({ G }) => G.flag('orchard_done'),
      then: [
        { who: 'captain', face: 'soft', text: '…Ted’s coat. She kept his chair set for forty years of Sundays.' },
        { who: 'poppy', face: 'sad', text: 'Grandpa Ted? But I never— I never got to meet him.' },
        { who: 'captain', face: 'stern', text: 'No. And now the coat comes to tea instead. That’s what the Fog leaves. Furniture.' },
        { do: ({ G }) => G.setFlag('saw_coat') },
      ],
      else: [{ who: 'buttons', face: 'sad', text: 'Somebody’s missing. The table doesn’t know yet.' }],
    },
  ],

  orchard_boss: ({ G }) => [
    { music: null },
    'The hilltop clearing is dim. Grey wings blanket the big apple tree like a shroud.',
    { who: 'poppy', text: 'Excuse me! Are you the Moth Queen? You have something of Nana’s.' },
    'The wings unfold. A crown of dust. Eyes like the moment before sleep.',
    { who: 'narrator', text: '"The Sun Thread, yes. Warm. Delicious. The last warm thing in the whole orchard, and I am SAVING it."' },
    { who: 'buttons', face: 'smug', text: 'Unsave it, or the cat gets loud.' },
    { battle: { enemyIds: ['mothqueen'], bg: 'bbg_orchard', music: 'mus_boss', canFlee: false } },
    { music: 'mus_orchard' },
    'The Moth Queen folds, small as a glove. From under her crown rolls a spool of impossible gold.',
    { who: 'narrator', text: '"Keep it lit," she whispers. "Keep it lit, and I will only eat the moonlight."' },
    { do: ({ G }) => G.setFlag('orchard_boss_won') },
  ],

  take_sun_thread: ({ G }) => [
    { sfx: 'sfx_lamp' },
    { flash: '#ffe9b0' },
    'Poppy takes the SUN THREAD. It is warm as a shoulder in July.',
    {
      still: 'cut_coat', lines: [
        'From the hilltop, the whole orchard shows itself: rows of apple trees, a table set for two, and one empty coat.',
        'Poppy understands, in the sideways way you understand things in dreams:',
        'The Fog is not coming from the sea. It is coming from Nana. These are her rooms. Her orchard. Her people.',
        'And they are going out, one by one, like windows at bedtime.',
      ],
    },
    { do: ({ G }) => { G.setFlag('thread_sun'); G.setFlag('orchard_done'); G.addItem('thread_sun'); } },
    { who: 'buttons', face: 'sad', text: '…Back to the harbour, Poppy. The Captain should hear about the coat.' },
  ],

  // ═══════════ AREA 2 — SEA ═══════════

  hollow_isle: () => [
    { who: 'hollow', text: '… … fish … ? …' },
    { who: 'captain', face: 'soft', text: 'Old Herring. Best liar on the water, once. Fifty years of fish stories, and the Fog ate every one.' },
    { who: 'poppy', face: 'sad', text: 'Can’t we give some back? I could make up a fish. A HUGE one.' },
    { who: 'captain', face: 'soft', text: '…Tell him. Go on. It won’t stick, but it’ll warm him a minute.' },
    { who: 'poppy', face: 'happy', text: 'Mr. Herring! Once you caught a fish SO big it had its own weather!' },
    'Somewhere very far inside the hollow man, something chuckles.',
  ],

  whale_stars: () => [
    'High over the water hangs a whale stitched from starlight, mid-breach, unfinished.',
    { who: 'captain', face: 'soft', text: 'She started embroidering that for your mum’s ceiling. Never finished. Some things stay mid-jump forever.' },
  ],

  sea_boss: ({ G }) => [
    { music: null },
    { sfx: 'sfx_waves' },
    'The water goes tight as a held rope. Knots rise — a hill of them, a HOUSE of them, dripping.',
    { who: 'narrator', text: '"EVERY ARGUMENT SHE NEVER GOT TO MEND," it creaks. "EVERY SORRY SHE OWED. EVERY SORRY SHE WAS OWED."' },
    { who: 'narrator', text: '"THE STORM THREAD IS **MINE**. IT IS THE ONLY WEATHER I HAVE LEFT."' },
    { who: 'captain', face: 'stern', text: 'Steady, crew. You can’t untie a temper. You can only wear it out.' },
    { battle: { enemyIds: ['tangle'], bg: 'bbg_sea', music: 'mus_boss', canFlee: false } },
    { music: 'mus_sea' },
    'The Tangle sags… and underneath all of it, at the very middle of the knot, there is a tiny blue-black spool.',
    { who: 'poppy', face: 'sad', text: 'All that anger. Just to keep one little storm safe.' },
    { do: ({ G }) => G.setFlag('sea_boss_won') },
  ],

  take_storm_thread: ({ G }) => [
    { sfx: 'sfx_battlestart' },
    { flash: '#b9c6ff' },
    { shake: 5 },
    'Poppy takes the STORM THREAD. It grumbles in her pocket like far-off thunder, and she likes it enormously.',
    { do: ({ G }) => { G.setFlag('thread_storm'); G.setFlag('sea_done'); G.addItem('thread_storm'); } },
    { who: 'captain', face: 'neutral', text: 'Two of three. Back to harbour — and keep your eyes on the walls. Mist doesn’t use the front gate.' },
  ],

  // ═══════════ AREA 3 — WHITE ROOMS ═══════════

  white_enter: ({ G }) => [
    { theme: 'faded' },
    { music: 'mus_white' },
    'It is Nana’s cottage. It is exactly Nana’s cottage, stitched full size, standing where no cottage fits.',
    'Except the colour is going. Except the hallway repeats when you’re not looking at it.',
    { who: 'buttons', face: 'sad', text: 'Poppy. My stitching feels loose in here. If I start unravelling… you just keep walking, understand?' },
    { who: 'poppy', face: 'scared', text: 'NO. If you start unravelling I am putting you back together, forever, every time.' },
    { who: 'captain', face: 'stern', text: 'Both of you hush and hold hands. Houses remember loudest, and this one is trying to remember US.' },
    { do: ({ G }) => G.setFlag('white_entered') },
  ],

  hollow_white: () => [
    { who: 'hollow', text: '… tea? … no. … was it tea? …' },
    'It is wearing Nana’s good apron. It sets invisible cups on an invisible tray, over and over, getting it wrong.',
  ],

  photowall: ({ G }) => [
    {
      still: 'cut_photowall', lines: [
        'The photo wall. Forty years of frames, floor to ceiling.',
        'Grandpa Ted is only an outline now, neat as a dress pattern. Mum’s baby pictures are going pale at the edges.',
        'And Poppy—',
        'Poppy is missing from half of them. The most recent half.',
      ],
    },
    { who: 'poppy', face: 'scared', text: 'That was LAST SUMMER. The sandcastle with the seaweed flag. I was THERE. Where am I going?!' },
    { who: 'captain', face: 'stern', text: '…The newest stitches go first, little one. That’s how unravelling works.' },
    { who: 'poppy', face: 'sad', text: 'She isn’t losing me last. She’s losing me FIRST.' },
    { who: 'buttons', face: 'sad', text: '…Keep walking, Poppy. Remember what you said. We put each other back together. Every time.' },
    { do: ({ G }) => G.setFlag('photowall_seen') },
  ],

  nursery: ({ G }) => [
    'The little room at the end of the hall. A cot. A mobile of felt gulls, circling nothing.',
    {
      still: 'cut_unravel', lines: [
        'In the cot sleeps a knitted baby — Rosie, forty years ago, stitch-perfect down to the one dimple.',
        'As Poppy watches, a thread lifts off the little sleeve. Then another. The Fog is in the room, patient as bedtime.',
        'The knitted baby unravels a row at a time, and there is nothing to grab, nothing to fight, nowhere to put the fury.',
        'The mobile turns. The cot empties. The wool goes grey and lies still.',
      ],
    },
    { who: 'poppy', face: 'sad', text: 'That was my MUM. Give her BACK.' },
    { who: 'captain', face: 'soft', text: 'Poppy. Look at me. She’s downstairs in the real morning, safe as houses. This is only where the remembering lived.' },
    { who: 'poppy', face: 'sad', text: '"Only."' },
    { do: ({ G }) => G.setFlag('nursery_seen') },
  ],

  take_mist_thread: ({ G }) => [
    { sfx: 'sfx_fade' },
    { flash: '#f4f4f2' },
    'In the last bedroom, on the bed, lies a spool of pale grey — soft as breath on a window.',
    'Poppy takes the MIST THREAD. It doesn’t grumble or glow. It just settles, like the end of a long day.',
    { who: 'captain', face: 'soft', text: 'That one’s the heaviest, for all it weighs nothing. Misty days count too. The quiet ones. The forgetting ones.' },
    { who: 'captain', face: 'stern', text: 'Three of three. The lamp is waiting. Let’s go and light her way home.' },
    { do: ({ G }) => { G.setFlag('thread_mist'); G.setFlag('white_done'); G.addItem('thread_mist'); } },
    { theme: 'warm' },
  ],

  // ═══════════ FINALE — LIGHTHOUSE ═══════════

  lighthouse_enter: () => [
    { music: 'mus_white' },
    'The stairs wind up and up, past little windows. Through each one: less harbour, more white.',
    { who: 'captain', face: 'neutral', text: 'I kept this lamp forty years, you know. Well. Somebody very like me did.' },
    { who: 'buttons', face: 'neutral', text: 'You never told us your name, Captain.' },
    { who: 'captain', face: 'soft', text: '…No. I didn’t, did I.' },
  ],

  fog_fight: ({ G }) => [
    { music: null },
    'The lamp room. The great glass eye of the lighthouse, dark. And past every window: white, white, white.',
    'The white is looking at you.',
    { who: 'fog', text: 'oh, love. you’ve come SUCH a long way. and carrying all that weather.' },
    { who: 'poppy', face: 'scared', text: 'You’re it. You’re the Fog. You’re what’s taking her.' },
    { who: 'fog', text: 'taking? I don’t take. things get heavy, and I hold them. that’s all I am. the holding.' },
    { who: 'captain', face: 'stern', text: 'It talks like that all the way down. LAMP, Poppy. Threads. NOW.' },
    { battle: { enemyIds: ['fog1'], bg: 'bbg_fog', music: 'mus_boss', canFlee: false } },
    { who: 'buttons', face: 'sad', text: 'It’s not— Poppy, we’re not winning. It just breathes back in.' },
    { who: 'fog', text: 'you cannot unpick me, little stitch. I am not the sickness. I am only the weather it makes.' },
    { music: 'mus_fog' },
    { who: 'captain', face: 'soft', text: '…Then we stop unpicking. Poppy. The lamp takes the threads — and the threads take a song to wind by.' },
    { who: 'captain', face: 'soft', text: 'You know the song. You’ve known it your whole life. It has a middle. YOU keep the middle.' },
    { battle: { enemyIds: ['fog2'], bg: 'bbg_fog', music: 'mus_fog', canFlee: false, scripted: 'fog2', ritual: true } },
    { do: ({ G }) => G.setFlag('fog_done') },
    {
      still: 'cut_lamp', lines: [
        'Sun, Storm and Mist wind together on the spool, and Poppy sings the middle of the song.',
        'The lamp does not blaze. It does something better: it glows, patient and gold, like a kitchen window in winter.',
        'The Fog does not die. The Fog does not leave. But it stands back, respectful, the way weather stands back from a lit house.',
        'And below, all through the harbour, the little windows answer — one, two, three. One, two, three.',
      ],
    },
    { who: 'fog', text: '…there you are. keep singing it, love. I can wait. I’m good at waiting. and for as long as you sing—' },
    { who: 'fog', text: '—I will hold her GENTLY.' },
    // the reveal
    { who: 'poppy', text: 'Captain… your hat. It’s glowing.' },
    'The paper hat unfolds itself in the lamplight: a letter, creased soft as cloth, addressed in careful fountain pen: "For Rosie, when I can’t say it right anymore."',
    { who: 'poppy', face: 'scared', text: '…You’re her. You’ve been her the whole time. Young-Nana. Keeping the light.' },
    { who: 'captain', face: 'soft', text: 'Somebody has to, little one. Even in here. ESPECIALLY in here.' },
    { who: 'captain', face: 'soft', text: 'Now wake up, my little poppy-flower. Deliver my letter. And take the song with you — it goes out if only I keep it.' },
    { music: null },
    { wait: 1.2 },
    {
      do: ({ G }) => {
        // morning: the dream companions stay in the dream
        for (const m of G.party) {
          if (m.id !== 'poppy') m.inParty = false;
          m.hp = m.maxHp; m.ink = m.maxInk;
        }
      },
    },
    { goto: { map: 'cottage_morning', fade: 3.0 } },
  ],

  // ═══════════ MORNING ═══════════

  mum_morning: () => [
    { who: 'mum', text: 'Morning, sleepyhead. You were humming in your sleep, you know. All night. The whole house heard.' },
  ],

  nana_morning: ({ G }) => [
    'Nana Ivy sits by the window with her tea, watching the sea the way other people watch television.',
    { who: 'nana', face: 'lost', text: 'Good morning, dear. Are you… one of Rosie’s friends? From the school?' },
    { who: 'poppy', face: 'sad', text: '…' },
    { who: 'poppy', face: 'neutral', text: '(The letter. The song. Keep the middle.)' },
    'Poppy climbs onto the arm of the chair, careful of the tea. And quietly — one, two, three — she hums.',
    { music: 'mus_ending' },
    'The middle of the song. The part that got lost.',
    'Nana’s foot finds the rhythm first. Then her hand, on the chair arm. Then, wobbly as a paper boat, her voice.',
    { who: 'nana', face: 'warm', text: '…Well. There it is. There’s the middle. I’ve been looking for that for WEEKS, you know.' },
    { who: 'nana', face: 'warm', text: 'Thank you, my little poppy-flower.' },
    { who: 'poppy', face: 'happy', text: '(She doesn’t remember my name.)' },
    { who: 'poppy', face: 'happy', text: '(But she remembers ME. Somewhere with no doors, she does.)' },
    {
      still: 'cut_ending', lines: [
        'They hum it together until the tea goes cold: the girl, the grandmother, and a knitted cat with one button eye, purring in 3/4 time.',
        'Later, Poppy will put the letter in Mum’s hands, and Mum will go very quiet, and read it twice, and cry the good kind.',
        'The Fog will keep coming. That is what fog does. Nobody in this story gets to stop it.',
        'But in the window of the little cottage by the sea, for as long as somebody hums — there is a light.',
      ],
    },
    { do: ({ G }) => G.setFlag('game_complete') },
    { credits: true },
  ],
};
