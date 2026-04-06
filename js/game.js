'use strict';

// =====================================================================
// CONSTANTS
// =====================================================================
const CW = 900, CH = 588;
const ISLE_X = CW / 2, ISLE_Y = CH / 2;
const ISLE_W = 480, ISLE_H = 370;
const BED_X  = ISLE_X - 160, BED_Y = ISLE_Y;
const SPAWN_START_X = ISLE_X + 10, SPAWN_START_Y = ISLE_Y;
const PLAYER_SPEED  = 210;
const CHAR_R = 20, INTERACT_R = 46;
const BASE_SPEED = 28;
const QUESTION_TIME = 18;
const DRAGON_QUESTION_TIME = 45;
const FAST_ANSWER_THRESHOLD = 5;
const FAST_ANSWERS_FOR_BLOCK = 3;
const ENEMY_ISLE_X = 845, ENEMY_ISLE_Y = ISLE_Y;
const ENEMY_ISLE_W = 90,  ENEMY_ISLE_H = 70;
const BLOCK_POSITIONS = [
  { x: BED_X + 105, y: BED_Y - 88 },
  { x: BED_X + 125, y: BED_Y + 5  },
  { x: BED_X + 105, y: BED_Y + 88 },
  { x: BED_X + 10,  y: BED_Y - 130 },
  { x: BED_X + 10,  y: BED_Y + 130 },
];

// =====================================================================
// LEVELS
// =====================================================================
const LEVELS = [
  { name:'Louka',   grassDark:'#4a8c35', grassLight:'#55a33e', border:'#3a6c28', skyColor:'#0d1f30', waves:5 },
  { name:'Nether',  grassDark:'#8b2500', grassLight:'#a02c00', border:'#5c1800', skyColor:'#1a0000', waves:5 },
  { name:'The End', grassDark:'#1e0f3d', grassLight:'#261347', border:'#0f0720', skyColor:'#050008', waves:5 },
];

// =====================================================================
// WAVE CONFIG
// =====================================================================
function waveConfig(lvl, waveIdx) {
  const difficulty = Math.min(5, lvl * 2 + Math.floor(waveIdx / 2) + 1);
  const enemyCount = 3 + lvl * 2 + waveIdx;
  const speed = BASE_SPEED + lvl * 12 + waveIdx * 4;
  let pool;
  if (lvl === 0)      pool = waveIdx < 3 ? ['zombie','zombie','zombie'] : ['zombie','zombie','skeleton'];
  else if (lvl === 1) pool = waveIdx < 3 ? ['zombie','skeleton','sniffer'] : ['skeleton','sniffer','creeper'];
  else                pool = ['skeleton','creeper','sniffer','creeper'];
  return { difficulty, enemyCount, speed, pool };
}

// =====================================================================
// MATH ENGINE
// =====================================================================
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function genQuestion(difficulty, enemyType) {
  if (enemyType === 'sniffer')     return genRound(difficulty);
  if (enemyType === 'enderdragon') return genDragon();
  const ops = difficulty <= 1 ? ['+','-','x','x','d','d']
            : difficulty <= 2 ? ['+','-','x','x','d','d','cmp']
            : difficulty <= 3 ? ['x','x','d','d','cmp','rnd']
            : difficulty <= 4 ? ['x','d','cmp','rnd','+']
            :                   ['x','d','cmp','rnd'];
  const op = ops[rnd(0, ops.length - 1)];
  switch (op) {
    case '+':   return genAdd(difficulty);
    case '-':   return genSub(difficulty);
    case 'x':   return genMul(difficulty);
    case 'd':   return genDiv(difficulty);
    case 'cmp': return genCompare(difficulty);
    case 'rnd': return genRound(difficulty);
    default:    return genMul(difficulty);
  }
}

function genAdd(d) {
  const a = rnd(d<=1?1:d<=2?5:15, d<=1?15:d<=2?30:60);
  const b = rnd(1, d<=1?15:d<=2?25:45);
  return { display:`${a} + ${b} = ?`, answer:a+b, options:makeOptions(a+b) };
}
function genSub(d) {
  const a = rnd(d<=1?3:d<=2?10:20, d<=1?15:d<=2?40:90);
  const b = rnd(1, Math.max(1, a - 1));
  return { display:`${a} - ${b} = ?`, answer:a-b, options:makeOptions(a-b) };
}
function genMul(d) {
  const mx = d<=1?5:d<=2?7:d<=3?9:10;
  const a = rnd(2, mx), b = rnd(2, mx);
  return { display:`${a} \u00d7 ${b} = ?`, answer:a*b, options:makeOptions(a*b) };
}
function genDiv(d) {
  const mx = d<=1?5:d<=2?7:d<=3?9:10;
  const ans = rnd(2, mx), b = rnd(2, mx);
  return { display:`${ans*b} \u00f7 ${b} = ?`, answer:ans, options:makeOptions(ans) };
}
function genCompare(d) {
  const makeVal = () => {
    if (rnd(0,1)===0) { const v=rnd(5,50); return {val:v, text:String(v)}; }
    const a=rnd(2,d<=2?6:9), b=rnd(2,d<=2?6:9);
    return {val:a*b, text:`${a}\u00d7${b}`};
  };
  let left, right, tries=0;
  do { left=makeVal(); right=makeVal(); tries++; } while (left.val===right.val && tries<10);
  const correct = left.val<right.val ? '<' : left.val>right.val ? '>' : '=';
  return { display:`${left.text}  ___  ${right.text}`, answer:correct, options:['<','>','='], isComparison:true, hideInput:true };
}
function genRound(d) {
  if (d <= 2) {
    const n = rnd(11, 99), ans = Math.round(n/10)*10;
    return { display:`Zaokrouhli ${n} na des\u00edtky:`, answer:ans, options:makeOptions(ans) };
  }
  const n = rnd(101, 999), ans = Math.round(n/100)*100;
  return { display:`Zaokrouhli ${n} na stovky:`, answer:ans, options:makeOptions(ans) };
}
function genDragon() {
  const a = rnd(1000,4999), b = rnd(1000,4999);
  return { display:`${a} + ${b} = ?`, answer:a+b, options:makeOptions(a+b), isDragon:true };
}
function makeOptions(correct) {
  const set = new Set([correct]);
  const deltas = [-15,-8,-5,-3,-2,-1,1,2,3,5,8,15].sort(()=>Math.random()-0.5);
  for (const d of deltas) {
    if (set.size >= 4) break;
    const w = correct + d;
    if (w > 0 && w !== correct) set.add(w);
  }
  while (set.size < 4) set.add(correct + rnd(1,5) * (Math.random()<0.5?-1:1));
  return [...set].sort(()=>Math.random()-0.5);
}

// =====================================================================
// PARTICLES
// =====================================================================
class Particle {
  constructor(x, y, text, color) {
    this.x=x; this.y=y; this.text=text; this.color=color;
    this.vx=(Math.random()-0.5)*120; this.vy=-90-Math.random()*60;
    this.life=1; this.decay=0.9+Math.random()*0.4; this.size=20;
  }
  update(dt) { this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=90*dt; this.life-=this.decay*dt; }
  draw(ctx) {
    if (this.life<=0) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.life);
    ctx.font=`bold ${this.size}px Arial`; ctx.fillStyle=this.color;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(this.text,this.x,this.y); ctx.restore();
  }
  get dead() { return this.life<=0; }
}

// =====================================================================
// ENEMY TYPES
// =====================================================================
const ENEMY_DEF = {
  zombie:      { emoji:'🧟', name:'Zombie',     speedMult:1.0,  score:10, glow:'#1e6b12', trail:'#57a64a' },
  skeleton:    { emoji:'💀', name:'Skeleton',   speedMult:1.35, score:15, glow:'#6e6e6e', trail:'#aaaaaa' },
  creeper:     { emoji:'😈', name:'Creeper',    speedMult:1.6,  score:25, glow:'#126b12', trail:'#57e657' },
  sniffer:     { emoji:'🦖', name:'Sniffer',    speedMult:0.9,  score:20, glow:'#8b6914', trail:'#c8a840' },
  enderdragon: { emoji:'🐉', name:'Ender Drak', speedMult:0.4,  score:0,  glow:'#6a0dad', trail:'#aa44ff' },
};

// =====================================================================
// ENEMY CLASS
// =====================================================================
class Enemy {
  constructor(x, y, type, speed) {
    this.x=x; this.y=y;
    this.typeName = type;
    this.def = ENEMY_DEF[type] || ENEMY_DEF.zombie;
    this.speed = speed * this.def.speedMult;
    this.alive=true; this.dying=false; this.dyingT=0; this.alpha=1;
    this.shakeT=0; this.shakeX=0; this.attackT=0;
    this.trail=[]; this.trailDist=0;
    this.isDragon = (type === 'enderdragon');
  }
  update(dt, tx, ty, blocks) {
    if (this.dying) {
      this.dyingT+=dt; this.alpha=Math.max(0,1-this.dyingT/0.5);
      if (this.dyingT>=0.5) this.alive=false; return;
    }
    if (this.shakeT>0) { this.shakeT-=dt; this.shakeX=(Math.random()-0.5)*8; } else this.shakeX=0;
    // Block check
    let targetBlock=null, minDist=Infinity;
    for (const b of (blocks||[])) {
      if (!b.alive) continue;
      const d=Math.hypot(this.x-b.x, this.y-b.y);
      if (d<32 && d<minDist) { minDist=d; targetBlock=b; }
    }
    if (targetBlock) {
      this.attackT=(this.attackT||0)+dt;
      if (this.attackT>=1.8) { this.attackT=0; targetBlock.hp--; if(targetBlock.hp<=0) targetBlock.alive=false; }
      this.shakeX=Math.sin(this.attackT*20)*3; return;
    }
    this.attackT=0;
    const dx=tx-this.x, dy=ty-this.y, d=Math.sqrt(dx*dx+dy*dy);
    if (d>2) {
      const mx=dx/d*this.speed*dt, my=dy/d*this.speed*dt;
      this.x+=mx; this.y+=my;
      this.trailDist+=Math.hypot(mx,my);
      if (this.trailDist>=55) {
        this.trail.push({x:this.x, y:this.y});
        if (this.trail.length>20) this.trail.shift();
        this.trailDist=0;
      }
    }
  }
  drawTrail(ctx) {
    if (!this.trail.length) return;
    ctx.save();
    this.trail.forEach((p,i) => {
      ctx.globalAlpha = 0.15 + (i/this.trail.length)*0.3;
      ctx.fillStyle = this.def.trail;
      ctx.fillRect(p.x-11, p.y-11, 22, 22);
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
      ctx.strokeRect(p.x-11, p.y-11, 22, 22);
    });
    ctx.restore();
  }
  draw(ctx) {
    if (!this.alive && !this.dying) return;
    const sz = this.isDragon ? 60 : 42;
    ctx.save(); ctx.globalAlpha=this.alpha;
    ctx.fillStyle=this.def.glow;
    ctx.beginPath(); ctx.arc(this.x+this.shakeX, this.y, this.isDragon?34:23, 0, Math.PI*2); ctx.fill();
    ctx.font=`${sz}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(this.def.emoji, this.x+this.shakeX, this.y);
    ctx.restore();
  }
  die()   { this.dying=true; this.dyingT=0; }
  shake() { this.shakeT=0.3; }
  distTo(x,y) { return Math.hypot(this.x-x, this.y-y); }
}

// =====================================================================
// PLAYER CLASS
// =====================================================================
class Player {
  constructor(x, y) {
    this.x=x; this.y=y;
    this.hearts=3; this.maxHearts=3;
    this.invTimer=0; this.walkFrame=0; this.walkT=0; this.alive=true;
    this.shieldCount=1;
  }
  update(dt, keys, island) {
    if (this.invTimer>0) this.invTimer-=dt;
    let dx=0, dy=0;
    if (keys['ArrowLeft'] ||keys['a']||keys['A']) dx-=1;
    if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
    if (keys['ArrowUp']   ||keys['w']||keys['W']) dy-=1;
    if (keys['ArrowDown'] ||keys['s']||keys['S']) dy+=1;
    if (dx&&dy) { dx*=0.707; dy*=0.707; }
    this.x+=dx*PLAYER_SPEED*dt; this.y+=dy*PLAYER_SPEED*dt;
    const hw=island.w/2-CHAR_R, hh=island.h/2-CHAR_R;
    this.x=Math.max(island.x-hw,Math.min(island.x+hw,this.x));
    this.y=Math.max(island.y-hh,Math.min(island.y+hh,this.y));
    if (dx||dy) { this.walkT+=dt; if(this.walkT>0.18){this.walkT=0;this.walkFrame^=1;} }
  }
  draw(ctx) {
    if (this.invTimer>0&&Math.floor(this.invTimer*10)%2===0) return;
    ctx.save();
    ctx.fillStyle='#1a3a9a'; ctx.beginPath(); ctx.arc(this.x,this.y,23,0,Math.PI*2); ctx.fill();
    ctx.font='42px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🧑',this.x,this.y); ctx.restore();
  }
  hit() {
    if (this.invTimer>0) return false;
    this.hearts--; this.invTimer=2.0;
    if (this.hearts<=0) this.alive=false;
    return true;
  }
  distTo(x,y) { return Math.hypot(this.x-x,this.y-y); }
}

// =====================================================================
// BLOCK CLASS
// =====================================================================
class Block {
  constructor(x, y) { this.x=x; this.y=y; this.maxHp=3; this.hp=this.maxHp; this.alive=true; }
  draw(ctx) {
    if (!this.alive) return;
    const S=34, pct=this.hp/this.maxHp;
    ctx.save();
    ctx.fillStyle = pct>0.66?'#c8a84b':pct>0.33?'#9a7a2e':'#6a5018';
    ctx.fillRect(this.x-S/2,this.y-S/2,S,S);
    ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.5;
    ctx.strokeRect(this.x-S/2,this.y-S/2,S,S);
    ctx.beginPath();
    ctx.moveTo(this.x-S/2,this.y); ctx.lineTo(this.x+S/2,this.y);
    ctx.moveTo(this.x,this.y-S/2); ctx.lineTo(this.x,this.y);
    ctx.stroke();
    if (this.hp<this.maxHp) {
      ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(this.x-6,this.y-8); ctx.lineTo(this.x+4,this.y+10);
      ctx.moveTo(this.x+6,this.y-6); ctx.lineTo(this.x-2,this.y+6);
      ctx.stroke();
    }
    for (let i=0;i<this.maxHp;i++) {
      ctx.fillStyle=i<this.hp?'#f1c40f':'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(this.x-(this.maxHp-1)*5+i*10,this.y-S/2-6,3,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  reset() { this.hp=this.maxHp; this.alive=true; }
}

// =====================================================================
// GAME CLASS
// =====================================================================
class Game {
  constructor() {
    this.canvas=document.getElementById('canvas');
    this.ctx=this.canvas.getContext('2d');
    this.canvas.width=CW; this.canvas.height=CH;

    this.state='menu'; // menu|playing|question|transition|game_over|win
    this.paused=false;
    this.lvlIdx=0; this.waveIdx=0; this.score=0; this.bedHearts=2;
    this.best=parseInt(localStorage.getItem('mathwars_best')||'0');

    this.player=null; this.enemies=[]; this.particles=[];
    this.blocks=BLOCK_POSITIONS.map(p=>new Block(p.x,p.y));
    this.keys={};

    this.spawnQueue=[]; this.spawnTimer=0; this.SPAWN_INTERVAL=2.2;
    this.qTarget=null; this.qData=null; this.qTimer=0; this.qLocked=false; this.qCooldown=0;
    this.qStartTime=0;
    this.fastAnswerCount=0;

    this.transMsg=''; this.waveCfg=null; this.waveCompleted=false;
    this.dragonPhase=false;

    this.stars=Array.from({length:60},()=>({
      x:Math.random()*CW, y:Math.random()*CH,
      r:Math.random()*1.5+0.5, a:Math.random()*0.5+0.2
    }));
    this.lastTs=0;
    this._bindUI();
    document.getElementById('best-score').textContent=this.best;
    requestAnimationFrame(ts=>this._loop(ts));
  }

  // ---- UI ----
  _bindUI() {
    const $=id=>document.getElementById(id);
    $('btn-start').onclick   = ()=>this._startGame();
    $('btn-howto').onclick   = ()=>this._showScreen('screen-howto');
    $('btn-back').onclick    = ()=>this._showScreen('screen-menu');
    $('btn-retry').onclick   = ()=>this._startGame();
    $('btn-go-menu').onclick = ()=>this._showScreen('screen-menu');
    $('btn-win-retry').onclick = ()=>this._startGame();
    $('btn-win-menu').onclick  = ()=>this._showScreen('screen-menu');
    $('q-submit').onclick    = ()=>this._submitTyped();
    $('q-shield').onclick    = ()=>this._useShield();
    $('btn-pause').onclick   = ()=>this._togglePause();
    $('q-input').addEventListener('keydown',e=>{if(e.key==='Enter')this._submitTyped();});
    document.addEventListener('keydown',e=>{
      this.keys[e.key]=true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&this.state==='playing') e.preventDefault();
      if ((e.key==='p'||e.key==='P'||e.key==='Escape')&&(this.state==='playing'||this.paused)) this._togglePause();
      if ((e.key==='r'||e.key==='R')&&this.paused) { this.paused=false; this._startGame(); }
    });
    document.addEventListener('keyup',e=>{this.keys[e.key]=false;});
  }
  _showScreen(id) {
    ['screen-menu','screen-howto','screen-game','screen-gameover','screen-win'].forEach(s=>document.getElementById(s).classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
  _togglePause() {
    if (this.state!=='playing'&&!this.paused) return;
    this.paused=!this.paused;
    document.getElementById('btn-pause').textContent=this.paused?'▶':'⏸';
  }

  // ---- GAME START ----
  _startGame() {
    this.lvlIdx=0; this.waveIdx=0; this.score=0; this.bedHearts=2;
    this.enemies=[]; this.particles=[]; this.fastAnswerCount=0;
    this.blocks=BLOCK_POSITIONS.map(p=>new Block(p.x,p.y));
    this.dragonPhase=false; this.paused=false;
    this.player=new Player(SPAWN_START_X,SPAWN_START_Y);
    this.state='playing';
    this._showScreen('screen-game');
    this._closeQuestion();
    this._startWave();
    this._updateHUD();
  }

  // ---- WAVE ----
  _startWave() {
    const cfg=waveConfig(this.lvlIdx,this.waveIdx);
    this.waveCfg=cfg; this.enemies=[]; this.spawnQueue=[];
    for (let i=0;i<cfg.enemyCount;i++) {
      const type=cfg.pool[Math.floor(Math.random()*cfg.pool.length)];
      this.spawnQueue.push({type,speed:cfg.speed});
    }
    this.spawnTimer=0.6; this.qCooldown=0; this.waveCompleted=false;
    this.blocks.forEach(b=>b.reset());
    this._updateHUD();
  }
  _spawnEnemy(type, speed) {
    const x=ENEMY_ISLE_X+rnd(-20,20), y=ENEMY_ISLE_Y+rnd(-70,70);
    this.enemies.push(new Enemy(x,y,type,speed));
  }

  // ---- QUESTION ----
  _triggerQuestion(enemy) {
    if (this.state!=='playing'||this.qCooldown>0) return;
    this.state='question'; this.qTarget=enemy;
    this.qData=genQuestion(this.waveCfg.difficulty, enemy.typeName);
    this.qTimer=enemy.isDragon?DRAGON_QUESTION_TIME:QUESTION_TIME;
    this.qLocked=false; this.qStartTime=performance.now();

    const overlay=document.getElementById('question-overlay');
    overlay.classList.remove('hidden');
    const modal=document.getElementById('question-modal');
    modal.className=enemy.isDragon?'dragon-mode':'';
    document.getElementById('q-enemy-name').textContent=`${enemy.def.emoji} ${enemy.def.name.toUpperCase()} ÚTOČÍ!`;
    document.getElementById('q-text').textContent=this.qData.display;
    document.getElementById('q-feedback').textContent='';
    document.getElementById('q-input').value='';

    // Input row visibility
    const inputRow=document.getElementById('q-input-row');
    inputRow.style.display=this.qData.hideInput?'none':'flex';

    // Shield button state
    const shBtn=document.getElementById('q-shield');
    shBtn.disabled=this.player.shieldCount<=0;
    shBtn.textContent=`🛡️ Přeskočit (${this.player.shieldCount}×)`;

    // Options
    const opts=document.getElementById('q-options');
    opts.innerHTML='';
    opts.className=this.qData.isComparison?'compare-mode':'';
    this.qData.options.forEach(opt=>{
      const btn=document.createElement('button');
      btn.className='opt-btn'; btn.textContent=opt;
      btn.addEventListener('click',()=>this._submitAnswer(opt,btn));
      opts.appendChild(btn);
    });
    document.getElementById('q-timer-bar').style.width='100%';
    document.getElementById('q-timer-bar').style.backgroundColor='#27ae60';
    setTimeout(()=>{ if(!this.qData.hideInput) document.getElementById('q-input').focus(); },50);
  }

  _submitTyped() {
    const val=parseInt(document.getElementById('q-input').value);
    if (!isNaN(val)) this._submitAnswer(val,null);
  }
  _useShield() {
    if (this.state!=='question'||this.qLocked||this.player.shieldCount<=0) return;
    this.qLocked=true;
    this.player.shieldCount--;
    const fb=document.getElementById('q-feedback');
    fb.style.color='#74b9ff'; fb.textContent='🛡️ Štít použit! Příklad přeskočen.';
    this.qTarget.shake();
    this._scheduleCloseQuestion(900);
    this._updateHUD();
  }
  _submitAnswer(answer, btn) {
    if (this.state!=='question'||this.qLocked) return;
    this.qLocked=true;
    const correct = this.qData.isComparison ? (answer===this.qData.answer) : (parseInt(answer)===this.qData.answer);
    const fb=document.getElementById('q-feedback');
    document.querySelectorAll('.opt-btn').forEach(b=>{
      if (b.textContent===String(this.qData.answer)) b.classList.add('correct');
      else if (b===btn&&!correct) b.classList.add('wrong');
    });
    if (correct) {
      fb.style.color='#2ecc71'; fb.textContent='✅ Správně! Skvělá práce!';
      const elapsed=(performance.now()-this.qStartTime)/1000;
      const pts=this.qData.isDragon?20000:this.qTarget.def.score;
      this.score+=pts;
      if (this.qData.isDragon) {
        for (let i=0;i<12;i++) this.particles.push(new Particle(CW/2,CH/2,i%2===0?'🐉':'⭐','#da8fff'));
        this._scheduleCloseQuestion(1200,()=>this._win());
      } else {
        this.qTarget.die();
        for (let i=0;i<7;i++) this.particles.push(new Particle(this.qTarget.x,this.qTarget.y,i%2===0?'⭐':'+'+pts,'#f1c40f'));
        if (elapsed<FAST_ANSWER_THRESHOLD) {
          this.fastAnswerCount++;
          if (this.fastAnswerCount>=FAST_ANSWERS_FOR_BLOCK) {
            this.fastAnswerCount=0;
            const bx=BED_X+rnd(60,160), by=BED_Y+rnd(-120,120);
            this.blocks.push(new Block(bx,by));
            for (let i=0;i<5;i++) this.particles.push(new Particle(bx,by,'⚡','#f1c40f'));
          }
        }
        this._scheduleCloseQuestion(700);
      }
    } else {
      fb.style.color='#e74c3c';
      fb.textContent=`❌ Špatně! Odpověď: ${this.qData.answer}`;
      this.qTarget.shake();
      this._doDamage();
      this._scheduleCloseQuestion(1400);
    }
    this._updateHUD();
  }
  _doDamage() {
    const hit=this.player.hit();
    if (!hit) return;
    for (let i=0;i<5;i++) this.particles.push(new Particle(this.player.x,this.player.y,i%2===0?'💔':'-1','#e74c3c'));
    if (!this.player.alive) {
      if (this.bedHearts>0) { this.bedHearts--; this.player.hearts=this.player.maxHearts; this.player.alive=true; }
      else { this._scheduleCloseQuestion(1400,()=>this._gameOver()); return; }
    }
  }
  _scheduleCloseQuestion(ms,cb) {
    setTimeout(()=>{ this._closeQuestion(); if(cb) cb(); },ms);
  }
  _closeQuestion() {
    document.getElementById('question-overlay').classList.add('hidden');
    this.qTarget=null; this.qData=null; this.qLocked=false; this.qCooldown=1.2;
    if (this.state==='question') this.state='playing';
  }
  _gameOver() {
    this.state='game_over'; this._saveBest();
    document.getElementById('go-score').textContent=this.score;
    this._showScreen('screen-gameover');
  }
  _win() {
    this.state='win'; this._saveBest();
    document.getElementById('win-score').textContent=this.score;
    this._showScreen('screen-win');
  }
  _saveBest() {
    if (this.score>this.best) { this.best=this.score; localStorage.setItem('mathwars_best',this.best); document.getElementById('best-score').textContent=this.best; }
  }

  // ---- HUD ----
  _updateHUD() {
    let h='';
    for (let i=0;i<(this.player?.maxHearts||3);i++) h+=i<(this.player?.hearts||0)?'❤️':'🖤';
    document.getElementById('hud-hearts').textContent=h;
    const lvl=LEVELS[Math.min(this.lvlIdx,LEVELS.length-1)];
    document.getElementById('hud-level-name').textContent=this.dragonPhase?'🐉 DRAK!':lvl.name;
    document.getElementById('hud-wave').textContent=this.dragonPhase?'BOSS':'Vlna '+(this.waveIdx+1)+' / '+lvl.waves;
    let bh='🛏️ '; for (let i=0;i<2;i++) bh+=i<this.bedHearts?'❤️':'🖤';
    document.getElementById('hud-bed').textContent=bh;
    document.getElementById('hud-score').textContent='⭐ '+this.score;
    document.getElementById('hud-shield').textContent='🛡️ '+(this.player?.shieldCount||0);
    document.getElementById('hud-fast').textContent='⚡ '+this.fastAnswerCount+'/'+FAST_ANSWERS_FOR_BLOCK;
  }

  // ---- UPDATE ----
  _update(dt) {
    if (this.state==='question') {
      this.qTimer-=dt;
      const pct=Math.max(0,this.qTimer/(this.qData?.isDragon?DRAGON_QUESTION_TIME:QUESTION_TIME));
      const bar=document.getElementById('q-timer-bar');
      bar.style.width=(pct*100)+'%';
      bar.style.backgroundColor=pct>0.5?'#27ae60':pct>0.25?'#f39c12':'#e74c3c';
      if (this.qTimer<=0&&!this.qLocked) {
        this.qLocked=true;
        const fb=document.getElementById('q-feedback');
        fb.style.color='#e74c3c';
        fb.textContent=`⏱ Čas vypršel! Odpověď: ${this.qData.answer}`;
        this.qTarget.shake(); this._doDamage(); this._updateHUD();
        this._scheduleCloseQuestion(1400,(!this.player.alive&&this.bedHearts<=0)?()=>this._gameOver():undefined);
      }
      this.particles.forEach(p=>p.update(dt));
      this.particles=this.particles.filter(p=>!p.dead);
      return;
    }
    if (this.state!=='playing') return;

    // Spawn
    this.spawnTimer-=dt;
    if (this.spawnTimer<=0&&this.spawnQueue.length>0) {
      const {type,speed}=this.spawnQueue.shift();
      this._spawnEnemy(type,speed);
      this.spawnTimer=this.SPAWN_INTERVAL;
    }
    if (this.qCooldown>0) this.qCooldown-=dt;

    const island={x:ISLE_X,y:ISLE_Y,w:ISLE_W,h:ISLE_H};
    this.player.update(dt,this.keys,island);
    this.enemies.forEach(e=>e.update(dt,BED_X,BED_Y,this.blocks));

    // Enemy reaches bed
    this.enemies.forEach(e=>{
      if (!e.alive||e.dying) return;
      if (e.distTo(BED_X,BED_Y)<28) {
        e.die();
        for (let i=0;i<5;i++) this.particles.push(new Particle(BED_X,BED_Y,'💔','#e74c3c'));
        if (this.bedHearts>0) this.bedHearts--;
        this.player.hit(); this._updateHUD();
        if (!this.player.alive&&this.bedHearts<=0) { setTimeout(()=>this._gameOver(),400); }
        else if (!this.player.alive) { this.player.hearts=this.player.maxHearts; this.player.alive=true; this._updateHUD(); }
      }
    });

    // Player touches enemy → question
    if (this.qCooldown<=0) {
      for (const e of this.enemies) {
        if (!e.alive||e.dying) continue;
        if (this.player.distTo(e.x,e.y)<INTERACT_R) { this._triggerQuestion(e); break; }
      }
    }

    this.enemies=this.enemies.filter(e=>e.alive||e.dying);
    this.particles.forEach(p=>p.update(dt));
    this.particles=this.particles.filter(p=>!p.dead);

    // Wave complete?
    if (!this.waveCompleted&&this.spawnQueue.length===0&&this.enemies.filter(e=>!e.dying).length===0) {
      this._waveComplete();
    }
  }

  _waveComplete() {
    if (this.state!=='playing') return;
    this.waveCompleted=true; this.score+=50; this.waveIdx++; this._updateHUD();

    const lvl=LEVELS[this.lvlIdx];
    if (this.waveIdx>=lvl.waves) {
      // End of level
      if (this.lvlIdx===LEVELS.length-1&&!this.dragonPhase) {
        // The End complete → spawn dragon boss
        this.dragonPhase=true; this.waveIdx=0;
        this.state='transition'; this.transMsg='🐉 ENDER DRAK SE PROBOUZÍ!\nPřiprav se na ultimátní souboj!';
        setTimeout(()=>{ this.state='playing'; this._spawnDragonBoss(); },3000);
      } else if (this.lvlIdx<LEVELS.length-1) {
        this.lvlIdx++; this.waveIdx=0;
        // Restore shield per level
        this.player.shieldCount=Math.min(2, this.player.shieldCount+1);
        this.state='transition'; this.transMsg='🎉 ÚROVEŇ SPLNĚNA! +50 bodů\nPřiprav se na: '+LEVELS[this.lvlIdx].name;
        setTimeout(()=>{ this.state='playing'; this._startWave(); },2500);
      }
    } else {
      this.state='transition'; this.transMsg='✅ Vlna '+this.waveIdx+' splněna! +50 bodů';
      setTimeout(()=>{ this.state='playing'; this._startWave(); },1600);
    }
  }

  _spawnDragonBoss() {
    this.enemies=[];
    this.blocks.forEach(b=>b.reset());
    const dragon=new Enemy(ENEMY_ISLE_X,ENEMY_ISLE_Y,'enderdragon',BASE_SPEED);
    this.enemies.push(dragon);
    this.waveCompleted=false;
    this.spawnQueue=[];
    this._updateHUD();
  }

  // ---- DRAW ----
  _draw() {
    const ctx=this.ctx;
    const lvlI=Math.min(this.lvlIdx,LEVELS.length-1);
    const lvl=LEVELS[lvlI];
    ctx.fillStyle=lvl.skyColor; ctx.fillRect(0,0,CW,CH);

    // Stars
    this.stars.forEach(s=>{
      ctx.save(); ctx.globalAlpha=s.a; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    // Enemy island
    this._drawEnemyIsland(ctx,lvl);

    // Bridge connecting islands (visual line)
    ctx.save(); ctx.globalAlpha=0.2; ctx.strokeStyle='#888'; ctx.lineWidth=8; ctx.setLineDash([12,8]);
    ctx.beginPath(); ctx.moveTo(ISLE_X+ISLE_W/2,ISLE_Y); ctx.lineTo(ENEMY_ISLE_X-ENEMY_ISLE_W/2,ENEMY_ISLE_Y);
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    // Enemy trails (bridge blocks they place)
    this.enemies.forEach(e=>e.drawTrail(ctx));

    // Player island
    this._drawIsland(ctx,lvl);

    // Bed
    this._drawBed(ctx);

    // Blocks
    this.blocks.forEach(b=>b.draw(ctx));

    // Enemies
    this.enemies.forEach(e=>e.draw(ctx));

    // Player
    if (this.player) this.player.draw(ctx);

    // Particles
    this.particles.forEach(p=>p.draw(ctx));

    // Transition overlay
    if (this.state==='transition') {
      ctx.save(); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,CW,CH);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const lines=this.transMsg.split('\n');
      lines.forEach((line,i)=>{
        ctx.font=`bold ${i===0?36:26}px Arial`;
        ctx.fillStyle=i===0?'#f1c40f':'#fff';
        ctx.fillText(line,CW/2,CH/2-(lines.length-1)*20+i*46);
      }); ctx.restore();
    }

    // Pause overlay
    if (this.paused) this._drawPauseOverlay(ctx);

    // Spawn counter
    if (this.state==='playing'&&this.spawnQueue.length>0) {
      ctx.save(); ctx.font='13px Arial'; ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillText('Přichází: '+(this.spawnQueue.length+this.enemies.filter(e=>!e.dying).length),CW-10,10);
      ctx.restore();
    }
  }

  _drawPauseOverlay(ctx) {
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,CW,CH);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold 44px Arial'; ctx.fillStyle='#fff';
    ctx.fillText('⏸  HRA POZASTAVENA',CW/2,CH/2-40);
    ctx.font='22px Arial'; ctx.fillStyle='#aaa';
    ctx.fillText('[ P ] nebo [ Esc ]  –  Pokračovat',CW/2,CH/2+10);
    ctx.fillText('[ R ]  –  Začít znovu',CW/2,CH/2+45);
    ctx.restore();
  }

  _drawEnemyIsland(ctx, lvl) {
    const x0=ENEMY_ISLE_X-ENEMY_ISLE_W/2, y0=ENEMY_ISLE_Y-ENEMY_ISLE_H/2;
    const T=20;
    ctx.save(); ctx.beginPath(); ctx.rect(x0,y0,ENEMY_ISLE_W,ENEMY_ISLE_H); ctx.clip();
    for (let r=0;r<=Math.ceil(ENEMY_ISLE_H/T);r++) for (let c=0;c<=Math.ceil(ENEMY_ISLE_W/T);c++) {
      ctx.fillStyle=(r+c)%2===0?lvl.grassDark:lvl.grassLight;
      ctx.fillRect(x0+c*T,y0+r*T,T,T);
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=0.5; ctx.strokeRect(x0+c*T,y0+r*T,T,T);
    }
    ctx.restore();
    ctx.strokeStyle=lvl.border; ctx.lineWidth=3; ctx.strokeRect(x0,y0,ENEMY_ISLE_W,ENEMY_ISLE_H);
    // Red flag on enemy island
    ctx.save();
    ctx.fillStyle='#c0392b'; ctx.fillRect(x0+4,y0-18,3,20);
    ctx.beginPath(); ctx.moveTo(x0+7,y0-18); ctx.lineTo(x0+18,y0-12); ctx.lineTo(x0+7,y0-6); ctx.fill();
    ctx.restore();
  }

  _drawIsland(ctx, lvl) {
    const x0=ISLE_X-ISLE_W/2, y0=ISLE_Y-ISLE_H/2, T=40;
    ctx.save(); ctx.beginPath(); ctx.rect(x0,y0,ISLE_W,ISLE_H); ctx.clip();
    for (let r=0;r<=Math.ceil(ISLE_H/T);r++) for (let c=0;c<=Math.ceil(ISLE_W/T);c++) {
      ctx.fillStyle=(r+c)%2===0?lvl.grassDark:lvl.grassLight;
      ctx.fillRect(x0+c*T,y0+r*T,T,T);
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1; ctx.strokeRect(x0+c*T,y0+r*T,T,T);
    }
    ctx.restore();
    ctx.strokeStyle=lvl.border; ctx.lineWidth=5; ctx.strokeRect(x0,y0,ISLE_W,ISLE_H);
    const corners=[[x0,y0],[x0+ISLE_W-T,y0],[x0,y0+ISLE_H-T],[x0+ISLE_W-T,y0+ISLE_H-T]];
    ctx.fillStyle='rgba(0,0,0,0.18)'; corners.forEach(([cx,cy])=>ctx.fillRect(cx,cy,T,T));
  }

  _drawBed(ctx) {
    ctx.save();
    ctx.fillStyle='rgba(255,100,100,0.35)'; ctx.beginPath(); ctx.arc(BED_X,BED_Y,30,0,Math.PI*2); ctx.fill();
    ctx.font='48px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🛏️',BED_X,BED_Y); ctx.restore();
  }

  // ---- LOOP ----
  _loop(ts) {
    const dt=Math.min((ts-this.lastTs)/1000,0.08); this.lastTs=ts;
    if (this.state!=='menu'&&this.state!=='game_over'&&this.state!=='win') {
      if (!this.paused) this._update(dt);
      this._draw();
    }
    requestAnimationFrame(t=>this._loop(t));
  }
}

// =====================================================================
// BOOT
// =====================================================================
window.addEventListener('DOMContentLoaded',()=>new Game());
