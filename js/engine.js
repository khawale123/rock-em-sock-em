import { sound } from './audio.js';

const W = 960;
const H = 540;

const MAX_HP = 100;
const MAX_STAMINA = 100;
const ROUND_TIME = 60;

function createFighter(side) {
  return {
    side, // 'red' | 'blue'
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    blocking: false,
    // Punch state: null | { hand: 'left'|'right', phase: 'windup'|'active'|'recover', timer: number, hitDone: boolean, power: number }
    punch: null,
    stunTimer: 0,
    hitFlash: 0,
    counterWindow: 0, // >0 after a successful block -> next punch is 2x counter!
    lean: 0, // -1..1 recoil/lunge
    headWobble: 0,
    headWobbleVel: 0,
    headPopped: false,
    headPopHeight: 0,
    headPopVel: 0,
    headSpin: 0,
    roundsWon: 0,
    comboCount: 0,
  };
}

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.mode = 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
    this.cpuDifficulty = 'medium';
    this.bestOf = 3;
    this.roundsToWin = 2;

    this.red = createFighter('red');
    this.blue = createFighter('blue');

    this.round = 1;
    this.roundTimer = ROUND_TIME;
    this.phase = 'idle'; // 'idle' | 'intro' | 'fighting' | 'ko' | 'match_over'
    this.phaseTimer = 0;
    this.matchWinner = null;

    this.time = 0;
    this.hitStop = 0;
    this.shake = 0;

    this.particles = [];
    this.callouts = [];

    // CPU AI state
    this.cpuDecisionTimer = 0.5;
    this.cpuBlockTimer = 0;

    this._lastHudSync = 0;
  }

  startMatch({ mode, bestOf = 3, cpuDifficulty = 'medium' }) {
    this.mode = mode;
    this.bestOf = bestOf;
    this.roundsToWin = Math.ceil(bestOf / 2);
    this.cpuDifficulty = cpuDifficulty;

    this.red = createFighter('red');
    this.blue = createFighter('blue');
    this.round = 1;
    this.matchWinner = null;
    this.particles = [];
    this.callouts = [];

    this._startRound();
  }

  _startRound() {
    this._resetFighterForRound(this.red);
    this._resetFighterForRound(this.blue);
    this.roundTimer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseTimer = 1.65;
    this.hitStop = 0;
    this.shake = 0;

    this._emitBanner(`ROUND ${this.round}`, 'GET READY!');
    sound.playBell();
    this._notifyHud(true);
  }

  _resetFighterForRound(f) {
    f.hp = MAX_HP;
    f.stamina = MAX_STAMINA;
    f.blocking = false;
    f.punch = null;
    f.stunTimer = 0;
    f.hitFlash = 0;
    f.counterWindow = 0;
    f.lean = 0;
    f.headWobble = 0;
    f.headWobbleVel = 0;
    f.headPopped = false;
    f.headPopHeight = 0;
    f.headPopVel = 0;
    f.headSpin = 0;
    f.comboCount = 0;
  }

  // Player actions
  triggerPunch(side, hand) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped || f.stunTimer > 0 || f.punch || f.blocking) return false;

    const cost = hand === 'left' ? 14 : 20;
    if (f.stamina < cost * 0.65) return false;

    f.stamina = Math.max(0, f.stamina - cost);
    const isCounter = f.counterWindow > 0;
    f.counterWindow = 0;

    f.punch = {
      hand,
      phase: 'windup',
      timer: hand === 'left' ? 0.07 : 0.105,
      hitDone: false,
      isCounter,
      damage: (hand === 'left' ? 9 : 14) * (isCounter ? 1.85 : 1),
    };
    sound.playWhoosh(hand === 'left' ? 1.15 : 0.88);
    return true;
  }

  setBlock(side, active) {
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped) {
      f.blocking = false;
      return;
    }
    if (active && f.punch) return;
    f.blocking = Boolean(active);
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    // Update particles & callouts always
    this._updateParticles(clampedDt);
    this._updateCallouts(clampedDt);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - clampedDt * 38);
    }

    // Guest only interpolates visual flair; host owns simulation
    if (this.mode === 'online-guest') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
      this._notifyHud(false);
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - clampedDt);
      return;
    }

    if (this.phase === 'intro') {
      this.phaseTimer -= clampedDt;
      if (this.phaseTimer <= 0.55 && this.phaseTimer + clampedDt > 0.55) {
        this._emitBanner('FIGHT!', 'KNOCK THEIR BLOCK OFF!');
      }
      if (this.phaseTimer <= 0) {
        this.phase = 'fighting';
        this._emitBanner(null);
      }
    } else if (this.phase === 'fighting') {
      this.roundTimer = Math.max(0, this.roundTimer - clampedDt);

      if (this.mode === 'cpu') {
        this._updateCpuAI(clampedDt);
      }

      this._updateFighter(this.red, this.blue, clampedDt);
      this._updateFighter(this.blue, this.red, clampedDt);

      if (this.roundTimer <= 0) {
        // Time up: higher HP wins round
        const winner = this.red.hp >= this.blue.hp ? 'red' : 'blue';
        const loser = winner === 'red' ? this.blue : this.red;
        this._triggerRoundEnd(winner, loser, true);
      }
    } else if (this.phase === 'ko') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
      this.phaseTimer -= clampedDt;
      if (this.phaseTimer <= 0) {
        if (this.red.roundsWon >= this.roundsToWin || this.blue.roundsWon >= this.roundsToWin) {
          this.phase = 'match_over';
          this.matchWinner = this.red.roundsWon >= this.roundsToWin ? 'red' : 'blue';
          this._emitBanner(null);
          sound.playVictory();
          if (this.callbacks.onMatchOver) {
            this.callbacks.onMatchOver(this.matchWinner, this.red.roundsWon, this.blue.roundsWon);
          }
        } else {
          this.round += 1;
          this._startRound();
        }
      }
    } else if (this.phase === 'match_over') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
    }

    this._notifyHud(false);
  }

  _updateFighter(f, opp, dt) {
    // Stamina regen
    const regenRate = f.blocking ? 10 : 28;
    f.stamina = Math.min(MAX_STAMINA, f.stamina + regenRate * dt);

    if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.counterWindow > 0) f.counterWindow = Math.max(0, f.counterWindow - dt);

    // Return lean smoothly to 0
    f.lean += (0 - f.lean) * Math.min(1, dt * 11);

    // Punch state machine
    if (f.punch) {
      f.punch.timer -= dt;
      if (f.punch.phase === 'windup' && f.punch.timer <= 0) {
        f.punch.phase = 'active';
        f.punch.timer = f.punch.hand === 'left' ? 0.095 : 0.115;
        f.lean = 0.65;
      }

      if (f.punch.phase === 'active' && !f.punch.hitDone) {
        f.punch.hitDone = true;
        this._resolveHit(f, opp, f.punch);
      }

      if (f.punch.phase === 'active' && f.punch.timer <= 0) {
        f.punch.phase = 'recover';
        f.punch.timer = f.punch.hand === 'left' ? 0.13 : 0.19;
      } else if (f.punch.phase === 'recover' && f.punch.timer <= 0) {
        f.punch = null;
      }
    }

    this._updateHeadPhysics(f, dt);
  }

  _updateHeadPhysics(f, dt) {
    // Spring-damper head wobble
    const springK = 220;
    const damping = 11;
    const accel = -springK * f.headWobble - damping * f.headWobbleVel;
    f.headWobbleVel += accel * dt;
    f.headWobble += f.headWobbleVel * dt;

    // Popped head spring bounce!
    if (f.headPopped) {
      const targetH = 128;
      const popAccel = (targetH - f.headPopHeight) * 140 - f.headPopVel * 7;
      f.headPopVel += popAccel * dt;
      f.headPopHeight += f.headPopVel * dt;
      f.headSpin += dt * 4.5;
    }
  }

  _resolveHit(attacker, defender, punch) {
    const impactX = defender.side === 'blue' ? W * 0.56 : W * 0.44;
    const impactY = H * 0.42 + (punch.hand === 'left' ? -12 : 8);

    if (defender.blocking && defender.stamina >= 6) {
      // Blocked!
      defender.stamina = Math.max(0, defender.stamina - 10);
      defender.hp = Math.max(1, defender.hp - punch.damage * 0.16);
      defender.lean = -0.35;
      defender.counterWindow = 0.7; // Reward well-timed block with counter window!
      attacker.comboCount = 0;

      sound.playBlock();
      this._spawnSparks(impactX, impactY, '#ffd54f', 10);
      this._spawnCallout(impactX, impactY - 36, 'BLOCKED!', '#ffd54f', 0.85);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: impactX, y: impactY });
      return;
    }

    // Clean hit!
    defender.hp = Math.max(0, defender.hp - punch.damage);
    defender.hitFlash = 0.18;
    defender.stunTimer = punch.isCounter ? 0.28 : 0.14;
    defender.lean = -0.9;
    defender.headWobbleVel = (defender.side === 'blue' ? 1 : -1) * (punch.isCounter ? 18 : 11);
    defender.punch = null; // Interrupt windup on clean hit!
    attacker.comboCount += 1;

    const isHeavy = punch.isCounter || punch.hand === 'right';
    const color = attacker.side === 'red' ? '#ff475e' : '#3b93ff';

    if (defender.hp <= 0) {
      // KNOCKED HIS BLOCK OFF!
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnSparks(impactX, impactY, '#ffca28', 36);
      this._spawnSparks(impactX, impactY, color, 26);
      this._spawnCallout(W * 0.5, H * 0.28, 'BLOCK OFF!!', '#ffca28', 1.55);
      this._emitNetEvent('ko', { x: impactX, y: impactY, color });
    } else {
      sound.playHit(isHeavy);
      this.hitStop = punch.isCounter ? 0.085 : 0.038;
      this.shake = punch.isCounter ? 15 : isHeavy ? 9 : 5;
      this._spawnSparks(impactX, impactY, punch.isCounter ? '#ffca28' : color, punch.isCounter ? 20 : 12);

      const words = punch.isCounter
        ? ['COUNTER!!', 'CRUSHED!']
        : punch.hand === 'right'
        ? ['SOCK!', 'BAM!', 'WHAM!']
        : ['POW!', 'BOP!', 'SNAP!'];
      const word = words[Math.floor(Math.random() * words.length)];
      this._spawnCallout(impactX, impactY - 30, word, punch.isCounter ? '#ffca28' : '#ffffff', punch.isCounter ? 1.25 : 0.95);
      this._emitNetEvent('hit', { x: impactX, y: impactY, color, word, heavy: isHeavy, counter: punch.isCounter });
    }
  }

  _triggerRoundEnd(winnerSide, loser, byTimeout) {
    const winner = winnerSide === 'red' ? this.red : this.blue;
    winner.roundsWon += 1;
    loser.blocking = false;
    loser.punch = null;
    loser.headPopped = true;
    loser.headPopVel = 520;
    loser.headWobbleVel = (loser.side === 'blue' ? 1 : -1) * 24;

    this.phase = 'ko';
    this.phaseTimer = 2.6;
    this.hitStop = byTimeout ? 0.05 : 0.18;
    this.shake = 22;

    sound.playHeadPop();
    const bannerMain = byTimeout ? 'TIME UP!' : 'KNOCKOUT!';
    const bannerSub = winnerSide === 'red' ? 'RED ROCKER TAKES THE ROUND!' : 'BLUE BOMBER TAKES THE ROUND!';
    this._emitBanner(bannerMain, bannerSub);
    this._notifyHud(true);
  }

  _updateCpuAI(dt) {
    const cpu = this.blue;
    const player = this.red;

    if (this.cpuBlockTimer > 0) {
      this.cpuBlockTimer -= dt;
      cpu.blocking = true;
      if (this.cpuBlockTimer <= 0) cpu.blocking = false;
      return;
    }

    const cfg = {
      easy:   { reaction: 0.55, blockChance: 0.22, aggro: 0.45 },
      medium: { reaction: 0.34, blockChance: 0.46, aggro: 0.65 },
      hard:   { reaction: 0.20, blockChance: 0.70, aggro: 0.85 },
    }[this.cpuDifficulty] || { reaction: 0.34, blockChance: 0.46, aggro: 0.65 };

    // React to incoming player punch
    if (player.punch && player.punch.phase === 'windup' && !cpu.punch && cpu.stunTimer <= 0) {
      if (Math.random() < cfg.blockChance * dt * 16) {
        this.cpuBlockTimer = 0.28 + Math.random() * 0.2;
        cpu.blocking = true;
        return;
      }
    }

    this.cpuDecisionTimer -= dt;
    if (this.cpuDecisionTimer <= 0) {
      this.cpuDecisionTimer = cfg.reaction * (0.65 + Math.random() * 0.8);

      // Immediately counter if we have a counter window!
      if (cpu.counterWindow > 0) {
        this.triggerPunch('blue', 'right');
        return;
      }

      const roll = Math.random();
      if (roll < cfg.aggro && cpu.stamina > 24) {
        const hand = Math.random() < 0.55 ? 'left' : 'right';
        this.triggerPunch('blue', hand);
      } else if (roll < cfg.aggro + 0.18) {
        this.cpuBlockTimer = 0.3 + Math.random() * 0.25;
        cpu.blocking = true;
      }
    }
  }

  // Network state sync
  exportState() {
    const pick = (f) => ({
      hp: Math.round(f.hp * 10) / 10,
      stamina: Math.round(f.stamina),
      blocking: f.blocking,
      punch: f.punch ? { hand: f.punch.hand, phase: f.punch.phase, timer: f.punch.timer, isCounter: f.punch.isCounter } : null,
      stunTimer: f.stunTimer,
      hitFlash: f.hitFlash,
      counterWindow: f.counterWindow,
      lean: f.lean,
      headPopped: f.headPopped,
      roundsWon: f.roundsWon,
    });

    return {
      round: this.round,
      roundTimer: this.roundTimer,
      phase: this.phase,
      matchWinner: this.matchWinner,
      bestOf: this.bestOf,
      roundsToWin: this.roundsToWin,
      red: pick(this.red),
      blue: pick(this.blue),
    };
  }

  applyState(s) {
    if (!s) return;
    const prevPhase = this.phase;
    const prevRound = this.round;

    this.round = s.round;
    this.roundTimer = s.roundTimer;
    this.phase = s.phase;
    this.matchWinner = s.matchWinner;
    this.bestOf = s.bestOf;
    this.roundsToWin = s.roundsToWin;

    const merge = (target, src) => {
      const wasPopped = target.headPopped;
      Object.assign(target, src);
      if (!wasPopped && target.headPopped) {
        target.headPopVel = 520;
        target.headWobbleVel = (target.side === 'blue' ? 1 : -1) * 24;
      }
      if (wasPopped && !target.headPopped) {
        target.headPopHeight = 0;
        target.headPopVel = 0;
        target.headSpin = 0;
      }
    };

    merge(this.red, s.red);
    merge(this.blue, s.blue);

    if (prevPhase !== this.phase || prevRound !== this.round) {
      if (this.phase === 'intro') {
        this._emitBanner(`ROUND ${this.round}`, 'GET READY!');
        sound.playBell();
      } else if (this.phase === 'fighting') {
        this._emitBanner(null);
      } else if (this.phase === 'ko') {
        const redWon = this.blue.headPopped;
        this._emitBanner('KNOCKOUT!', redWon ? 'RED ROCKER TAKES THE ROUND!' : 'BLUE BOMBER TAKES THE ROUND!');
      } else if (this.phase === 'match_over') {
        this._emitBanner(null);
        sound.playVictory();
        if (this.callbacks.onMatchOver) {
          this.callbacks.onMatchOver(this.matchWinner, this.red.roundsWon, this.blue.roundsWon);
        }
      }
    }
    this._notifyHud(true);
  }

  applyNetEvent(ev) {
    if (!ev) return;
    if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnSparks(ev.x, ev.y, '#ffd54f', 10);
      this._spawnCallout(ev.x, ev.y - 36, 'BLOCKED!', '#ffd54f', 0.85);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy);
      this.shake = ev.counter ? 15 : ev.heavy ? 9 : 5;
      this._spawnSparks(ev.x, ev.y, ev.counter ? '#ffca28' : ev.color, ev.counter ? 20 : 12);
      this._spawnCallout(ev.x, ev.y - 30, ev.word, ev.counter ? '#ffca28' : '#ffffff', ev.counter ? 1.25 : 0.95);
    } else if (ev.kind === 'ko') {
      sound.playHeadPop();
      this.shake = 22;
      this._spawnSparks(ev.x, ev.y, '#ffca28', 36);
      this._spawnSparks(ev.x, ev.y, ev.color, 24);
      this._spawnCallout(W * 0.5, H * 0.28, 'BLOCK OFF!!', '#ffca28', 1.55);
    }
  }

  _emitNetEvent(kind, payload) {
    if (this.callbacks.onNetEvent) {
      this.callbacks.onNetEvent({ kind, ...payload });
    }
  }

  _emitBanner(main, sub = '') {
    if (this.callbacks.onBanner) {
      this.callbacks.onBanner(main, sub);
    }
  }

  _notifyHud(force) {
    if (!this.callbacks.onHud) return;
    const now = performance.now();
    if (force || now - this._lastHudSync > 50) {
      this._lastHudSync = now;
      this.callbacks.onHud({
        round: this.round,
        roundTimer: Math.ceil(this.roundTimer),
        roundsToWin: this.roundsToWin,
        red: { hp: this.red.hp, stamina: this.red.stamina, roundsWon: this.red.roundsWon },
        blue: { hp: this.blue.hp, stamina: this.blue.stamina, roundsWon: this.blue.roundsWon },
      });
    }
  }

  // Particles & Callouts
  _spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 110 + Math.random() * 340;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: 3 + Math.random() * 5,
        color,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
      });
    }
  }

  _spawnCallout(x, y, text, color, scale = 1) {
    this.callouts.push({
      x,
      y,
      text,
      color,
      scale,
      life: 0.75,
      maxLife: 0.75,
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 680 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _updateCallouts(dt) {
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 42 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  // ==========================
  // RENDERING
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();

    // Camera shake
    if (this.shake > 0.2) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      ctx.translate(sx, sy);
    }

    this._drawArenaBackdrop(ctx);
    this._drawRingBack(ctx);

    // Draw fighters (draw punching fighter on top for crisp glove overlap)
    const redOnTop = Boolean(this.red.punch && this.red.punch.phase === 'active');
    if (redOnTop) {
      this._drawRobot(ctx, this.blue, W * 0.62, H * 0.68, -1);
      this._drawRobot(ctx, this.red, W * 0.38, H * 0.68, 1);
    } else {
      this._drawRobot(ctx, this.red, W * 0.38, H * 0.68, 1);
      this._drawRobot(ctx, this.blue, W * 0.62, H * 0.68, -1);
    }

    this._drawRingFront(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore();
  }

  _drawArenaBackdrop(ctx) {
    // Deep stadium gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1326');
    bg.addColorStop(0.55, '#17203d');
    bg.addColorStop(1, '#090c17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Sweeping spotlight cones
    ctx.save();
    const sway = Math.sin(this.time * 0.8) * 35;
    this._drawSpotlight(ctx, W * 0.24, -20, W * 0.36 + sway, H * 0.72, 'rgba(255, 70, 95, 0.10)');
    this._drawSpotlight(ctx, W * 0.76, -20, W * 0.64 - sway, H * 0.72, 'rgba(40, 140, 255, 0.11)');
    this._drawSpotlight(ctx, W * 0.5, -30, W * 0.5, H * 0.78, 'rgba(255, 220, 130, 0.09)');
    ctx.restore();

    // Distant crowd silhouettes
    ctx.fillStyle = 'rgba(8, 11, 22, 0.72)';
    for (let i = 0; i < 36; i++) {
      const cx = (i / 35) * W;
      const bob = Math.sin(this.time * 4 + i * 1.3) * 3;
      ctx.beginPath();
      ctx.arc(cx, H * 0.44 + bob, 14 + (i % 3) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(0, H * 0.44, W, H * 0.2);
  }

  _drawSpotlight(ctx, x0, y0, x1, y1, color) {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 - 24, y0);
    ctx.lineTo(x0 + 24, y0);
    ctx.lineTo(x1 + 130, y1);
    ctx.lineTo(x1 - 130, y1);
    ctx.closePath();
    ctx.fill();
  }

  _drawRingBack(ctx) {
    // Classic yellow toy-arena outer base platform
    ctx.fillStyle = '#d99800';
    ctx.beginPath();
    ctx.moveTo(76, H * 0.78);
    ctx.lineTo(W - 76, H * 0.78);
    ctx.lineTo(W - 44, H * 0.94);
    ctx.lineTo(44, H * 0.94);
    ctx.closePath();
    ctx.fill();

    // Ring canvas floor (perspective trapezoid)
    const matGrad = ctx.createLinearGradient(0, H * 0.57, 0, H * 0.85);
    matGrad.addColorStop(0, '#eef3ff');
    matGrad.addColorStop(1, '#c3d0ea');
    ctx.fillStyle = matGrad;
    ctx.beginPath();
    ctx.moveTo(155, H * 0.58);
    ctx.lineTo(W - 155, H * 0.58);
    ctx.lineTo(W - 68, H * 0.83);
    ctx.lineTo(68, H * 0.83);
    ctx.closePath();
    ctx.fill();

    // Yellow toy-ring border trim
    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Center ring emblem
    ctx.save();
    ctx.translate(W * 0.5, H * 0.70);
    ctx.scale(1, 0.36);
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 51, 75, 0.35)';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(36, 132, 255, 0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Toy sliding base tracks under each robot
    ctx.fillStyle = 'rgba(15, 22, 42, 0.25)';
    ctx.beginPath();
    ctx.roundRect(W * 0.24, H * 0.70, W * 0.22, 16, 8);
    ctx.roundRect(W * 0.54, H * 0.70, W * 0.22, 16, 8);
    ctx.fill();

    // Back corner posts
    this._drawCornerPost(ctx, 160, H * 0.58, '#ff334b', 0.82);
    this._drawCornerPost(ctx, W - 160, H * 0.58, '#2484ff', 0.82);

    // Back ropes
    const ropeColors = ['#ff334b', '#ffffff', '#2484ff'];
    ropeColors.forEach((col, idx) => {
      const y = H * 0.44 + idx * 24;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(160, y);
      ctx.lineTo(W - 160, y);
      ctx.stroke();
    });
  }

  _drawRingFront(ctx) {
    // Front corner posts (on edges so they frame the ring without blocking robots)
    this._drawCornerPost(ctx, 74, H * 0.83, '#ff334b', 1.05);
    this._drawCornerPost(ctx, W - 74, H * 0.83, '#2484ff', 1.05);

    // Subtle front lower rope
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(74, H * 0.76);
    ctx.lineTo(W - 74, H * 0.76);
    ctx.stroke();
    ctx.restore();
  }

  _drawCornerPost(ctx, x, baseY, color, scale) {
    const postH = 120 * scale;
    const postW = 16 * scale;

    ctx.fillStyle = '#252d44';
    ctx.fillRect(x - postW / 2, baseY - postH, postW, postH);

    // Colored padding
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - postW * 0.75, baseY - postH + 14 * scale, postW * 1.5, postH * 0.7, 6);
    ctx.fill();

    // Glossy cap ball
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(x, baseY - postH, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawRobot(ctx, f, baseX, baseY, dir) {
    // dir: +1 faces right (Red), -1 faces left (Blue)
    const isRed = f.side === 'red';
    const primary = isRed ? '#ff2e4c' : '#1e7eff';
    const dark = isRed ? '#9e0e25' : '#0c439c';
    const light = isRed ? '#ff7c8f' : '#7cb8ff';
    const gloveCol = isRed ? '#e61938' : '#0f66e6';

    const idleBob = f.headPopped ? 0 : Math.sin(this.time * 6.5 + (isRed ? 0 : 1.7)) * 4;
    const lungeX = f.lean * 28 * dir;

    ctx.save();
    ctx.translate(baseX + lungeX, baseY);

    // Ground shadow
    ctx.fillStyle = 'rgba(8, 12, 24, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 66, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Counter-ready golden aura!
    if (f.counterWindow > 0 && !f.headPopped) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 202, 40, 0.85)';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#ffca28';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, -80, 74, 108, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Toy legs & chunky boots anchored to the slider base
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(-34, -40, 24, 62, 8);
    ctx.roundRect(10, -40, 24, 62, 8);
    ctx.fill();

    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(-40, 8, 34, 18, 8);
    ctx.roundRect(6, 8, 34, 18, 8);
    ctx.fill();

    // Upper body pivot (leans forward on punch, back on hit)
    ctx.save();
    ctx.translate(0, -22 + idleBob);
    ctx.rotate(f.lean * 0.16 * dir);

    // Back arm (Right cross or Left depending on facing)
    this._drawArm(ctx, f, 'right', dir, primary, dark, gloveCol, true);

    // Chunky Toy Robot Torso
    const torsoGrad = ctx.createLinearGradient(-46, -120, 46, 0);
    torsoGrad.addColorStop(0, light);
    torsoGrad.addColorStop(0.35, primary);
    torsoGrad.addColorStop(1, dark);

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : torsoGrad;
    ctx.beginPath();
    ctx.roundRect(-46, -118, 92, 104, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();

    // Chest armor plate + specular shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.roundRect(-32, -104, 64, 38, 10);
    ctx.fill();

    // Waist belt
    ctx.fillStyle = '#1b2236';
    ctx.fillRect(-44, -30, 88, 14);
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.roundRect(-14, -32, 28, 18, 4);
    ctx.fill();

    // Spring Neck + Robot Head!
    this._drawHeadAndSpring(ctx, f, dir, primary, dark, light);

    // Front arm (Left hook)
    this._drawArm(ctx, f, 'left', dir, primary, dark, gloveCol, false);

    // Guard shield shimmer when blocking
    if (f.blocking) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
      ctx.fillStyle = 'rgba(255, 213, 79, 0.14)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(46 * dir, -92, 46, dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55, dir > 0 ? Math.PI * 0.45 : Math.PI * 1.45);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // upper body
    ctx.restore(); // robot root
  }

  _drawHeadAndSpring(ctx, f, dir, primary, dark, light) {
    const neckBaseY = -118;
    const popOffset = f.headPopped ? f.headPopHeight : 0;
    const springLen = 18 + popOffset;

    // Metallic zigzag coil spring
    ctx.save();
    ctx.strokeStyle = '#cfd8ec';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const coils = f.headPopped ? 9 : 4;
    ctx.moveTo(0, neckBaseY);
    for (let i = 1; i <= coils; i++) {
      const t = i / coils;
      const sx = (i % 2 === 0 ? -10 : 10) + f.headWobble * 12 * t;
      const sy = neckBaseY - springLen * t;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(f.headWobble * 14, neckBaseY - springLen);
    ctx.stroke();
    ctx.restore();

    // Head!
    ctx.save();
    ctx.translate(f.headWobble * 14, neckBaseY - springLen - 26);
    const tilt = f.headPopped ? Math.sin(f.headSpin) * 0.55 : f.headWobble * 0.35;
    ctx.rotate(tilt);

    // Helmet / Head box
    const headGrad = ctx.createLinearGradient(-30, -34, 30, 34);
    headGrad.addColorStop(0, light);
    headGrad.addColorStop(0.4, primary);
    headGrad.addColorStop(1, dark);

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.beginPath();
    ctx.roundRect(-30, -32, 60, 56, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Mohawk / crest ridge
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.roundRect(-8, -40, 16, 12, 4);
    ctx.fill();

    // Visor / Eyes facing opponent
    const faceX = 10 * dir;
    ctx.fillStyle = '#111626';
    ctx.beginPath();
    ctx.roundRect(faceX - 18, -16, 36, 18, 6);
    ctx.fill();

    if (f.headPopped) {
      // Dizzy X eyes!
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 3;
      [-7, 7].forEach((ox) => {
        ctx.beginPath();
        ctx.moveTo(faceX + ox - 4, -11);
        ctx.lineTo(faceX + ox + 4, -3);
        ctx.moveTo(faceX + ox + 4, -11);
        ctx.lineTo(faceX + ox - 4, -3);
        ctx.stroke();
      });
    } else {
      // Glowing robot eyes
      ctx.fillStyle = f.counterWindow > 0 ? '#ffca28' : '#7cf6ff';
      const eyeH = f.stunTimer > 0 ? 11 : 7;
      ctx.beginPath();
      ctx.roundRect(faceX - 12, -10 - eyeH / 2 + 2, 9, eyeH, 3);
      ctx.roundRect(faceX + 3, -10 - eyeH / 2 + 2, 9, eyeH, 3);
      ctx.fill();
    }

    // Iconic Rock 'Em Sock 'Em Jaw / Chin Guard!
    ctx.fillStyle = '#dce4f5';
    ctx.beginPath();
    ctx.roundRect(faceX - 15, 6, 30, 14, 5);
    ctx.fill();

    ctx.restore();
  }

  _drawArm(ctx, f, hand, dir, primary, dark, gloveCol, isBack) {
    const shoulderX = (isBack ? 24 : -18) * dir;
    const shoulderY = -98;

    let reach = 42;
    let liftY = isBack ? -6 : 6;
    let gloveScale = 1;

    if (f.blocking) {
      reach = 50;
      liftY = -28 + (isBack ? -6 : 6);
    } else if (f.punch && f.punch.hand === hand) {
      if (f.punch.phase === 'windup') {
        reach = 18;
        liftY = 14;
      } else if (f.punch.phase === 'active') {
        reach = hand === 'right' ? 148 : 132;
        liftY = hand === 'left' ? -18 : -4;
        gloveScale = f.punch.isCounter ? 1.38 : 1.22;
      } else {
        reach = 82;
        liftY = 0;
      }
    } else {
      // Idle boxing bob
      reach = 46 + Math.sin(this.time * 7 + (isBack ? 2 : 0)) * 5;
      liftY = (isBack ? -12 : 4) + Math.cos(this.time * 7) * 4;
    }

    const gloveX = shoulderX + reach * dir;
    const gloveY = shoulderY + liftY;

    ctx.save();
    // Arm piston / lever
    ctx.strokeStyle = isBack ? dark : primary;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gloveX, gloveY);
    ctx.stroke();

    // Inner metallic piston rod on full extension
    if (reach > 90) {
      ctx.strokeStyle = '#dce4f5';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(shoulderX + 20 * dir, shoulderY);
      ctx.lineTo(gloveX - 14 * dir, gloveY);
      ctx.stroke();
    }

    // Shoulder joint cap
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(shoulderX, shoulderY, 13, 0, Math.PI * 2);
    ctx.fill();

    // Chunky Boxing Glove
    ctx.translate(gloveX, gloveY);
    ctx.scale(gloveScale, gloveScale);

    ctx.fillStyle = gloveCol;
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();

    // Glossy glove highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-6 * dir, -8, 8, 5, -0.4 * dir, 0, Math.PI * 2);
    ctx.fill();

    // Wrist cuff
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-22 * dir - (dir > 0 ? 6 : 0), -11, 10, 22, 4);
    ctx.fill();

    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawCallouts(ctx) {
    for (const c of this.callouts) {
      const alpha = Math.min(1, (c.life / c.maxLife) * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.font = `700 ${Math.round(42 * c.scale)}px 'Bangers', Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#0b0e18';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }
  }
}
