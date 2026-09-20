/* Echo Squad — core game. Zero dependencies. Fixed 60 Hz simulation, render at display rate. */
(function () {
'use strict';

/* ============================== constants ============================== */
var TICK = 1 / 60, ROUND_T = 20, ROUND_TICKS = ROUND_T * 60;
var TAU = Math.PI * 2;
var ENEMY_CAP = 130;
var ECHO_HUES = [265, 150, 320, 48, 24, 215, 95, 295, 175, 0];

var CLASSES = {
  rifle:    { key: 'rifle',    hue: 190, rate: 5.0,  dmg: 10, range: 520,  bs: 950,  pellets: 1, spread: 0.035, pierce: 0, unlock: 0 },
  shotgun:  { key: 'shotgun',  hue: 30,  rate: 1.3,  dmg: 8,  range: 300,  bs: 820,  pellets: 6, spread: 0.55,  pierce: 0, unlock: 1 },
  sniper:   { key: 'sniper',   hue: 130, rate: 0.85, dmg: 62, range: 1300, bs: 1700, pellets: 1, spread: 0,     pierce: 3, unlock: 3 },
  guardian: { key: 'guardian', hue: 280, pulse: 1.2, dmg: 16, pulseR: 160, auraR: 230, unlock: 6 }
};
var CLASS_ORDER = ['rifle', 'shotgun', 'sniper', 'guardian'];

var ENEMY = {
  chaser:   { hp: 22,  speed: 142, dmg: 10, r: 14, cost: 1, from: 1, w: 5,   drop: 1 },
  tank:     { hp: 150, speed: 58,  dmg: 22, r: 27, cost: 5, from: 3, w: 1.1, drop: 4 },
  shooter:  { hp: 30,  speed: 92,  dmg: 9,  r: 15, cost: 3, from: 4, w: 1.4, drop: 2 },
  guard:    { hp: 75,  speed: 84,  dmg: 14, r: 19, cost: 4, from: 5, w: 1.2, drop: 3 },
  splitter: { hp: 44,  speed: 100, dmg: 10, r: 18, cost: 3, from: 6, w: 1.2, drop: 2 },
  mini:     { hp: 10,  speed: 165, dmg: 6,  r: 9,  cost: 0, from: 99, w: 0,  drop: 0 },
  boss:     { hp: 800, speed: 50,  dmg: 28, r: 48, cost: 0, from: 99, w: 0,  drop: 30 }
};

var META = [
  { key: 'hp',    max: 5, base: 40,  grow: 1.7 },
  { key: 'dmg',   max: 5, base: 50,  grow: 1.75 },
  { key: 'slots', max: 2, base: 250, grow: 3.2 },
  { key: 'gain',  max: 5, base: 60,  grow: 1.7 }
];

var UPGRADES = [
  { key: 'power',  hue: 0,   ico: '✦', ok: function () { return true; },                apply: function (r) { r.dmgMul *= 1.2; } },
  { key: 'rapid',  hue: 45,  ico: '»', ok: function () { return true; },                apply: function (r) { r.rateMul *= 1.15; } },
  { key: 'swift',  hue: 190, ico: '➤', ok: function (r) { return r.speedMul < 1.45; },  apply: function (r) { r.speedMul += 0.1; } },
  { key: 'vital',  hue: 140, ico: '+', ok: function () { return true; },                apply: function (r) { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
  { key: 'slot',   hue: 265, ico: '◎', ok: function (r) { return r.slots < 8; },        apply: function (r) { r.slots += 1; }, tag: 'echo' },
  { key: 'epower', hue: 300, ico: '≋', ok: function () { return true; },                apply: function (r) { r.echoDmg += 0.2; }, tag: 'echo' },
  { key: 'earmor', hue: 215, ico: '⬡', ok: function () { return true; },                apply: function (r) { r.echoHp *= 1.4; }, tag: 'echo' },
  { key: 'repair', hue: 150, ico: '♥', ok: function () { return player.hp < player.maxHp * 0.7; }, apply: function () { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5); } },
  { key: 'magnet', hue: 50,  ico: '⊛', ok: function (r) { return r.magnet < 3; },       apply: function (r) { r.magnet += 0.6; } },
  { key: 'pierce', hue: 100, ico: '⇶', ok: function (r) { return r.pierce < 3; },       apply: function (r) { r.pierce += 1; } }
];

/* ============================== i18n ============================== */
var T = {
  en: {
    ready: 'MOVE TO START', readyKeys: 'WASD / Arrows / hold mouse', readyTouch: 'Drag anywhere',
    round: 'ROUND', rewind: 'REWIND', youAgo: 'Your last 20 seconds just became an ECHO.', youAgo2: 'It repeats your moves and fights beside you.', lblYou: 'YOU', lblPast: 'PAST YOU', tipEcho: 'Your echo repeats last round. Fight together!',
    boss: 'BOSS INCOMING', bossDown: 'BOSS DOWN', streak: 'STREAK', tagline: 'Every 20 seconds, time rewinds.', tagline2: 'Your past selves fight beside you.',
    nextUnlock: '{c} unlocks in {n} more run(s)', lblKills: 'Kills', language: 'Language',
    cardsTitle: 'Round {n} <span class="c">cleared</span>', cardsSub: 'Squad: {e} echo(es) · pick one upgrade',
    nextBody: 'Next body', locked: 'after {n} runs', reroll: 'Reroll', echoTag: 'squad', selfTag: 'you',
    deadTitle: 'You <span class="c">fell</span>', deadSub: 'Round {n}. Your squad is still waiting.',
    revive: 'Revive', giveUp: 'End run',
    resTitle: 'Run <span class="c">over</span>', resSub: 'Spend coins on permanent upgrades, then go again.', newBest: 'New record!',
    lblRound: 'Round', lblBest: 'Best', lblEarned: 'Earned', lblBank: 'Coins',
    double: 'Double coins', again: 'Play again', doubled: 'Coins doubled!', noAd: 'Ad not available right now.',
    unlocked: 'New body unlocked: {c}',
    pauseTitle: 'Paused', pauseSub: 'Take a breath.', resume: 'Resume',
    c_rifle: 'Rifle', c_shotgun: 'Shotgun', c_sniper: 'Sniper', c_guardian: 'Guardian',
    u_power: 'Firepower', d_power: '+20% damage for you and every echo',
    u_rapid: 'Rapid fire', d_rapid: '+15% fire rate for the whole squad',
    u_swift: 'Swift', d_swift: '+10% move speed',
    u_vital: 'Vitality', d_vital: '+25 max HP and heal 25',
    u_slot: 'Echo slot', d_slot: '+1 echo can exist at once',
    u_epower: 'Echo power', d_epower: 'Echoes deal +20% damage',
    u_earmor: 'Echo armor', d_earmor: 'Echoes have +40% HP',
    u_repair: 'Repair', d_repair: 'Heal 50% of max HP now',
    u_magnet: 'Magnet', d_magnet: '+60% pickup range',
    u_pierce: 'Piercing', d_pierce: 'Bullets pass through +1 enemy',
    m_hp: 'Max HP', md_hp: '+10 HP per level', m_dmg: 'Damage', md_dmg: '+6% per level',
    m_slots: 'Starting echo slots', md_slots: '+1 slot per level', m_gain: 'Coin gain', md_gain: '+10% per level', maxed: 'MAX'
  },
  zh: {
    ready: '移动即开始', readyKeys: 'WASD / 方向键 / 按住鼠标', readyTouch: '按住屏幕任意位置拖动',
    round: '第', rewind: '时间倒流', youAgo: '你刚才的 20 秒，变成了一个「回声」。', youAgo2: '它会重复你走过的路线，和你并肩作战。', lblYou: '现在的你', lblPast: '过去的你', tipEcho: '回声在重复你上一轮的走位，一起打！',
    boss: 'BOSS 来袭', bossDown: 'BOSS 已击破', streak: '连杀', tagline: '每 20 秒，时间倒流一次。', tagline2: '过去的你，会和你并肩作战。',
    nextUnlock: '再玩 {n} 局解锁 {c}', lblKills: '击杀', language: '语言',
    cardsTitle: '第 {n} 轮<span class="c">完成</span>', cardsSub: '小队：{e} 个回声 · 选择一项强化',
    nextBody: '下一轮兵种', locked: '再玩 {n} 局解锁', reroll: '重抽', echoTag: '小队', selfTag: '本体',
    deadTitle: '你<span class="c">倒下了</span>', deadSub: '第 {n} 轮。你的小队还在等你。',
    revive: '复活', giveUp: '结束本局',
    resTitle: '本局<span class="c">结束</span>', resSub: '用金币购买永久强化，然后再来一局。', newBest: '新纪录！',
    lblRound: '轮次', lblBest: '最佳', lblEarned: '本局获得', lblBank: '金币',
    double: '金币翻倍', again: '再来一局', doubled: '金币已翻倍！', noAd: '暂时没有可用广告。',
    unlocked: '解锁新兵种：{c}',
    pauseTitle: '已暂停', pauseSub: '歇一会儿。', resume: '继续',
    c_rifle: '步枪手', c_shotgun: '霰弹手', c_sniper: '狙击手', c_guardian: '护盾兵',
    u_power: '火力', d_power: '你和所有回声伤害 +20%',
    u_rapid: '速射', d_rapid: '全队射速 +15%',
    u_swift: '迅捷', d_swift: '移动速度 +10%',
    u_vital: '体魄', d_vital: '最大生命 +25 并回复 25',
    u_slot: '回声栏位', d_slot: '可同时存在的回声 +1',
    u_epower: '回声强化', d_epower: '回声伤害 +20%',
    u_earmor: '回声装甲', d_earmor: '回声生命 +40%',
    u_repair: '维修', d_repair: '立即回复 50% 最大生命',
    u_magnet: '磁力', d_magnet: '拾取范围 +60%',
    u_pierce: '穿透', d_pierce: '子弹可多穿透 1 个敌人',
    m_hp: '最大生命', md_hp: '每级 +10', m_dmg: '伤害', md_dmg: '每级 +6%',
    m_slots: '初始回声栏位', md_slots: '每级 +1', m_gain: '金币加成', md_gain: '每级 +10%', maxed: '已满'
  }
};
var lang = 'en';
function tr(k, vars) {
  var s = (T[lang] && T[lang][k]) || T.en[k] || k;
  if (vars) for (var v in vars) s = s.replace('{' + v + '}', vars[v]);
  return s;
}

/* ============================== save ============================== */
var SAVE_KEY = 'echo-squad-v1';
var save = { coins: 0, meta: { hp: 0, dmg: 0, slots: 0, gain: 0 }, runs: 0, best: 0, lang: null, mute: false, seenRewind: false };
function loadSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) { var o = JSON.parse(raw); for (var k in o) if (k in save) save[k] = o[k]; }
  } catch (e) {}
  if (!save.meta || typeof save.meta !== 'object') save.meta = { hp: 0, dmg: 0, slots: 0, gain: 0 };
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

/* ============================== helpers ============================== */
function $(id) { return document.getElementById(id); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function hsl(h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; }

/* ============================== audio ============================== */
var AC = null, master = null, noiseBuf = null, muted = false, adMuted = false, lastShot = 0;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    AC = new Ctx(); master = AC.createGain(); master.connect(AC.destination); applyMute();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.4, AC.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function applyMute() { if (master) master.gain.value = (muted || adMuted || Ads.platformMuted()) ? 0 : 0.5; $('muteWave').style.display = muted ? 'none' : ''; }
function tone(f, f2, t, type, v, delay) {
  if (!AC || muted || adMuted) return;
  var t0 = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + t);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + t + 0.02);
}
function noise(t, v, freq) {
  if (!AC || muted || adMuted) return;
  var s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq || 1200;
  g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0008, AC.currentTime + t);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(AC.currentTime + t + 0.02);
}
var SFX = {
  shot: function (cls) {
    var now = performance.now(); if (now - lastShot < 55) return; lastShot = now;
    if (cls === 'shotgun') { noise(0.12, 0.10, 1800); tone(180, 70, 0.1, 'square', 0.04); }
    else if (cls === 'sniper') { tone(1400, 200, 0.16, 'sawtooth', 0.06); noise(0.08, 0.05, 4000); }
    else tone(720, 380, 0.06, 'square', 0.028);
  },
  pulse: function () { tone(220, 90, 0.25, 'sine', 0.09); },
  kill: function () { noise(0.1, 0.06, 900); tone(300, 120, 0.08, 'triangle', 0.04); },
  bigKill: function () { noise(0.35, 0.16, 600); tone(140, 40, 0.4, 'sawtooth', 0.08); },
  hurt: function () { tone(160, 60, 0.22, 'sawtooth', 0.12); noise(0.12, 0.08, 500); },
  coin: function (n) { tone(880 + Math.min(n, 12) * 40, 0, 0.07, 'triangle', 0.035); },
  heal: function () { tone(520, 0, 0.09, 'sine', 0.06); tone(780, 0, 0.12, 'sine', 0.06, 0.08); },
  block: function () { tone(1800, 1200, 0.04, 'square', 0.015); },
  rewind: function () { tone(900, 90, 0.9, 'sawtooth', 0.06); tone(1350, 130, 0.9, 'sine', 0.04); },
  card: function () { tone(520, 0, 0.08, 'triangle', 0.06); tone(780, 0, 0.1, 'triangle', 0.06, 0.07); tone(1040, 0, 0.14, 'triangle', 0.06, 0.14); },
  click: function () { tone(600, 0, 0.04, 'triangle', 0.04); },
  buy: function () { tone(660, 0, 0.07, 'square', 0.04); tone(990, 0, 0.12, 'square', 0.04, 0.07); },
  over: function () { tone(330, 0, 0.2, 'triangle', 0.08); tone(247, 0, 0.2, 'triangle', 0.08, 0.2); tone(165, 0, 0.5, 'triangle', 0.08, 0.4); },
  boss: function () { tone(70, 50, 0.9, 'sawtooth', 0.12); tone(74, 52, 0.9, 'sawtooth', 0.1, 0.05); },
  echoDown: function () { tone(400, 100, 0.2, 'sine', 0.05); }
};

/* Generative music: one extra voice joins for every echo in the squad, so the track grows with your army. */
var music = { on: false, step: 0, next: 0, timer: 0 };
var SCALE = [0, 3, 5, 7, 10, 12, 15, 17];                      // A minor pentatonic
var BASS = [0, 0, 0, 0, -4, -4, -4, -4, -7, -7, -7, -7, -5, -5, -2, -2];
function mnote(semi, t0, dur, type, vol) {
  var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = 110 * Math.pow(2, semi / 12);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
}
function musicTick() {
  if (!AC || !run) return;
  var live = state === 'play' && !paused && !adPause && !muted;
  if (!live) { music.next = 0; return; }
  if (!music.next || music.next < AC.currentTime) music.next = AC.currentTime + 0.05;
  var spb = 60 / (112 + Math.min(run.round, 15) * 2) / 4;        // sixteenth notes, tempo creeps up with the round
  while (music.next < AC.currentTime + 0.25) {
    var st = music.step++ % 64, bar = (st / 4) | 0, voices = Math.min(echoes.length, 6), root = BASS[bar % 16];
    if (st % 4 === 0) mnote(root - 12, music.next, 0.32, 'triangle', 0.10);
    if (st % 8 === 4 && voices >= 1) mnote(root, music.next, 0.12, 'square', 0.018);
    for (var v = 0; v < voices; v++) {
      var pat = (st * (v + 3) + v * 5) % 8;
      if ((st + v) % (v % 2 ? 3 : 2) === 0) mnote(root + 12 + SCALE[pat] + (v > 2 ? 12 : 0), music.next, 0.16, v % 2 ? 'sine' : 'triangle', 0.022);
    }
    if (run.bossAlive && st % 2 === 0) mnote(root - 24, music.next, 0.08, 'sawtooth', 0.05);
    music.next += spb;
  }
}
setInterval(musicTick, 80);

/* ============================== state ============================== */
var cv = $('game'), ctx = cv.getContext('2d');
var CW = 0, CH = 0, DPR = 1, scale = 1, ox = 0, oy = 0;
var W = 1280, H = 720;

var state = 'ready';      // ready | play | rewind | cards | dead | results
var paused = false, adPause = false;
var run = null, player = null;
var echoes = [], enemies = [], bullets = [], shards = [], parts = [], texts = [], rings = [], warns = [];
var recBuf = null;
var shake = 0, flash = 0, banner = null, rewindT = 0, rewindDur = 1, deadT = 0, hitStop = 0;
var nextId = 1, time = 0, killStreak = 0, streakT = 0, coinPop = 0, backdrop = null, glowCache = {};

function newRun() {
  var portrait = innerHeight > innerWidth * 1.15;
  W = portrait ? 720 : 1280; H = portrait ? 1180 : 720;
  run = {
    round: 1, tick: 0, time: 0, coins: 0, kills: 0, revived: false, rerolls: 0,
    dmgMul: 1 + 0.06 * save.meta.dmg, rateMul: 1, speedMul: 1, echoDmg: 0.7, echoHp: 1, magnet: 1, pierce: 0,
    slots: 4 + save.meta.slots, nextCls: 'rifle', spawns: [], si: 0, bossAlive: false, doubled: false, newBest: false
  };
  var hp = 100 + 10 * save.meta.hp;
  player = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 16, hp: hp, maxHp: hp, cls: 'rifle', cool: 0.3, inv: 0, aim: -Math.PI / 2, isPlayer: true, alive: true };
  echoes = []; enemies = []; bullets = []; shards = []; parts = []; texts = []; rings = []; warns = [];
  recBuf = new Float32Array(ROUND_TICKS * 2);
  buildSpawns(); fit(); buildBackdrop();
  banner = null; killStreak = 0; streakT = 0;
}

/* ============================== spawning ============================== */
function budgetFor(w) { return Math.round(18 * Math.pow(1.17, w - 1) + 6 * (w - 1)); }
function edgePoint() {
  var s = (Math.random() * 4) | 0, m = 24;
  if (s === 0) return { x: rand(m, W - m), y: m };
  if (s === 1) return { x: rand(m, W - m), y: H - m };
  if (s === 2) return { x: m, y: rand(m, H - m) };
  return { x: W - m, y: rand(m, H - m) };
}
function buildSpawns() {
  var w = run.round, list = [], budget = budgetFor(w), isBoss = w % 5 === 0;
  if (isBoss) { budget = Math.round(budget * 0.5); list.push({ t: 90, type: 'boss', x: W / 2, y: 60 }); }
  var types = [];
  for (var k in ENEMY) if (ENEMY[k].from <= w) types.push(k);
  var span = ROUND_TICKS * 0.78, guardN = 0;
  while (budget > 0) {
    var tot = 0, i; for (i = 0; i < types.length; i++) tot += ENEMY[types[i]].w;
    var r = Math.random() * tot, type = types[0];
    for (i = 0; i < types.length; i++) { r -= ENEMY[types[i]].w; if (r <= 0) { type = types[i]; break; } }
    if (ENEMY[type].cost > budget) type = 'chaser';
    var n = type === 'chaser' ? Math.min(budget, 3 + ((Math.random() * 4) | 0)) : 1;
    var p = edgePoint(), t = 30 + Math.random() * span;
    for (var j = 0; j < n; j++) {
      list.push({ t: (t + j * 6) | 0, type: type, x: clamp(p.x + rand(-60, 60), 20, W - 20), y: clamp(p.y + rand(-60, 60), 20, H - 20) });
    }
    budget -= ENEMY[type].cost * n;
  }
  list.sort(function (a, b) { return a.t - b.t; });
  run.spawns = list; run.si = 0;
}
function spawnEnemy(type, x, y) {
  var d = ENEMY[type], w = run.round;
  var hpS = 1 + 0.10 * (w - 1), spS = Math.min(1.35, 1 + 0.02 * (w - 1));
  var e = { id: nextId++, type: type, x: x, y: y, vx: 0, vy: 0, r: d.r, hp: d.hp * hpS, maxHp: d.hp * hpS, speed: d.speed * spS, dmg: d.dmg,
    touch: 0, cool: rand(1, 2.2), cool2: 3, flash: 0, face: 0, stun: 0.25, target: player, retarget: (Math.random() * 15) | 0, born: 0 };
  if (type === 'boss') { e.hp = e.maxHp = d.hp * (w / 5) * hpS; run.bossAlive = true; banner = { text: tr('boss'), t: 2.2, hue: 0 }; SFX.boss(); shake = 14; }
  enemies.push(e);
  return e;
}

/* ============================== combat ============================== */
function unitsAlive() { var u = [player]; for (var i = 0; i < echoes.length; i++) if (echoes[i].alive) u.push(echoes[i]); return u; }

function nearestEnemy(x, y, range) {
  var best = null, bd = range;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i], d = Math.hypot(e.x - x, e.y - y) - e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function unitFire(u) {
  var c = CLASSES[u.cls], isEcho = !u.isPlayer;
  var mul = run.dmgMul * (isEcho ? run.echoDmg : 1);
  u.cool -= TICK;
  if (c.pulse) {
    if (u.cool <= 0 && nearestEnemy(u.x, u.y, c.pulseR + 40)) {
      u.cool = c.pulse / run.rateMul;
      rings.push({ x: u.x, y: u.y, r: 10, max: c.pulseR, t: 0, dur: 0.3, hue: c.hue });
      if (!isEcho) SFX.pulse();
      for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i], dx = e.x - u.x, dy = e.y - u.y, d = Math.hypot(dx, dy);
        if (d < c.pulseR + e.r) {
          var kb = e.type === 'boss' ? 0 : e.type === 'tank' ? 120 : 320;
          e.vx += dx / (d || 1) * kb; e.vy += dy / (d || 1) * kb; e.stun = Math.max(e.stun, 0.25);
          damageEnemy(e, c.dmg * mul, dx, dy);
        }
      }
    }
    return;
  }
  var tgt = nearestEnemy(u.x, u.y, c.range);
  if (tgt) {
    var d0 = Math.hypot(tgt.x - u.x, tgt.y - u.y), lead = d0 / c.bs;
    var want = Math.atan2(tgt.y + tgt.vy * lead - u.y, tgt.x + tgt.vx * lead - u.x);
    u.aim += angDiff(want, u.aim) * 0.35;
    if (u.cool <= 0) {
      u.cool = 1 / (c.rate * run.rateMul);
      for (var p = 0; p < c.pellets; p++) {
        var a = want + (c.pellets > 1 ? (p / (c.pellets - 1) - 0.5) * c.spread : rand(-c.spread, c.spread));
        var sp = c.bs * (c.pellets > 1 ? rand(0.85, 1.1) : 1);
        bullets.push({ x: u.x + Math.cos(a) * 18, y: u.y + Math.sin(a) * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          dmg: c.dmg * mul, pierce: c.pierce + run.pierce, life: c.range / c.bs * 1.15, friendly: true, r: u.cls === 'sniper' ? 5 : 3.5,
          hue: isEcho ? u.hue : 190, hit: null, big: u.cls === 'sniper' });
      }
      if (!isEcho) SFX.shot(u.cls);
      u.kick = 1;
    }
  }
}

function damageEnemy(e, dmg, dx, dy) {
  if (e.hp <= 0) return;
  e.hp -= dmg; e.flash = 0.08;
  if (e.hp <= 0) killEnemy(e, dx, dy);
}
function killEnemy(e, dx, dy) {
  var i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  var d = ENEMY[e.type], hue = enemyHue(e.type);
  burst(e.x, e.y, hue, e.type === 'boss' ? 70 : 8 + d.cost * 3, e.type === 'boss' ? 420 : 200);
  run.kills++; killStreak++; streakT = 1.4;
  if (killStreak === 10 || killStreak === 25 || killStreak === 50 || killStreak === 100) { banner = { text: '×' + killStreak + ' ' + tr('streak'), t: 1.3, hue: 48, small: true }; tone(660, 0, 0.08, 'triangle', 0.06); tone(990, 0, 0.14, 'triangle', 0.06, 0.08); }
  var n = d.drop;
  for (var k = 0; k < n; k++) shards.push({ x: e.x, y: e.y, vx: rand(-160, 160), vy: rand(-160, 160), life: 14, kind: 'coin' });
  if (Math.random() < 0.035 || e.type === 'boss') shards.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), life: 14, kind: 'heart' });
  if (e.type === 'splitter') for (var m = 0; m < 3; m++) { var s = spawnEnemy('mini', e.x + rand(-12, 12), e.y + rand(-12, 12)); s.vx = rand(-200, 200); s.vy = rand(-200, 200); s.stun = 0.3; }
  if (e.type === 'boss') {
    run.bossAlive = false; SFX.bigKill(); shake = 22; flash = 0.5; hitStop = 0.12;
    banner = { text: tr('bossDown'), t: 2, hue: 150 }; Ads.happy();
  } else { SFX.kill(); if (d.cost >= 4) shake = Math.max(shake, 5); }
}

function auraFactor(u) {
  var units = unitsAlive(), R = CLASSES.guardian.auraR;
  for (var i = 0; i < units.length; i++) {
    var g = units[i];
    if (g.cls === 'guardian' && Math.hypot(g.x - u.x, g.y - u.y) < R) return 0.5;
  }
  return 1;
}
function hurtUnit(u, dmg) {
  dmg *= auraFactor(u);
  if (u.isPlayer) {
    if (u.inv > 0) return false;
    if (run.time < 60) dmg *= 0.5;                 // gentle first minute: nobody dies before they understand the game
    u.hp -= dmg; u.inv = 0.55; shake = Math.max(shake, 9); flash = Math.max(flash, 0.25); SFX.hurt();
    texts.push({ x: u.x, y: u.y - 26, text: '-' + Math.round(dmg), t: 0.7, hue: 350 });
    if (u.hp <= 0) { u.hp = 0; playerDied(); }
  } else {
    u.hp -= dmg; u.flash = 0.1;
    if (u.hp <= 0) { u.alive = false; burst(u.x, u.y, u.hue, 14, 160); SFX.echoDown(); }
  }
  return true;
}

function burst(x, y, hue, n, speed) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * TAU, s = rand(0.2, 1) * speed;
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(0.25, 0.7), hue: hue, size: rand(2, 5) });
  }
  if (parts.length > 700) parts.splice(0, parts.length - 700);
}
function enemyHue(t) { return t === 'tank' ? 24 : t === 'shooter' ? 320 : t === 'guard' ? 205 : t === 'splitter' ? 75 : t === 'mini' ? 75 : t === 'boss' ? 0 : 350; }

/* ============================== input ============================== */
var keys = {}, mouse = { down: false, x: 0, y: 0 }, stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, botInput = null;
var isTouch = false;
function inputVec() {
  if (botInput) return botInput;
  var x = 0, y = 0;
  if (keys.ArrowLeft || keys.KeyA) x -= 1; if (keys.ArrowRight || keys.KeyD) x += 1;
  if (keys.ArrowUp || keys.KeyW) y -= 1; if (keys.ArrowDown || keys.KeyS) y += 1;
  if (x || y) { var l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
  if (stick.on) {
    var sx = stick.x - stick.ox, sy = stick.y - stick.oy, sl = Math.hypot(sx, sy);
    if (sl < 6) return { x: 0, y: 0 };
    var m = Math.min(1, sl / 48); return { x: sx / sl * m, y: sy / sl * m };
  }
  if (mouse.down && player) {
    var px = ox + player.x * scale, py = oy + player.y * scale;
    var dx = mouse.x - px, dy = mouse.y - py, dl = Math.hypot(dx, dy);
    if (dl < 10) return { x: 0, y: 0 };
    var mm = Math.min(1, dl / 70); return { x: dx / dl * mm, y: dy / dl * mm };
  }
  return { x: 0, y: 0 };
}
function firstInput() { audioInit(); if (state === 'ready') { state = 'play'; setPlaying(true); Ads.gameplayStart(); } }

addEventListener('keydown', function (e) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (/^(Arrow|Key[WASD])/.test(e.code)) firstInput();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') toggleMute();
  if (state === 'cards' && /^(Digit|Numpad)[123]$/.test(e.code)) { var b = $('cardList').children[+e.code.slice(-1) - 1]; if (b) b.click(); }
  if (state === 'results' && (e.code === 'Enter' || e.code === 'Space') && !$('btnAgain').disabled) $('btnAgain').click();
});
addEventListener('keyup', function (e) { keys[e.code] = false; });
addEventListener('blur', function () { keys = {}; mouse.down = false; });
cv.addEventListener('mousedown', function (e) { if (isTouch) return; mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; firstInput(); });
addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mouseup', function () { mouse.down = false; });
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('touchstart', function (e) {
  e.preventDefault(); isTouch = true;
  var t = e.changedTouches[0];
  if (!stick.on) { stick.on = true; stick.id = t.identifier; stick.ox = stick.x = t.clientX; stick.oy = stick.y = t.clientY; }
  firstInput();
}, { passive: false });
cv.addEventListener('touchmove', function (e) {
  e.preventDefault();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    if (t.identifier === stick.id) {
      stick.x = t.clientX; stick.y = t.clientY;
      var dx = stick.x - stick.ox, dy = stick.y - stick.oy, l = Math.hypot(dx, dy);
      if (l > 70) { stick.ox = stick.x - dx / l * 70; stick.oy = stick.y - dy / l * 70; }   // origin follows the thumb
    }
  }
}, { passive: false });
function touchEnd(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === stick.id) { stick.on = false; stick.id = null; } }
cv.addEventListener('touchend', touchEnd); cv.addEventListener('touchcancel', touchEnd);

/* ============================== simulation ============================== */
function step() {
  time += TICK;
  if (state !== 'play') return;
  run.time += TICK;
  var t = run.tick, i, j, e, u;

  // ---- player movement
  var iv = inputVec(), sp = 330 * run.speedMul, k = 0.22;
  player.vx += (iv.x * sp - player.vx) * k; player.vy += (iv.y * sp - player.vy) * k;
  player.x = clamp(player.x + player.vx * TICK, player.r, W - player.r);
  player.y = clamp(player.y + player.vy * TICK, player.r, H - player.r);
  if (player.inv > 0) player.inv -= TICK;
  recBuf[t * 2] = player.x; recBuf[t * 2 + 1] = player.y;

  // ---- echoes replay their recorded path
  for (i = 0; i < echoes.length; i++) {
    u = echoes[i]; u.x = u.rec[t * 2]; u.y = u.rec[t * 2 + 1];
    if (u.flash > 0) u.flash -= TICK;
    if (u.alive) unitFire(u);
  }
  unitFire(player);

  // ---- spawns (telegraphed 0.7s ahead)
  while (run.si < run.spawns.length && run.spawns[run.si].t - 42 <= t) {
    var s = run.spawns[run.si++];
    if (Math.hypot(s.x - player.x, s.y - player.y) < 240) { s.x = W - s.x; s.y = H - s.y; }
    warns.push({ x: s.x, y: s.y, t: s.t, type: s.type });
  }
  for (i = warns.length - 1; i >= 0; i--) {
    if (warns[i].t <= t) {
      if (enemies.length < ENEMY_CAP || warns[i].type === 'boss') { spawnEnemy(warns[i].type, warns[i].x, warns[i].y); warns.splice(i, 1); }
      else warns[i].t = t + 30;
    }
  }

  // ---- enemies
  var units = unitsAlive();
  for (i = 0; i < enemies.length; i++) {
    e = enemies[i]; e.born += TICK;
    if (e.flash > 0) e.flash -= TICK; if (e.touch > 0) e.touch -= TICK;
    if (--e.retarget <= 0 || !e.target.alive) {
      e.retarget = 15;
      if (e.type === 'guard' || e.type === 'boss') e.target = player;
      else {
        var bd = 1e9, bt = player;
        for (j = 0; j < units.length; j++) {
          var dd = Math.hypot(units[j].x - e.x, units[j].y - e.y) * (units[j].isPlayer ? 0.8 : 1);
          if (dd < bd) { bd = dd; bt = units[j]; }
        }
        e.target = bt;
      }
    }
    var tx = e.target.x - e.x, ty = e.target.y - e.y, td = Math.hypot(tx, ty) || 1, ax = tx / td, ay = ty / td;
    if (e.stun > 0) { e.stun -= TICK; ax = ay = 0; }
    else if (e.type === 'shooter') {
      if (td < 300) { ax = -ax; ay = -ay; } else if (td < 420) { var px = -ay; ay = ax; ax = px; }
      e.cool -= TICK;
      if (e.cool <= 0 && td < 560) {
        e.cool = 2.3; var ba = Math.atan2(ty, tx);
        bullets.push({ x: e.x, y: e.y, vx: Math.cos(ba) * 270, vy: Math.sin(ba) * 270, dmg: e.dmg, pierce: 0, life: 3.2, friendly: false, r: 6, hue: 320 });
      }
    } else if (e.type === 'boss') {
      e.cool -= TICK; e.cool2 -= TICK;
      if (e.cool <= 0) { e.cool = 3; var n = 12 + Math.min(8, run.round / 5 * 2), off = Math.random() * TAU;
        for (j = 0; j < n; j++) { var a2 = off + j / n * TAU; bullets.push({ x: e.x, y: e.y, vx: Math.cos(a2) * 230, vy: Math.sin(a2) * 230, dmg: 12, pierce: 0, life: 5, friendly: false, r: 7, hue: 0 }); }
        rings.push({ x: e.x, y: e.y, r: e.r, max: e.r + 60, t: 0, dur: 0.3, hue: 0 }); }
      if (e.cool2 <= 0) { e.cool2 = 5; for (j = 0; j < 3; j++) if (enemies.length < ENEMY_CAP) spawnEnemy('chaser', e.x + rand(-40, 40), e.y + rand(-40, 40)); }
    }
    var wantFace = Math.atan2(player.y - e.y, player.x - e.x);
    e.face += clamp(angDiff(wantFace, e.face), -2.6 * TICK, 2.6 * TICK);
    e.vx += (ax * e.speed - e.vx) * 0.12; e.vy += (ay * e.speed - e.vy) * 0.12;
    e.x = clamp(e.x + e.vx * TICK, e.r, W - e.r); e.y = clamp(e.y + e.vy * TICK, e.r, H - e.r);
    // contact damage
    for (j = 0; j < units.length; j++) {
      u = units[j];
      if (e.touch <= 0 && Math.hypot(u.x - e.x, u.y - e.y) < e.r + u.r) {
        if (hurtUnit(u, e.dmg)) { e.touch = 0.7; e.vx -= ax * 260; e.vy -= ay * 260; }
        if (state !== 'play') return;
      }
    }
  }
  // separation
  for (i = 0; i < enemies.length; i++) for (j = i + 1; j < enemies.length; j++) {
    var a = enemies[i], b = enemies[j], sx = b.x - a.x, sy = b.y - a.y, min = a.r + b.r;
    if (Math.abs(sx) < min && Math.abs(sy) < min) {
      var sd = Math.hypot(sx, sy) || 0.01;
      if (sd < min) { var push = (min - sd) * 0.5, wa = b.r / (a.r + b.r), nx = sx / sd, ny = sy / sd;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * (1 - wa); b.y += ny * push * (1 - wa); }
    }
  }

  // ---- bullets
  for (i = bullets.length - 1; i >= 0; i--) {
    var bl = bullets[i]; bl.life -= TICK;
    bl.px = bl.x; bl.py = bl.y; bl.x += bl.vx * TICK; bl.y += bl.vy * TICK;
    var dead = bl.life <= 0 || bl.x < -20 || bl.y < -20 || bl.x > W + 20 || bl.y > H + 20;
    if (!dead && bl.friendly) {
      for (j = enemies.length - 1; j >= 0; j--) {
        e = enemies[j];
        if (bl.hit && bl.hit.indexOf(e.id) >= 0) continue;
        var rr = e.r + bl.r + 4;
        if (Math.abs(e.x - bl.x) < rr && Math.abs(e.y - bl.y) < rr && Math.hypot(e.x - bl.x, e.y - bl.y) < rr) {
          if (e.type === 'guard' && Math.abs(angDiff(Math.atan2(-bl.vy, -bl.vx), e.face)) < 1.15) {
            parts.push({ x: bl.x, y: bl.y, vx: -bl.vx * 0.15 + rand(-80, 80), vy: -bl.vy * 0.15 + rand(-80, 80), t: 0, max: 0.2, hue: 205, size: 3 });
            SFX.block(); dead = true; break;
          }
          damageEnemy(e, bl.dmg, bl.vx, bl.vy);
          parts.push({ x: bl.x, y: bl.y, vx: rand(-90, 90), vy: rand(-90, 90), t: 0, max: 0.18, hue: bl.hue, size: 2.5 });
          if (bl.pierce > 0) { bl.pierce--; (bl.hit || (bl.hit = [])).push(e.id); bl.dmg *= 0.8; } else { dead = true; break; }
        }
      }
    } else if (!dead) {
      for (j = 0; j < units.length; j++) {
        u = units[j];
        if (u.alive && Math.hypot(u.x - bl.x, u.y - bl.y) < u.r + bl.r) {
          if (hurtUnit(u, bl.dmg) || !u.isPlayer) dead = true;
          if (state !== 'play') return;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }

  // ---- pickups: only the living body can collect, so you must leave your echoes' cover
  var mr = 95 * run.magnet;
  for (i = shards.length - 1; i >= 0; i--) {
    var sh = shards[i]; sh.life -= TICK;
    var dx = player.x - sh.x, dy = player.y - sh.y, dist = Math.hypot(dx, dy) || 1;
    if (dist < mr) { var pull = 900 * (1 - dist / mr) + 250; sh.vx += dx / dist * pull * TICK * 6; sh.vy += dy / dist * pull * TICK * 6; }
    sh.vx *= 0.92; sh.vy *= 0.92;
    sh.x = clamp(sh.x + sh.vx * TICK, 8, W - 8); sh.y = clamp(sh.y + sh.vy * TICK, 8, H - 8);
    if (dist < 24) {
      if (sh.kind === 'heart') { player.hp = Math.min(player.maxHp, player.hp + 20); SFX.heal(); texts.push({ x: player.x, y: player.y - 26, text: '+20', t: 0.8, hue: 150 }); }
      else { run.coins++; coinPop = 1; run.combo = (run.comboT > 0 ? run.combo : 0) + 1; run.comboT = 0.5; SFX.coin(run.combo); }
      shards.splice(i, 1);
    } else if (sh.life <= 0) shards.splice(i, 1);
  }
  if (run.comboT > 0) run.comboT -= TICK;
  if (streakT > 0) { streakT -= TICK; if (streakT <= 0) killStreak = 0; }
  for (i = rings.length - 1; i >= 0; i--) { rings[i].t += TICK; if (rings[i].t >= rings[i].dur) rings.splice(i, 1); }

  // ---- round clock
  run.tick++;
  var leftT = ROUND_TICKS - run.tick;
  if (leftT === 180 || leftT === 120 || leftT === 60) tone(leftT === 60 ? 1100 : 880, 0, 0.09, 'sine', 0.07);
  if (run.tick >= ROUND_TICKS) startRewind();
}

/* ============================== round flow ============================== */
function startRewind() {
  state = 'rewind'; rewindT = 0; rewindDur = teaching() && run.round <= 2 ? 3.6 : 1.0;
  var idx = echoes.length ? echoes[echoes.length - 1].idx + 1 : 1;
  echoes.push({ rec: recBuf, cls: player.cls, idx: idx, hue: ECHO_HUES[(idx - 1) % ECHO_HUES.length], x: player.x, y: player.y, r: 15,
    hp: 1, maxHp: 1, alive: true, cool: 0.3, aim: 0, flash: 0, fresh: true });
  while (echoes.length > run.slots) echoes.shift();
  recBuf = new Float32Array(ROUND_TICKS * 2);
  bullets = bullets.filter(function (b) { return b.friendly; }); warns.length = 0;
  // shockwave: breathing room after the pick screen
  rings.push({ x: player.x, y: player.y, r: 20, max: 420, t: 0, dur: 0.5, hue: 190 });
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i], dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
    if (d < 420 && e.type !== 'boss') { e.vx += dx / d * 520; e.vy += dy / d * 520; }
    e.stun = Math.max(e.stun, 1.2);
  }
  SFX.rewind(); flash = 0.35;
}
function endRewind() {
  save.seenRewind = true; writeSave();
  openCards();
}
function beginNextRound() {
  run.round++; run.tick = 0;
  player.cls = run.nextCls; player.cool = 0.3;
  for (var i = 0; i < echoes.length; i++) {
    var u = echoes[i]; u.alive = true; u.fresh = false; u.maxHp = 60 * run.echoHp * (1 + 0.1 * save.meta.hp); u.hp = u.maxHp; u.cool = 0.3 + i * 0.03;
    u.x = u.rec[0]; u.y = u.rec[1];
  }
  for (var j = 0; j < enemies.length; j++) enemies[j].stun = Math.max(enemies[j].stun, 0.8);
  player.inv = Math.max(player.inv, 1);
  buildSpawns();
  if (teaching() && run.round === 2) banner = { text: tr('tipEcho'), t: 4.5, hue: 190, small: true };
  else if (run.round % 5 !== 0) banner = { text: (lang === 'zh' ? '第 ' + run.round + ' 轮' : tr('round') + ' ' + run.round), t: 1.1, hue: 190, small: true };
  state = 'play'; setPlaying(true);
}

function playerDied() {
  state = 'dead'; deadT = 0; player.alive = false; setPlaying(false);
  burst(player.x, player.y, 190, 50, 380); shake = 24; flash = 0.6; hitStop = 0.15; SFX.over();
  Ads.gameplayStop();
}
function revive() {
  run.revived = true; player.alive = true; player.hp = player.maxHp; player.inv = 2.5;
  rings.push({ x: player.x, y: player.y, r: 20, max: 380, t: 0, dur: 0.5, hue: 150 });
  for (var i = enemies.length - 1; i >= 0; i--) {
    var e = enemies[i], dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
    if (d < 380) { if (e.type === 'boss' || e.type === 'tank') { e.vx += dx / d * 500; e.vy += dy / d * 500; e.stun = 1.5; } else killEnemy(e, dx, dy); }
  }
  bullets = bullets.filter(function (b) { return b.friendly; });
  hide('ovDead'); state = 'play'; setPlaying(true); Ads.gameplayStart(); SFX.heal();
}

/* ============================== UI ============================== */
function show(id) { $(id).classList.add('on'); }
function hide(id) { $(id).classList.remove('on'); }
var toastTimer = 0;
function toast(msg) { var el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2200); }
function classUnlocked(k) { return save.runs >= CLASSES[k].unlock; }

var currentCards = [];
function rollCards() {
  var pool = UPGRADES.filter(function (u) { return u.ok(run); }), out = [];
  // guarantee at least one squad card while there is room to grow: the squad is the fantasy
  while (out.length < 3 && pool.length) { var i = (Math.random() * pool.length) | 0; out.push(pool.splice(i, 1)[0]); }
  if (!out.some(function (u) { return u.tag === 'echo'; })) {
    var squad = pool.filter(function (u) { return u.tag === 'echo'; });
    if (squad.length) out[2] = pick(squad);
  }
  return out;
}
function openCards() {
  state = 'cards'; setPlaying(false);
  currentCards = rollCards();
  renderCards(); show('ovCards');
}
function renderCards() {
  $('cardsTitle').innerHTML = tr('cardsTitle', { n: run.round });
  $('cardsSub').textContent = tr('cardsSub', { e: echoes.length });
  var list = $('cardList'); list.innerHTML = '';
  currentCards.forEach(function (u, i) {
    var b = document.createElement('button'); b.className = 'card'; b.style.setProperty('--hue', hsl(u.hue, 90, 62));
    b.innerHTML = '<div class="ico">' + u.ico + '</div><b>' + tr('u_' + u.key) + '</b><span>' + tr('d_' + u.key) + '</span><span class="tag">' + (u.tag === 'echo' ? tr('echoTag') : tr('selfTag')) + ' · ' + (i + 1) + '</span>';
    b.onclick = function () { if (state !== 'cards') return; u.apply(run); SFX.card(); hide('ovCards'); beginNextRound(); };
    list.appendChild(b);
  });
  var row = $('classRow'); row.innerHTML = '<div class="lbl">' + tr('nextBody') + '</div>';
  CLASS_ORDER.forEach(function (k) {
    var c = document.createElement('button'), ok = classUnlocked(k);
    c.className = 'chip' + (run.nextCls === k ? ' sel' : '') + (ok ? '' : ' lock');
    c.textContent = ok ? tr('c_' + k) : tr('c_' + k) + ' · ' + tr('locked', { n: CLASSES[k].unlock - save.runs });
    c.onclick = function () { if (!ok) return; run.nextCls = k; SFX.click(); renderCards(); };
    row.appendChild(c);
  });
  var rr = $('btnReroll'); rr.textContent = tr('reroll') + ' (' + (2 - run.rerolls) + ')';
  rr.style.display = Ads.canReward && run.rerolls < 2 ? '' : 'none';
}
$('btnReroll').onclick = function () {
  if (state !== 'cards') return;
  Ads.rewarded().then(function (ok) { if (ok) { run.rerolls++; currentCards = rollCards(); renderCards(); } else toast(tr('noAd')); });
};

function openDead() {
  $('deadTitle').innerHTML = tr('deadTitle'); $('deadSub').textContent = tr('deadSub', { n: run.round });
  $('btnRevive').textContent = tr('revive'); $('btnGiveUp').textContent = tr('giveUp');
  show('ovDead');
}
$('btnRevive').onclick = function () {
  $('btnRevive').disabled = true;
  Ads.rewarded().then(function (ok) { $('btnRevive').disabled = false; if (ok) revive(); else { toast(tr('noAd')); hide('ovDead'); openResults(); } });
};
$('btnGiveUp').onclick = function () { hide('ovDead'); openResults(); };

var earned = 0;
function openResults() {
  state = 'results';
  var unlockedBefore = CLASS_ORDER.filter(classUnlocked);
  earned = Math.round((run.coins + run.round * 4) * (1 + 0.1 * save.meta.gain));
  save.coins += earned; save.runs++;
  if (run.round > save.best) { save.best = run.round; run.newBest = save.runs > 1; }
  writeSave();
  if (run.newBest) Ads.happy();
  var fresh = CLASS_ORDER.filter(classUnlocked).filter(function (k) { return unlockedBefore.indexOf(k) < 0; });
  var nextK = CLASS_ORDER.filter(function (k) { return !classUnlocked(k); })[0];
  var hint = nextK ? tr('nextUnlock', { c: tr('c_' + nextK), n: CLASSES[nextK].unlock - save.runs }) : '';
  $('resNote').textContent = fresh.length ? tr('unlocked', { c: fresh.map(function (k) { return tr('c_' + k); }).join(', ') }) : (run.newBest ? tr('newBest') + (hint ? ' · ' + hint : '') : hint);
  renderResults(); show('ovResults');
}
function metaCost(m) { return Math.round(m.base * Math.pow(m.grow, save.meta[m.key])); }
function renderResults() {
  $('resTitle').innerHTML = tr('resTitle'); $('resSub').textContent = tr('resSub');
  $('lblRound').textContent = tr('lblRound'); $('lblBest').textContent = tr('lblBest'); $('lblEarned').textContent = tr('lblEarned'); $('lblBank').textContent = tr('lblBank');
  $('resRound').textContent = run.round; $('resBest').textContent = save.best; $('resCoins').textContent = '+' + earned; $('resBank').textContent = save.coins;
  $('btnDouble').textContent = tr('double'); $('btnAgain').textContent = tr('again');
  $('btnDouble').style.display = Ads.canReward && !run.doubled && earned > 0 ? '' : 'none';
  var shop = $('shop'); shop.innerHTML = '';
  META.forEach(function (m) {
    var lv = save.meta[m.key], maxed = lv >= m.max, cost = metaCost(m);
    var b = document.createElement('button'); b.className = 'up'; b.disabled = maxed || save.coins < cost;
    var pips = ''; for (var i = 0; i < m.max; i++) pips += i < lv ? '●' : '○';
    b.innerHTML = '<div class="n"><b>' + tr('m_' + m.key) + '</b><span>' + tr('md_' + m.key) + '</span><div class="pips">' + pips + '</div></div><div class="cost">' + (maxed ? tr('maxed') : '◈ ' + cost) + '</div>';
    b.onclick = function () { if (save.coins < cost || maxed) return; save.coins -= cost; save.meta[m.key]++; writeSave(); SFX.buy(); renderResults(); };
    shop.appendChild(b);
  });
}
$('btnDouble').onclick = function () {
  $('btnDouble').disabled = true;
  Ads.rewarded().then(function (ok) {
    $('btnDouble').disabled = false;
    if (ok) { run.doubled = true; save.coins += earned; earned *= 2; writeSave(); SFX.buy(); $('resNote').textContent = tr('doubled'); renderResults(); }
    else toast(tr('noAd'));
  });
};
$('btnAgain').onclick = function () {
  $('btnAgain').disabled = true;
  var go = function () { $('btnAgain').disabled = false; hide('ovResults'); newRun(); state = 'play'; setPlaying(true); Ads.gameplayStart(); };
  // never show an interstitial to a brand-new player: let them reach a second run first
  if (save.runs >= 2) Ads.interstitial().then(go); else go();
};

function togglePause(force) {
  if (state !== 'play' && !paused) return;
  paused = force != null ? force : !paused;
  setPlaying(!paused && state === 'play');
  if (paused) { $('pauseTitle').textContent = tr('pauseTitle'); $('pauseSub').textContent = tr('pauseSub'); $('btnResume').textContent = tr('resume'); show('ovPause'); Ads.gameplayStop(); }
  else { hide('ovPause'); Ads.gameplayStart(); }
}
$('btnPause').onclick = function () { togglePause(); };
$('btnResume').onclick = function () { togglePause(false); };
document.addEventListener('visibilitychange', function () { if (document.hidden && state === 'play' && !paused) togglePause(true); });

function toggleMute() { muted = !muted; save.mute = muted; writeSave(); audioInit(); applyMute(); }
$('btnMute').onclick = toggleMute;
$('btnLang').onclick = function () { setLang(lang === 'en' ? 'zh' : 'en'); save.lang = lang; writeSave(); };
function setLang(l) {
  lang = l; $('btnLang').textContent = l === 'en' ? 'EN' : '中'; document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  if (state === 'cards') renderCards(); if (state === 'results') renderResults(); if (state === 'dead' && $('ovDead').classList.contains('on')) openDead();
  if (paused) { $('pauseTitle').textContent = tr('pauseTitle'); $('pauseSub').textContent = tr('pauseSub'); $('btnResume').textContent = tr('resume'); }
}

Ads.onPause(function () { adPause = true; adMuted = true; applyMute(); });
Ads.onResume(function () { adPause = false; adMuted = false; applyMute(); last = performance.now(); });

/* ============================== rendering ============================== */
function buildBackdrop() {
  backdrop = document.createElement('canvas'); backdrop.width = W; backdrop.height = H;
  var b = backdrop.getContext('2d');
  var g = b.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, '#0f1a36'); g.addColorStop(1, '#070c1a'); b.fillStyle = g; b.fillRect(0, 0, W, H);
  b.strokeStyle = 'rgba(70,110,200,0.13)'; b.lineWidth = 1; b.beginPath();
  for (var x = 0; x <= W; x += 80) { b.moveTo(x, 0); b.lineTo(x, H); } for (var y = 0; y <= H; y += 80) { b.moveTo(0, y); b.lineTo(W, y); } b.stroke();
  b.fillStyle = 'rgba(120,170,255,0.35)'; for (x = 0; x <= W; x += 80) for (y = 0; y <= H; y += 80) b.fillRect(x - 1.5, y - 1.5, 3, 3);
  for (var i = 0; i < 90; i++) { b.fillStyle = 'rgba(180,210,255,' + rand(0.05, 0.3) + ')'; b.fillRect(rand(0, W), rand(0, H), rand(1, 2.2), rand(1, 2.2)); }
  b.strokeStyle = 'rgba(53,224,255,0.10)'; b.lineWidth = 2; b.beginPath(); b.arc(W / 2, H / 2, Math.min(W, H) * 0.28, 0, TAU); b.stroke();
  b.beginPath(); b.arc(W / 2, H / 2, Math.min(W, H) * 0.42, 0, TAU); b.setLineDash([4, 14]); b.stroke(); b.setLineDash([]);
}
function glow(x, y, r, hue, a) {
  var key = hue | 0, sp = glowCache[key];
  if (!sp) { sp = glowCache[key] = document.createElement('canvas'); sp.width = sp.height = 64; var g2 = sp.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, hsl(hue, 100, 70, 0.9)); gr.addColorStop(0.35, hsl(hue, 100, 60, 0.35)); gr.addColorStop(1, hsl(hue, 100, 50, 0)); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); }
  ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sp, x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function setPlaying(on) { document.body.classList.toggle('playing', !!on); }

function fit() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CW = innerWidth; CH = innerHeight;
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  var topPad = 54, pad = 10;
  scale = Math.min((CW - pad * 2) / W, (CH - topPad - pad) / H);
  ox = (CW - W * scale) / 2; oy = topPad + (CH - topPad - pad - H * scale) / 2;
}
addEventListener('resize', fit);

function poly(x, y, r, n, rot) {
  ctx.beginPath();
  for (var i = 0; i < n; i++) { var a = rot + i / n * TAU; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}

function teaching() { return save.runs === 0; }
function label(x, y, text, hue) {
  ctx.font = '800 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  var w = ctx.measureText(text).width + 16; y = Math.max(16, y);
  ctx.fillStyle = 'rgba(7,11,22,0.85)'; ctx.fillRect(x - w / 2, y - 12, w, 24);
  ctx.strokeStyle = hsl(hue, 100, 70, 0.9); ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - 12, w, 24);
  ctx.fillStyle = hsl(hue, 100, 82); ctx.fillText(text, x, y + 1);
  ctx.beginPath(); ctx.moveTo(x - 5, y + 12); ctx.lineTo(x + 5, y + 12); ctx.lineTo(x, y + 19); ctx.closePath(); ctx.fill();
}
function drawTape(rec, a, b, hue, alpha, width, dash) {
  if (b <= a) return; ctx.strokeStyle = hsl(hue, 100, 70, alpha); ctx.lineWidth = width; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); for (var i = a; i <= b; i += 3) ctx[i === a ? 'moveTo' : 'lineTo'](rec[i * 2], rec[i * 2 + 1]); ctx.lineTo(rec[b * 2], rec[b * 2 + 1]); ctx.stroke(); ctx.setLineDash([]);
}
function drawUnit(u, ghost, tickPos) {
  var c = CLASSES[u.cls], hue = ghost ? u.hue : 190, alpha = ghost ? 0.62 : 1;
  if (!ghost && u.inv > 0 && ((time * 14) | 0) % 2) alpha = 0.35;
  if (c.pulse) { ctx.strokeStyle = hsl(hue, 90, 65, 0.16 * alpha + 0.04 * Math.sin(time * 4)); ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(u.x, u.y, c.auraR, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.globalAlpha = alpha;
  // body
  ctx.fillStyle = hsl(190, 95, u.flash > 0 ? 95 : 62); ctx.strokeStyle = ghost ? hsl(hue, 100, 72) : hsl(190, 100, 85); ctx.lineWidth = ghost ? 4 : 2.5;
  glow(u.x, u.y, ghost ? 40 : 58, hue, ghost ? 0.35 : 0.8); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, TAU); ctx.fill(); ctx.stroke();
  // class marker
  ctx.fillStyle = '#070b16'; ctx.strokeStyle = '#070b16'; ctx.lineWidth = 3;
  if (c.pulse) { poly(u.x, u.y, 8, 6, time); ctx.stroke(); }
  else {
    var k = u.kick || 0; if (u.kick > 0) u.kick = Math.max(0, u.kick - 0.12);
    var len = (u.cls === 'sniper' ? 26 : u.cls === 'shotgun' ? 17 : 20) - k * 5, wd = u.cls === 'shotgun' ? 9 : u.cls === 'sniper' ? 4 : 6;
    ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(u.aim);
    ctx.fillStyle = hsl(hue, 100, 88); ctx.fillRect(4, -wd / 2, len, wd);
    ctx.fillStyle = '#070b16'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (ghost) {
    ctx.fillStyle = hsl(hue, 100, 88, 0.95); ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.idx, u.x, u.y - u.r - 11);
    if (u.hp < u.maxHp && u.alive) { ctx.fillStyle = '#0008'; ctx.fillRect(u.x - 14, u.y + u.r + 5, 28, 3); ctx.fillStyle = hsl(hue, 90, 65); ctx.fillRect(u.x - 14, u.y + u.r + 5, 28 * clamp(u.hp / u.maxHp, 0, 1), 3); }
  }
}

function drawEchoPath(u, t) {
  var rec = u.rec, a = Math.max(0, t - 26), b = Math.min(ROUND_TICKS - 1, t + 80), i;
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.strokeStyle = hsl(u.hue, 90, 65, 0.28); ctx.beginPath();
  for (i = a; i <= t; i += 2) ctx[i === a ? 'moveTo' : 'lineTo'](rec[i * 2], rec[i * 2 + 1]); ctx.stroke();
  ctx.strokeStyle = hsl(u.hue, 90, 70, 0.22); ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.beginPath();
  for (i = t; i <= b; i += 4) ctx[i === t ? 'moveTo' : 'lineTo'](rec[i * 2], rec[i * 2 + 1]); ctx.stroke(); ctx.setLineDash([]);
}

function drawEnemy(e) {
  var hue = enemyHue(e.type), lit = e.flash > 0 ? 96 : 60, grow = Math.min(1, e.born * 5 + 0.2), r = e.r * grow;
  ctx.fillStyle = hsl(hue, 90, lit, 0.92); ctx.strokeStyle = hsl(hue, 100, 80); ctx.lineWidth = 2;
  glow(e.x, e.y, r * 2.4, hue, 0.35);
  ctx.fillStyle = hsl(hue, 90, lit, 0.95); ctx.strokeStyle = hsl(hue, 100, 80); ctx.lineWidth = 2;
  var rot = Math.atan2(e.vy, e.vx);
  if (e.type === 'chaser' || e.type === 'mini') poly(e.x, e.y, r * 1.15, 3, rot);
  else if (e.type === 'tank') poly(e.x, e.y, r, 6, time * 0.4);
  else if (e.type === 'shooter') poly(e.x, e.y, r * 1.1, 4, time * 1.5);
  else if (e.type === 'guard') poly(e.x, e.y, r, 4, e.face + Math.PI / 4);
  else if (e.type === 'splitter') { ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 + 0.06 * Math.sin(time * 8 + e.id)), 0, TAU); }
  else poly(e.x, e.y, r, 8, time * 0.3);
  ctx.fill(); ctx.stroke();
  if (e.type === 'chaser' || e.type === 'tank' || e.type === 'splitter') { var ea = Math.atan2(e.target.y - e.y, e.target.x - e.x); ctx.fillStyle = '#070b16'; ctx.beginPath(); ctx.arc(e.x + Math.cos(ea) * r * 0.3, e.y + Math.sin(ea) * r * 0.3, Math.max(2.2, r * 0.2), 0, TAU); ctx.fill(); }
  if (e.type === 'guard') { ctx.strokeStyle = hsl(195, 100, 80, 0.95); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(e.x, e.y, r + 9, e.face - 1.15, e.face + 1.15); ctx.stroke(); }
  if (e.type === 'splitter') { ctx.fillStyle = '#070b16aa'; for (var i = 0; i < 3; i++) { var a = time * 2 + i / 3 * TAU; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r * 0.45, e.y + Math.sin(a) * r * 0.45, r * 0.22, 0, TAU); ctx.fill(); } }
  if (e.type === 'boss') { ctx.fillStyle = '#070b16'; ctx.beginPath(); ctx.arc(e.x + Math.cos(e.face) * 14, e.y + Math.sin(e.face) * 14, 13, 0, TAU); ctx.fill(); ctx.fillStyle = hsl(0, 100, 70); ctx.beginPath(); ctx.arc(e.x + Math.cos(e.face) * 18, e.y + Math.sin(e.face) * 18, 6, 0, TAU); ctx.fill(); }
  if ((e.type === 'tank' || e.type === 'guard') && e.hp < e.maxHp) { ctx.fillStyle = '#0009'; ctx.fillRect(e.x - r, e.y - r - 10, r * 2, 4); ctx.fillStyle = hsl(hue, 90, 65); ctx.fillRect(e.x - r, e.y - r - 10, r * 2 * clamp(e.hp / e.maxHp, 0, 1), 4); }
}

function render(dt) {
  var i, u, e;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070b16'; ctx.fillRect(0, 0, CW, CH);
  if (!run) return;
  var shx = 0, shy = 0; if (shake > 0.3) { shx = rand(-shake, shake); shy = rand(-shake, shake); shake *= Math.pow(0.0009, dt); } else shake = 0;
  ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * (ox + shx), DPR * (oy + shy));

  // arena
  var rewinding = state === 'rewind';
  if (backdrop) ctx.drawImage(backdrop, 0, 0); else { ctx.fillStyle = '#0a1122'; ctx.fillRect(0, 0, W, H); }
  var left = run ? 1 - run.tick / ROUND_TICKS : 1, urgent = state === 'play' && left < 0.15;
  ctx.strokeStyle = urgent ? hsl(48, 100, 65, 0.6 + 0.4 * Math.sin(time * 16)) : '#3560c0'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, W, H);
  ctx.strokeStyle = urgent ? hsl(48, 100, 65, 0.15) : 'rgba(53,96,192,0.18)'; ctx.lineWidth = 12; ctx.strokeRect(0, 0, W, H);

  // displayed tick (rewind runs the tape backwards)
  var t = run.tick;
  if (rewinding) { var p = clamp(rewindT / rewindDur, 0, 1), ez = p * p * (3 - 2 * p); t = Math.round((1 - ez) * (ROUND_TICKS - 1)); }
  t = clamp(t, 0, ROUND_TICKS - 1);

  // spawn telegraphs
  for (i = 0; i < warns.length; i++) { var wn = warns[i], wp = 1 - clamp((wn.t - run.tick) / 42, 0, 1), big = wn.type === 'boss' ? 60 : wn.type === 'tank' ? 30 : 16;
    ctx.strokeStyle = hsl(enemyHue(wn.type), 100, 65, 0.25 + 0.6 * wp); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wn.x, wn.y, big * (1.6 - 0.6 * wp), 0, TAU); ctx.stroke(); }

  // pickups
  for (i = 0; i < shards.length; i++) { var sh = shards[i]; if (sh.life < 3 && ((sh.life * 8) | 0) % 2) continue;
    if (sh.kind === 'heart') { ctx.fillStyle = hsl(150, 100, 65); ctx.font = '700 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✚', sh.x, sh.y); }
    else { ctx.fillStyle = hsl(45, 100, 65); poly(sh.x, sh.y, 5.5, 4, time * 3 + i); ctx.fill(); ctx.fillStyle = '#fff8'; poly(sh.x, sh.y, 2.2, 4, time * 3 + i); ctx.fill(); } }

  // rings
  for (i = 0; i < rings.length; i++) { var rg = rings[i], rp = rg.t / rg.dur; ctx.strokeStyle = hsl(rg.hue, 100, 70, 1 - rp); ctx.lineWidth = 5 * (1 - rp) + 1; ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r + (rg.max - rg.r) * (1 - Math.pow(1 - rp, 2)), 0, TAU); ctx.stroke(); }

  // echoes
  for (i = 0; i < echoes.length; i++) {
    u = echoes[i];
    if (rewinding) { u.x = u.rec[t * 2]; u.y = u.rec[t * 2 + 1]; }
    if (!u.alive) continue;
    if (!u.fresh || rewinding) drawEchoPath(u, t);
    drawUnit(u, true);
  }
  // enemies
  for (i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
  // bullets
  ctx.lineCap = 'round';
  for (i = 0; i < bullets.length; i++) { var b = bullets[i];
    if (b.friendly) { ctx.strokeStyle = hsl(b.hue, 100, 75, 0.95); ctx.lineWidth = b.big ? 5 : 3; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    else { glow(b.x, b.y, b.r * 3.2, b.hue, 0.7); ctx.fillStyle = hsl(b.hue, 100, 65); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill(); } }
  // the tape being recorded right now
  if (state === 'play' && run.tick > 2) drawTape(recBuf, teaching() && run.round === 1 ? 0 : Math.max(0, run.tick - 70), run.tick - 1, 190, teaching() && run.round === 1 ? 0.30 : 0.22, 3);
  // player
  if (player.alive) drawUnit(player, false);
  // C. rewind: spotlight the new echo travelling back along your own path
  if (rewinding) {
    var fe = echoes[echoes.length - 1];
    if (fe && fe.fresh) {
      if (rewindDur > 1.5) { ctx.fillStyle = 'rgba(7,11,22,0.66)'; ctx.fillRect(0, 0, W, H); }
      drawTape(fe.rec, 0, t, 190, 0.22, 3, [4, 10]);
      drawTape(fe.rec, t, ROUND_TICKS - 1, 190, 0.75, 5);
      drawUnit(fe, true); if (player.alive) drawUnit(player, false);
      if (rewindDur > 1.5) { label(fe.x, fe.y - 40, tr('lblPast'), fe.hue); if (Math.hypot(fe.x - player.x, fe.y - player.y) > 90) label(player.x, player.y - 42, tr('lblYou'), 190); }
    }
  }
  // D. first run: name who is who at the start of the next rounds
  if (state === 'play' && teaching() && run.round >= 2 && run.round <= 3 && run.tick < 330) {
    for (i = 0; i < echoes.length; i++) if (echoes[i].alive) label(echoes[i].x, echoes[i].y - 40, tr('lblPast'), echoes[i].hue);
    label(player.x, player.y - 42, tr('lblYou'), 190);
  }
  // particles
  for (i = parts.length - 1; i >= 0; i--) { var pt = parts[i]; pt.t += dt; if (pt.t >= pt.max) { parts.splice(i, 1); continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; var pa = 1 - pt.t / pt.max;
    ctx.fillStyle = hsl(pt.hue, 100, 68, pa); ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size * pa + 1, pt.size * pa + 1); }
  // floating text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (i = texts.length - 1; i >= 0; i--) { var tx = texts[i]; tx.t -= dt; if (tx.t <= 0) { texts.splice(i, 1); continue; } tx.y -= 40 * dt;
    ctx.font = '800 20px system-ui'; ctx.fillStyle = hsl(tx.hue, 100, 72, Math.min(1, tx.t * 3)); ctx.fillText(tx.text, tx.x, tx.y); }

  // ---------- screen-space HUD ----------
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (hudOff) return;
  if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.35 + ')'; ctx.fillRect(0, 0, CW, CH); flash = Math.max(0, flash - dt * 1.6); }
  if (player.alive && player.hp / player.maxHp < 0.3) { var vg = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.35, CW / 2, CH / 2, Math.max(CW, CH) * 0.7); vg.addColorStop(0, 'rgba(255,40,80,0)'); vg.addColorStop(1, 'rgba(255,40,80,' + (0.22 + 0.1 * Math.sin(time * 6)) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH); }

  if (rewinding) {
    ctx.fillStyle = 'rgba(53,224,255,0.07)'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (var sy = (time * 240) % 6; sy < CH; sy += 6) ctx.fillRect(0, sy, CW, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; for (i = 0; i < 3; i++) ctx.fillRect(0, (Math.sin(time * 9 + i * 2.1) * 0.5 + 0.5) * CH, CW, rand(2, 10));
    var teach = rewindDur > 1.5, fs = teach ? clamp(CW * 0.04, 22, 40) : clamp(CW * 0.07, 28, 64), ty = teach ? oy + fs : CH * 0.3;
    ctx.font = '900 ' + fs + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,60,120,0.55)'; ctx.fillText('◀◀ ' + tr('rewind'), CW / 2 - 3, ty);
    ctx.fillStyle = 'rgba(53,224,255,0.95)'; ctx.fillText('◀◀ ' + tr('rewind'), CW / 2 + 2, ty);
    if (teach) { var cs = clamp(CW * 0.026, 15, 24), cy = (oy + player.y * scale > CH * 0.58) ? oy + fs * 2.4 : CH - cs * 3.4; ctx.fillStyle = 'rgba(7,11,22,0.5)'; ctx.fillRect(0, cy - cs * 1.1, CW, cs * 3.6);
      ctx.font = '800 ' + cs + 'px system-ui'; ctx.fillStyle = '#e8f1ff'; ctx.fillText(tr('youAgo'), CW / 2, cy); ctx.fillStyle = '#8fd8ee'; ctx.fillText(tr('youAgo2'), CW / 2, cy + cs * 1.5); }
  }

  // top bar: HP · round + timer · coins
  var barW = clamp(CW * 0.34, 130, 420), bx = (CW - barW) / 2, by = 30;
  ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#8fa3c8';
  ctx.fillText(lang === 'zh' ? tr('round') + ' ' + run.round + ' 轮' : tr('round') + ' ' + run.round, CW / 2, 22);
  ctx.fillStyle = '#16213f'; ctx.fillRect(bx, by, barW, 8);
  ctx.fillStyle = urgent ? hsl(48, 100, 62) : '#35e0ff'; ctx.fillRect(bx, by, barW * (rewinding ? 1 - clamp(rewindT / rewindDur, 0, 1) : 1 - left), 8);
  if (state === 'play' && bx - 58 > 12 + clamp(CW * 0.2, 90, 220) + 8) { ctx.textAlign = 'left'; ctx.font = '800 12px system-ui'; ctx.fillStyle = hsl(350, 100, 65, ((time * 2) | 0) % 2 ? 1 : 0.35); ctx.beginPath(); ctx.arc(bx - 50, by + 4, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff9db0'; ctx.fillText('REC', bx - 40, by + 8); ctx.textAlign = 'center'; }
  // echo pips
  for (i = 0; i < run.slots; i++) { var ec = echoes[i], cx = CW / 2 - (run.slots - 1) * 7 + i * 14; ctx.beginPath(); ctx.arc(cx, by + 20, 4.5, 0, TAU);
    if (ec) { ctx.fillStyle = hsl(ec.hue, 90, 65, ec.alive ? 1 : 0.25); ctx.fill(); } else { ctx.strokeStyle = '#2a3b66'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  // hp
  var hw = clamp(CW * 0.2, 90, 220), hx = 12, hy = 14, hpP = clamp(player.hp / player.maxHp, 0, 1);
  ctx.fillStyle = '#16213f'; ctx.fillRect(hx, hy, hw, 14); ctx.fillStyle = hpP < 0.3 ? '#ff5470' : '#5dffb0'; ctx.fillRect(hx, hy, hw * hpP, 14);
  ctx.font = '800 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#070b16'; ctx.fillText(Math.ceil(player.hp) + ' / ' + player.maxHp, hx + 6, hy + 7.5);
  if (coinPop > 0) coinPop = Math.max(0, coinPop - dt * 5);
  ctx.fillStyle = '#ffd166'; ctx.font = '800 ' + (14 + coinPop * 4) + 'px system-ui'; ctx.fillText('◈ ' + run.coins, hx, hy + 30);
  for (i = 0; i < enemies.length; i++) if (enemies[i].type === 'boss') { var bw = clamp(CW * 0.5, 160, 560), bbx = (CW - bw) / 2, bby = CH - 26; ctx.fillStyle = '#16213f'; ctx.fillRect(bbx, bby, bw, 10); ctx.fillStyle = '#ff5470'; ctx.fillRect(bbx, bby, bw * clamp(enemies[i].hp / enemies[i].maxHp, 0, 1), 10); ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff9db0'; ctx.fillText('BOSS', CW / 2, bby - 8); ctx.textAlign = 'left'; break; }

  // banner
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; else { var ba = Math.min(1, banner.t * 2); ctx.font = '900 ' + (banner.small ? clamp(CW * 0.035, 18, 32) : clamp(CW * 0.06, 26, 56)) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = hsl(banner.hue, 100, 68, ba * (banner.small ? 0.85 : 1)); ctx.fillText(banner.text, CW / 2, banner.small ? oy + 40 : CH * 0.24); } }

  // ready prompt
  if (state === 'ready') {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ls = clamp(CW * 0.095, 40, 96), ly = CH * 0.26;
    ctx.font = '900 ' + ls + 'px system-ui';
    ctx.fillStyle = 'rgba(255,60,120,0.55)'; ctx.fillText('ECHO SQUAD', CW / 2 - 4, ly + 2);
    ctx.fillStyle = 'rgba(180,140,255,0.5)'; ctx.fillText('ECHO SQUAD', CW / 2 + 4, ly - 2);
    ctx.fillStyle = '#e8f8ff'; ctx.fillText('ECHO SQUAD', CW / 2, ly);
    ctx.font = '600 ' + clamp(CW * 0.024, 14, 22) + 'px system-ui'; ctx.fillStyle = '#8fa3c8';
    ctx.fillText(tr('tagline'), CW / 2, ly + ls * 0.75); ctx.fillText(tr('tagline2'), CW / 2, ly + ls * 0.75 + clamp(CW * 0.03, 18, 28));
    ctx.font = '900 ' + clamp(CW * 0.04, 22, 38) + 'px system-ui'; ctx.fillStyle = hsl(190, 100, 70, 0.7 + 0.3 * Math.sin(time * 4)); ctx.fillText(tr('ready'), CW / 2, CH * 0.7);
    ctx.font = '600 ' + clamp(CW * 0.022, 13, 18) + 'px system-ui'; ctx.fillStyle = '#8fa3c8'; ctx.fillText(isTouch || ('ontouchstart' in window && CW < 900) ? tr('readyTouch') : tr('readyKeys'), CW / 2, CH * 0.7 + 38);
  }
  // touch stick
  if (stick.on && state === 'play') { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 52, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(53,224,255,0.4)'; ctx.beginPath(); ctx.arc(stick.x, stick.y, 22, 0, TAU); ctx.fill(); }
}

/* ============================== main loop ============================== */
var last = performance.now(), acc = 0, muteCheck = 0, hudOff = false;
function frame(now) {
  var dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused && !adPause) {
    if (hitStop > 0) hitStop -= dt;
    else {
      acc += dt; var n = 0;
      while (acc >= TICK && n++ < 8) { step(); acc -= TICK; }
      if (n >= 8) acc = 0;
    }
    if (state === 'rewind') { rewindT += dt; if (rewindT >= rewindDur) endRewind(); }
    if (state === 'dead' && !$('ovDead').classList.contains('on')) { deadT += dt; if (deadT > 0.9) { if (Ads.canReward && !run.revived && run.round >= 2) openDead(); else openResults(); } }
    render(dt);
  } else render(0);
  if (((now / 1000) | 0) !== muteCheck) { muteCheck = (now / 1000) | 0; if (master) applyMute(); }
  requestAnimationFrame(frame);
}

/* ============================== boot ============================== */
loadSave();
muted = !!save.mute;
setLang(save.lang || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en'));
newRun(); applyMute();
Ads.init().then(function () { Ads.loadingDone(); applyMute(); });
requestAnimationFrame(frame);

// debug / automated-test hook:  index.html?debug=1
if (/[?&]debug=1/.test(location.search)) {
  window.__echo = {
    get state() { return state; }, get run() { return run; }, get player() { return player; }, get enemies() { return enemies; },
    get echoes() { return echoes; }, get shards() { return shards; }, get bullets() { return bullets; }, get save() { return save; }, get world() { return { W: W, H: H }; },
    input: function (x, y) { botInput = (x == null) ? null : { x: x, y: y }; },
    start: function () { firstInput(); },
    step: function (n) { for (var i = 0; i < (n || 1); i++) step(); },
    skipRewind: function () { if (state === 'rewind') endRewind(); },
    pickCard: function (i) { var b = $('cardList').children[i || 0]; if (b) b.click(); },
    setClass: function (k) { run.nextCls = k; },
    endRun: function () { if (state === 'dead') { hide('ovDead'); openResults(); } },
    again: function () { $('btnAgain').click(); },
    hideHud: function (v) { hudOff = !!v; texts.length = 0; document.querySelector('.topbtns').style.display = v ? 'none' : ''; }
  };
}
})();
