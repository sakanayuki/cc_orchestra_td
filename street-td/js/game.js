// ゲームの中身：楽器の配置、通行人、観客ゲージ、仲間の加入、クリア演出、ヒント。
// タイトル画面のデモも同じクラスを demo=true で動かす（音は鳴らさず、指が自動で配置する）。
import * as C from './config.js';
import { personSprite, personScale, randomPerson, drawBubble, drawNote, drawFinger, drawShape } from './sprites.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);

export class Game {
  constructor(canvas, images, hooks) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.img = images;
    this.hooks = hooks; // { audio, onGauge(frac, nextName), onFinaleEnd() }
  }

  get audio() { return this.demo ? null : this.hooks.audio; }

  reset(demo) {
    this.demo = demo;
    this.time = 0;
    this.state = 'play';
    this.inst = {};
    for (const [name, d] of Object.entries(C.INSTRUMENTS)) {
      this.inst[name] = { name, group: d.group, h: d.h, loc: 'off', slot: -1, x: -60, y: 372, s: 1,
        walk: null, bounce: 0, phase: Math.random() * 6 };
    }
    this.slots = C.SLOTS.map((s) => ({ ...s, active: false, occ: null, appear: 0, glow: 0 }));
    this.bench = [];
    this.sel = null;
    this.people = [];
    this.notes = [];
    this.confetti = [];
    this.gauge = 0;
    this.unlockIdx = 0;
    this.unlocking = false;
    this.spawnT = 1.2;
    this.spawned = 0;
    this.idle = 0;
    this.firstHintDone = false;
    this.hint = null;
    this.demoT = 2.5;
    this.bassoon = { x: C.BASSOON_SPOT.x, y: C.BASSOON_SPOT.y, h: C.BASSOON_SPOT.h, revealed: false, walk: null, bounce: 0 };
    this.finaleEnd = 0;

    C.START_ON_STAGE.forEach((n, i) => {
      this.slots[i].active = true; this.slots[i].appear = 1;
      this._putOnSlot(n, i);
    });
    C.START_ON_BENCH.forEach((n) => { this.inst[n].loc = 'bench'; this.bench.push(n); });
    this._layoutBench(true);
    this._emitGauge();
  }

  // ---------- 配置 ----------
  _putOnSlot(name, idx) {
    const it = this.inst[name], sl = this.slots[idx];
    it.loc = 'slot'; it.slot = idx; it.x = sl.x; it.y = sl.y; it.s = sl.s;
    sl.occ = name;
  }

  _benchPos(i) { return { x: C.BENCH.x0 + i * C.BENCH.dx, y: C.BENCH.y, s: C.BENCH.s }; }

  _layoutBench(instant = false) {
    this.bench.forEach((n, i) => {
      const it = this.inst[n], p = this._benchPos(i);
      if (it.loc !== 'bench') return;
      if (instant) { it.x = p.x; it.y = p.y; it.s = p.s; }
      else if (Math.abs(it.x - p.x) > 1) this._walkTo(it, p.x, p.y, p.s, 0.4, 1);
    });
  }

  _walkTo(it, x, y, s, dur, hops, then) {
    it.walk = { fx: it.x, fy: it.y, fs: it.s, tx: x, ty: y, ts: s, t: 0, dur, hops, then };
  }

  place(name, idx) {
    const it = this.inst[name], sl = this.slots[idx];
    if (!sl.active || it.loc !== 'bench') return;
    const prev = sl.occ;
    this.bench = this.bench.filter((n) => n !== name);
    it.loc = 'walk'; it.slot = idx; sl.occ = name;
    const dist = Math.hypot(sl.x - it.x, sl.y - it.y);
    this._walkTo(it, sl.x, sl.y, sl.s, 0.35 + dist / 500, Math.max(1, Math.round(dist / 70)), () => {
      it.loc = 'slot'; it.bounce = 1;
      this.audio && this.audio.set(name, 1, 0.35);
      this._checkClear();
    });
    if (prev) {
      const pv = this.inst[prev];
      pv.loc = 'bench'; pv.slot = -1;
      this.audio && this.audio.set(prev, 0, 0.35);
      this.bench.push(prev);
      const p = this._benchPos(this.bench.length - 1);
      const d2 = Math.hypot(p.x - pv.x, p.y - pv.y);
      this._walkTo(pv, p.x, p.y, p.s, 0.35 + d2 / 500, Math.max(1, Math.round(d2 / 70)));
    }
    this._layoutBench();
  }

  _stageCounts() {
    const c = { strings: 0, wood: 0, brass: 0, total: 0 };
    for (const sl of this.slots) {
      if (!sl.occ) continue;
      const it = this.inst[sl.occ];
      if (it.loc !== 'slot') continue;
      c[it.group]++; c.total++;
    }
    return c;
  }

  _matchCount(pref, counts = this._stageCounts()) {
    if (pref === 'rainbow') return counts.total ? Math.max(1, Math.floor(counts.total / 3)) : 0;
    return counts[pref];
  }

  // ---------- 入力 ----------
  tap(x, y) {
    this.idle = 0;
    if (this.hint && !this.demo) this.hint = null;
    if (this.state !== 'play') return;
    // 待機列
    for (const n of this.bench) {
      const it = this.inst[n];
      if (it.walk) continue;
      const h = it.h * it.s;
      if (Math.abs(x - it.x) < 28 && y > it.y - h - 8 && y < it.y + 10) {
        this._select(this.sel === n ? null : n);
        it.bounce = 1;
        return;
      }
    }
    // 台
    let best = -1, bd = 1e9;
    this.slots.forEach((sl, i) => {
      if (!sl.active) return;
      const dx = Math.abs(x - sl.x), top = sl.y - 92 * sl.s;
      if (dx < 38 * sl.s && y > top && y < sl.y + 14) {
        const d = dx + Math.abs(y - (sl.y - 40 * sl.s));
        if (d < bd) { bd = d; best = i; }
      }
    });
    if (best >= 0) {
      const sl = this.slots[best];
      if (this.sel) {
        const n = this.sel; this.sel = null;
        if (sl.occ && this.inst[sl.occ].loc === 'walk') { this._select(null); return; }
        this.place(n, best);
        return;
      }
      if (sl.occ && this.inst[sl.occ].loc === 'slot') {
        this.inst[sl.occ].bounce = 1;
        this.audio && this.audio.boost(sl.occ);
      }
      return;
    }
    this._select(null);
  }

  _select(n) {
    if (this.sel && this.sel !== n && this.inst[this.sel].loc === 'bench') this.audio && this.audio.set(this.sel, 0, 0.3);
    this.sel = n;
    if (n) this.audio && this.audio.set(n, 0.5, 0.3);
  }

  // ---------- 進行 ----------
  update(dt) {
    this.time += dt;
    this.idle += dt;

    // 楽器の移動
    for (const it of Object.values(this.inst)) {
      it.bounce = Math.max(0, it.bounce - dt * 2.2);
      if (!it.walk) continue;
      const w = it.walk;
      w.t += dt / w.dur;
      const t = Math.min(1, w.t), e = ease(t);
      it.x = w.fx + (w.tx - w.fx) * t;
      it.y = w.fy + (w.ty - w.fy) * e - Math.abs(Math.sin(Math.PI * t * w.hops)) * 12;
      it.s = w.fs + (w.ts - w.fs) * e;
      if (t >= 1) { it.y = w.ty; it.walk = null; w.then && w.then(); }
    }
    for (const sl of this.slots) {
      if (sl.active) sl.appear = Math.min(1, sl.appear + dt * 2.5);
      sl.glow = Math.max(0, sl.glow - dt * 0.6);
    }

    if (this.state === 'play') {
      this._spawn(dt);
      this._checkUnlock();
      this._updateHint(dt);
    } else if (this.state === 'finale') {
      this._finaleTick(dt);
    }
    this._updatePeople(dt);
    this._updateParticles(dt);
    this._updateBassoon(dt);
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
    const p = randomPerson();
    this.people.push({
      p, pref, dir, x: dir > 0 ? -24 : C.VW + 24, y: opts.y ?? C.LANES[Math.floor(Math.random() * C.LANES.length)] + rand(-6, 6),
      state: 'walk', t: 0, noteT: 0, listenDur: 0, listened: false, stopX: 0, anim: Math.random(), crowd: !!opts.crowd,
    });
    this.spawned++;
  }

  _pickPref() {
    const counts = this._stageCounts();
    const benchGroups = [...new Set(this.bench.map((n) => this.inst[n].group))];
    if (this.spawned === 0 && benchGroups.length) return benchGroups[0]; // 最初の 1 人は入れ替えを覚える場面にする
    const r = Math.random();
    if (r < C.RAINBOW_RATE) return 'rainbow';
    const missing = benchGroups.filter((g) => !counts[g]);
    const restCols = missing.length ? missing : benchGroups;
    if (r < C.RAINBOW_RATE + C.BENCH_COLOR_RATE && restCols.length) return restCols[Math.floor(Math.random() * restCols.length)];
    const onStage = ['strings', 'wood', 'brass'].filter((g) => counts[g]);
    const pool = onStage.length ? onStage : ['strings', 'wood', 'brass'];
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
          q.stopX = q.crowd ? q.stopX || clamp(q.x + q.dir * rand(10, 140), z0 + 6, z1 - 6) : clamp(q.x + q.dir * rand(8, 80), z0 + 6, z1 - 6);
        } else {
          const slow = inZone && !q.listened && this.state === 'play';
          q.x += q.dir * (slow ? C.SLOW_SPEED : C.WALK_SPEED) * dt;
        }
      }
      if (q.state === 'approach') {
        const d = q.stopX - q.x;
        if (Math.abs(d) < 2 || Math.sign(d) !== q.dir) {
          q.state = 'listen'; q.t = 0; q.noteT = rand(0.2, 0.6);
          const n = Math.max(1, this._matchCount(q.pref, counts));
          q.listenDur = q.crowd ? 1e9 : Math.min(C.LISTEN_MAX, C.LISTEN_BASE + C.LISTEN_PER * n);
        } else q.x += q.dir * C.WALK_SPEED * 0.9 * dt;
      }
      if (q.state === 'listen') {
        q.t += dt; q.noteT -= dt;
        if (q.noteT <= 0) {
          q.noteT = C.NOTE_EVERY;
          if (this.state === 'play') this._emitNote(q);
        }
        if (q.t >= q.listenDur) { q.state = 'wave'; q.t = 0; }
      } else if (q.state === 'wave') {
        q.t += dt;
        if (q.t > 0.8) { q.state = 'walk'; q.listened = true; }
      }
    }
    this.people = this.people.filter((q) => q.x > -40 && q.x < C.VW + 40);
  }

  _emitNote(q) {
    const sc = personScale(q.p);
    const col = C.GROUPS[q.pref].color;
    const sx = q.x, sy = q.y - 26 * sc;
    this.notes.push({ sx, sy, x: sx, y: sy, t: 0, dur: 1.0 + Math.random() * 0.2, col, cx: sx + rand(-60, 60), cy: rand(140, 260) });
  }

  _updateParticles(dt) {
    for (const n of this.notes) {
      n.t += dt / n.dur;
      const t = Math.min(1, n.t), u = 1 - t;
      n.x = u * u * n.sx + 2 * u * t * n.cx + t * t * C.GAUGE_TARGET.x;
      n.y = u * u * n.sy + 2 * u * t * n.cy + t * t * C.GAUGE_TARGET.y;
      if (n.t >= 1 && !n.done) { n.done = true; this.gauge++; this._emitGauge(); }
    }
    this.notes = this.notes.filter((n) => !n.done);
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

  get target() { return C.FAST ? 8 : C.NOTES_PER_UNLOCK[Math.min(this.unlockIdx, C.NOTES_PER_UNLOCK.length - 1)]; }

  _emitGauge() {
    const done = this.unlockIdx >= C.UNLOCK_ORDER.length;
    const next = done ? null : C.UNLOCK_ORDER[this.unlockIdx];
    const frac = done ? 1 : Math.min(1, this.gauge / this.target);
    this.hooks.onGauge && !this.demo && this.hooks.onGauge(frac, next);
  }

  _checkUnlock() {
    if (this.unlocking || this.unlockIdx >= C.UNLOCK_ORDER.length) return;
    if (this.gauge < this.target) return;
    const name = C.UNLOCK_ORDER[this.unlockIdx++];
    this.unlocking = true;
    this.gauge = 0;
    const last = this.unlockIdx >= C.UNLOCK_ORDER.length;
    const nActive = this.slots.filter((s) => s.active).length;
    const idx = nActive;
    this.slots[idx].active = true;
    if (last) this.slots[idx + 1].active = true; // 最後だけ台がもう 1 つ増え、全員が乗れる
    const it = this.inst[name], sl = this.slots[idx];
    sl.occ = name; sl.glow = 1;
    it.loc = 'walk'; it.slot = idx;
    const fromLeft = sl.x < C.VW / 2;
    it.x = fromLeft ? -40 : C.VW + 40; it.y = 376; it.s = 1;
    const dist = Math.abs(sl.x - it.x) + 40;
    this._walkTo(it, sl.x, sl.y, sl.s, 0.9 + dist / 200, Math.max(2, Math.round(dist / 45)), () => {
      it.loc = 'slot'; it.bounce = 1; sl.glow = 1;
      this.audio && this.audio.set(name, 1, 0.25);
      this._burst(sl.x, sl.y - 50 * sl.s, 36);
      this.unlocking = false;
      this._emitGauge();
      this._checkClear();
    });
    this._emitGauge();
  }

  _checkClear() {
    if (this.state !== 'play' || this.unlockIdx < C.UNLOCK_ORDER.length) return;
    const all = this.slots.every((s) => s.active && s.occ && this.inst[s.occ].loc === 'slot');
    if (!all) return;
    this.state = 'finale';
    this.sel = null; this.hint = null;
    const remain = this.audio ? this.audio.finale(C.FINALE_MIN_REMAIN) : 20;
    this.finaleEnd = this.time + remain;
    this.crowdT = 0; this.crowdN = 0; this.burstT = 0;
    // ファゴット登場
    const b = this.bassoon;
    b.revealT = 0;
    b.walk = { fx: b.x, fy: b.y, fh: b.h, tx: C.BASSOON_STAGE.x, ty: C.BASSOON_STAGE.y, th: C.BASSOON_STAGE.h, t: -0.9, dur: 1.6 };
  }

  _updateBassoon(dt) {
    const b = this.bassoon;
    b.bounce = Math.max(0, b.bounce - dt * 2);
    if (this.state === 'finale' && !b.revealed) {
      b.revealT = (b.revealT || 0) + dt;
      if (b.revealT > 0.8) { b.revealed = true; b.bounce = 1; this._burst(b.x, b.y - 40, 40); }
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
      this._spawnPerson('rainbow', { dir, crowd: true, y: C.LANES[this.crowdN % 2] + rand(-8, 8) - (this.crowdN > 7 ? 18 : 0) });
      const q = this.people[this.people.length - 1];
      q.stopX = dir > 0 ? 30 + (this.crowdN * 23) % 150 : 330 - (this.crowdN * 23) % 150;
    }
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = 1.2;
      this._burst(rand(40, 320), rand(150, 300), 24);
    }
    if (this.time >= this.finaleEnd && this.state === 'finale') {
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
      if (this.demo && !h.done && h.t >= 2.0) {
        h.done = true;
        const it = this.inst[h.name];
        if (it.loc === 'bench' && !it.walk) { this._select(null); this.place(h.name, h.slot); }
      }
      if (h.t > 2.5) this.hint = null;
      return;
    }
    if (this.bench.length === 0 || this.unlocking) return;
    if (Object.values(this.inst).some((it) => it.walk)) return;
    let want = null;
    if (this.demo) {
      this.demoT -= dt;
      if (this.demoT > 0) return;
      this.demoT = rand(2.5, 4.5);
      want = this._unmatchedPref() || (Math.random() < 0.5 ? this.inst[this.bench[0]].group : null);
      if (!want) return;
    } else if (!this.firstHintDone) {
      if (this.time < C.HINT_FIRST_DELAY) return;
      this.firstHintDone = true;
      want = this._unmatchedPref() || this.inst[this.bench[0]].group;
    } else {
      if (this.idle < C.HINT_IDLE) return;
      want = this._unmatchedPref();
      if (!want) return;
    }
    this._makeHint(want);
    this.idle = 0;
  }

  _unmatchedPref() {
    const counts = this._stageCounts();
    const benchGroups = new Set(this.bench.map((n) => this.inst[n].group));
    const [z0, z1] = C.SLOW_ZONE;
    for (const q of this.people) {
      if (q.state === 'walk' && !q.listened && q.x > z0 - 60 && q.x < z1 + 60 && q.pref !== 'rainbow' &&
          !counts[q.pref] && benchGroups.has(q.pref)) return q.pref;
    }
    return null;
  }

  _makeHint(group) {
    const name = this.bench.find((n) => this.inst[n].group === group) || this.bench[0];
    const it = this.inst[name];
    const counts = this._stageCounts();
    let slot = this.slots.findIndex((s) => s.active && !s.occ);
    if (slot < 0) {
      let bestScore = -1;
      this.slots.forEach((s, i) => {
        if (!s.active || !s.occ) return;
        const o = this.inst[s.occ];
        if (o.loc !== 'slot') return;
        const score = (o.group === it.group ? -10 : 0) + counts[o.group] + Math.random() * 0.5;
        if (score > bestScore) { bestScore = score; slot = i; }
      });
    }
    if (slot < 0) return;
    const sl = this.slots[slot];
    this.hint = { t: 0, name, slot, fx: it.x, fy: it.y - it.h * it.s * 0.45, tx: sl.x, ty: sl.y - 40 * sl.s };
  }

  // ---------- 描画 ----------
  render(scale) {
    const g = this.g;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, C.VW, C.VH);

    // 台
    for (const sl of this.slots) {
      if (!sl.active) continue;
      const a = ease(sl.appear);
      const occ = sl.occ && this.inst[sl.occ];
      g.save();
      g.translate(sl.x, sl.y);
      g.scale(sl.s * a, sl.s * a);
      if (sl.glow > 0) {
        g.fillStyle = `rgba(255,236,170,${0.7 * sl.glow})`;
        g.beginPath(); g.ellipse(0, -2, 44, 14, 0, 0, Math.PI * 2); g.fill();
      }
      if (occ) {
        const G = C.GROUPS[occ.group];
        g.fillStyle = G.light; g.strokeStyle = G.color; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      } else {
        g.setLineDash([5, 4]); g.strokeStyle = '#85532F'; g.lineWidth = 2.5;
        g.fillStyle = 'rgba(255,220,197,.55)';
        g.beginPath(); g.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.setLineDash([]);
      }
      if (this.sel) { // 置ける場所をそっと光らせる
        const pulse = 0.35 + 0.25 * Math.sin(this.time * 6);
        g.strokeStyle = `rgba(133,83,47,${pulse})`; g.lineWidth = 4;
        g.beginPath(); g.ellipse(0, 0, 38, 12, 0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
      if (occ && occ.loc === 'slot') drawShape(g, occ.group, sl.x + 26 * sl.s, sl.y + 2, 5 * sl.s);
    }

    // 選んだ楽器の M3 の選択表示（トレイの上）
    if (this.sel) {
      const it = this.inst[this.sel];
      if (it.loc === 'bench') {
        const h = it.h * it.s;
        g.fillStyle = '#FFDCC5'; g.strokeStyle = '#85532F'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(it.x - 28, it.y - h - 6, 56, h + 12, 16); g.fill(); g.stroke();
      }
    }

    // ファゴット（トレイにいる間は「？」のシルエット）
    this._drawBassoon(g);

    // 楽器（奥から順に）
    const list = Object.values(this.inst).filter((it) => it.loc !== 'off').sort((a, b) => a.y - b.y);
    for (const it of list) this._drawInst(g, it);

    // 通行人（奥から順に）
    g.imageSmoothingEnabled = false;
    const ppl = [...this.people].sort((a, b) => a.y - b.y);
    const counts = this._stageCounts();
    for (const q of ppl) this._drawPerson(g, q, counts);
    g.imageSmoothingEnabled = true;

    for (const n of this.notes) drawNote(g, n.x, n.y, n.col, 1.2 - n.t * 0.3);
    for (const c of this.confetti) {
      g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.col;
      g.globalAlpha = Math.min(1, c.life * 2); g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); g.restore();
    }
    if (this.hint) this._drawHint(g);
  }

  _drawInst(g, it) {
    const im = this.img[it.name];
    const h = it.h * it.s, w = im.width / im.height * h;
    const playing = it.loc === 'slot' && this.state !== 'done';
    let sx = 1, sy = 1, rot = 0, dy = 0;
    if (playing) {
      sy = 1 + 0.025 * Math.sin(this.time * 7 + it.phase);
      sx = 1 - 0.015 * Math.sin(this.time * 7 + it.phase);
      rot = 0.035 * Math.sin(this.time * 3.3 + it.phase);
    }
    if (it.bounce > 0) dy = -Math.sin(it.bounce * Math.PI) * 14;
    if (this.sel === it.name && it.loc === 'bench') dy -= 6 + Math.abs(Math.sin(this.time * 7)) * 6;
    g.save();
    g.translate(it.x, it.y + dy);
    g.rotate(rot);
    g.scale(sx, sy);
    g.drawImage(im, -w / 2, -h, w, h);
    g.restore();
  }

  _drawBassoon(g) {
    const b = this.bassoon, im = this.img.bassoon;
    const h = b.h, w = im.width / im.height * h;
    const dy = b.bounce > 0 ? -Math.sin(b.bounce * Math.PI) * 16 : 0;
    g.save();
    g.translate(b.x, b.y + dy);
    if (!b.revealed) {
      g.filter = 'brightness(0)';
      g.globalAlpha = 0.28;
      g.drawImage(im, -w / 2, -h, w, h);
      g.filter = 'none';
      g.globalAlpha = 1;
      g.fillStyle = '#85532F';
      g.font = '800 26px "M PLUS Rounded 1c", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('?', 0, -h * 0.42);
    } else {
      if (this.state === 'finale' || this.state === 'done') {
        g.rotate(0.05 * Math.sin(this.time * 3.3));
      }
      g.drawImage(im, -w / 2, -h, w, h);
    }
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
    if (pose.startsWith('walk') || pose === 'wave') { if (q.dir < 0) g.scale(-1, 1); }
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
