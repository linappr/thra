'use strict';

// =====================================================================
// CONSTANTS
// =====================================================================
const CW = 900;           // canvas width
const CH = 588;           // canvas height
const ISLE_X = CW / 2;   // island center x
const ISLE_Y = CH / 2;   // island center y
const ISLE_W = 480;       // island width
const ISLE_H = 370;       // island height
const BED_X  = ISLE_X - 160;
const BED_Y  = ISLE_Y;
const SPAWN_START_X = ISLE_X + 10;
const SPAWN_START_Y = ISLE_Y;
const PLAYER_SPEED  = 210;  // px/s
const CHAR_R = 20;          // character collision radius
const INTERACT_R = 46;      // question trigger distance
const BASE_SPEED = 52;      // enemy base speed px/s
const QUESTION_TIME = 18;   // seconds per question

// =====================================================================
// LEVELS
// =====================================================================
const LEVELS = [
  {
    name: 'Louka',
    grassDark: '#4a8c35',
    grassLight: '#55a33e',
    border: '#3a6c28',
    bg: '#1a3020',
    skyColor: '#0d1f30',
    waves: 5,
  },
  {
    name: 'Nether',
    grassDark: '#8b2500',
    grassLight: '#a02c00',
    border: '#5c1800',
    bg: '#2d0800',
    skyColor: '#1a0000',
    waves: 5,
  },
  {
    name: 'The End',
    grassDark: '#1e0f3d',
    grassLight: '#261347',
    border: '#0f0720',
    bg: '#0a0015',
    skyColor: '#050008',
    waves: 5,
  },
];

// =====================================================================
// WAVE CONFIG  –  returns { difficulty, enemyCount, speed, types[] }
// =====================================================================
function waveConfig(lvl, waveIdx) {
  const difficulty = Math.min(5, lvl * 2 + Math.floor(waveIdx / 2) + 1);
  const enemyCount = 3 + lvl * 2 + waveIdx;
  const speed = BASE_SPEED + lvl * 12 + waveIdx * 4;
  let pool;
  if (lvl === 0)      pool = waveIdx < 3 ? ['zombie','zombie','zombie'] : ['zombie','zombie','skeleton'];
  else if (lvl === 1) pool = waveIdx < 3 ? ['zombie','skeleton','skeleton'] : ['skeleton','skeleton','creeper'];
  else                pool = ['zombie','skeleton','creeper','creeper'];
  return { difficulty, enemyCount, speed, pool };
}

// =====================================================================
// MATH ENGINE
// =====================================================================
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function genQuestion(difficulty) {
  const ops = difficulty <= 1 ? ['+','-']
            : difficulty <= 2 ? ['+','-','×']
            : difficulty <= 3 ? ['+','-','×']
            : difficulty <= 4 ? ['×','÷','+','-']
            :                   ['×','÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer, display;

  switch (op) {
    case '+':
      a = rnd(difficulty <= 1 ? 1 : difficulty <= 2 ? 5 : 15,
              difficulty <= 1 ? 10 : difficulty <= 2 ? 25 : 55);
      b = rnd(1, difficulty <= 1 ? 10 : difficulty <= 2 ? 20 : 40);
      answer  = a + b;
      display = `${a} + ${b} = ?`;
      break;
    case '-':
      a = rnd(difficulty <= 1 ? 3 : difficulty <= 2 ? 8 : 20,
              difficulty <= 1 ? 15 : difficulty <= 2 ? 35 : 80);
      b = rnd(1, Math.max(1, a - 1));
      answer  = a - b;
      display = `${a} - ${b} = ?`;
      break;
    case '×':
      a = rnd(2, difficulty <= 3 ? 6 : 9);
      b = rnd(2, difficulty <= 3 ? 7 : 10);
      answer  = a * b;
      display = `${a} × ${b} = ?`;
      break;
    default: // ÷
      a = rnd(2, difficulty <= 4 ? 6 : 9);
      b = rnd(2, difficulty <= 4 ? 6 : 9);
      answer  = a;
      display = `${a * b} ÷ ${b} = ?`;
  }

  return { display, answer, options: makeOptions(answer) };
}

function makeOptions(correct) {
  const set = new Set([correct]);
  const deltas = [-8,-5,-3,-2,-1,1,2,3,5,8].sort(() => Math.random()-0.5);
  for (const d of deltas) {
    if (set.size >= 4) break;
    const w = correct + d;
    if (w > 0 && w !== correct) set.add(w);
  }
  while (set.size < 4) set.add(correct + (rnd(1,3) * (Math.random()<0.5?-1:1)));
  return [...set].sort(() => Math.random() - 0.5);
}

// =====================================================================
// PARTICLES
// =====================================================================
class Particle {
  constructor(x, y, text, color) {
    this.x  = x;
    this.y  = y;
    this.text = text;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 120;
    this.vy = -90 - Math.random() * 60;
    this.life = 1;
    this.decay = 0.9 + Math.random() * 0.4;
    this.size = 20;
  }
  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += 90 * dt;
    this.life -= this.decay * dt;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = `bold ${this.size}px Arial`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

// =====================================================================
// ENEMY TYPES
// =====================================================================
const ENEMY_DEF = {
  zombie:   { emoji:'🧟', name:'Zombie',   speedMult:1.0, score:10 },
  skeleton: { emoji:'💀', name:'Skeleton', speedMult:1.35, score:15 },
  creeper:  { emoji:'😈', name:'Creeper',  speedMult:1.6,  score:25 },
};

// =====================================================================
// ENEMY CLASS
// =====================================================================
class Enemy {
  constructor(x, y, type, speed) {
    this.x = x; this.y = y;
    this.def   = ENEMY_DEF[type] || ENEMY_DEF.zombie;
    this.speed = speed * this.def.speedMult;
    this.alive = true;
    this.dying = false;
    this.dyingT = 0;
    this.alpha  = 1;
    this.shakeT = 0;
    this.shakeX = 0;
  }
  update(dt, tx, ty) {
    if (this.dying) {
      this.dyingT += dt;
      this.alpha = Math.max(0, 1 - this.dyingT / 0.5);
      if (this.dyingT >= 0.5) this.alive = false;
      return;
    }
    if (this.shakeT > 0) { this.shakeT -= dt; this.shakeX = (Math.random()-0.5)*8; }
    else this.shakeX = 0;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 2) { this.x += dx/d * this.speed * dt; this.y += dy/d * this.speed * dt; }
  }
  draw(ctx) {
    if (!this.alive && !this.dying) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = '34px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.emoji, this.x + this.shakeX, this.y);
    ctx.restore();
  }
  die()    { this.dying = true; this.dyingT = 0; }
  shake()  { this.shakeT = 0.3; }
  distTo(x, y) {
    return Math.hypot(this.x - x, this.y - y);
  }
}

// =====================================================================
// PLAYER CLASS
// =====================================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hearts     = 3;
    this.maxHearts  = 3;
    this.invTimer   = 0;   // invincibility seconds
    this.walkFrame  = 0;
    this.walkT      = 0;
    this.alive      = true;
  }
  update(dt, keys, island) {
    if (this.invTimer > 0) this.invTimer -= dt;
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    this.x += dx * PLAYER_SPEED * dt;
    this.y += dy * PLAYER_SPEED * dt;
    // Clamp to island
    const hw = island.w / 2 - CHAR_R;
    const hh = island.h / 2 - CHAR_R;
    this.x = Math.max(island.x - hw, Math.min(island.x + hw, this.x));
    this.y = Math.max(island.y - hh, Math.min(island.y + hh, this.y));
    if (dx !== 0 || dy !== 0) {
      this.walkT += dt;
      if (this.walkT > 0.18) { this.walkT = 0; this.walkFrame ^= 1; }
    }
  }
  draw(ctx) {
    // Blink when invincible
    if (this.invTimer > 0 && Math.floor(this.invTimer * 10) % 2 === 0) return;
    ctx.save();
    ctx.font = '34px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧑', this.x, this.y);
    ctx.restore();
  }
  hit() {
    if (this.invTimer > 0) return false;
    this.hearts--;
    this.invTimer = 2.0;
    if (this.hearts <= 0) this.alive = false;
    return true;
  }
  distTo(x, y) { return Math.hypot(this.x - x, this.y - y); }
}

// =====================================================================
// GAME
// =====================================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.canvas.width  = CW;
    this.canvas.height = CH;

    // State: menu | playing | question | wave_end | lvl_end | game_over | win
    this.state = 'menu';

    this.lvlIdx    = 0;
    this.waveIdx   = 0;
    this.score     = 0;
    this.bedHearts = 2;
    this.best = parseInt(localStorage.getItem('mathwars_best') || '0');

    this.player    = null;
    this.enemies   = [];
    this.particles = [];
    this.keys      = {};

    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.SPAWN_INTERVAL = 2.2;

    this.qActive  = false;  // question in progress
    this.qTarget  = null;   // enemy being challenged
    this.qData    = null;   // { display, answer, options }
    this.qTimer   = 0;
    this.qLocked  = false;  // locked while showing feedback
    this.qCooldown = 0;     // prevent immediate re-trigger

    this.transTimer = 0;
    this.transMsg   = '';

    this.stars = Array.from({length:60}, () => ({
      x: Math.random() * CW,
      y: Math.random() * CH,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.5 + 0.2,
    }));

    this.lastTs = 0;
    this._bindUI();
    document.getElementById('best-score').textContent = this.best;
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ---- UI BINDINGS ----
  _bindUI() {
    const $ = id => document.getElementById(id);
    $('btn-start').onclick   = () => this._startGame();
    $('btn-howto').onclick   = () => this._showScreen('screen-howto');
    $('btn-back').onclick    = () => this._showScreen('screen-menu');
    $('btn-retry').onclick   = () => this._startGame();
    $('btn-go-menu').onclick = () => this._showScreen('screen-menu');
    $('btn-win-retry').onclick = () => this._startGame();
    $('btn-win-menu').onclick  = () => this._showScreen('screen-menu');
    $('q-submit').onclick = () => this._submitTyped();
    $('q-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._submitTyped();
    });
    document.addEventListener('keydown', e => {
      this.keys[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)
          && this.state === 'playing') e.preventDefault();
    });
    document.addEventListener('keyup', e => { this.keys[e.key] = false; });
  }

  _showScreen(id) {
    for (const s of ['screen-menu','screen-howto','screen-game','screen-gameover','screen-win']) {
      document.getElementById(s).classList.remove('active');
    }
    document.getElementById(id).classList.add('active');
  }

  // ---- GAME START ----
  _startGame() {
    this.lvlIdx    = 0;
    this.waveIdx   = 0;
    this.score     = 0;
    this.bedHearts = 2;
    this.enemies   = [];
    this.particles = [];
    this.player    = new Player(SPAWN_START_X, SPAWN_START_Y);
    this.state     = 'playing';
    this._showScreen('screen-game');
    this._closeQuestion();
    this._startWave();
    this._updateHUD();
  }

  // ---- WAVE / LEVEL ----
  _startWave() {
    const cfg = waveConfig(this.lvlIdx, this.waveIdx);
    this.waveCfg    = cfg;
    this.enemies    = [];
    this.spawnQueue = [];
    for (let i = 0; i < cfg.enemyCount; i++) {
      const type = cfg.pool[Math.floor(Math.random() * cfg.pool.length)];
      this.spawnQueue.push({ type, speed: cfg.speed });
    }
    this.spawnTimer    = 0.6;
    this.qCooldown     = 0;
    this.waveCompleted = false;
    this._updateHUD();
  }

  _spawnEnemy(type, speed) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
      case 0: x = Math.random() * CW; y = -35; break;
      case 1: x = CW + 35; y = Math.random() * CH; break;
      case 2: x = Math.random() * CW; y = CH + 35; break;
      default: x = -35; y = Math.random() * CH;
    }
    this.enemies.push(new Enemy(x, y, type, speed));
  }

  // ---- QUESTION ----
  _triggerQuestion(enemy) {
    if (this.state !== 'playing' || this.qCooldown > 0) return;
    this.state   = 'question';
    this.qTarget = enemy;
    this.qData   = genQuestion(this.waveCfg.difficulty);
    this.qTimer  = QUESTION_TIME;
    this.qLocked = false;

    const overlay = document.getElementById('question-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('q-enemy-name').textContent =
      `${enemy.def.emoji} ${enemy.def.name.toUpperCase()} ÚTOČÍ!`;
    document.getElementById('q-text').textContent = this.qData.display;
    document.getElementById('q-feedback').textContent = '';
    document.getElementById('q-input').value = '';

    const opts = document.getElementById('q-options');
    opts.innerHTML = '';
    this.qData.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => this._submitAnswer(opt, btn));
      opts.appendChild(btn);
    });

    document.getElementById('q-timer-bar').style.width = '100%';
    document.getElementById('q-timer-bar').style.backgroundColor = '#27ae60';
    setTimeout(() => document.getElementById('q-input').focus(), 50);
  }

  _submitTyped() {
    const val = parseInt(document.getElementById('q-input').value);
    if (!isNaN(val)) this._submitAnswer(val, null);
  }

  _submitAnswer(answer, btn) {
    if (this.state !== 'question' || this.qLocked) return;
    this.qLocked = true;

    const correct = answer === this.qData.answer;
    const fb = document.getElementById('q-feedback');

    // Highlight option buttons
    document.querySelectorAll('.opt-btn').forEach(b => {
      if (parseInt(b.textContent) === this.qData.answer) b.classList.add('correct');
      else if (b === btn && !correct) b.classList.add('wrong');
    });

    if (correct) {
      fb.style.color = '#2ecc71';
      fb.textContent = '✅ Správně! Skvělá práce!';
      this.score += this.qTarget.def.score;
      this.qTarget.die();
      for (let i = 0; i < 7; i++) {
        this.particles.push(new Particle(this.qTarget.x, this.qTarget.y,
          i % 2 === 0 ? '⭐' : '+' + this.qTarget.def.score, '#f1c40f'));
      }
      this._scheduleCloseQuestion(700);
    } else {
      fb.style.color = '#e74c3c';
      fb.textContent = `❌ Špatně! Správná odpověď: ${this.qData.answer}`;
      this.qTarget.shake();
      this._doDamage();
      this._scheduleCloseQuestion(1400);
    }
    this._updateHUD();
  }

  _doDamage() {
    const hit = this.player.hit();
    if (!hit) return;
    for (let i = 0; i < 5; i++)
      this.particles.push(new Particle(this.player.x, this.player.y, i%2===0?'💔':'-1', '#e74c3c'));
    if (!this.player.alive) {
      if (this.bedHearts > 0) {
        this.bedHearts--;
        this.player.hearts = this.player.maxHearts;
        this.player.alive  = true;
      } else {
        this._scheduleCloseQuestion(1400, () => this._gameOver());
        return;
      }
    }
  }

  _scheduleCloseQuestion(ms, cb) {
    setTimeout(() => {
      this._closeQuestion();
      if (cb) cb();
    }, ms);
  }

  _closeQuestion() {
    document.getElementById('question-overlay').classList.add('hidden');
    this.qTarget  = null;
    this.qData    = null;
    this.qLocked  = false;
    this.qCooldown = 1.2;
    if (this.state === 'question') this.state = 'playing';
  }

  // ---- GAME OVER / WIN ----
  _gameOver() {
    this.state = 'game_over';
    this._saveBest();
    document.getElementById('go-score').textContent = this.score;
    this._showScreen('screen-gameover');
  }

  _win() {
    this.state = 'win';
    this._saveBest();
    document.getElementById('win-score').textContent = this.score;
    this._showScreen('screen-win');
  }

  _saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('mathwars_best', this.best);
      document.getElementById('best-score').textContent = this.best;
    }
  }

  // ---- HUD ----
  _updateHUD() {
    // Hearts
    let h = '';
    for (let i = 0; i < (this.player?.maxHearts || 3); i++)
      h += i < (this.player?.hearts || 0) ? '❤️' : '🖤';
    document.getElementById('hud-hearts').textContent = h;
    // Wave
    const lvl = LEVELS[Math.min(this.lvlIdx, LEVELS.length-1)];
    document.getElementById('hud-level-name').textContent = lvl.name;
    document.getElementById('hud-wave').textContent =
      `Vlna ${this.waveIdx+1} / ${lvl.waves}`;
    // Bed
    let bh = '🛏️ ';
    for (let i = 0; i < 2; i++) bh += i < this.bedHearts ? '❤️' : '🖤';
    document.getElementById('hud-bed').textContent = bh;
    // Score
    document.getElementById('hud-score').textContent = '⭐ ' + this.score;
  }

  // =====================================================================
  // UPDATE
  // =====================================================================
  _update(dt) {
    if (this.state === 'question') {
      // Tick question timer
      this.qTimer -= dt;
      const pct = Math.max(0, this.qTimer / QUESTION_TIME);
      const bar = document.getElementById('q-timer-bar');
      bar.style.width = (pct * 100) + '%';
      bar.style.backgroundColor = pct > 0.5 ? '#27ae60' : pct > 0.25 ? '#f39c12' : '#e74c3c';
      if (this.qTimer <= 0 && !this.qLocked) {
        this.qLocked = true;
        const fb = document.getElementById('q-feedback');
        fb.style.color = '#e74c3c';
        fb.textContent = `⏱ Čas vypršel! Odpověď: ${this.qData.answer}`;
        this.qTarget.shake();
        this._doDamage();
        this._updateHUD();
        this._scheduleCloseQuestion(1400, !this.player.alive && this.bedHearts <= 0 ? () => this._gameOver() : undefined);
      }
      // Particles still update
      this.particles.forEach(p => p.update(dt));
      this.particles = this.particles.filter(p => !p.dead);
      return;
    }

    if (this.state !== 'playing') return;

    // Spawn queue
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
      const { type, speed } = this.spawnQueue.shift();
      this._spawnEnemy(type, speed);
      this.spawnTimer = this.SPAWN_INTERVAL;
    }

    // Question cooldown
    if (this.qCooldown > 0) this.qCooldown -= dt;

    // Player
    const island = { x: ISLE_X, y: ISLE_Y, w: ISLE_W, h: ISLE_H };
    this.player.update(dt, this.keys, island);

    // Enemies
    this.enemies.forEach(e => e.update(dt, BED_X, BED_Y));

    // Enemy reached bed?
    this.enemies.forEach(e => {
      if (!e.alive || e.dying) return;
      if (e.distTo(BED_X, BED_Y) < 28) {
        e.die();
        for (let i = 0; i < 5; i++)
          this.particles.push(new Particle(BED_X, BED_Y, '💔', '#e74c3c'));
        if (this.bedHearts > 0) {
          this.bedHearts--;
        }
        this.player.hit(); // takes a heart
        this._updateHUD();
        if (!this.player.alive && this.bedHearts <= 0) {
          setTimeout(() => this._gameOver(), 400);
        } else if (!this.player.alive) {
          this.bedHearts = Math.max(0, this.bedHearts - 1);
          this.player.hearts = this.player.maxHearts;
          this.player.alive  = true;
          this._updateHUD();
        }
      }
    });

    // Player touches enemy → question
    if (this.qCooldown <= 0) {
      for (const e of this.enemies) {
        if (!e.alive || e.dying) continue;
        if (this.player.distTo(e.x, e.y) < INTERACT_R) {
          this._triggerQuestion(e);
          break;
        }
      }
    }

    // Remove fully dead enemies
    this.enemies = this.enemies.filter(e => e.alive || e.dying);

    // Particles
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);

    // Wave complete?
    if (!this.waveCompleted &&
        this.spawnQueue.length === 0 &&
        this.enemies.filter(e => !e.dying).length === 0) {
      this._waveComplete();
    }
  }

  _waveComplete() {
    if (this.state !== 'playing') return;
    this.waveCompleted = true;
    this.score += 50;
    this.waveIdx++;
    this._updateHUD();

    const lvl = LEVELS[this.lvlIdx];
    if (this.waveIdx >= lvl.waves) {
      this.lvlIdx++;
      this.waveIdx = 0;
      if (this.lvlIdx >= LEVELS.length) {
        // WON
        this.score += 200;
        this._updateHUD();
        this.state = 'transition';
        this.transMsg = '🏆 VYHRÁNO! +200 bonus!';
        this.transTimer = 2.5;
        setTimeout(() => this._win(), 2500);
      } else {
        this.state = 'transition';
        this.transMsg = `🎉 ÚROVEŇ SPLNĚNA! +50 bodů\nPřiprav se na: ${LEVELS[this.lvlIdx].name}`;
        this.transTimer = 2.5;
        setTimeout(() => { this.state = 'playing'; this._startWave(); }, 2500);
      }
    } else {
      this.state = 'transition';
      this.transMsg = `✅ Vlna ${this.waveIdx} splněna! +50 bodů`;
      this.transTimer = 1.6;
      setTimeout(() => { this.state = 'playing'; this._startWave(); }, 1600);
    }
  }

  // =====================================================================
  // DRAW
  // =====================================================================
  _draw() {
    const ctx = this.ctx;
    const lvl = LEVELS[Math.min(this.lvlIdx, LEVELS.length - 1)];

    // Sky background
    ctx.fillStyle = lvl.skyColor;
    ctx.fillRect(0, 0, CW, CH);

    // Stars (always visible, they twinkle)
    this.stars.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Island
    this._drawIsland(ctx, lvl);

    // Bed
    this._drawBed(ctx);

    // Enemies
    this.enemies.forEach(e => e.draw(ctx));

    // Player
    if (this.player) this.player.draw(ctx);

    // Particles
    this.particles.forEach(p => p.draw(ctx));

    // Transition overlay
    if (this.state === 'transition') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, CW, CH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = this.transMsg.split('\n');
      lines.forEach((line, i) => {
        const sz = i === 0 ? 36 : 26;
        ctx.font = `bold ${sz}px Arial`;
        ctx.fillStyle = i === 0 ? '#f1c40f' : '#fff';
        ctx.fillText(line, CW/2, CH/2 - (lines.length-1)*20 + i*46);
      });
      ctx.restore();
    }

    // Spawn preview: show wave enemy count
    if (this.state === 'playing' && this.spawnQueue.length > 0) {
      ctx.save();
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`Přichází: ${this.spawnQueue.length + this.enemies.filter(e=>!e.dying).length}`, CW - 10, 10);
      ctx.restore();
    }
  }

  _drawIsland(ctx, lvl) {
    const x0 = ISLE_X - ISLE_W / 2;
    const y0 = ISLE_Y - ISLE_H / 2;
    const TILE = 40;
    const cols = Math.ceil(ISLE_W / TILE);
    const rows = Math.ceil(ISLE_H / TILE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, ISLE_W, ISLE_H);
    ctx.clip();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = x0 + c * TILE;
        const ty = y0 + r * TILE;
        ctx.fillStyle = (r + c) % 2 === 0 ? lvl.grassDark : lvl.grassLight;
        ctx.fillRect(tx, ty, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, TILE, TILE);
      }
    }
    ctx.restore();

    // Island border
    ctx.strokeStyle = lvl.border;
    ctx.lineWidth = 5;
    ctx.strokeRect(x0, y0, ISLE_W, ISLE_H);

    // Decorative corner stones
    const corners = [
      [x0, y0], [x0 + ISLE_W - TILE, y0],
      [x0, y0 + ISLE_H - TILE], [x0 + ISLE_W - TILE, y0 + ISLE_H - TILE],
    ];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    corners.forEach(([cx, cy]) => ctx.fillRect(cx, cy, TILE, TILE));
  }

  _drawBed(ctx) {
    ctx.save();
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛏️', BED_X, BED_Y);
    ctx.restore();
  }

  // =====================================================================
  // LOOP
  // =====================================================================
  _loop(ts) {
    const dt = Math.min((ts - this.lastTs) / 1000, 0.08);
    this.lastTs = ts;
    if (this.state !== 'menu' && this.state !== 'game_over' && this.state !== 'win') {
      this._update(dt);
      this._draw();
    }
    requestAnimationFrame(t => this._loop(t));
  }
}

// =====================================================================
// BOOT
// =====================================================================
window.addEventListener('DOMContentLoaded', () => new Game());
