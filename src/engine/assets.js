// Image loading with charming procedural placeholders for anything missing,
// so the whole game is playable before (or without) generated art.
// Images are appended to #preload so they are document subresources: combined
// with top-level await in main.js this delays the window load event until
// everything is ready — which is what lets `firefox --screenshot` capture
// fully-rendered scenes.

export const IMG = {}; // key -> { el, w, h, placeholder }

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function placeholderCanvas(key, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const hu = hash(key) % 360;
  const kind = key.split('_')[0];

  if (kind === 'map' || kind === 'bbg' || kind === 'cut') {
    // scenery: soft two-tone gradient + big label + grid for maps
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hu} 38% 78%)`);
    g.addColorStop(1, `hsl(${(hu + 40) % 360} 34% 60%)`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (kind === 'map') {
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1;
      for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (let j = 0; j <= h; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
    }
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.font = `${Math.max(20, Math.floor(w / 18))}px sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(key, w / 2, h / 2);
  } else if (kind === 'por') {
    // portrait: round face with dot eyes
    x.fillStyle = `hsl(${hu} 45% 82%)`; x.fillRect(0, 0, w, h);
    x.fillStyle = `hsl(${(hu + 180) % 360} 35% 65%)`;
    x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, 7); x.fill();
    x.fillStyle = '#3a3230';
    x.beginPath(); x.arc(w / 2 - w * 0.12, h / 2 - h * 0.04, w * 0.035, 0, 7); x.fill();
    x.beginPath(); x.arc(w / 2 + w * 0.12, h / 2 - h * 0.04, w * 0.035, 0, 7); x.fill();
    x.beginPath(); x.arc(w / 2, h / 2 + h * 0.1, w * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); x.lineWidth = w * 0.02; x.strokeStyle = '#3a3230'; x.stroke();
    x.font = `${Math.floor(w / 9)}px sans-serif`; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.45)';
    x.fillText(key.replace('por_', ''), w / 2, h - w / 12);
  } else {
    // sprite / enemy / prop: cute blob with feet and eyes on transparency
    const cx = w / 2, ground = h * 0.96, bw = w * 0.72, bh = h * 0.72;
    x.fillStyle = `hsl(${hu} 42% 68%)`;
    x.strokeStyle = `hsl(${hu} 42% 34%)`;
    x.lineWidth = Math.max(2, w * 0.03);
    x.beginPath();
    x.ellipse(cx, ground - bh / 2, bw / 2, bh / 2, 0, 0, 7);
    x.fill(); x.stroke();
    x.fillStyle = '#332c28';
    x.beginPath(); x.arc(cx - bw * 0.16, ground - bh * 0.62, Math.max(1.5, w * 0.045), 0, 7); x.fill();
    x.beginPath(); x.arc(cx + bw * 0.16, ground - bh * 0.62, Math.max(1.5, w * 0.045), 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,.4)';
    x.font = `${Math.max(8, Math.floor(w / 8))}px sans-serif`;
    x.textAlign = 'center';
    x.fillText(key.split('_').slice(1).join('_'), cx, h * 0.2);
  }
  return c;
}

export function loadImages(manifest) {
  const preload = document.getElementById('preload');
  const jobs = Object.entries(manifest).map(([key, [path, w, h]]) => new Promise((resolve) => {
    const el = new Image();
    el.onload = () => {
      IMG[key] = { el, w: el.naturalWidth, h: el.naturalHeight, placeholder: false };
      resolve();
    };
    el.onerror = () => {
      const c = placeholderCanvas(key, w, h);
      IMG[key] = { el: c, w, h, placeholder: true };
      resolve();
    };
    el.src = path;
    preload.appendChild(el);
  }));
  return Promise.all(jobs);
}

export function img(key) {
  const a = IMG[key];
  if (!a) throw new Error(`unknown image key: ${key}`);
  return a;
}

export function drawImg(ctx, key, x, y, opts = {}) {
  const a = img(key);
  const w = opts.w ?? a.w, h = opts.h ?? a.h;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  if (opts.flip) { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + w / 2), 0); }
  if (opts.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(opts.rot); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  ctx.drawImage(a.el, x, y, w, h);
  ctx.restore();
}
