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

// 待機枠（持っている楽器の一覧）。台に置いても待機枠からは消えず、同じ楽器を何台にも置ける。
export const START_PALETTE = ['violin', 'flute', 'horn'];
export const START_STAGE = ['violin'];   // 台 1 つから始まる
export const UNLOCK_ORDER = ['viola', 'oboe', 'trumpet', 'cello', 'clarinet', 'timpani', 'contrabass'];

// 扇形のひな壇。並びは「台が現れる順番」（前列の中央から）。
// x, y は楽器の足元。s は奥行きによる縮尺。
export const SLOTS = [
  { x: 180, y: 274, s: 0.9 },  // 中列 中央（最初の台）
  { x: 136, y: 352, s: 1.0 },  // 前列 中央左
  { x: 224, y: 352, s: 1.0 },  // 前列 中央右
  { x: 92,  y: 266, s: 0.9 },  // 中列 左
  { x: 268, y: 266, s: 0.9 },  // 中列 右
  { x: 52,  y: 340, s: 1.0 },  // 前列 左端
  { x: 308, y: 340, s: 1.0 },  // 前列 右端
  { x: 180, y: 200, s: 0.8 },  // 後列 中央
  { x: 118, y: 194, s: 0.8 },  // 後列 左（クリア時のみ）
  { x: 242, y: 194, s: 0.8 },  // 後列 右（クリア時のみ）
];

// 待機枠のトレイ：6 列 × 2 段。左上から楽器が増えた順に並び、12 マス目がファゴットの「？」
export const PALETTE = { cols: 6, x0: 50, dx: 52, rows: [452, 518], cellW: 48, cellH: 60, maxH: 54, maxW: 42 };
export const BASSOON_CELL = 11;
export const BASSOON_STAGE = { x: 180, y: 384, h: 78 };  // クリア時に出てくる場所
export const GAUGE_TARGET = { x: 250, y: 32 };           // ハートが飛んでいく先
export const MAX_PLAY_SLOTS = 5;  // 遊んでいる間の台の上限（クリアで 10 台）。色の配分を考える余地を残すため少なめ
// クリア時の並び（台の番号 → 楽器）。弦が前、木管が中、金管と打楽器が後ろ。
export const FINALE_LAYOUT = ['oboe', 'viola', 'cello', 'flute', 'clarinet', 'violin', 'contrabass', 'timpani', 'horn', 'trumpet'];

// 通り
export const LANES = [636, 684];         // 通行人の足元の y
export const STAGE_ZONE = [28, 332];      // 舞台の前（ここで立ち止まる）
export const WALK_SPEED = 44;
export const SPAWN_INTERVAL = [5.5, 8];  // グループが来る間隔（秒）
export const MAX_PEOPLE = 16;
export const MAX_LISTENERS = 14;
export const PARTY_SIZES = [2, 3, 4, 5];  // 同じ好みの人が一度に来る人数（この中から等確率）

export const RAINBOW_RATE = 0.08;
export const REST_COLOR_RATE = 0.5;  // 待機枠にあって舞台にいない色

export const LISTEN_SEC = 6.0;     // 立ち止まって聴く秒数
// ハート 1 つの点数の倍率。好きな色の楽器が 1 体増えるごとにこの順で足す（5 体目以降は最後の値）
export const MULT_STEPS = [1, 1, 0.5, 0.25];
export const HEART_EVERY = 1.0;    // 聴いている人がハートを出す間隔（秒）
export const NOTE_EVERY = 1.3;     // 演奏中の楽器が音符を出す間隔（秒、見た目だけ）

// ゲージ 1 回ぶんに必要な点数（何回目か順）。7 回で楽器がそろい、8 回目でクリア。
// ハート 1 つの点数は倍率（MULT_STEPS）で決まり、楽器が増えるほど入りやすくなるので、後ほど大きくしている。
// 自動で遊ぶシミュレーションで、クリアまで「何もしない 約 3 分 10 秒／合わない人に合わせる 約 3 分／
// 来る人の色に合わせて台の色を配分する 約 1 分 55 秒」になるよう調整（腕前でタイムが縮むように）。
export const HEARTS_PER_FILL = [32, 51, 69, 90, 110, 129, 147, 168];

export const HINT_FIRST_DELAY = 3.0;
export const HINT_IDLE = 7.0;

export const FINALE_MIN_REMAIN = 10.0;  // クリア時の残りがこれ未満なら、もう 1 周流す
export const PHOTO_TAP_DELAY = 3.0;     // おしまい表示から、タップを受け付けるまで

// URL に ?fast を付けると調整用の早送りモード
export const FAST = new URLSearchParams(location.search).has('fast');
