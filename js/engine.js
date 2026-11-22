import { sound } from './audio.js';

const W = 960;
const H = 540;
const STAGE_W = 1480;
const GROUND_Y = 448;
const GRAVITY = 1780;

const MAX_HP = 100;
const MAX_SUPER = 100;
const PASSIVE_SUPER_PER_SEC = 7.2; // Unlocks Special naturally after ~14s!
const BLOCK_SUPER_GAIN = 22;       // Each blocked attack strongly boosts Special!
const DODGE_SUPER_GAIN = 18;       // Perfect Dodge rewards Special!
const HIT_SUPER_GAIN = 8;          // Normal hits build Special!
const ROUND_TIME = 99;

export const FIGHTER_MOVES = {
  red: [
    {
      id: 'pear_bounce',
      label: 'PEAR BOUNCE',
      emoji: '🍐',
      damage: 10,
      cooldown: 0.45,
      windup: 0.09,
      active: 0.22,
      recover: 0.16,
      callout: 'PEAR BOUNCE!',
      color: '#bef264',
      heavy: false,
      isSuper: false,
    },
    {
      id: 'dj_spin',
      label: 'DJ SPIN',
      emoji: '🎧',
      damage: 13,
      cooldown: 0.65,
      windup: 0.09,
      active: 0.36,
      recover: 0.18,
      callout: 'DJ SPIN! ♫',
      color: '#ff69b4',
      heavy: false,
      isSuper: false,
    },
    {
      id: 'coke_burp',
      label: 'COKE BURP',
      emoji: '🥤',
      damage: 12,
      cooldown: 0.80,
      windup: 0.13,
      active: 0.34,
      recover: 0.20,
      callout: 'COKE BURP!!',
      color: '#ff6b6b',
      heavy: true,
      isSuper: false,
    },
    {
      id: 'mango_seed',
      label: 'MANGO SEED SPECIAL',
      emoji: '🥭',
      damage: 26,
      cooldown: 0,
      windup: 0.12,
      active: 0.28,
      recover: 0.24,
      callout: 'MANGO SEED SPECIAL!!',
      color: '#ffb703',
      heavy: true,
      isSuper: true,
    },
  ],
  blue: [
    {
      id: 'white_claw',
      label: 'WHITE CLAW',
      emoji: '🫧',
      damage: 12,
      cooldown: 0.50,
      windup: 0.08,
      active: 0.28,
      recover: 0.15,
      callout: 'WHITE CLAW!',
      color: '#38bdf8',
      heavy: false,
      isSuper: false,
    },
    {
      id: 'height_mog',
      label: 'HEIGHT MOG',
      emoji: '📏',
      damage: 14,
      cooldown: 0.75,
      windup: 0.13,
      active: 0.32,
      recover: 0.20,
      callout: 'HEIGHT MOGGED!',
      color: '#ffd479',
      heavy: true,
      isSuper: false,
    },
    {
      id: 'forehead_kiss',
      label: 'FOREHEAD KISS',
      emoji: '💋',
      damage: 12,
      cooldown: 0.65,
      windup: 0.10,
      active: 0.30,
      recover: 0.17,
      callout: 'FOREHEAD KISS ♥',
      color: '#ff7eb6',
      heavy: false,
      isSuper: false,
    },
    {
      id: 'eyp_report',
      label: 'EYP REPORT',
      emoji: '📊',
      damage: 26,
      cooldown: 0,
      windup: 0.14,
      active: 0.28,
      recover: 0.24,
      callout: 'EYP REPORT!!',
      color: '#60a5fa',
      heavy: true,
      isSuper: true,
    },
  ],
};

function createFighter(side, startX) {
  return {
    side, // 'red' = Wifebun, 'blue' = Husbun
    x: startX,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing: side === 'red' ? 1 : -1,
    grounded: true,

    hp: MAX_HP,
    superMeter: 0,
    superNotified: false,
    blocking: false,
    inputs: { left: false, right: false, block: false },

    move: null,
    moveCooldown: 0,
    dodgeTimer: 0,
    dodgeCooldown: 0,
    dodgeDir: 0,

    stunTimer: 0,
    blushTimer: 0,
    heartEyesTimer: 0,
    winkTimer: 0,
    hitFlash: 0,
    counterWindow: 0,
    koState: false,
    koFallProgress: 0,

    // Fluid animation state
    animTime: 0,
    runCycle: 0,
    squashX: 1,
    squashY: 1,
    stretchH: 0,
    spinAngle: 0,
    rollAngle: 0,
    earLag: 0,
    flirtTimer: 2.2 + Math.random() * 2,
    victoryKissTimer: 0,

    roundsWon: 0,
    comboCount: 0,
    comboTimer: 0,
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

    this.red = createFighter('red', STAGE_W * 0.5 - 190);
    this.blue = createFighter('blue', STAGE_W * 0.5 + 190);

    this.round = 1;
    this.roundTimer = ROUND_TIME;
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.matchWinner = null;

    this.time = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.camX = STAGE_W * 0.5;
    this.camZoom = 1.0;
    this.dramaticDim = 0;

    // Capcom Super-Freeze Cut-In state!
    this.superFreeze = null; // null | { side, title, color, timer, maxTimer }

    this.projectiles = [];
    this.vfx = [];
    this.smears = [];
    this.hitSparks = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.particles = [];
    this.callouts = [];
    this.petals = this._initPetals();

    this.cpuDecisionTimer = 0.4;
    this.cpuMoveIntent = 0;
    this.cpuBlockTimer = 0;
    this._lastHudSync = 0;
  }

  _initPetals() {
    const list = [];
    for (let i = 0; i < 36; i++) {
      list.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: -14 - Math.random() * 20,
        vy: 14 + Math.random() * 22,
        size: 3.5 + Math.random() * 4.5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2.6,
        isHeart: i % 5 === 0,
        color: i % 3 === 0 ? '#ffd479' : i % 2 === 0 ? '#ff8ec7' : '#ffc2e2',
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

    this.red = createFighter('red', STAGE_W * 0.5 - 190);
    this.blue = createFighter('blue', STAGE_W * 0.5 + 190);
    this.round = 1;
    this.matchWinner = null;

    this._startRound();
  }

  _startRound() {
    this._resetFighterForRound(this.red, STAGE_W * 0.5 - 190, 1);
    this._resetFighterForRound(this.blue, STAGE_W * 0.5 + 190, -1);

    this.roundTimer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseTimer = 1.65;
    this.hitStop = 0;
    this.shake = 0;
    this.camX = STAGE_W * 0.5;
    this.camZoom = 1.04;
    this.dramaticDim = 0;
    this.superFreeze = null;

    this.projectiles = [];
    this.vfx = [];
    this.smears = [];
    this.hitSparks = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.particles = [];
    this.callouts = [];

    this._emitBanner(`ROUND ${this.round}`, '🌸 MOONLIT ROMANCE DUEL 🌸');
    sound.playBell();
    this._notifyHud(true);
  }

  _resetFighterForRound(f, startX, facing) {
    f.x = startX;
    f.y = GROUND_Y;
    f.vx = 0;
    f.vy = 0;
    f.facing = facing;
    f.grounded = true;
    f.hp = MAX_HP;
    // Keep 25% carryover Super meter between rounds like Street Fighter!
    f.superMeter = this.round > 1 ? Math.min(40, f.superMeter * 0.4) : 0;
    f.superNotified = false;
    f.blocking = false;
    f.inputs = { left: false, right: false, block: false };
    f.move = null;
    f.moveCooldown = 0;
    f.dodgeTimer = 0;
    f.dodgeCooldown = 0;
    f.stunTimer = 0;
    f.blushTimer = 0;
    f.heartEyesTimer = 0;
    f.winkTimer = 0;
    f.hitFlash = 0;
    f.counterWindow = 0;
    f.koState = false;
    f.koFallProgress = 0;
    f.runCycle = 0;
    f.squashX = 1;
    f.squashY = 1;
    f.stretchH = 0;
    f.spinAngle = 0;
    f.rollAngle = 0;
    f.comboCount = 0;
    f.comboTimer = 0;
    f.victoryKissTimer = 0;
  }

  _addSuper(f, amount) {
    const wasReady = f.superMeter >= MAX_SUPER;
    f.superMeter = Math.min(MAX_SUPER, f.superMeter + amount);
    if (!wasReady && f.superMeter >= MAX_SUPER && !f.superNotified) {
      f.superNotified = true;
      sound.playSuperReady();
      this._spawnCallout(f.x, f.y - 148, '★ SUPER READY! ★', '#ffd479', 0.92);
      this._spawnSparks(f.x, f.y - 72, '#ffd479', 14, 'heart');
    }
  }

  // ==========================
  // PLAYER INPUTS & ACTIONS
  // ==========================
  setInput(side, key, value) {
    const f = side === 'red' ? this.red : this.blue;
    if (key in f.inputs) {
      f.inputs[key] = Boolean(value);
    }
  }

  triggerJump(side) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    if (!f.grounded || f.koState || f.stunTimer > 0 || f.dodgeTimer > 0) return false;
    if (f.move && f.move.phase !== 'recover') return false;

    f.grounded = false;
    f.vy = side === 'red' ? -695 : -665;
    f.squashX = 0.80;
    f.squashY = 1.24;
    sound.playJump();
    this._spawnDust(f.x, GROUND_Y, 7);
    return true;
  }

  triggerDodge(side) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.koState || f.stunTimer > 0 || f.dodgeTimer > 0 || f.dodgeCooldown > 0) return false;

    f.blocking = false;
    f.move = null;
    f.dodgeTimer = 0.36;    // Generous 0-damage invincibility window!
    f.dodgeCooldown = 0.48;

    const dir = f.inputs.left ? -1 : f.inputs.right ? 1 : -f.facing;
    f.dodgeDir = dir;
    f.vx = dir * 580;
    if (f.grounded) {
      f.vy = -210;
      f.grounded = false;
    }
    f.squashX = 1.20;
    f.squashY = 0.82;

    sound.playDodge();
    this._spawnDust(f.x, GROUND_Y, 6);
    this._spawnAfterimage(f);
    this._emitNetEvent('dodge', { side, x: f.x, y: f.y });
    return true;
  }

  triggerMove(side, moveIndex) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    const opp = side === 'red' ? this.blue : this.red;
    if (f.koState || f.stunTimer > 0 || f.move || f.blocking || f.dodgeTimer > 0) return false;

    const def = FIGHTER_MOVES[side]?.[moveIndex];
    if (!def) return false;

    // Special Super (move 3) requires 100% Super Meter!
    if (def.isSuper) {
      if (f.superMeter < MAX_SUPER) {
        this._spawnCallout(f.x, f.y - 135, `SUPER ${Math.floor(f.superMeter)}%`, '#ffd479', 0.72);
        return false;
      }
      f.superMeter = 0;
      f.superNotified = false;
      // Trigger dramatic Capcom Super-Freeze Cut-In!
      this.superFreeze = {
        side,
        title: def.callout,
        color: def.color,
        timer: 0.52,
        maxTimer: 0.52,
      };
      sound.playSuperFreeze();
      this._emitNetEvent('super_freeze', { side, title: def.callout, color: def.color });
    } else if (f.moveCooldown > 0) {
      return false;
    }

    f.facing = opp.x >= f.x ? 1 : -1;
    const isCounter = f.counterWindow > 0;
    f.counterWindow = 0;

    f.squashX = 1.20;
    f.squashY = 0.82;
    if (def.id === 'forehead_kiss') f.heartEyesTimer = 1.1;
    if (def.id === 'height_mog') this.dramaticDim = 0.48;
    if (def.id === 'dj_spin') f.winkTimer = 0.65;

    f.move = {
      index: moveIndex,
      id: def.id,
      phase: 'windup',
      timer: def.windup,
      activeDur: def.active,
      recoverDur: def.recover,
      hitDone: false,
      isCounter,
      isSuper: def.isSuper,
      damage: def.damage * (isCounter ? 1.55 : 1),
      callout: def.callout,
      color: def.color,
      heavy: def.heavy,
    };
    f.moveCooldown = def.cooldown || 0;

    if (!def.isSuper) {
      sound.playMove(def.id);
    }
    this._emitNetEvent('move_start', { side, moveId: def.id, x: f.x, y: f.y, dir: f.facing });
    return true;
  }

  // ==========================
  // SIMULATION UPDATE
  // ==========================
  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    this._updatePetals(clampedDt);
    this._updateParticles(clampedDt);
    this._updateCallouts(clampedDt);
    this._updateVfx(clampedDt);
    this._updateSmears(clampedDt);
    this._updateHitSparks(clampedDt);
    this._updateShockwaves(clampedDt);
    this._updateAfterimages(clampedDt);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - clampedDt * 44);
    if (this.dramaticDim > 0) this.dramaticDim = Math.max(0, this.dramaticDim - clampedDt * 1.35);

    // Capcom Super-Freeze pauses gameplay briefly while showcasing the Super Cut-In!
    if (this.superFreeze) {
      this.superFreeze.timer -= clampedDt;
      if (this.superFreeze.timer <= 0) {
        const sfSide = this.superFreeze.side;
        this.superFreeze = null;
        const sfFighter = sfSide === 'red' ? this.red : this.blue;
        if (sfFighter.move) sound.playMove(sfFighter.move.id);
      }
      this._notifyHud(false);
      return;
    }

    if (this.mode === 'online-guest') {
      this._updateCamera(clampedDt);
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

      // Passive Special Super charge over time for both fighters!
      this._addSuper(this.red, PASSIVE_SUPER_PER_SEC * clampedDt);
      this._addSuper(this.blue, PASSIVE_SUPER_PER_SEC * clampedDt);

      if (this.mode === 'cpu') {
        this._updateCpuAI(clampedDt);
      }

      this._updateFighter(this.red, this.blue, clampedDt);
      this._updateFighter(this.blue, this.red, clampedDt);
      this._resolveFighterPushbox();
      this._updateProjectiles(clampedDt);

      if (this.roundTimer <= 0) {
        const winner = this.red.hp >= this.blue.hp ? 'red' : 'blue';
        const loser = winner === 'red' ? this.blue : this.red;
        this._triggerRoundEnd(winner, loser, true);
      }
    } else if (this.phase === 'ko' || this.phase === 'match_over') {
      const koDt = this.phase === 'ko' && this.phaseTimer > 2.2 ? clampedDt * 0.35 : clampedDt;
      this._updateFighterKO(this.red, koDt);
      this._updateFighterKO(this.blue, koDt);
      this._updateProjectiles(koDt);

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

    this._updateCamera(clampedDt);
    this._notifyHud(false);
  }

  _updateCamera(dt) {
    const midX = (this.red.x + this.blue.x) * 0.5;
    const dist = Math.abs(this.red.x - this.blue.x);
    const targetZoom = Math.max(0.90, Math.min(1.10, 1.15 - dist / 1850));
    const halfView = (W * 0.5) / targetZoom;
    const clampedMid = Math.max(halfView + 16, Math.min(STAGE_W - halfView - 16, midX));

    this.camX += (clampedMid - this.camX) * Math.min(1, dt * 7);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 5);
  }

  _updateFighter(f, opp, dt) {
    f.animTime += dt;
    if (f.moveCooldown > 0) f.moveCooldown = Math.max(0, f.moveCooldown - dt);
    if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
    if (f.blushTimer > 0) f.blushTimer = Math.max(0, f.blushTimer - dt);
    if (f.heartEyesTimer > 0) f.heartEyesTimer = Math.max(0, f.heartEyesTimer - dt);
    if (f.winkTimer > 0) f.winkTimer = Math.max(0, f.winkTimer - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.counterWindow > 0) f.counterWindow = Math.max(0, f.counterWindow - dt);
    if (f.dodgeCooldown > 0) f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
    if (f.comboTimer > 0) {
      f.comboTimer = Math.max(0, f.comboTimer - dt);
      if (f.comboTimer <= 0) f.comboCount = 0;
    }

    // Periodic flirty idle charm (winks & tiny floating romance hearts when neutral!)
    f.flirtTimer -= dt;
    if (f.flirtTimer <= 0 && !f.move && f.stunTimer <= 0 && !f.blocking) {
      f.flirtTimer = 3.2 + Math.random() * 2.4;
      f.winkTimer = 0.45;
      if (f.side === 'red') {
        this._spawnSparks(f.x + f.facing * 20, f.y - 102, '#ff77ba', 2, 'heart');
      }
    }

    // Glowing romance aura sparkles when Super is 100% ready!
    if (f.superMeter >= MAX_SUPER && Math.random() < dt * 8) {
      this._spawnSparks(f.x + (Math.random() - 0.5) * 46, f.y - 20 - Math.random() * 90, '#ffd479', 1, 'heart');
    }

    f.blocking = Boolean(f.inputs.block && f.grounded && !f.move && f.stunTimer <= 0 && f.dodgeTimer <= 0);

    // Dodge roll / dash
    if (f.dodgeTimer > 0) {
      f.dodgeTimer = Math.max(0, f.dodgeTimer - dt);
      f.rollAngle += dt * 18 * f.dodgeDir;
      if (Math.random() < dt * 36) this._spawnAfterimage(f);
      if (f.dodgeTimer <= 0) f.rollAngle = 0;
    } else {
      f.rollAngle = 0;
    }

    // Smooth responsive Street-Fighter walking/running!
    const moveSpeed = f.side === 'red' ? 375 : 345;
    if (f.stunTimer <= 0 && f.dodgeTimer <= 0 && !f.move) {
      if (f.blocking) {
        f.vx *= Math.pow(0.001, dt);
      } else {
        const dir = (f.inputs.right ? 1 : 0) - (f.inputs.left ? 1 : 0);
        const targetVx = dir * moveSpeed;
        f.vx += (targetVx - f.vx) * Math.min(1, dt * (f.grounded ? 20 : 9));
        if (f.grounded && Math.abs(f.vx) > 220 && Math.random() < dt * 10) {
          this._spawnDust(f.x - Math.sign(f.vx) * 16, GROUND_Y, 1);
        }
      }
      if (f.grounded && Math.abs(opp.x - f.x) > 12) {
        f.facing = opp.x >= f.x ? 1 : -1;
      }
    } else if (f.stunTimer > 0) {
      f.vx *= Math.pow(0.05, dt);
    }

    if (f.move) {
      this._updateFighterMove(f, opp, dt);
    }

    // Physics
    f.x += f.vx * dt;
    if (!f.grounded) {
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y;
        f.vy = 0;
        f.grounded = true;
        f.squashX = 1.22;
        f.squashY = 0.80;
        this._spawnDust(f.x, GROUND_Y, 5);
      }
    }

    f.x = Math.max(70, Math.min(STAGE_W - 70, f.x));

    // Smooth secondary animation channels
    f.squashX += (1 - f.squashX) * Math.min(1, dt * 13);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 13);

    const targetStretch = f.move && f.move.id === 'height_mog' && f.move.phase !== 'recover' ? 72 : 0;
    f.stretchH += (targetStretch - f.stretchH) * Math.min(1, dt * 14);

    if (f.move && f.move.id === 'dj_spin' && f.move.phase === 'active') {
      f.spinAngle += dt * 26;
    } else {
      f.spinAngle = 0;
    }

    if (f.grounded && Math.abs(f.vx) > 25 && !f.move && f.stunTimer <= 0) {
      f.runCycle += dt * Math.abs(f.vx) * 0.05;
    } else {
      f.runCycle *= Math.pow(0.01, dt);
    }

    f.earLag += (-f.vx * 0.0012 - f.earLag) * Math.min(1, dt * 10);
  }

  _updateFighterMove(f, opp, dt) {
    const m = f.move;
    m.timer -= dt;

    if (m.phase === 'windup') {
      f.vx *= Math.pow(0.01, dt);
      if (m.timer <= 0) {
        m.phase = 'active';
        m.timer = m.activeDur;
        f.squashX = 0.85;
        f.squashY = 1.18;
        this._onMoveActiveStart(f, opp, m);
      }
      return;
    }

    if (m.phase === 'active') {
      if (!m.hitDone) {
        if (m.id === 'dj_spin') {
          f.vx = f.facing * 350;
          if (Math.random() < dt * 18) {
            this._spawnSmear(f.x, f.y - 68, f.facing, '#ff69b4', 64);
          }
          if (Math.abs(f.x - opp.x) < 145 && Math.abs(f.y - opp.y) < 105) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 350, knockY: -230, stun: 0.28 });
          }
        } else if (m.id === 'coke_burp') {
          f.vx = -f.facing * 45;
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -20 && dx < 285 && Math.abs(f.y - opp.y) < 110) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 430, knockY: -180, stun: 0.44 });
          }
        } else if (m.id === 'white_claw') {
          f.vx = f.facing * 540;
          if (Math.random() < dt * 28) this._spawnAfterimage(f);
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -30 && dx < 155 && Math.abs(f.y - opp.y) < 105) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 330, knockY: -220, stun: 0.28 });
          }
        } else if (m.id === 'height_mog') {
          if (m.timer <= m.activeDur * 0.55) {
            const dx = (opp.x - f.x) * f.facing;
            if (dx > -40 && dx < 195 && Math.abs(f.y - opp.y) < 145) {
              m.hitDone = true;
              this._applyHit(f, opp, m, { knockX: 380, knockY: -320, stun: 0.34 });
            }
          }
        } else if (m.id === 'forehead_kiss') {
          f.vx = f.facing * 510;
          if (Math.random() < dt * 22) this._spawnSparks(f.x, f.y - 80, '#ff8ec7', 1, 'heart');
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -25 && dx < 130 && Math.abs(f.y - opp.y) < 105) {
            m.hitDone = true;
            f.vx = 0;
            this._applyHit(f, opp, m, { knockX: 220, knockY: -150, stun: 0.46, isKiss: true });
          }
        }
      }

      if (m.timer <= 0) {
        m.phase = 'recover';
        m.timer = m.recoverDur;
        f.vx *= 0.35;
      }
      return;
    }

    if (m.phase === 'recover') {
      f.vx *= Math.pow(0.02, dt);
      if (m.timer <= 0) {
        f.move = null;
      }
    }
  }

  _onMoveActiveStart(f, opp, m) {
    if (m.id === 'pear_bounce') {
      if (f.grounded) {
        f.vy = -370;
        f.grounded = false;
      }
      f.vx = f.facing * 130;
      this._spawnSmear(f.x + f.facing * 26, f.y - 72, f.facing, '#bef264', 58);
      this.projectiles.push({
        kind: 'pear',
        owner: f.side,
        x: f.x + f.facing * 42,
        y: f.y - 74,
        vx: f.facing * 450,
        vy: -320,
        radius: 24,
        bounces: 0,
        maxBounces: 2,
        life: 2.0,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'mango_seed') {
      // SUPER MANGO SEED COMET!
      f.vx = -f.facing * 140;
      this.shake = Math.max(this.shake, 10);
      this._spawnShockwave(f.x + f.facing * 42, f.y - 72, '#ffb703', 110);
      this._spawnSmear(f.x + f.facing * 40, f.y - 72, f.facing, '#ffd479', 88);
      this.projectiles.push({
        kind: 'mango_seed',
        owner: f.side,
        x: f.x + f.facing * 52,
        y: f.y - 72,
        vx: f.facing * 860,
        vy: 0,
        radius: 36,
        bounces: 0,
        maxBounces: 0,
        life: 1.6,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'eyp_report') {
      // SUPER EYP REPORT METEOR BINDER!
      f.vx = f.facing * 80;
      this.shake = Math.max(this.shake, 10);
      const dist = Math.max(170, Math.min(480, Math.abs(opp.x - f.x)));
      this._spawnSmear(f.x + f.facing * 35, f.y - 102, f.facing, '#60a5fa', 84);
      this.projectiles.push({
        kind: 'eyp_report',
        owner: f.side,
        x: f.x + f.facing * 36,
        y: f.y - 110,
        vx: f.facing * Math.max(390, dist * 1.18),
        vy: -450,
        radius: 44,
        bounces: 0,
        maxBounces: 0,
        life: 1.9,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'height_mog') {
      if (f.grounded) {
        f.vy = -440;
        f.grounded = false;
      }
      f.vx = f.facing * 270;
      this._spawnSmear(f.x + f.facing * 36, f.y - 110, f.facing, '#ffd479', 78);
      this.vfx.push({ kind: 'height_mog', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.58 });
    } else if (m.id === 'dj_spin') {
      this._spawnSmear(f.x, f.y - 68, f.facing, '#ff69b4', 72);
      this.vfx.push({ kind: 'dj_spin', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.48 });
    } else if (m.id === 'coke_burp') {
      this.vfx.push({ kind: 'coke_burp', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.48 });
    } else if (m.id === 'white_claw') {
      this._spawnSmear(f.x + f.facing * 42, f.y - 84, f.facing, '#38bdf8', 78);
      this.vfx.push({ kind: 'white_claw', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.44 });
    } else if (m.id === 'forehead_kiss') {
      this.vfx.push({ kind: 'forehead_kiss', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.45 });
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.rot += dt * (pr.kind === 'mango_seed' ? 16 : 8) * Math.sign(pr.vx || 1);

      if (pr.kind === 'pear') {
        pr.vy += 1250 * dt;
        if (pr.y >= GROUND_Y - 18) {
          pr.y = GROUND_Y - 18;
          if (pr.bounces < pr.maxBounces) {
            pr.bounces += 1;
            pr.vy = -390;
            this._spawnSparks(pr.x, GROUND_Y, '#bef264', 8, 'dot');
          } else {
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      } else if (pr.kind === 'eyp_report') {
        pr.vy += 1280 * dt;
        if (pr.y >= GROUND_Y - 24) {
          this._spawnShockwave(pr.x, GROUND_Y - 10, '#60a5fa', 135);
          this._spawnSparks(pr.x, GROUND_Y - 16, '#ffffff', 16, 'page');
          this.shake = Math.max(this.shake, 9);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      const attacker = pr.owner === 'red' ? this.red : this.blue;
      const target = pr.owner === 'red' ? this.blue : this.red;
      const targetCenterY = target.y - (target.side === 'red' ? 62 : 74);
      const dx = pr.x - target.x;
      const dy = pr.y - targetCenterY;
      if (Math.hypot(dx, dy) < pr.radius + 38) {
        const knock = pr.kind === 'mango_seed'
          ? { knockX: 540, knockY: -340, stun: 0.36 }
          : pr.kind === 'eyp_report'
          ? { knockX: 460, knockY: -360, stun: 0.40 }
          : { knockX: 250, knockY: -180, stun: 0.22 };

        this._applyHit(attacker, target, pr.move, knock, pr.x, pr.y);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.life <= 0 || pr.x < -100 || pr.x > STAGE_W + 100) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  _resolveFighterPushbox() {
    const minDist = 66;
    const dx = this.blue.x - this.red.x;
    const dy = Math.abs(this.blue.y - this.red.y);
    if (dy < 90 && Math.abs(dx) < minDist) {
      const push = (minDist - Math.abs(dx)) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      this.red.x = Math.max(70, Math.min(STAGE_W - 70, this.red.x - sign * push));
      this.blue.x = Math.max(70, Math.min(STAGE_W - 70, this.blue.x + sign * push));
    }
  }

  _applyHit(attacker, defender, move, { knockX, knockY, stun, isKiss = false }, hitX, hitY) {
    const ix = hitX ?? (attacker.x + defender.x) * 0.5;
    const iy = hitY ?? (defender.y - 72);
    const pushDir = defender.x >= attacker.x ? 1 : -1;

    // 1. DODGE -> STRICTLY 0 DAMAGE + PERFECT DODGE BONUS!
    if (defender.dodgeTimer > 0) {
      defender.counterWindow = 1.15;
      defender.heartEyesTimer = 0.9;
      this._addSuper(defender, DODGE_SUPER_GAIN);
      attacker.comboCount = 0;

      sound.playPerfectDodge();
      this.hitStop = 0.065;
      this._spawnShockwave(ix, iy, '#c084fc', 120);
      this._spawnSparks(ix, iy, '#e9d5ff', 14, 'heart');
      this._spawnCallout(ix, iy - 44, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
      this._emitNetEvent('perfect_dodge', { x: ix, y: iy });
      return;
    }

    // 2. BLOCK -> VERY SMALL CHIP DAMAGE (~8%) + BIG SPECIAL SUPER CHARGE (+22%)!
    if (defender.blocking) {
      const chipDmg = Math.max(1, Math.round(move.damage * 0.08 * 10) / 10);
      defender.hp = Math.max(1, defender.hp - chipDmg); // Never chip-KO on guard
      defender.vx = pushDir * (knockX * 0.42);
      defender.counterWindow = 0.85;
      this._addSuper(defender, BLOCK_SUPER_GAIN);
      attacker.comboCount = 0;

      sound.playBlock();
      this._spawnHitSpark(ix, iy, '#ffd479', 42);
      this._spawnShockwave(ix, iy, '#ffd479', 74);
      this._spawnCallout(ix, iy - 40, 'GUARD! +SUPER ✨', '#ffd479', 0.84);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: ix, y: iy });
      return;
    }

    // 3. CLEAN HIT!
    attacker.comboCount += 1;
    attacker.comboTimer = 2.4;
    const comboMult = attacker.comboCount >= 3 ? 1.15 : 1;
    if (!move.isSuper) {
      this._addSuper(attacker, HIT_SUPER_GAIN);
    }

    defender.hp = Math.max(0, defender.hp - move.damage * comboMult);
    defender.hitFlash = 0.18;
    defender.stunTimer = stun + (move.isCounter ? 0.12 : 0);
    defender.vx = pushDir * knockX;
    if (knockY < 0) {
      defender.vy = knockY;
      defender.grounded = false;
    }
    defender.squashX = 0.78;
    defender.squashY = 1.24;
    defender.move = null;

    if (isKiss) {
      defender.blushTimer = 2.2;
      defender.heartEyesTimer = 1.5;
      this.vfx.push({ kind: 'kiss_bloom', x: defender.x, y: defender.y - 108, t: 0, duration: 0.72 });
    }

    if (defender.hp <= 0) {
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnHitSpark(ix, iy, '#ffd479', 96);
      this._spawnShockwave(ix, iy, '#ffd479', 200);
      this._spawnShockwave(ix, iy, move.color, 140);
      this._spawnSparks(ix, iy, '#ffd479', 28, 'heart');
      this._spawnCallout(ix, iy - 50, 'K.O.!! 💕', '#ffd479', 1.55);
      this._emitNetEvent('ko', { x: ix, y: iy, color: move.color });
    } else {
      sound.playHit(move.heavy || move.isCounter || move.isSuper);
      this.hitStop = move.isSuper ? 0.12 : move.isCounter ? 0.085 : move.heavy ? 0.055 : 0.038;
      this.shake = move.isSuper ? 20 : move.isCounter ? 15 : move.heavy ? 10 : 6;
      this._spawnHitSpark(ix, iy, move.isSuper ? '#ffd479' : move.color, move.isSuper ? 88 : move.heavy ? 64 : 46);
      this._spawnShockwave(ix, iy, move.isCounter ? '#ffd479' : move.color, move.isSuper ? 160 : move.heavy ? 120 : 84);
      this._spawnMoveHitParticles(ix, iy, move.id, move.color);

      const label = move.isCounter ? `COUNTER ${move.callout}` : move.callout;
      this._spawnCallout(ix, iy - 38, label, move.isCounter || move.isSuper ? '#ffd479' : move.color, move.isSuper ? 1.25 : 0.96);
      if (attacker.comboCount >= 2) {
        this._spawnCallout(ix, iy - 84, `${attacker.comboCount} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.84);
      }

      this._emitNetEvent('hit', {
        x: ix,
        y: iy,
        moveId: move.id,
        color: move.color,
        word: label,
        heavy: move.heavy || move.isSuper,
        counter: move.isCounter,
        combo: attacker.comboCount,
      });
    }
  }

  _triggerRoundEnd(winnerSide, loser, byTimeout) {
    const winner = winnerSide === 'red' ? this.red : this.blue;
    winner.roundsWon += 1;
    winner.heartEyesTimer = 3.2;

    loser.koState = true;
    loser.blocking = false;
    loser.move = null;
    const fallDir = loser.x >= winner.x ? 1 : -1;
    loser.vx = fallDir * 400;
    loser.vy = -440;
    loser.grounded = false;

    this.phase = 'ko';
    this.phaseTimer = 2.85;
    this.hitStop = byTimeout ? 0.05 : 0.22;
    this.shake = 22;

    sound.playKO();
    const bannerMain = byTimeout ? 'TIME UP!' : 'K.O.! 💕';
    const bannerSub = winnerSide === 'red' ? 'WIFEBUN WINS THE ROUND!' : 'HUSBUN WINS THE ROUND!';
    this._emitBanner(bannerMain, bannerSub);
    this._notifyHud(true);
  }

  _updateFighterKO(f, dt) {
    f.animTime += dt;
    if (f.koState) {
      f.x = Math.max(70, Math.min(STAGE_W - 70, f.x + f.vx * dt));
      if (!f.grounded) {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        if (f.y >= GROUND_Y) {
          f.y = GROUND_Y;
          f.vy = 0;
          f.vx *= 0.25;
          f.grounded = true;
          this._spawnDust(f.x, GROUND_Y, 8);
        }
      } else {
        f.vx *= Math.pow(0.01, dt);
      }
      f.koFallProgress = Math.min(1, f.koFallProgress + dt * 3.5);
    } else {
      if (!f.grounded) {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        if (f.y >= GROUND_Y) {
          f.y = GROUND_Y;
          f.vy = 0;
          f.grounded = true;
        }
      }
      f.vx *= Math.pow(0.01, dt);
      f.victoryKissTimer -= dt;
      if (f.victoryKissTimer <= 0) {
        f.victoryKissTimer = 0.26;
        this._spawnSparks(f.x + f.facing * 20, f.y - 102, '#ff69b4', 3, 'heart');
      }
    }
  }

  // ==========================
  // SMART 2D FIGHTER CPU AI
  // ==========================
  _updateCpuAI(dt) {
    const cpuSide = this.humanSide === 'red' ? 'blue' : 'red';
    const cpu = cpuSide === 'red' ? this.red : this.blue;
    const player = cpuSide === 'red' ? this.blue : this.red;

    const dx = player.x - cpu.x;
    const absDist = Math.abs(dx);

    if (this.cpuBlockTimer > 0) {
      this.cpuBlockTimer -= dt;
      cpu.inputs.block = true;
      cpu.inputs.left = false;
      cpu.inputs.right = false;
      if (this.cpuBlockTimer <= 0) cpu.inputs.block = false;
      return;
    }

    const cfg = {
      easy:   { reaction: 0.54, defenseChance: 0.24, aggro: 0.44 },
      medium: { reaction: 0.35, defenseChance: 0.46, aggro: 0.65 },
      hard:   { reaction: 0.22, defenseChance: 0.70, aggro: 0.84 },
    }[this.cpuDifficulty] || { reaction: 0.35, defenseChance: 0.46, aggro: 0.65 };

    const incomingProj = this.projectiles.some((pr) => pr.owner !== cpuSide && Math.abs(pr.x - cpu.x) < 160);
    if ((incomingProj || (player.move && absDist < 200)) && !cpu.move && cpu.stunTimer <= 0) {
      if (Math.random() < cfg.defenseChance * dt * 15) {
        const r = Math.random();
        if (r < 0.40 && cpu.dodgeCooldown <= 0) {
          this.triggerDodge(cpuSide);
        } else if (r < 0.65 && incomingProj && cpu.grounded) {
          this.triggerJump(cpuSide);
        } else {
          this.cpuBlockTimer = 0.32 + Math.random() * 0.22;
          cpu.inputs.block = true;
        }
        return;
      }
    }

    this.cpuDecisionTimer -= dt;
    if (this.cpuDecisionTimer <= 0) {
      this.cpuDecisionTimer = cfg.reaction * (0.65 + Math.random() * 0.8);

      if (absDist > 260) this.cpuMoveIntent = Math.sign(dx);
      else if (absDist < 85) this.cpuMoveIntent = -Math.sign(dx);
      else this.cpuMoveIntent = Math.random() < 0.5 ? Math.sign(dx) : 0;

      // Fire Special Super when 100% charged!
      if (cpu.superMeter >= MAX_SUPER && Math.random() < 0.72) {
        this.triggerMove(cpuSide, 3);
        return;
      }

      if (Math.random() < cfg.aggro) {
        if (absDist > 210) {
          const farMoves = cpuSide === 'red' ? [0, 1] : [0, 2];
          this.triggerMove(cpuSide, farMoves[Math.floor(Math.random() * farMoves.length)]);
        } else {
          this.triggerMove(cpuSide, Math.floor(Math.random() * 3));
        }
      } else if (Math.random() < 0.14 && cpu.grounded) {
        this.triggerJump(cpuSide);
      }
    }

    cpu.inputs.left = this.cpuMoveIntent < 0;
    cpu.inputs.right = this.cpuMoveIntent > 0;
  }

  // ==========================
  // CAPCOM VFX HELPERS
  // ==========================
  _spawnSmear(x, y, dir, color, radius) {
    this.smears.push({ x, y, dir, color, radius, life: 0.18, maxLife: 0.18 });
  }

  _spawnHitSpark(x, y, color, size) {
    this.hitSparks.push({ x, y, color, size, rot: Math.random() * Math.PI, life: 0.20, maxLife: 0.20 });
  }

  _spawnShockwave(x, y, color, maxRadius) {
    this.shockwaves.push({ x, y, color, radius: 14, maxRadius, life: 0.28, maxLife: 0.28 });
  }

  _spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y - 4,
        vx: (Math.random() - 0.5) * 110,
        vy: -25 - Math.random() * 65,
        size: 5 + Math.random() * 7,
        color: 'rgba(255, 224, 240, 0.55)',
        shape: 'dust',
        rot: 0,
        life: 0.28 + Math.random() * 0.2,
        maxLife: 0.48,
      });
    }
  }

  _spawnAfterimage(f) {
    this.afterimages.push({
      x: f.x,
      y: f.y,
      isWifebun: f.side === 'red',
      facing: f.facing,
      rollAngle: f.rollAngle,
      color: f.side === 'red' ? 'rgba(255, 105, 180, 0.45)' : 'rgba(96, 165, 250, 0.45)',
      life: 0.26,
      maxLife: 0.26,
    });
  }

  _spawnMoveHitParticles(x, y, moveId, color) {
    if (moveId === 'forehead_kiss') {
      this._spawnSparks(x, y - 20, '#ff69b4', 18, 'heart');
      this._spawnSparks(x, y - 10, '#ffd479', 10, 'heart');
    } else if (moveId === 'dj_spin') {
      this._spawnSparks(x, y, '#ff69b4', 8, 'note');
      this._spawnSparks(x, y, '#38bdf8', 8, 'note');
    } else if (moveId === 'eyp_report') {
      this._spawnSparks(x, y, '#ffffff', 16, 'page');
      this._spawnSparks(x, y, '#3b82f6', 12, 'dot');
    } else if (moveId === 'coke_burp') {
      this._spawnSparks(x, y, '#8b4513', 12, 'bubble');
      this._spawnSparks(x, y, '#ffffff', 14, 'bubble');
    } else if (moveId === 'white_claw') {
      this._spawnSparks(x, y, '#e0f2fe', 14, 'bubble');
      this._spawnSparks(x, y, '#38bdf8', 12, 'dot');
    } else {
      this._spawnSparks(x, y, color, 16, 'dot');
      this._spawnSparks(x, y, '#ffd479', 8, 'heart');
    }
  }

  _spawnSparks(x, y, color, count, shape = 'dot') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (shape === 'bubble' || shape === 'heart' ? 110 : 60),
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
    this.callouts.push({ x, y, text, color, scale, life: 0.88, maxLife: 0.88 });
  }

  _updatePetals(dt) {
    for (const p of this.petals) {
      p.x += (p.vx + Math.sin(this.time * 1.4 + p.rot) * 14) * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
      if (p.y > H + 20) { p.y = -18; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 18;
    }
  }

  _updateVfx(dt) {
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      this.vfx[i].t += dt;
      if (this.vfx[i].t >= this.vfx[i].duration) this.vfx.splice(i, 1);
    }
  }

  _updateSmears(dt) {
    for (let i = this.smears.length - 1; i >= 0; i--) {
      this.smears[i].life -= dt;
      if (this.smears[i].life <= 0) this.smears.splice(i, 1);
    }
  }

  _updateHitSparks(dt) {
    for (let i = this.hitSparks.length - 1; i >= 0; i--) {
      this.hitSparks[i].life -= dt;
      if (this.hitSparks[i].life <= 0) this.hitSparks.splice(i, 1);
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

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.shape === 'dust') {
        p.size += dt * 16;
      } else {
        p.vy += (p.shape === 'bubble' || p.shape === 'heart' ? -90 : 620) * dt;
      }
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
      x: Math.round(f.x),
      y: Math.round(f.y),
      vx: Math.round(f.vx),
      vy: Math.round(f.vy),
      facing: f.facing,
      grounded: f.grounded,
      hp: Math.round(f.hp * 10) / 10,
      superMeter: Math.round(f.superMeter),
      blocking: f.blocking,
      dodgeTimer: f.dodgeTimer,
      rollAngle: f.rollAngle,
      move: f.move ? { index: f.move.index, id: f.move.id, phase: f.move.phase, isCounter: f.move.isCounter, isSuper: f.move.isSuper } : null,
      stunTimer: f.stunTimer,
      blushTimer: f.blushTimer,
      heartEyesTimer: f.heartEyesTimer,
      winkTimer: f.winkTimer,
      hitFlash: f.hitFlash,
      counterWindow: f.counterWindow,
      koState: f.koState,
      koFallProgress: f.koFallProgress,
      runCycle: f.runCycle,
      stretchH: f.stretchH,
      spinAngle: f.spinAngle,
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
      projectiles: this.projectiles.map((p) => ({
        kind: p.kind,
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(p.vx),
        rot: p.rot,
      })),
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

    Object.assign(this.red, s.red);
    Object.assign(this.blue, s.blue);
    this.projectiles = (s.projectiles || []).map((p) => ({ ...p }));

    if (prevPhase !== this.phase || prevRound !== this.round) {
      if (this.phase === 'intro') {
        this._emitBanner(`ROUND ${this.round}`, '🌸 MOONLIT ROMANCE DUEL 🌸');
        sound.playBell();
      } else if (this.phase === 'fighting') {
        this._emitBanner(null);
      } else if (this.phase === 'ko') {
        const redWon = this.blue.koState;
        this._emitBanner('K.O.! 💕', redWon ? 'WIFEBUN WINS THE ROUND!' : 'HUSBUN WINS THE ROUND!');
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
    if (ev.kind === 'super_freeze') {
      this.superFreeze = { side: ev.side, title: ev.title, color: ev.color, timer: 0.52, maxTimer: 0.52 };
      sound.playSuperFreeze();
    } else if (ev.kind === 'move_start') {
      sound.playMove(ev.moveId);
      if (ev.moveId === 'height_mog') this.dramaticDim = 0.48;
      if (['height_mog', 'dj_spin', 'coke_burp', 'white_claw', 'forehead_kiss'].includes(ev.moveId)) {
        this.vfx.push({ kind: ev.moveId, side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.48 });
      }
    } else if (ev.kind === 'dodge') {
      sound.playDodge();
      this._spawnAfterimage(ev.side === 'red' ? this.red : this.blue);
    } else if (ev.kind === 'perfect_dodge') {
      sound.playPerfectDodge();
      this._spawnShockwave(ev.x, ev.y, '#c084fc', 120);
      this._spawnSparks(ev.x, ev.y, '#e9d5ff', 14, 'heart');
      this._spawnCallout(ev.x, ev.y - 44, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 42);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 74);
      this._spawnCallout(ev.x, ev.y - 40, 'GUARD! +SUPER ✨', '#ffd479', 0.84);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter);
      this.shake = ev.counter ? 15 : ev.heavy ? 10 : 6;
      this._spawnHitSpark(ev.x, ev.y, ev.color, ev.heavy ? 64 : 46);
      this._spawnShockwave(ev.x, ev.y, ev.counter ? '#ffd479' : ev.color, ev.heavy ? 120 : 84);
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 38, ev.word, ev.counter ? '#ffd479' : ev.color, 0.96);
      if (ev.combo >= 2) {
        this._spawnCallout(ev.x, ev.y - 84, `${ev.combo} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.84);
      }
    } else if (ev.kind === 'ko') {
      sound.playKO();
      this.shake = 22;
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 96);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 200);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 28, 'heart');
      this._spawnCallout(ev.x, ev.y - 50, 'K.O.!! 💕', '#ffd479', 1.55);
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
        red: { hp: this.red.hp, superMeter: this.red.superMeter, roundsWon: this.red.roundsWon },
        blue: { hp: this.blue.hp, superMeter: this.blue.superMeter, roundsWon: this.blue.roundsWon },
      });
    }
  }

  // ==========================
  // RENDERING — CAPCOM CEL-SHADED ROMANTIC FIGHTER!
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();

    this._drawParallaxSky(ctx);

    ctx.save();
    ctx.translate(W / 2, H * 0.56);
    ctx.scale(this.camZoom, this.camZoom);
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.translate(-this.camX, -H * 0.56);

    this._drawMidgroundGarden(ctx);
    this._drawBoardwalkFloor(ctx);

    if (this.dramaticDim > 0.02 || this.superFreeze) {
      ctx.fillStyle = `rgba(14, 4, 22, ${this.superFreeze ? 0.62 : this.dramaticDim})`;
      ctx.fillRect(0, 0, STAGE_W, H);
    }

    this._drawAfterimages(ctx);

    const redOnTop = Boolean(this.red.move && this.red.move.phase === 'active');
    if (redOnTop) {
      this._drawHusbunCapcom(ctx, this.blue);
      this._drawWifebunCapcom(ctx, this.red);
    } else {
      this._drawWifebunCapcom(ctx, this.red);
      this._drawHusbunCapcom(ctx, this.blue);
    }

    this._drawSmears(ctx);
    this._drawProjectiles(ctx);
    this._drawVfx(ctx);
    this._drawShockwaves(ctx);
    this._drawHitSparks(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore();

    // Screen-space petals
    this._drawPetals(ctx);

    // Capcom Super-Freeze Dramatic Cut-In Overlay!
    if (this.superFreeze) {
      this._drawSuperFreezeOverlay(ctx, this.superFreeze);
    }

    ctx.restore();
  }

  _drawSuperFreezeOverlay(ctx, sf) {
    const p = 1 - sf.timer / sf.maxTimer;
    ctx.save();
    // Radiating anime speed lines
    ctx.translate(W * 0.5, H * 0.48);
    ctx.strokeStyle = sf.side === 'red' ? 'rgba(255, 119, 186, 0.35)' : 'rgba(96, 165, 250, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + this.time * 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 140, Math.sin(a) * 140);
      ctx.lineTo(Math.cos(a) * 620, Math.sin(a) * 620);
      ctx.stroke();
    }

    // Diagonal Capcom Super Banner!
    ctx.rotate(-0.08);
    const bandH = 92;
    const grad = ctx.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, 'rgba(24, 6, 30, 0.92)');
    grad.addColorStop(0.5, sf.side === 'red' ? 'rgba(225, 45, 130, 0.92)' : 'rgba(30, 90, 215, 0.92)');
    grad.addColorStop(1, 'rgba(24, 6, 30, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 4;
    ctx.strokeRect(-W, -bandH / 2, W * 2, bandH);

    const slideX = (1 - Math.min(1, p * 4)) * (sf.side === 'red' ? -240 : 240);
    ctx.font = `700 54px 'Bangers', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#18061a';
    const text = `★ ${sf.title} ★`;
    ctx.strokeText(text, slideX, 18);
    ctx.fillStyle = '#ffd479';
    ctx.fillText(text, slideX, 18);
    ctx.restore();
  }

  _drawParallaxSky(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1c0a24');
    sky.addColorStop(0.45, '#431742');
    sky.addColorStop(0.78, '#7a2c57');
    sky.addColorStop(1, '#260d24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const moonX = W * 0.52 - (this.camX - STAGE_W * 0.5) * 0.08;
    const moonY = 104;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 26, moonX, moonY, 165);
    moonGlow.addColorStop(0, 'rgba(255, 245, 225, 0.98)');
    moonGlow.addColorStop(0.24, 'rgba(255, 224, 195, 0.55)');
    moonGlow.addColorStop(0.6, 'rgba(255, 130, 190, 0.16)');
    moonGlow.addColorStop(1, 'rgba(255, 119, 186, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 165, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 36; i++) {
      const sx = (((i * 173) - (this.camX - STAGE_W * 0.5) * 0.05) % W + W) % W;
      const sy = 16 + ((i * 47) % 210);
      const tw = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + i));
      ctx.fillStyle = i % 3 === 0 ? `rgba(255, 220, 140, ${tw})` : `rgba(255, 210, 236, ${tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 5 === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const offsetFar = -(this.camX - STAGE_W * 0.5) * 0.22;
    ctx.save();
    ctx.translate(offsetFar, 0);

    const waterGrad = ctx.createLinearGradient(0, 315, 0, 420);
    waterGrad.addColorStop(0, '#3a153a');
    waterGrad.addColorStop(1, '#1e0b22');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(-300, 315, W + 600, 130);

    for (let r = 0; r < 8; r++) {
      const rw = 85 - r * 7 + Math.sin(this.time * 3 + r) * 8;
      ctx.fillStyle = `rgba(255, 224, 185, ${0.24 - r * 0.025})`;
      ctx.fillRect(moonX - offsetFar - rw / 2, 326 + r * 10, rw, 3.5);
    }

    ctx.fillStyle = '#240c29';
    const buildings = [
      [-180, 70], [-100, 95], [-10, 60], [60, 110], [160, 75], [250, 90],
      [620, 88], [710, 112], [810, 68], [890, 96], [980, 78], [1070, 90],
    ];
    buildings.forEach(([bx, bh]) => {
      ctx.fillRect(bx, 320 - bh, 64, bh);
      ctx.fillStyle = 'rgba(255, 212, 121, 0.45)';
      for (let wy = 320 - bh + 12; wy < 312; wy += 16) {
        ctx.fillRect(bx + 12, wy, 6, 7);
        ctx.fillRect(bx + 36, wy, 6, 7);
      }
      ctx.fillStyle = '#240c29';
    });

    ctx.beginPath();
    ctx.moveTo(430, 320);
    ctx.quadraticCurveTo(465, 230, 480, 168);
    ctx.quadraticCurveTo(495, 230, 530, 320);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawMidgroundGarden(ctx) {
    const treePositions = [180, 520, 960, 1300];
    treePositions.forEach((tx, idx) => {
      const sway = Math.sin(this.time * 1.3 + idx * 1.4) * 5;
      ctx.strokeStyle = '#3b1c26';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, GROUND_Y);
      ctx.quadraticCurveTo(tx - 10, GROUND_Y - 110, tx + sway, GROUND_Y - 210);
      ctx.stroke();

      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(tx + sway * 0.5, GROUND_Y - 140);
      ctx.lineTo(tx - 65 + sway, GROUND_Y - 195);
      ctx.moveTo(tx + sway * 0.5, GROUND_Y - 155);
      ctx.lineTo(tx + 72 + sway, GROUND_Y - 205);
      ctx.stroke();

      const blossoms = [
        [tx + sway, GROUND_Y - 235, 68, '#ff99cc'],
        [tx - 58 + sway, GROUND_Y - 205, 52, '#ffb8dc'],
        [tx + 60 + sway, GROUND_Y - 210, 54, '#ff85c0'],
        [tx - 20 + sway, GROUND_Y - 255, 48, '#ffd4e8'],
      ];
      blossoms.forEach(([bx, by, br, col]) => {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    const postXs = [100, 420, 740, 1060, 1380];
    postXs.forEach((px) => {
      ctx.fillStyle = '#36172a';
      ctx.fillRect(px - 6, GROUND_Y - 240, 12, 240);
      ctx.fillStyle = '#ffd479';
      ctx.shadowColor = '#ffd479';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(px - 10, GROUND_Y - 226, 20, 24, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    for (let i = 0; i < postXs.length - 1; i++) {
      const x1 = postXs[i];
      const x2 = postXs[i + 1];
      const mx = (x1 + x2) * 0.5;
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, GROUND_Y - 234);
      ctx.quadraticCurveTo(mx, GROUND_Y - 178, x2, GROUND_Y - 234);
      ctx.stroke();

      for (let b = 1; b <= 6; b++) {
        const t = b / 7;
        const bx = x1 + (x2 - x1) * t;
        const by = (1 - t) * (1 - t) * (GROUND_Y - 234) + 2 * (1 - t) * t * (GROUND_Y - 178) + t * t * (GROUND_Y - 234);
        const glow = 0.65 + 0.35 * Math.sin(this.time * 3.2 + b + i);
        ctx.fillStyle = b % 2 === 0 ? `rgba(255, 224, 140, ${glow})` : `rgba(255, 145, 205, ${glow})`;
        ctx.shadowColor = b % 2 === 0 ? '#ffd479' : '#ff77ba';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = 'rgba(60, 24, 48, 0.85)';
    ctx.fillRect(0, GROUND_Y - 42, STAGE_W, 7);
    for (let rx = 20; rx < STAGE_W; rx += 56) {
      ctx.fillRect(rx, GROUND_Y - 42, 6, 42);
    }
  }

  _drawBoardwalkFloor(ctx) {
    const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H + 60);
    floorGrad.addColorStop(0, '#592944');
    floorGrad.addColorStop(0.25, '#3b1830');
    floorGrad.addColorStop(1, '#1a0818');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GROUND_Y, STAGE_W, H - GROUND_Y + 80);

    ctx.fillStyle = 'rgba(255, 212, 165, 0.35)';
    ctx.fillRect(0, GROUND_Y, STAGE_W, 4);

    ctx.strokeStyle = 'rgba(20, 6, 20, 0.45)';
    ctx.lineWidth = 2;
    for (let px = 0; px <= STAGE_W; px += 64) {
      ctx.beginPath();
      ctx.moveTo(px, GROUND_Y);
      ctx.lineTo(px + (px - STAGE_W * 0.5) * 0.12, H + 40);
      ctx.stroke();
    }

    this._drawHeart(ctx, STAGE_W * 0.5, GROUND_Y + 32, 18, 'rgba(255, 130, 195, 0.35)');
  }

  // ==========================================================
  // CAPCOM / STREET FIGHTER CEL-SHADED RIG 1: WIFEBUN
  // Alluring, flirty, expressive caramel-brown bunny fighter!
  // ==========================================================
  _drawWifebunCapcom(ctx, f) {
    const dir = f.facing;
    const furBase = '#b87a4e';
    const furHi = '#e3ad82';
    const furShade = '#7e4b28';
    const ink = '#29121e';
    const silkPink = '#ff5ca8';
    const silkDark = '#b81d68';
    const cream = '#fff1e8';

    // Capcom-style rhythmic martial-arts bounce + flirty hip sway!
    const t = this.time * 5.8;
    const isMoving = Math.abs(f.vx) > 25 && f.grounded && !f.move;
    const stride = Math.sin(f.runCycle);
    const hipSway = isMoving ? stride * 5 : Math.sin(t) * 4.5;
    const bounceY = f.koState
      ? 16 * f.koFallProgress
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8
      : Math.sin(t * 2) * 3.2;

    const isAttacking = Boolean(f.move && f.move.phase === 'active');
    const isWindup = Boolean(f.move && f.move.phase === 'windup');

    ctx.save();
    ctx.translate(f.x, f.y);

    // Dynamic ground shadow
    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - f.y + 4, 38 * airScale, 10 * airScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    // Golden-rose aura when Super 100% or Counter-Ready
    if ((f.counterWindow > 0 || f.superMeter >= MAX_SUPER) && !f.koState) {
      ctx.save();
      ctx.strokeStyle = f.counterWindow > 0 ? 'rgba(255, 212, 121, 0.92)' : 'rgba(255, 119, 186, 0.65)';
      ctx.lineWidth = f.counterWindow > 0 ? 4.5 : 3;
      ctx.shadowColor = f.counterWindow > 0 ? '#ffd479' : '#ff69b4';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(0, -64, 46, 72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, bounceY);
    if (f.rollAngle !== 0) {
      ctx.translate(0, -56);
      ctx.rotate(f.rollAngle);
      ctx.translate(0, 56);
    }

    ctx.scale(dir * f.squashX, f.squashY);

    if (f.spinAngle !== 0) {
      const sx = Math.cos(f.spinAngle);
      ctx.scale(Math.abs(sx) < 0.28 ? 0.28 : sx, 1);
    }

    if (f.koState) {
      ctx.translate(0, 18 * f.koFallProgress);
      ctx.rotate(-0.46 * f.koFallProgress);
    }

    // === 2-SEGMENT ARTICULATED LEGS (thigh + calf + thigh-high stockings + heeled boots) ===
    const backHipA = f.koState ? 0.85 : !f.grounded ? 0.45 : isMoving ? -stride * 0.65 : -0.26;
    const backKneeA = f.koState ? 0.4 : !f.grounded ? 0.7 : isMoving ? Math.max(0, stride * 0.75) : 0.24;
    const frontHipA = f.koState ? 1.05 : !f.grounded ? -0.35 : isAttacking && f.move.id === 'pear_bounce' ? -1.1 : isMoving ? stride * 0.65 : 0.24;
    const frontKneeA = f.koState ? 0.35 : !f.grounded ? 0.85 : isMoving ? Math.max(0, -stride * 0.75) : 0.14;

    this._drawSculptedFemLeg(ctx, -6 + hipSway * 0.3, -46, backHipA, backKneeA, furShade, '#f0d6e4', silkDark, ink);

    // === FLUFFY COTTON TAIL (sways with hips!) ===
    ctx.fillStyle = '#fff5f0';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-22 + hipSway * 0.6, -48 + Math.sin(t * 2) * 2, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // === BACK ARM (2-segment articulated!) ===
    const backShA = f.blocking ? -1.15 : isAttacking ? -0.8 : isWindup ? 0.7 : -0.5 + Math.sin(t) * 0.15;
    const backElA = f.blocking ? -1.1 : -0.7;
    this._drawSculptedFemArm(ctx, 10, -82, backShA, backElA, furShade, silkDark, ink);

    // === SCULPTED CURVY FEMININE TORSO & OFF-SHOULDER SILK TOP ===
    ctx.save();
    ctx.translate(hipSway * 0.35, 0);
    ctx.rotate(isAttacking ? 0.14 : isWindup ? -0.14 : Math.sin(t) * 0.045);

    // Slender caramel waist & curves
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : furBase;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-12, -88);
    ctx.bezierCurveTo(-17, -72, -10, -60, -13, -48);
    ctx.lineTo(15, -48);
    ctx.bezierCurveTo(13, -60, 19, -74, 14, -88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Romantic blush-rose off-shoulder crop top with satin sheen!
    const topGrad = ctx.createLinearGradient(-16, -88, 16, -62);
    topGrad.addColorStop(0, '#ffd4e8');
    topGrad.addColorStop(0.45, silkPink);
    topGrad.addColorStop(1, silkDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : topGrad;
    ctx.beginPath();
    ctx.moveTo(-15, -84);
    ctx.quadraticCurveTo(2, -90, 17, -82);
    ctx.quadraticCurveTo(19, -70, 14, -64);
    ctx.quadraticCurveTo(0, -61, -14, -65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Little gold heart pendant at neckline
    this._drawHeart(ctx, 4, -77, 4.5, '#ffd479');

    // === FLOWING PLEATED MINI-SKIRT (dynamic sway!) ===
    const skirtSway = hipSway * 0.9 - f.vx * 0.015;
    const skirtGrad = ctx.createLinearGradient(-24, -54, 24, -28);
    skirtGrad.addColorStop(0, '#ff85c0');
    skirtGrad.addColorStop(0.55, silkPink);
    skirtGrad.addColorStop(1, silkDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : skirtGrad;
    ctx.beginPath();
    ctx.moveTo(-14, -52);
    ctx.lineTo(15, -52);
    ctx.quadraticCurveTo(22 + skirtSway * 0.5, -39, 27 + skirtSway, -28);
    ctx.quadraticCurveTo(2 + skirtSway * 0.4, -24, -25 + skirtSway, -29);
    ctx.quadraticCurveTo(-19 + skirtSway * 0.5, -40, -14, -52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Satin ribbon sash & bow at waist
    ctx.fillStyle = cream;
    ctx.fillRect(-14, -54, 29, 5);
    ctx.strokeStyle = 'rgba(255, 224, 242, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, -49); ctx.lineTo(-10 + skirtSway * 0.7, -28);
    ctx.moveTo(4, -49); ctx.lineTo(6 + skirtSway * 0.7, -27);
    ctx.stroke();

    // === FRONT LEG ===
    ctx.restore();
    this._drawSculptedFemLeg(ctx, 6 + hipSway * 0.3, -46, frontHipA, frontKneeA, furBase, cream, silkPink, ink);

    // === EXPRESSIVE FLIRTY CARAMEL BUNNY HEAD ===
    ctx.save();
    ctx.translate(3 + hipSway * 0.4, -108 + (f.stunTimer > 0 ? 4 : 0));
    ctx.rotate(f.stunTimer > 0 ? -0.22 : isAttacking ? 0.14 : Math.sin(t) * 0.055);

    // Multi-segment graceful flowing bunny ears!
    const earSway = Math.sin(this.time * 5.6) * 0.08 + f.earLag;
    this._drawCapcomEar(ctx, -11, -18, -0.68 + earSway, 10, 40, furShade, '#ffa3d0', ink, true);
    this._drawCapcomEar(ctx, 4, -21, -0.16 - earSway * 0.6, 10.5, 42, furBase, '#ffb8dc', ink, false);

    // Satin rose bow on front ear
    ctx.save();
    ctx.translate(8, -32);
    ctx.fillStyle = '#ff3e9d';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-9, 0, 9, 5.2, -0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(9, 0, 9, 5.2, 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe3f1';
    ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Sculpted cel-shaded bunny head with warm moonlight rim highlight!
    const headGrad = ctx.createRadialGradient(-5, -8, 4, 0, 0, 28);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.62, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24.5, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Silky bangs tuft
    ctx.fillStyle = furHi;
    ctx.beginPath();
    ctx.moveTo(-6, -18);
    ctx.quadraticCurveTo(6, -24, 16, -14);
    ctx.quadraticCurveTo(6, -13, -6, -18);
    ctx.fill();

    // DJ Headphones on DJ Spin!
    if (f.move && f.move.id === 'dj_spin') {
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(0, -3, 28, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.roundRect(-30, -9, 8.5, 18, 4); ctx.roundRect(21.5, -9, 8.5, 18, 4); ctx.fill();
    }

    // Muzzle & tiny pink nose
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(12, 7.5, 10.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5ca8';
    ctx.beginPath(); ctx.arc(15.5, 4.2, 3.2, 0, Math.PI * 2); ctx.fill();

    // Warm rosy blush cheeks (bright glow when Forehead Kissed!)
    ctx.fillStyle = f.blushTimer > 0 ? 'rgba(255, 50, 128, 0.85)' : 'rgba(255, 118, 178, 0.56)';
    ctx.beginPath();
    ctx.ellipse(2, 7.5, f.blushTimer > 0 ? 8.5 : 6.2, f.blushTimer > 0 ? 5 : 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Expressive glossy lips / smile / kissy pout!
    ctx.strokeStyle = '#4d1e2b';
    ctx.lineWidth = 1.9;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#632814';
      ctx.beginPath(); ctx.arc(15, 10.5, 5.2, 0, Math.PI * 2); ctx.fill();
    } else if (f.winkTimer > 0 || f.heartEyesTimer > 0) {
      // Flirty rosy kiss-pout!
      ctx.fillStyle = '#ff5ca8';
      ctx.beginPath(); ctx.arc(14.5, 10, 3.3, 0, Math.PI * 2); ctx.fill();
    } else if (f.koState) {
      ctx.beginPath(); ctx.arc(13, 11, 3.2, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(9.5, 9.5);
      ctx.quadraticCurveTo(14.5, 13, 19, 9);
      ctx.stroke();
    }

    // Allure / Flirty Eyes (Wink, Heart Eyes, Half-Lidded Sultry Sparkle!)
    const isBlinking = !f.koState && (this.time % 3.6) > 3.46;
    if (f.koState) {
      ctx.strokeStyle = '#ffd479';
      ctx.lineWidth = 2.6;
      [5, 16].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, -6); ctx.lineTo(ex + 3, 0); ctx.moveTo(ex + 3, -6); ctx.lineTo(ex - 3, 0); ctx.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 24, -30 + Math.sin(a) * 6, 6, '#ff77ba');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [5, 16].forEach((ex) => this._drawHeart(ctx, ex, -3, 6.4, '#ff4d9e'));
    } else {
      [5, 16].forEach((ex, idx) => {
        const winkThisEye = f.winkTimer > 0 && idx === 1;
        if (isBlinking || winkThisEye) {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(ex, -2, 4.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          // Curved wink lash
          ctx.beginPath(); ctx.moveTo(ex - 4, -2); ctx.lineTo(ex - 7.5, -5); ctx.stroke();
        } else {
          const rx = idx === 0 ? 5.2 : 4.4;
          const ry = 5.4;
          // White sclera + deep glossy brown/amber iris
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(ex, -3, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3b1814';
          ctx.beginPath(); ctx.ellipse(ex + 0.8, -2.6, rx * 0.72, ry * 0.78, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ff99cc';
          ctx.beginPath(); ctx.arc(ex + 0.6, -0.5, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex + 1.8, -5.2, 2.0, 0, Math.PI * 2); ctx.fill();
          // Sultry winged upper eyelid & curved lashes!
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(ex, -3.5, rx + 0.6, Math.PI * 1.05, Math.PI * 1.95);
          ctx.stroke();
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(ex - rx, -4.5); ctx.lineTo(ex - rx - 4, -8);
          ctx.moveTo(ex - 1, -8); ctx.lineTo(ex - 3.5, -11);
          ctx.stroke();
        }
      });
    }

    ctx.restore(); // head

    // === FRONT ARM (flirty beckon in idle, crisp strike extension on moves!) ===
    const fShA = f.blocking ? -1.35 : isAttacking ? -0.22 : isWindup ? 1.1 : 0.28 + Math.sin(t) * 0.14;
    const fElA = f.blocking ? -1.05 : isAttacking ? 0.05 : isWindup ? -0.9 : -0.85 - Math.sin(t) * 0.18;
    this._drawSculptedFemArm(ctx, -4 + hipSway * 0.3, -82, fShA, fElA, furBase, silkPink, ink, isAttacking);

    // Guard Rose-Gold Shield
    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(30, -70, 38, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawSculptedFemLeg(ctx, x, y, hipA, kneeA, furCol, stockingCol, bootCol, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);
    // Sculpted thigh (caramel fur + cream thigh-high stocking with rose garter!)
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-6.5, -2, 13, 24, 6);
    ctx.fill();
    ctx.stroke();

    // Knee joint -> Calf (cream stocking + chic rose fighter boot!)
    ctx.translate(0, 21);
    ctx.rotate(kneeA);
    ctx.fillStyle = stockingCol;
    ctx.beginPath();
    ctx.roundRect(-5, -2, 10, 23, 5);
    ctx.fill();
    ctx.stroke();
    // Cute pink garter ribbon band at top of stocking
    ctx.fillStyle = bootCol;
    ctx.fillRect(-5.5, -3, 11, 4);

    // Chic heeled fighter boot
    ctx.fillStyle = bootCol;
    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(13, 24);
    ctx.lineTo(-6, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawSculptedFemArm(ctx, x, y, shA, elA, furCol, gloveCol, ink, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-4, -4.5, 22, 9, 4.5);
    ctx.fill();
    ctx.stroke();

    ctx.translate(18, 0);
    ctx.rotate(elA);
    const fLen = extended ? 24 : 18;
    ctx.beginPath();
    ctx.roundRect(-3, -4, fLen, 8, 4);
    ctx.fill();
    ctx.stroke();

    // Fingerless satin pink glove & cuff
    ctx.fillStyle = gloveCol;
    ctx.beginPath();
    ctx.arc(fLen + 2, 0, extended ? 9.5 : 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ==========================================================
  // CAPCOM / STREET FIGHTER CEL-SHADED RIG 2: HUSBUN
  // Tall, suave, sculpted muscular espresso-brown bunny fighter!
  // ==========================================================
  _drawHusbunCapcom(ctx, f) {
    const dir = f.facing;
    const furBase = '#6b4125';
    const furHi = '#96623d';
    const furShade = '#422411';
    const ink = '#1e0e14';
    const vestMain = '#1b3464';
    const vestShade = '#102042';
    const gold = '#ffd479';

    const t = this.time * 5.0 + 1.4;
    const isMoving = Math.abs(f.vx) > 25 && f.grounded && !f.move;
    const stride = Math.sin(f.runCycle);
    const bounceY = f.koState
      ? 18 * f.koFallProgress
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8
      : Math.sin(t * 2) * 2.8;

    const isAttacking = Boolean(f.move && f.move.phase === 'active');
    const isWindup = Boolean(f.move && f.move.phase === 'windup');

    ctx.save();
    ctx.translate(f.x, f.y);

    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.44)';
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - f.y + 4, 44 * airScale, 10.5 * airScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    if ((f.counterWindow > 0 || f.superMeter >= MAX_SUPER) && !f.koState) {
      ctx.save();
      ctx.strokeStyle = f.counterWindow > 0 ? 'rgba(255, 212, 121, 0.92)' : 'rgba(96, 165, 250, 0.70)';
      ctx.lineWidth = f.counterWindow > 0 ? 4.5 : 3;
      ctx.shadowColor = f.counterWindow > 0 ? '#ffd479' : '#60a5fa';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(0, -76, 56, 86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, bounceY);
    if (f.rollAngle !== 0) {
      ctx.translate(0, -62);
      ctx.rotate(f.rollAngle);
      ctx.translate(0, 62);
    }

    ctx.scale(dir * f.squashX, f.squashY);

    if (f.koState) {
      ctx.translate(0, 20 * f.koFallProgress);
      ctx.rotate(-0.48 * f.koFallProgress);
    }

    // === 2-SEGMENT ATHLETIC MASCULINE LEGS ===
    const backHipA = f.koState ? 0.85 : !f.grounded ? 0.45 : isMoving ? -stride * 0.65 : -0.32;
    const backKneeA = f.koState ? 0.4 : !f.grounded ? 0.65 : isMoving ? Math.max(0, stride * 0.75) : 0.30;
    const frontHipA = f.koState ? 1.05 : !f.grounded ? -0.32 : isMoving ? stride * 0.65 : 0.28;
    const frontKneeA = f.koState ? 0.35 : !f.grounded ? 0.78 : isMoving ? Math.max(0, -stride * 0.75) : 0.16;

    this._drawSculptedMascLeg(ctx, -9, -56, backHipA, backKneeA, '#142347', '#1d4ed8', ink);

    // Masculine cotton tail
    ctx.fillStyle = '#e8d2bc';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-26, -58, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // === BACK MUSCULAR ARM ===
    const torsoH = 56 + f.stretchH;
    const torsoTop = -56 - torsoH;

    const backShA = f.blocking ? -1.15 : isAttacking ? -0.85 : isWindup ? 0.75 : -0.42 + Math.sin(t) * 0.12;
    const backElA = f.blocking ? -1.15 : -0.95;
    this._drawSculptedMascArm(ctx, 14, torsoTop + 14, backShA, backElA, furShade, '#dbeafe', ink);

    // === BROAD SCULPTED V-TAPER MASCULINE TORSO & OPEN-COLLAR FIGHTING VEST ===
    ctx.save();
    ctx.rotate(isAttacking ? 0.15 : isWindup ? -0.14 : Math.sin(t) * 0.035);

    // Sculpted brown chest fur visible in the open V-collar!
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : furBase;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-25, torsoTop);
    ctx.lineTo(27, torsoTop);
    ctx.lineTo(19, -54);
    ctx.lineTo(-19, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fitted midnight-navy velvet fighting vest panels + gold lapels
    const vestGrad = ctx.createLinearGradient(-26, torsoTop, 26, -54);
    vestGrad.addColorStop(0, '#2a4d8f');
    vestGrad.addColorStop(0.5, vestMain);
    vestGrad.addColorStop(1, vestShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : vestGrad;
    ctx.beginPath();
    ctx.moveTo(-26, torsoTop);
    ctx.lineTo(-8, torsoTop);
    ctx.lineTo(2, torsoTop + 26);
    ctx.lineTo(13, torsoTop);
    ctx.lineTo(27, torsoTop);
    ctx.lineTo(20, -52);
    ctx.lineTo(-20, -52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold collar lapel trim & belt buckle
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-8, torsoTop); ctx.lineTo(2, torsoTop + 26); ctx.lineTo(13, torsoTop);
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(-20, -58, 40, 6);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-7, -59, 14, 8);

    ctx.restore();

    // === FRONT LEG ===
    this._drawSculptedMascLeg(ctx, 9, -56, frontHipA, frontKneeA, '#1e3566', '#2563eb', ink);

    // === SUAVE MASCULINE ESPRESSO BUNNY HEAD ===
    ctx.save();
    ctx.translate(4, torsoTop - 24 + (f.stunTimer > 0 ? 4 : 0));
    ctx.rotate(f.stunTimer > 0 ? -0.20 : isAttacking ? 0.14 : Math.sin(t) * 0.04);

    // Tall upright rugged masculine bunny ears
    const earSway = Math.sin(this.time * 5.0 + 1.2) * 0.05 + f.earLag;
    this._drawCapcomEar(ctx, -10, -22, -0.18 + earSway, 10, 44, furShade, '#b88569', ink, false);
    this._drawCapcomEar(ctx, 7, -23, 0.10 - earSway * 0.6, 10, 42, furBase, '#c99679', ink, true);

    // Structured walnut-brown head with defined jawline
    const headGrad = ctx.createRadialGradient(-4, -8, 4, 0, 0, 30);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.65, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-24, -24, 48, 46, 17);
    ctx.fill();
    ctx.stroke();

    // Flowing navy & gold headband + dynamic ribbon tails!
    ctx.fillStyle = '#2563eb';
    ctx.beginPath(); ctx.roundRect(-25, -18, 50, 9, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(-24, -15, 48, 2.8);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, -14);
    ctx.quadraticCurveTo(-36, -12 + Math.sin(this.time * 10) * 5, -46, -4 + Math.cos(this.time * 10) * 4);
    ctx.stroke();

    // Anime glasses glint on EYP Report!
    if (f.move && f.move.id === 'eyp_report') {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.roundRect(2, -9, 21, 11, 3); ctx.stroke();
    }

    // Muzzle & dark cocoa nose
    ctx.fillStyle = '#e8cfb6';
    ctx.beginPath(); ctx.ellipse(13, 8, 11.5, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b2012';
    ctx.beginPath(); ctx.ellipse(17.5, 5, 4, 2.8, 0, 0, Math.PI * 2); ctx.fill();

    // Suave confident half-smirk (or kissy lips on Forehead Kiss!)
    ctx.strokeStyle = '#2e160a';
    ctx.lineWidth = 2.2;
    if (f.move && f.move.id === 'forehead_kiss') {
      ctx.fillStyle = '#ff4d9e';
      ctx.beginPath(); ctx.arc(17.5, 11, 3.8, 0, Math.PI * 2); ctx.fill();
    } else if (f.koState) {
      ctx.beginPath(); ctx.arc(14, 12, 3.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(9, 10.5);
      ctx.quadraticCurveTo(15.5, 13.5, 21, 8.5);
      ctx.stroke();
    }

    // Smoldering confident eyes + strong masculine brows!
    const isBlinking = !f.koState && ((this.time + 1.8) % 3.8) > 3.66;
    if (f.koState) {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2.6;
      [6, 17].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, -6); ctx.lineTo(ex + 3, 0); ctx.moveTo(ex + 3, -6); ctx.lineTo(ex - 3, 0); ctx.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 24, -32 + Math.sin(a) * 6, 6, '#60a5fa');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [6, 17].forEach((ex) => this._drawHeart(ctx, ex, -3, 6, '#ff69b4'));
    } else if (isBlinking) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      [6, 17].forEach((ex) => { ctx.beginPath(); ctx.moveTo(ex - 4, -3); ctx.lineTo(ex + 4, -3); ctx.stroke(); });
    } else {
      [6, 17].forEach((ex, idx) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(ex, -3, idx === 0 ? 4.6 : 4, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f1008';
        ctx.beginPath(); ctx.arc(ex + 0.8, -3, idx === 0 ? 3.2 : 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex + 1.5, -4.3, 1.3, 0, Math.PI * 2); ctx.fill();
        // Confident slanted brows
        ctx.strokeStyle = '#241208';
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(ex - 5.5, -8.5); ctx.lineTo(ex + 5.5, -6.5); ctx.stroke();
      });
    }

    ctx.restore(); // head

    // === FRONT MUSCULAR ARM (suave martial-arts beckon in idle!) ===
    const fShA = f.blocking ? -1.35 : isAttacking ? -0.15 : isWindup ? 1.05 : 0.25 + Math.sin(t) * 0.10;
    const fElA = f.blocking ? -1.1 : isAttacking ? 0.05 : isWindup ? -0.9 : -1.05 + Math.sin(t * 2) * 0.16;
    this._drawSculptedMascArm(ctx, -6, torsoTop + 14, fShA, fElA, furBase, '#f8fafc', ink, isAttacking);

    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(34, -84, 42, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawSculptedMascLeg(ctx, x, y, hipA, kneeA, pantCol, shoeCol, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);
    ctx.fillStyle = pantCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-8, -2, 16, 30, 6);
    ctx.fill();
    ctx.stroke();
    // Gold athletic side stripe
    ctx.fillStyle = '#ffd479';
    ctx.fillRect(-1.5, 2, 3, 24);

    ctx.translate(0, 26);
    ctx.rotate(kneeA);
    ctx.fillStyle = pantCol;
    ctx.beginPath();
    ctx.roundRect(-7, -2, 14, 26, 5);
    ctx.fill();
    ctx.stroke();

    // High-top athletic fighter sneaker
    ctx.fillStyle = shoeCol;
    ctx.beginPath();
    ctx.roundRect(-8, 20, 24, 13, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, 29, 24, 4);
    ctx.restore();
  }

  _drawSculptedMascArm(ctx, x, y, shA, elA, furCol, wrapCol, ink, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    // Muscular bicep
    ctx.beginPath();
    ctx.roundRect(-5, -6.5, 26, 13, 6.5);
    ctx.fill();
    ctx.stroke();

    ctx.translate(21, 0);
    ctx.rotate(elA);
    const fLen = extended ? 28 : 22;
    ctx.beginPath();
    ctx.roundRect(-4, -5.5, fLen, 11, 5);
    ctx.fill();
    ctx.stroke();

    // Taped fighter hand-wraps
    ctx.fillStyle = wrapCol;
    ctx.beginPath();
    ctx.arc(fLen + 3, 0, extended ? 11.5 : 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(fLen - 5, -5); ctx.lineTo(fLen - 5, 5); ctx.stroke();
    ctx.restore();
  }

  _drawCapcomEar(ctx, x, y, angle, rx, ry, outerCol, innerCol, ink, softTip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = outerCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.5, rx, ry * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = innerCol;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.48, rx * 0.50, ry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    if (softTip) {
      ctx.fillStyle = outerCol;
      ctx.beginPath();
      ctx.ellipse(rx * 0.52, -ry * 0.92, rx * 0.78, rx * 0.55, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==========================
  // CAPCOM SMEAR ARCS, HIT SPARKS, PROJECTILES & VFX
  // ==========================
  _drawSmears(ctx) {
    for (const s of this.smears) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.dir, 1);
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 14 * alpha;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, -1.15, 0.95);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius - 4, -0.95, 0.75);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawHitSparks(ctx) {
    for (const h of this.hitSparks) {
      const alpha = Math.max(0, h.life / h.maxLife);
      const sc = 0.6 + (1 - alpha) * 0.8;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;

      // Capcom 4-point cross-star flash!
      const drawStar = (r, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? r : r * 0.22;
          const a = (i * Math.PI) / 4;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };
      drawStar(h.size, h.color);
      drawStar(h.size * 0.58, '#ffffff');
      ctx.restore();
    }
  }

  _drawProjectiles(ctx) {
    for (const pr of this.projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);

      if (pr.kind === 'pear') {
        ctx.rotate(pr.rot);
        ctx.shadowColor = '#bef264';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#bef264';
        ctx.strokeStyle = '#4d7c0f';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 8, 17, 0, Math.PI * 2); ctx.arc(0, -8, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#713f12'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(3, -27); ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.ellipse(9, -22, 7.5, 3.8, -0.4, 0, Math.PI * 2); ctx.fill();
      } else if (pr.kind === 'mango_seed') {
        const dir = Math.sign(pr.vx || 1);
        const grad = ctx.createLinearGradient(-120 * dir, 0, 0, 0);
        grad.addColorStop(0, 'rgba(255, 183, 3, 0)');
        grad.addColorStop(1, 'rgba(255, 130, 0, 0.92)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 34;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-120 * dir, 0); ctx.lineTo(0, 0); ctx.stroke();

        ctx.rotate(pr.rot);
        ctx.shadowColor = '#ffb703';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 36, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(22, -4); ctx.moveTo(-18, 4); ctx.lineTo(18, 4); ctx.stroke();
      } else if (pr.kind === 'eyp_report') {
        ctx.rotate(pr.rot * 0.42);
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(-42, -52, 84, 104, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(-40, -50, 80, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 13px 'Chakra Petch', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('EYP REPORT', 0, -35);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-26, 6, 12, 26);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-6, -8, 12, 40);
        ctx.fillStyle = '#10b981'; ctx.fillRect(14, 14, 12, 18);
        ctx.rotate(-0.22);
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
        ctx.strokeRect(-35, -6, 70, 20);
        ctx.fillStyle = '#dc2626';
        ctx.font = `700 12px 'Chakra Petch', sans-serif`;
        ctx.fillText('APPROVED ♥', 0, 8);
      }
      ctx.restore();
    }
  }

  _drawVfx(ctx) {
    for (const v of this.vfx) {
      const p = Math.min(1, v.t / v.duration);
      const f = v.side === 'red' ? this.red : v.side === 'blue' ? this.blue : null;
      const fx = f ? f.x : v.x;
      const fy = f ? f.y : v.y;
      const dir = f ? f.facing : v.dir || 1;

      ctx.save();
      if (v.kind === 'dj_spin') {
        ctx.translate(fx, fy - 62);
        for (let r = 0; r < 2; r++) {
          ctx.strokeStyle = r === 0 ? `rgba(255, 105, 180, ${1 - p})` : `rgba(56, 189, 248, ${1 - p})`;
          ctx.lineWidth = 6 - r * 2;
          ctx.beginPath(); ctx.arc(0, 0, 26 + p * (125 + r * 28), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.rotate(p * Math.PI * 8);
        ctx.fillStyle = '#111827';
        ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      } else if (v.kind === 'coke_burp') {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.roundRect(fx + 18 * dir - 8, fy - 96, 16, 26, 4); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx + 18 * dir - 8, fy - 86, 16, 5);
        for (let i = 0; i < 4; i++) {
          const wx = fx + (34 + p * 245 + i * 24) * dir;
          ctx.strokeStyle = i % 2 === 0 ? `rgba(139, 69, 19, ${1 - p})` : `rgba(255, 255, 255, ${1 - p})`;
          ctx.lineWidth = 9 - i * 1.8;
          ctx.beginPath(); ctx.arc(wx, fy - 96, 22 + p * 48, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
        }
      } else if (v.kind === 'white_claw') {
        ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(fx + 16 * dir - 7, fy - 114, 14, 28, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0ea5e9'; ctx.fillRect(fx + 16 * dir - 6, fy - 104, 12, 8);

        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 16;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - p * 0.75})`;
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        [-20, 0, 20].forEach((off) => {
          ctx.beginPath();
          ctx.moveTo(fx + 10 * dir, fy - 98 + off);
          ctx.quadraticCurveTo(fx + 70 * dir, fy - 82 + off, fx + 135 * dir, fy - 62 + off);
          ctx.stroke();
        });
      } else if (v.kind === 'height_mog') {
        const rx = fx - 58 * dir;
        const rh = 255 * Math.min(1, p * 2.2);
        ctx.shadowColor = '#ffd479'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffd479'; ctx.strokeStyle = '#854d0e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(rx, GROUND_Y - rh, 24, rh, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#422006'; ctx.lineWidth = 2;
        for (let ty = 14; ty < rh - 10; ty += 16) {
          ctx.beginPath(); ctx.moveTo(rx, GROUND_Y - ty); ctx.lineTo(rx + (ty % 32 === 0 ? 13 : 8), GROUND_Y - ty); ctx.stroke();
        }
        ctx.font = `700 28px 'Bangers', Impact, sans-serif`;
        ctx.fillStyle = '#ffd479'; ctx.strokeStyle = '#18061a'; ctx.lineWidth = 5;
        ctx.strokeText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
        ctx.fillText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
      } else if (v.kind === 'forehead_kiss') {
        ctx.globalAlpha = 1 - p;
        this._drawHeart(ctx, fx + 36 * dir, fy - 106, 18 + p * 12, '#ff69b4');
      } else if (v.kind === 'kiss_bloom') {
        const sc = 0.7 + Math.sin(p * Math.PI) * 1.05;
        ctx.translate(v.x, v.y - p * 32);
        ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - p * 0.65;
        ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 24;
        this._drawHeart(ctx, 0, 0, 30, '#ff4d9e');
        ctx.font = `28px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('💋', 0, 10);
      }
      ctx.restore();
    }
  }

  _drawAfterimages(ctx) {
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life / a.maxLife) * 0.48;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(a.x, a.y - (a.isWifebun ? 60 : 72));
      ctx.rotate(a.rollAngle || 0);
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, a.isWifebun ? 22 : 28, a.isWifebun ? 52 : 62, 0, 0, Math.PI * 2);
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
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  _drawPetals(ctx) {
    for (const p of this.petals) {
      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.isHeart) this._drawHeart(ctx, 0, 0, p.size * 1.1, p.color);
      else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
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
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
        ctx.fillRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
        ctx.strokeRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
      } else if (p.shape === 'bubble') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2); ctx.stroke();
      } else if (p.shape === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
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
      ctx.font = `700 ${Math.round(38 * c.scale)}px 'Bangers', Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = '#18061a';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }
  }
}
