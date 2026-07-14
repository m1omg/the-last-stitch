// Global game state + save/load. Kept import-free of data modules; the party
// is (re)built by data/party.js and battle code mutates member objects.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAVE_KEY = 'laststitch_save';
const SETTINGS_KEY = 'laststitch_settings';

export const G = {
  game: null,          // set by main.js
  rng: mulberry32(0xC0FFEE),
  flags: {},           // story flags
  party: [],           // member objects (data/party.js)
  inventory: {},       // itemId -> count
  charms: {},          // memberId -> charmId
  glimmer: 0,          // currency
  mapId: 'cottage',
  pos: { x: 480, y: 400 },
  playSeconds: 0,
  settings: { volMaster: 0.9, volMusic: 0.8, volSfx: 0.9 },

  rand() { return this.rng(); },
  irand(n) { return Math.floor(this.rng() * n); },
  pick(arr) { return arr[this.irand(arr.length)]; },
  chance(p) { return this.rng() < p; },

  flag(name) { return !!this.flags[name]; },
  setFlag(name, v = true) { this.flags[name] = v; },

  addItem(id, n = 1) { this.inventory[id] = (this.inventory[id] || 0) + n; },
  removeItem(id, n = 1) {
    this.inventory[id] = Math.max(0, (this.inventory[id] || 0) - n);
    if (!this.inventory[id]) delete this.inventory[id];
  },

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } },

  save() {
    const data = {
      v: 1,
      flags: this.flags,
      inventory: this.inventory,
      charms: this.charms,
      glimmer: this.glimmer,
      mapId: this.mapId,
      pos: this.pos,
      playSeconds: Math.round(this.playSeconds),
      party: this.party.map(m => ({
        id: m.id, level: m.level, xp: m.xp, hp: m.hp, ink: m.ink, inParty: m.inParty,
      })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
  },

  loadSaveData() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} },

  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch {}
  },
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
  },
};
