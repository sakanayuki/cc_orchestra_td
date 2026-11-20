// 10 パートをサンプル単位で揃えて同時に鳴らし、パートごとの音量だけを変える。
// メモリを抑えるため AudioContext を 22.05kHz で作り、モノラルのまま展開する。
import { LOOP_SEC } from './config.js';

const RATE = 22050;

function pickExt() {
  const a = document.createElement('audio');
  return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
}

export class Mixer {
  constructor(names) {
    this.names = names;
    this.buffers = {};
    this.gains = {};
    this.sources = {};
    this.level = {};        // 目標の音量（0 / 0.5 / 1）
    this.ctx = null;
    this.started = false;
    this.t0 = 0;
  }

  _ctx() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { this.ctx = new AC({ sampleRate: RATE, latencyHint: 'playback' }); }
    catch { this.ctx = new AC(); }
    // iPhone のマナーモードでも鳴らす（対応ブラウザのみ）
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master = this.ctx.createGain();
    this.master.gain.value = 2.2;
    this.master.connect(comp).connect(this.ctx.destination);
    return this.ctx;
  }

  async _decode(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' ' + res.status);
    const data = await res.arrayBuffer();
    return await new Promise((ok, ng) => this.ctx.decodeAudioData(data, ok, ng));
  }

  async load(base, onProgress) {
    this._ctx();
    const ext = pickExt();
    const all = [...this.names, 'fullmix'];
    let done = 0;
    await Promise.all(all.map(async (n) => {
      let buf;
      try { buf = await this._decode(`${base}/${n}.${ext}`); }
      catch (e) { if (ext === 'mp3') throw e; buf = await this._decode(`${base}/${n}.mp3`); }
      this.buffers[n] = buf;
      done++; onProgress && onProgress(done / all.length);
    }));
  }

  get ready() { return Object.keys(this.buffers).length === this.names.length + 1; }

  // ユーザーのタップの中で呼ぶ
  async unlock() {
    this._ctx();
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  start(initialOn) {
    const ctx = this.ctx;
    this.t0 = ctx.currentTime + 0.12;
    for (const n of this.names) {
      if (!this.buffers[n]) continue;
      const g = ctx.createGain();
      const on = initialOn.includes(n) ? 1 : 0;
      g.gain.value = on; this.level[n] = on;
      g.connect(this.master);
      const src = ctx.createBufferSource();
      src.buffer = this.buffers[n];
      src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(LOOP_SEC, src.buffer.duration);
      src.connect(g);
      src.start(this.t0, 0);
      this.gains[n] = g; this.sources[n] = src;
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(2.2, ctx.currentTime);
    this.started = true;
  }

  _ramp(param, v, sec) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + sec);
  }

  set(name, level, fade = 0.5) {
    if (!this.started || !this.gains[name]) return;
    this.level[name] = level;
    this._ramp(this.gains[name].gain, level, fade);
  }

  // ループの中での再生位置（秒）
  position() {
    if (!this.started) return 0;
    const e = this.ctx.currentTime - this.t0;
    return ((e % LOOP_SEC) + LOOP_SEC) % LOOP_SEC;
  }

  // クリア：同じ位置から全体演奏へ切り替える。終わるまでの秒数を返す。
  finale(minRemain) {
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this.buffers.fullmix) return minRemain;
    const pos = this.position();
    let remain = LOOP_SEC - pos;
    if (remain < minRemain) remain += LOOP_SEC;
    const g = ctx.createGain();
    g.gain.value = 0; g.connect(this.master);
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.fullmix;
    src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(LOOP_SEC, src.buffer.duration);
    src.connect(g);
    const at = now + 0.05;
    src.start(at, (pos + 0.05) % LOOP_SEC);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.8);
    for (const g2 of Object.values(this.gains)) this._ramp(g2.gain, 0, 0.8);
    const end = now + remain;
    g.gain.setValueAtTime(1, Math.max(at + 0.8, end - 2.0));
    g.gain.linearRampToValueAtTime(0, end);
    src.stop(end + 0.1);
    this.full = { src, g };
    return remain;
  }

  stopAll(fade = 0.4) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._ramp(this.master.gain, 0, fade);
    const srcs = [...Object.values(this.sources), this.full && this.full.src].filter(Boolean);
    for (const s of srcs) { try { s.stop(t + fade + 0.05); } catch {} }
    this.sources = {}; this.gains = {}; this.full = null; this.started = false;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
