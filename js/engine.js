import { sound } from './audio.js';

const W = 960;
const H = 540;
const STAGE_W = 1480;
const GROUND_Y = 446;
const GRAVITY = 1780;

const MAX_HP = 100;
const MAX_SUPER = 100;
const PASSIVE_SUPER_PER_SEC = 7.2;
const BLOCK_SUPER_GAIN = 22;
const DODGE_SUPER_GAIN = 18;
const HIT_SUPER_GAIN = 8;
const ROUND_TIME = 99;

export const FIGHTER_MOVES = {
  red: [
    {
      id: 'pear_bounce',
      label: 'PEAR BOUNCE',
      emoji: '🍐',
      damage: 12,
      cooldown: 0.48,
      windup: 0.11,
      active: 0.32,
      recover: 0.18,
      callout: 'PEAR BOUNCE!! 🍐',
      color: '#ff77ba',
      heavy: true,
      isSuper: false,
    },
    {
      id: 'dj_spin',
      label: 'DJ SPIN',
      emoji: '🎧',
      damage: 13,
      cooldown: 0.62,
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
      damage: 13,
      cooldown: 0.78,
      windup: 0.14,
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
      cooldown: 0.48,
      windup: 0.09,
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
      cooldown: 0.74,
      windup: 0.14,
      active: 0.34,
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
      cooldown: 0.64,
      windup: 0.10,
      active: 0.34,
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
    side, // 'red' = Wifebun (Lola glamour), 'blue' = Husbun (Bugs suave)
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

    animTime: 0,
    runCycle: 0,
    squashX: 1,
    squashY: 1,
    buttScale: 1,
    cheekPuff: 0,
    stretchH: 0,
    spinAngle: 0,
    rollAngle: 0,
    earLag: 0,
    flirtTimer: 1.8 + Math.random() * 2,
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

    // Enable crisp Retina / High-DPI canvas rendering!
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = W * this.dpr;
    this.canvas.height = H * this.dpr;

    this.mode = 'cpu';
    this.humanSide = 'red';
    this.cpuDifficulty = 'medium';
    this.bestOf = 3;
    this.roundsToWin = 2;

    this.red = createFighter('red', STAGE_W * 0.5 - 200);
    this.blue = createFighter('blue', STAGE_W * 0.5 + 200);

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
    this.romanceBloom = 0;
    this.superFreeze = null;

    this.projectiles = [];
    this.vfx = [];
    this.smears = [];
    this.hitSparks = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.particles = [];
    this.callouts = [];
    this.petals = this._initPetals();
    this.fireflies = this._initFireflies();

    this.cpuDecisionTimer = 0.4;
    this.cpuMoveIntent = 0;
    this.cpuBlockTimer = 0;
    this._lastHudSync = 0;
  }

  _initPetals() {
    const list = [];
    for (let i = 0; i < 42; i++) {
      list.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: -14 - Math.random() * 22,
        vy: 14 + Math.random() * 22,
        size: 3.5 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
        isHeart: i % 5 === 0,
        color: i % 3 === 0 ? '#ffd479' : i % 2 === 0 ? '#ff77ba' : '#ffc2e2',
      });
    }
    return list;
  }

  _initFireflies() {
    const list = [];
    for (let i = 0; i < 24; i++) {
      list.push({
        x: Math.random() * STAGE_W,
        y: 120 + Math.random() * 310,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
        r: 2 + Math.random() * 2.5,
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

    this.red = createFighter('red', STAGE_W * 0.5 - 200);
    this.blue = createFighter('blue', STAGE_W * 0.5 + 200);
    this.round = 1;
    this.matchWinner = null;

    this._startRound();
  }

  _startRound() {
    this._resetFighterForRound(this.red, STAGE_W * 0.5 - 200, 1);
    this._resetFighterForRound(this.blue, STAGE_W * 0.5 + 200, -1);

    this.roundTimer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseTimer = 1.65;
    this.hitStop = 0;
    this.shake = 0;
    this.camX = STAGE_W * 0.5;
    this.camZoom = 1.04;
    this.dramaticDim = 0;
    this.romanceBloom = 0;
    this.superFreeze = null;

    this.projectiles = [];
    this.vfx = [];
    this.smears = [];
    this.hitSparks = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.particles = [];
    this.callouts = [];

    this._emitBanner(`ROUND ${this.round}`, '🌹 MOONLIT ROMANCE DUEL 🌹');
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
    f.buttScale = 1;
    f.cheekPuff = 0;
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
      this._spawnCallout(f.x, f.y - 175, '★ SUPER READY! ★', '#ffd479', 0.94);
      this._spawnSparks(f.x, f.y - 88, '#ffd479', 16, 'heart');
    }
  }

  // ==========================
  // PLAYER INPUTS & ACTIONS
  // ==========================
  setInput(side, key, value) {
    const f = side === 'red' ? this.red : this.blue;
    if (key in f.inputs) f.inputs[key] = Boolean(value);
  }

  triggerJump(side) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    if (!f.grounded || f.koState || f.stunTimer > 0 || f.dodgeTimer > 0) return false;
    if (f.move && f.move.phase !== 'recover') return false;

    f.grounded = false;
    f.vy = side === 'red' ? -710 : -680;
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
    f.dodgeTimer = 0.36; // 0-damage invincibility!
    f.dodgeCooldown = 0.48;

    const dir = f.inputs.left ? -1 : f.inputs.right ? 1 : -f.facing;
    f.dodgeDir = dir;
    f.vx = dir * 590;
    if (f.grounded) {
      f.vy = -215;
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

    if (def.isSuper) {
      if (f.superMeter < MAX_SUPER) {
        this._spawnCallout(f.x, f.y - 165, `SUPER ${Math.floor(f.superMeter)}%`, '#ffd479', 0.72);
        return false;
      }
      f.superMeter = 0;
      f.superNotified = false;
      this.superFreeze = { side, title: def.callout, color: def.color, timer: 0.58, maxTimer: 0.58 };
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
    if (def.id === 'forehead_kiss') {
      f.heartEyesTimer = 1.2;
      this.romanceBloom = 0.35;
    }
    if (def.id === 'height_mog') this.dramaticDim = 0.50;
    if (def.id === 'pear_bounce' || def.id === 'dj_spin') f.winkTimer = 0.85;

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

    if (!def.isSuper) sound.playMove(def.id);
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
    if (this.romanceBloom > 0) this.romanceBloom = Math.max(0, this.romanceBloom - clampedDt * 0.9);

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
      [this.red, this.blue].forEach((f) => {
        f.animTime += clampedDt;
        if (typeof f._netX === 'number') {
          f.x += (f._netX - f.x) * Math.min(1, clampedDt * 24);
          f.y += (f._netY - f.y) * Math.min(1, clampedDt * 24);
        }
        f.squashX += (1 - f.squashX) * Math.min(1, clampedDt * 13);
        f.squashY += (1 - f.squashY) * Math.min(1, clampedDt * 13);
        f.earLag += (-f.vx * 0.0012 - f.earLag) * Math.min(1, clampedDt * 10);
      });
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

      this._addSuper(this.red, PASSIVE_SUPER_PER_SEC * clampedDt);
      this._addSuper(this.blue, PASSIVE_SUPER_PER_SEC * clampedDt);

      if (this.mode === 'cpu') this._updateCpuAI(clampedDt);

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

    f.flirtTimer -= dt;
    if (f.flirtTimer <= 0 && !f.move && f.stunTimer <= 0 && !f.blocking) {
      f.flirtTimer = 2.8 + Math.random() * 2.2;
      f.winkTimer = 0.55;
      if (f.side === 'red') {
        this._spawnSparks(f.x + f.facing * 24, f.y - 126, '#ff69b4', 2, 'heart');
      }
    }

    if (f.superMeter >= MAX_SUPER && Math.random() < dt * 8) {
      this._spawnSparks(f.x + (Math.random() - 0.5) * 52, f.y - 25 - Math.random() * 110, '#ffd479', 1, 'heart');
    }

    f.blocking = Boolean(f.inputs.block && f.grounded && !f.move && f.stunTimer <= 0 && f.dodgeTimer <= 0);

    if (f.dodgeTimer > 0) {
      f.dodgeTimer = Math.max(0, f.dodgeTimer - dt);
      f.rollAngle += dt * 18 * f.dodgeDir;
      if (Math.random() < dt * 36) this._spawnAfterimage(f);
      if (f.dodgeTimer <= 0) f.rollAngle = 0;
    } else {
      f.rollAngle = 0;
    }

    const moveSpeed = f.side === 'red' ? 385 : 355;
    if (f.stunTimer <= 0 && f.dodgeTimer <= 0 && !f.move) {
      if (f.blocking) {
        f.vx *= Math.pow(0.001, dt);
      } else {
        const dir = (f.inputs.right ? 1 : 0) - (f.inputs.left ? 1 : 0);
        const targetVx = dir * moveSpeed;
        f.vx += (targetVx - f.vx) * Math.min(1, dt * (f.grounded ? 20 : 9));
        if (f.grounded && Math.abs(f.vx) > 220 && Math.random() < dt * 10) {
          this._spawnDust(f.x - Math.sign(f.vx) * 18, GROUND_Y, 1);
        }
      }
      if (f.grounded && Math.abs(opp.x - f.x) > 12) {
        f.facing = opp.x >= f.x ? 1 : -1;
      }
    } else if (f.stunTimer > 0) {
      f.vx *= Math.pow(0.05, dt);
    }

    if (f.move) this._updateFighterMove(f, opp, dt);

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

    f.squashX += (1 - f.squashX) * Math.min(1, dt * 13);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 13);

    // DRAMATIC EXPANDING BOOTY FOR PEAR BOUNCE!!
    const targetButt = f.move && f.move.id === 'pear_bounce' && f.move.phase === 'active'
      ? 3.15
      : f.move && f.move.id === 'pear_bounce' && f.move.phase === 'windup'
      ? 1.65
      : 1.0;
    f.buttScale += (targetButt - f.buttScale) * Math.min(1, dt * 22);

    const targetPuff = f.move && f.move.id === 'coke_burp' && f.move.phase !== 'recover' ? 1.0 : 0;
    f.cheekPuff += (targetPuff - f.cheekPuff) * Math.min(1, dt * 18);

    const targetStretch = f.move && f.move.id === 'height_mog' && f.move.phase !== 'recover' ? 105 : 0;
    f.stretchH += (targetStretch - f.stretchH) * Math.min(1, dt * 16);

    if (f.move && f.move.id === 'dj_spin' && f.move.phase === 'active') {
      f.spinAngle += dt * 28;
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
        f.squashX = 0.84;
        f.squashY = 1.18;
        this._onMoveActiveStart(f, opp, m);
      }
      return;
    }

    if (m.phase === 'active') {
      if (!m.hitDone) {
        if (m.id === 'pear_bounce') {
          f.vx = f.facing * 540;
          if (Math.random() < dt * 28) {
            this._spawnAfterimage(f);
            this._spawnSparks(f.x, f.y - 60, '#ff77ba', 1, 'heart');
          }
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -35 && dx < 180 && Math.abs(f.y - opp.y) < 120) {
            m.hitDone = true;
            f.vx = -f.facing * 150;
            this._applyHit(f, opp, m, { knockX: 560, knockY: -320, stun: 0.36 });
          }
        } else if (m.id === 'dj_spin') {
          f.vx = f.facing * 365;
          if (Math.random() < dt * 20) this._spawnSmear(f.x, f.y - 78, f.facing, '#ff69b4', 76);
          if (Math.abs(f.x - opp.x) < 155 && Math.abs(f.y - opp.y) < 120) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 370, knockY: -250, stun: 0.28 });
          }
        } else if (m.id === 'coke_burp') {
          f.vx = -f.facing * 45;
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -20 && dx < 310 && Math.abs(f.y - opp.y) < 120) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 450, knockY: -190, stun: 0.44 });
          }
        } else if (m.id === 'white_claw') {
          f.vx = f.facing * 560;
          if (Math.random() < dt * 28) this._spawnAfterimage(f);
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -30 && dx < 170 && Math.abs(f.y - opp.y) < 120) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 350, knockY: -230, stun: 0.28 });
          }
        } else if (m.id === 'height_mog') {
          if (m.timer <= m.activeDur * 0.55) {
            const dx = (opp.x - f.x) * f.facing;
            if (dx > -40 && dx < 215 && Math.abs(f.y - opp.y) < 165) {
              m.hitDone = true;
              this._applyHit(f, opp, m, { knockX: 400, knockY: -340, stun: 0.34 });
            }
          }
        } else if (m.id === 'forehead_kiss') {
          f.vx = f.facing * 530;
          if (Math.random() < dt * 26) this._spawnSparks(f.x, f.y - 96, '#ff69b4', 1, 'heart');
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -25 && dx < 145 && Math.abs(f.y - opp.y) < 120) {
            m.hitDone = true;
            f.vx = 0;
            this.romanceBloom = 0.55;
            this._applyHit(f, opp, m, { knockX: 210, knockY: -165, stun: 0.50, isKiss: true });
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
      if (m.timer <= 0) f.move = null;
    }
  }

  _onMoveActiveStart(f, opp, m) {
    if (m.id === 'pear_bounce') {
      if (f.grounded) {
        f.vy = -255;
        f.grounded = false;
      }
      this._spawnShockwave(f.x + f.facing * 42, f.y - 62, '#ff77ba', 105);
      this._spawnSmear(f.x + f.facing * 44, f.y - 64, f.facing, '#ffd479', 88);
      this.vfx.push({ kind: 'pear_bounce', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.46 });
    } else if (m.id === 'mango_seed') {
      f.vx = -f.facing * 150;
      this.shake = Math.max(this.shake, 11);
      this._spawnShockwave(f.x + f.facing * 48, f.y - 84, '#ffb703', 135);
      this._spawnSmear(f.x + f.facing * 46, f.y - 84, f.facing, '#ffd479', 96);
      this.projectiles.push({
        kind: 'mango_seed',
        owner: f.side,
        x: f.x + f.facing * 58,
        y: f.y - 84,
        vx: f.facing * 880,
        vy: 0,
        radius: 40,
        bounces: 0,
        maxBounces: 0,
        life: 1.6,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'eyp_report') {
      f.vx = f.facing * 80;
      this.shake = Math.max(this.shake, 11);
      const dist = Math.max(170, Math.min(480, Math.abs(opp.x - f.x)));
      this._spawnSmear(f.x + f.facing * 40, f.y - 124, f.facing, '#60a5fa', 94);
      this.projectiles.push({
        kind: 'eyp_report',
        owner: f.side,
        x: f.x + f.facing * 40,
        y: f.y - 134,
        vx: f.facing * Math.max(400, dist * 1.18),
        vy: -460,
        radius: 50,
        bounces: 0,
        maxBounces: 0,
        life: 1.9,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'height_mog') {
      if (f.grounded) {
        f.vy = -450;
        f.grounded = false;
      }
      f.vx = f.facing * 270;
      this._spawnSmear(f.x + f.facing * 40, f.y - 135, f.facing, '#ffd479', 88);
      this.vfx.push({ kind: 'height_mog', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.62 });
    } else if (m.id === 'dj_spin') {
      this._spawnSmear(f.x, f.y - 78, f.facing, '#ff69b4', 84);
      this.vfx.push({ kind: 'dj_spin', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.50 });
    } else if (m.id === 'coke_burp') {
      this.vfx.push({ kind: 'coke_burp', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.50 });
    } else if (m.id === 'white_claw') {
      this._spawnSmear(f.x + f.facing * 48, f.y - 102, f.facing, '#38bdf8', 88);
      this.vfx.push({ kind: 'white_claw', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.46 });
    } else if (m.id === 'forehead_kiss') {
      this.vfx.push({ kind: 'forehead_kiss', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.48 });
    }
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.rot += dt * (pr.kind === 'mango_seed' ? 16 : 8) * Math.sign(pr.vx || 1);

      if (pr.kind === 'eyp_report') {
        pr.vy += 1280 * dt;
        if (pr.y >= GROUND_Y - 26) {
          this._spawnShockwave(pr.x, GROUND_Y - 10, '#60a5fa', 160);
          this._spawnSparks(pr.x, GROUND_Y - 16, '#ffffff', 18, 'page');
          this.shake = Math.max(this.shake, 10);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      const attacker = pr.owner === 'red' ? this.red : this.blue;
      const target = pr.owner === 'red' ? this.blue : this.red;
      const targetCenterY = target.y - (target.side === 'red' ? 74 : 90);
      if (Math.hypot(pr.x - target.x, pr.y - targetCenterY) < pr.radius + 44) {
        const knock = pr.kind === 'mango_seed'
          ? { knockX: 560, knockY: -350, stun: 0.36 }
          : { knockX: 480, knockY: -370, stun: 0.40 };
        this._applyHit(attacker, target, pr.move, knock, pr.x, pr.y);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.life <= 0 || pr.x < -120 || pr.x > STAGE_W + 120) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  _resolveFighterPushbox() {
    const minDist = 74;
    const dx = this.blue.x - this.red.x;
    const dy = Math.abs(this.blue.y - this.red.y);
    if (dy < 105 && Math.abs(dx) < minDist) {
      const push = (minDist - Math.abs(dx)) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      this.red.x = Math.max(70, Math.min(STAGE_W - 70, this.red.x - sign * push));
      this.blue.x = Math.max(70, Math.min(STAGE_W - 70, this.blue.x + sign * push));
    }
  }

  _applyHit(attacker, defender, move, { knockX, knockY, stun, isKiss = false }, hitX, hitY) {
    const ix = hitX ?? (attacker.x + defender.x) * 0.5;
    const iy = hitY ?? (defender.y - 84);
    const pushDir = defender.x >= attacker.x ? 1 : -1;

    // 1. DODGE -> STRICTLY 0 DAMAGE!
    if (defender.dodgeTimer > 0) {
      defender.counterWindow = 1.15;
      defender.heartEyesTimer = 0.9;
      this._addSuper(defender, DODGE_SUPER_GAIN);
      attacker.comboCount = 0;

      sound.playPerfectDodge();
      this.hitStop = 0.065;
      this._spawnShockwave(ix, iy, '#c084fc', 125);
      this._spawnSparks(ix, iy, '#e9d5ff', 16, 'heart');
      this._spawnCallout(ix, iy - 48, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
      this._emitNetEvent('perfect_dodge', { x: ix, y: iy });
      return;
    }

    // 2. BLOCK -> TINY CHIP DAMAGE (~8%) + BIG SPECIAL SUPER GAIN (+22%)!
    if (defender.blocking) {
      const chipDmg = Math.max(1, Math.round(move.damage * 0.08 * 10) / 10);
      defender.hp = Math.max(1, defender.hp - chipDmg);
      defender.vx = pushDir * (knockX * 0.42);
      defender.counterWindow = 0.85;
      this._addSuper(defender, BLOCK_SUPER_GAIN);
      attacker.comboCount = 0;

      sound.playBlock();
      this._spawnHitSpark(ix, iy, '#ffd479', 46);
      this._spawnShockwave(ix, iy, '#ffd479', 78);
      this._spawnCallout(ix, iy - 44, 'GUARD! +SUPER ✨', '#ffd479', 0.84);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: ix, y: iy });
      return;
    }

    // 3. CLEAN HIT!
    attacker.comboCount += 1;
    attacker.comboTimer = 2.4;
    const comboMult = attacker.comboCount >= 3 ? 1.15 : 1;
    if (!move.isSuper) this._addSuper(attacker, HIT_SUPER_GAIN);

    defender.hp = Math.max(0, defender.hp - move.damage * comboMult);
    defender.hitFlash = 0.18;
    defender.stunTimer = stun + (move.isCounter ? 0.12 : 0);
    defender.vx = pushDir * knockX;
    if (knockY < 0) {
      defender.vy = knockY;
      defender.grounded = false;
    }
    defender.squashX = 0.76;
    defender.squashY = 1.26;
    defender.move = null;

    if (isKiss) {
      defender.blushTimer = 2.6;
      defender.heartEyesTimer = 1.9;
      this.vfx.push({ kind: 'kiss_bloom', x: defender.x, y: defender.y - 134, t: 0, duration: 0.82 });
    }

    if (defender.hp <= 0) {
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnHitSpark(ix, iy, '#ffd479', 105);
      this._spawnShockwave(ix, iy, '#ffd479', 210);
      this._spawnShockwave(ix, iy, move.color, 150);
      this._spawnSparks(ix, iy, '#ffd479', 28, 'heart');
      this._spawnCallout(ix, iy - 56, 'K.O.!! 💕', '#ffd479', 1.55);
      this._emitNetEvent('ko', { x: ix, y: iy, color: move.color });
    } else {
      sound.playHit(move.heavy || move.isCounter || move.isSuper);
      this.hitStop = move.isSuper ? 0.12 : move.isCounter ? 0.085 : move.heavy ? 0.06 : 0.038;
      this.shake = move.isSuper ? 20 : move.isCounter ? 15 : move.heavy ? 11 : 6;
      this._spawnHitSpark(ix, iy, move.isSuper ? '#ffd479' : move.color, move.isSuper ? 94 : move.heavy ? 68 : 48);
      this._spawnShockwave(ix, iy, move.isCounter ? '#ffd479' : move.color, move.isSuper ? 165 : move.heavy ? 130 : 88);
      this._spawnMoveHitParticles(ix, iy, move.id, move.color);

      const label = move.isCounter ? `COUNTER ${move.callout}` : move.callout;
      this._spawnCallout(ix, iy - 42, label, move.isCounter || move.isSuper ? '#ffd479' : move.color, move.isSuper ? 1.25 : 0.98);
      if (attacker.comboCount >= 2) {
        this._spawnCallout(ix, iy - 88, `${attacker.comboCount} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.84);
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
    loser.vx = fallDir * 410;
    loser.vy = -450;
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
        f.victoryKissTimer = 0.25;
        this._spawnSparks(f.x + f.facing * 24, f.y - 128, '#ff69b4', 3, 'heart');
      }
    }
  }

  // ==========================
  // SMART CPU AI
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

    const incomingProj = this.projectiles.some((pr) => pr.owner !== cpuSide && Math.abs(pr.x - cpu.x) < 170);
    if ((incomingProj || (player.move && absDist < 210)) && !cpu.move && cpu.stunTimer <= 0) {
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

      if (absDist > 235) this.cpuMoveIntent = Math.sign(dx);
      else if (absDist < 90) this.cpuMoveIntent = -Math.sign(dx);
      else this.cpuMoveIntent = Math.random() < 0.5 ? Math.sign(dx) : 0;

      if (cpu.superMeter >= MAX_SUPER && Math.random() < 0.72) {
        this.triggerMove(cpuSide, 3);
        return;
      }

      if (Math.random() < cfg.aggro) {
        if (absDist > 205) {
          const rushMoves = [0, 1];
          this.triggerMove(cpuSide, rushMoves[Math.floor(Math.random() * rushMoves.length)]);
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
  // VFX HELPERS
  // ==========================
  _spawnSmear(x, y, dir, color, radius) {
    this.smears.push({ x, y, dir, color, radius, life: 0.20, maxLife: 0.20 });
  }

  _spawnHitSpark(x, y, color, size) {
    this.hitSparks.push({ x, y, color, size, rot: Math.random() * Math.PI, life: 0.22, maxLife: 0.22 });
  }

  _spawnShockwave(x, y, color, maxRadius) {
    this.shockwaves.push({ x, y, color, radius: 14, maxRadius, life: 0.28, maxLife: 0.28 });
  }

  _spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y - 4,
        vx: (Math.random() - 0.5) * 115,
        vy: -25 - Math.random() * 68,
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
      color: f.side === 'red' ? 'rgba(255, 105, 180, 0.48)' : 'rgba(96, 165, 250, 0.48)',
      life: 0.26,
      maxLife: 0.26,
    });
  }

  _spawnMoveHitParticles(x, y, moveId, color) {
    if (moveId === 'forehead_kiss') {
      this._spawnSparks(x, y - 20, '#ff69b4', 20, 'heart');
      this._spawnSparks(x, y - 10, '#ffd479', 12, 'heart');
    } else if (moveId === 'pear_bounce') {
      this._spawnSparks(x, y, '#ff69b4', 16, 'heart');
      this._spawnSparks(x, y, '#ffd479', 14, 'dot');
    } else if (moveId === 'dj_spin') {
      this._spawnSparks(x, y, '#ff69b4', 9, 'note');
      this._spawnSparks(x, y, '#38bdf8', 9, 'note');
    } else if (moveId === 'eyp_report') {
      this._spawnSparks(x, y, '#ffffff', 18, 'page');
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
      const speed = 80 + Math.random() * 290;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (shape === 'bubble' || shape === 'heart' ? 115 : 60),
        size: shape === 'page' ? 9 : 4 + Math.random() * 5,
        color,
        shape,
        rot: Math.random() * Math.PI * 2,
        life: 0.45 + Math.random() * 0.42,
        maxLife: 0.87,
      });
    }
  }

  _spawnCallout(x, y, text, color, scale = 1) {
    this.callouts.push({ x, y, text, color, scale, life: 0.88, maxLife: 0.88 });
  }

  _updatePetals(dt) {
    for (const p of this.petals) {
      p.x += (p.vx + Math.sin(this.time * 1.4 + p.rot) * 15) * dt;
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
      if (p.shape === 'dust') p.size += dt * 16;
      else p.vy += (p.shape === 'bubble' || p.shape === 'heart' ? -92 : 620) * dt;
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
      buttScale: Math.round(f.buttScale * 100) / 100,
      cheekPuff: Math.round(f.cheekPuff * 100) / 100,
      stretchH: Math.round(f.stretchH),
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

    const syncFighter = (target, src) => {
      if (!src) return;
      const snap = prevRound !== this.round || Math.hypot((src.x ?? target.x) - target.x, (src.y ?? target.y) - target.y) > 220;
      const curX = target.x;
      const curY = target.y;
      Object.assign(target, src);
      target._netX = src.x;
      target._netY = src.y;
      if (!snap) {
        target.x = curX;
        target.y = curY;
      }
    };

    syncFighter(this.red, s.red);
    syncFighter(this.blue, s.blue);
    this.projectiles = (s.projectiles || []).map((p) => ({ ...p }));

    if (prevPhase !== this.phase || prevRound !== this.round) {
      if (this.phase === 'intro') {
        this._emitBanner(`ROUND ${this.round}`, '🌹 MOONLIT ROMANCE DUEL 🌹');
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
      this.superFreeze = { side: ev.side, title: ev.title, color: ev.color, timer: 0.58, maxTimer: 0.58 };
      sound.playSuperFreeze();
    } else if (ev.kind === 'move_start') {
      sound.playMove(ev.moveId);
      if (ev.moveId === 'height_mog') this.dramaticDim = 0.50;
      if (ev.moveId === 'forehead_kiss') this.romanceBloom = 0.35;
      if (['pear_bounce', 'height_mog', 'dj_spin', 'coke_burp', 'white_claw', 'forehead_kiss'].includes(ev.moveId)) {
        this.vfx.push({ kind: ev.moveId, side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.48 });
      }
    } else if (ev.kind === 'dodge') {
      sound.playDodge();
      this._spawnAfterimage(ev.side === 'red' ? this.red : this.blue);
    } else if (ev.kind === 'perfect_dodge') {
      sound.playPerfectDodge();
      this._spawnShockwave(ev.x, ev.y, '#c084fc', 125);
      this._spawnSparks(ev.x, ev.y, '#e9d5ff', 16, 'heart');
      this._spawnCallout(ev.x, ev.y - 48, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 46);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 78);
      this._spawnCallout(ev.x, ev.y - 44, 'GUARD! +SUPER ✨', '#ffd479', 0.84);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter);
      this.shake = ev.counter ? 15 : ev.heavy ? 11 : 6;
      if (ev.moveId === 'forehead_kiss') {
        this.romanceBloom = 0.55;
        this.vfx.push({ kind: 'kiss_bloom', x: ev.x, y: ev.y - 36, t: 0, duration: 0.82 });
      }
      this._spawnHitSpark(ev.x, ev.y, ev.color, ev.heavy ? 68 : 48);
      this._spawnShockwave(ev.x, ev.y, ev.counter ? '#ffd479' : ev.color, ev.heavy ? 130 : 88);
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 42, ev.word, ev.counter ? '#ffd479' : ev.color, 0.98);
      if (ev.combo >= 2) {
        this._spawnCallout(ev.x, ev.y - 88, `${ev.combo} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.84);
      }
    } else if (ev.kind === 'ko') {
      sound.playKO();
      this.shake = 22;
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 105);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 210);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 28, 'heart');
      this._spawnCallout(ev.x, ev.y - 56, 'K.O.!! 💕', '#ffd479', 1.55);
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
  // RENDERING — HIGH-DPI PAINTED ROMANTIC STAGE & GLAMOUR FIGHTER RIGS!
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this._drawPaintedRomanticSky(ctx);

    ctx.save();
    ctx.translate(W / 2, H * 0.56);
    ctx.scale(this.camZoom, this.camZoom);
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.translate(-this.camX, -H * 0.56);

    this._drawPaintedGardenStage(ctx);
    this._drawReflectiveBoardwalk(ctx);

    if (this.dramaticDim > 0.02 || this.superFreeze) {
      ctx.fillStyle = `rgba(12, 3, 20, ${this.superFreeze ? 0.65 : this.dramaticDim})`;
      ctx.fillRect(0, 0, STAGE_W, H);
    }

    this._drawAfterimages(ctx);

    // Draw fighters at heroic fighting-game scale (~1.18x larger!)
    const redOnTop = Boolean(this.red.move && this.red.move.phase === 'active');
    if (redOnTop) {
      this._drawHusbunGlamour(ctx, this.blue);
      this._drawWifebunGlamour(ctx, this.red);
    } else {
      this._drawWifebunGlamour(ctx, this.red);
      this._drawHusbunGlamour(ctx, this.blue);
    }

    this._drawSmears(ctx);
    this._drawProjectiles(ctx);
    this._drawVfx(ctx);
    this._drawShockwaves(ctx);
    this._drawHitSparks(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore();

    // Screen-space petals & romantic vignette bloom!
    this._drawPetals(ctx);
    this._drawRomanticVignette(ctx);

    if (this.superFreeze) {
      this._drawSuperFreezeCutIn(ctx, this.superFreeze);
    }

    ctx.restore();
  }

  _drawRomanticVignette(ctx) {
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.34, W * 0.5, H * 0.5, W * 0.68);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(22, 4, 24, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (this.romanceBloom > 0.01) {
      const bloom = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.45, W * 0.58);
      bloom.addColorStop(0, `rgba(255, 110, 185, ${this.romanceBloom * 0.45})`);
      bloom.addColorStop(1, 'rgba(255, 70, 150, 0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawPaintedRomanticSky(ctx) {
    // Rich painted twilight velvet sky (deep plum -> warm rose -> champagne horizon)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#13051c');
    sky.addColorStop(0.32, '#34103a');
    sky.addColorStop(0.64, '#7d2856');
    sky.addColorStop(0.84, '#c75a78');
    sky.addColorStop(1, '#260a22');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Soft glowing sunset-rose nebula clouds drifting slowly
    const cloudShift = (this.time * 8) % (W + 300);
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 260 + cloudShift) % (W + 320)) - 160;
      const cy = 95 + (i % 3) * 48;
      const cGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 130);
      cGrad.addColorStop(0, 'rgba(255, 170, 210, 0.16)');
      cGrad.addColorStop(1, 'rgba(255, 120, 180, 0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath(); ctx.ellipse(cx, cy, 145, 36, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Luminous full moon with soft golden-rose halo
    const moonX = W * 0.52 - (this.camX - STAGE_W * 0.5) * 0.07;
    const moonY = 102;
    const moonHalo = ctx.createRadialGradient(moonX, moonY, 30, moonX, moonY, 195);
    moonHalo.addColorStop(0, 'rgba(255, 250, 236, 1)');
    moonHalo.addColorStop(0.18, 'rgba(255, 235, 210, 0.85)');
    moonHalo.addColorStop(0.42, 'rgba(255, 160, 200, 0.28)');
    moonHalo.addColorStop(1, 'rgba(255, 110, 175, 0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath(); ctx.arc(moonX, moonY, 195, 0, Math.PI * 2); ctx.fill();

    // Subtle moon craters
    ctx.fillStyle = 'rgba(225, 195, 180, 0.25)';
    ctx.beginPath(); ctx.arc(moonX - 11, moonY - 7, 9, 0, Math.PI * 2); ctx.arc(moonX + 12, moonY + 8, 6, 0, Math.PI * 2); ctx.fill();

    // Twinkling stars
    for (let i = 0; i < 48; i++) {
      const sx = (((i * 173) - (this.camX - STAGE_W * 0.5) * 0.04) % W + W) % W;
      const sy = 14 + ((i * 43) % 215);
      const tw = 0.2 + 0.75 * (0.5 + 0.5 * Math.sin(this.time * 2.5 + i));
      ctx.fillStyle = i % 3 === 0 ? `rgba(255, 224, 150, ${tw})` : `rgba(255, 214, 240, ${tw})`;
      ctx.beginPath(); ctx.arc(sx, sy, i % 6 === 0 ? 2.1 : 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // Far Parisian skyline + shimmering moonlit river (0.20x parallax)
    const offsetFar = -(this.camX - STAGE_W * 0.5) * 0.20;
    ctx.save();
    ctx.translate(offsetFar, 0);

    // Moonlit water
    const waterGrad = ctx.createLinearGradient(0, 315, 0, 440);
    waterGrad.addColorStop(0, '#4f1b45');
    waterGrad.addColorStop(0.45, '#2b0d2c');
    waterGrad.addColorStop(1, '#19061c');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(-350, 315, W + 700, 140);

    // Shimmering water moonlight ribbons
    for (let r = 0; r < 10; r++) {
      const rw = 96 - r * 7 + Math.sin(this.time * 3.2 + r) * 10;
      ctx.fillStyle = `rgba(255, 228, 196, ${0.28 - r * 0.022})`;
      ctx.fillRect(moonX - offsetFar - rw / 2, 324 + r * 9.5, rw, 3);
    }

    // Elegant distant skyline & Eiffel silhouette
    ctx.fillStyle = '#210926';
    const bld = [
      [-220, 68], [-150, 96], [-80, 74], [-10, 108], [60, 82], [130, 92], [210, 66],
      [640, 86], [710, 114], [785, 76], [855, 98], [930, 72], [1005, 94], [1085, 80],
    ];
    bld.forEach(([bx, bh]) => {
      ctx.fillRect(bx, 318 - bh, 58, bh);
      // Mansard Parisian roof
      ctx.beginPath(); ctx.moveTo(bx - 3, 318 - bh); ctx.lineTo(bx + 8, 318 - bh - 12); ctx.lineTo(bx + 50, 318 - bh - 12); ctx.lineTo(bx + 61, 318 - bh); ctx.fill();
      ctx.fillStyle = 'rgba(255, 214, 130, 0.42)';
      for (let wy = 318 - bh + 10; wy < 310; wy += 15) {
        ctx.fillRect(bx + 10, wy, 5, 6); ctx.fillRect(bx + 26, wy, 5, 6); ctx.fillRect(bx + 42, wy, 5, 6);
      }
      ctx.fillStyle = '#210926';
    });

    // Eiffel Tower romantic lattice silhouette
    ctx.beginPath();
    ctx.moveTo(438, 318);
    ctx.quadraticCurveTo(468, 228, 476, 146);
    ctx.lineTo(484, 146);
    ctx.quadraticCurveTo(492, 228, 522, 318);
    ctx.closePath();
    ctx.fill();
    // Tower arch cutout + warm golden beacon tip
    ctx.fillStyle = '#6c254e';
    ctx.beginPath(); ctx.arc(480, 318, 22, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffd479';
    ctx.shadowColor = '#ffd479'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(480, 144, 3.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  _drawPaintedGardenStage(ctx) {
    // Organic painted cherry-blossom trees (layered petal tufts with shading & moonlight highlights!)
    const trees = [175, 515, 965, 1305];
    trees.forEach((tx, idx) => {
      const sway = Math.sin(this.time * 1.2 + idx * 1.4) * 5;
      // Sculpted dark bark trunk & curving limbs
      ctx.strokeStyle = '#2b0f1e';
      ctx.lineWidth = 20; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, GROUND_Y); ctx.bezierCurveTo(tx - 16, GROUND_Y - 90, tx + 10, GROUND_Y - 150, tx + sway, GROUND_Y - 220); ctx.stroke();
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(tx + sway * 0.4, GROUND_Y - 135); ctx.quadraticCurveTo(tx - 40, GROUND_Y - 170, tx - 86 + sway, GROUND_Y - 196);
      ctx.moveTo(tx + sway * 0.5, GROUND_Y - 150); ctx.quadraticCurveTo(tx + 44, GROUND_Y - 178, tx + 88 + sway, GROUND_Y - 208);
      ctx.stroke();

      // Multi-layered shaded cherry blossom clusters!
      const puffs = [
        [-75, -196, 44, '#9c2d68'], [72, -206, 46, '#9c2d68'], [0, -234, 58, '#b8377a'],
        [-48, -218, 42, '#e85da3'], [48, -222, 44, '#e85da3'], [0, -252, 48, '#ff85c0'],
        [-62, -210, 30, '#ffb8dc'], [58, -216, 32, '#ffb8dc'], [-12, -258, 34, '#ffe0f0'], [26, -242, 28, '#ffd4e8'],
      ];
      puffs.forEach(([ox, oy, r, col]) => {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(tx + ox + sway, GROUND_Y + oy, r, 0, Math.PI * 2); ctx.fill();
      });
    });

    // Ornate wrought-iron Parisian lamp posts with warm volumetric lantern glow!
    const postXs = [100, 420, 740, 1060, 1380];
    postXs.forEach((px) => {
      ctx.fillStyle = '#240b1f';
      ctx.fillRect(px - 5, GROUND_Y - 245, 10, 245);
      ctx.beginPath(); ctx.roundRect(px - 11, GROUND_Y - 24, 22, 24, 4); ctx.fill();
      // Volumetric golden lantern halo
      const halo = ctx.createRadialGradient(px, GROUND_Y - 224, 6, px, GROUND_Y - 224, 64);
      halo.addColorStop(0, 'rgba(255, 240, 185, 0.95)');
      halo.addColorStop(0.35, 'rgba(255, 195, 120, 0.35)');
      halo.addColorStop(1, 'rgba(255, 140, 180, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(px, GROUND_Y - 224, 64, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.roundRect(px - 9, GROUND_Y - 236, 18, 22, 5); ctx.fill();
    });

    // Draped glowing champagne & rose fairy string lights!
    for (let i = 0; i < postXs.length - 1; i++) {
      const x1 = postXs[i], x2 = postXs[i + 1], mx = (x1 + x2) * 0.5;
      ctx.strokeStyle = 'rgba(255, 212, 140, 0.36)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x1, GROUND_Y - 236); ctx.quadraticCurveTo(mx, GROUND_Y - 178, x2, GROUND_Y - 236); ctx.stroke();
      for (let b = 1; b <= 7; b++) {
        const t = b / 8;
        const bx = x1 + (x2 - x1) * t;
        const by = (1 - t) * (1 - t) * (GROUND_Y - 236) + 2 * (1 - t) * t * (GROUND_Y - 178) + t * t * (GROUND_Y - 236);
        const glow = 0.65 + 0.35 * Math.sin(this.time * 3.4 + b + i);
        ctx.fillStyle = b % 2 === 0 ? `rgba(255, 232, 155, ${glow})` : `rgba(255, 150, 210, ${glow})`;
        ctx.shadowColor = b % 2 === 0 ? '#ffd479' : '#ff77ba'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(bx, by, 3.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Romantic wrought-iron balustrade railing with little heart arches!
    ctx.strokeStyle = 'rgba(42, 13, 36, 0.92)'; ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(42, 13, 36, 0.92)';
    ctx.fillRect(0, GROUND_Y - 46, STAGE_W, 6);
    for (let rx = 18; rx < STAGE_W; rx += 54) {
      ctx.fillRect(rx, GROUND_Y - 46, 5, 46);
      ctx.beginPath(); ctx.arc(rx + 27, GROUND_Y - 28, 12, Math.PI, 0); ctx.stroke();
    }

    // Golden floating fireflies in the garden!
    for (const ff of this.fireflies) {
      const fx = ff.x + Math.sin(this.time * ff.speed + ff.phase) * 24;
      const fy = ff.y + Math.cos(this.time * ff.speed * 0.8 + ff.phase) * 16;
      const a = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 3.5 + ff.phase));
      ctx.fillStyle = `rgba(255, 224, 140, ${a})`;
      ctx.shadowColor = '#ffd479'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(fx, fy, ff.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  _drawReflectiveBoardwalk(ctx) {
    // Glossy moonlit rose-marble promenade floor!
    const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H + 60);
    floorGrad.addColorStop(0, '#6b2c52');
    floorGrad.addColorStop(0.22, '#421836');
    floorGrad.addColorStop(0.7, '#240b21');
    floorGrad.addColorStop(1, '#140514');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GROUND_Y, STAGE_W, H - GROUND_Y + 80);

    // Moonlight sheen band along the promenade edge
    const edgeGrad = ctx.createLinearGradient(0, GROUND_Y, STAGE_W, GROUND_Y);
    edgeGrad.addColorStop(0, 'rgba(255, 180, 215, 0.25)');
    edgeGrad.addColorStop(0.5, 'rgba(255, 232, 180, 0.72)');
    edgeGrad.addColorStop(1, 'rgba(255, 180, 215, 0.25)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, GROUND_Y, STAGE_W, 4);

    // Perspective stone/marble tiles
    ctx.strokeStyle = 'rgba(255, 195, 228, 0.10)'; ctx.lineWidth = 1.6;
    for (let px = 0; px <= STAGE_W; px += 72) {
      ctx.beginPath(); ctx.moveTo(px, GROUND_Y); ctx.lineTo(px + (px - STAGE_W * 0.5) * 0.16, H + 40); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 34); ctx.lineTo(STAGE_W, GROUND_Y + 34); ctx.stroke();

    // Soft mirrored reflections of Wifebun & Husbun on the glossy moonlit promenade!
    [this.red, this.blue].forEach((f) => {
      ctx.save();
      ctx.globalAlpha = 0.16;
      const rGrad = ctx.createRadialGradient(f.x, GROUND_Y + 26, 4, f.x, GROUND_Y + 34, 48);
      rGrad.addColorStop(0, f.side === 'red' ? '#ff77ba' : '#60a5fa');
      rGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rGrad;
      ctx.beginPath(); ctx.ellipse(f.x, GROUND_Y + 28, 42, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    this._drawHeart(ctx, STAGE_W * 0.5, GROUND_Y + 28, 18, 'rgba(255, 130, 195, 0.35)');
  }

  // ==========================================================
  // CAPCOM SUPER-FREEZE CUT-IN WITH ILLUSTRATED BUNNY PORTRAIT!!
  // ==========================================================
  _drawSuperFreezeCutIn(ctx, sf) {
    const p = 1 - sf.timer / sf.maxTimer;
    const isWife = sf.side === 'red';
    ctx.save();

    // Dramatic speed-line burst
    ctx.translate(W * 0.5, H * 0.48);
    ctx.strokeStyle = isWife ? 'rgba(255, 119, 186, 0.40)' : 'rgba(96, 165, 250, 0.40)';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 + this.time * 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 120, Math.sin(a) * 120); ctx.lineTo(Math.cos(a) * 640, Math.sin(a) * 640); ctx.stroke();
    }

    // Diagonal Capcom Banner
    ctx.rotate(-0.07);
    const bandH = 128;
    const grad = ctx.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, 'rgba(24, 6, 30, 0.96)');
    grad.addColorStop(0.5, isWife ? 'rgba(225, 38, 128, 0.95)' : 'rgba(25, 78, 196, 0.95)');
    grad.addColorStop(1, 'rgba(24, 6, 30, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 4.5;
    ctx.strokeRect(-W, -bandH / 2, W * 2, bandH);

    // Big Illustrated Bunny Close-Up Portrait sliding in!
    const slide = (1 - Math.min(1, p * 4.5)) * (isWife ? -260 : 260);
    ctx.save();
    ctx.translate((isWife ? -255 : 255) + slide, 16);
    ctx.scale(isWife ? 2.1 : -2.1, 2.1);
    if (isWife) {
      this._drawWifebunHeadDetail(ctx, { winkTimer: 1, heartEyesTimer: 0, blushTimer: 1, hitFlash: 0, koState: false, cheekPuff: 0, earLag: 0, move: null });
    } else {
      this._drawHusbunHeadDetail(ctx, { heartEyesTimer: 0, hitFlash: 0, koState: false, earLag: 0, move: { id: 'eyp_report' } }, false);
    }
    ctx.restore();

    // Bold Super Name
    ctx.font = `700 58px 'Bangers', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#18061a';
    const text = `★ ${sf.title} ★`;
    ctx.strokeText(text, (isWife ? 70 : -70) + slide * 0.5, 20);
    ctx.fillStyle = '#ffd479';
    ctx.fillText(text, (isWife ? 70 : -70) + slide * 0.5, 20);

    ctx.restore();
  }

  // ==========================================================
  // CHARACTER 1: WIFEBUN — Glamour Lola-Bunny-Style Honey-Caramel Fighter!
  // Heroic scale (1.18x), lush curves, satin corset top, sheer thigh-highs,
  // sultry winks & dramatically expanding booty on PEAR BOUNCE!
  // ==========================================================
  _drawWifebunGlamour(ctx, f) {
    const dir = f.facing;
    const furBase = '#c98a58';
    const furHi = '#f0c49b';
    const furShade = '#8d532b';
    const cream = '#fff3e6';
    const ink = '#290f1d';
    const rose = '#ff4da6';
    const roseHi = '#ff99cc';
    const roseDark = '#ad1460';

    const t = this.time * 5.6;
    const isMoving = Math.abs(f.vx) > 25 && f.grounded && !f.move;
    const stride = Math.sin(f.runCycle);
    const hipSway = isMoving ? stride * 5.5 : Math.sin(t) * 6.0;
    const bounceY = f.koState
      ? 18 * f.koFallProgress
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8.5
      : Math.sin(t * 2) * 3.0;

    const isPearBounce = Boolean(f.move && f.move.id === 'pear_bounce' && f.move.phase !== 'recover');
    const isAttacking = Boolean(f.move && f.move.phase === 'active');
    const isWindup = Boolean(f.move && f.move.phase === 'windup');

    ctx.save();
    ctx.translate(f.x, f.y);

    // Ground shadow
    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, GROUND_Y - f.y + 4, 44 * airScale, 11 * airScale, 0, 0, Math.PI * 2); ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    // Romantic Aura
    if ((f.counterWindow > 0 || f.superMeter >= MAX_SUPER) && !f.koState) {
      ctx.save();
      ctx.strokeStyle = f.counterWindow > 0 ? 'rgba(255, 212, 121, 0.95)' : 'rgba(255, 105, 180, 0.72)';
      ctx.lineWidth = f.counterWindow > 0 ? 4.5 : 3.2;
      ctx.shadowColor = f.counterWindow > 0 ? '#ffd479' : '#ff4da6';
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.ellipse(0, -82, 56, 92, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, bounceY);
    if (f.rollAngle !== 0) {
      ctx.translate(0, -68); ctx.rotate(f.rollAngle); ctx.translate(0, 68);
    }

    // Heroic fighter scale (1.18x) + facing flip (spins hip-first on Pear Bounce!)
    const bodyFlip = isPearBounce ? -dir : dir;
    ctx.scale(bodyFlip * 1.18 * f.squashX, 1.18 * f.squashY);

    if (f.spinAngle !== 0) {
      const sx = Math.cos(f.spinAngle);
      ctx.scale(Math.abs(sx) < 0.28 ? 0.28 : sx, 1);
    }

    if (f.koState) {
      ctx.translate(0, 18 * f.koFallProgress);
      ctx.rotate(-0.46 * f.koFallProgress);
    }

    // === SLEEK CURVY LEGS WITH SHEER THIGH-HIGHS, GARTERS & HEELED BOOTS ===
    const backHipA = f.koState ? 0.85 : isPearBounce ? -0.42 : !f.grounded ? 0.45 : isMoving ? -stride * 0.65 : -0.26;
    const backKneeA = f.koState ? 0.4 : !f.grounded ? 0.65 : isMoving ? Math.max(0, stride * 0.75) : 0.24;
    const frontHipA = f.koState ? 1.05 : isPearBounce ? 0.48 : !f.grounded ? -0.32 : isMoving ? stride * 0.65 : 0.24;
    const frontKneeA = f.koState ? 0.35 : !f.grounded ? 0.75 : isMoving ? Math.max(0, -stride * 0.75) : 0.14;

    this._drawGlamourLolaLeg(ctx, -6 + hipSway * 0.3, -49, backHipA, backKneeA, furShade, '#e8cadb', roseDark, ink);

    // === BACK ARM ===
    const backShA = f.blocking ? -1.15 : isPearBounce ? 0.65 : isAttacking ? -0.8 : -0.45 + Math.sin(t) * 0.15;
    this._drawGlamourLolaArm(ctx, 9, -86, backShA, -0.75, furShade, roseDark, ink);

    // === CURVY HOURGLASS TORSO + DRAMATIC EXPANDING PEAR-BOUNCE BOOTY!! ===
    ctx.save();
    ctx.translate(hipSway * 0.38, 0);
    ctx.rotate(isPearBounce ? 0.38 : isAttacking ? 0.12 : isWindup ? -0.14 : Math.sin(t) * 0.055);

    // DRAMATICALLY EXPANDING BOOTY / HIPS (plush curve at 1.0 -> HUGE glowing pear-balloon at 3.15!!)
    const bs = f.buttScale || 1;
    ctx.save();
    ctx.translate(-11 - (bs - 1) * 14, -46);
    const buttGrad = ctx.createRadialGradient(-4 * bs, -5 * bs, 3, 0, 0, 19 * bs);
    buttGrad.addColorStop(0, '#ffb3da');
    buttGrad.addColorStop(0.55, rose);
    buttGrad.addColorStop(1, roseDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : buttGrad;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
    if (bs > 1.3) {
      ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 22;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * bs, 15 * bs, -0.18, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Satin specular sheen on booty
    ctx.fillStyle = 'rgba(255, 240, 250, 0.50)';
    ctx.beginPath(); ctx.ellipse(-4.5 * bs, -4.5 * bs, 5.5 * bs, 3.4 * bs, -0.42, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Fluffy white cotton bunny tail!
    ctx.fillStyle = '#fff9f5';
    ctx.beginPath(); ctx.arc(-12 * bs, -7 * bs * 0.65, 9.5 + (bs - 1) * 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Sculpted caramel waist & midriff
    const bodyGrad = ctx.createLinearGradient(-14, -92, 16, -50);
    bodyGrad.addColorStop(0, furHi);
    bodyGrad.addColorStop(0.55, furBase);
    bodyGrad.addColorStop(1, furShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : bodyGrad;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-11, -92);
    ctx.bezierCurveTo(-17, -75, -7, -62, -13, -50);
    ctx.lineTo(15, -50);
    ctx.bezierCurveTo(11, -62, 19, -76, 14, -92);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cream tummy highlight
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(4, -66, 6.5, 12, 0.08, 0, Math.PI * 2); ctx.fill();

    // Glamour Satin Sweetheart Crop Corset Top with Rose-Gold Trim!
    const topGrad = ctx.createLinearGradient(-15, -92, 17, -66);
    topGrad.addColorStop(0, '#ffd4e8');
    topGrad.addColorStop(0.45, rose);
    topGrad.addColorStop(1, roseDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : topGrad;
    ctx.beginPath();
    ctx.moveTo(-13, -89);
    ctx.quadraticCurveTo(-3, -95, 3, -88);
    ctx.quadraticCurveTo(11, -95, 16, -86);
    ctx.quadraticCurveTo(19, -73, 13, -68);
    ctx.quadraticCurveTo(1, -64, -13, -69);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Gold sweetheart trim & glowing heart charm
    ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-12, -89); ctx.quadraticCurveTo(-3, -94, 3, -88); ctx.quadraticCurveTo(11, -94, 15, -86); ctx.stroke();
    this._drawHeart(ctx, 4, -81, 4.5, '#ffd479');

    // Cheeky high-waisted rose shorts with satin ribbon bow!
    ctx.fillStyle = rose; ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-14, -55, 29, 15, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd4e8'; ctx.fillRect(-13, -55, 27, 3.8);

    ctx.restore(); // torso

    // === FRONT LEG ===
    this._drawGlamourLolaLeg(ctx, 6 + hipSway * 0.3, -49, frontHipA, frontKneeA, furBase, cream, rose, ink);

    // === EXPRESSIVE SULTRY LOLA-STYLE HEAD ===
    ctx.save();
    ctx.translate(3 + hipSway * 0.4, -113 + (f.stunTimer > 0 ? 4 : 0));
    if (isPearBounce) ctx.scale(-1, 1);
    ctx.rotate(f.stunTimer > 0 ? -0.22 : isAttacking ? 0.10 : Math.sin(t) * 0.06);
    this._drawWifebunHeadDetail(ctx, f, isPearBounce);
    ctx.restore();

    // === FRONT ARM (sassy hip-hand on Pear Bounce, flirty beckon in idle!) ===
    const fShA = f.blocking ? -1.35 : isPearBounce ? 0.55 : isAttacking ? -0.22 : 0.25 + Math.sin(t) * 0.14;
    const fElA = f.blocking ? -1.05 : isPearBounce ? 1.15 : isAttacking ? 0.05 : -0.88 - Math.sin(t) * 0.20;
    this._drawGlamourLolaArm(ctx, -4 + hipSway * 0.3, -86, fShA, fElA, furBase, rose, ink, isAttacking && !isPearBounce);

    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(30, -72, 38, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke(); ctx.fill();
    }

    ctx.restore();
  }

  _drawWifebunHeadDetail(ctx, f, isPearBounce = false) {
    const furBase = '#c98a58';
    const furHi = '#f0c49b';
    const furShade = '#8d532b';
    const cream = '#fff3e6';
    const ink = '#290f1d';
    const rose = '#ff4da6';

    // Long silky ponytail bunny ears with pink scrunchie & flowing satin ribbons!
    const earSway = Math.sin(this.time * 5.8) * 0.09 + (f.earLag || 0);
    ctx.save();
    ctx.translate(-12, -16);
    [
      { a: -0.96 + earSway, col: furShade, len: 50 },
      { a: -0.60 + earSway * 0.7, col: furBase, len: 54 },
    ].forEach((e) => {
      ctx.save();
      ctx.rotate(e.a);
      ctx.fillStyle = e.col; ctx.strokeStyle = ink; ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.bezierCurveTo(-14, -e.len * 0.45, -14, -e.len * 0.9, 0, -e.len);
      ctx.bezierCurveTo(13, -e.len * 0.85, 11, -e.len * 0.4, 5, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb8dc';
      ctx.beginPath(); ctx.ellipse(0, -e.len * 0.56, 4.8, e.len * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // Silk scrunchie + flowing ribbon tail
    ctx.strokeStyle = rose; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -9); ctx.quadraticCurveTo(-22, -2 + Math.sin(this.time * 7) * 5, -28, 12); ctx.stroke();
    ctx.fillStyle = rose; ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-7, -9, 9.5, 5.5, -0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe3f1'; ctx.beginPath(); ctx.arc(-7, -9, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Sculpted honey-caramel head with moonlight rim highlight!
    const headGrad = ctx.createRadialGradient(-4, -9, 3, 0, 0, 27);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.62, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, 0, 23, 21.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Swept glam Lola bangs
    ctx.fillStyle = furHi;
    ctx.beginPath();
    ctx.moveTo(-10, -16); ctx.quadraticCurveTo(4, -28, 20, -12); ctx.quadraticCurveTo(6, -15, -4, -10); ctx.closePath();
    ctx.fill(); ctx.stroke();

    if (f.move && f.move.id === 'dj_spin') {
      ctx.strokeStyle = '#ff69b4'; ctx.lineWidth = 4.2;
      ctx.beginPath(); ctx.arc(0, -3, 27, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.roundRect(-29, -9, 8.5, 18, 4); ctx.roundRect(20.5, -9, 8.5, 18, 4); ctx.fill();
    }

    // Muzzle (puffs on Coke Burp!)
    const puff = 1 + (f.cheekPuff || 0) * 0.65;
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(13, 7, 10.5 * puff, 7.5 * puff, 0, 0, Math.PI * 2); ctx.fill();

    // Cute pink triangular nose
    ctx.fillStyle = rose;
    ctx.beginPath(); ctx.moveTo(15, 2.5); ctx.lineTo(20, 4.5); ctx.lineTo(15.5, 6.5); ctx.closePath(); ctx.fill();

    // Warm rosy blush
    ctx.fillStyle = f.blushTimer > 0 ? 'rgba(255, 45, 128, 0.88)' : 'rgba(255, 118, 178, 0.58)';
    ctx.beginPath(); ctx.ellipse(2, 7.5, f.blushTimer > 0 ? 9 : 6.2, f.blushTimer > 0 ? 5 : 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Glossy rose lips (sultry kiss-pout or cheeky smile!)
    ctx.strokeStyle = '#4d1e2b'; ctx.lineWidth = 1.8;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#632814'; ctx.beginPath(); ctx.arc(16, 10, 5.5, 0, Math.PI * 2); ctx.fill();
    } else if (f.winkTimer > 0 || f.heartEyesTimer > 0 || isPearBounce) {
      ctx.fillStyle = '#ff3e9d';
      ctx.beginPath(); ctx.ellipse(15.5, 10, 4.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(16.5, 9, 1.1, 0, Math.PI * 2); ctx.fill();
    } else if (f.koState) {
      ctx.beginPath(); ctx.arc(13, 11, 3.2, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#ff69b4';
      ctx.beginPath(); ctx.ellipse(14.5, 10.2, 4.5, 2.4, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9.5, 9.5); ctx.quadraticCurveTo(14.5, 13.5, 19.5, 8.8); ctx.stroke();
    }

    // Sultry Big Lola Almond Eyes!
    const isBlinking = !f.koState && (this.time % 3.6) > 3.46;
    if (f.koState) {
      ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 2.6;
      [5, 16].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, -6); ctx.lineTo(ex + 3, 0); ctx.moveTo(ex + 3, -6); ctx.lineTo(ex - 3, 0); ctx.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 24, -30 + Math.sin(a) * 6, 6, '#ff77ba');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [5, 16].forEach((ex) => this._drawHeart(ctx, ex, -3, 6.8, '#ff4d9e'));
    } else {
      [5, 16].forEach((ex, idx) => {
        const winkThisEye = (f.winkTimer > 0 || isPearBounce) && idx === 1;
        if (isBlinking || winkThisEye) {
          ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(ex, -2, 4.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ex - 4, -2); ctx.lineTo(ex - 8.5, -5.8); ctx.stroke();
        } else {
          const rx = idx === 0 ? 5.8 : 4.8, ry = 6.4;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(ex, -3.2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6b2fa0';
          ctx.beginPath(); ctx.ellipse(ex + 1, -2.8, rx * 0.68, ry * 0.72, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1f0d1a';
          ctx.beginPath(); ctx.arc(ex + 1.2, -2.8, 2.3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex + 2.2, -5.6, 2.1, 0, Math.PI * 2); ctx.fill();
          // Shimmering rose-plum eyeshadow upper lid + sweeping winged lashes!
          ctx.fillStyle = 'rgba(255, 110, 185, 0.62)';
          ctx.beginPath(); ctx.arc(ex, -4.4, rx + 0.4, Math.PI, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = ink; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.arc(ex, -3.9, rx + 0.7, Math.PI * 1.0, Math.PI * 2.0); ctx.stroke();
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(ex - rx, -4.5); ctx.lineTo(ex - rx - 5, -9);
          ctx.moveTo(ex - 1.5, -9.2); ctx.lineTo(ex - 4.8, -13);
          ctx.stroke();
        }
      });
    }
  }

  _drawGlamourLolaLeg(ctx, x, y, hipA, kneeA, furCol, stockCol, bootCol, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);
    // Shapely caramel thigh
    ctx.fillStyle = furCol; ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-7, -2, 14, 25, 7); ctx.fill(); ctx.stroke();

    ctx.translate(0, 22);
    ctx.rotate(kneeA);
    // Sheer cream thigh-high stocking with rose garter & tiny heart!
    ctx.fillStyle = stockCol;
    ctx.beginPath(); ctx.roundRect(-5, -2, 10, 24, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = bootCol; ctx.fillRect(-5.5, -2, 11, 4);

    // Chic rose-pink heeled fighter boot
    ctx.fillStyle = bootCol;
    ctx.beginPath();
    ctx.moveTo(-5, 14); ctx.lineTo(5.5, 14); ctx.lineTo(14, 25); ctx.lineTo(-6, 25); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd479'; ctx.fillRect(-5, 22, 18, 2.5);
    ctx.restore();
  }

  _drawGlamourLolaArm(ctx, x, y, shA, elA, furCol, gloveCol, ink, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);
    ctx.fillStyle = furCol; ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-4, -4.5, 22, 9, 4.5); ctx.fill(); ctx.stroke();

    ctx.translate(18, 0);
    ctx.rotate(elA);
    const fLen = extended ? 24 : 18;
    ctx.beginPath(); ctx.roundRect(-3, -4, fLen, 8, 4); ctx.fill(); ctx.stroke();

    // Satin pink fingerless opera-fighter glove
    ctx.fillStyle = gloveCol;
    ctx.beginPath(); ctx.arc(fLen + 2, 0, extended ? 9.5 : 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ==========================================================
  // CHARACTER 2: HUSBUN — Tall, Handsome, Suave Bugs-Bunny-Style Fighter!
  // Heroic scale (1.18x), open velvet shirt + gold chain, confident smirk!
  // ==========================================================
  _drawHusbunGlamour(ctx, f) {
    const dir = f.facing;
    const furBase = '#6d4326';
    const furHi = '#996540';
    const furShade = '#452612';
    const cream = '#f7e6d2';
    const ink = '#1e0e14';
    const vestMain = '#1b3870';
    const vestShade = '#0f1f42';
    const gold = '#ffd479';

    const t = this.time * 5.0 + 1.4;
    const isMoving = Math.abs(f.vx) > 25 && f.grounded && !f.move;
    const stride = Math.sin(f.runCycle);
    const bounceY = f.koState
      ? 18 * f.koFallProgress
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8.5
      : Math.sin(t * 2) * 2.8;

    const isAttacking = Boolean(f.move && f.move.phase === 'active');
    const isWindup = Boolean(f.move && f.move.phase === 'windup');
    const isKissing = Boolean(f.move && f.move.id === 'forehead_kiss' && f.move.phase !== 'recover');

    ctx.save();
    ctx.translate(f.x, f.y);

    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.46)';
    ctx.beginPath(); ctx.ellipse(0, GROUND_Y - f.y + 4, 50 * airScale, 11.5 * airScale, 0, 0, Math.PI * 2); ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    if ((f.counterWindow > 0 || f.superMeter >= MAX_SUPER) && !f.koState) {
      ctx.save();
      ctx.strokeStyle = f.counterWindow > 0 ? 'rgba(255, 212, 121, 0.95)' : 'rgba(96, 165, 250, 0.72)';
      ctx.lineWidth = f.counterWindow > 0 ? 4.5 : 3.2;
      ctx.shadowColor = f.counterWindow > 0 ? '#ffd479' : '#60a5fa';
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.ellipse(0, -96, 64, 108, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, bounceY);
    if (f.rollAngle !== 0) {
      ctx.translate(0, -72); ctx.rotate(f.rollAngle); ctx.translate(0, 72);
    }

    // Heroic fighter scale (1.18x)
    ctx.scale(dir * 1.18 * f.squashX, 1.18 * f.squashY);

    if (f.koState) {
      ctx.translate(0, 20 * f.koFallProgress);
      ctx.rotate(-0.48 * f.koFallProgress);
    }

    // === TALL BUGS-STYLE ATHLETIC LEGS ===
    const legStretch = f.stretchH * 0.45;
    const hipY = -60 - legStretch;
    const backHipA = f.koState ? 0.85 : !f.grounded ? 0.45 : isMoving ? -stride * 0.65 : -0.28;
    const backKneeA = f.koState ? 0.4 : !f.grounded ? 0.65 : isMoving ? Math.max(0, stride * 0.75) : 0.26;
    const frontHipA = f.koState ? 1.05 : !f.grounded ? -0.32 : isMoving ? stride * 0.65 : 0.24;
    const frontKneeA = f.koState ? 0.35 : !f.grounded ? 0.78 : isMoving ? Math.max(0, -stride * 0.75) : 0.14;

    this._drawBugsLeg(ctx, -8, hipY, backHipA, backKneeA, legStretch, furShade, '#1d4ed8', ink);

    ctx.fillStyle = '#fff5eb'; ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-25, hipY - 2, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // === BACK ARM ===
    const torsoH = 58 + f.stretchH * 0.55;
    const torsoTop = hipY - torsoH;
    const backShA = f.blocking ? -1.15 : isAttacking ? -0.85 : isWindup ? 0.75 : -0.42 + Math.sin(t) * 0.12;
    this._drawBugsArm(ctx, 13, torsoTop + 14, backShA, -0.95, furShade, '#e2e8f0', ink);

    // === BROAD SUAVE MASCULINE TORSO WITH OPEN VELVET JACKET & GOLD CHAIN ===
    ctx.save();
    ctx.rotate(isKissing ? 0.30 : isAttacking ? 0.15 : isWindup ? -0.14 : Math.sin(t) * 0.035);

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : furBase;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(-25, torsoTop); ctx.lineTo(27, torsoTop); ctx.lineTo(18, hipY + 2); ctx.lineTo(-18, hipY + 2); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cream chest fur + sleek gold necklace chain!
    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.ellipse(4, torsoTop + torsoH * 0.48, 12.5, torsoH * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(4, torsoTop + 4, 11, 0.2, Math.PI - 0.2); ctx.stroke();

    // Open-front tailored midnight velvet fighter jacket!
    const vestGrad = ctx.createLinearGradient(-26, torsoTop, 26, hipY);
    vestGrad.addColorStop(0, '#2e57a6');
    vestGrad.addColorStop(0.5, vestMain);
    vestGrad.addColorStop(1, vestShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : vestGrad;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-26, torsoTop); ctx.lineTo(-5, torsoTop); ctx.lineTo(-4, hipY); ctx.lineTo(-19, hipY); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, torsoTop); ctx.lineTo(27, torsoTop); ctx.lineTo(19, hipY); ctx.lineTo(11, hipY); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Gold jacket trim & belt
    ctx.fillStyle = '#14244a';
    ctx.beginPath(); ctx.roundRect(-20, hipY - 6, 40, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.fillRect(-19, hipY - 6, 38, 5);

    ctx.restore();

    // === FRONT LEG ===
    this._drawBugsLeg(ctx, 8, hipY, frontHipA, frontKneeA, legStretch, furBase, '#2563eb', ink);

    // === HANDSOME BUGS-BUNNY-STYLE HEAD ===
    ctx.save();
    ctx.translate(4, torsoTop - 25 + (f.stunTimer > 0 ? 4 : 0));
    ctx.rotate(isKissing ? 0.26 : f.stunTimer > 0 ? -0.20 : isAttacking ? 0.14 : Math.sin(t) * 0.04);
    this._drawHusbunHeadDetail(ctx, f, isKissing);
    ctx.restore();

    // === FRONT ARM (classic crisp white Bugs gloves!) ===
    const fShA = f.blocking ? -1.35 : isAttacking ? -0.15 : isWindup ? 1.05 : 0.25 + Math.sin(t) * 0.10;
    const fElA = f.blocking ? -1.1 : isAttacking ? 0.05 : isWindup ? -0.9 : -1.05 + Math.sin(t * 2) * 0.16;
    this._drawBugsArm(ctx, -6, torsoTop + 14, fShA, fElA, furBase, '#ffffff', ink, isAttacking);

    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(34, hipY - 30, 44, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke(); ctx.fill();
    }

    ctx.restore();
  }

  _drawHusbunHeadDetail(ctx, f, isKissing = false) {
    const furBase = '#6d4326';
    const furHi = '#996540';
    const furShade = '#452612';
    const cream = '#f7e6d2';
    const ink = '#1e0e14';
    const gold = '#ffd479';

    // Tall iconic upright Bugs-style long ears
    const earSway = Math.sin(this.time * 5.0 + 1.2) * 0.06 + (f.earLag || 0);
    this._drawBugsEar(ctx, -9, -22, -0.22 + earSway, 10, 56, furShade, '#d49e81', ink, false);
    this._drawBugsEar(ctx, 7, -23, 0.12 - earSway * 0.6, 10, 54, furBase, '#e0ac8e', ink, true);

    const headGrad = ctx.createRadialGradient(-4, -8, 4, 0, 0, 30);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.65, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.ellipse(0, -2, 22, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Classic fluffy Bugs cheek tufts
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.moveTo(-18, 4); ctx.quadraticCurveTo(-28, 8, -19, 14);
    ctx.quadraticCurveTo(-8, 22, 14, 18);
    ctx.quadraticCurveTo(26, 14, 24, 4);
    ctx.quadraticCurveTo(16, -2, 4, 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Midnight-blue & gold headband with fluttering tails
    ctx.fillStyle = '#2563eb';
    ctx.beginPath(); ctx.roundRect(-22, -20, 44, 7.5, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.fillRect(-21, -17.5, 42, 2.2);
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -16);
    ctx.quadraticCurveTo(-34, -14 + Math.sin(this.time * 10) * 5, -44, -6 + Math.cos(this.time * 10) * 4);
    ctx.stroke();

    if (f.move && f.move.id === 'eyp_report') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeStyle = gold; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.roundRect(1, -12, 22, 12, 3); ctx.fill(); ctx.stroke();
    }

    ctx.fillStyle = '#c95c78';
    ctx.beginPath(); ctx.ellipse(19, 3, 4.4, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (isKissing) {
      ctx.fillStyle = '#ff4d9e';
      ctx.beginPath(); ctx.ellipse(22, 11, 5.8, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    } else if (f.koState) {
      ctx.strokeStyle = ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(14, 12, 3.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(6, 10); ctx.quadraticCurveTo(15, 16, 22, 9); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
      ctx.fillRect(14, 12, 4.5, 4.5); ctx.strokeRect(14, 12, 4.5, 4.5);
    }

    const isBlinking = !f.koState && ((this.time + 1.8) % 3.8) > 3.66;
    if (f.koState) {
      ctx.strokeStyle = gold; ctx.lineWidth = 2.6;
      [6, 16].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, -8); ctx.lineTo(ex + 3, -2); ctx.moveTo(ex + 3, -8); ctx.lineTo(ex - 3, -2); ctx.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 24, -34 + Math.sin(a) * 6, 6, '#60a5fa');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [6, 16].forEach((ex) => this._drawHeart(ctx, ex, -5, 6.4, '#ff69b4'));
    } else if (isBlinking) {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
      [6, 16].forEach((ex) => { ctx.beginPath(); ctx.moveTo(ex - 4, -5); ctx.lineTo(ex + 4, -5); ctx.stroke(); });
    } else {
      [6, 16].forEach((ex, idx) => {
        const rx = idx === 0 ? 4.8 : 4.2, ry = 7.2;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(ex, -6, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a0e07';
        ctx.beginPath(); ctx.ellipse(ex + 1, -5.2, 2.5, 3.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex + 1.7, -7.2, 1.3, 0, Math.PI * 2); ctx.fill();
        // Suave half-lidded confident upper brow!
        ctx.strokeStyle = '#241208'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(ex - 5, -12.5); ctx.lineTo(ex + 5, -10.5); ctx.stroke();
      });
    }
  }

  _drawBugsEar(ctx, x, y, angle, rx, ry, outerCol, innerCol, ink, bendTip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = outerCol; ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.bezierCurveTo(-13, -ry * 0.45, -11, -ry * 0.92, 0, -ry);
    ctx.bezierCurveTo(11, -ry * 0.92, 12, -ry * 0.45, 6, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = innerCol;
    ctx.beginPath(); ctx.ellipse(0, -ry * 0.52, rx * 0.46, ry * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    if (bendTip) {
      ctx.fillStyle = outerCol;
      ctx.beginPath(); ctx.ellipse(rx * 0.55, -ry * 0.94, rx * 0.72, rx * 0.52, 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  _drawBugsLeg(ctx, x, y, hipA, kneeA, stretch, furCol, shoeCol, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);
    const thighLen = 30 + stretch * 0.5;
    ctx.fillStyle = furCol; ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-7, -2, 14, thighLen, 6); ctx.fill(); ctx.stroke();

    ctx.translate(0, thighLen - 4);
    ctx.rotate(kneeA);
    const calfLen = 28 + stretch * 0.5;
    ctx.beginPath(); ctx.roundRect(-6.5, -2, 13, calfLen, 5); ctx.fill(); ctx.stroke();

    ctx.fillStyle = shoeCol;
    ctx.beginPath(); ctx.roundRect(-8, calfLen - 6, 26, 13, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, calfLen + 3, 26, 4);
    ctx.restore();
  }

  _drawBugsArm(ctx, x, y, shA, elA, furCol, gloveCol, ink, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);
    ctx.fillStyle = furCol; ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-5, -6, 26, 12, 6); ctx.fill(); ctx.stroke();

    ctx.translate(21, 0);
    ctx.rotate(elA);
    const fLen = extended ? 28 : 22;
    ctx.beginPath(); ctx.roundRect(-4, -5, fLen, 10, 5); ctx.fill(); ctx.stroke();

    ctx.fillStyle = gloveCol;
    ctx.beginPath(); ctx.arc(fLen + 4, 0, extended ? 12 : 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
      ctx.globalAlpha = alpha * 0.88;
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color; ctx.shadowBlur = 16;
      ctx.lineWidth = 15 * alpha; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, s.radius, -1.15, 0.95); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5.5 * alpha;
      ctx.beginPath(); ctx.arc(0, 0, s.radius - 4, -0.95, 0.75); ctx.stroke();
      ctx.restore();
    }
  }

  _drawHitSparks(ctx) {
    for (const h of this.hitSparks) {
      const alpha = Math.max(0, h.life / h.maxLife);
      const sc = 0.6 + (1 - alpha) * 0.85;
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;
      const drawStar = (r, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? r : r * 0.22;
          const a = (i * Math.PI) / 4;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
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
      if (pr.kind === 'mango_seed') {
        const dir = Math.sign(pr.vx || 1);
        const grad = ctx.createLinearGradient(-145 * dir, 0, 0, 0);
        grad.addColorStop(0, 'rgba(255, 183, 3, 0)');
        grad.addColorStop(1, 'rgba(255, 130, 0, 0.95)');
        ctx.strokeStyle = grad; ctx.lineWidth = 38; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-145 * dir, 0); ctx.lineTo(0, 0); ctx.stroke();

        ctx.rotate(pr.rot);
        ctx.shadowColor = '#ffb703'; ctx.shadowBlur = 26;
        ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#b45309'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-25, -4); ctx.lineTo(25, -4); ctx.moveTo(-19, 4); ctx.lineTo(19, 4); ctx.stroke();
      } else if (pr.kind === 'eyp_report') {
        ctx.rotate(pr.rot * 0.38);
        ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(-48, -60, 96, 120, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d4ed8'; ctx.fillRect(-46, -58, 92, 24);
        ctx.fillStyle = '#ffffff'; ctx.font = `700 14px 'Chakra Petch', sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('EYP REPORT', 0, -42);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-28, 6, 13, 28);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-6, -10, 13, 44);
        ctx.fillStyle = '#10b981'; ctx.fillRect(16, 14, 13, 20);
        ctx.rotate(-0.22);
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3.2;
        ctx.strokeRect(-38, -6, 76, 22);
        ctx.fillStyle = '#dc2626'; ctx.font = `700 13px 'Chakra Petch', sans-serif`;
        ctx.fillText('APPROVED ♥', 0, 9);
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
      if (v.kind === 'pear_bounce') {
        // Luminous rose-gold shockwave behind Wifebun's expanding Pear Bounce!
        ctx.strokeStyle = `rgba(255, 119, 186, ${1 - p})`;
        ctx.shadowColor = '#ff77ba'; ctx.shadowBlur = 18;
        ctx.lineWidth = 10 * (1 - p) + 2;
        ctx.beginPath();
        ctx.arc(fx + 38 * dir, fy - 62, 28 + p * 92, dir > 0 ? -1.0 : Math.PI - 1.0, dir > 0 ? 1.0 : Math.PI + 1.0);
        ctx.stroke();
      } else if (v.kind === 'dj_spin') {
        // Glamorous club spotlight cone + neon tornado rings!
        const cone = ctx.createLinearGradient(fx, fy - 240, fx, fy);
        cone.addColorStop(0, `rgba(255, 105, 180, ${0.42 * (1 - p)})`);
        cone.addColorStop(1, 'rgba(255, 105, 180, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath(); ctx.moveTo(fx - 20, fy - 240); ctx.lineTo(fx + 20, fy - 240); ctx.lineTo(fx + 100, fy); ctx.lineTo(fx - 100, fy); ctx.closePath(); ctx.fill();

        ctx.translate(fx, fy - 72);
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = r % 2 === 0 ? `rgba(255, 105, 180, ${1 - p})` : `rgba(255, 212, 121, ${1 - p})`;
          ctx.lineWidth = 6 - r * 1.4;
          ctx.beginPath(); ctx.ellipse(0, (r - 1) * 28, 48 + p * (84 - r * 12), 16, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.rotate(p * Math.PI * 8);
        ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      } else if (v.kind === 'coke_burp') {
        ctx.fillStyle = '#dc2626'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(fx + 22 * dir - 10, fy - 118, 20, 32, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(fx + 22 * dir - 9, fy - 106, 18, 6);
        for (let i = 0; i < 5; i++) {
          const wx = fx + (38 + p * 265 + i * 24) * dir;
          ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 120, 175, ${1 - p})` : `rgba(255, 232, 200, ${1 - p})`;
          ctx.lineWidth = 10 - i * 1.6;
          ctx.beginPath(); ctx.arc(wx, fy - 112, 24 + p * 56, dir > 0 ? -0.95 : Math.PI - 0.95, dir > 0 ? 0.95 : Math.PI + 0.95); ctx.stroke();
        }
      } else if (v.kind === 'white_claw') {
        ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(fx + 20 * dir - 9, fy - 140, 18, 34, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0ea5e9'; ctx.fillRect(fx + 20 * dir - 8, fy - 128, 16, 10);

        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - p * 0.72})`;
        ctx.lineWidth = 9; ctx.lineCap = 'round';
        [-24, 0, 24].forEach((off) => {
          ctx.beginPath();
          ctx.moveTo(fx + 12 * dir, fy - 118 + off);
          ctx.quadraticCurveTo(fx + 82 * dir, fy - 98 + off, fx + 160 * dir, fy - 72 + off);
          ctx.stroke();
        });
      } else if (v.kind === 'height_mog') {
        // Spotlight on towering Husbun + golden 6'5" ruler!
        const cone = ctx.createLinearGradient(fx, fy - 340, fx, fy);
        cone.addColorStop(0, `rgba(255, 212, 121, ${0.42 * (1 - p)})`);
        cone.addColorStop(1, 'rgba(255, 212, 121, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath(); ctx.moveTo(fx - 35, fy - 340); ctx.lineTo(fx + 35, fy - 340); ctx.lineTo(fx + 110, fy); ctx.lineTo(fx - 110, fy); ctx.closePath(); ctx.fill();

        const rx = fx - 68 * dir;
        const rh = 315 * Math.min(1, p * 2.2);
        ctx.shadowColor = '#ffd479'; ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffd479'; ctx.strokeStyle = '#854d0e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(rx, GROUND_Y - rh, 26, rh, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#422006'; ctx.lineWidth = 2;
        for (let ty = 14; ty < rh - 10; ty += 16) {
          ctx.beginPath(); ctx.moveTo(rx, GROUND_Y - ty); ctx.lineTo(rx + (ty % 32 === 0 ? 14 : 8), GROUND_Y - ty); ctx.stroke();
        }
        ctx.font = `700 34px 'Bangers', Impact, sans-serif`;
        ctx.fillStyle = '#ffd479'; ctx.strokeStyle = '#18061a'; ctx.lineWidth = 5;
        ctx.strokeText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
        ctx.fillText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
      } else if (v.kind === 'forehead_kiss') {
        ctx.globalAlpha = 1 - p;
        this._drawHeart(ctx, fx + 44 * dir, fy - 132, 22 + p * 16, '#ff4da6');
      } else if (v.kind === 'kiss_bloom') {
        const sc = 0.85 + Math.sin(p * Math.PI) * 1.25;
        ctx.translate(v.x, v.y - p * 36);
        ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - p * 0.55;
        ctx.shadowColor = '#ff4da6'; ctx.shadowBlur = 28;
        this._drawHeart(ctx, 0, 0, 38, '#ff3e9d');
        ctx.font = `36px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('💋', 0, 12);
      }
      ctx.restore();
    }
  }

  _drawAfterimages(ctx) {
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life / a.maxLife) * 0.48;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(a.x, a.y - (a.isWifebun ? 72 : 90));
      ctx.rotate(a.rollAngle || 0);
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, a.isWifebun ? 28 : 34, a.isWifebun ? 62 : 76, 0, 0, Math.PI * 2);
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
      ctx.globalAlpha = 0.62;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.isHeart) this._drawHeart(ctx, 0, 0, p.size * 1.15, p.color);
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
        this._drawHeart(ctx, 0, 0, p.size * 1.65, p.color);
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
