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
      active: 0.26,
      recover: 0.14,
      extraStun: 0,
      callout: 'PEAR BOUNCE!',
      color: '#bef264',
      heavy: false,
    },
    {
      id: 'dj_spin',
      label: 'DJ SPIN',
      emoji: '🎧',
      damage: 12,
      stamina: 18,
      windup: 0.09,
      active: 0.32,
      recover: 0.16,
      extraStun: 0.08,
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
      active: 0.28,
      recover: 0.20,
      extraStun: 0.12,
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
      windup: 0.13,
      active: 0.34,
      recover: 0.18,
      extraStun: 0.26,
      callout: 'COKE BURP!!',
      color: '#ff6b6b',
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
      active: 0.26,
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
      windup: 0.12,
      active: 0.30,
      recover: 0.18,
      extraStun: 0.12,
      callout: 'HEIGHT MOGGED!',
      color: '#ffd479',
      heavy: true,
    },
    {
      id: 'forehead_kiss',
      label: 'FOREHEAD KISS',
      emoji: '💋',
      damage: 12,
      stamina: 17,
      windup: 0.10,
      active: 0.30,
      recover: 0.16,
      extraStun: 0.22,
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
      active: 0.30,
      recover: 0.20,
      extraStun: 0.14,
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
    move: null,
    dodgeTimer: 0,
    dodgeCooldown: 0,
    dodgeOffset: 0,
    stunTimer: 0,
    blushTimer: 0,
    heartEyesTimer: 0,
    hitFlash: 0,
    counterWindow: 0,
    lean: 0,
    jumpY: 0,
    flipAngle: 0,
    stretchH: 0,
    squashX: 1,
    squashY: 1,
    spinAngle: 0,
    headWobble: 0,
    headWobbleVel: 0,
    headPopped: false,
    headPopHeight: 0,
    headPopVel: 0,
    headSpin: 0,
    roundsWon: 0,
    comboCount: 0,
    comboTimer: 0,
    victoryKissTimer: 0,
  };
}

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.mode = 'cpu';
    this.humanSide = 'red';
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
    this.camZoom = 1;
    this.dramaticDim = 0;

    this.particles = [];
    this.callouts = [];
    this.vfx = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.petals = this._initPetals();

    this.cpuDecisionTimer = 0.5;
    this.cpuBlockTimer = 0;
    this._lastHudSync = 0;
  }

  _initPetals() {
    const list = [];
    for (let i = 0; i < 24; i++) {
      list.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: -12 - Math.random() * 18,
        vy: 14 + Math.random() * 20,
        size: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2.5,
        isHeart: i % 4 === 0,
        color: i % 3 === 0 ? '#ffd479' : i % 2 === 0 ? '#ff8ec7' : '#ffb6d9',
      });
    }
    return list;
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
    this.shockwaves = [];
    this.afterimages = [];

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
    this.camZoom = 1;
    this.dramaticDim = 0;
    this.vfx = [];
    this.shockwaves = [];
    this.afterimages = [];

    this._emitBanner(`ROUND ${this.round}`, '💕 GET READY BUNNIES! 💕');
    sound.playBell();
    this._notifyHud(true);
  }

  _resetFighterForRound(f) {
    f.hp = MAX_HP;
    f.stamina = MAX_STAMINA;
    f.blocking = false;
    f.move = null;
    f.dodgeTimer = 0;
    f.dodgeCooldown = 0;
    f.dodgeOffset = 0;
    f.stunTimer = 0;
    f.blushTimer = 0;
    f.heartEyesTimer = 0;
    f.hitFlash = 0;
    f.counterWindow = 0;
    f.lean = 0;
    f.jumpY = 0;
    f.flipAngle = 0;
    f.stretchH = 0;
    f.squashX = 1;
    f.squashY = 1;
    f.spinAngle = 0;
    f.headWobble = 0;
    f.headWobbleVel = 0;
    f.headPopped = false;
    f.headPopHeight = 0;
    f.headPopVel = 0;
    f.headSpin = 0;
    f.comboCount = 0;
    f.comboTimer = 0;
    f.victoryKissTimer = 0;
  }

  // Trigger one of the character's 4 unique moves (0..3)
  triggerMove(side, moveIndex) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped || f.stunTimer > 0 || f.move || f.blocking || f.dodgeTimer > 0) return false;

    const def = FIGHTER_MOVES[side]?.[moveIndex];
    if (!def) return false;

    if (f.stamina < def.stamina * 0.55) return false;
    f.stamina = Math.max(0, f.stamina - def.stamina);

    const isCounter = f.counterWindow > 0;
    f.counterWindow = 0;

    // Crouch anticipation squash!
    f.squashX = 1.18;
    f.squashY = 0.84;
    if (def.id === 'forehead_kiss') f.heartEyesTimer = 0.9;
    if (def.id === 'height_mog') this.dramaticDim = 0.45;

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

  // Fighting-game Dodge / Back-hop with invulnerability frames & afterimages!
  triggerDodge(side) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped || f.stunTimer > 0 || f.dodgeTimer > 0 || f.dodgeCooldown > 0) return false;
    if (f.stamina < 12) return false;

    f.stamina = Math.max(0, f.stamina - 14);
    f.blocking = false;
    f.move = null; // Dodge can cancel recovery/idle smoothly!
    f.dodgeTimer = 0.30;
    f.dodgeCooldown = 0.42;
    f.squashX = 0.84;
    f.squashY = 1.18;

    sound.playDodge();
    this._spawnDodgeAfterimage(side);
    this._emitNetEvent('dodge', { side });
    return true;
  }

  setBlock(side, active) {
    const f = side === 'red' ? this.red : this.blue;
    if (f.headPopped || f.dodgeTimer > 0) {
      f.blocking = false;
      return;
    }
    if (active && f.move) return;
    f.blocking = Boolean(active);
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    this._updatePetals(clampedDt);
    this._updateParticles(clampedDt);
    this._updateCallouts(clampedDt);
    this._updateVfx(clampedDt);
    this._updateShockwaves(clampedDt);
    this._updateAfterimages(clampedDt);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - clampedDt * 40);
    if (this.dramaticDim > 0) this.dramaticDim = Math.max(0, this.dramaticDim - clampedDt * 1.4);
    this.camZoom += (1 - this.camZoom) * Math.min(1, clampedDt * 9);

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
        this._emitBanner('FIGHT! ♥', 'BEATDOWN SESH!');
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
    } else if (this.phase === 'ko' || this.phase === 'match_over') {
      this._updateHeadPhysics(this.red, clampedDt);
      this._updateHeadPhysics(this.blue, clampedDt);
      this._updateBodyPose(this.red, clampedDt);
      this._updateBodyPose(this.blue, clampedDt);
      this._updateVictoryDance(clampedDt);

      if (this.phase === 'ko') {
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
      }
    }

    this._notifyHud(false);
  }

  _updateVictoryDance(dt) {
    // Winning bunny blows cute floating hearts!
    const winner = this.red.headPopped ? this.blue : this.blue.headPopped ? this.red : null;
    if (!winner) return;
    winner.heartEyesTimer = 0.5;
    winner.victoryKissTimer -= dt;
    if (winner.victoryKissTimer <= 0) {
      winner.victoryKissTimer = 0.28;
      const wx = winner.side === 'red' ? W * 0.38 : W * 0.62;
      this._spawnSparks(wx, H * 0.36, '#ff69b4', 3, 'heart');
    }
  }

  _updateFighter(f, opp, dt) {
    const regenRate = f.blocking ? 10 : 30;
    f.stamina = Math.min(MAX_STAMINA, f.stamina + regenRate * dt);

    if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
    if (f.blushTimer > 0) f.blushTimer = Math.max(0, f.blushTimer - dt);
    if (f.heartEyesTimer > 0) f.heartEyesTimer = Math.max(0, f.heartEyesTimer - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.counterWindow > 0) f.counterWindow = Math.max(0, f.counterWindow - dt);
    if (f.dodgeCooldown > 0) f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
    if (f.comboTimer > 0) {
      f.comboTimer = Math.max(0, f.comboTimer - dt);
      if (f.comboTimer <= 0) f.comboCount = 0;
    }

    if (f.dodgeTimer > 0) {
      f.dodgeTimer = Math.max(0, f.dodgeTimer - dt);
      if (Math.random() < dt * 28) {
        this._spawnDodgeAfterimage(f.side);
      }
    }

    if (f.move) {
      f.move.timer -= dt;
      if (f.move.phase === 'windup' && f.move.timer <= 0) {
        f.move.phase = 'active';
        f.move.timer = f.move.activeDur;
        f.lean = f.move.id === 'forehead_kiss' ? 1.25 : f.move.id === 'coke_burp' ? 0.55 : 0.85;
        f.squashX = 0.88;
        f.squashY = 1.15;
      }

      if (f.move.phase === 'active' && !f.move.hitDone && f.move.timer <= f.move.activeDur * 0.62) {
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
    f.squashX += (1 - f.squashX) * Math.min(1, dt * 14);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 14);

    // Dodge back-step arc
    const targetDodge = f.dodgeTimer > 0 ? -74 : 0;
    f.dodgeOffset += (targetDodge - f.dodgeOffset) * Math.min(1, dt * 18);

    // Jump arc (Pear Bounce high flip, Dodge hop, or Victory bounce!)
    let targetJump = 0;
    if (f.move && f.move.id === 'pear_bounce' && f.move.phase === 'active') {
      targetJump = -72;
      f.flipAngle += dt * 18 * (f.side === 'red' ? 1 : -1);
    } else if (f.dodgeTimer > 0) {
      targetJump = -26;
      f.flipAngle = 0;
    } else if ((this.phase === 'ko' || this.phase === 'match_over') && !f.headPopped) {
      targetJump = -Math.abs(Math.sin(this.time * 8)) * 28;
      f.flipAngle = 0;
    } else {
      f.flipAngle += (0 - f.flipAngle) * Math.min(1, dt * 14);
    }
    f.jumpY += (targetJump - f.jumpY) * Math.min(1, dt * 16);

    // Height Mog dramatic towering stretch
    const targetStretch = f.move && f.move.id === 'height_mog' && f.move.phase !== 'recover' ? 84 : 0;
    f.stretchH += (targetStretch - f.stretchH) * Math.min(1, dt * 14);

    // DJ Spin rapid hurricane twirl
    if (f.move && f.move.id === 'dj_spin' && f.move.phase === 'active') {
      f.spinAngle += dt * 28;
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
      const targetH = 132;
      const popAccel = (targetH - f.headPopHeight) * 140 - f.headPopVel * 7;
      f.headPopVel += popAccel * dt;
      f.headPopHeight += f.headPopVel * dt;
      f.headSpin += dt * 4.8;
    }
  }

  _resolveHit(attacker, defender, move) {
    const impactX = defender.side === 'blue' ? W * 0.58 : W * 0.42;
    const impactY = H * 0.42;

    // 1. Check PERFECT DODGE!
    if (defender.dodgeTimer > 0) {
      defender.stamina = Math.min(MAX_STAMINA, defender.stamina + 26);
      defender.counterWindow = 1.05;
      defender.heartEyesTimer = 0.85;
      attacker.comboCount = 0;

      sound.playPerfectDodge();
      this.hitStop = 0.065;
      this.camZoom = 1.05;
      this._spawnShockwave(impactX, impactY, '#c084fc', 110);
      this._spawnSparks(impactX, impactY, '#e9d5ff', 14, 'heart');
      this._spawnCallout(impactX, impactY - 42, 'PERFECT DODGE! ♥', '#e9d5ff', 1.05);
      this._emitNetEvent('perfect_dodge', { x: impactX, y: impactY });
      return;
    }

    // 2. Check GUARD / BLOCK!
    if (defender.blocking && defender.stamina >= 6) {
      defender.stamina = Math.max(0, defender.stamina - 10);
      defender.hp = Math.max(1, defender.hp - move.damage * 0.14);
      defender.lean = -0.35;
      defender.counterWindow = 0.78;
      attacker.comboCount = 0;

      sound.playBlock();
      this._spawnShockwave(impactX, impactY, '#ffd479', 72);
      this._spawnSparks(impactX, impactY, '#ffd479', 10, 'dot');
      this._spawnCallout(impactX, impactY - 36, 'BLOCKED!', '#ffd479', 0.88);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: impactX, y: impactY });
      return;
    }

    // 3. CLEAN HIT!
    attacker.comboCount += 1;
    attacker.comboTimer = 2.1;
    const comboBonus = attacker.comboCount >= 3 ? 1.15 : 1;

    defender.hp = Math.max(0, defender.hp - move.damage * comboBonus);
    defender.hitFlash = 0.18;
    defender.stunTimer = (move.isCounter ? 0.30 : 0.15) + (move.extraStun || 0);
    defender.squashX = 0.82;
    defender.squashY = 1.16;
    if (move.id === 'forehead_kiss') {
      defender.blushTimer = 1.8;
      defender.heartEyesTimer = 1.2;
    }
    defender.lean = -0.96;
    defender.headWobbleVel = (defender.side === 'blue' ? 1 : -1) * (move.isCounter ? 20 : 13);
    defender.move = null;

    if (defender.hp <= 0) {
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnShockwave(impactX, impactY, '#ffd479', 180);
      this._spawnShockwave(impactX, impactY, move.color, 130);
      this._spawnSparks(impactX, impactY, '#ffd479', 26, 'heart');
      this._spawnSparks(impactX, impactY, move.color, 26, 'dot');
      this._spawnCallout(W * 0.5, H * 0.25, 'BUN POPPED!! 💕', '#ffd479', 1.55);
      this._emitNetEvent('ko', { x: impactX, y: impactY, color: move.color });
    } else {
      sound.playHit(move.heavy || move.isCounter);
      this.hitStop = move.isCounter ? 0.085 : move.heavy ? 0.052 : 0.036;
      this.shake = move.isCounter ? 16 : move.heavy ? 11 : 6;
      this.camZoom = move.isCounter || move.heavy ? 1.07 : 1.03;

      this._spawnShockwave(impactX, impactY, move.isCounter ? '#ffd479' : move.color, move.heavy ? 120 : 84);
      this._spawnMoveHitParticles(impactX, impactY, move.id, move.color);

      const label = move.isCounter ? `COUNTER ${move.callout}` : move.callout;
      this._spawnCallout(impactX, impactY - 38, label, move.isCounter ? '#ffd479' : move.color, move.isCounter ? 1.15 : 0.98);
      if (attacker.comboCount >= 2) {
        this._spawnCallout(impactX, impactY - 82, `${attacker.comboCount} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.82);
      }

      this._emitNetEvent('hit', {
        x: impactX,
        y: impactY,
        moveId: move.id,
        color: move.color,
        word: label,
        heavy: move.heavy,
        counter: move.isCounter,
        combo: attacker.comboCount,
      });
    }
  }

  _triggerRoundEnd(winnerSide, loser, byTimeout) {
    const winner = winnerSide === 'red' ? this.red : this.blue;
    winner.roundsWon += 1;
    winner.heartEyesTimer = 2.6;
    loser.blocking = false;
    loser.move = null;
    loser.headPopped = true;
    loser.headPopVel = 540;
    loser.headWobbleVel = (loser.side === 'blue' ? 1 : -1) * 24;

    this.phase = 'ko';
    this.phaseTimer = 2.7;
    this.hitStop = byTimeout ? 0.05 : 0.20;
    this.shake = 22;
    this.camZoom = 1.10;

    sound.playHeadPop();
    const bannerMain = byTimeout ? 'TIME UP!' : 'KNOCKOUT! 💕';
    const bannerSub = winnerSide === 'red' ? 'WIFEBUN WINS THE ROUND!' : 'HUSBUN WINS THE ROUND!';
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
      easy:   { reaction: 0.62, defenseChance: 0.22, dodgeRatio: 0.35, aggro: 0.48 },
      medium: { reaction: 0.38, defenseChance: 0.46, dodgeRatio: 0.45, aggro: 0.68 },
      hard:   { reaction: 0.22, defenseChance: 0.72, dodgeRatio: 0.55, aggro: 0.85 },
    }[this.cpuDifficulty] || { reaction: 0.38, defenseChance: 0.46, dodgeRatio: 0.45, aggro: 0.68 };

    if (player.move && player.move.phase === 'windup' && !cpu.move && cpu.stunTimer <= 0 && cpu.dodgeTimer <= 0) {
      if (Math.random() < cfg.defenseChance * dt * 16) {
        if (Math.random() < cfg.dodgeRatio && cpu.dodgeCooldown <= 0) {
          this.triggerDodge(cpuSide);
        } else {
          this.cpuBlockTimer = 0.28 + Math.random() * 0.22;
          cpu.blocking = true;
        }
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
        this.triggerMove(cpuSide, Math.floor(Math.random() * 4));
      } else if (roll < cfg.aggro + 0.16) {
        this.cpuBlockTimer = 0.3 + Math.random() * 0.25;
        cpu.blocking = true;
      }
    }
  }

  // ==========================
  // VFX, SHOCKWAVES, AFTERIMAGES, PETALS
  // ==========================
  _spawnMoveVfx(side, moveId) {
    const dir = side === 'red' ? 1 : -1;
    const startX = side === 'red' ? W * 0.40 : W * 0.60;
    const targetX = side === 'red' ? W * 0.60 : W * 0.40;
    this.vfx.push({ side, dir, moveId, startX, targetX, t: 0, duration: 0.54 });
  }

  _spawnShockwave(x, y, color, maxRadius) {
    this.shockwaves.push({ x, y, color, radius: 14, maxRadius, life: 0.28, maxLife: 0.28 });
  }

  _spawnDodgeAfterimage(side) {
    const f = side === 'red' ? this.red : this.blue;
    const dir = side === 'red' ? 1 : -1;
    const baseX = (side === 'red' ? W * 0.38 : W * 0.62) + (f.lean * 32 + f.dodgeOffset) * dir;
    const baseY = H * 0.68 + f.jumpY;
    this.afterimages.push({
      x: baseX,
      y: baseY,
      color: side === 'red' ? 'rgba(255, 119, 186, 0.45)' : 'rgba(192, 132, 252, 0.45)',
      life: 0.24,
      maxLife: 0.24,
    });
  }

  _updatePetals(dt) {
    for (const p of this.petals) {
      p.x += (p.vx + Math.sin(this.time * 1.4 + p.rot) * 14) * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
      if (p.y > H + 20) { p.y = -18; p.x = Math.random() * W; }
      if (p.x < -20) { p.x = W + 18; }
    }
  }

  _updateVfx(dt) {
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      this.vfx[i].t += dt;
      if (this.vfx[i].t >= this.vfx[i].duration) this.vfx.splice(i, 1);
    }
  }

  _updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const p = 1 - Math.max(0, s.life / s.maxLife);
      s.radius = 14 + (s.maxRadius - 14) * p;
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }
  }

  _updateAfterimages(dt) {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
  }

  _spawnMoveHitParticles(x, y, moveId, color) {
    if (moveId === 'forehead_kiss') {
      this._spawnSparks(x, y - 20, '#ff69b4', 18, 'heart');
      this._spawnSparks(x, y - 10, '#ffd479', 10, 'heart');
    } else if (moveId === 'dj_spin') {
      this._spawnSparks(x, y, '#ff69b4', 8, 'note');
      this._spawnSparks(x, y, '#38bdf8', 8, 'note');
      this._spawnSparks(x, y, '#ffd479', 6, 'heart');
    } else if (moveId === 'eyp_report') {
      this._spawnSparks(x, y, '#ffffff', 14, 'page');
      this._spawnSparks(x, y, '#3b82f6', 10, 'dot');
    } else if (moveId === 'coke_burp') {
      this._spawnSparks(x, y, '#8b4513', 12, 'bubble');
      this._spawnSparks(x, y, '#ffffff', 14, 'bubble');
    } else if (moveId === 'white_claw') {
      this._spawnSparks(x, y, '#e0f2fe', 14, 'bubble');
      this._spawnSparks(x, y, '#38bdf8', 12, 'dot');
    } else {
      this._spawnSparks(x, y, color, 18, 'dot');
      this._spawnSparks(x, y, '#ffd479', 6, 'heart');
    }
  }

  _spawnSparks(x, y, color, count, shape = 'dot') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 300;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (shape === 'bubble' || shape === 'heart' ? 120 : 60),
        size: shape === 'page' ? 9 : 4 + Math.random() * 5,
        color,
        shape,
        rot: Math.random() * Math.PI * 2,
        life: 0.45 + Math.random() * 0.40,
        maxLife: 0.85,
      });
    }
  }

  _spawnCallout(x, y, text, color, scale = 1) {
    this.callouts.push({ x, y, text, color, scale, life: 0.85, maxLife: 0.85 });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.shape === 'bubble' || p.shape === 'heart' ? -95 : 620) * dt;
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
      dodgeTimer: f.dodgeTimer,
      move: f.move ? { index: f.move.index, id: f.move.id, phase: f.move.phase, isCounter: f.move.isCounter } : null,
      stunTimer: f.stunTimer,
      blushTimer: f.blushTimer,
      heartEyesTimer: f.heartEyesTimer,
      hitFlash: f.hitFlash,
      counterWindow: f.counterWindow,
      lean: f.lean,
      headPopped: f.headPopped,
      roundsWon: f.roundsWon,
      comboCount: f.comboCount,
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
        target.headPopVel = 540;
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
        this._emitBanner(`ROUND ${this.round}`, '💕 GET READY BUNNIES! 💕');
        sound.playBell();
      } else if (this.phase === 'fighting') {
        this._emitBanner(null);
      } else if (this.phase === 'ko') {
        const redWon = this.blue.headPopped;
        this._emitBanner('KNOCKOUT! 💕', redWon ? 'WIFEBUN WINS THE ROUND!' : 'HUSBUN WINS THE ROUND!');
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
      if (ev.moveId === 'height_mog') this.dramaticDim = 0.45;
    } else if (ev.kind === 'dodge') {
      sound.playDodge();
      this._spawnDodgeAfterimage(ev.side);
    } else if (ev.kind === 'perfect_dodge') {
      sound.playPerfectDodge();
      this.camZoom = 1.05;
      this._spawnShockwave(ev.x, ev.y, '#c084fc', 110);
      this._spawnSparks(ev.x, ev.y, '#e9d5ff', 14, 'heart');
      this._spawnCallout(ev.x, ev.y - 42, 'PERFECT DODGE! ♥', '#e9d5ff', 1.05);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 72);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 10, 'dot');
      this._spawnCallout(ev.x, ev.y - 36, 'BLOCKED!', '#ffd479', 0.88);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter);
      this.shake = ev.counter ? 16 : ev.heavy ? 11 : 6;
      this.camZoom = ev.counter || ev.heavy ? 1.07 : 1.03;
      this._spawnShockwave(ev.x, ev.y, ev.counter ? '#ffd479' : ev.color, ev.heavy ? 120 : 84);
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 38, ev.word, ev.counter ? '#ffd479' : ev.color, ev.counter ? 1.15 : 0.98);
      if (ev.combo >= 2) {
        this._spawnCallout(ev.x, ev.y - 82, `${ev.combo} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.82);
      }
    } else if (ev.kind === 'ko') {
      sound.playHeadPop();
      this.shake = 22;
      this.camZoom = 1.10;
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 180);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 26, 'heart');
      this._spawnSparks(ev.x, ev.y, ev.color, 24, 'dot');
      this._spawnCallout(W * 0.5, H * 0.25, 'BUN POPPED!! 💕', '#ffd479', 1.55);
    }
  }

  _emitNetEvent(kind, payload) {
    if (this.callbacks.onNetEvent) this.callbacks.onNetEvent({ kind, ...payload });
  }

  _emitBanner(main, sub = '') {
    if (this.callbacks.onBanner) this.callbacks.onBanner(main, sub);
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

    // Dynamic fighting-game camera zoom + shake
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-W / 2, -H / 2);

    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawArenaBackdrop(ctx);
    this._drawRingBack(ctx);

    // Dramatic dim during Height Mog!
    if (this.dramaticDim > 0.02) {
      ctx.fillStyle = `rgba(12, 4, 20, ${this.dramaticDim})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Dodge afterimages
    this._drawAfterimages(ctx);

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
    this._drawShockwaves(ctx);
    this._drawRingFront(ctx);
    this._drawPetals(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore();
  }

  _drawArenaBackdrop(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#240924');
    bg.addColorStop(0.55, '#42153d');
    bg.addColorStop(1, '#160718');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Romantic glowing full moon!
    ctx.save();
    const moonGrad = ctx.createRadialGradient(W * 0.5, 92, 16, W * 0.5, 92, 130);
    moonGrad.addColorStop(0, 'rgba(255, 240, 215, 0.92)');
    moonGrad.addColorStop(0.32, 'rgba(255, 200, 220, 0.32)');
    moonGrad.addColorStop(1, 'rgba(255, 119, 186, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(W * 0.5, 92, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Twinkling stars
    for (let i = 0; i < 28; i++) {
      const sx = ((i * 137) % W);
      const sy = 18 + ((i * 53) % (H * 0.38));
      const twinkle = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2.5 + i));
      ctx.fillStyle = i % 3 === 0 ? `rgba(255, 212, 121, ${twinkle})` : `rgba(255, 195, 228, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 2.5 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm fairy string lights draped across top of the arena!
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 212, 121, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.quadraticCurveTo(W * 0.25, 72, W * 0.5, 36);
    ctx.quadraticCurveTo(W * 0.75, 72, W, 24);
    ctx.stroke();
    for (let i = 1; i <= 15; i++) {
      const t = i / 16;
      const lx = t * W;
      const ly = 24 + Math.sin(t * Math.PI * 2) * 18 + 16;
      const glow = 0.65 + 0.35 * Math.sin(this.time * 3 + i);
      ctx.fillStyle = i % 2 === 0 ? `rgba(255, 224, 140, ${glow})` : `rgba(255, 145, 200, ${glow})`;
      ctx.shadowColor = i % 2 === 0 ? '#ffd479' : '#ff77ba';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(lx, ly, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Soft rose & champagne spotlights
    ctx.save();
    const sway = Math.sin(this.time * 0.8) * 35;
    this._drawSpotlight(ctx, W * 0.24, -20, W * 0.36 + sway, H * 0.72, 'rgba(255, 105, 180, 0.16)');
    this._drawSpotlight(ctx, W * 0.76, -20, W * 0.64 - sway, H * 0.72, 'rgba(130, 175, 255, 0.14)');
    this._drawSpotlight(ctx, W * 0.5, -30, W * 0.5, H * 0.78, 'rgba(255, 212, 121, 0.13)');
    ctx.restore();

    // Cute cheering bunny crowd silhouettes
    ctx.fillStyle = 'rgba(20, 6, 22, 0.76)';
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
    ctx.fillStyle = '#c98a14';
    ctx.beginPath();
    ctx.moveTo(76, H * 0.78);
    ctx.lineTo(W - 76, H * 0.78);
    ctx.lineTo(W - 44, H * 0.94);
    ctx.lineTo(44, H * 0.94);
    ctx.closePath();
    ctx.fill();

    const matGrad = ctx.createLinearGradient(0, H * 0.57, 0, H * 0.85);
    matGrad.addColorStop(0, '#fff5fa');
    matGrad.addColorStop(1, '#ebd4e6');
    ctx.fillStyle = matGrad;
    ctx.beginPath();
    ctx.moveTo(155, H * 0.58);
    ctx.lineTo(W - 155, H * 0.58);
    ctx.lineTo(W - 68, H * 0.83);
    ctx.lineTo(68, H * 0.83);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Center romantic heart-ring emblem
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
    ctx.strokeStyle = 'rgba(255, 212, 121, 0.52)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
    this._drawHeart(ctx, W * 0.5, H * 0.70, 20, 'rgba(255, 92, 168, 0.36)');

    // Sliding tracks
    ctx.fillStyle = 'rgba(42, 15, 46, 0.18)';
    ctx.beginPath();
    ctx.roundRect(W * 0.24, H * 0.70, W * 0.22, 16, 8);
    ctx.roundRect(W * 0.54, H * 0.70, W * 0.22, 16, 8);
    ctx.fill();

    this._drawCornerPost(ctx, 160, H * 0.58, '#ff5ca8', 0.82);
    this._drawCornerPost(ctx, W - 160, H * 0.58, '#5c9eff', 0.82);

    const ropeColors = ['#ff5ca8', '#fff0f7', '#5c9eff'];
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
    this._drawCornerPost(ctx, W - 74, H * 0.83, '#5c9eff', 1.05);

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#ffd479';
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
    ctx.fillStyle = '#331438';
    ctx.fillRect(x - postW / 2, baseY - postH, postW, postH);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - postW * 0.75, baseY - postH + 14 * scale, postW * 1.5, postH * 0.7, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd479';
    ctx.beginPath();
    ctx.arc(x, baseY - postH, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawAfterimages(ctx) {
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life / a.maxLife) * 0.55;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.ellipse(a.x, a.y - 82, 42, 74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawShockwaves(ctx) {
    for (const s of this.shockwaves) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 6 * alpha + 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawPetals(ctx) {
    for (const p of this.petals) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.isHeart) {
        this._drawHeart(ctx, 0, 0, p.size * 1.1, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ==========================
  // EXPRESSIVE BROWN BUNNY CHARACTERS (WIFEBUN & HUSBUN)
  // ==========================
  _drawBunny(ctx, f, baseX, baseY, dir) {
    const isWifebun = f.side === 'red';

    const furMain = isWifebun ? '#a87148' : '#6e4528';
    const furLight = isWifebun ? '#cc976e' : '#94623e';
    const furDark = isWifebun ? '#784a2a' : '#472a15';
    const bellyCol = isWifebun ? '#fae8d4' : '#e0c4a6';
    const accent = isWifebun ? '#ff69b4' : '#3b82f6';
    const accentDark = isWifebun ? '#c2186a' : '#1d4ed8';

    const breathe = Math.sin(this.time * 5.2 + (isWifebun ? 0 : 1.7));
    const idleBob = f.headPopped ? 0 : breathe * 4;
    const lungeX = (f.lean * 34 + f.dodgeOffset) * dir;

    ctx.save();
    ctx.translate(baseX + lungeX, baseY + f.jumpY);

    // Dodge shimmer opacity
    if (f.dodgeTimer > 0) {
      ctx.globalAlpha = 0.78;
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(20, 6, 24, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 26 - f.jumpY, 64, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Counter-ready golden/rose heart aura!
    if (f.counterWindow > 0 && !f.headPopped) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.9)';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#ffd479';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(0, -86, 78, 120, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Wagging fluffy cotton bunny tail!
    const tailWag = Math.sin(this.time * 12 + (isWifebun ? 0 : 2)) * 3;
    ctx.fillStyle = isWifebun ? '#fff5ee' : '#ebd5be';
    ctx.beginPath();
    ctx.arc(-44 * dir, -34 + tailWag, isWifebun ? 16 : 13, 0, Math.PI * 2);
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

    ctx.fillStyle = furMain;
    ctx.beginPath();
    ctx.ellipse(-20 + 4 * dir, 18, 22, 11, 0, 0, Math.PI * 2);
    ctx.ellipse(20 + 4 * dir, 18, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper body pivot (squash/stretch, breathing, lean, Pear Bounce flip, DJ Spin twirl!)
    ctx.save();
    ctx.translate(0, -24 + idleBob);
    ctx.scale(f.squashX * (1 + breathe * 0.015), f.squashY * (1 - breathe * 0.015));
    ctx.rotate(f.lean * 0.17 * dir + f.flipAngle);

    if (f.spinAngle !== 0) {
      const spinScaleX = Math.cos(f.spinAngle);
      ctx.scale(Math.abs(spinScaleX) < 0.25 ? 0.25 : spinScaleX, 1);
    }

    // Back arm
    this._drawBunnyArm(ctx, f, dir, furMain, furDark, accent, accentDark, true);

    // Torso
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

    // Soft belly patch + little heart emblem on chest
    ctx.fillStyle = bellyCol;
    ctx.beginPath();
    ctx.ellipse(4 * dir, torsoTop + torsoH * 0.52, torsoW * 0.30, torsoH * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute shorts / skirt trim
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2 + 2, -38, torsoW - 4, 28, 10);
    ctx.fill();
    ctx.fillStyle = isWifebun ? '#ffe3f1' : '#ffd479';
    ctx.fillRect(-torsoW / 2 + 4, -38, torsoW - 8, 7);

    // Spring Neck + Expressive Bunny Head!
    this._drawBunnyHeadAndSpring(ctx, f, dir, isWifebun, torsoTop, furMain, furLight, furDark);

    // Front arm
    this._drawBunnyArm(ctx, f, dir, furMain, furDark, accent, accentDark, false);

    // Guard shield shimmer
    if (f.blocking) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.9)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(46 * dir, torsoTop + 26, 48, dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55, dir > 0 ? Math.PI * 0.45 : Math.PI * 1.45);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }

  _drawBunnyHeadAndSpring(ctx, f, dir, isWifebun, neckBaseY, furMain, furLight, furDark) {
    const popOffset = f.headPopped ? f.headPopHeight : 0;
    const springLen = 14 + popOffset;

    if (f.headPopped || Math.abs(f.headWobble) > 0.12) {
      ctx.save();
      ctx.strokeStyle = '#ffe4f2';
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

    // Cute expressive bunny ears (fluttering!)
    const earBob = Math.sin(this.time * 7.5 + (isWifebun ? 0 : 2)) * 0.08;
    if (isWifebun) {
      this._drawEar(ctx, -14 * dir, -28, -0.32 * dir + earBob, 14, 46, furMain, '#ffb6d9');
      this._drawEar(ctx, 10 * dir, -30, -0.10 * dir - earBob, 14, 48, furMain, '#ffb6d9');
    } else {
      this._drawEar(ctx, -12 * dir, -30, -0.14 * dir + earBob, 13, 50, furMain, '#c99b84');
      this._drawEar(ctx, 12 * dir, -30, 0.12 * dir - earBob, 13, 46, furMain, '#c99b84');
    }

    // Bunny head
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

    // Cute fluffy cheek tuft
    ctx.fillStyle = furLight;
    ctx.beginPath();
    ctx.ellipse(-26 * dir, 8, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Accessories
    if (isWifebun) {
      // Pink bow on ear
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

      // Glowing DJ Headphones during DJ Spin!
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
      // Navy & gold headband on Husbun
      ctx.fillStyle = '#1e5fd9';
      ctx.beginPath();
      ctx.roundRect(-34, -22, 68, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd479';
      ctx.fillRect(-33, -18, 66, 3);
      ctx.strokeStyle = '#1e5fd9';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-32 * dir, -17);
      ctx.lineTo(-46 * dir, -10 + Math.sin(this.time * 9) * 3);
      ctx.stroke();

      // Anime glasses glint during EYP Report!
      if (f.move && f.move.id === 'eyp_report') {
        ctx.strokeStyle = '#ffd479';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(2 * dir, -11, 22 * dir, 12, 3);
        ctx.stroke();
      }
    }

    // Face
    const faceX = 12 * dir;
    ctx.fillStyle = isWifebun ? '#fcead7' : '#e6ccb0';
    ctx.beginPath();
    ctx.ellipse(faceX + 4 * dir, 10, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = isWifebun ? '#ff7eb6' : '#3d2214';
    ctx.beginPath();
    ctx.ellipse(faceX + 8 * dir, 6, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (puffed cheeks on Coke Burp, kissy mouth on Forehead Kiss, cute 'w' smile!)
    ctx.strokeStyle = '#3a1f10';
    ctx.lineWidth = 2.2;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#5c2614';
      ctx.beginPath();
      ctx.arc(faceX + 8 * dir, 14, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.move && f.move.id === 'forehead_kiss') {
      ctx.fillStyle = '#ff4d9e';
      ctx.beginPath();
      ctx.arc(faceX + 10 * dir, 13, 4, 0, Math.PI * 2);
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

    // Rosy cheeks (extra glowing when Forehead Kissed!)
    if (isWifebun || f.blushTimer > 0) {
      ctx.fillStyle = f.blushTimer > 0 ? 'rgba(255, 64, 129, 0.82)' : 'rgba(255, 118, 178, 0.50)';
      ctx.beginPath();
      ctx.ellipse(faceX - 8 * dir, 9, f.blushTimer > 0 ? 11 : 8, f.blushTimer > 0 ? 6.5 : 5, 0, 0, Math.PI * 2);
      ctx.ellipse(faceX + 18 * dir, 9, f.blushTimer > 0 ? 8 : 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive eyes: Dizzy X on KO, Lovey-Dovey Hearts (♥), Blinking, or Sparkly!
    const isBlinking = !f.headPopped && ((this.time + (isWifebun ? 0 : 1.7)) % 3.4) > 3.26;
    if (f.headPopped) {
      ctx.strokeStyle = '#ffd479';
      ctx.lineWidth = 3;
      [-4, 11].forEach((ox) => {
        const ex = faceX + ox * dir;
        ctx.beginPath();
        ctx.moveTo(ex - 4, -8); ctx.lineTo(ex + 4, 0);
        ctx.moveTo(ex + 4, -8); ctx.lineTo(ex - 4, 0);
        ctx.stroke();
      });
      // Swirling dizzy hearts above popped head!
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 26, -42 + Math.sin(a) * 8, 7, '#ff77ba');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [faceX - 4 * dir, faceX + 11 * dir].forEach((ex) => {
        this._drawHeart(ctx, ex, -4, 7.5, '#ff4d9e');
      });
    } else if (isBlinking) {
      ctx.strokeStyle = '#1a110d';
      ctx.lineWidth = 2.5;
      [faceX - 4 * dir, faceX + 11 * dir].forEach((ex) => {
        ctx.beginPath();
        ctx.arc(ex, -3, 4.5, 0, Math.PI);
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

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 1.5 * dir, ey - 2, isWifebun ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (isWifebun) {
          ctx.strokeStyle = '#1a110d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex - 4 * dir, ey - 4); ctx.lineTo(ex - 8 * dir, ey - 7);
          ctx.moveTo(ex - 1 * dir, ey - 6); ctx.lineTo(ex - 4 * dir, ey - 10);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#2e190c';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(ex - 5, ey - 8); ctx.lineTo(ex + 5, ey - 6);
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
    } else if (f.dodgeTimer > 0) {
      reach = 26;
      liftY = -16;
    } else if (f.move) {
      if (f.move.phase === 'windup') {
        reach = 14;
        liftY = 16;
      } else if (f.move.phase === 'active') {
        reach = isBack ? 128 : 146;
        liftY = f.move.id === 'height_mog' ? 30 : f.move.id === 'forehead_kiss' ? -18 : -6;
        gloveScale = f.move.isCounter ? 1.35 : 1.2;
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
    // Motion smear trail on active strike!
    if (f.move && f.move.phase === 'active' && !isBack) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(shoulderX + 24 * dir, shoulderY);
      ctx.lineTo(gloveX, gloveY);
      ctx.stroke();
    }

    ctx.strokeStyle = isBack ? furDark : furMain;
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gloveX, gloveY);
    ctx.stroke();

    ctx.translate(gloveX, gloveY);
    ctx.scale(gloveScale, gloveScale);

    ctx.fillStyle = isBack ? accentDark : accent;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.beginPath();
    ctx.ellipse(-6 * dir, -7, 7, 4.5, -0.4 * dir, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-20 * dir - (dir > 0 ? 6 : 0), -10, 9, 20, 4);
    ctx.fill();
    ctx.restore();
  }

  // ==========================
  // UPGRADED ACTION ANIMATIONS FOR ALL 8 MOVES!
  // ==========================
  _drawVfx(ctx) {
    for (const v of this.vfx) {
      const p = Math.min(1, v.t / v.duration);
      const x = v.startX + (v.targetX - v.startX) * p;
      const y = H * 0.45;

      ctx.save();

      switch (v.moveId) {
        case 'pear_bounce': {
          // Double-bouncing glowing pear with lime-gold motion rings!
          const bounceY = y - Math.abs(Math.sin(p * Math.PI * 3)) * 105;
          ctx.translate(x, bounceY);
          ctx.rotate(p * Math.PI * 4 * v.dir);
          ctx.shadowColor = '#bef264';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#bef264';
          ctx.strokeStyle = '#4d7c0f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 10, 21, 0, Math.PI * 2);
          ctx.arc(0, -10, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(3, -33); ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath(); ctx.ellipse(11, -26, 9, 4.5, -0.4, 0, Math.PI * 2); ctx.fill();
          break;
        }

        case 'dj_spin': {
          // Neon DJ turntable + pulsing rainbow bass rings!
          const cx = v.startX + 46 * v.dir;
          const cy = H * 0.56;
          ctx.translate(cx, cy);
          for (let r = 0; r < 2; r++) {
            ctx.strokeStyle = r === 0 ? `rgba(255, 105, 180, ${1 - p})` : `rgba(56, 189, 248, ${1 - p})`;
            ctx.lineWidth = 7 - r * 2;
            ctx.beginPath();
            ctx.arc(0, 0, 28 + p * (155 + r * 35), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.rotate(p * Math.PI * 8);
          ctx.fillStyle = '#111827';
          ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffd479';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ff69b4';
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
          break;
        }

        case 'mango_seed': {
          // Blazing supersonic golden mango seed comet!
          ctx.translate(x, y - 16);
          const trailGrad = ctx.createLinearGradient(-85 * v.dir, 0, 0, 0);
          trailGrad.addColorStop(0, 'rgba(255, 183, 3, 0)');
          trailGrad.addColorStop(1, 'rgba(255, 140, 0, 0.85)');
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-85 * v.dir, 0); ctx.lineTo(0, 0); ctx.stroke();

          ctx.rotate(p * 12 * v.dir);
          ctx.shadowColor = '#ffb703';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#ffd166';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.ellipse(0, 0, 32, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-19, -4); ctx.lineTo(19, -4); ctx.moveTo(-15, 4); ctx.lineTo(15, 4); ctx.stroke();
          break;
        }

        case 'coke_burp': {
          // Frosted red soda can + roaring fizzy cola sonic beam!
          ctx.fillStyle = '#dc2626';
          ctx.beginPath(); ctx.roundRect(v.startX + 18 * v.dir - 10, H * 0.44, 20, 34, 4); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(v.startX + 18 * v.dir - 10, H * 0.44 + 13, 20, 6);

          for (let i = 0; i < 4; i++) {
            const waveX = v.startX + (35 + p * 215 + i * 24) * v.dir;
            ctx.strokeStyle = i % 2 === 0 ? `rgba(139, 69, 19, ${1 - p})` : `rgba(255, 255, 255, ${1 - p})`;
            ctx.lineWidth = 10 - i * 2;
            ctx.beginPath();
            ctx.arc(waveX, H * 0.40, 26 + p * 52, -0.9, 0.9);
            ctx.stroke();
          }
          break;
        }

        case 'white_claw': {
          // Frosted White Claw can + sparkling mist + blazing triple frost-claw arcs!
          const canX = v.startX + 24 * v.dir;
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(canX - 9, H * 0.40, 18, 38, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(canX - 8, H * 0.40 + 13, 16, 10);

          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 16;
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - p * 0.8})`;
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          [-22, 0, 22].forEach((off) => {
            ctx.beginPath();
            ctx.moveTo(v.targetX - 44 * v.dir, H * 0.32 + off);
            ctx.quadraticCurveTo(v.targetX, H * 0.40 + off, v.targetX + 44 * v.dir, H * 0.50 + off);
            ctx.stroke();
          });
          break;
        }

        case 'height_mog': {
          // Glowing golden anime aura + rising 6'5" ruler!
          const rx = v.startX + 64;
          const ry = H * 0.68;
          const rh = 260 * Math.min(1, p * 2.2);
          ctx.shadowColor = '#ffd479';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#ffd479';
          ctx.strokeStyle = '#854d0e';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(rx, ry - rh, 28, rh, 4); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#422006';
          ctx.lineWidth = 2;
          for (let ty = 14; ty < rh - 10; ty += 16) {
            ctx.beginPath(); ctx.moveTo(rx, ry - ty); ctx.lineTo(rx + (ty % 32 === 0 ? 15 : 9), ry - ty); ctx.stroke();
          }
          ctx.font = `700 30px 'Bangers', Impact, sans-serif`;
          ctx.fillStyle = '#ffd479';
          ctx.strokeStyle = '#0b0e18';
          ctx.lineWidth = 5;
          ctx.strokeText(`6'5"`, rx - 6, ry - rh - 12);
          ctx.fillText(`6'5"`, rx - 6, ry - rh - 12);
          break;
        }

        case 'forehead_kiss': {
          // Blooming romantic heart + kiss mark landing right on Wifebun's forehead!
          const kx = v.startX + (v.targetX - v.startX) * Math.min(1, p * 1.35);
          const ky = H * 0.33 - Math.sin(p * Math.PI) * 28;
          const sc = 0.75 + Math.sin(p * Math.PI) * 0.95;
          ctx.translate(kx, ky);
          ctx.scale(sc, sc);
          ctx.shadowColor = '#ff69b4';
          ctx.shadowBlur = 22;
          this._drawHeart(ctx, 0, 0, 30, '#ff4d9e');
          ctx.font = `30px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('💋', 0, 10);
          break;
        }

        case 'eyp_report': {
          // Giant glowing EYP REPORT binder + red APPROVED ♥ rubber stamp!
          const bx = v.targetX;
          const by = H * 0.22 + p * 105;
          ctx.translate(bx, by);
          ctx.rotate((-0.42 + p * 0.52) * v.dir);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.roundRect(-44, -54, 88, 108, 6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(-42, -52, 84, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 13px 'Chakra Petch', sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('EYP REPORT', 0, -36);
          ctx.fillStyle = '#3b82f6'; ctx.fillRect(-26, 6, 12, 26);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(-8, -8, 12, 40);
          ctx.fillStyle = '#10b981'; ctx.fillRect(10, 14, 12, 18);
          if (p > 0.45) {
            ctx.rotate(-0.22);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 3;
            ctx.strokeRect(-36, -6, 72, 20);
            ctx.fillStyle = '#dc2626';
            ctx.font = `700 12px 'Chakra Petch', sans-serif`;
            ctx.fillText('APPROVED ♥', 0, 8);
          }
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
      ctx.strokeStyle = '#18061a';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }
  }
}
