// ゲームの中身：待機枠（持っている楽器）、台への配置、通行人、観客ゲージ、仲間の加入、クリア演出、ヒント。
// タイトル画面のデモも同じクラスを demo=true で動かす（音は鳴らさず、指が自動で配置する）。
import * as C from './config.js';
import { personSprite, personScale, randomPerson, drawBubble, drawNote, drawFinger, drawShape } from './sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const GROUP_OF = (n) => C.INSTRUMENTS[n].group;

export class Game {
  constructor(canvas, images, hooks) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.img = images;
    this.hooks = hooks; // { audio, onGauge(frac, nextName|'bassoon'), onFinaleEnd() }
  }

  get audio() { return this.demo ? null : this.hooks.audio; }

  reset(demo) {
    this.demo = demo;
    this.time = 0;
    this.state = 'play';
    this.palette = [...C.START_PALETTE];
    this.cellPop = {};                 // 待機枠に新しく入った楽器のポップ演出
    this.slots = C.SLOTS.map((s) => ({ ...s, active: false, occ: null, actor: null, appear: 0, glow: 0 }));
    this.ghosts = [];                  // 台から降りて消えていく楽器
    this.sel = null;
    this.people = [];
    this.hearts = [];
    this.notes = [];
    this.confetti = [];
    this.gauge = 0;
    this.fills = 0;                    // ゲージが満タンになった回数
    this.unlocking = false;
    this.spawnT = 1.2;
    this.spawned = 0;
    this.idle = 0;
    this.firstHintDone = false;
    this.hint = null;
    this.demoT = 2.5;
    const bc = this.cellPos(C.BASSOON_CELL);
    this.bassoon = { x: bc.x, y: bc.y, h: 50, revealed: false, walk: null, bounce: 0 };
    this.finaleEnd = 0;
    C.START_STAGE.forEach((n, i) => {
      const sl = this.slots[i];
      sl.active = true; sl.appear = 1; sl.occ = n;
      sl.actor = this._actor(n, sl.x, sl.y, sl.s);
    });
    this._emitGauge();
  }

  _actor(name, x, y, s) { return { name, x, y, s, walk: null, phase: Math.random() * 6, noteT: rand(0.2, 1.2), arrived: true }; }

  // ---------- 待機枠 ----------
  cellPos(i) {
    const P = C.PALETTE;
    return { x: P.x0 + (i % P.cols) * P.dx, y: P.rows[Math.floor(i / P.cols)] };
  }

  // 待機枠の中での楽器の大きさ（枠に収まる縮尺）
  cellScale(name) {
    const im = this.img[name], d = C.INSTRUMENTS[name];
    const w = im.width / im.height * d.h;
    return Math.min(C.PALETTE.maxH / d.h, C.PALETTE.maxW / w);
  }

  // ---------- 配置 ----------
  place(name, idx) {
    const sl = this.slots[idx];
    if (!sl.active || !this.palette.includes(name)) return;
    if (sl.occ === name && sl.actor && sl.actor.arrived) return;
    if (sl.actor) this._retire(sl.actor);
    const cp = this.cellPos(this.palette.indexOf(name));
    const a = this._actor(name, cp.x, cp.y, this.cellScale(name));
    a.arrived = false;
    sl.occ = name; sl.actor = a;
    const dist = Math.hypot(sl.x - a.x, sl.y - a.y);
    this._walkTo(a, sl.x, sl.y, sl.s, 0.35 + dist / 500, Math.max(1, Math.round(dist / 70)), () => {
      a.arrived = true; sl.glow = 0.6;
      this._checkUnlock();
    });
  }

  _retire(actor) {
    // 台から降りて、下へ跳ねながら消える
    this.ghosts.push({ ...actor, walk: null, t: 0 });
  }

  _walkTo(a, x, y, s, dur, hops, then) {
    a.walk = { fx: a.x, fy: a.y, fs: a.s, tx: x, ty: y, ts: s, t: 0, dur, hops, then };
  }

  _stageCounts() {
    const c = { strings: 0, wood: 0, brass: 0, total: 0 };
    for (const sl of this.slots) {
      if (!sl.actor || !sl.actor.arrived) continue;
      c[GROUP_OF(sl.occ)]++; c.total++;
    }
    return c;
  }

  _onStage(name) { return this.slots.some((s) => s.actor && s.actor.arrived && s.occ === name); }

  _matchCount(pref, counts = this._stageCounts()) {
    if (pref === 'rainbow') return counts.total ? Math.max(1, Math.floor(counts.total / 3)) : 0;
    return counts[pref];
  }

  // 台の上にいる楽器だけ音を出す。選んでいる楽器は半分の音量で試し聴き。
  _syncAudio() {
    const au = this.audio;
    if (!au || !au.started || this.state !== 'play') return;
    for (const n of Object.keys(C.INSTRUMENTS)) {
      const lv = this._onStage(n) ? 1 : (this.sel === n ? 0.5 : 0);
      if (au.level[n] !== lv) au.set(n, lv, 0.3);
    }
  }

  // ---------- 入力 ----------
  tap(x, y) {
    this.idle = 0;
    if (this.hint && !this.demo) this.hint = null;
    if (this.state !== 'play') return;
    // 待機枠
    const P = C.PALETTE;
    for (let i = 0; i < this.palette.length; i++) {
      const c = this.cellPos(i);
      if (Math.abs(x - c.x) < P.dx / 2 && y > c.y - P.cellH && y < c.y + 6) {
        const n = this.palette[i];
        this.sel = this.sel === n ? null : n;
        this.cellPop[n] = 1;
        return;
      }
    }
    // 台（楽器を選んでいる時だけ意味がある）
    if (this.sel) {
      let best = -1, bd = 1e9;
      this.slots.forEach((sl, i) => {
        if (!sl.active) return;
        const dx = Math.abs(x - sl.x), top = sl.y - 100 * sl.s;
        if (dx < 40 * sl.s && y > top && y < sl.y + 16) {
          const d = dx + Math.abs(y - (sl.y - 40 * sl.s));
          if (d < bd) { bd = d; best = i; }
        }
      });
      if (best >= 0) { this.place(this.sel, best); this.sel = null; return; }
    }
    this.sel = null;
  }

  // ---------- 進行 ----------
  update(dt) {
    this.time += dt;
    this.idle += dt;

    for (const sl of this.slots) {
      if (sl.active) sl.appear = Math.min(1, sl.appear + dt * 2.5);
      sl.glow = Math.max(0, sl.glow - dt * 0.6);
      const a = sl.actor;
      if (a) this._stepWalk(a, dt);
      if (a && a.arrived && this.state !== 'done') {
        a.noteT -= dt;
        if (a.noteT <= 0) { a.noteT = C.NOTE_EVERY * rand(0.8, 1.2); this._emitNote(a, sl); }
      }
    }
    for (const gh of this.ghosts) gh.t += dt;
    this.ghosts = this.ghosts.filter((gh) => gh.t < 0.6);
    for (const k of Object.keys(this.cellPop)) { this.cellPop[k] -= dt * 2.5; if (this.cellPop[k] <= 0) delete this.cellPop[k]; }

    if (this.state === 'play') {
      this._spawn(dt);
      this._checkUnlock();
      this._updateHint(dt);
      this._syncAudio();
    } else if (this.state === 'finale') {
      this._finaleTick(dt);
    }
    this._updatePeople(dt);
    this._updateParticles(dt);
    this._updateBassoon(dt);
  }

  _stepWalk(a, dt) {
    if (!a.walk) return;
    const w = a.walk;
    w.t += dt / w.dur;
    if (w.t < 0) return;
    const t = Math.min(1, w.t), e = ease(t);
    a.x = w.fx + (w.tx - w.fx) * t;
    a.y = w.fy + (w.ty - w.fy) * e - Math.abs(Math.sin(Math.PI * t * w.hops)) * 12;
    a.s = w.fs + (w.ts - w.fs) * e;
    if (t >= 1) { a.y = w.ty; a.walk = null; w.then && w.then(); }
  }

  _spawn(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = rand(...C.SPAWN_INTERVAL);
    if (this.people.length >= C.MAX_PEOPLE) return;
    this._spawnPerson(this._pickPref());
  }

  _spawnPerson(pref, opts = {}) {
    const dir = opts.dir ?? (Math.random() < 0.5 ? 1 : -1);
    this.people.push({
      p: randomPerson(), pref, dir, x: dir > 0 ? -24 : C.VW + 24,
      y: opts.y ?? C.LANES[Math.floor(Math.random() * C.LANES.length)] + rand(-6, 6),
      state: 'walk', t: 0, heartT: 0, listenDur: 0, listened: false, stopX: opts.stopX || 0, anim: Math.random(), crowd: !!opts.crowd,
    });
    this.spawned++;
  }

  _pickPref() {
    const counts = this._stageCounts();
    const palGroups = [...new Set(this.palette.map(GROUP_OF))];
    const rest = palGroups.filter((g) => !counts[g]);
    if (this.spawned === 0 && rest.length) return rest[0]; // 最初の 1 人は入れ替えを覚える場面にする
    const r = Math.random();
    if (r < C.RAINBOW_RATE) return 'rainbow';
    if (r < C.RAINBOW_RATE + C.REST_COLOR_RATE && rest.length) return rest[Math.floor(Math.random() * rest.length)];
    const onStage = ['strings', 'wood', 'brass'].filter((g) => counts[g]);
    const pool = onStage.length ? onStage : palGroups;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _listeners() { return this.people.filter((q) => q.state === 'listen' || q.state === 'approach').length; }

  _updatePeople(dt) {
    const counts = this._stageCounts();
    const [z0, z1] = C.SLOW_ZONE;
    for (const q of this.people) {
      q.anim += dt;
      const inZone = q.x > z0 && q.x < z1;
      if (q.state === 'walk') {
        const matched = this._matchCount(q.pref, counts) > 0;
        const canStop = !q.listened && inZone && (this.state === 'finale' ? q.crowd : this.state === 'play');
        if (canStop && matched && (q.crowd || this._listeners() < C.MAX_LISTENERS)) {
          q.state = 'approach';
          if (!q.crowd) q.stopX = clamp(q.x + q.dir * rand(8, 80), z0 + 6, z1 - 6);
        } else {
          const slow = inZone && !q.listened && this.state === 'play';
          q.x += q.dir * (slow ? C.SLOW_SPEED : C.WALK_SPEED) * dt;
        }
      }
      if (q.state === 'approach') {
        const d = q.stopX - q.x;
        if (Math.abs(d) < 2 || Math.sign(d) !== q.dir) {
          q.state = 'listen'; q.t = 0; q.heartT = rand(0.2, 0.6);
          const n = Math.max(1, this._matchCount(q.pref, counts));
          q.listenDur = q.crowd ? 1e9 : Math.min(C.LISTEN_MAX, C.LISTEN_BASE + C.LISTEN_PER * n);
        } else q.x += q.dir * C.WALK_SPEED * 0.9 * dt;
      }
      if (q.state === 'listen') {
        q.t += dt; q.heartT -= dt;
        if (q.heartT <= 0) {
          q.heartT = C.HEART_EVERY;
          if (this.state === 'play') this._emitHeart(q);
        }
        if (q.t >= q.listenDur) { q.state = 'wave'; q.t = 0; }
      } else if (q.state === 'wave') {
        q.t += dt;
        if (q.t > 0.8) { q.state = 'walk'; q.listened = true; }
      }
    }
    this.people = this.people.filter((q) => q.x > -40 && q.x < C.VW + 40);
  }

  _emitHeart(q) {
    const sx = q.x, sy = q.y - 26 * personScale(q.p);
    this.hearts.push({ sx, sy, x: sx, y: sy, t: 0, dur: 1.0 + Math.random() * 0.2, cx: sx + rand(-60, 60), cy: rand(140, 260) });
  }

  _emitNote(a, sl) {
    const col = C.GROUPS[GROUP_OF(a.name)].color;
    this.notes.push({ x: a.x + rand(-14, 14) * sl.s, y: a.y - C.INSTRUMENTS[a.name].h * sl.s * rand(0.5, 0.9),
      vx: rand(-10, 10), t: 0, col, s: sl.s });
  }

  _updateParticles(dt) {
    for (const h of this.hearts) {
      h.t += dt / h.dur;
      const t = Math.min(1, h.t), u = 1 - t;
      h.x = u * u * h.sx + 2 * u * t * h.cx + t * t * C.GAUGE_TARGET.x;
      h.y = u * u * h.sy + 2 * u * t * h.cy + t * t * C.GAUGE_TARGET.y;
      if (h.t >= 1 && !h.done) { h.done = true; this.gauge++; this._emitGauge(); }
    }
    this.hearts = this.hearts.filter((h) => !h.done);
    for (const n of this.notes) { n.t += dt; n.y -= 22 * dt; n.x += n.vx * dt + Math.sin(n.t * 5) * 0.3; }
    this.notes = this.notes.filter((n) => n.t < 1.6);
    for (const c of this.confetti) {
      c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < C.VH + 20);
  }

  _burst(x, y, n = 30) {
    const cols = ['#D9483B', '#2E9A5A', '#E9A21C', '#4B7BE5', '#F59AB5', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(80, 260);
      this.confetti.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0, 6), vr: rand(-8, 8),
        col: cols[i % cols.length], life: rand(1.2, 2.2), w: rand(3, 6), h: rand(5, 9) });
    }
  }

  get target() { return C.FAST ? 8 : C.HEARTS_PER_FILL[Math.min(this.fills, C.HEARTS_PER_FILL.length - 1)]; }

  _nextReward() {
    return this.fills < C.UNLOCK_ORDER.length ? C.UNLOCK_ORDER[this.fills] : 'bassoon';
  }

  _emitGauge() {
    if (this.demo || !this.hooks.onGauge || this.state !== 'play') return;
    this.hooks.onGauge(Math.min(1, this.gauge / this.target), this._nextReward());
  }

  _checkUnlock() {
    if (this.state !== 'play' || this.unlocking || this.gauge < this.target) return;
    this.gauge = 0;
    const reward = this._nextReward();
    this.fills++;
    if (reward === 'bassoon') {
      if (this.demo) { this.reset(true); return; } // タイトルのデモはクリアせず最初から
      this._startFinale(); return;
    }
    // 新しい楽器：待機枠に入り、新しい台にも自分で乗る
    this.unlocking = true;
    this.palette.push(reward);
    this.cellPop[reward] = 1;
    const nActive = this.slots.filter((s) => s.active).length;
    let sl = null;
    if (nActive < C.MAX_PLAY_SLOTS) { sl = this.slots[nActive]; sl.active = true; }
    else { // 台が上限なら、いちばん多い色の台を譲ってもらう
      const counts = this._stageCounts();
      sl = this.slots.filter((s) => s.active).sort((a, b) => counts[GROUP_OF(b.occ)] - counts[GROUP_OF(a.occ)])[0];
      if (sl.actor) this._retire(sl.actor);
    }
    sl.glow = 1;
    const fromLeft = sl.x < C.VW / 2;
    const a = this._actor(reward, fromLeft ? -40 : C.VW + 40, 380, 1);
    a.arrived = false;
    sl.occ = reward; sl.actor = a;
    const dist = Math.abs(sl.x - a.x) + 40;
    this._walkTo(a, sl.x, sl.y, sl.s, 0.9 + dist / 200, Math.max(2, Math.round(dist / 45)), () => {
      a.arrived = true; sl.glow = 1;
      this._burst(sl.x, sl.y - 50 * sl.s, 36);
      this.unlocking = false;
    });
    this._emitGauge();
  }

  // ---------- クリア ----------
  _startFinale() {
    this.state = 'finale';
    if (!this.demo && this.hooks.onGauge) this.hooks.onGauge(1, null);
    if (!this.demo && this.hooks.onClear) this.hooks.onClear();
    this.sel = null; this.hint = null;
    const remain = this.audio ? this.audio.finale(C.FINALE_MIN_REMAIN) : 20;
    this.finaleEnd = this.time + remain;
    this.crowdT = 0.6; this.crowdN = 0; this.burstT = 0;
    // 10 体全員が台に並ぶ
    C.FINALE_LAYOUT.forEach((name, i) => {
      const sl = this.slots[i];
      sl.active = true;
      if (sl.actor) this._retire(sl.actor);
      const cp = this.cellPos(this.palette.indexOf(name));
      const a = this._actor(name, cp.x, cp.y, this.cellScale(name));
      a.arrived = false;
      sl.occ = name; sl.actor = a;
      const dist = Math.hypot(sl.x - a.x, sl.y - a.y);
      this._walkTo(a, sl.x, sl.y, sl.s, 0.5 + dist / 500, Math.max(1, Math.round(dist / 70)), () => { a.arrived = true; });
      a.walk.t = -i * 0.12;
    });
    const b = this.bassoon;
    b.revealT = 0;
    b.walk = { fx: b.x, fy: b.y, fh: b.h, tx: C.BASSOON_STAGE.x, ty: C.BASSOON_STAGE.y, th: C.BASSOON_STAGE.h, t: -1.6, dur: 1.6 };
  }

  _updateBassoon(dt) {
    const b = this.bassoon;
    b.bounce = Math.max(0, b.bounce - dt * 2);
    if (this.state === 'finale' && !b.revealed) {
      b.revealT += dt;
      if (b.revealT > 1.4) { b.revealed = true; b.bounce = 1; this._burst(b.x, b.y - 40, 40); }
    }
    if (!b.walk) return;
    const w = b.walk;
    w.t += dt / w.dur;
    if (w.t < 0) return;
    const t = Math.min(1, w.t), e = ease(t);
    b.x = w.fx + (w.tx - w.fx) * e;
    b.y = w.fy + (w.ty - w.fy) * e - Math.abs(Math.sin(Math.PI * t * 3)) * 14;
    b.h = w.fh + (w.th - w.fh) * e;
    if (t >= 1) { b.y = w.ty; b.walk = null; b.bounce = 1; }
  }

  _finaleTick(dt) {
    this.crowdT -= dt;
    if (this.crowdT <= 0 && this.crowdN < 14) {
      this.crowdT = 0.35; this.crowdN++;
      const dir = this.crowdN % 2 ? 1 : -1;
      this._spawnPerson('rainbow', { dir, crowd: true, y: C.LANES[this.crowdN % 2] + rand(-8, 8) - (this.crowdN > 7 ? 18 : 0),
        stopX: dir > 0 ? 30 + (this.crowdN * 23) % 150 : 330 - (this.crowdN * 23) % 150 });
    }
    this.burstT -= dt;
    if (this.burstT <= 0) { this.burstT = 1.2; this._burst(rand(40, 320), rand(150, 300), 24); }
    if (this.time >= this.finaleEnd) {
      this.state = 'done';
      this.hooks.onFinaleEnd && this.hooks.onFinaleEnd();
    }
  }

  skipFinale() {
    if (this.state !== 'finale') return false;
    this.state = 'done';
    this.audio && this.audio.stopAll(0.4);
    this.hooks.onFinaleEnd && this.hooks.onFinaleEnd();
    return true;
  }

  // ---------- ヒント ----------
  _updateHint(dt) {
    if (this.hint) {
      this.hint.t += dt;
      const h = this.hint;
      if (this.demo && !h.done && h.t >= 2.0) { h.done = true; this.place(h.name, h.slot); }
      if (h.t > 2.5) this.hint = null;
      return;
    }
    if (this.unlocking || this.slots.some((s) => s.actor && !s.actor.arrived)) return;
    let want = null;
    if (this.demo) {
      this.demoT -= dt;
      if (this.demoT > 0) return;
      this.demoT = rand(2.5, 4.5);
      want = this._unmatchedPref();
      if (!want) return;
    } else if (!this.firstHintDone) {
      if (this.time < C.HINT_FIRST_DELAY) return;
      this.firstHintDone = true;
      want = this._unmatchedPref() || this._restGroups()[0];
      if (!want) return;
    } else {
      if (this.idle < C.HINT_IDLE) return;
      want = this._unmatchedPref();
      if (!want) return;
    }
    this._makeHint(want);
    this.idle = 0;
  }

  _restGroups() {
    const counts = this._stageCounts();
    return [...new Set(this.palette.map(GROUP_OF))].filter((g) => !counts[g]);
  }

  _unmatchedPref() {
    const rest = new Set(this._restGroups());
    const [z0, z1] = C.SLOW_ZONE;
    for (const q of this.people) {
      if (q.state === 'walk' && !q.listened && q.x > z0 - 60 && q.x < z1 + 60 && rest.has(q.pref)) return q.pref;
    }
    return null;
  }

  _makeHint(group) {
    const cands = this.palette.filter((n) => GROUP_OF(n) === group);
    if (!cands.length) return;
    const name = cands[Math.floor(Math.random() * cands.length)];
    const counts = this._stageCounts();
    let slot = this.slots.findIndex((s) => s.active && !s.occ);
    if (slot < 0) {
      let bestScore = -1e9;
      this.slots.forEach((s, i) => {
        if (!s.active || !s.actor || !s.actor.arrived) return;
        const score = counts[GROUP_OF(s.occ)] + Math.random() * 0.5;
        if (score > bestScore) { bestScore = score; slot = i; }
      });
    }
    if (slot < 0) return;
    const sl = this.slots[slot], cp = this.cellPos(this.palette.indexOf(name));
    this.hint = { t: 0, name, slot, fx: cp.x, fy: cp.y - 28, tx: sl.x, ty: sl.y - 40 * sl.s };
  }

  // ---------- 描画 ----------
  render(scale) {
    const g = this.g;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, C.VW, C.VH);

    this._drawSlots(g);
    this._drawPalette(g);
    this._drawBassoon(g);

    // 台の上の楽器（奥から順に）
    const actors = this.slots.filter((s) => s.actor).map((s) => s.actor);
    for (const gh of this.ghosts) this._drawActor(g, gh, 1 - gh.t / 0.6, gh.t * 30);
    for (const a of actors.sort((p, q) => p.y - q.y)) this._drawActor(g, a, 1, 0);

    if (this.sel) this._drawArrow(g);

    for (const n of this.notes) {
      g.globalAlpha = Math.min(1, (1.6 - n.t) * 1.5);
      drawNote(g, n.x, n.y, n.col, 0.9 * n.s);
    }
    g.globalAlpha = 1;

    // 通行人（奥から順に）
    g.imageSmoothingEnabled = false;
    const counts = this._stageCounts();
    for (const q of [...this.people].sort((a, b) => a.y - b.y)) this._drawPerson(g, q, counts);
    g.imageSmoothingEnabled = true;

    for (const h of this.hearts) this._drawHeart(g, h.x, h.y, 8 - h.t * 2);
    for (const c of this.confetti) {
      g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.col;
      g.globalAlpha = Math.min(1, c.life * 2); g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); g.restore();
    }
    if (this.hint) this._drawHint(g);
  }

  _drawSlots(g) {
    for (const sl of this.slots) {
      if (!sl.active) continue;
      const a = ease(sl.appear);
      g.save();
      g.translate(sl.x, sl.y);
      g.scale(sl.s * a, sl.s * a);
      if (sl.glow > 0) {
        g.fillStyle = `rgba(255,236,170,${0.7 * sl.glow})`;
        g.beginPath(); g.ellipse(0, -2, 44, 14, 0, 0, Math.PI * 2); g.fill();
      }
      if (sl.occ) {
        const G = C.GROUPS[GROUP_OF(sl.occ)];
        g.fillStyle = G.light; g.strokeStyle = G.color; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      } else {
        g.setLineDash([5, 4]); g.strokeStyle = '#85532F'; g.lineWidth = 2.5;
        g.fillStyle = 'rgba(255,220,197,.55)';
        g.beginPath(); g.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.setLineDash([]);
      }
      if (this.sel) {
        const pulse = 0.35 + 0.25 * Math.sin(this.time * 6);
        g.strokeStyle = `rgba(133,83,47,${pulse})`; g.lineWidth = 4;
        g.beginPath(); g.ellipse(0, 0, 38, 12, 0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
      if (sl.occ && sl.actor && sl.actor.arrived) drawShape(g, GROUP_OF(sl.occ), sl.x + 26 * sl.s, sl.y + 2, 5 * sl.s);
    }
  }

  _drawPalette(g) {
    const P = C.PALETTE;
    for (let i = 0; i < P.cols * P.rows.length; i++) {
      if (i === C.BASSOON_CELL) continue;
      const c = this.cellPos(i), name = this.palette[i];
      const x = c.x - P.cellW / 2, y = c.y - P.cellH + 4;
      if (!name) { // まだ来ていない枠
        g.setLineDash([4, 4]); g.strokeStyle = '#D7C3B8'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(x + 2, y + 2, P.cellW - 4, P.cellH - 4, 12); g.stroke();
        g.setLineDash([]);
        continue;
      }
      const G = C.GROUPS[GROUP_OF(name)];
      const sel = this.sel === name;
      const pop = this.cellPop[name] || 0;
      g.save();
      g.translate(c.x, c.y - P.cellH / 2 + 4);
      const k = 1 + 0.15 * Math.sin(pop * Math.PI);
      g.scale(k, k);
      g.translate(-c.x, -(c.y - P.cellH / 2 + 4));
      // グループの色のタイル（M3 の card 風、選んでいる時は primary の outline）
      g.fillStyle = G.light;
      g.beginPath(); g.roundRect(x, y, P.cellW, P.cellH, 14); g.fill();
      g.lineWidth = sel ? 4 : 2; g.strokeStyle = sel ? '#85532F' : G.color;
      g.stroke();
      const im = this.img[name], d = C.INSTRUMENTS[name], s = this.cellScale(name);
      const h = d.h * s, w = im.width / im.height * h;
      const lift = sel ? 3 + Math.abs(Math.sin(this.time * 6)) * 4 : 0;
      g.drawImage(im, c.x - w / 2, c.y - h - lift, w, h);
      g.restore();
      // マーク（左上）
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(x + 9, y + 9, 8, 0, Math.PI * 2); g.fill();
      drawShape(g, GROUP_OF(name), x + 9, y + 9.5, 6);
    }
  }

  // 選んだ楽器から台の方へ、点滅する点線の矢印を 1 本
  _drawArrow(g) {
    const i = this.palette.indexOf(this.sel);
    if (i < 0) return;
    const c = this.cellPos(i);
    const fx = c.x, fy = c.y - C.PALETTE.cellH - 2;
    const act = this.slots.filter((s) => s.active);
    const empty = act.find((s) => !s.occ);
    let tx, ty;
    if (empty) { tx = empty.x; ty = empty.y + 8; }
    else {
      tx = act.reduce((a, s) => a + s.x, 0) / act.length;
      ty = Math.max(...act.map((s) => s.y)) + 10;
    }
    const ang = Math.atan2(ty - fy, tx - fx);
    const len = Math.max(20, Math.hypot(tx - fx, ty - fy));
    const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 7));
    g.save();
    g.globalAlpha = blink;
    g.translate(fx, fy); g.rotate(ang);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.setLineDash([7, 9]); g.lineDashOffset = -this.time * 30;
    for (const [col, lw] of [['#FFFFFF', 10], ['#85532F', 5]]) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len - 16, 0); g.stroke();
    }
    g.setLineDash([]);
    g.beginPath(); g.moveTo(len, 0); g.lineTo(len - 20, -13); g.lineTo(len - 20, 13); g.closePath();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#85532F'; g.fill();
    g.restore();
  }

  _drawActor(g, a, alpha, sink) {
    const im = this.img[a.name];
    const h = C.INSTRUMENTS[a.name].h * a.s, w = im.width / im.height * h;
    const playing = a.arrived && alpha === 1 && this.state !== 'done';
    let sx = 1, sy = 1, rot = 0;
    if (playing) {
      sy = 1 + 0.025 * Math.sin(this.time * 7 + a.phase);
      sx = 1 - 0.015 * Math.sin(this.time * 7 + a.phase);
      rot = 0.035 * Math.sin(this.time * 3.3 + a.phase);
    }
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.translate(a.x, a.y + sink);
    g.rotate(rot); g.scale(sx, sy);
    g.drawImage(im, -w / 2, -h, w, h);
    g.restore();
  }

  _drawBassoon(g) {
    const b = this.bassoon, im = this.img.bassoon;
    const h = b.h, w = im.width / im.height * h;
    const dy = b.bounce > 0 ? -Math.sin(b.bounce * Math.PI) * 16 : 0;
    if (!b.revealed && !b.walk) {
      const P = C.PALETTE, c = this.cellPos(C.BASSOON_CELL);
      g.setLineDash([4, 4]); g.strokeStyle = '#D7C3B8'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(c.x - P.cellW / 2 + 2, c.y - P.cellH + 6, P.cellW - 4, P.cellH - 4, 12); g.stroke();
      g.setLineDash([]);
    }
    g.save();
    g.translate(b.x, b.y + dy);
    if (!b.revealed) {
      g.filter = 'brightness(0)';
      g.globalAlpha = 0.28;
      g.drawImage(im, -w / 2, -h, w, h);
      g.filter = 'none'; g.globalAlpha = 1;
      g.fillStyle = '#85532F';
      g.font = '800 22px "M PLUS Rounded 1c", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('?', 0, -h * 0.4);
    } else {
      g.rotate(0.05 * Math.sin(this.time * 3.3));
      g.drawImage(im, -w / 2, -h, w, h);
    }
    g.restore();
  }

  _drawHeart(g, x, y, r) {
    g.save();
    g.fillStyle = '#E8457A';
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.5;
    const s = r;
    g.beginPath();
    g.moveTo(x, y + s * 0.85);
    g.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.4);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.3, y - s * 0.1, x, y + s * 0.85);
    g.fill(); g.stroke();
    g.restore();
  }

  _drawPerson(g, q, counts) {
    const sc = personScale(q.p);
    let pose;
    if (q.state === 'listen') pose = Math.floor(q.anim * 4) % 2 ? 'clap0' : 'clap1';
    else if (q.state === 'wave') pose = 'wave';
    else pose = Math.floor(q.anim * 5) % 2 ? 'walk0' : 'walk1';
    const sp = personSprite(q.p, pose);
    const w = sp.width * sc, h = sp.height * sc;
    g.save();
    g.translate(Math.round(q.x), Math.round(q.y));
    g.fillStyle = 'rgba(0,0,0,.14)';
    g.beginPath(); g.ellipse(0, 0, w * 0.32, 4, 0, 0, Math.PI * 2); g.fill();
    if ((pose.startsWith('walk') || pose === 'wave') && q.dir < 0) g.scale(-1, 1);
    g.drawImage(sp, -w / 2, -h, w, h);
    g.restore();
    if (!q.listened && q.state !== 'wave') {
      const inZone = q.x > C.SLOW_ZONE[0] && q.x < C.SLOW_ZONE[1];
      const unmatched = q.state === 'walk' && inZone && this._matchCount(q.pref, counts) === 0;
      const wig = unmatched ? Math.sin(this.time * 9) * 0.22 : 0;
      const sc2 = q.state === 'listen' ? 1 + 0.08 * Math.sin(this.time * 8) : 1;
      drawBubble(g, q.pref, q.x, q.y - h - 2, wig, sc2);
    }
  }

  _drawHint(g) {
    const h = this.hint, t = h.t;
    let x, y, press = 0, alpha = 1;
    if (t < 0.6) { const e = ease(t / 0.6); x = h.fx + 30 * (1 - e); y = h.fy + 60 * (1 - e); alpha = e; }
    else if (t < 0.9) { x = h.fx; y = h.fy; press = Math.sin((t - 0.6) / 0.3 * Math.PI); }
    else if (t < 1.7) { const e = ease((t - 0.9) / 0.8); x = h.fx + (h.tx - h.fx) * e; y = h.fy + (h.ty - h.fy) * e - Math.sin(e * Math.PI) * 40; }
    else if (t < 2.0) { x = h.tx; y = h.ty; press = Math.sin((t - 1.7) / 0.3 * Math.PI); }
    else { x = h.tx; y = h.ty; alpha = Math.max(0, 1 - (t - 2.0) / 0.5); }
    g.save();
    g.globalAlpha = alpha;
    if (press > 0) {
      g.fillStyle = `rgba(133,83,47,${0.3 * press})`;
      g.beginPath(); g.arc(x, y, 10 + 14 * press, 0, Math.PI * 2); g.fill();
    }
    drawFinger(g, x, y, press);
    g.restore();
  }
}
