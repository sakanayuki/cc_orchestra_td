// 町の背景をドット絵で描く。半分の解像度（180×360）で描いて 2 倍に拡大する。
import { VW, VH } from './config.js';

export function drawTown(target, scale) {
  const W = VW / 2, H = VH / 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // 空
  R(0, 0, W, 40, '#BFE3F2');
  R(0, 30, W, 10, '#CFEAF4');
  for (const [cx, cy] of [[30, 12], [120, 8], [160, 20]]) {
    R(cx - 8, cy, 18, 4, '#FFFFFF'); R(cx - 4, cy - 3, 10, 3, '#FFFFFF');
  }

  // 建物（舞台の奥）
  const houses = [
    { x: 0, w: 34, h: 52, col: '#C8735A', roof: '#8A4A3A' },
    { x: 34, w: 30, h: 60, col: '#EBD9B4', roof: '#7A5A3A' },
    { x: 64, w: 52, h: 66, col: '#D9A46A', roof: '#7A4A2A' },
    { x: 116, w: 30, h: 56, col: '#8FBFB4', roof: '#4F7A70' },
    { x: 146, w: 34, h: 50, col: '#E3B8A0', roof: '#8A4A3A' },
  ];
  const base = 92;
  for (const b of houses) {
    const top = base - b.h;
    R(b.x, top, b.w, b.h, b.col);
    R(b.x - 1, top - 4, b.w + 2, 4, b.roof);
    R(b.x, top, b.w, 1, 'rgba(0,0,0,.12)');
    for (let wy = top + 6; wy < base - 16; wy += 13) {
      for (let wx = b.x + 4; wx < b.x + b.w - 7; wx += 10) {
        R(wx, wy, 6, 8, '#5E7F95'); R(wx, wy, 6, 2, '#86A9BF');
        R(wx - 1, wy + 8, 8, 1, '#FFFFFF');
      }
    }
  }
  // 時計塔
  R(84, 4, 12, 22, '#E9D3A8'); R(82, 1, 16, 4, '#7A4A2A');
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(90, 13, 4, 0, Math.PI * 2); g.fill();
  R(90, 10, 1, 3, '#333'); R(90, 13, 3, 1, '#333');

  // 広場の石畳
  R(0, base, W, 150, '#DCCBA6');
  for (let y = base; y < base + 150; y += 6) {
    const off = ((y - base) / 6) % 2 ? 4 : 0;
    for (let x = -off; x < W; x += 8) {
      R(x, y, 8, 1, '#CBB792'); R(x, y, 1, 6, '#CBB792');
      if (rand() < 0.15) R(x + 2, y + 2, 3, 2, '#E6D8B8');
    }
  }
  R(0, base, W, 2, '#B79F78');

  // ひな壇（3 段、手前ほど広い扇形）
  const tier = (cx, cy, rx, ry, top, face, edge) => {
    g.fillStyle = face; g.beginPath(); g.ellipse(cx, cy + 4, rx, ry, 0, 0, Math.PI); g.fill();
    R(cx - rx, cy, rx * 2, 4, face);
    g.fillStyle = top; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = edge; g.fillRect(cx - rx, cy, rx * 2, 0.6);
  };
  tier(90, 103, 70, 10, '#C18A55', '#8A5A30', '#E0B07A'); // 後列
  tier(90, 139, 84, 12, '#C99460', '#8A5A30', '#E0B07A'); // 中列
  tier(90, 176, 92, 14, '#D19F6B', '#8A5A30', '#E0B07A'); // 前列
  // 板の目
  g.fillStyle = 'rgba(120,70,30,.25)';
  for (const [cy, rx] of [[103, 70], [139, 84], [176, 92]]) {
    for (let x = 90 - rx + 10; x < 90 + rx - 6; x += 12) g.fillRect(x, cy - 6, 1, 12);
  }

  // 植え込みと街灯（広場と通りの境目）
  const hedgeY = 236;
  R(0, hedgeY, W, 26, '#5E9E54');
  for (let x = 0; x < W; x += 6) {
    R(x, hedgeY - 2 + (x % 12 ? 0 : 1), 6, 4, '#6FB063');
    if (rand() < 0.35) R(x + 2, hedgeY + 4 + Math.floor(rand() * 14), 2, 2, rnd2(rand));
  }
  R(0, hedgeY + 24, W, 3, '#8A7A66');
  for (const lx of [20, 160]) {
    R(lx, hedgeY - 30, 2, 56, '#3D4A4F');
    R(lx - 3, hedgeY - 36, 8, 6, '#3D4A4F'); R(lx - 2, hedgeY - 35, 6, 4, '#FFE7A0');
  }

  // 歩道
  const walkY = hedgeY + 27;
  R(0, walkY, W, H - walkY, '#CFC6BA');
  for (let y = walkY; y < H; y += 10) {
    const off = ((y - walkY) / 10) % 2 ? 7 : 0;
    for (let x = -off; x < W; x += 14) { R(x, y, 14, 1, '#BDB3A6'); R(x, y, 1, 10, '#BDB3A6'); }
  }
  R(0, H - 8, W, 2, '#A79D90');
  R(0, H - 6, W, 6, '#8C8A86');

  const tg = target.getContext('2d');
  tg.imageSmoothingEnabled = false;
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.clearRect(0, 0, target.width, target.height);
  tg.drawImage(c, 0, 0, W, H, 0, 0, VW * scale, VH * scale);
}

function rnd2(rand) { return ['#F5E36B', '#F28FA5', '#FFFFFF', '#E86A5A'][Math.floor(rand() * 4)]; }
