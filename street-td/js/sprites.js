// コードで描くドット絵：通行人、指、音符、グループのマーク、吹き出し。
import { GROUPS } from './config.js';

const SKINS = ['#F6D2B4', '#E9B98F', '#C98E62', '#8D5A3B'];
const HAIRS = ['#3B2A20', '#5A3A22', '#1F1A17', '#8A5A2B', '#C9A06A'];
const TOPS = ['#E86A5A', '#4E8FD6', '#F2C14E', '#6CBF84', '#B07CC6', '#F59AB5', '#5BB8C4', '#EFEFEF'];
const BOTTOMS = ['#3C4E7A', '#5A4A3A', '#2F3A3F', '#7A6A55', '#9C4F4F'];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function randomPerson() {
  const r = Math.random();
  const kind = r < 0.3 ? 'kid' : r < 0.5 ? 'elder' : 'adult';
  return {
    kind,
    skin: rnd(SKINS),
    hair: kind === 'elder' ? rnd(['#D9D9D9', '#BDBDBD', '#ECECEC']) : rnd(HAIRS),
    style: rnd(kind === 'elder' ? ['short', 'bun'] : ['short', 'long', 'bun', 'cap']),
    top: rnd(TOPS),
    cap: rnd(TOPS),
    bottom: rnd(BOTTOMS),
    skirt: Math.random() < 0.35,
    shoes: rnd(['#3A2A22', '#222', '#8A3B2B', '#F2F2F2']),
  };
}

const cache = new Map();

// pose: walk0 walk1 wave back clap0 clap1 front
export function personSprite(p, pose) {
  const key = JSON.stringify(p) + pose;
  let c = cache.get(key);
  if (c) return c;
  const torso = p.kind === 'kid' ? 5 : 8;
  const leg = p.kind === 'kid' ? 4 : 6;
  const W = 14, H = 7 + torso + leg + 2;
  c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y + 1, w, h); };
  const ty = 6, ly = ty + torso, sy = ly + leg;
  const dark = '#2A1E18';
  const side = pose === 'walk0' || pose === 'walk1' || pose === 'wave';

  if (side) {
    // 顔は右向き
    R(4, 0, 5, 6, p.skin);
    R(9, 3, 1, 1, p.skin);
    R(7, 2, 1, 1, dark);
    hairSide(R, p);
    // 体
    R(4, ty, 5, torso, p.top);
    if (p.skirt) { R(3, ly, 7, 3, p.bottom); }
    // 足
    const legCol = p.skirt ? p.skin : p.bottom;
    if (pose === 'walk0') {
      R(7, ly + (p.skirt ? 3 : 0), 2, leg - (p.skirt ? 3 : 0), legCol);
      R(4, ly + (p.skirt ? 3 : 0), 2, leg - (p.skirt ? 3 : 0), legCol);
      if (!p.skirt) R(5, ly, 3, 2, p.bottom);
      R(7, sy, 3, 2, p.shoes); R(3, sy, 3, 2, p.shoes);
    } else {
      R(5, ly + (p.skirt ? 3 : 0), 3, leg - (p.skirt ? 3 : 0), legCol);
      if (!p.skirt) R(5, ly, 3, leg, p.bottom);
      R(5, sy, 4, 2, p.shoes);
    }
    // 腕
    if (pose === 'wave') {
      R(7, ty - 3, 2, 4, p.top); R(8, ty - 5, 2, 2, p.skin);
    } else if (pose === 'walk0') {
      R(7, ty + 1, 2, torso - 2, shade(p.top)); R(8, ty + torso - 1, 2, 1, p.skin);
    } else {
      R(5, ty + 1, 2, torso - 2, shade(p.top)); R(5, ty + torso - 1, 2, 1, p.skin);
    }
    if (p.kind === 'elder' && pose !== 'wave') { R(10, ty + 2, 1, H - ty - 3, '#7A5230'); R(9, ty + 2, 2, 1, p.skin); }
  } else {
    // 後ろ姿 / 正面
    R(3, 0, 8, 6, p.skin);
    R(2, 3, 1, 2, p.skin); R(11, 3, 1, 2, p.skin);
    if (pose === 'front') {
      hairFront(R, p);
      R(5, 3, 1, 1, dark); R(8, 3, 1, 1, dark);
      R(6, 5, 2, 1, '#B5524A');
      R(4, 4, 1, 1, '#F2A0A0'); R(9, 4, 1, 1, '#F2A0A0');
    } else {
      hairBack(R, p);
    }
    R(3, ty, 8, torso, p.top);
    if (p.skirt) R(2, ly, 10, 3, p.bottom);
    const legCol = p.skirt ? p.skin : p.bottom;
    const lo = p.skirt ? 3 : 0;
    R(4, ly + lo, 2, leg - lo, legCol); R(8, ly + lo, 2, leg - lo, legCol);
    if (!p.skirt) R(4, ly, 6, 2, p.bottom);
    R(3, sy, 3, 2, p.shoes); R(8, sy, 3, 2, p.shoes);
    const arm = shade(p.top);
    if (pose === 'back') {
      R(2, ty + 1, 1, torso - 2, arm); R(11, ty + 1, 1, torso - 2, arm);
      R(2, ty + torso - 1, 1, 1, p.skin); R(11, ty + torso - 1, 1, 1, p.skin);
    } else if (pose === 'clap0') {
      R(2, ty + 1, 1, 2, arm); R(11, ty + 1, 1, 2, arm);
      R(3, ty, 1, 1, arm); R(10, ty, 1, 1, arm);
      R(4, ty - 1, 2, 1, p.skin); R(8, ty - 1, 2, 1, p.skin);
      R(6, ty - 2, 2, 2, p.skin);
    } else if (pose === 'clap1') {
      R(2, ty - 1, 1, 4, arm); R(11, ty - 1, 1, 4, arm);
      R(1, ty - 3, 2, 2, p.skin); R(11, ty - 3, 2, 2, p.skin);
    } else if (pose === 'front') {
      R(2, ty - 2, 1, 4, arm); R(11, ty - 2, 1, 4, arm);
      R(1, ty - 4, 2, 2, p.skin); R(11, ty - 4, 2, 2, p.skin);
    }
  }
  cache.set(key, c);
  return c;
}

function hairSide(R, p) {
  if (p.style === 'cap') { R(3, -1, 7, 2, p.cap); R(8, 0, 3, 1, p.cap); R(3, 1, 2, 3, p.hair); return; }
  R(3, -1, 6, 2, p.hair); R(3, 1, 2, 3, p.hair);
  if (p.style === 'long') R(2, 1, 3, 7, p.hair);
  if (p.style === 'bun') R(1, -1, 2, 2, p.hair);
}
function hairBack(R, p) {
  if (p.style === 'cap') { R(3, -1, 8, 2, p.cap); R(3, 1, 8, 3, p.hair); return; }
  R(3, -1, 8, 6, p.hair);
  if (p.style === 'long') R(3, 5, 8, 4, p.hair);
  if (p.style === 'bun') R(6, -2, 2, 2, p.hair);
}
function hairFront(R, p) {
  if (p.style === 'cap') { R(3, -1, 8, 2, p.cap); return; }
  R(3, -1, 8, 2, p.hair); R(3, 1, 1, 2, p.hair); R(10, 1, 1, 2, p.hair);
  if (p.style === 'long') { R(2, 1, 2, 7, p.hair); R(10, 1, 2, 7, p.hair); }
  if (p.style === 'bun') R(6, -2, 2, 2, p.hair);
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.8));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function personScale(p) { return p.kind === 'kid' ? 2.4 : 3; }

// グループのマーク（色＋形）。cx, cy 中心、r 半径
export function drawShape(g, group, cx, cy, r) {
  const G = GROUPS[group];
  g.save();
  if (group === 'rainbow') {
    const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gr.addColorStop(0, '#E8453C'); gr.addColorStop(0.35, '#F2B33D');
    gr.addColorStop(0.65, '#3FA65B'); gr.addColorStop(1, '#4B7BE5');
    g.fillStyle = gr;
  } else g.fillStyle = G.color;
  g.beginPath();
  if (G.shape === 'circle') g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  else if (G.shape === 'triangle') {
    g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.95, cy + r * 0.75); g.lineTo(cx - r * 0.95, cy + r * 0.75); g.closePath();
  } else if (G.shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  } else { // heart
    const s = r * 1.05;
    g.moveTo(cx, cy + s * 0.85);
    g.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.4);
    g.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.85);
  }
  g.fill();
  g.restore();
}

// M3 の吹き出し（surface container lowest + elevation）
export function drawBubble(g, group, x, y, wiggle = 0, scale = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(wiggle);
  g.scale(scale, scale);
  g.shadowColor = 'rgba(0,0,0,.22)'; g.shadowBlur = 4; g.shadowOffsetY = 1;
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.roundRect(-15, -30, 30, 26, 12);
  g.moveTo(-5, -5); g.lineTo(0, 2); g.lineTo(5, -5);
  g.fill();
  g.shadowColor = 'transparent';
  drawShape(g, group, 0, -17, 9);
  g.restore();
}

export function drawNote(g, x, y, color, s = 1) {
  g.save();
  g.translate(x, y); g.scale(s, s);
  g.fillStyle = color;
  g.beginPath(); g.ellipse(-3, 4, 4.2, 3.2, -0.4, 0, Math.PI * 2); g.fill();
  g.fillRect(0, -9, 2, 13);
  g.beginPath(); g.moveTo(2, -9); g.quadraticCurveTo(8, -6, 6, 0); g.quadraticCurveTo(6, -4, 2, -5); g.fill();
  g.restore();
}

// ヒントの指（白い手袋）
export function drawFinger(g, x, y, press = 0) {
  g.save();
  g.translate(x, y + press * 4);
  g.scale(1 - press * 0.08, 1 - press * 0.08);
  g.lineWidth = 2.5; g.strokeStyle = '#5A3A22'; g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.roundRect(-4, 0, 9, 22, 4.5);         // 人差し指
  g.roundRect(-9, 14, 26, 24, 9);         // 手のひら
  g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-4, 0, 9, 22, 4.5); g.fill();
  g.restore();
}
