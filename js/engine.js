import { sound } from './audio.js';

const W = 960;
const H = 540;
const STAGE_W = 1480;
const GROUND_Y = 448;
const GRAVITY = 1780;

const MAX_HP = 100;
const MAX_STAMINA = 100;
const ROUND_TIME = 99;

export const FIGHTER_MOVES = {
  red: [
    {
      id: 'pear_bounce',
      label: 'PEAR BOUNCE',
      emoji: '🍐',
      damage: 10,
      stamina: 14,
      windup: 0.10,
      active: 0.20,
      recover: 0.16,
      callout: 'PEAR BOUNCE!',
      color: '#bef264',
      heavy: false,
    },
    {
      id: 'dj_spin',
      label: 'DJ SPIN',
      emoji: '🎧',
      damage: 13,
      stamina: 18,
      windup: 0.09,
      active: 0.34,
      recover: 0.18,
      callout: 'DJ SPIN! ♫',
      color: '#ff69b4',
      heavy: false,
    },
    {
      id: 'mango_seed',
      label: 'MANGO SEED',
      emoji: '🥭',
      damage: 15,
      stamina: 22,
      windup: 0.14,
      active: 0.22,
      recover: 0.20,
      callout: 'MANGO SEED!!',
      color: '#ffb703',
      heavy: true,
    },
    {
      id: 'coke_burp',
      label: 'COKE BURP',
      emoji: '🥤',
      damage: 14,
      stamina: 22,
      windup: 0.14,
      active: 0.34,
      recover: 0.20,
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
      damage: 12,
      stamina: 15,
      windup: 0.08,
      active: 0.28,
      recover: 0.15,
      callout: 'WHITE CLAW!',
      color: '#38bdf8',
      heavy: false,
    },
    {
      id: 'height_mog',
      label: 'HEIGHT MOG',
      emoji: '📏',
      damage: 15,
      stamina: 20,
      windup: 0.14,
      active: 0.32,
      recover: 0.20,
      callout: 'HEIGHT MOGGED!',
      color: '#ffd479',
      heavy: true,
    },
    {
      id: 'forehead_kiss',
      label: 'FOREHEAD KISS',
      emoji: '💋',
      damage: 13,
      stamina: 17,
      windup: 0.10,
      active: 0.30,
      recover: 0.17,
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
      windup: 0.15,
      active: 0.24,
      recover: 0.20,
      callout: 'EYP REPORT!!',
      color: '#60a5fa',
      heavy: true,
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
    stamina: MAX_STAMINA,
    blocking: false,
    inputs: { left: false, right: false, block: false },

    move: null,
    dodgeTimer: 0,
    dodgeCooldown: 0,
    dodgeDir: 0,

    stunTimer: 0,
    blushTimer: 0,
    heartEyesTimer: 0,
    hitFlash: 0,
    counterWindow: 0,
    koState: false,
    koFallProgress: 0,

    // Procedural animation channels
    runCycle: 0,
    squashX: 1,
    squashY: 1,
    stretchH: 0,
    spinAngle: 0,
    rollAngle: 0,
    earLag: 0,
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

    this.mode = 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
    this.humanSide = 'red';
    this.cpuDifficulty = 'medium';
    this.bestOf = 3;
    this.roundsToWin = 2;

    this.red = createFighter('red', STAGE_W * 0.5 - 190);
    this.blue = createFighter('blue', STAGE_W * 0.5 + 190);

    this.round = 1;
    this.roundTimer = ROUND_TIME;
    this.phase = 'idle'; // 'idle' | 'intro' | 'fighting' | 'ko' | 'match_over'
    this.phaseTimer = 0;
    this.matchWinner = null;

    this.time = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.camX = STAGE_W * 0.5;
    this.camZoom = 1.0;
    this.dramaticDim = 0;

    this.projectiles = [];
    this.vfx = [];
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
    for (let i = 0; i < 34; i++) {
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
    this.camZoom = 1.03;
    this.dramaticDim = 0;

    this.projectiles = [];
    this.vfx = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.particles = [];
    this.callouts = [];

    this._emitBanner(`ROUND ${this.round}`, '🌸 MOONLIT BEATDOWN SESH 🌸');
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
    f.stamina = MAX_STAMINA;
    f.blocking = false;
    f.inputs = { left: false, right: false, block: false };
    f.move = null;
    f.dodgeTimer = 0;
    f.dodgeCooldown = 0;
    f.stunTimer = 0;
    f.blushTimer = 0;
    f.heartEyesTimer = 0;
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
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (!f.grounded || f.koState || f.stunTimer > 0 || f.dodgeTimer > 0) return false;
    if (f.move && f.move.phase !== 'recover') return false;

    f.grounded = false;
    f.vy = side === 'red' ? -680 : -655; // Wifebun slightly bouncier jump!
    f.squashX = 0.82;
    f.squashY = 1.22;
    sound.playJump();
    this._spawnSparks(f.x, GROUND_Y, '#ffd479', 6, 'dot');
    return true;
  }

  triggerDodge(side) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    if (f.koState || f.stunTimer > 0 || f.dodgeTimer > 0 || f.dodgeCooldown > 0) return false;
    if (f.stamina < 12) return false;

    f.stamina = Math.max(0, f.stamina - 14);
    f.blocking = false;
    f.move = null;
    f.dodgeTimer = 0.30;
    f.dodgeCooldown = 0.44;

    const dir = f.inputs.left ? -1 : f.inputs.right ? 1 : -f.facing;
    f.dodgeDir = dir;
    f.vx = dir * 560;
    if (f.grounded) {
      f.vy = -190;
      f.grounded = false;
    }
    f.squashX = 1.18;
    f.squashY = 0.84;

    sound.playDodge();
    this._spawnAfterimage(f);
    this._emitNetEvent('dodge', { side, x: f.x, y: f.y });
    return true;
  }

  triggerMove(side, moveIndex) {
    if (this.phase !== 'fighting') return false;
    const f = side === 'red' ? this.red : this.blue;
    const opp = side === 'red' ? this.blue : this.red;
    if (f.koState || f.stunTimer > 0 || f.move || f.blocking || f.dodgeTimer > 0) return false;

    const def = FIGHTER_MOVES[side]?.[moveIndex];
    if (!def) return false;
    if (f.stamina < def.stamina * 0.55) return false;

    f.stamina = Math.max(0, f.stamina - def.stamina);
    f.facing = opp.x >= f.x ? 1 : -1;

    const isCounter = f.counterWindow > 0;
    f.counterWindow = 0;

    f.squashX = 1.18;
    f.squashY = 0.84;
    if (def.id === 'forehead_kiss') f.heartEyesTimer = 1.0;
    if (def.id === 'height_mog') this.dramaticDim = 0.48;

    f.move = {
      index: moveIndex,
      id: def.id,
      phase: 'windup',
      timer: def.windup,
      activeDur: def.active,
      recoverDur: def.recover,
      actionDone: false,
      hitDone: false,
      isCounter,
      damage: def.damage * (isCounter ? 1.7 : 1),
      callout: def.callout,
      color: def.color,
      heavy: def.heavy,
    };

    sound.playMove(def.id);
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
    this._updateShockwaves(clampedDt);
    this._updateAfterimages(clampedDt);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - clampedDt * 42);
    if (this.dramaticDim > 0) this.dramaticDim = Math.max(0, this.dramaticDim - clampedDt * 1.35);

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
      // Dramatic slow-mo feel right after KO!
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
    const targetZoom = Math.max(0.88, Math.min(1.08, 1.14 - dist / 1900));
    const halfView = (W * 0.5) / targetZoom;
    const clampedMid = Math.max(halfView + 16, Math.min(STAGE_W - halfView - 16, midX));

    this.camX += (clampedMid - this.camX) * Math.min(1, dt * 7);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 5);
  }

  _updateFighter(f, opp, dt) {
    // Stamina regen
    const regenRate = f.blocking ? 10 : 28;
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

    // Blocking state
    f.blocking = Boolean(f.inputs.block && f.grounded && !f.move && f.stunTimer <= 0 && f.dodgeTimer <= 0);

    // Dodge roll timer & afterimages
    if (f.dodgeTimer > 0) {
      f.dodgeTimer = Math.max(0, f.dodgeTimer - dt);
      f.rollAngle += dt * 20 * f.dodgeDir;
      if (Math.random() < dt * 32) this._spawnAfterimage(f);
      if (f.dodgeTimer <= 0) f.rollAngle = 0;
    } else {
      f.rollAngle = 0;
    }

    // Movement control (when not stunned, dodging, or mid-move)
    const moveSpeed = f.side === 'red' ? 355 : 325; // Wifebun nimble, Husbun powerhouse!
    if (f.stunTimer <= 0 && f.dodgeTimer <= 0 && !f.move) {
      if (f.blocking) {
        f.vx *= Math.pow(0.001, dt);
      } else {
        const dir = (f.inputs.right ? 1 : 0) - (f.inputs.left ? 1 : 0);
        const targetVx = dir * moveSpeed;
        f.vx += (targetVx - f.vx) * Math.min(1, dt * (f.grounded ? 18 : 8));
      }
      // Auto-face opponent on ground
      if (f.grounded && Math.abs(opp.x - f.x) > 12) {
        f.facing = opp.x >= f.x ? 1 : -1;
      }
    } else if (f.stunTimer > 0) {
      f.vx *= Math.pow(0.06, dt);
    }

    // Execute signature move phases!
    if (f.move) {
      this._updateFighterMove(f, opp, dt);
    }

    // Physics integration
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
      }
    }

    // Keep inside stage bounds
    f.x = Math.max(70, Math.min(STAGE_W - 70, f.x));

    // Procedural animation updates
    f.squashX += (1 - f.squashX) * Math.min(1, dt * 13);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 13);

    const targetStretch = f.move && f.move.id === 'height_mog' && f.move.phase !== 'recover' ? 68 : 0;
    f.stretchH += (targetStretch - f.stretchH) * Math.min(1, dt * 14);

    if (f.move && f.move.id === 'dj_spin' && f.move.phase === 'active') {
      f.spinAngle += dt * 26;
    } else {
      f.spinAngle = 0;
    }

    if (f.grounded && Math.abs(f.vx) > 25 && !f.move && f.stunTimer <= 0) {
      f.runCycle += dt * Math.abs(f.vx) * 0.048;
    } else {
      f.runCycle *= Math.pow(0.01, dt);
    }

    f.earLag += (-f.vx * 0.0011 - f.earLag) * Math.min(1, dt * 10);
  }

  _updateFighterMove(f, opp, dt) {
    const m = f.move;
    m.timer -= dt;

    if (m.phase === 'windup') {
      f.vx *= Math.pow(0.01, dt);
      if (m.timer <= 0) {
        m.phase = 'active';
        m.timer = m.activeDur;
        f.squashX = 0.86;
        f.squashY = 1.16;
        this._onMoveActiveStart(f, opp, m);
      }
      return;
    }

    if (m.phase === 'active') {
      // Ongoing melee/dash hit checks!
      if (!m.hitDone) {
        if (m.id === 'dj_spin') {
          f.vx = f.facing * 320;
          if (Math.abs(f.x - opp.x) < 135 && Math.abs(f.y - opp.y) < 100) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 340, knockY: -220, stun: 0.28 });
          }
        } else if (m.id === 'coke_burp') {
          f.vx = -f.facing * 40;
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -20 && dx < 275 && Math.abs(f.y - opp.y) < 110) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 430, knockY: -180, stun: 0.44 });
          }
        } else if (m.id === 'white_claw') {
          f.vx = f.facing * 520;
          if (Math.random() < dt * 28) this._spawnAfterimage(f);
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -30 && dx < 145 && Math.abs(f.y - opp.y) < 105) {
            m.hitDone = true;
            this._applyHit(f, opp, m, { knockX: 320, knockY: -210, stun: 0.26 });
          }
        } else if (m.id === 'height_mog') {
          if (m.timer <= m.activeDur * 0.55) {
            const dx = (opp.x - f.x) * f.facing;
            if (dx > -40 && dx < 185 && Math.abs(f.y - opp.y) < 140) {
              m.hitDone = true;
              this._applyHit(f, opp, m, { knockX: 370, knockY: -310, stun: 0.34 });
            }
          }
        } else if (m.id === 'forehead_kiss') {
          f.vx = f.facing * 490;
          const dx = (opp.x - f.x) * f.facing;
          if (dx > -25 && dx < 125 && Math.abs(f.y - opp.y) < 105) {
            m.hitDone = true;
            f.vx = 0;
            this._applyHit(f, opp, m, { knockX: 220, knockY: -140, stun: 0.44, isKiss: true });
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
      // Hop & launch bouncing pear projectile!
      if (f.grounded) {
        f.vy = -340;
        f.grounded = false;
      }
      f.vx = f.facing * 120;
      this.projectiles.push({
        kind: 'pear',
        owner: f.side,
        x: f.x + f.facing * 42,
        y: f.y - 72,
        vx: f.facing * 440,
        vy: -310,
        radius: 24,
        bounces: 0,
        maxBounces: 2,
        life: 1.9,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'mango_seed') {
      // Supersonic golden mango seed comet!
      f.vx = -f.facing * 90;
      this.projectiles.push({
        kind: 'mango_seed',
        owner: f.side,
        x: f.x + f.facing * 48,
        y: f.y - 68,
        vx: f.facing * 780,
        vy: 0,
        radius: 26,
        bounces: 0,
        maxBounces: 0,
        life: 1.5,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'eyp_report') {
      // Heavy arcing EYP REPORT audit binder!
      f.vx = f.facing * 70;
      const dist = Math.max(160, Math.min(460, Math.abs(opp.x - f.x)));
      this.projectiles.push({
        kind: 'eyp_report',
        owner: f.side,
        x: f.x + f.facing * 34,
        y: f.y - 104,
        vx: f.facing * Math.max(360, dist * 1.15),
        vy: -420,
        radius: 36,
        bounces: 0,
        maxBounces: 0,
        life: 1.8,
        rot: 0,
        move: m,
      });
    } else if (m.id === 'height_mog') {
      // Leap forward + spawn golden 6'5" ruler VFX
      if (f.grounded) {
        f.vy = -420;
        f.grounded = false;
      }
      f.vx = f.facing * 260;
      this.vfx.push({ kind: 'height_mog', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.56 });
    } else if (m.id === 'dj_spin') {
      this.vfx.push({ kind: 'dj_spin', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.48 });
    } else if (m.id === 'coke_burp') {
      this.vfx.push({ kind: 'coke_burp', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.48 });
    } else if (m.id === 'white_claw') {
      this.vfx.push({ kind: 'white_claw', side: f.side, x: f.x, y: f.y, dir: f.facing, t: 0, duration: 0.42 });
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
      pr.rot += dt * (pr.kind === 'mango_seed' ? 14 : 8) * Math.sign(pr.vx || 1);

      if (pr.kind === 'pear') {
        pr.vy += 1250 * dt;
        if (pr.y >= GROUND_Y - 18) {
          pr.y = GROUND_Y - 18;
          if (pr.bounces < pr.maxBounces) {
            pr.bounces += 1;
            pr.vy = -380;
            this._spawnSparks(pr.x, GROUND_Y, '#bef264', 8, 'dot');
          } else {
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      } else if (pr.kind === 'eyp_report') {
        pr.vy += 1280 * dt;
        if (pr.y >= GROUND_Y - 22) {
          // Ground slam shockwave!
          this._spawnShockwave(pr.x, GROUND_Y - 10, '#60a5fa', 110);
          this._spawnSparks(pr.x, GROUND_Y - 16, '#ffffff', 12, 'page');
          this.shake = Math.max(this.shake, 7);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      // Check collision against opponent hurtbox
      const attacker = pr.owner === 'red' ? this.red : this.blue;
      const target = pr.owner === 'red' ? this.blue : this.red;
      const targetCenterY = target.y - (target.side === 'red' ? 58 : 68);
      const dx = pr.x - target.x;
      const dy = pr.y - targetCenterY;
      if (Math.hypot(dx, dy) < pr.radius + 36) {
        const knock = pr.kind === 'mango_seed'
          ? { knockX: 460, knockY: -260, stun: 0.30 }
          : pr.kind === 'eyp_report'
          ? { knockX: 390, knockY: -300, stun: 0.34 }
          : { knockX: 250, knockY: -180, stun: 0.22 };

        this._applyHit(attacker, target, pr.move, knock, pr.x, pr.y);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.life <= 0 || pr.x < -80 || pr.x > STAGE_W + 80) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  _resolveFighterPushbox() {
    const minDist = 66;
    const dx = this.blue.x - this.red.x;
    const dy = Math.abs(this.blue.y - this.red.y);
    if (dy < 85 && Math.abs(dx) < minDist) {
      const push = (minDist - Math.abs(dx)) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      this.red.x = Math.max(70, Math.min(STAGE_W - 70, this.red.x - sign * push));
      this.blue.x = Math.max(70, Math.min(STAGE_W - 70, this.blue.x + sign * push));
    }
  }

  _applyHit(attacker, defender, move, { knockX, knockY, stun, isKiss = false }, hitX, hitY) {
    const ix = hitX ?? (attacker.x + defender.x) * 0.5;
    const iy = hitY ?? (defender.y - 68);
    const pushDir = defender.x >= attacker.x ? 1 : -1;

    // 1. PERFECT DODGE!
    if (defender.dodgeTimer > 0) {
      defender.stamina = Math.min(MAX_STAMINA, defender.stamina + 26);
      defender.counterWindow = 1.1;
      defender.heartEyesTimer = 0.9;
      attacker.comboCount = 0;

      sound.playPerfectDodge();
      this.hitStop = 0.065;
      this._spawnShockwave(ix, iy, '#c084fc', 115);
      this._spawnSparks(ix, iy, '#e9d5ff', 14, 'heart');
      this._spawnCallout(ix, iy - 42, 'PERFECT DODGE! ♥', '#e9d5ff', 1.05);
      this._emitNetEvent('perfect_dodge', { x: ix, y: iy });
      return;
    }

    // 2. GUARD / BLOCK!
    if (defender.blocking && defender.stamina >= 6) {
      defender.stamina = Math.max(0, defender.stamina - 10);
      defender.hp = Math.max(1, defender.hp - move.damage * 0.14);
      defender.vx = pushDir * (knockX * 0.45);
      defender.counterWindow = 0.85;
      attacker.comboCount = 0;

      sound.playBlock();
      this._spawnShockwave(ix, iy, '#ffd479', 72);
      this._spawnSparks(ix, iy, '#ffd479', 10, 'dot');
      this._spawnCallout(ix, iy - 38, 'BLOCKED!', '#ffd479', 0.86);
      this.shake = Math.max(this.shake, 4);
      this._emitNetEvent('block', { x: ix, y: iy });
      return;
    }

    // 3. CLEAN HIT!
    attacker.comboCount += 1;
    attacker.comboTimer = 2.4;
    const comboMult = attacker.comboCount >= 3 ? 1.15 : 1;

    defender.hp = Math.max(0, defender.hp - move.damage * comboMult);
    defender.hitFlash = 0.18;
    defender.stunTimer = stun + (move.isCounter ? 0.12 : 0);
    defender.vx = pushDir * knockX;
    if (knockY < 0) {
      defender.vy = knockY;
      defender.grounded = false;
    }
    defender.squashX = 0.80;
    defender.squashY = 1.20;
    defender.move = null;

    if (isKiss) {
      defender.blushTimer = 2.0;
      defender.heartEyesTimer = 1.4;
      this.vfx.push({ kind: 'kiss_bloom', x: defender.x, y: defender.y - 98, t: 0, duration: 0.65 });
    }

    if (defender.hp <= 0) {
      this._triggerRoundEnd(attacker.side, defender, false);
      this._spawnShockwave(ix, iy, '#ffd479', 190);
      this._spawnShockwave(ix, iy, move.color, 135);
      this._spawnSparks(ix, iy, '#ffd479', 26, 'heart');
      this._spawnSparks(ix, iy, move.color, 26, 'dot');
      this._spawnCallout(ix, iy - 48, 'K.O.!! 💕', '#ffd479', 1.5);
      this._emitNetEvent('ko', { x: ix, y: iy, color: move.color });
    } else {
      sound.playHit(move.heavy || move.isCounter);
      this.hitStop = move.isCounter ? 0.085 : move.heavy ? 0.055 : 0.036;
      this.shake = move.isCounter ? 15 : move.heavy ? 10 : 6;
      this._spawnShockwave(ix, iy, move.isCounter ? '#ffd479' : move.color, move.heavy ? 120 : 84);
      this._spawnMoveHitParticles(ix, iy, move.id, move.color);

      const label = move.isCounter ? `COUNTER ${move.callout}` : move.callout;
      this._spawnCallout(ix, iy - 38, label, move.isCounter ? '#ffd479' : move.color, move.isCounter ? 1.12 : 0.96);
      if (attacker.comboCount >= 2) {
        this._spawnCallout(ix, iy - 80, `${attacker.comboCount} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.82);
      }

      this._emitNetEvent('hit', {
        x: ix,
        y: iy,
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
    winner.heartEyesTimer = 3.0;

    loser.koState = true;
    loser.blocking = false;
    loser.move = null;
    const fallDir = loser.x >= winner.x ? 1 : -1;
    loser.vx = fallDir * 380;
    loser.vy = -420;
    loser.grounded = false;

    this.phase = 'ko';
    this.phaseTimer = 2.8;
    this.hitStop = byTimeout ? 0.05 : 0.22;
    this.shake = 20;

    sound.playKO();
    const bannerMain = byTimeout ? 'TIME UP!' : 'K.O.! 💕';
    const bannerSub = winnerSide === 'red' ? 'WIFEBUN WINS THE ROUND!' : 'HUSBUN WINS THE ROUND!';
    this._emitBanner(bannerMain, bannerSub);
    this._notifyHud(true);
  }

  _updateFighterKO(f, dt) {
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
        }
      } else {
        f.vx *= Math.pow(0.01, dt);
      }
      f.koFallProgress = Math.min(1, f.koFallProgress + dt * 3.5);
    } else {
      // Cute winner victory bounce & blowing hearts!
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
        f.victoryKissTimer = 0.28;
        this._spawnSparks(f.x + f.facing * 18, f.y - 96, '#ff69b4', 3, 'heart');
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
      easy:   { reaction: 0.52, defenseChance: 0.22, aggro: 0.45 },
      medium: { reaction: 0.34, defenseChance: 0.45, aggro: 0.65 },
      hard:   { reaction: 0.20, defenseChance: 0.70, aggro: 0.85 },
    }[this.cpuDifficulty] || { reaction: 0.34, defenseChance: 0.45, aggro: 0.65 };

    // React to incoming projectiles or close windup attacks!
    const incomingProj = this.projectiles.some((pr) => pr.owner !== cpuSide && Math.abs(pr.x - cpu.x) < 150);
    if ((incomingProj || (player.move && absDist < 190)) && !cpu.move && cpu.stunTimer <= 0) {
      if (Math.random() < cfg.defenseChance * dt * 15) {
        const r = Math.random();
        if (r < 0.42 && cpu.dodgeCooldown <= 0) {
          this.triggerDodge(cpuSide);
        } else if (r < 0.72 && incomingProj && cpu.grounded) {
          this.triggerJump(cpuSide);
        } else {
          this.cpuBlockTimer = 0.30 + Math.random() * 0.20;
          cpu.inputs.block = true;
        }
        return;
      }
    }

    this.cpuDecisionTimer -= dt;
    if (this.cpuDecisionTimer <= 0) {
      this.cpuDecisionTimer = cfg.reaction * (0.65 + Math.random() * 0.8);

      // Desired spacing
      if (absDist > 260) {
        this.cpuMoveIntent = Math.sign(dx);
      } else if (absDist < 85) {
        this.cpuMoveIntent = -Math.sign(dx);
      } else {
        this.cpuMoveIntent = Math.random() < 0.5 ? Math.sign(dx) : 0;
      }

      // Attack decision based on range!
      if (cpu.stamina > 24 && Math.random() < cfg.aggro) {
        if (absDist > 210) {
          // Far range: projectiles or dash attacks!
          const farMoves = cpuSide === 'red' ? [0, 2, 1] : [3, 0, 2];
          this.triggerMove(cpuSide, farMoves[Math.floor(Math.random() * farMoves.length)]);
        } else {
          // Close/mid range: any of the 4 signature moves!
          this.triggerMove(cpuSide, Math.floor(Math.random() * 4));
        }
      } else if (Math.random() < 0.14 && cpu.grounded) {
        this.triggerJump(cpuSide);
      }
    }

    cpu.inputs.left = this.cpuMoveIntent < 0;
    cpu.inputs.right = this.cpuMoveIntent > 0;
  }

  // ==========================
  // VFX, PARTICLES, CALLOUTS
  // ==========================
  _spawnShockwave(x, y, color, maxRadius) {
    this.shockwaves.push({ x, y, color, radius: 14, maxRadius, life: 0.28, maxLife: 0.28 });
  }

  _spawnAfterimage(f) {
    this.afterimages.push({
      x: f.x,
      y: f.y,
      isWifebun: f.side === 'red',
      facing: f.facing,
      color: f.side === 'red' ? 'rgba(255, 119, 186, 0.45)' : 'rgba(130, 180, 255, 0.45)',
      life: 0.24,
      maxLife: 0.24,
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
      this._spawnSparks(x, y, '#ffffff', 14, 'page');
      this._spawnSparks(x, y, '#3b82f6', 10, 'dot');
    } else if (moveId === 'coke_burp') {
      this._spawnSparks(x, y, '#8b4513', 12, 'bubble');
      this._spawnSparks(x, y, '#ffffff', 14, 'bubble');
    } else if (moveId === 'white_claw') {
      this._spawnSparks(x, y, '#e0f2fe', 14, 'bubble');
      this._spawnSparks(x, y, '#38bdf8', 12, 'dot');
    } else {
      this._spawnSparks(x, y, color, 16, 'dot');
      this._spawnSparks(x, y, '#ffd479', 6, 'heart');
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
    this.callouts.push({ x, y, text, color, scale, life: 0.85, maxLife: 0.85 });
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
  // NETWORK SYNC (Full 2D side-scroller state)
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
      stamina: Math.round(f.stamina),
      blocking: f.blocking,
      dodgeTimer: f.dodgeTimer,
      rollAngle: f.rollAngle,
      move: f.move ? { index: f.move.index, id: f.move.id, phase: f.move.phase, isCounter: f.move.isCounter } : null,
      stunTimer: f.stunTimer,
      blushTimer: f.blushTimer,
      heartEyesTimer: f.heartEyesTimer,
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
        this._emitBanner(`ROUND ${this.round}`, '🌸 MOONLIT BEATDOWN SESH 🌸');
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
    if (ev.kind === 'move_start') {
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
      this._spawnShockwave(ev.x, ev.y, '#c084fc', 115);
      this._spawnSparks(ev.x, ev.y, '#e9d5ff', 14, 'heart');
      this._spawnCallout(ev.x, ev.y - 42, 'PERFECT DODGE! ♥', '#e9d5ff', 1.05);
    } else if (ev.kind === 'block') {
      sound.playBlock();
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 72);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 10, 'dot');
      this._spawnCallout(ev.x, ev.y - 38, 'BLOCKED!', '#ffd479', 0.86);
      this.shake = Math.max(this.shake, 4);
    } else if (ev.kind === 'hit') {
      sound.playHit(ev.heavy || ev.counter);
      this.shake = ev.counter ? 15 : ev.heavy ? 10 : 6;
      this._spawnShockwave(ev.x, ev.y, ev.counter ? '#ffd479' : ev.color, ev.heavy ? 120 : 84);
      this._spawnMoveHitParticles(ev.x, ev.y, ev.moveId, ev.color);
      this._spawnCallout(ev.x, ev.y - 38, ev.word, ev.counter ? '#ffd479' : ev.color, ev.counter ? 1.12 : 0.96);
      if (ev.combo >= 2) {
        this._spawnCallout(ev.x, ev.y - 80, `${ev.combo} HIT LOVE COMBO! ♥`, '#ff8ec7', 0.82);
      }
    } else if (ev.kind === 'ko') {
      sound.playKO();
      this.shake = 20;
      this._spawnShockwave(ev.x, ev.y, '#ffd479', 190);
      this._spawnSparks(ev.x, ev.y, '#ffd479', 26, 'heart');
      this._spawnSparks(ev.x, ev.y, ev.color, 24, 'dot');
      this._spawnCallout(ev.x, ev.y - 48, 'K.O.!! 💕', '#ffd479', 1.5);
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
  // RENDERING — ROMANTIC PARALLAX SIDE-SCROLLING FIGHTER STAGE!
  // ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();

    // 1. Fixed / Slow Parallax Sky Backdrop
    this._drawParallaxSky(ctx);

    // 2. World-Space Camera Transform
    ctx.save();
    ctx.translate(W / 2, H * 0.56);
    ctx.scale(this.camZoom, this.camZoom);
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.translate(-this.camX, -H * 0.56);

    // Midground cherry blossoms, pergola & fairy lights
    this._drawMidgroundGarden(ctx);

    // Boardwalk ground stage
    this._drawBoardwalkFloor(ctx);

    if (this.dramaticDim > 0.02) {
      ctx.fillStyle = `rgba(14, 4, 22, ${this.dramaticDim})`;
      ctx.fillRect(0, 0, STAGE_W, H);
    }

    this._drawAfterimages(ctx);

    // Draw fighters (active attacker on top)
    const redOnTop = Boolean(this.red.move && this.red.move.phase === 'active');
    if (redOnTop) {
      this._drawHusbun(ctx, this.blue);
      this._drawWifebun(ctx, this.red);
    } else {
      this._drawWifebun(ctx, this.red);
      this._drawHusbun(ctx, this.blue);
    }

    this._drawProjectiles(ctx);
    this._drawVfx(ctx);
    this._drawShockwaves(ctx);
    this._drawParticles(ctx);
    this._drawCallouts(ctx);

    ctx.restore(); // end world camera

    // 3. Screen-Space Drifting Cherry Blossom Petals & Hearts
    this._drawPetals(ctx);

    ctx.restore();
  }

  _drawParallaxSky(ctx) {
    // Rich romantic twilight rose-indigo gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1c0a24');
    sky.addColorStop(0.45, '#411740');
    sky.addColorStop(0.78, '#752b54');
    sky.addColorStop(1, '#260d24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Soft glowing full moon (subtle 0.08x parallax)
    const moonX = W * 0.52 - (this.camX - STAGE_W * 0.5) * 0.08;
    const moonY = 104;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 26, moonX, moonY, 160);
    moonGlow.addColorStop(0, 'rgba(255, 245, 225, 0.98)');
    moonGlow.addColorStop(0.24, 'rgba(255, 224, 195, 0.55)');
    moonGlow.addColorStop(0.6, 'rgba(255, 130, 190, 0.16)');
    moonGlow.addColorStop(1, 'rgba(255, 119, 186, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 160, 0, Math.PI * 2);
    ctx.fill();

    // Twinkling stars
    for (let i = 0; i < 36; i++) {
      const sx = (((i * 173) - (this.camX - STAGE_W * 0.5) * 0.05) % W + W) % W;
      const sy = 16 + ((i * 47) % 210);
      const tw = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + i));
      ctx.fillStyle = i % 3 === 0 ? `rgba(255, 220, 140, ${tw})` : `rgba(255, 210, 236, ${tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 5 === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant romantic bridge & city silhouette + moonlit water (0.22x parallax)
    const offsetFar = -(this.camX - STAGE_W * 0.5) * 0.22;
    ctx.save();
    ctx.translate(offsetFar, 0);

    // Shimmering lake horizon
    const waterGrad = ctx.createLinearGradient(0, 315, 0, 420);
    waterGrad.addColorStop(0, '#3a153a');
    waterGrad.addColorStop(1, '#1e0b22');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(-300, 315, W + 600, 130);

    // Moon reflection shimmer on water
    for (let r = 0; r < 8; r++) {
      const rw = 85 - r * 7 + Math.sin(this.time * 3 + r) * 8;
      ctx.fillStyle = `rgba(255, 224, 185, ${0.24 - r * 0.025})`;
      ctx.fillRect(moonX - offsetFar - rw / 2, 326 + r * 10, rw, 3.5);
    }

    // Romantic distant city skyline
    ctx.fillStyle = '#240c29';
    const buildings = [
      [-180, 70], [-100, 95], [-10, 60], [60, 110], [160, 75], [250, 90],
      [620, 88], [710, 112], [810, 68], [890, 96], [980, 78], [1070, 90],
    ];
    buildings.forEach(([bx, bh]) => {
      ctx.fillRect(bx, 320 - bh, 64, bh);
      // Warm little city lights
      ctx.fillStyle = 'rgba(255, 212, 121, 0.45)';
      for (let wy = 320 - bh + 12; wy < 312; wy += 16) {
        ctx.fillRect(bx + 12, wy, 6, 7);
        ctx.fillRect(bx + 36, wy, 6, 7);
      }
      ctx.fillStyle = '#240c29';
    });

    // Romantic arched gazebo / Eiffel-like romantic tower silhouette center-far
    ctx.beginPath();
    ctx.moveTo(430, 320);
    ctx.quadraticCurveTo(465, 230, 480, 168);
    ctx.quadraticCurveTo(495, 230, 530, 320);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawMidgroundGarden(ctx) {
    // Blooming cherry-blossom trees along the boardwalk
    const treePositions = [180, 520, 960, 1300];
    treePositions.forEach((tx, idx) => {
      const sway = Math.sin(this.time * 1.3 + idx * 1.4) * 5;
      // Trunk
      ctx.strokeStyle = '#3b1c26';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, GROUND_Y);
      ctx.quadraticCurveTo(tx - 10, GROUND_Y - 110, tx + sway, GROUND_Y - 210);
      ctx.stroke();

      // Branches
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(tx + sway * 0.5, GROUND_Y - 140);
      ctx.lineTo(tx - 65 + sway, GROUND_Y - 195);
      ctx.moveTo(tx + sway * 0.5, GROUND_Y - 155);
      ctx.lineTo(tx + 72 + sway, GROUND_Y - 205);
      ctx.stroke();

      // Fluffy glowing cherry blossom canopy clouds
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

    // Romantic draped fairy string lights between wooden lantern posts!
    const postXs = [100, 420, 740, 1060, 1380];
    postXs.forEach((px) => {
      ctx.fillStyle = '#36172a';
      ctx.fillRect(px - 6, GROUND_Y - 240, 12, 240);
      // Warm hanging lantern
      ctx.fillStyle = '#ffd479';
      ctx.shadowColor = '#ffd479';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(px - 10, GROUND_Y - 226, 20, 24, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draped glowing string light arcs
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

    // Low romantic railing behind boardwalk
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

    // Glowing rose-gold boardwalk top edge
    ctx.fillStyle = 'rgba(255, 212, 165, 0.35)';
    ctx.fillRect(0, GROUND_Y, STAGE_W, 4);

    // Perspective wooden planks
    ctx.strokeStyle = 'rgba(20, 6, 20, 0.45)';
    ctx.lineWidth = 2;
    for (let px = 0; px <= STAGE_W; px += 64) {
      ctx.beginPath();
      ctx.moveTo(px, GROUND_Y);
      ctx.lineTo(px + (px - STAGE_W * 0.5) * 0.12, H + 40);
      ctx.stroke();
    }

    // Center heart chalk/tile inlay on the promenade
    this._drawHeart(ctx, STAGE_W * 0.5, GROUND_Y + 32, 18, 'rgba(255, 130, 195, 0.35)');
  }

  // ==========================
  // CHARACTER 1: WIFEBUN — Cute Feminine Honey-Caramel Brown Bunny!
  // ==========================
  _drawWifebun(ctx, f) {
    const dir = f.facing;
    const furMain = '#bc7f52';
    const furLight = '#e0a97e';
    const furDark = '#875330';
    const pinkMain = '#ff69b4';
    const pinkLight = '#ffc2e2';
    const cream = '#fff3e6';

    const stride = Math.sin(f.runCycle);
    const breathe = Math.sin(this.time * 5.4);
    const bounceY = f.koState
      ? 14 * f.koFallProgress
      : !f.grounded
      ? 0
      : Math.abs(f.vx) > 25
      ? -Math.abs(stride) * 7
      : breathe * 2.2;

    ctx.save();
    ctx.translate(f.x, f.y);

    // Soft ground shadow (scales with height off ground)
    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - f.y + 4, 34 * airScale, 9 * airScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    // Counter-ready golden aura
    if (f.counterWindow > 0 && !f.koState) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd479';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, -56, 46, 68, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, bounceY);
    if (f.rollAngle !== 0) {
      ctx.translate(0, -48);
      ctx.rotate(f.rollAngle);
      ctx.translate(0, 48);
    }

    // Flip horizontally by facing direction!
    ctx.scale(dir * f.squashX, f.squashY);

    if (f.spinAngle !== 0) {
      const sx = Math.cos(f.spinAngle);
      ctx.scale(Math.abs(sx) < 0.28 ? 0.28 : sx, 1);
    }

    // Cute sitting dizzy KO pose!
    if (f.koState) {
      ctx.translate(0, 16 * f.koFallProgress);
      ctx.rotate(-0.45 * f.koFallProgress);
    }

    // === BACK LEG (striding!) ===
    const legSwing = f.koState ? 0.9 : !f.grounded ? 0.55 : stride * 0.75;
    this._drawFeminineLeg(ctx, -6, -34, -legSwing, furDark, '#f5c2d9', '#e84d99');

    // === FLUFFY COTTON BUNNY TAIL ===
    const tailWag = Math.sin(this.time * 13) * 2.5;
    ctx.fillStyle = '#fff6f0';
    ctx.beginPath();
    ctx.arc(-22, -38 + tailWag, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(135, 83, 48, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // === BACK ARM ===
    const attackReach = f.move && f.move.phase === 'active' ? 1 : f.move && f.move.phase === 'windup' ? -0.6 : 0;
    this._drawFeminineArm(ctx, 8, -68, f.blocking ? -1.1 : -0.35 - stride * 0.45 - attackReach * 0.8, furDark, pinkMain);

    // === SLENDER TORSO & CUTE TOP ===
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : cream;
    ctx.beginPath();
    ctx.roundRect(-16, -78, 32, 34, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cute pink heart patch on top
    this._drawHeart(ctx, 3, -64, 6, pinkMain);

    // === PASTEL PINK PLEATED FIGHTER SKIRT ===
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : pinkMain;
    ctx.beginPath();
    ctx.moveTo(-16, -48);
    ctx.lineTo(16, -48);
    ctx.lineTo(24, -26);
    ctx.lineTo(-24, -26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c2186a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Pleat lines + white waist ribbon
    ctx.strokeStyle = 'rgba(255, 220, 240, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-8, -46); ctx.lineTo(-12, -27);
    ctx.moveTo(0, -46); ctx.lineTo(0, -27);
    ctx.moveTo(8, -46); ctx.lineTo(12, -27);
    ctx.stroke();
    ctx.fillStyle = pinkLight;
    ctx.fillRect(-16, -50, 32, 5);

    // === FRONT LEG ===
    this._drawFeminineLeg(ctx, 6, -34, legSwing, furMain, '#ffffff', pinkMain);

    // === CUTE BUNNY HEAD ===
    ctx.save();
    ctx.translate(2, -96 + (f.stunTimer > 0 ? 3 : 0));
    ctx.rotate(f.stunTimer > 0 ? -0.22 : attackReach * 0.14);

    // Long soft velvety ears (back ear cute floppy curve, front ear perked with pink bow!)
    const earSway = Math.sin(this.time * 6) * 0.06 + f.earLag;
    this._drawBunnyEar(ctx, -10, -20, -0.58 + earSway, 9, 34, furDark, '#ffa8d5', true);
    this._drawBunnyEar(ctx, 4, -22, -0.14 - earSway * 0.6, 9.5, 36, furMain, '#ffb6dc', false);

    // Satin pink bow on front ear!
    ctx.save();
    ctx.translate(7, -30);
    ctx.fillStyle = '#ff4d9e';
    ctx.beginPath();
    ctx.ellipse(-8, 0, 8.5, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(8, 0, 8.5, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe3f1';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Soft round honey-caramel head
    const headGrad = ctx.createRadialGradient(-4, -6, 4, 0, 0, 28);
    headGrad.addColorStop(0, furLight);
    headGrad.addColorStop(0.68, furMain);
    headGrad.addColorStop(1, furDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 35, 15, 0.35)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Fluffy bangs tuft!
    ctx.fillStyle = furLight;
    ctx.beginPath();
    ctx.ellipse(6, -17, 9, 5, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // DJ Headphones when doing DJ Spin!
    if (f.move && f.move.id === 'dj_spin') {
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -3, 27, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(-29, -9, 8, 17, 4);
      ctx.roundRect(21, -9, 8, 17, 4);
      ctx.fill();
    }

    // Cute muzzle & pink heart nose
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.ellipse(12, 7, 10, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff69b4';
    ctx.beginPath();
    ctx.arc(15, 4, 3.3, 0, Math.PI * 2);
    ctx.fill();

    // Rosy blush cheeks!
    ctx.fillStyle = f.blushTimer > 0 ? 'rgba(255, 56, 130, 0.85)' : 'rgba(255, 118, 178, 0.52)';
    ctx.beginPath();
    ctx.ellipse(2, 7, f.blushTimer > 0 ? 8 : 6, f.blushTimer > 0 ? 5 : 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute mouth
    ctx.strokeStyle = '#4a2210';
    ctx.lineWidth = 1.8;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#632814';
      ctx.beginPath();
      ctx.arc(15, 10, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.koState) {
      ctx.beginPath();
      ctx.arc(13, 11, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(11, 8.5, 3.2, 0, Math.PI);
      ctx.arc(16.5, 8.5, 3.2, 0, Math.PI);
      ctx.stroke();
    }

    // Expressive big anime bunny eyes!
    const isBlinking = !f.koState && (this.time % 3.4) > 3.26;
    if (f.koState) {
      ctx.strokeStyle = '#ffd479';
      ctx.lineWidth = 2.6;
      [5, 16].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, -6); ctx.lineTo(ex + 3, 0); ctx.moveTo(ex + 3, -6); ctx.lineTo(ex - 3, 0); ctx.stroke();
      });
      // Swirling dizzy hearts!
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this._drawHeart(ctx, Math.cos(a) * 24, -30 + Math.sin(a) * 6, 6, '#ff77ba');
      }
    } else if (f.heartEyesTimer > 0 || f.counterWindow > 0) {
      [5, 16].forEach((ex) => this._drawHeart(ctx, ex, -3, 6.2, '#ff4d9e'));
    } else if (isBlinking) {
      ctx.strokeStyle = '#24120c';
      ctx.lineWidth = 2.2;
      [5, 16].forEach((ex) => {
        ctx.beginPath(); ctx.arc(ex, -2, 4, 0, Math.PI); ctx.stroke();
      });
    } else {
      [5, 16].forEach((ex, idx) => {
        const r = idx === 0 ? 5.2 : 4.4;
        ctx.fillStyle = '#24110b';
        ctx.beginPath(); ctx.arc(ex, -3, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex + 1.5, -5, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - 1.2, -1, 1.1, 0, Math.PI * 2); ctx.fill();
        // Curved feminine eyelashes!
        ctx.strokeStyle = '#24110b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ex - 4, -5); ctx.lineTo(ex - 7.5, -8);
        ctx.moveTo(ex - 1, -7.5); ctx.lineTo(ex - 3.5, -10.5);
        ctx.stroke();
      });
    }

    ctx.restore(); // head

    // === FRONT ARM ===
    const frontArmAngle = f.blocking
      ? -1.25
      : f.move && f.move.phase === 'active'
      ? -0.15
      : f.move && f.move.phase === 'windup'
      ? 0.9
      : 0.35 + stride * 0.5;
    this._drawFeminineArm(ctx, -4, -68, frontArmAngle, furMain, pinkMain, f.move && f.move.phase === 'active');

    // Guard shimmer shield
    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.9)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(28, -64, 34, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawFeminineLeg(ctx, x, y, angle, furCol, sockCol, shoeCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Slender bunny leg
    ctx.strokeStyle = furCol;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke();
    // Cute sock cuff
    ctx.strokeStyle = sockCol;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 28); ctx.stroke();
    // Cute pink fighter sneaker
    ctx.fillStyle = shoeCol;
    ctx.beginPath();
    ctx.ellipse(4, 31, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, 34, 18, 3);
    ctx.restore();
  }

  _drawFeminineArm(ctx, x, y, angle, furCol, gloveCol, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = extended ? 34 : 24;
    ctx.strokeStyle = furCol;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 4); ctx.stroke();
    // Cute pink fingerless glove / wrist wrap
    ctx.fillStyle = gloveCol;
    ctx.beginPath(); ctx.arc(len + 3, 4, extended ? 10 : 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff0f7';
    ctx.fillRect(len - 5, -1, 5, 10);
    ctx.restore();
  }

  // ==========================
  // CHARACTER 2: HUSBUN — Taller, Broader Masculine Espresso-Brown Bunny!
  // ==========================
  _drawHusbun(ctx, f) {
    const dir = f.facing;
    const furMain = '#6d4327';
    const furLight = '#925e3b';
    const furDark = '#462814';
    const vestMain = '#1e3a6e';
    const vestTrim = '#ffd479';
    const shortsCol = '#172554';

    const stride = Math.sin(f.runCycle);
    const breathe = Math.sin(this.time * 4.8 + 1.5);
    const bounceY = f.koState
      ? 16 * f.koFallProgress
      : !f.grounded
      ? 0
      : Math.abs(f.vx) > 25
      ? -Math.abs(stride) * 7
      : breathe * 2;

    ctx.save();
    ctx.translate(f.x, f.y);

    // Ground shadow
    const airScale = Math.max(0.45, 1 - (GROUND_Y - f.y) / 360);
    ctx.fillStyle = 'rgba(18, 4, 22, 0.40)';
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - f.y + 4, 42 * airScale, 10 * airScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.dodgeTimer > 0) ctx.globalAlpha = 0.78;

    // Counter-ready golden aura
    if (f.counterWindow > 0 && !f.koState) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.92)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd479';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, -68, 54, 82, 0, 0, Math.PI * 2);
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

    if (f.koState) {
      ctx.translate(0, 18 * f.koFallProgress);
      ctx.rotate(-0.48 * f.koFallProgress);
    }

    // === BACK LEG (longer masculine athletic stride!) ===
    const legSwing = f.koState ? 0.9 : !f.grounded ? 0.55 : stride * 0.75;
    this._drawMasculineLeg(ctx, -8, -44, -legSwing, furDark, '#1d4ed8');

    // === SMALLER MASCULINE COTTON TAIL ===
    ctx.fillStyle = '#e8d2bc';
    ctx.beginPath();
    ctx.arc(-25, -48, 10, 0, Math.PI * 2);
    ctx.fill();

    // === BACK ARM ===
    const attackReach = f.move && f.move.phase === 'active' ? 1 : f.move && f.move.phase === 'windup' ? -0.6 : 0;
    this._drawMasculineArm(ctx, 12, -88 - f.stretchH * 0.75, f.blocking ? -1.1 : -0.35 - stride * 0.45 - attackReach * 0.9, furDark, '#e2e8f0');

    // === BROAD ATHLETIC V-TAPER TORSO (stretches up during Height Mog!) ===
    const torsoH = 52 + f.stretchH;
    const torsoTop = -44 - torsoH;

    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : vestMain;
    ctx.beginPath();
    ctx.moveTo(-24, torsoTop);
    ctx.lineTo(25, torsoTop);
    ctx.lineTo(19, -42);
    ctx.lineTo(-19, -42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Gold V-neck & chest trim on fighter tank
    ctx.strokeStyle = vestTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, torsoTop);
    ctx.lineTo(2, torsoTop + 15);
    ctx.lineTo(14, torsoTop);
    ctx.stroke();

    // Athletic boxing shorts with gold waistband & side stripe
    ctx.fillStyle = shortsCol;
    ctx.beginPath();
    ctx.roundRect(-21, -48, 42, 24, 6);
    ctx.fill();
    ctx.fillStyle = vestTrim;
    ctx.fillRect(-21, -48, 42, 5);
    ctx.fillRect(-4, -43, 4, 18);

    // === FRONT LEG ===
    this._drawMasculineLeg(ctx, 8, -44, legSwing, furMain, '#2563eb');

    // === MASCULINE BUNNY HEAD ===
    ctx.save();
    ctx.translate(3, torsoTop - 22 + (f.stunTimer > 0 ? 3 : 0));
    ctx.rotate(f.stunTimer > 0 ? -0.20 : attackReach * 0.14);

    // Tall upright rugged masculine bunny ears (front ear slightly bent tip!)
    const earSway = Math.sin(this.time * 5.2 + 1.2) * 0.05 + f.earLag;
    this._drawBunnyEar(ctx, -9, -22, -0.18 + earSway, 9.5, 42, furDark, '#bd8c70', false);
    this._drawBunnyEar(ctx, 7, -23, 0.10 - earSway * 0.6, 9.5, 40, furMain, '#c9987b', true);

    // Structured walnut-brown head with stronger jaw/cheek fur
    const headGrad = ctx.createRadialGradient(-4, -6, 4, 0, 0, 30);
    headGrad.addColorStop(0, furLight);
    headGrad.addColorStop(0.65, furMain);
    headGrad.addColorStop(1, furDark);
    ctx.fillStyle = f.hitFlash > 0 ? '#ffffff' : headGrad;
    ctx.beginPath();
    ctx.roundRect(-24, -24, 48, 46, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35, 16, 6, 0.42)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Cool athletic navy & gold headband + fluttering tails!
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(-25, -18, 50, 8.5, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd479';
    ctx.fillRect(-24, -15, 48, 2.5);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, -14);
    ctx.lineTo(-39, -6 + Math.sin(this.time * 10) * 4);
    ctx.stroke();

    // Glasses glint during EYP Report!
    if (f.move && f.move.id === 'eyp_report') {
      ctx.strokeStyle = '#ffd479';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(2, -9, 20, 11, 3);
      ctx.stroke();
    }

    // Muzzle & dark cocoa nose
    ctx.fillStyle = '#e8cfb6';
    ctx.beginPath();
    ctx.ellipse(13, 8, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2012';
    ctx.beginPath();
    ctx.ellipse(17, 5, 4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Confident smirk (or kissy lips on Forehead Kiss!)
    ctx.strokeStyle = '#2e160a';
    ctx.lineWidth = 2.2;
    if (f.move && f.move.id === 'forehead_kiss') {
      ctx.fillStyle = '#ff4d9e';
      ctx.beginPath(); ctx.arc(17, 11, 3.8, 0, Math.PI * 2); ctx.fill();
    } else if (f.koState) {
      ctx.beginPath(); ctx.arc(14, 12, 3.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(9, 10);
      ctx.quadraticCurveTo(15, 13, 20, 8.5);
      ctx.stroke();
    }

    // Sharp masculine eyes + confident thick eyebrows!
    const isBlinking = !f.koState && ((this.time + 1.8) % 3.8) > 3.66;
    if (f.koState) {
      ctx.strokeStyle = '#ffd479';
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
      ctx.strokeStyle = '#1f1008';
      ctx.lineWidth = 2.4;
      [6, 17].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 4, -3); ctx.lineTo(ex + 4, -3); ctx.stroke();
      });
    } else {
      [6, 17].forEach((ex, idx) => {
        ctx.fillStyle = '#1a0e07';
        ctx.beginPath(); ctx.arc(ex, -3, idx === 0 ? 4.4 : 3.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex + 1.4, -4.5, 1.5, 0, Math.PI * 2); ctx.fill();
        // Confident slanted eyebrows
        ctx.strokeStyle = '#2b160a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex - 5, -9);
        ctx.lineTo(ex + 5, -7);
        ctx.stroke();
      });
    }

    ctx.restore(); // head

    // === FRONT ARM (stronger furred arm + taped boxing wraps!) ===
    const frontArmAngle = f.blocking
      ? -1.25
      : f.move && f.move.phase === 'active'
      ? -0.10
      : f.move && f.move.phase === 'windup'
      ? 0.95
      : 0.35 + stride * 0.5;
    this._drawMasculineArm(ctx, -6, -88 - f.stretchH * 0.75, frontArmAngle, furMain, '#f8fafc', f.move && f.move.phase === 'active');

    // Guard shimmer shield
    if (f.blocking) {
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.9)';
      ctx.fillStyle = 'rgba(255, 212, 121, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(32, -74, 38, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawMasculineLeg(ctx, x, y, angle, furCol, shoeCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = furCol;
    ctx.lineWidth = 12.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 35); ctx.stroke();
    // High-top athletic sneaker
    ctx.fillStyle = shoeCol;
    ctx.beginPath();
    ctx.roundRect(-8, 30, 22, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, 39, 22, 3.5);
    ctx.restore();
  }

  _drawMasculineArm(ctx, x, y, angle, furCol, wrapCol, extended = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = extended ? 40 : 28;
    ctx.strokeStyle = furCol;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 4); ctx.stroke();
    // Taped fighter knuckle wraps
    ctx.fillStyle = wrapCol;
    ctx.beginPath(); ctx.arc(len + 4, 4, extended ? 11.5 : 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(len - 4, -2); ctx.lineTo(len - 4, 10); ctx.stroke();
    ctx.restore();
  }

  _drawBunnyEar(ctx, x, y, angle, rx, ry, outerCol, innerCol, softTip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = outerCol;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.5, rx, ry * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = innerCol;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.48, rx * 0.52, ry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    if (softTip) {
      ctx.fillStyle = outerCol;
      ctx.beginPath();
      ctx.ellipse(rx * 0.5, -ry * 0.92, rx * 0.75, rx * 0.55, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================
  // PROJECTILES & ACTION MOVE VFX
  // ==========================
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
        ctx.beginPath();
        ctx.arc(0, 8, 17, 0, Math.PI * 2);
        ctx.arc(0, -8, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(3, -27); ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.ellipse(9, -22, 7.5, 3.8, -0.4, 0, Math.PI * 2); ctx.fill();
      } else if (pr.kind === 'mango_seed') {
        const dir = Math.sign(pr.vx || 1);
        const grad = ctx.createLinearGradient(-80 * dir, 0, 0, 0);
        grad.addColorStop(0, 'rgba(255, 183, 3, 0)');
        grad.addColorStop(1, 'rgba(255, 130, 0, 0.85)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-80 * dir, 0); ctx.lineTo(0, 0); ctx.stroke();

        ctx.rotate(pr.rot);
        ctx.shadowColor = '#ffb703';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-16, -3); ctx.lineTo(16, -3); ctx.moveTo(-12, 3); ctx.lineTo(12, 3); ctx.stroke();
      } else if (pr.kind === 'eyp_report') {
        ctx.rotate(pr.rot * 0.45);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.roundRect(-34, -42, 68, 84, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(-32, -40, 64, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 11px 'Chakra Petch', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('EYP REPORT', 0, -27);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-20, 6, 10, 20);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-5, -6, 10, 32);
        ctx.fillStyle = '#10b981'; ctx.fillRect(10, 12, 10, 14);
        ctx.rotate(-0.22);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-28, -5, 56, 16);
        ctx.fillStyle = '#dc2626';
        ctx.font = `700 10px 'Chakra Petch', sans-serif`;
        ctx.fillText('APPROVED ♥', 0, 6);
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
        ctx.translate(fx, fy - 52);
        for (let r = 0; r < 2; r++) {
          ctx.strokeStyle = r === 0 ? `rgba(255, 105, 180, ${1 - p})` : `rgba(56, 189, 248, ${1 - p})`;
          ctx.lineWidth = 6 - r * 2;
          ctx.beginPath(); ctx.arc(0, 0, 26 + p * (115 + r * 28), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.rotate(p * Math.PI * 8);
        ctx.fillStyle = '#111827';
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      } else if (v.kind === 'coke_burp') {
        // Red soda can + expanding fizzy sonic wave!
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.roundRect(fx + 18 * dir - 8, fy - 86, 16, 26, 4); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(fx + 18 * dir - 8, fy - 76, 16, 5);
        for (let i = 0; i < 4; i++) {
          const wx = fx + (34 + p * 235 + i * 24) * dir;
          ctx.strokeStyle = i % 2 === 0 ? `rgba(139, 69, 19, ${1 - p})` : `rgba(255, 255, 255, ${1 - p})`;
          ctx.lineWidth = 9 - i * 1.8;
          ctx.beginPath(); ctx.arc(wx, fy - 86, 22 + p * 46, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
        }
      } else if (v.kind === 'white_claw') {
        // White Claw can + triple frost-claw arcs!
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(fx + 16 * dir - 7, fy - 102, 14, 28, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(fx + 16 * dir - 6, fy - 92, 12, 8);

        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - p * 0.75})`;
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        [-18, 0, 18].forEach((off) => {
          ctx.beginPath();
          ctx.moveTo(fx + 10 * dir, fy - 88 + off);
          ctx.quadraticCurveTo(fx + 65 * dir, fy - 74 + off, fx + 125 * dir, fy - 58 + off);
          ctx.stroke();
        });
      } else if (v.kind === 'height_mog') {
        const rx = fx - 54 * dir;
        const rh = 240 * Math.min(1, p * 2.2);
        ctx.shadowColor = '#ffd479';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffd479';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(rx, GROUND_Y - rh, 24, rh, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#422006';
        ctx.lineWidth = 2;
        for (let ty = 14; ty < rh - 10; ty += 16) {
          ctx.beginPath(); ctx.moveTo(rx, GROUND_Y - ty); ctx.lineTo(rx + (ty % 32 === 0 ? 13 : 8), GROUND_Y - ty); ctx.stroke();
        }
        ctx.font = `700 28px 'Bangers', Impact, sans-serif`;
        ctx.fillStyle = '#ffd479';
        ctx.strokeStyle = '#18061a';
        ctx.lineWidth = 5;
        ctx.strokeText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
        ctx.fillText(`6'5"`, rx - 4, GROUND_Y - rh - 10);
      } else if (v.kind === 'forehead_kiss') {
        ctx.globalAlpha = 1 - p;
        this._drawHeart(ctx, fx + 34 * dir, fy - 96, 16 + p * 12, '#ff69b4');
      } else if (v.kind === 'kiss_bloom') {
        const sc = 0.7 + Math.sin(p * Math.PI) * 0.9;
        ctx.translate(v.x, v.y - p * 28);
        ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - p * 0.7;
        ctx.shadowColor = '#ff69b4';
        ctx.shadowBlur = 20;
        this._drawHeart(ctx, 0, 0, 26, '#ff4d9e');
        ctx.font = `26px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💋', 0, 9);
      }

      ctx.restore();
    }
  }

  _drawAfterimages(ctx) {
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life / a.maxLife) * 0.52;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.ellipse(a.x, a.y - (a.isWifebun ? 54 : 66), a.isWifebun ? 24 : 28, a.isWifebun ? 46 : 56, 0, 0, Math.PI * 2);
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
      if (p.isHeart) {
        this._drawHeart(ctx, 0, 0, p.size * 1.1, p.color);
      } else {
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
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
        ctx.strokeRect(-p.size, -p.size * 1.2, p.size * 2, p.size * 2.4);
      } else if (p.shape === 'bubble') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 1.2, 0, Math.PI * 2); ctx.stroke();
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
