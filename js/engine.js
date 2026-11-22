import { sound } from './audio.js';

const W = 960;
const H = 540;

const MAX_HP = 100;
const MAX_STAMINA = 100;
const ROUND_TIME = 60;

export const FIGHTER_MOVES = {
  red: [
    {
      id: 'pear_bounce',
      label: 'PEAR BOUNCE',
      emoji: '🍐',
      damage: 10,
      stamina: 14,
      windup: 0.08,
      active: 0.24,
      recover: 0.14,
      extraStun: 0,
      callout: 'PEAR BOUNCE!',
      color: '#a3e635',
      heavy: false,
    },
    {
      id: 'dj_spin',
      label: 'DJ SPIN',
      emoji: '🎧',
      damage: 12,
      stamina: 18,
      windup: 0.09,
      active: 0.30,
      recover: 0.16,
      extraStun: 0.06,
      callout: 'DJ SPIN! ♫',
      color: '#ff69b4',
      heavy: false,
    },
    {
      id: 'mango_seed',
      label: 'MANGO SEED',
      emoji: '🥭',
      damage: 16,
      stamina: 24,
      windup: 0.13,
      active: 0.26,
      recover: 0.20,
      extraStun: 0.1,
      callout: 'MANGO SEED!!',
      color: '#ffb703',
      heavy: true,
    },
    {
      id: 'coke_burp',
      label: 'COKE BURP',
      emoji: '🥤',
      damage: 13,
      stamina: 22,
      windup: 0.12,
      active: 0.32,
      recover: 0.18,
      extraStun: 0.24,
      callout: 'COKE BURP!!',
      color: '#ff5c5c',
      heavy: true,
    },
  ],
  blue: [
    {
      id: 'white_claw',
      label: 'WHITE CLAW',
      emoji: '🫧',
      damage: 11,
      stamina: 15,
      windup: 0.08,
      active: 0.24,
      recover: 0.14,
      extraStun: 0,
      callout: 'WHITE CLAW!',
      color: '#38bdf8',
      heavy: false,
    },
    {
      id: 'height_mog',
      label: 'HEIGHT MOG',
      emoji: '📏',
      damage: 14,
      stamina: 20,
      windup: 0.11,
      active: 0.28,
      recover: 0.18,
      extraStun: 0.1,
      callout: 'HEIGHT MOGGED!',
      color: '#facc15',
      heavy: true,
    },
    {
      id: 'forehead_kiss',
      label: 'FOREHEAD KISS',
      emoji: '💋',
      damage: 12,
      stamina: 17,
      windup: 0.10,
      active: 0.28,
      recover: 0.16,
      extraStun: 0.2,
      callout: 'FOREHEAD KISS ♥',
      color: '#ff7eb6',
      heavy: false,
    },
    {
      id: 'eyp_report',
      label: 'EYP REPORT',
      emoji: '📊',
      damage: 16,
      stamina: 24,
      windup: 0.14,
      active: 0.28,
      recover: 0.20,
      extraStun: 0.12,
      callout: 'EYP REPORT!!',
      color: '#60a5fa',
      heavy: true,
    },
  ],
};

function createFighter(side) {
  return {
    side, // 'red' (Wifebun) | 'blue' (Husbun)
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    blocking: false,
    // move: null | { index, id, phase: 'windup'|'active'|'recover', timer, duration, hitDone, isCounter, damage, extraStun, callout, color, heavy }
    move: null,
    stunTimer: 0,
    blushTimer: 0,
    hitFlash: 0,
    counterWindow: 0,
    lean: 0,
    jumpY: 0,
    stretchH: 0, // for Height Mog!
    spinAngle: 0, // for DJ Spin!
    headWobble: 0,
    headWobbleVel: 0,
    headPopped: false,
    headPopHeight: 0,
    headPopVel: 0,
    headSpin: 0,
    roundsWon: 0,
  };
}

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.mode = 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
    this.humanSide = 'red'; // used in CPU mode so user can play as Wifebun OR Husbun
    this.cpuDifficulty = 'medium';
    this.bestOf = 3;
    this.roundsToWin = 2;

    this.red = createFighter('red');   // Wifebun
    this.blue = createFighter('blue'); // Husbun

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
    this.vfx = []; // custom move animations (pear, mango seed, bubbles, kiss, EYP binder, claw, etc.)

    this.cpuDecisionTimer = 0.5;
    this.cpuBlockTimer = 0;
    this._lastHudSync = 0;
  }

  startMatch({ mode, bestOf = 3, cpuDifficulty = 'medium', humanSide = 'red' }) {
    this.mode = mode;
    this.humanSide = humanSide;
    this.bestOf = bestOf;
    this.roundsToWin = Math.ceil(bestOf / 2);
    this.cpuDifficulty = cpuDifficulty;

    this.red = createFighter('red');
    this.blue = createFighter('blue');
    this.round = 1;
    this.matchWinner = null;
    this.particles = [];
    this.callouts = [];
    this.vfx = [];

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
    this.vfx = [];

    this._emitBanner(`ROUND ${this.round}`, 'GET READY BUNNIES!');
    sound.playBell();
    this._notifyHud(true);
  }

  _resetFighterForRound(f) {
    f.hp = MAX_HP;
    f.stamina = MAX_STAMINA;
    f.blocking = false;
    f.move = null;
    f.stunTimer = 0;
    f.blushTimer = 0;
    f.hitFlash = 0;
    f.counterWindow = 0;
    f.lean = 0;
    f.jumpY = 0;
    f.stretchH = 0;
    f.spinAngle = 0;
    f.headWobble = 0;
    f.headWobbleVel = 0;
    f.headPopped = false;
    f.headPopHeight = 0;
    f.headPopVel = 0;
    f.headSpin = 0;
  }

  // Trigger one of the character's 4 unique moves (moveIndex: 0..3)
  triggerMove(side, moveIndex) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped || f.stunTimer > 0 || f.move || f.blocking) return false;

    const moves = FIGHTER_MOVES[side];
    const def = moves[moveIndex];
    if (!def) return false;

    if (f.stamina < def.stamina * 0.6) return false;
    f.stamina = Math.max(0, f.stamina - def.stamina);

    const isCounter = f.counterWindow > 0;
    f.counterWindow = 0;

    f.move = {
      index: moveIndex,
      id: def.id,
      phase: 'windup',
      timer: def.windup,
      activeDur: def.active,
      recoverDur: def.recover,
      hitDone: false,
      isCounter,
      damage: def.damage * (isCounter ? 1.75 : 1),
      extraStun: def.extraStun || 0,
      callout: def.callout,
      color: def.color,
      heavy: def.heavy,
    };

    sound.playMove(def.id);
    this._spawnMoveVfx(side, def.id);
    this._emitNetEvent('move_vfx', { side, moveId: def.id });
    return true;
  }

  setBlock(side, active) {
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped) {
      f.blocking = false;
      return;
    }
    if (active && f.move) return;
    f.blocking = Boolean(active);
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    this._updateParticles(clampedDt);
    this._updateCallouts(clampedDt);
    this._updateVfx(clampedDt);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - clampedDt * 38);
    }

    if (this.mode === 'online-guest') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
      this._updateBodyPose(this.red, clampedDt);
      this._updateBodyPose(this.blue, clampedDt);
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
        this._emitBanner('FIGHT!', 'BEATDOWN SESH!');
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
        const winner = this.red.hp >= this.blue.hp ? 'red' : 'blue';
        const loser = winner === 'red' ? this.blue : this.red;
        this._triggerRoundEnd(winner, loser, true);
      }
    } else if (this.phase === 'ko') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
      this._updateBodyPose(this.red, clampedDt);
      this._updateBodyPose(this.blue, clampedDt);
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
      this._updateBodyPose(this.red, clampedDt);
      this._updateBodyPose(this.blue, clampedDt);
    }

    this._notifyHud(false);
  }

  _updateFighter(f, opp, dt) {
    const regenRate = f.blocking ? 10 : 28;
    f.stamina = Math.min(MAX_STAMINA, f.stamina + regenRate * dt);

    if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
    if (f.blushTimer > 0) f.blushTimer = Math.max(0, f.blushTimer - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.counterWindow > 0) f.counterWindow = Math.max(0, f.counterWindow - dt);

    if (f.move) {
      f.move.timer -= dt;
      if (f.move.phase === 'windup' && f.move.timer <= 0) {
        f.move.phase = 'active';
        f.move.timer = f.move.activeDur;
        f.lean = f.move.id === 'forehead_kiss' ? 1.15 : f.move.id === 'coke_burp' ? 0.55 : 0.78;
      }

      if (f.move.phase === 'active' && !f.move.hitDone && f.move.timer <= f.move.activeDur * 0.65) {
        f.move.hitDone = true;
        this._resolveHit(f, opp, f.move);
      }

      if (f.move.phase === 'active' && f.move.timer <= 0) {
        f.move.phase = 'recover';
        f.move.timer = f.move.recoverDur;
      } else if (f.move.phase === 'recover' && f.move.timer <= 0) {
        f.move = null;
      }
    }

    this._updateBodyPose(f, dt);
    this._updateHeadPhysics(f, dt);
  }

  _updateBodyPose(f, dt) {
    f.lean += (0 - f.lean) * Math.min(1, dt * 10);

    // Pear Bounce jump arc
    const targetJump = f.move && f.move.id === 'pear_bounce' && f.move.phase === 'active' ? -54 : 0;
    f.jumpY += (targetJump - f.jumpY) * Math.min(1, dt * 16);

    // Height Mog dramatic towering stretch!
    const targetStretch = f.move && f.move.id === 'height_mog' && f.move.phase !== 'recover' ? 68 : 0;
    f.stretchH += (targetStretch - f.stretchH) * Math.min(1, dt * 14);

    // DJ Spin rapid twirl!
    if (f.move && f.move.id === 'dj_spin' && f.move.phase === 'active') {
      f.spinAngle += dt * 24;
    } else {
      f.spinAngle = 0;
    }
  }

  _updateHeadPhysics(f, dt) {
    const springK = 220;
    const damping = 11;
    const accel = -springK * f.headWobble - damping * f.headWobbleVel;
    f.headWobbleVel += accel * dt;
    f.headWobble += f.headWobbleVel * dt;

    if (f.headPopped) {
      const targetH = 128;
      const popAccel = (targetH - f.headPopHeight) * 140 - f.headPopVel * 7;
      f.headPopVel += popAccel * dt;
      f.headPopHeight += f.headPopVel * dt;
      f.headSpin += dt * 4.5;
    }
  }

  _resolveHit(attacker, defender, move) {
    const impactX = defender.side === 'blue' ? W * 0.58 : W * 0.42;
    const impactY = H * 0.42;

    if (defender.blocking && defender.stamina >= 6) {
      defender.stamina = Math.max(0, defender.stamina - 10);
      defender.hp = Math.max(1, defender.hp - move.damage * 0.16);
      defender.lean = -0.35;
      defender.counterWindow = 0.72;

      sound.playBlock();
      this._spawnSparks(impactX, impactY, '#ffd54f', 10);
      this._spawnCallout(impactX, impactY - 36, 'BLOCKED!', '#ffd54f', 0.85);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: impactX, y: impactY });
      return;
    }

    // Clean hit!
    defender.hp = Math.max(0, defender.hp - move.damage);
    defender.hitFlash = 0.18;
    defender.stunTimer = (move.isCounter ? 0.28 : 0.14) + (move.extraStun || 0);
    if (move.id === 'forehead_kiss') {
      defender.blushTimer = 1.4;
    }
    defender.lean = -0.92;
    defender.headWobbleVel = (defender.side === 'blue' ? 1 : -1) * (move.isCounter ? 18 : 12);
    defender.move = null;

    if (defender.hp <= 0) {
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnSparks(impactX, impactY, '#ffca28', 36);
      this._spawnSparks(impactX, impactY, move.color, 26);
      this._spawnCallout(W * 0.5, H * 0.27, 'BUN POPPED!!', '#ffca28', 1.55);
      this._emitNetEvent('ko', { x: impactX, y: impactY, color: move.color });
    } else {
      sound.playHit(move.heavy || move.isCounter);
      this.hitStop = move.isCounter ? 0.08 : 0.036;
      this.shake = move.isCounter ? 15 : move.heavy ? 10 : 6;
      this._spawnMoveHitParticles(impactX, impactY, move.id, move.color);

      const label = move.isCounter ? `COUNTER ${move.callout}` : move.callout;
      this._spawnCallout(impactX, impactY - 36, label, move.isCounter ? '#ffca28' : move.color, move.isCounter ? 1.15 : 0.96);
      this._emitNetEvent('hit', {
        x: impactX,
        y: impactY,
        moveId: move.id,
        color: move.color,
        word: label,
        heavy: move.heavy,
        counter: move.isCounter,
      });
    }
  }

  _triggerRoundEnd(winnerSide, loser, byTimeout) {
    const winner = winnerSide === 'red' ? this.red : this.blue;
    winner.roundsWon += 1;
    loser.blocking = false;
    loser.move = null;
    loser.headPopped = true;
    loser.headPopVel = 520;
    loser.headWobbleVel = (loser.side === 'blue' ? 1 : -1) * 24;

    this.phase = 'ko';
    this.phaseTimer = 2.6;
    this.hitStop = byTimeout ? 0.05 : 0.18;
    this.shake = 22;

    sound.playHeadPop();
    const bannerMain = byTimeout ? 'TIME UP!' : 'KNOCKOUT!';
    const bannerSub = winnerSide === 'red' ? 'WIFEBUN TAKES THE ROUND!' : 'HUSBUN TAKES THE ROUND!';
    this._emitBanner(bannerMain, bannerSub);
    this._notifyHud(true);
  }

  _updateCpuAI(dt) {
    const cpuSide = this.humanSide === 'red' ? 'blue' : 'red';
    const cpu = cpuSide === 'red' ? this.red : this.blue;
    const player = cpuSide === 'red' ? this.blue : this.red;

    if (this.cpuBlockTimer > 0) {
      this.cpuBlockTimer -= dt;
      cpu.blocking = true;
      if (this.cpuBlockTimer <= 0) cpu.blocking = false;
      return;
    }

    const cfg = {
      easy:   { reaction: 0.62, blockChance: 0.22, aggro: 0.48 },
      medium: { reaction: 0.38, blockChance: 0.45, aggro: 0.68 },
      hard:   { reaction: 0.22, blockChance: 0.68, aggro: 0.85 },
    }[this.cpuDifficulty] || { reaction: 0.38, blockChance: 0.45, aggro: 0.68 };

    if (player.move && player.move.phase === 'windup' && !cpu.move && cpu.stunTimer <= 0) {
      if (Math.random() < cfg.blockChance * dt * 16) {
        this.cpuBlockTimer = 0.28 + Math.random() * 0.22;
        cpu.blocking = true;
        return;
      }
    }

    this.cpuDecisionTimer -= dt;
    if (this.cpuDecisionTimer <= 0) {
      this.cpuDecisionTimer = cfg.reaction * (0.65 + Math.random() * 0.8);

      if (cpu.counterWindow > 0) {
        this.triggerMove(cpuSide, Math.random() < 0.5 ? 2 : 3);
        return;
      }

      const roll = Math.random();
      if (roll < cfg.aggro && cpu.stamina > 24) {
        const moveIdx = Math.floor(Math.random() * 4);
        this.triggerMove(cpuSide, moveIdx);
      } else if (roll < cfg.aggro + 0.18) {
        this.cpuBlockTimer = 0.3 + Math.random() * 0.25;
        cpu.blocking = true;
      }
    }
  }

  // ==========================
  // CUSTOM MOVE VFX
  // ==========================
  _spawnMoveVfx(side, moveId) {
    const dir = side === 'red' ? 1 : -1;
    const startX = side === 'red' ? W * 0.40 : W * 0.60;
    const targetX = side === 'red' ? W * 0.60 : W * 0.40;
    this.vfx.push({
      side,
      dir,
      moveId,
      startX,
      targetX,
      t: 0,
      duration: 0.48,
    });
  }

  _updateVfx(dt) {
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      this.vfx[i].t += dt;
      if (this.vfx[i].t >= this.vfx[i].duration) {
        this.vfx.splice(i, 1);
      }
    }
  }

  _spawnMoveHitParticles(x, y, moveId, color) {
    if (moveId === 'forehead_kiss') {
      this._spawnSparks(x, y - 20, '#ff69b4', 16, 'heart');
    } else if (moveId === 'dj_spin') {
      this._spawnSparks(x, y, '#ff69b4', 8, 'note');
      this._spawnSparks(x, y, '#38bdf8', 8, 'note');
    } else if (moveId === 'eyp_report') {
      this._spawnSparks(x, y, '#ffffff', 12, 'page');
      this._spawnSparks(x, y, '#3b82f6', 10, 'dot');
    } else if (moveId === 'coke_burp') {
      this._spawnSparks(x, y, '#7c3f1d', 12, 'bubble');
      this._spawnSparks(x, y, '#ffffff', 12, 'bubble');
    } else if (moveId === 'white_claw') {
      this._spawnSparks(x, y, '#e0f2fe', 14, 'bubble');
      this._spawnSparks(x, y, '#38bdf8', 10, 'dot');
    } else {
      this._spawnSparks(x, y, color, 18, 'dot');
    }
  }

  _spawnSparks(x, y, color, count, shape = 'dot') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 290;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (shape === 'bubble' || shape === 'heart' ? 110 : 60),
        size: shape === 'page' ? 9 : 4 + Math.random() * 5,
        color,
        shape,
        rot: Math.random() * Math.PI * 2,
        life: 0.42 + Math.random() * 0.38,
        maxLife: 0.8,
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
      life: 0.82,
      maxLife: 0.82,
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.shape === 'bubble' || p.shape === 'heart' ? -90 : 620) * dt;
      p.rot += dt * 5;
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
  // NETWORK SYNC
  // ==========================
  exportState() {
    const pick = (f) => ({
      hp: Math.round(f.hp * 10) / 10,
      stamina: Math.round(f.stamina),
      blocking: f.blocking,
      move: f.move ? { index: f.move.index, id: f.move.id, phase: f.move.phase, isCounter: f.move.isCounter } : null,
      stunTimer: f.stunTimer,
      blushTimer: f.blushTimer,
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
        this._emitBanner(`ROUND ${this.round}`, 'GET READY BUNNIES!');
        sound.playBell();
      } else if (this.phase === 'fighting') {
        this._emitBanner(null);
      } else if (this.phase === 'ko') {
        const redWon = this.blue.headPopped;
        this._emitBanner('KNOCKOUT!', redWon ? 'WIFEBUN TAKES THE ROUND!' : 'HUSBUN TAKES THE ROUND!');
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
    if (ev.kind === 'move_vfx') {
      sound.playMove(ev.moveId);
      this._spawnMoveVfx(ev.side, ev.moveId);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnSparks(ev.x, ev.y, '#ffd54f', 10);
      this._spawnCallout(ev.x, ev.y - 36, 'BLOCKED!', '#ffd54f', 0.85);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter);
      this.shake = ev.counter ? 15 : ev.heavy ? 10 : 6;
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 36, ev.word, ev.counter ? '#ffca28' : ev.color, ev.counter ? 1.15 : 0.96);
    } else if (ev.kind === 'ko') {
      sound.playHeadPop();
      this.shake = 22;
      this._spawnSparks(ev.x, ev.y, '#ffca28', 36);
      this._spawnSparks(ev.x, ev.y, ev.color, 24);
      this._spawnCallout(W * 0.5, H * 0.27, 'BUN POPPED!!', '#ffca28', 1.55);
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

  // ==========================
  // RENDERING
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();

    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawArenaBackdrop(ctx);
    this._drawRingBack(ctx);

    // Draw attacking bunny on top
    const redOnTop = Boolean(this.red.move && this.red.move.phase === 'active');
    if (redOnTop) {
      this._drawBunny(ctx, this.blue, W * 0.62, H * 0.68, -1);
      this._drawBunny(ctx, this.red, W * 0.38, H * 0.68, 1);
    } else {
      this._drawBunny(ctx, this.red, W * 0.38, H * 0.68, 1);
      this._drawBunny(ctx, this.blue, W * 0.62, H * 0.68, -1);
    }

    this._drawVfx(ctx);
    this._drawRingFront(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore();
  }

  _drawArenaBackdrop(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#140f24');
    bg.addColorStop(0.55, '#1e1b3a');
    bg.addColorStop(1, '#0b0c18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const sway = Math.sin(this.time * 0.8) * 35;
    this._drawSpotlight(ctx, W * 0.24, -20, W * 0.36 + sway, H * 0.72, 'rgba(255, 105, 180, 0.13)');
    this._drawSpotlight(ctx, W * 0.76, -20, W * 0.64 - sway, H * 0.72, 'rgba(56, 152, 255, 0.13)');
    this._drawSpotlight(ctx, W * 0.5, -30, W * 0.5, H * 0.78, 'rgba(255, 220, 140, 0.09)');
    ctx.restore();

    // Cute cheering bunny-ear crowd silhouettes
    ctx.fillStyle = 'rgba(10, 10, 24, 0.75)';
    for (let i = 0; i < 30; i++) {
      const cx = (i / 29) * W;
      const bob = Math.sin(this.time * 4 + i * 1.4) * 3;
      const cy = H * 0.45 + bob;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.ellipse(cx - 5, cy - 16, 4, 11, -0.15, 0, Math.PI * 2);
        ctx.ellipse(cx + 5, cy - 16, 4, 11, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillRect(0, H * 0.45, W, H * 0.2);
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
    ctx.fillStyle = '#d99800';
    ctx.beginPath();
    ctx.moveTo(76, H * 0.78);
    ctx.lineTo(W - 76, H * 0.78);
    ctx.lineTo(W - 44, H * 0.94);
    ctx.lineTo(44, H * 0.94);
    ctx.closePath();
    ctx.fill();

    const matGrad = ctx.createLinearGradient(0, H * 0.57, 0, H * 0.85);
    matGrad.addColorStop(0, '#fff5fa');
    matGrad.addColorStop(1, '#d6ddf2');
    ctx.fillStyle = matGrad;
    ctx.beginPath();
    ctx.moveTo(155, H * 0.58);
    ctx.lineTo(W - 155, H * 0.58);
    ctx.lineTo(W - 68, H * 0.83);
    ctx.lineTo(68, H * 0.83);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Center heart-ring emblem
    ctx.save();
    ctx.translate(W * 0.5, H * 0.70);
    ctx.scale(1, 0.36);
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 92, 168, 0.35)';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(36, 132, 255, 0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Toy sliding tracks
    ctx.fillStyle = 'rgba(15, 22, 42, 0.22)';
    ctx.beginPath();
    ctx.roundRect(W * 0.24, H * 0.70, W * 0.22, 16, 8);
    ctx.roundRect(W * 0.54, H * 0.70, W * 0.22, 16, 8);
    ctx.fill();

    this._drawCornerPost(ctx, 160, H * 0.58, '#ff5ca8', 0.82);
    this._drawCornerPost(ctx, W - 160, H * 0.58, '#2484ff', 0.82);

    const ropeColors = ['#ff5ca8', '#ffffff', '#2484ff'];
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
    this._drawCornerPost(ctx, 74, H * 0.83, '#ff5ca8', 1.05);
    this._drawCornerPost(ctx, W - 74, H * 0.83, '#2484ff', 1.05);

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
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - postW * 0.75, baseY - postH + 14 * scale, postW * 1.5, postH * 0.7, 6);
    ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(x, baseY - postH, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==========================
  // BROWN BUNNY CHARACTERS (WIFEBUN & HUSBUN)
  // ==========================
  _drawBunny(ctx, f, baseX, baseY, dir) {
    const isWifebun = f.side === 'red';

    // Distinct brown fur palettes!
    // Wifebun: warm caramel/milk-chocolate brown + creamy belly + cute pink accents
    // Husbun: deeper espresso/cocoa brown + warm tan belly + athletic navy/gold accents
    const furMain = isWifebun ? '#a87148' : '#6e4528';
    const furLight = isWifebun ? '#cc976e' : '#94623e';
    const furDark = isWifebun ? '#784a2a' : '#472a15';
    const bellyCol = isWifebun ? '#fae8d4' : '#e0c4a6';
    const accent = isWifebun ? '#ff69b4' : '#2484ff';
    const accentDark = isWifebun ? '#c2186a' : '#1249a3';

    const idleBob = f.headPopped ? 0 : Math.sin(this.time * 6.5 + (isWifebun ? 0 : 1.7)) * 4;
    const lungeX = f.lean * 32 * dir;

    ctx.save();
    ctx.translate(baseX + lungeX, baseY + f.jumpY);

    // Ground shadow (stays on ring mat)
    ctx.fillStyle = 'rgba(8, 12, 24, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 26 - f.jumpY, 64, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Counter-ready golden aura
    if (f.counterWindow > 0 && !f.headPopped) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 202, 40, 0.88)';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#ffca28';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, -86, 76, 118, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Cute fluffy cotton bunny tail on the back!
    ctx.fillStyle = isWifebun ? '#fff4eb' : '#ebd5be';
    ctx.beginPath();
    ctx.arc(-44 * dir, -34, isWifebun ? 16 : 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bunny legs & feet
    ctx.fillStyle = furDark;
    ctx.beginPath();
    ctx.roundRect(-32, -40, 22, 58, 10);
    ctx.roundRect(10, -40, 22, 58, 10);
    ctx.fill();

    // Cute bunny paws / sneakers
    ctx.fillStyle = furMain;
    ctx.beginPath();
    ctx.ellipse(-20 + 4 * dir, 18, 22, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(20 + 4 * dir, 18, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper body pivot (includes Height Mog vertical stretch + DJ Spin horizontal squash/flip!)
    ctx.save();
    ctx.translate(0, -24 + idleBob);
    ctx.rotate(f.lean * 0.16 * dir);

    if (f.spinAngle !== 0) {
      const spinScaleX = Math.cos(f.spinAngle);
      ctx.scale(Math.abs(spinScaleX) < 0.25 ? 0.25 : spinScaleX, 1);
    }

    // Back arm
    this._drawBunnyArm(ctx, f, dir, furMain, furDark, accent, accentDark, true);

    // Torso (Wifebun slightly petite/rounded; Husbun broader athletic V-torso + Height Mog stretch)
    const torsoW = isWifebun ? 82 : 96;
    const torsoH = (isWifebun ? 96 : 104) + f.stretchH;
    const torsoTop = -torsoH - 12;

    const torsoGrad = ctx.createLinearGradient(-torsoW / 2, torsoTop, torsoW / 2, 0);
    torsoGrad.addColorStop(0, furLight);
    torsoGrad.addColorStop(0.45, furMain);
    torsoGrad.addColorStop(1, furDark);

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : torsoGrad;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, torsoTop, torsoW, torsoH, isWifebun ? 32 : 22);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // Soft cream/tan bunny belly patch
    ctx.fillStyle = bellyCol;
    ctx.beginPath();
    ctx.ellipse(4 * dir, torsoTop + torsoH * 0.52, torsoW * 0.30, torsoH * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute boxing shorts / skirt trim
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2 + 2, -38, torsoW - 4, 28, 10);
    ctx.fill();
    // Gold/white waistband stripe
    ctx.fillStyle = isWifebun ? '#ffe3f1' : '#ffca28';
    ctx.fillRect(-torsoW / 2 + 4, -38, torsoW - 8, 7);

    // Spring Neck + Bunny Head!
    this._drawBunnyHeadAndSpring(ctx, f, dir, isWifebun, torsoTop, furMain, furLight, furDark, accent);

    // Front arm
    this._drawBunnyArm(ctx, f, dir, furMain, furDark, accent, accentDark, false);

    // Guard shield shimmer
    if (f.blocking) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.88)';
      ctx.fillStyle = 'rgba(255, 213, 79, 0.14)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(46 * dir, torsoTop + 26, 48, dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55, dir > 0 ? Math.PI * 0.45 : Math.PI * 1.45);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // upper body
    ctx.restore(); // root
  }

  _drawBunnyHeadAndSpring(ctx, f, dir, isWifebun, neckBaseY, furMain, furLight, furDark, accent) {
    const popOffset = f.headPopped ? f.headPopHeight : 0;
    const springLen = 14 + popOffset;

    // Classic Rock 'Em Sock 'Em zigzag coil spring (visible on wobble & KO!)
    if (f.headPopped || Math.abs(f.headWobble) > 0.12) {
      ctx.save();
      ctx.strokeStyle = '#dce4f5';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const coils = f.headPopped ? 9 : 4;
      ctx.moveTo(0, neckBaseY);
      for (let i = 1; i <= coils; i++) {
        const t = i / coils;
        const sx = (i % 2 === 0 ? -9 : 9) + f.headWobble * 12 * t;
        const sy = neckBaseY - springLen * t;
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(f.headWobble * 14, neckBaseY - springLen);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.headWobble * 14, neckBaseY - springLen - 26);
    const tilt = f.headPopped ? Math.sin(f.headSpin) * 0.55 : f.headWobble * 0.35;
    ctx.rotate(tilt);

    // === BUNNY EARS ===
    const earBob = Math.sin(this.time * 7 + (isWifebun ? 0 : 2)) * 0.06;
    if (isWifebun) {
      // Wifebun: long soft cute slightly-tilted bunny ears with pastel pink inner ears
      this._drawEar(ctx, -14 * dir, -28, -0.32 * dir + earBob, 14, 46, furMain, '#ffb6d9');
      this._drawEar(ctx, 10 * dir, -30, -0.10 * dir - earBob, 14, 48, furMain, '#ffb6d9');
    } else {
      // Husbun: tall athletic upright ears, front ear has a cool slight bend
      this._drawEar(ctx, -12 * dir, -30, -0.14 * dir + earBob, 13, 50, furMain, '#c99b84');
      this._drawEar(ctx, 12 * dir, -30, 0.12 * dir - earBob, 13, 46, furMain, '#c99b84');
    }

    // === BUNNY HEAD ===
    const headGrad = ctx.createRadialGradient(-8 * dir, -10, 6, 0, 0, 40);
    headGrad.addColorStop(0, furLight);
    headGrad.addColorStop(0.65, furMain);
    headGrad.addColorStop(1, furDark);

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, isWifebun ? 35 : 36, isWifebun ? 31 : 33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.stroke();

    // Cute fluffy cheek tufts
    ctx.fillStyle = furLight;
    ctx.beginPath();
    ctx.ellipse(-26 * dir, 8, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // === ACCESSORIES ===
    if (isWifebun) {
      // Cute pink bow on Wifebun's ear!
      ctx.save();
      ctx.translate(14 * dir, -34);
      ctx.fillStyle = '#ff4d9e';
      ctx.beginPath();
      ctx.ellipse(-9, 0, 10, 6, -0.3, 0, Math.PI * 2);
      ctx.ellipse(9, 0, 10, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffc2e2';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // DJ Headphones appear during DJ Spin!
      if (f.move && f.move.id === 'dj_spin') {
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -4, 38, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(-41, -12, 10, 22, 5);
        ctx.roundRect(31, -12, 10, 22, 5);
        ctx.fill();
      }
    } else {
      // Cool athletic navy & gold headband on Husbun!
      ctx.fillStyle = '#1e5fd9';
      ctx.beginPath();
      ctx.roundRect(-34, -22, 68, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#ffca28';
      ctx.fillRect(-33, -18, 66, 3);
      // Little headband tails fluttering behind
      ctx.strokeStyle = '#1e5fd9';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-32 * dir, -17);
      ctx.lineTo(-46 * dir, -10 + Math.sin(this.time * 9) * 3);
      ctx.stroke();
    }

    // === FACE (Facing opponent) ===
    const faceX = 12 * dir;

    // Cute muzzle / snout
    ctx.fillStyle = isWifebun ? '#fcead7' : '#e6ccb0';
    ctx.beginPath();
    ctx.ellipse(faceX + 4 * dir, 10, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pink bunny nose
    ctx.fillStyle = isWifebun ? '#ff7eb6' : '#3d2214';
    ctx.beginPath();
    ctx.ellipse(faceX + 8 * dir, 6, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (cute 'w' bunny smile, or open O when burping / stunned!)
    ctx.strokeStyle = '#3a1f10';
    ctx.lineWidth = 2.2;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#5c2614';
      ctx.beginPath();
      ctx.arc(faceX + 8 * dir, 14, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.headPopped) {
      ctx.beginPath();
      ctx.arc(faceX + 6 * dir, 15, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(faceX + 4 * dir, 12, 4, 0, Math.PI);
      ctx.arc(faceX + 11 * dir, 12, 4, 0, Math.PI);
      ctx.stroke();
    }

    // Rosy cheeks (always cute on Wifebun; extra bright when Forehead Kissed!)
    if (isWifebun || f.blushTimer > 0) {
      ctx.fillStyle = f.blushTimer > 0 ? 'rgba(255, 64, 129, 0.72)' : 'rgba(255, 118, 178, 0.48)';
      ctx.beginPath();
      ctx.ellipse(faceX - 8 * dir, 9, 8, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(faceX + 18 * dir, 9, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes!
    if (f.headPopped) {
      // Dizzy X eyes
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 3;
      [-4, 11].forEach((ox) => {
        const ex = faceX + ox * dir;
        ctx.beginPath();
        ctx.moveTo(ex - 4, -8);
        ctx.lineTo(ex + 4, 0);
        ctx.moveTo(ex + 4, -8);
        ctx.lineTo(ex - 4, 0);
        ctx.stroke();
      });
    } else {
      const eyePositions = [faceX - 4 * dir, faceX + 11 * dir];
      eyePositions.forEach((ex, idx) => {
        const ey = -4;
        const r = isWifebun ? (idx === 0 ? 6 : 5.2) : (idx === 0 ? 5.2 : 4.6);
        ctx.fillStyle = '#1a110d';
        ctx.beginPath();
        ctx.arc(ex, ey, r, 0, Math.PI * 2);
        ctx.fill();

        // Sparkle highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 1.5 * dir, ey - 2, isWifebun ? 2.4 : 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (isWifebun) {
          // Cute feminine eyelashes!
          ctx.strokeStyle = '#1a110d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex - 4 * dir, ey - 4);
          ctx.lineTo(ex - 8 * dir, ey - 7);
          ctx.moveTo(ex - 1 * dir, ey - 6);
          ctx.lineTo(ex - 4 * dir, ey - 10);
          ctx.stroke();
        } else {
          // Confident masculine eyebrows!
          ctx.strokeStyle = '#2e190c';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(ex - 5, ey - 8);
          ctx.lineTo(ex + 5, ey - 6);
          ctx.stroke();
        }
      });
    }

    ctx.restore();
  }

  _drawEar(ctx, x, y, angle, rx, ry, outerCol, innerCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = outerCol;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.55, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.stroke();

    ctx.fillStyle = innerCol;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.52, rx * 0.52, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawBunnyArm(ctx, f, dir, furMain, furDark, accent, accentDark, isBack) {
    const shoulderX = (isBack ? 24 : -18) * dir;
    const shoulderY = -92 - f.stretchH * 0.75;

    let reach = 42;
    let liftY = isBack ? -8 : 6;
    let gloveScale = 1;

    if (f.blocking) {
      reach = 50;
      liftY = -28 + (isBack ? -6 : 6);
    } else if (f.move) {
      if (f.move.phase === 'windup') {
        reach = 16;
        liftY = 14;
      } else if (f.move.phase === 'active') {
        reach = isBack ? 124 : 138;
        liftY = f.move.id === 'height_mog' ? 28 : f.move.id === 'forehead_kiss' ? -18 : -6;
        gloveScale = f.move.isCounter ? 1.32 : 1.18;
      } else {
        reach = 74;
        liftY = 0;
      }
    } else {
      reach = 44 + Math.sin(this.time * 7 + (isBack ? 2 : 0)) * 5;
      liftY = (isBack ? -10 : 4) + Math.cos(this.time * 7) * 4;
    }

    const gloveX = shoulderX + reach * dir;
    const gloveY = shoulderY + liftY;

    ctx.save();
    ctx.strokeStyle = isBack ? furDark : furMain;
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gloveX, gloveY);
    ctx.stroke();

    ctx.translate(gloveX, gloveY);
    ctx.scale(gloveScale, gloveScale);

    // Boxing Glove
    ctx.fillStyle = isBack ? accentDark : accent;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath();
    ctx.ellipse(-6 * dir, -7, 7, 4.5, -0.4 * dir, 0, Math.PI * 2);
    ctx.fill();

    // Wrist cuff
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-20 * dir - (dir > 0 ? 6 : 0), -10, 9, 20, 4);
    ctx.fill();

    ctx.restore();
  }

  // ==========================
  // UNIQUE VISUAL ANIMATIONS FOR ALL 8 MOVES!
  // ==========================
  _drawVfx(ctx) {
    for (const v of this.vfx) {
      const p = Math.min(1, v.t / v.duration);
      const x = v.startX + (v.targetX - v.startX) * p;
      const y = H * 0.45;

      ctx.save();

      switch (v.moveId) {
        case 'pear_bounce': {
          // Bouncing juicy green-gold pear!
          const bounceY = y - Math.abs(Math.sin(p * Math.PI * 2.5)) * 95;
          ctx.translate(x, bounceY);
          ctx.rotate(p * Math.PI * 3 * v.dir);
          // Pear body
          ctx.fillStyle = '#bef264';
          ctx.strokeStyle = '#4d7c0f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 10, 20, 0, Math.PI * 2);
          ctx.arc(0, -10, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Stem & leaf
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.lineTo(3, -32);
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(10, -26, 8, 4, -0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'dj_spin': {
          // Spinning vinyl turntable + neon soundwave ring!
          const cx = v.startX + 45 * v.dir;
          const cy = H * 0.56;
          ctx.translate(cx, cy);
          // Expanding neon ring
          ctx.strokeStyle = `rgba(255, 105, 180, ${1 - p})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, 30 + p * 140, 0, Math.PI * 2);
          ctx.stroke();
          // Vinyl disc
          ctx.rotate(p * Math.PI * 6);
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.arc(0, 0, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ff69b4';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'mango_seed': {
          // Giant golden mango seed rocket with juicy streak!
          ctx.translate(x, y - 16);
          ctx.strokeStyle = 'rgba(255, 183, 3, 0.7)';
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-55 * v.dir, 0);
          ctx.lineTo(0, 0);
          ctx.stroke();

          ctx.rotate(p * 10 * v.dir);
          ctx.fillStyle = '#ffd166';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Fibrous mango seed lines
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-18, -4);
          ctx.lineTo(18, -4);
          ctx.moveTo(-14, 4);
          ctx.lineTo(14, 4);
          ctx.stroke();
          break;
        }

        case 'coke_burp': {
          // Red soda can + massive expanding fizzy cola bubble wave!
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.roundRect(v.startX + 18 * v.dir - 10, H * 0.44, 20, 32, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(v.startX + 18 * v.dir - 10, H * 0.44 + 12, 20, 6);

          // Fizzy shockwave arcs
          for (let i = 0; i < 3; i++) {
            const waveX = v.startX + (35 + p * 195 + i * 26) * v.dir;
            ctx.strokeStyle = i % 2 === 0 ? `rgba(124, 63, 29, ${1 - p})` : `rgba(255, 255, 255, ${1 - p})`;
            ctx.lineWidth = 8 - i * 2;
            ctx.beginPath();
            ctx.arc(waveX, H * 0.40, 26 + p * 44, -0.8, 0.8);
            ctx.stroke();
          }
          break;
        }

        case 'white_claw': {
          // Sleek White Claw can + 3 icy-cyan claw slashes!
          const canX = v.startX + 24 * v.dir;
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(canX - 9, H * 0.42, 18, 36, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(canX - 8, H * 0.42 + 12, 16, 10);

          // Frosty triple claw slash on target!
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - p * 0.85})`;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          [-18, 0, 18].forEach((off) => {
            ctx.beginPath();
            ctx.moveTo(v.targetX - 35 * v.dir, H * 0.34 + off);
            ctx.lineTo(v.targetX + 35 * v.dir, H * 0.48 + off);
            ctx.stroke();
          });
          break;
        }

        case 'height_mog': {
          // Glowing yellow vertical ruler (6'5") next to Husbun!
          const rx = v.startX + 62;
          const ry = H * 0.68;
          const rh = 240 * Math.min(1, p * 2.2);
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#854d0e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(rx, ry - rh, 26, rh, 4);
          ctx.fill();
          ctx.stroke();
          // Tick marks
          ctx.strokeStyle = '#422006';
          ctx.lineWidth = 2;
          for (let ty = 14; ty < rh - 10; ty += 16) {
            ctx.beginPath();
            ctx.moveTo(rx, ry - ty);
            ctx.lineTo(rx + (ty % 32 === 0 ? 14 : 8), ry - ty);
            ctx.stroke();
          }
          ctx.font = `700 26px 'Bangers', Impact, sans-serif`;
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#0b0e18';
          ctx.lineWidth = 5;
          ctx.strokeText(`6'5"`, rx - 4, ry - rh - 10);
          ctx.fillText(`6'5"`, rx - 4, ry - rh - 10);
          break;
        }

        case 'forehead_kiss': {
          // Big glowing pink heart & kiss mark landing right on Wifebun's forehead!
          const kx = v.startX + (v.targetX - v.startX) * Math.min(1, p * 1.4);
          const ky = H * 0.34 - Math.sin(p * Math.PI) * 26;
          const sc = 0.7 + Math.sin(p * Math.PI) * 0.8;
          ctx.translate(kx, ky);
          ctx.scale(sc, sc);
          this._drawHeart(ctx, 0, 0, 26, '#ff4d9e');
          ctx.font = `28px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('💋', 0, 10);
          break;
        }

        case 'eyp_report': {
          // Giant official EYP REPORT audit binder slamming down!
          const bx = v.targetX;
          const by = H * 0.24 + p * 95;
          ctx.translate(bx, by);
          ctx.rotate((-0.4 + p * 0.5) * v.dir);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(-42, -52, 84, 104, 6);
          ctx.fill();
          ctx.stroke();
          // Header stripe
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(-40, -50, 80, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 13px 'Chakra Petch', sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('EYP REPORT', 0, -35);
          // Mini bar chart
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(-26, 6, 12, 26);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-8, -8, 12, 40);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(10, 14, 12, 18);
          break;
        }
      }

      ctx.restore();
    }
  }

  _drawHeart(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.6, -size, 0, -size * 0.35);
    ctx.bezierCurveTo(size * 0.6, -size, size, -size * 0.3, 0, size * 0.35);
    ctx.fill();
    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      if (p.shape === 'heart') {
        this._drawHeart(ctx, 0, 0, p.size * 1.6, p.color);
      } else if (p.shape === 'note') {
        ctx.fillStyle = p.color;
        ctx.font = `700 ${Math.round(p.size * 2.6)}px sans-serif`;
        ctx.fillText('♫', 0, 0);
      } else if (p.shape === 'page') {
        ctx.rotate(p.rot);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
        ctx.strokeRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
      } else if (p.shape === 'bubble') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawCallouts(ctx) {
    for (const c of this.callouts) {
      const alpha = Math.min(1, (c.life / c.maxLife) * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.font = `700 ${Math.round(40 * c.scale)}px 'Bangers', Impact, sans-serif`;
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
