// 起動、画面の拡大縮小、タイトル → ゲーム → おしまい の流れ、一時停止。
import * as C from './config.js';
import { Mixer } from './audio.js';
import { Game } from './game.js';
import { drawTown } from './town.js';
import { personSprite, randomPerson } from './sprites.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage'), bg = $('#bg'), cv = $('#game');
const NAMES = Object.keys(C.INSTRUMENTS);

let scale = 1, dpr = 1;
function fit() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  scale = Math.min(innerWidth / C.VW, innerHeight / C.VH);
  const ox = (innerWidth - C.VW * scale) / 2, oy = (innerHeight - C.VH * scale) / 2;
  stage.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  for (const c of [bg, cv]) { c.width = Math.round(C.VW * scale * dpr); c.height = Math.round(C.VH * scale * dpr); }
  drawTown(bg, scale * dpr);
}

// ---------- 素材の読み込み ----------
function loadImage(src) {
  return new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = src; });
}
const images = {};
const imagesReady = Promise.all([...NAMES, 'bassoon'].map(async (n) => { images[n] = await loadImage(`assets/img/${n}.png`); }));
const mixer = new Mixer(NAMES);
const audioReady = mixer.load('assets/audio');
let ready = false;

// ---------- UI ----------
const gaugeEl = $('#gauge'), gaugeBar = gaugeEl.querySelector('.indicator'), nextBox = gaugeEl.querySelector('.next'), nextImg = nextBox.querySelector('img');
function onGauge(frac, next) {
  gaugeBar.style.width = `${Math.round(frac * 100)}%`;
  gaugeEl.setAttribute('aria-valuenow', Math.round(frac * 100));
  gaugeEl.classList.toggle('full', !next);
  if (next) { nextBox.hidden = false; nextImg.src = `assets/img/${next}.png`; } else nextBox.hidden = true;
}

let mode = 'title'; // title / play / photo
let paused = false;
let photoAt = 0;

const game = new Game(cv, images, { audio: mixer, onGauge, onFinaleEnd: showPhoto });

function showTitle() {
  mode = 'title';
  mixer.stopAll(0.3);
  $('#hud').hidden = true; $('#photo').hidden = true; $('#pausedlg').hidden = true;
  $('#title').hidden = false;
  paused = false;
  game.reset(true);
}

function startGame() {
  mode = 'play';
  $('#title').hidden = true; $('#hud').hidden = false;
  game.reset(false);
  mixer.start(C.START_ON_STAGE);
}

function showPhoto() {
  mode = 'photo';
  mixer.stopAll(0.6);
  renderPhoto($('#photocanvas'));
  $('#photo').hidden = false;
  photoAt = performance.now() + C.PHOTO_TAP_DELAY * 1000;
}

// ---------- 入力 ----------
let wantStart = false;
function toVirtual(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * C.VW, y: (e.clientY - r.top) / r.height * C.VH };
}
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (paused) return;
  if (mode === 'title') {
    mixer.unlock(); // タップの中で音を許可する
    if (ready) startGame(); else wantStart = true;
    return;
  }
  if (mode === 'play') {
    if (game.state === 'finale') { game.skipFinale(); return; }
    const p = toVirtual(e);
    game.tap(p.x, p.y);
  }
});
$('#photo').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (performance.now() >= photoAt) showTitle();
});

// 一時停止：2 秒長押しでダイアログ
const pauseBtn = $('#pause');
let holdTimer = 0;
const cancelHold = () => { clearTimeout(holdTimer); pauseBtn.classList.remove('holding'); };
pauseBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  pauseBtn.classList.add('holding');
  holdTimer = setTimeout(() => { cancelHold(); openPause(); }, 2000);
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pauseBtn.addEventListener(ev, cancelHold);
pauseBtn.addEventListener('contextmenu', (e) => e.preventDefault());

function openPause() {
  paused = true; mixer.suspend();
  $('#pausedlg').hidden = false;
}
$('#resume').addEventListener('click', () => { $('#pausedlg').hidden = true; paused = false; mixer.resume(); });
$('#toTitle').addEventListener('click', () => { $('#pausedlg').hidden = true; showTitle(); mixer.resume(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { mixer.suspend(); }
  else if ($('#pausedlg').hidden) { mixer.resume(); }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 集合写真 ----------
function renderPhoto(c) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#BFE3F2'); sky.addColorStop(0.45, '#E8F4F8'); sky.addColorStop(0.46, '#DCCBA6'); sky.addColorStop(1, '#D3C09A');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#C99460';
  g.beginPath(); g.ellipse(W / 2, 250, 300, 40, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#D19F6B';
  g.beginPath(); g.ellipse(W / 2, 390, 320, 46, 0, 0, Math.PI * 2); g.fill();
  const back = ['contrabass', 'cello', 'viola', 'horn', 'trumpet', 'timpani'];
  const front = ['flute', 'oboe', 'bassoon', 'clarinet', 'violin'];
  const draw = (n, x, y, h) => { const im = images[n]; const w = im.width / im.height * h; g.drawImage(im, x - w / 2, y - h, w, h); };
  back.forEach((n, i) => draw(n, 70 + i * 100, 262, (C.INSTRUMENTS[n].h) * 1.55));
  front.forEach((n, i) => draw(n, 90 + i * 115, 400, (n === 'bassoon' ? 80 : C.INSTRUMENTS[n].h) * 1.75));
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < 9; i++) {
    const p = randomPerson();
    const sp = personSprite(p, 'front');
    const sc = p.kind === 'kid' ? 4 : 5;
    g.drawImage(sp, 20 + i * 70, H - sp.height * sc + 20, sp.width * sc, sp.height * sc);
  }
  g.imageSmoothingEnabled = true;
}

// ---------- ループ ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && !document.hidden && mode !== 'photo') game.update(dt);
  game.render(scale * dpr);
  requestAnimationFrame(frame);
}

addEventListener('resize', fit);
fit();
Promise.all([imagesReady, audioReady]).then(() => {
  ready = true;
  $('#loading').hidden = true; $('#tapcue').hidden = false;
  if (wantStart && mode === 'title') startGame();
}).catch((e) => { console.error(e); ready = true; $('#loading').hidden = true; $('#tapcue').hidden = false; });

imagesReady.then(() => { game.reset(true); requestAnimationFrame(frame); });

// 調整用（?fast の時だけ）：ブラウザのコンソールから状態を見られるようにする
if (C.FAST) window.__dbg = { game, mixer };
