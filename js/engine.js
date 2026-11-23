import { sound } from './audio.js';
import { StageRenderer } from './stage-renderer.js';
import { CharacterRenderer } from './character-renderer.js';

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
const INPUT_BUFFER_WINDOW = 0.125; // ~125ms fighting-game input buffer

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
    inputBuffer: null,

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

    // Crisp Retina / High-DPI canvas rendering
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = W * this.dpr;
    this.canvas.height = H * this.dpr;

    // Delegated stage and character/VFX renderers
    this.stage = new StageRenderer(W, H, STAGE_W, GROUND_Y);
    this.chars = new CharacterRenderer(W, H, STAGE_W, GROUND_Y, MAX_SUPER);

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
    this.camZoomPulse = 0;
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

    this._nextProjId = 1;
    this.cpuDecisionTimer = 0.4;
    this.cpuMoveIntent = 0;
    this.cpuBlockTimer = 0;
    this._lastHudSync = 0;
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
    this.camZoomPulse = 0;
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
    f.inputBuffer = null;
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
    f.earLag = 0;
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
      this._emitNetEvent('super_ready', { side: f.side, x: f.x, y: f.y });
    }
  }

  // ==========================
  // PLAYER INPUTS & BUFFERING
  // ==========================
  setInput(side, key, value) {
    const f = side === 'red' ? this.red : this.blue;
    if (key in f.inputs) f.inputs[key] = Boolean(value);
  }

  clearInputs(side) {
    const targets = side ? [side === 'red' ? this.red : this.blue] : [this.red, this.blue];
    for (const f of targets) {
      f.inputs.left = false;
      f.inputs.right = false;
      f.inputs.block = false;
      f.inputBuffer = null;
    }
  }

  triggerJump(side) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.koState) return false;

    if (!this.superFreeze && this.hitStop <= 0 && this._executeJump(side)) {
      f.inputBuffer = null;
      return true;
    }

    f.inputBuffer = { type: 'jump', timer: INPUT_BUFFER_WINDOW };
    return false;
  }

  _executeJump(side) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    if (!f.grounded || f.koState || f.stunTimer > 0 || f.dodgeTimer > 0) return false;
    if (f.move && f.move.phase !== 'recover') return false;

    f.move = null;
    f.blocking = false;
    f.grounded = false;
    f.vy = side === 'red' ? -710 : -680;
    f.squashX = 0.80;
    f.squashY = 1.24;
    sound.playJump();
    this._spawnDust(f.x, GROUND_Y, 7);
    return true;
  }

  triggerDodge(side) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.koState) return false;

    if (!this.superFreeze && this.hitStop <= 0 && this._executeDodge(side)) {
      f.inputBuffer = null;
      return true;
    }

    f.inputBuffer = { type: 'dodge', timer: INPUT_BUFFER_WINDOW };
    return false;
  }

  _executeDodge(side) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.koState || f.stunTimer > 0 || f.dodgeTimer > 0 || f.dodgeCooldown > 0) return false;

    f.blocking = false;
    f.move = null;
    f.dodgeTimer = 0.36; // Full 0-damage invincibility window!
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
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    const def = FIGHTER_MOVES[side]?.[moveIndex];
    if (!def || f.koState) return false;

    if (def.isSuper && f.superMeter < MAX_SUPER) {
      this._spawnCallout(f.x, f.y - 165, `SUPER ${Math.floor(f.superMeter)}%`, '#ffd479', 0.72);
      return false;
    }

    if (!this.superFreeze && this.hitStop <= 0 && this._executeMove(side, moveIndex, false)) {
      f.inputBuffer = null;
      return true;
    }

    f.inputBuffer = { type: 'move', moveIndex, timer: INPUT_BUFFER_WINDOW };
    return false;
  }

  _executeMove(side, moveIndex, isBuffered = false) {
    if (this.phase !== 'fighting' || this.superFreeze) return false;
    const f = side === 'red' ? this.red : this.blue;
    const opp = side === 'red' ? this.blue : this.red;
    if (f.koState || f.stunTimer > 0 || f.move || f.blocking || f.dodgeTimer > 0) return false;

    const def = FIGHTER_MOVES[side]?.[moveIndex];
    if (!def) return false;

    if (def.isSuper) {
      if (f.superMeter < MAX_SUPER) {
        if (!isBuffered) {
          this._spawnCallout(f.x, f.y - 165, `SUPER ${Math.floor(f.superMeter)}%`, '#ffd479', 0.72);
        }
        return false;
      }
      f.superMeter = 0;
      f.superNotified = false;
      this.superFreeze = { side, moveId: def.id, title: def.callout, color: def.color, timer: 0.58, maxTimer: 0.58 };
      this.camZoomPulse = Math.max(this.camZoomPulse, 0.105);
      sound.playSuperFreeze();
      this._emitNetEvent('super_freeze', { side, moveId: def.id, title: def.callout, color: def.color });
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
    this._emitNetEvent('move_start', { side, moveId: def.id, x: f.x, y: f.y, dir: f.facing, isSuper: def.isSuper });
    return true;
  }

  _consumeInputBuffer(f) {
    if (!f.inputBuffer || this.phase !== 'fighting' || this.superFreeze || f.koState) return;
    const buf = f.inputBuffer;
    let fired = false;
    if (buf.type === 'move') {
      fired = this._executeMove(f.side, buf.moveIndex, true);
    } else if (buf.type === 'dodge') {
      fired = this._executeDodge(f.side);
    } else if (buf.type === 'jump') {
      fired = this._executeJump(f.side);
    }
    if (fired) {
      f.inputBuffer = null;
    }
  }

  // ==========================
  // SIMULATION UPDATE
  // ==========================
  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;

    this.stage.update(clampedDt, this.time);
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
      this.camZoomPulse += (0.095 - this.camZoomPulse) * Math.min(1, clampedDt * 12);
      if (this.superFreeze.timer <= 0) {
        const sfSide = this.superFreeze.side;
        const sfMoveId = this.superFreeze.moveId;
        this.superFreeze = null;
        const sfFighter = sfSide === 'red' ? this.red : this.blue;
        const playId = sfMoveId || (sfFighter.move && sfFighter.move.id);
        if (playId) sound.playMove(playId);
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
        if (typeof f._netButtScale === 'number') {
          f.buttScale += (f._netButtScale - f.buttScale) * Math.min(1, clampedDt * 22);
        }
        if (typeof f._netStretchH === 'number') {
          f.stretchH += (f._netStretchH - f.stretchH) * Math.min(1, clampedDt * 18);
        }
        if (typeof f._netCheekPuff === 'number') {
          f.cheekPuff += (f._netCheekPuff - f.cheekPuff) * Math.min(1, clampedDt * 18);
        }
        if (f.dodgeTimer > 0 && Math.random() < clampedDt * 30) {
          this._spawnAfterimage(f);
        }
        if (f.grounded && Math.abs(f.vx) > 220 && !f.move && Math.random() < clampedDt * 9) {
          this._spawnDust(f.x - Math.sign(f.vx) * 18, GROUND_Y, 1);
        }
        if (f.superMeter >= MAX_SUPER && Math.random() < clampedDt * 7) {
          this._spawnSparks(f.x + (Math.random() - 0.5) * 52, f.y - 25 - Math.random() * 110, '#ffd479', 1, 'heart');
        }
        f.squashX += (1 - f.squashX) * Math.min(1, clampedDt * 13);
        f.squashY += (1 - f.squashY) * Math.min(1, clampedDt * 13);
        f.earLag += (-f.vx * 0.0012 - f.earLag) * Math.min(1, clampedDt * 10);
      });

      // Smooth 60fps projectile velocity prediction between 30Hz snapshots
      for (const pr of this.projectiles) {
        pr.x += (pr.vx || 0) * clampedDt;
        pr.y += (pr.vy || 0) * clampedDt;
        if (pr.kind === 'eyp_report') {
          pr.vy = (pr.vy || 0) + 1280 * clampedDt;
        }
        pr.rot = (pr.rot || 0) + clampedDt * (pr.kind === 'mango_seed' ? 16 : 8) * Math.sign(pr.vx || 1);
      }

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

    this.camZoomPulse *= Math.pow(0.0025, dt);
    if (this.camZoomPulse < 0.0005) this.camZoomPulse = 0;

    const effectiveZoom = targetZoom + this.camZoomPulse;
    const halfView = (W * 0.5) / effectiveZoom;
    const clampedMid = Math.max(halfView + 16, Math.min(STAGE_W - halfView - 16, midX));

    this.camX += (clampedMid - this.camX) * Math.min(1, dt * 7.5);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 5.2);
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
    if (f.inputBuffer) {
      f.inputBuffer.timer -= dt;
      if (f.inputBuffer.timer <= 0) f.inputBuffer = null;
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

    // Execute buffered input on the very first available frame!
    if (f.inputBuffer) {
      f.blocking = Boolean(f.inputs.block && f.grounded && !f.move && f.stunTimer <= 0 && f.dodgeTimer <= 0);
      this._consumeInputBuffer(f);
    }

    f.squashX += (1 - f.squashX) * Math.min(1, dt * 13);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 13);

    // DRAMATIC EXPANDING BOOTY FOR PEAR BOUNCE (up to 3.2x!)
    const targetButt = f.move && f.move.id === 'pear_bounce' && f.move.phase === 'active'
      ? 3.2
      : f.move && f.move.id === 'pear_bounce' && f.move.phase === 'windup'
      ? 1.7
      : 1.0;
    f.buttScale += (targetButt - f.buttScale) * Math.min(1, dt * 24);

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
        id: this._nextProjId++,
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
        id: this._nextProjId++,
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
          this._emitNetEvent('eyp_slam', { x: pr.x });
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
      this.hitStop = 0.072;
      this.camZoomPulse = Math.max(this.camZoomPulse, 0.065);
      this._spawnShockwave(ix, iy, '#c084fc', 125);
      this._spawnSparks(ix, iy, '#e9d5ff', 16, 'heart');
      this._spawnCallout(ix, iy - 48, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
      this._emitNetEvent('perfect_dodge', { x: ix, y: iy });
      return;
    }

    // 2. BLOCK -> TINY CHIP DAMAGE (~8%, min 1 HP, never chip-KOs) + +22% SPECIAL SUPER GAIN!
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
      this.hitStop = move.isSuper ? 0.125 : move.isCounter ? 0.09 : move.heavy ? 0.064 : 0.04;
      this.shake = move.isSuper ? 20 : move.isCounter ? 15 : move.heavy ? 11 : 6;
      if (move.isSuper) this.camZoomPulse = Math.max(this.camZoomPulse, 0.10);
      else if (move.isCounter) this.camZoomPulse = Math.max(this.camZoomPulse, 0.078);
      else if (move.heavy) this.camZoomPulse = Math.max(this.camZoomPulse, 0.055);

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
        targetX: defender.x,
        targetY: defender.y,
        moveId: move.id,
        color: move.color,
        word: label,
        heavy: move.heavy || move.isSuper,
        isSuper: move.isSuper,
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
    loser.inputBuffer = null;
    const fallDir = loser.x >= winner.x ? 1 : -1;
    loser.vx = fallDir * 410;
    loser.vy = -450;
    loser.grounded = false;

    this.phase = 'ko';
    this.phaseTimer = 2.85;
    this.hitStop = byTimeout ? 0.05 : 0.24;
    this.shake = 22;
    this.camZoomPulse = Math.max(this.camZoomPulse, 0.135);

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
      side: f.side,
      isWifebun: f.side === 'red',
      facing: f.facing,
      rollAngle: f.rollAngle,
      squashX: f.squashX,
      squashY: f.squashY,
      buttScale: f.buttScale,
      stretchH: f.stretchH,
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
  // NETWORK SYNC (30Hz SNAPSHOTS + 60fps GUEST PREDICTION & FULL VFX PARITY)
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
        id: p.id,
        kind: p.kind,
        owner: p.owner,
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(p.vx),
        vy: Math.round(p.vy || 0),
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
      const curButt = target.buttScale;
      const curStretch = target.stretchH;
      const curCheek = target.cheekPuff;

      Object.assign(target, src);
      target._netX = src.x;
      target._netY = src.y;
      target._netButtScale = src.buttScale;
      target._netStretchH = src.stretchH;
      target._netCheekPuff = src.cheekPuff;

      if (!snap) {
        target.x = curX;
        target.y = curY;
        target.buttScale = curButt;
        target.stretchH = curStretch;
        target.cheekPuff = curCheek;
      }
    };

    syncFighter(this.red, s.red);
    syncFighter(this.blue, s.blue);

    // Smooth projectile reconciliation with 60fps local velocity prediction
    const prevById = new Map();
    for (const oldP of this.projectiles) {
      if (oldP.id != null) prevById.set(oldP.id, oldP);
    }
    this.projectiles = (s.projectiles || []).map((p) => {
      const existing = p.id != null ? prevById.get(p.id) : null;
      if (existing && Math.hypot(p.x - existing.x, p.y - existing.y) < 140) {
        return {
          ...p,
          x: existing.x + (p.x - existing.x) * 0.45,
          y: existing.y + (p.y - existing.y) * 0.45,
        };
      }
      return { ...p };
    });

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
      this.superFreeze = {
        side: ev.side,
        moveId: ev.moveId,
        title: ev.title,
        color: ev.color,
        timer: 0.58,
        maxTimer: 0.58,
      };
      this.camZoomPulse = Math.max(this.camZoomPulse, 0.105);
      sound.playSuperFreeze();
    } else if (ev.kind === 'super_ready') {
      sound.playSuperReady();
      this._spawnCallout(ev.x, ev.y - 175, '★ SUPER READY! ★', '#ffd479', 0.94);
      this._spawnSparks(ev.x, ev.y - 88, '#ffd479', 16, 'heart');
    } else if (ev.kind === 'move_start') {
      if (!ev.isSuper) sound.playMove(ev.moveId);
      const f = ev.side === 'red' ? this.red : this.blue;
      if (f) {
        f.squashX = 1.20;
        f.squashY = 0.82;
      }
      if (ev.moveId === 'pear_bounce') {
        this._spawnShockwave(ev.x + ev.dir * 42, ev.y - 62, '#ff77ba', 105);
        this._spawnSmear(ev.x + ev.dir * 44, ev.y - 64, ev.dir, '#ffd479', 88);
        this.vfx.push({ kind: 'pear_bounce', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.46 });
      } else if (ev.moveId === 'mango_seed') {
        this.shake = Math.max(this.shake, 11);
        this._spawnShockwave(ev.x + ev.dir * 48, ev.y - 84, '#ffb703', 135);
        this._spawnSmear(ev.x + ev.dir * 46, ev.y - 84, ev.dir, '#ffd479', 96);
      } else if (ev.moveId === 'eyp_report') {
        this.shake = Math.max(this.shake, 11);
        this._spawnSmear(ev.x + ev.dir * 40, ev.y - 124, ev.dir, '#60a5fa', 94);
      } else if (ev.moveId === 'height_mog') {
        this.dramaticDim = 0.50;
        this._spawnSmear(ev.x + ev.dir * 40, ev.y - 135, ev.dir, '#ffd479', 88);
        this.vfx.push({ kind: 'height_mog', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.62 });
      } else if (ev.moveId === 'dj_spin') {
        this._spawnSmear(ev.x, ev.y - 78, ev.dir, '#ff69b4', 84);
        this.vfx.push({ kind: 'dj_spin', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.50 });
      } else if (ev.moveId === 'white_claw') {
        this._spawnSmear(ev.x + ev.dir * 48, ev.y - 102, ev.dir, '#38bdf8', 88);
        this.vfx.push({ kind: 'white_claw', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.46 });
      } else if (ev.moveId === 'coke_burp') {
        this.vfx.push({ kind: 'coke_burp', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.50 });
      } else if (ev.moveId === 'forehead_kiss') {
        this.romanceBloom = 0.35;
        this.vfx.push({ kind: 'forehead_kiss', side: ev.side, x: ev.x, y: ev.y, dir: ev.dir, t: 0, duration: 0.48 });
      }
    } else if (ev.kind === 'dodge') {
      sound.playDodge();
      this._spawnDust(ev.x, GROUND_Y, 6);
      this._spawnAfterimage(ev.side === 'red' ? this.red : this.blue);
    } else if (ev.kind === 'perfect_dodge') {
      sound.playPerfectDodge();
      this.camZoomPulse = Math.max(this.camZoomPulse, 0.065);
      this._spawnShockwave(ev.x, ev.y, '#c084fc', 125);
      this._spawnSparks(ev.x, ev.y, '#e9d5ff', 16, 'heart');
      this._spawnCallout(ev.x, ev.y - 48, 'PERFECT DODGE! 0 DMG ♥', '#e9d5ff', 0.95);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 46);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 78);
      this._spawnCallout(ev.x, ev.y - 44, 'GUARD! +SUPER ✨', '#ffd479', 0.84);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'eyp_slam') {
      this._spawnShockwave(ev.x, GROUND_Y - 10, '#60a5fa', 160);
      this._spawnSparks(ev.x, GROUND_Y - 16, '#ffffff', 18, 'page');
      this.shake = Math.max(this.shake, 10);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter || ev.isSuper);
      this.shake = ev.isSuper ? 20 : ev.counter ? 15 : ev.heavy ? 11 : 6;
      if (ev.isSuper) this.camZoomPulse = Math.max(this.camZoomPulse, 0.10);
      else if (ev.counter) this.camZoomPulse = Math.max(this.camZoomPulse, 0.078);
      else if (ev.heavy) this.camZoomPulse = Math.max(this.camZoomPulse, 0.055);

      if (ev.moveId === 'forehead_kiss') {
        this.romanceBloom = 0.55;
        const kx = ev.targetX ?? ev.x;
        const ky = ev.targetY != null ? ev.targetY - 134 : ev.y - 36;
        this.vfx.push({ kind: 'kiss_bloom', x: kx, y: ky, t: 0, duration: 0.82 });
      }
      this._spawnHitSpark(ev.x, ev.y, ev.isSuper ? '#ffd479' : ev.color, ev.isSuper ? 94 : ev.heavy ? 68 : 48);
      this._spawnShockwave(ev.x, ev.y, ev.counter ? '#ffd479' : ev.color, ev.isSuper ? 165 : ev.heavy ? 130 : 88);
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 42, ev.word, ev.counter || ev.isSuper ? '#ffd479' : ev.color, ev.isSuper ? 1.25 : 0.98);
      if (ev.combo >= 2) {
        this._spawnCallout(ev.x, ev.y - 88, `${ev.combo} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.84);
      }
    } else if (ev.kind === 'ko') {
      sound.playKO();
      this.shake = 22;
      this.camZoomPulse = Math.max(this.camZoomPulse, 0.135);
      this._spawnHitSpark(ev.x, ev.y, '#ffd479', 105);
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 210);
      if (ev.color) this._spawnShockwave(ev.x, ev.y, ev.color, 150);
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
  // RENDERING (DELEGATED TO StageRenderer & CharacterRenderer)
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    this.stage.drawSky(ctx, this.camX, this.time);

    ctx.save();
    const effectiveZoom = this.camZoom + this.camZoomPulse;
    ctx.translate(W / 2, H * 0.56);
    ctx.scale(effectiveZoom, effectiveZoom);
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.translate(-this.camX, -H * 0.56);

    this.stage.drawMidground(ctx, this.camX, this.time);
    this.stage.drawFloor(ctx, [this.red, this.blue], this.time);

    if (this.dramaticDim > 0.02 || this.superFreeze) {
      ctx.fillStyle = `rgba(12, 3, 20, ${this.superFreeze ? 0.65 : this.dramaticDim})`;
      ctx.fillRect(0, 0, STAGE_W, H);
    }

    this.chars.drawAfterimages(ctx, this.afterimages);

    const redOnTop = Boolean(this.red.move && this.red.move.phase === 'active');
    if (redOnTop) {
      this.chars.drawFighter(ctx, this.blue, this.time);
      this.chars.drawFighter(ctx, this.red, this.time);
    } else {
      this.chars.drawFighter(ctx, this.red, this.time);
      this.chars.drawFighter(ctx, this.blue, this.time);
    }

    this.chars.drawSmears(ctx, this.smears);
    this.chars.drawProjectiles(ctx, this.projectiles, this.time);
    this.chars.drawVfx(ctx, this.vfx, { red: this.red, blue: this.blue }, this.time);
    this.chars.drawShockwaves(ctx, this.shockwaves);
    this.chars.drawHitSparks(ctx, this.hitSparks);
    this.chars.drawParticles(ctx, this.particles);
    this.chars.drawCallouts(ctx, this.callouts);

    ctx.restore();

    this.stage.drawForeground(ctx, this.time, this.romanceBloom);

    if (this.superFreeze) {
      this.chars.drawSuperFreezeCutIn(ctx, this.superFreeze, this.time);
    }

    ctx.restore();
  }
}
