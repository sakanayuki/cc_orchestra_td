// ゲーム全体の設定値。調整はここだけで済むようにしている。

export const VW = 360; // 仮想画面の幅
export const VH = 720; // 仮想画面の高さ

export const LOOP_SEC = 89.790; // 提示部の長さ（ここで繰り返しに入る）

// 楽器グループ（色＋形）。虹色はどの楽器でも好きな人。
export const GROUPS = {
  strings: { color: '#D9483B', light: '#F6C9C2', shape: 'circle' },
  wood:    { color: '#2E9A5A', light: '#BFE6CB', shape: 'triangle' },
  brass:   { color: '#E9A21C', light: '#F9E2AE', shape: 'star' },
  rainbow: { color: '#85532F', light: '#FFDCC5', shape: 'heart' },
};

// h: 前列に立った時の表示の高さ（仮想 px）
export const INSTRUMENTS = {
  violin:     { group: 'strings', h: 80 },
  viola:      { group: 'strings', h: 85 },
  cello:      { group: 'strings', h: 105 },
  contrabass: { group: 'strings', h: 120 },
  flute:      { group: 'wood',    h: 100 },
  oboe:       { group: 'wood',    h: 92 },
  clarinet:   { group: 'wood',    h: 95 },
  horn:       { group: 'brass',   h: 82 },
  trumpet:    { group: 'brass',   h: 88 },
  timpani:    { group: 'brass',   h: 80 },
};

export const START_ON_STAGE = ['violin', 'flute'];
export const START_ON_BENCH = ['horn'];
export const UNLOCK_ORDER = ['viola', 'oboe', 'trumpet', 'cello', 'clarinet', 'timpani', 'contrabass'];

// 扇形のひな壇。並びは「台が現れる順番」（前列の中央から）。
// x, y は楽器の足元。s は奥行きによる縮尺。
export const SLOTS = [
  { x: 136, y: 352, s: 1.0 },  // 前列 中央左
  { x: 224, y: 352, s: 1.0 },  // 前列 中央右
  { x: 52,  y: 340, s: 1.0 },  // 前列 左端
  { x: 308, y: 340, s: 1.0 },  // 前列 右端
  { x: 180, y: 274, s: 0.9 },  // 中列 中央
  { x: 92,  y: 266, s: 0.9 },  // 中列 左
  { x: 268, y: 266, s: 0.9 },  // 中列 右
  { x: 180, y: 200, s: 0.8 },  // 後列 中央
  { x: 118, y: 194, s: 0.8 },  // 後列 左
  { x: 242, y: 194, s: 0.8 },  // 後列 右
];

export const BENCH = { y: 462, x0: 56, dx: 62, s: 0.62 };
export const BASSOON_SPOT = { x: 314, y: 462, h: 70 };   // トレイ右端の「？」シルエット
export const BASSOON_STAGE = { x: 180, y: 382, h: 78 };  // クリア時に出てくる場所
export const GAUGE_TARGET = { x: 250, y: 32 };           // 音符が飛んでいく先

// 通り
export const LANES = [636, 684];         // 通行人の足元の y
export const SLOW_ZONE = [28, 332];      // 舞台の前（ゆっくり歩く範囲）
export const WALK_SPEED = 44;
export const SLOW_SPEED = 20;
export const SPAWN_INTERVAL = [2.2, 3.4];
export const MAX_PEOPLE = 9;
export const MAX_LISTENERS = 6;

export const RAINBOW_RATE = 0.15;
export const BENCH_COLOR_RATE = 0.40;

export const LISTEN_BASE = 3.0;    // 立ち止まって聴く秒数の基本
export const LISTEN_PER = 1.5;     // 好きな色の楽器 1 体ごとに延びる秒数
export const LISTEN_MAX = 9.0;
export const NOTE_EVERY = 1.0;     // 聴いている人が音符を出す間隔（秒）

// 仲間 1 体ぶんに必要な音符の数（何体目か順）。
// 楽器が増えるほど観客が長く聴くので、後ほど多くして「約 40 秒に 1 体・全体で約 5 分」に揃える。
// （自動で上手に遊ぶシミュレーションで調整。何もしなくても 7 分前後でクリアできる）
export const NOTES_PER_UNLOCK = [54, 60, 65, 71, 77, 82, 88];

export const HINT_FIRST_DELAY = 3.0;
export const HINT_IDLE = 7.0;

export const FINALE_MIN_REMAIN = 10.0;  // クリア時の残りがこれ未満なら、もう 1 周流す
export const PHOTO_TAP_DELAY = 3.0;     // おしまい表示から、タップを受け付けるまで

// URL に ?fast を付けると調整用の早送りモード
export const FAST = new URLSearchParams(location.search).has('fast');
