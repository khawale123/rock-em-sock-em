// ⚡ Quick-Draw Smooch Duel 1v1 — Wifebun ♥ Husbun Date Night Arcade
// High-tension romantic reaction showdown (Best of 5 / First to 3) with fair latency-proof online sync.

const LOGICAL_W = 960;
const LOGICAL_H = 540;
const WINS_NEEDED = 3;

const FAKEOUT_LINES = [
  'HOLD ON... 😉',
  'WAIT FOR IT... 👀',
  'NOT YET, CUTIE! 💅',
  'EASY NOW... 🌙',
  'DON\'T BLINK! ✨',
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawHeartPath(ctx, x, y, size) {
  ctx.beginPath();
  const topY = y - size * 0.25;
  ctx.moveTo(x, y + size * 0.55);
  ctx.bezierCurveTo(x - size * 0.85, y + size * 0.05, x - size * 0.8, topY - size * 0.55, x, topY);
  ctx.bezierCurveTo(x + size * 0.8, topY - size * 0.55, x + size * 0.85, y + size * 0.05, x, y + size * 0.55);
  ctx.closePath();
}

export class QuickDrawGame {
  constructor(containerEl, opts = {}) {
    this.container = containerEl;
    this.mode = opts.mode || 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
    this.mySide = opts.mySide === 'blue' ? 'blue' : 'red';
    this.redName = opts.redName || 'Wifebun';
    this.blueName = opts.blueName || 'Husbun';
    this.sendNet = typeof opts.sendNet === 'function' ? opts.sendNet : () => {};
    this.onGameOver = typeof opts.onGameOver === 'function' ? opts.onGameOver : () => {};
    this.sound = opts.sound || null;

    this.destroyed = false;
    this.rafId = null;
    this.timers = new Set();

    // DOM refs
    this.canvas = null;
    this.ctx = null;
    this.els = {};

    // Match state
    this.round = 1;
    this.scores = { red: 0, blue: 0 };
    this.bestMs = { red: null, blue: null };
    this.lastMs = { red: null, blue: null };
    this.phase = 'intro'; // 'sync' | 'intro' | 'waiting' | 'draw' | 'resolving' | 'round_over' | 'match_over'
    this.phaseTime = 0;
    this.elapsed = 0;
    this.lastFrameTime = 0;

    // Round timing state
    this.roundDelayMs = 2600;
    this.fakeoutAtMs = null;
    this.fakeoutText = '';
    this.fakeoutTriggered = false;
    this.fakeoutFlash = 0;
    this.drawTime = 0;
    this.localReacted = false;
    this.roundResolved = false;
    this.roundReactions = { red: null, blue: null };
    this.currentRoundPayload = null;
    this.gameOverFired = false;

    // Round outcome visuals
    this.roundWinner = null; // 'red' | 'blue' | null
    this.roundReason = '';   // 'faster' | 'fault' | 'both_fault'
    this.faultSide = null;
    this.bannerMain = 'READY...';
    this.bannerSub = 'WAIT FOR THE HEART!';

    // VFX state
    this.shake = 0;
    this.drawFlash = 0;
    this.heartbeatPhase = 0;
    this.kissProjectile = null;
    this.kissMark = null;
    this.particles = [];
    this.stars = [];
    this.petals = [];
    this.redRecoil = 0;
    this.blueRecoil = 0;

    // Bound listeners
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onResize = this._resizeCanvas.bind(this);

    this._initBackdropEntities();
  }

  _initBackdropEntities() {
    this.stars = [];
    for (let i = 0; i < 46; i++) {
      this.stars.push({
        x: Math.random() * LOGICAL_W,
        y: 16 + Math.random() * 240,
        r: 0.8 + Math.random() * 1.9,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.4 + Math.random() * 2.4,
      });
    }
    this.petals = [];
    for (let i = 0; i < 16; i++) {
      this.petals.push({
        x: Math.random() * LOGICAL_W,
        y: Math.random() * LOGICAL_H,
        vx: -14 - Math.random() * 18,
        vy: 12 + Math.random() * 18,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 2.4,
        size: 4 + Math.random() * 4.5,
        hue: Math.random() > 0.3 ? '#ff99cc' : '#ffd982',
      });
    }
  }

  _setTimer(fn, ms) {
    if (this.destroyed) return null;
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  _clearTimer(id) {
    if (id == null) return;
    window.clearTimeout(id);
    this.timers.delete(id);
  }

  _clearAllTimers() {
    for (const id of this.timers) {
      window.clearTimeout(id);
    }
    this.timers.clear();
  }

  start() {
    if (this.destroyed || !this.container) return;
    this._renderDOM();
    this._bindEvents();
    this._resizeCanvas();
    this._resetMatchState();

    this.lastFrameTime = performance.now();
    this._startLoop();

    if (this.mode === 'online-guest') {
      this.phase = 'sync';
      this.bannerMain = 'READY...';
      this.bannerSub = `Syncing duel with ${this.blueName}...`;
      this._updateUI();
      this.sendNet({ kind: 'ready' });
      // Retry handshake once in case host mounted slightly after guest
      this._setTimer(() => {
        if (this.phase === 'sync' && this.round === 1) {
          this.sendNet({ kind: 'ready' });
        }
      }, 650);
    } else {
      this._startRound(1);
    }
  }

  restart() {
    if (this.destroyed) return;
    this._clearAllTimers();
    this._resetMatchState();

    if (this.mode === 'online-guest') {
      this.phase = 'sync';
      this.bannerMain = 'REMATCH!';
      this.bannerSub = 'Waiting for round signal...';
      this._updateUI();
      this.sendNet({ kind: 'ready' });
      this._setTimer(() => {
        if (this.phase === 'sync' && this.round === 1) {
          this.sendNet({ kind: 'ready' });
        }
      }, 650);
    } else {
      this._startRound(1);
    }
  }

  destroy() {
    this.destroyed = true;
    this._clearAllTimers();
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.canvas = null;
    this.ctx = null;
    this.els = {};
  }

  _resetMatchState() {
    this.round = 1;
    this.scores = { red: 0, blue: 0 };
    this.bestMs = { red: null, blue: null };
    this.lastMs = { red: null, blue: null };
    this.phase = 'intro';
    this.phaseTime = 0;
    this.localReacted = false;
    this.roundResolved = false;
    this.roundReactions = { red: null, blue: null };
    this.currentRoundPayload = null;
    this.gameOverFired = false;
    this.roundWinner = null;
    this.roundReason = '';
    this.faultSide = null;
    this.kissProjectile = null;
    this.kissMark = null;
    this.particles = [];
    this.shake = 0;
    this.drawFlash = 0;
    this.fakeoutFlash = 0;
    this.redRecoil = 0;
    this.blueRecoil = 0;
    this._updateUI();
  }

  _renderDOM() {
    const isLocal = this.mode === 'local';
    const isOnline = this.mode === 'online-host' || this.mode === 'online-guest';
    const redYou = (!isLocal && this.mySide === 'red') ? '<span class="qd-you">YOU</span>' : '';
    const blueYou = (!isLocal && this.mySide === 'blue') ? '<span class="qd-you">YOU</span>' : '';
    const blueRoleTag = this.mode === 'cpu' && this.mySide === 'red'
      ? '<span class="qd-cpu">CPU</span>'
      : '';
    const redRoleTag = this.mode === 'cpu' && this.mySide === 'blue'
      ? '<span class="qd-cpu">CPU</span>'
      : '';

    const controlsHtml = isLocal
      ? `
        <div class="qd-controls qd-controls--split">
          <button type="button" class="qd-btn qd-btn--red" data-side="red">
            <span class="qd-btn-title">💋 ${escapeHtml(this.redName)} SMOOCH!</span>
            <span class="qd-btn-key">Press A or SPACE · Tap</span>
          </button>
          <button type="button" class="qd-btn qd-btn--blue" data-side="blue">
            <span class="qd-btn-title">💋 ${escapeHtml(this.blueName)} SMOOCH!</span>
            <span class="qd-btn-key">Press L or ENTER · Tap</span>
          </button>
        </div>
      `
      : `
        <div class="qd-controls">
          <button type="button" class="qd-btn qd-btn--single ${this.mySide === 'blue' ? 'qd-btn--blue' : 'qd-btn--red'}" data-side="${this.mySide}">
            <span class="qd-btn-title">💋 SMOOCH NOW!</span>
            <span class="qd-btn-key">Press SPACE / Tap Anywhere on Stage ${isOnline ? '· Fair Ping Sync' : ''}</span>
          </button>
        </div>
      `;

    this.container.innerHTML = `
      <style>
        .qd-root {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          user-select: none;
          -webkit-user-select: none;
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
          color: var(--text, #fff8fc);
        }
        .qd-hud {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(42, 16, 49, 0.92), rgba(24, 9, 32, 0.94));
          border: 1px solid rgba(255, 206, 158, 0.25);
          box-shadow: 0 8px 24px rgba(8, 2, 14, 0.45);
        }
        .qd-player {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .qd-player--blue {
          justify-content: flex-end;
          text-align: right;
        }
        .qd-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 1.25rem;
          flex-shrink: 0;
          box-shadow: 0 0 14px rgba(0, 0, 0, 0.35);
        }
        .qd-avatar--red {
          background: radial-gradient(circle at 30% 30%, #ff99cf, #d92d82);
          border: 2px solid #ffd982;
        }
        .qd-avatar--blue {
          background: radial-gradient(circle at 30% 30%, #99ccff, #245cd4);
          border: 2px solid #ffd982;
        }
        .qd-pinfo {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .qd-pname {
          font-weight: 700;
          font-size: 0.92rem;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .qd-player--blue .qd-pname {
          justify-content: flex-end;
        }
        .qd-you, .qd-cpu {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 1px 6px;
          border-radius: 999px;
          background: rgba(255, 217, 130, 0.2);
          color: #ffd982;
          border: 1px solid rgba(255, 217, 130, 0.45);
        }
        .qd-cpu {
          background: rgba(255, 255, 255, 0.1);
          color: #d7b7cf;
          border-color: rgba(255, 255, 255, 0.22);
        }
        .qd-pips-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .qd-player--blue .qd-pips-row {
          justify-content: flex-end;
        }
        .qd-pips {
          display: flex;
          gap: 4px;
        }
        .qd-pip {
          font-size: 0.95rem;
          opacity: 0.24;
          transform: scale(0.9);
          transition: transform 0.25s cubic-bezier(0.2, 1.4, 0.4, 1), opacity 0.25s;
        }
        .qd-pip.is-won {
          opacity: 1;
          transform: scale(1.12);
          filter: drop-shadow(0 0 6px rgba(255, 92, 168, 0.8));
        }
        .qd-player--blue .qd-pip.is-won {
          filter: drop-shadow(0 0 6px rgba(88, 158, 255, 0.85));
        }
        .qd-ms {
          font-family: var(--font-arcade, monospace);
          font-size: 0.74rem;
          font-weight: 700;
          color: #ffd982;
          min-width: 52px;
        }
        .qd-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-align: center;
        }
        .qd-round-pill {
          font-family: var(--font-arcade, system-ui, sans-serif);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 11px;
          border-radius: 999px;
          background: rgba(255, 92, 168, 0.18);
          border: 1px solid rgba(255, 194, 222, 0.32);
          color: #fff3c9;
        }
        .qd-status-mini {
          font-size: 0.72rem;
          color: #d7b7cf;
        }
        .qd-stage-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: 54vh;
          margin: 0 auto;
          border-radius: 18px;
          overflow: hidden;
          border: 2px solid rgba(255, 206, 158, 0.34);
          box-shadow: 0 14px 36px rgba(8, 2, 16, 0.6), inset 0 0 24px rgba(255, 92, 168, 0.14);
          background: #140619;
          cursor: pointer;
          touch-action: manipulation;
        }
        .qd-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .qd-controls {
          display: flex;
          gap: 10px;
          width: 100%;
        }
        .qd-controls--split .qd-btn {
          flex: 1;
        }
        .qd-btn {
          width: 100%;
          border: 2px solid rgba(255, 217, 130, 0.55);
          border-radius: 16px;
          padding: 13px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          color: #fff8fc;
          cursor: pointer;
          touch-action: manipulation;
          transition: transform 0.08s ease, box-shadow 0.18s ease, filter 0.15s ease;
          position: relative;
          overflow: hidden;
        }
        .qd-btn--red {
          background: linear-gradient(180deg, #ff70b8 0%, #d42278 100%);
          box-shadow: 0 6px 22px rgba(255, 92, 168, 0.38), inset 0 2px 0 rgba(255, 255, 255, 0.35);
        }
        .qd-btn--blue {
          background: linear-gradient(180deg, #6baaff 0%, #2457c8 100%);
          box-shadow: 0 6px 22px rgba(88, 158, 255, 0.38), inset 0 2px 0 rgba(255, 255, 255, 0.35);
        }
        .qd-btn:active, .qd-btn.is-pressed {
          transform: translateY(2px) scale(0.985);
        }
        .qd-btn.is-draw {
          animation: qdDrawPulse 0.36s ease-in-out infinite alternate;
          border-color: #fff3c9;
          box-shadow: 0 0 32px rgba(255, 217, 130, 0.72), 0 0 24px rgba(255, 92, 168, 0.65);
        }
        .qd-btn.is-waiting {
          filter: saturate(0.82) brightness(0.92);
        }
        .qd-btn.is-locked {
          opacity: 0.68;
          filter: saturate(0.65);
        }
        .qd-btn-title {
          font-family: var(--font-arcade, system-ui, sans-serif);
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        }
        .qd-btn-key {
          font-size: 0.74rem;
          opacity: 0.9;
          font-weight: 600;
        }
        @keyframes qdDrawPulse {
          from { transform: scale(1); }
          to { transform: scale(1.022); }
        }
        @media (max-width: 640px) {
          .qd-hud {
            padding: 8px 10px;
            gap: 6px;
          }
          .qd-avatar {
            width: 30px;
            height: 30px;
            font-size: 1rem;
          }
          .qd-pname {
            font-size: 0.8rem;
          }
          .qd-btn {
            padding: 11px 12px;
          }
          .qd-btn-title {
            font-size: 0.98rem;
          }
        }
      </style>
      <div class="qd-root">
        <div class="qd-hud">
          <div class="qd-player qd-player--red">
            <div class="qd-avatar qd-avatar--red">🎀</div>
            <div class="qd-pinfo">
              <div class="qd-pname">${escapeHtml(this.redName)} ${redYou}${redRoleTag}</div>
              <div class="qd-pips-row">
                <div class="qd-pips" data-pips="red">
                  <span class="qd-pip">♥</span>
                  <span class="qd-pip">♥</span>
                  <span class="qd-pip">♥</span>
                </div>
                <span class="qd-ms" data-ms="red"></span>
              </div>
            </div>
          </div>

          <div class="qd-center">
            <div class="qd-round-pill" data-round-pill>ROUND 1 · FIRST TO 3</div>
            <div class="qd-status-mini" data-status-mini>Wait for 💋 DRAW!!</div>
          </div>

          <div class="qd-player qd-player--blue">
            <div class="qd-pinfo">
              <div class="qd-pname">${blueYou}${blueRoleTag} ${escapeHtml(this.blueName)}</div>
              <div class="qd-pips-row">
                <span class="qd-ms" data-ms="blue"></span>
                <div class="qd-pips" data-pips="blue">
                  <span class="qd-pip">♥</span>
                  <span class="qd-pip">♥</span>
                  <span class="qd-pip">♥</span>
                </div>
              </div>
            </div>
            <div class="qd-avatar qd-avatar--blue">💪</div>
          </div>
        </div>

        <div class="qd-stage-wrap" data-stage-wrap>
          <canvas class="qd-canvas" data-canvas width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        </div>

        ${controlsHtml}
      </div>
    `;

    this.canvas = this.container.querySelector('[data-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.els = {
      stageWrap: this.container.querySelector('[data-stage-wrap]'),
      roundPill: this.container.querySelector('[data-round-pill]'),
      statusMini: this.container.querySelector('[data-status-mini]'),
      redPips: Array.from(this.container.querySelectorAll('[data-pips="red"] .qd-pip')),
      bluePips: Array.from(this.container.querySelectorAll('[data-pips="blue"] .qd-pip')),
      redMs: this.container.querySelector('[data-ms="red"]'),
      blueMs: this.container.querySelector('[data-ms="blue"]'),
      buttons: Array.from(this.container.querySelectorAll('.qd-btn')),
    };
  }

  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);

    for (const btn of this.els.buttons) {
      const side = btn.dataset.side;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('is-pressed');
        this._setTimer(() => btn.classList.remove('is-pressed'), 120);
        this._triggerSmooch(side);
      });
    }

    if (this.mode !== 'local' && this.els.stageWrap) {
      this.els.stageWrap.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._triggerSmooch(this.mySide);
      });
    }
  }

  _handleKeyDown(e) {
    if (this.destroyed || e.repeat) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (this.mode === 'local') {
      if (e.code === 'KeyA' || e.code === 'Space') {
        e.preventDefault();
        this._triggerSmooch('red');
      } else if (e.code === 'KeyL' || e.code === 'Enter') {
        e.preventDefault();
        this._triggerSmooch('blue');
      }
    } else {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this._triggerSmooch(this.mySide);
      }
    }
  }

  _resizeCanvas() {
    if (!this.canvas || !this.ctx || this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(LOGICAL_W * dpr);
    this.canvas.height = Math.round(LOGICAL_H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _updateUI() {
    if (this.destroyed || !this.els.roundPill) return;
    this.els.roundPill.textContent = `ROUND ${this.round} · FIRST TO ${WINS_NEEDED}`;

    this.els.redPips.forEach((pip, i) => pip.classList.toggle('is-won', i < this.scores.red));
    this.els.bluePips.forEach((pip, i) => pip.classList.toggle('is-won', i < this.scores.blue));

    this.els.redMs.textContent = this.lastMs.red != null ? `${this.lastMs.red} ms` : '';
    this.els.blueMs.textContent = this.lastMs.blue != null ? `${this.lastMs.blue} ms` : '';

    let mini = 'Wait for 💋 DRAW!!';
    if (this.phase === 'sync') mini = 'Syncing with partner...';
    else if (this.phase === 'intro') mini = 'Hands ready — don\'t flinch!';
    else if (this.phase === 'waiting') mini = 'Hold steady... wait for the heart!';
    else if (this.phase === 'draw') mini = '💋 SMOOCH NOW!!';
    else if (this.phase === 'resolving') mini = 'Checking fastest smooch...';
    else if (this.phase === 'round_over') mini = this.bannerMain;
    else if (this.phase === 'match_over') mini = 'Match Complete! 💕';
    this.els.statusMini.textContent = mini;

    for (const btn of this.els.buttons) {
      const isDraw = this.phase === 'draw';
      const isWaiting = this.phase === 'waiting' || this.phase === 'intro';
      const isLocked = this.phase === 'round_over' || this.phase === 'match_over' || this.phase === 'sync' || this.localReacted;
      btn.classList.toggle('is-draw', isDraw && !this.localReacted);
      btn.classList.toggle('is-waiting', isWaiting && !this.localReacted);
      btn.classList.toggle('is-locked', isLocked);
    }
  }

  // ---- Round Lifecycle ----

  _startRound(roundNum) {
    this._clearAllTimers();
    this.round = roundNum;
    this.localReacted = false;
    this.roundResolved = false;
    this.roundReactions = { red: null, blue: null };
    this.roundWinner = null;
    this.roundReason = '';
    this.faultSide = null;
    this.kissProjectile = null;
    this.kissMark = null;
    this.fakeoutTriggered = false;
    this.fakeoutFlash = 0;

    // Pick random delay 1.8s - 4.5s + optional cheeky fakeout
    const delayMs = Math.round(1800 + Math.random() * 2700);
    let fakeoutAtMs = null;
    let fakeoutText = '';
    if (delayMs >= 2350 && Math.random() < 0.55) {
      fakeoutAtMs = Math.round(700 + Math.random() * (delayMs - 1550));
      fakeoutText = FAKEOUT_LINES[Math.floor(Math.random() * FAKEOUT_LINES.length)];
    }

    const payload = {
      kind: 'round_start',
      round: roundNum,
      delayMs,
      fakeoutAtMs,
      fakeoutText,
    };
    this.currentRoundPayload = payload;

    if (this.mode === 'online-host') {
      this.sendNet(payload);
    }

    this._beginRoundCountdown(payload);
  }

  _beginRoundCountdown(payload) {
    this._clearAllTimers();
    this.round = payload.round;
    this.roundDelayMs = clamp(Number(payload.delayMs) || 2600, 1500, 5200);
    this.fakeoutAtMs = typeof payload.fakeoutAtMs === 'number' ? payload.fakeoutAtMs : null;
    this.fakeoutText = payload.fakeoutText || FAKEOUT_LINES[0];
    this.fakeoutTriggered = false;
    this.fakeoutFlash = 0;
    this.localReacted = false;
    this.roundResolved = false;
    this.roundReactions = { red: null, blue: null };
    this.roundWinner = null;
    this.roundReason = '';
    this.faultSide = null;
    this.kissProjectile = null;
    this.kissMark = null;

    this.phase = 'intro';
    this.phaseTime = 0;
    this.bannerMain = `ROUND ${this.round}`;
    this.bannerSub = 'READY... WAIT FOR THE HEART!';
    this._updateUI();

    // Brief 0.9s intro before tension phase begins
    this._setTimer(() => {
      if (this.roundResolved) return;
      this.phase = 'waiting';
      this.phaseTime = 0;
      this.bannerMain = 'READY...';
      this.bannerSub = 'WAIT FOR THE HEART!';
      this.sound?.playBlock?.();
      this._updateUI();

      // Optional cheeky fakeout
      if (this.fakeoutAtMs != null && this.fakeoutAtMs > 300 && this.fakeoutAtMs < this.roundDelayMs - 450) {
        this._setTimer(() => {
          if (this.phase !== 'waiting') return;
          this.fakeoutTriggered = true;
          this.fakeoutFlash = 1;
          this.bannerMain = this.fakeoutText;
          this.bannerSub = 'DON\'T TAP YET!!';
          this.sound?.playDodge?.();
          this._updateUI();

          // Small 7% chance CPU falls for the fakeout!
          if (this.mode === 'cpu' && Math.random() < 0.07) {
            const cpuSide = this.mySide === 'red' ? 'blue' : 'red';
            this._setTimer(() => {
              if (this.phase === 'waiting') {
                this._resolveLocalOrCpuFault(cpuSide);
              }
            }, 220 + Math.random() * 140);
          }

          this._setTimer(() => {
            if (this.phase === 'waiting') {
              this.bannerMain = 'STEADY...';
              this.bannerSub = 'WAIT FOR 💋 DRAW!!';
            }
          }, 560);
        }, this.fakeoutAtMs);
      }

      // Main DRAW trigger
      this._setTimer(() => {
        if (this.phase !== 'waiting') return;
        this.phase = 'draw';
        this.phaseTime = 0;
        this.drawTime = performance.now();
        this.drawFlash = 1;
        this.shake = 10;
        this.bannerMain = '💋 DRAW!!';
        this.bannerSub = 'SMOOCH NOW!!';
        this.sound?.playBell?.();
        this._spawnBurst(LOGICAL_W / 2, 175, '#ffd982', 22, 'spark');
        this._spawnBurst(LOGICAL_W / 2, 175, '#ff6db7', 14, 'heart');
        this._updateUI();

        // Schedule CPU reaction in cpu mode (240ms - 440ms human-like range)
        if (this.mode === 'cpu') {
          const cpuSide = this.mySide === 'red' ? 'blue' : 'red';
          const cpuReactionMs = Math.round(240 + Math.random() * 200);
          this._setTimer(() => {
            if (this.phase === 'draw' && !this.roundResolved) {
              this._resolveLocalOrCpuHit(cpuSide, cpuReactionMs);
            }
          }, cpuReactionMs);
        }
      }, this.roundDelayMs);
    }, 900);
  }

  // ---- Input / Reaction Handling ----

  _triggerSmooch(side) {
    if (this.destroyed || this.roundResolved) return;
    if (this.phase !== 'waiting' && this.phase !== 'draw') return;
    if (this.mode !== 'local' && this.localReacted) return;

    const isFault = this.phase === 'waiting';
    const reactionMs = isFault ? null : Math.max(1, Math.round(performance.now() - this.drawTime));

    if (this.mode === 'online-host' || this.mode === 'online-guest') {
      this.localReacted = true;
      this.sound?.playJump?.();
      this._updateUI();

      const msg = {
        kind: 'react',
        round: this.round,
        side,
        fault: isFault,
        reactionMs,
      };
      this.sendNet(msg);

      if (this.mode === 'online-host') {
        this._recordOnlineReaction(msg);
      } else {
        this.phase = 'resolving';
        this.bannerMain = isFault ? 'TOO EARLY! 😳' : `⚡ ${reactionMs} ms!`;
        this.bannerSub = 'Checking partner\'s reaction...';
        this._updateUI();
      }
      return;
    }

    // Local 2P or CPU mode
    if (isFault) {
      this._resolveLocalOrCpuFault(side);
    } else {
      this._resolveLocalOrCpuHit(side, reactionMs);
    }
  }

  _resolveLocalOrCpuFault(faultSide) {
    if (this.roundResolved) return;
    this.roundResolved = true;
    const winner = faultSide === 'red' ? 'blue' : 'red';
    const nextRed = this.scores.red + (winner === 'red' ? 1 : 0);
    const nextBlue = this.scores.blue + (winner === 'blue' ? 1 : 0);
    this._applyRoundResult({
      round: this.round,
      winner,
      redMs: null,
      blueMs: null,
      redScore: nextRed,
      blueScore: nextBlue,
      reason: 'fault',
      faultSide,
    });
  }

  _resolveLocalOrCpuHit(winnerSide, reactionMs) {
    if (this.roundResolved) return;
    this.roundResolved = true;
    const nextRed = this.scores.red + (winnerSide === 'red' ? 1 : 0);
    const nextBlue = this.scores.blue + (winnerSide === 'blue' ? 1 : 0);
    this._applyRoundResult({
      round: this.round,
      winner: winnerSide,
      redMs: winnerSide === 'red' ? reactionMs : null,
      blueMs: winnerSide === 'blue' ? reactionMs : null,
      redScore: nextRed,
      blueScore: nextBlue,
      reason: 'faster',
      faultSide: null,
    });
  }

  // ---- Online Sync ----

  handleNet(payload) {
    if (this.destroyed || !payload || typeof payload !== 'object') return;

    if (payload.kind === 'ready' && this.mode === 'online-host') {
      // Re-sync round 1 if guest just finished mounting before anyone reacted
      if (this.round === 1 && !this.roundResolved && !this.roundReactions.red && !this.roundReactions.blue && this.currentRoundPayload) {
        if (this.phase === 'intro' || this.phase === 'waiting' || this.phase === 'draw') {
          this._startRound(1);
        }
      }
      return;
    }

    if (payload.kind === 'round_start' && this.mode === 'online-guest') {
      if (this.phase === 'match_over') return;
      this._beginRoundCountdown(payload);
      return;
    }

    if (payload.kind === 'react' && this.mode === 'online-host') {
      this._recordOnlineReaction(payload);
      return;
    }

    if (payload.kind === 'round_result' && this.mode === 'online-guest') {
      if (payload.round !== this.round && payload.round < this.round) return;
      this._applyRoundResult(payload);
    }
  }

  _recordOnlineReaction(msg) {
    if (this.roundResolved || msg.round !== this.round) return;
    const side = msg.side === 'blue' ? 'blue' : 'red';
    if (this.roundReactions[side]) return;

    this.roundReactions[side] = {
      fault: Boolean(msg.fault),
      reactionMs: typeof msg.reactionMs === 'number' ? Math.max(1, Math.round(msg.reactionMs)) : null,
      at: performance.now(),
    };

    const red = this.roundReactions.red;
    const blue = this.roundReactions.blue;

    if (red && blue) {
      this._finalizeOnlineRound();
      return;
    }

    // Wait briefly so if partner also reacted legitimately at nearly the same instant, lower reactionMs wins fairly!
    const graceMs = msg.fault ? 140 : 520;
    if (this.phase === 'waiting' || this.phase === 'draw') {
      this.phase = 'resolving';
      if (this.localReacted) {
        this.bannerMain = msg.fault ? 'TOO EARLY! 😳' : `⚡ ${msg.reactionMs} ms!`;
        this.bannerSub = 'Comparing reaction times...';
      }
      this._updateUI();
    }

    this._setTimer(() => {
      if (!this.roundResolved && msg.round === this.round) {
        this._finalizeOnlineRound();
      }
    }, graceMs);
  }

  _finalizeOnlineRound() {
    if (this.roundResolved) return;
    this.roundResolved = true;

    const red = this.roundReactions.red;
    const blue = this.roundReactions.blue;

    let winner = null;
    let reason = 'faster';
    let faultSide = null;
    const redMs = red && !red.fault ? red.reactionMs : null;
    const blueMs = blue && !blue.fault ? blue.reactionMs : null;

    if (red && red.fault && blue && blue.fault) {
      // Both jumped the gun — replay cleanly without awarding a point!
      winner = null;
      reason = 'both_fault';
      faultSide = 'both';
    } else if (red && red.fault) {
      winner = 'blue';
      reason = 'fault';
      faultSide = 'red';
    } else if (blue && blue.fault) {
      winner = 'red';
      reason = 'fault';
      faultSide = 'blue';
    } else if (redMs != null && blueMs != null) {
      if (redMs === blueMs) {
        winner = red.at <= blue.at ? 'red' : 'blue';
      } else {
        winner = redMs < blueMs ? 'red' : 'blue';
      }
      reason = 'faster';
    } else if (redMs != null) {
      winner = 'red';
      reason = 'faster';
    } else if (blueMs != null) {
      winner = 'blue';
      reason = 'faster';
    }

    const redScore = this.scores.red + (winner === 'red' ? 1 : 0);
    const blueScore = this.scores.blue + (winner === 'blue' ? 1 : 0);

    const result = {
      kind: 'round_result',
      round: this.round,
      winner,
      redMs,
      blueMs,
      redScore,
      blueScore,
      reason,
      faultSide,
    };

    this.sendNet(result);
    this._applyRoundResult(result);
  }

  _applyRoundResult(res) {
    this._clearAllTimers();
    this.roundResolved = true;
    this.phase = 'round_over';
    this.phaseTime = 0;

    this.scores.red = res.redScore;
    this.scores.blue = res.blueScore;
    this.roundWinner = res.winner;
    this.roundReason = res.reason || 'faster';
    this.faultSide = res.faultSide || null;

    if (typeof res.redMs === 'number') {
      this.lastMs.red = res.redMs;
      this.bestMs.red = this.bestMs.red == null ? res.redMs : Math.min(this.bestMs.red, res.redMs);
    }
    if (typeof res.blueMs === 'number') {
      this.lastMs.blue = res.blueMs;
      this.bestMs.blue = this.bestMs.blue == null ? res.blueMs : Math.min(this.bestMs.blue, res.blueMs);
    }

    const winnerName = res.winner === 'red' ? this.redName : this.blueName;
    const faultName = res.faultSide === 'red' ? this.redName : this.blueName;

    if (res.reason === 'both_fault') {
      this.bannerMain = 'BOTH FLUSTERED! 😳';
      this.bannerSub = 'Too eager! Replaying round...';
      this.shake = 12;
      this.sound?.playMove?.('pear_bounce');
      this._spawnBurst(230, 310, '#ff85c4', 14, 'steam');
      this._spawnBurst(730, 310, '#8cc2ff', 14, 'steam');
    } else if (res.reason === 'fault') {
      this.bannerMain = 'TOO EARLY! FLUSTERED! 😳';
      this.bannerSub = `${faultName} jumped early — ${winnerName} takes the round!`;
      this.shake = 12;
      this.sound?.playMove?.('pear_bounce');
      const fx = res.faultSide === 'red' ? 235 : 725;
      this._spawnBurst(fx, 305, '#ff85c4', 18, 'steam');
      if (res.faultSide === 'red') this.redRecoil = 1;
      else this.blueRecoil = 1;
    } else {
      const winMs = res.winner === 'red' ? res.redMs : res.blueMs;
      const loseMs = res.winner === 'red' ? res.blueMs : res.redMs;
      this.bannerMain = `💋 ${winnerName.toUpperCase()} SMOOCHED FIRST!`;
      if (winMs != null && loseMs != null) {
        this.bannerSub = `⚡ ${winMs} ms vs ${loseMs} ms (+${Math.max(0, loseMs - winMs)} ms faster!)`;
      } else if (winMs != null) {
        this.bannerSub = `⚡ Lightning reaction: ${winMs} ms!`;
      } else {
        this.bannerSub = `${winnerName} wins Round ${this.round}!`;
      }
      this.shake = 14;
      this.sound?.playMove?.('forehead_kiss');
      this._launchKissBlast(res.winner);
    }

    this._updateUI();

    // Check match victory (First to 3!)
    if (this.scores.red >= WINS_NEEDED || this.scores.blue >= WINS_NEEDED) {
      const matchWinner = this.scores.red >= WINS_NEEDED ? 'red' : 'blue';
      this._setTimer(() => {
        if (this.gameOverFired) return;
        this.gameOverFired = true;
        this.phase = 'match_over';
        this._updateUI();
        this.sound?.playVictory?.();
        this._spawnConfetti(60);

        const bestWinMs = this.bestMs[matchWinner];
        const msNote = bestWinMs != null ? ` · Best: ${bestWinMs} ms` : '';
        const summary = `Won ${this.scores.red}–${this.scores.blue}${msNote} 💋`;
        this.onGameOver(matchWinner, summary);
      }, 1750);
      return;
    }

    // Queue next round (or replay if both faulted)
    const nextRound = res.reason === 'both_fault' ? this.round : this.round + 1;
    if (this.mode !== 'online-guest') {
      this._setTimer(() => {
        this._startRound(nextRound);
      }, 2250);
    }
  }

  _launchKissBlast(fromSide) {
    const startX = fromSide === 'red' ? 295 : 665;
    const endX = fromSide === 'red' ? 680 : 280;
    this.kissProjectile = {
      fromSide,
      startX,
      endX,
      x: startX,
      y: 332,
      t: 0,
      duration: 0.34,
      hit: false,
    };
  }

  // ---- Particles & VFX ----

  _spawnBurst(x, y, color, count, kind = 'heart') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 75 + Math.random() * 230;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (kind === 'steam' ? 85 : 35),
        size: kind === 'heart' ? 7 + Math.random() * 8 : 3 + Math.random() * 5,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.55,
        color,
        kind,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 6,
      });
    }
  }

  _spawnConfetti(count) {
    const palette = ['#ff5ca8', '#ffd982', '#8cc2ff', '#fff3c9', '#ff99cc'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: 120 + Math.random() * (LOGICAL_W - 240),
        y: -10 - Math.random() * 90,
        vx: (Math.random() - 0.5) * 140,
        vy: 110 + Math.random() * 190,
        size: 5 + Math.random() * 6,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.1,
        color: palette[i % palette.length],
        kind: i % 3 === 0 ? 'heart' : 'confetti',
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 8,
      });
    }
  }

  // ---- Animation Loop ----

  _startLoop() {
    const tick = (now) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;
      this._update(dt);
      this._draw();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  _update(dt) {
    this.elapsed += dt;
    this.phaseTime += dt;
    this.shake = Math.max(0, this.shake - dt * 36);
    this.drawFlash = Math.max(0, this.drawFlash - dt * 2.4);
    this.fakeoutFlash = Math.max(0, this.fakeoutFlash - dt * 2.2);
    this.redRecoil = Math.max(0, this.redRecoil - dt * 2.4);
    this.blueRecoil = Math.max(0, this.blueRecoil - dt * 2.4);

    // Heartbeat accelerates subtly during waiting phase
    const beatRate = this.phase === 'waiting' ? 2.4 + Math.min(2.2, this.phaseTime * 0.55) : 1.1;
    this.heartbeatPhase += dt * beatRate;

    // Floating cherry blossom petals
    for (const p of this.petals) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.y > LOGICAL_H + 14) {
        p.y = -12;
        p.x = Math.random() * LOGICAL_W;
      }
      if (p.x < -14) p.x = LOGICAL_W + 14;
    }

    // Kiss blast projectile
    if (this.kissProjectile) {
      const kp = this.kissProjectile;
      kp.t += dt / kp.duration;
      const eased = 1 - Math.pow(1 - clamp(kp.t, 0, 1), 3);
      kp.x = lerp(kp.startX, kp.endX, eased);
      kp.y = 332 - Math.sin(clamp(kp.t, 0, 1) * Math.PI) * 52;

      // Trail hearts
      if (kp.t < 1 && Math.random() < 0.75) {
        this.particles.push({
          x: kp.x + (Math.random() - 0.5) * 18,
          y: kp.y + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 40,
          vy: -30 - Math.random() * 45,
          size: 5 + Math.random() * 5,
          life: 0,
          maxLife: 0.45,
          color: kp.fromSide === 'red' ? '#ff7cc2' : '#8cc2ff',
          kind: 'heart',
          rot: 0,
          vrot: 0,
        });
      }

      if (kp.t >= 1 && !kp.hit) {
        kp.hit = true;
        this.shake = 16;
        if (kp.fromSide === 'red') this.blueRecoil = 1;
        else this.redRecoil = 1;
        this.kissMark = {
          side: kp.fromSide === 'red' ? 'blue' : 'red',
          x: kp.endX,
          y: 325,
          age: 0,
        };
        this._spawnBurst(kp.endX, 325, '#ff5ca8', 24, 'heart');
        this._spawnBurst(kp.endX, 325, '#ffd982', 20, 'spark');
        this._spawnConfetti(28);
        this.kissProjectile = null;
      }
    }

    if (this.kissMark) {
      this.kissMark.age += dt;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === 'confetti') {
        pt.vy += 180 * dt;
        pt.vx *= 0.99;
      } else if (pt.kind === 'spark') {
        pt.vy += 260 * dt;
      } else {
        pt.vy -= 22 * dt;
      }
      pt.rot += pt.vrot * dt;
    }
  }

  // ---- Canvas Rendering ----

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this._drawMoonlitStage(ctx);
    this._drawCenterSignal(ctx);

    // Draw Wifebun (left) and Husbun (right)
    const redState = this._getBunnyExpression('red');
    const blueState = this._getBunnyExpression('blue');
    this._drawBunny(ctx, 'red', 225 - this.redRecoil * 26, 405, redState);
    this._drawBunny(ctx, 'blue', 735 + this.blueRecoil * 26, 405, blueState);

    // Draw Kiss Projectile
    if (this.kissProjectile) {
      this._drawKissProjectile(ctx, this.kissProjectile);
    }

    // Draw Kiss Mark on recipient cheek
    if (this.kissMark) {
      this._drawKissMark(ctx, this.kissMark);
    }

    // Particles
    this._drawParticles(ctx);

    // Top/Center Text Banner
    this._drawBanner(ctx);

    // Flash overlays
    if (this.drawFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 224, 160, ${this.drawFlash * 0.28})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
    if (this.fakeoutFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 168, 92, ${this.fakeoutFlash * 0.16})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    ctx.restore();
  }

  _getBunnyExpression(side) {
    if (this.phase === 'round_over' || this.phase === 'match_over') {
      if (this.faultSide === side || this.faultSide === 'both') return 'flustered';
      if (this.roundWinner === side) return 'kiss_win';
      if (this.roundWinner && this.roundWinner !== side) return 'smooched';
    }
    if (this.phase === 'draw') return 'alert';
    if (this.phase === 'waiting') return 'tense';
    return 'idle';
  }

  _drawMoonlitStage(ctx) {
    // Deep twilight plum sky
    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    sky.addColorStop(0, '#13051e');
    sky.addColorStop(0.55, '#2b0f3f');
    sky.addColorStop(0.8, '#41184c');
    sky.addColorStop(1, '#1c0924');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Stars
    for (const s of this.stars) {
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.elapsed * s.twinkleSpeed + s.twinkleOffset));
      ctx.fillStyle = `rgba(255, 243, 210, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Giant glowing romantic moon
    const moonX = LOGICAL_W / 2;
    const moonY = 175;
    const pulse = this.phase === 'waiting'
      ? Math.pow(Math.max(0, Math.sin(this.heartbeatPhase * Math.PI)), 4)
      : 0.15;

    const halo = ctx.createRadialGradient(moonX, moonY, 36, moonX, moonY, 175 + pulse * 36);
    halo.addColorStop(0, this.phase === 'draw' ? 'rgba(255, 130, 195, 0.55)' : 'rgba(255, 224, 155, 0.36)');
    halo.addColorStop(0.5, 'rgba(255, 118, 186, 0.14)');
    halo.addColorStop(1, 'rgba(255, 92, 168, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 175 + pulse * 36, 0, Math.PI * 2);
    ctx.fill();

    // Moon disc
    const moonGrad = ctx.createRadialGradient(moonX - 18, moonY - 18, 8, moonX, moonY, 72);
    moonGrad.addColorStop(0, '#fff9e6');
    moonGrad.addColorStop(0.75, '#ffe29e');
    moonGrad.addColorStop(1, '#f0b86b');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 68 + pulse * 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Eiffel silhouette far behind the moon horizon
    ctx.save();
    ctx.fillStyle = 'rgba(24, 8, 36, 0.55)';
    ctx.beginPath();
    ctx.moveTo(moonX, 232);
    ctx.lineTo(moonX + 10, 315);
    ctx.lineTo(moonX + 34, 392);
    ctx.lineTo(moonX + 16, 392);
    ctx.quadraticCurveTo(moonX, 360, moonX - 16, 392);
    ctx.lineTo(moonX - 34, 392);
    ctx.lineTo(moonX - 10, 315);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Distant rooftop silhouettes
    ctx.fillStyle = 'rgba(20, 7, 30, 0.72)';
    ctx.fillRect(0, 358, 175, 45);
    ctx.fillRect(785, 350, 175, 53);
    ctx.fillRect(140, 372, 110, 30);
    ctx.fillRect(700, 368, 110, 34);

    // String lights / romantic lantern garland across top
    ctx.strokeStyle = 'rgba(255, 217, 130, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(LOGICAL_W / 2, 74, LOGICAL_W, 26);
    ctx.stroke();

    for (let i = 1; i <= 9; i++) {
      const t = i / 10;
      const lx = t * LOGICAL_W;
      const ly = (1 - t) * (1 - t) * 26 + 2 * (1 - t) * t * 74 + t * t * 26;
      const glow = 0.65 + 0.35 * Math.sin(this.elapsed * 3 + i);
      ctx.fillStyle = i % 2 === 0 ? `rgba(255, 130, 198, ${glow})` : `rgba(255, 224, 145, ${glow})`;
      ctx.beginPath();
      ctx.arc(lx, ly + 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating petals
    for (const p of this.petals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.hue;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Moonlit cobblestone terrace floor
    const floorGrad = ctx.createLinearGradient(0, 396, 0, LOGICAL_H);
    floorGrad.addColorStop(0, '#3a1545');
    floorGrad.addColorStop(0.25, '#250c30');
    floorGrad.addColorStop(1, '#14061a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 396, LOGICAL_W, LOGICAL_H - 396);

    // Gold terrace rim line
    ctx.strokeStyle = 'rgba(255, 217, 130, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 397);
    ctx.lineTo(LOGICAL_W, 397);
    ctx.stroke();

    // Subtle duel center line
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(255, 194, 222, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W / 2, 405);
    ctx.lineTo(LOGICAL_W / 2, LOGICAL_H - 12);
    ctx.stroke();
    ctx.restore();
  }

  _drawCenterSignal(ctx) {
    const cx = LOGICAL_W / 2;
    const cy = 175;

    if (this.phase === 'waiting') {
      // Subtle heartbeat ripple expanding from moon
      const beat = (this.heartbeatPhase % 1);
      const r = 72 + beat * 68;
      ctx.strokeStyle = `rgba(255, 133, 196, ${(1 - beat) * 0.55})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle glowing silhouette heart inside moon
      ctx.save();
      const s = 20 + Math.sin(this.heartbeatPhase * Math.PI * 2) * 3;
      ctx.fillStyle = 'rgba(255, 92, 168, 0.25)';
      drawHeartPath(ctx, cx, cy + 4, s);
      ctx.fill();
      ctx.restore();
    } else if (this.phase === 'draw') {
      // Dramatic starburst rays!
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.elapsed * 1.4);
      const rayCount = 14;
      for (let i = 0; i < rayCount; i++) {
        ctx.rotate((Math.PI * 2) / rayCount);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 217, 130, 0.28)' : 'rgba(255, 92, 168, 0.24)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-16, -230);
        ctx.lineTo(16, -230);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Giant glowing pulsing heart emblem
      const beatScale = 1 + 0.1 * Math.sin(this.elapsed * 18);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(beatScale, beatScale);
      ctx.shadowColor = '#ff5ca8';
      ctx.shadowBlur = 28;
      const hg = ctx.createLinearGradient(0, -45, 0, 45);
      hg.addColorStop(0, '#ff85c4');
      hg.addColorStop(1, '#e81b76');
      ctx.fillStyle = hg;
      drawHeartPath(ctx, 0, 6, 56);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff3c9';
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawBunny(ctx, side, x, groundY, expression) {
    const isRed = side === 'red';
    const facing = isRed ? 1 : -1;
    const breath = Math.sin(this.elapsed * (expression === 'tense' ? 7 : 3.2) + (isRed ? 0 : 1.7)) * 2.5;
    const lean = expression === 'tense' ? facing * 8 : expression === 'alert' ? facing * 14 : 0;

    ctx.save();
    ctx.translate(x, groundY);

    // Ground shadow
    ctx.fillStyle = 'rgba(10, 2, 16, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 52, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spotlight aura under feet
    ctx.fillStyle = isRed ? 'rgba(255, 92, 168, 0.2)' : 'rgba(88, 158, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 68, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(lean, breath);
    ctx.scale(facing, 1);

    const furMain = isRed ? '#e9b98c' : '#7b5342';
    const furLight = isRed ? '#f8dbc0' : '#a87b66';
    const earInner = isRed ? '#ff99c8' : '#d7969e';
    const outfitMain = isRed ? '#ff5ca8' : '#2e67d6';
    const outfitDark = isRed ? '#b31a66' : '#193b87';
    const outline = '#260b24';

    // Fluffy tail
    ctx.fillStyle = '#fff6f0';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-34, -44, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Feet / boots
    ctx.fillStyle = outfitDark;
    ctx.beginPath();
    ctx.ellipse(-14, -6, 16, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(16, -6, 17, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Torso / outfit
    ctx.fillStyle = outfitMain;
    drawRoundedRect(ctx, -28, -76, 56, 68, 24);
    ctx.fill();
    ctx.stroke();

    // Outfit trim / gold heart charm
    ctx.fillStyle = '#ffd982';
    if (isRed) {
      drawHeartPath(ctx, 4, -52, 10);
      ctx.fill();
    } else {
      // Gold chain V
      ctx.strokeStyle = '#ffd982';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -72);
      ctx.quadraticCurveTo(4, -52, 16, -72);
      ctx.stroke();
    }

    // Back arm / ready hand
    ctx.fillStyle = furMain;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const armLift = expression === 'kiss_win' ? -18 : expression === 'alert' ? -10 : 0;
    ctx.ellipse(26, -50 + armLift, 14, 9, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Long expressive bunny ears
    const earWiggle = expression === 'tense' ? Math.sin(this.elapsed * 14) * 0.08 : Math.sin(this.elapsed * 3) * 0.04;
    const drawEar = (ex, ey, rot) => {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(rot);
      ctx.fillStyle = furMain;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(0, -34, 13, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(0, -32, 6.5, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawEar(-12, -112, -0.22 + earWiggle);
    drawEar(10, -114, 0.14 - earWiggle);

    // Head
    ctx.fillStyle = furMain;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -96, 36, 33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soft muzzle highlight
    ctx.fillStyle = furLight;
    ctx.beginPath();
    ctx.ellipse(12, -88, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Accessory: Wifebun satin bow / Husbun royal headband
    if (isRed) {
      ctx.fillStyle = '#ff5ca8';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(-18, -124, 13, 8, -0.35, 0, Math.PI * 2);
      ctx.ellipse(-2, -126, 13, 8, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd982';
      ctx.beginPath();
      ctx.arc(-10, -125, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2558c7';
      ctx.strokeStyle = '#ffd982';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, -32, -120, 64, 10, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Rosy cheeks (extra bright if flustered or smooched!)
    const blushAlpha = (expression === 'flustered' || expression === 'smooched') ? 0.85 : 0.45;
    ctx.fillStyle = `rgba(255, 92, 168, ${blushAlpha})`;
    ctx.beginPath();
    ctx.ellipse(6, -86, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes based on expression
    ctx.strokeStyle = outline;
    ctx.fillStyle = outline;
    ctx.lineWidth = 2.6;
    if (expression === 'kiss_win') {
      // Playful wink!
      ctx.beginPath();
      ctx.arc(10, -100, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (expression === 'smooched') {
      // Heart eyes!
      ctx.fillStyle = '#ff3d9a';
      drawHeartPath(ctx, 10, -100, 9);
      ctx.fill();
    } else if (expression === 'flustered') {
      // Dizzy X / wide shock eyes
      ctx.beginPath();
      ctx.moveTo(5, -105);
      ctx.lineTo(15, -95);
      ctx.moveTo(15, -105);
      ctx.lineTo(5, -95);
      ctx.stroke();
    } else {
      // Expressive anime eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(11, -100, 7.5, expression === 'tense' ? 5.5 : 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isRed ? '#7c1a5c' : '#1b356e';
      ctx.beginPath();
      ctx.arc(13, -100, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(14.5, -102, 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (expression === 'tense') {
        // Determined brow
        ctx.beginPath();
        ctx.moveTo(3, -109);
        ctx.lineTo(19, -105);
        ctx.stroke();
      }
    }

    // Cute nose & mouth
    ctx.fillStyle = '#ff6aa8';
    ctx.beginPath();
    ctx.ellipse(25, -92, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.2;
    if (expression === 'kiss_win') {
      // Puckered smooch "3" lips
      ctx.fillStyle = '#ff3d9a';
      ctx.beginPath();
      ctx.arc(24, -84, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'flustered') {
      ctx.beginPath();
      ctx.arc(21, -82, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(20, -85, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();

    // Nameplate under bunny
    ctx.save();
    ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isRed ? '#ff99cf' : '#99ccff';
    ctx.fillText(isRed ? this.redName : this.blueName, x, groundY + 34);
    ctx.restore();
  }

  _drawKissProjectile(ctx, kp) {
    ctx.save();
    ctx.translate(kp.x, kp.y);
    const dir = kp.fromSide === 'red' ? 1 : -1;
    const scale = 1.15 + Math.sin(kp.t * Math.PI) * 0.45;
    ctx.scale(dir * scale, scale);

    // Radiant kiss aura
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 52);
    glow.addColorStop(0, 'rgba(255, 92, 168, 0.85)');
    glow.addColorStop(0.6, 'rgba(255, 217, 130, 0.35)');
    glow.addColorStop(1, 'rgba(255, 92, 168, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Glossy giant lips icon
    ctx.font = '56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💋', 0, 0);
    ctx.restore();
  }

  _drawKissMark(ctx, km) {
    ctx.save();
    const pop = Math.min(1, km.age * 7);
    const s = 0.6 + pop * 0.6;
    ctx.translate(km.x, km.y - 12);
    ctx.rotate(km.side === 'blue' ? -0.22 : 0.22);
    ctx.scale(s, s);
    ctx.font = '38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💋', 0, 0);
    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const pt of this.particles) {
      const alpha = 1 - pt.life / pt.maxLife;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillStyle = pt.color;

      if (pt.kind === 'heart') {
        drawHeartPath(ctx, 0, 0, pt.size);
        ctx.fill();
      } else if (pt.kind === 'confetti') {
        ctx.fillRect(-pt.size * 0.6, -pt.size * 0.35, pt.size * 1.2, pt.size * 0.7);
      } else if (pt.kind === 'steam') {
        ctx.fillStyle = 'rgba(255, 232, 244, 0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, pt.size * 1.25, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawBanner(ctx) {
    ctx.save();
    const cx = LOGICAL_W / 2;
    const isDraw = this.phase === 'draw';
    const isFakeout = this.phase === 'waiting' && this.fakeoutFlash > 0.05;

    // Main title text
    const mainY = isDraw ? 298 : 284;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const bounce = isDraw ? 1 + Math.sin(this.elapsed * 22) * 0.045 : 1;
    ctx.save();
    ctx.translate(cx, mainY);
    ctx.scale(bounce, bounce);

    ctx.font = isDraw
      ? '900 58px "Bangers", "Chakra Petch", Impact, sans-serif'
      : '800 34px "Chakra Petch", system-ui, sans-serif';

    ctx.lineWidth = isDraw ? 9 : 6;
    ctx.strokeStyle = 'rgba(22, 6, 30, 0.92)';
    ctx.strokeText(this.bannerMain, 0, 0);

    if (isDraw) {
      const grad = ctx.createLinearGradient(0, -28, 0, 28);
      grad.addColorStop(0, '#fff6d6');
      grad.addColorStop(0.5, '#ffd982');
      grad.addColorStop(1, '#ff5ca8');
      ctx.fillStyle = grad;
    } else if (isFakeout) {
      ctx.fillStyle = '#ffb366';
    } else if (this.phase === 'round_over' && this.roundReason === 'fault') {
      ctx.fillStyle = '#ff85c4';
    } else {
      ctx.fillStyle = '#fff8fc';
    }
    ctx.fillText(this.bannerMain, 0, 0);
    ctx.restore();

    // Subtitle pill
    if (this.bannerSub) {
      ctx.font = '700 17px "Inter", system-ui, sans-serif';
      const tw = ctx.measureText(this.bannerSub).width;
      const pw = Math.min(LOGICAL_W - 80, tw + 34);
      const py = mainY + (isDraw ? 48 : 38);

      ctx.fillStyle = 'rgba(20, 7, 30, 0.76)';
      ctx.strokeStyle = isDraw ? 'rgba(255, 217, 130, 0.72)' : 'rgba(255, 194, 222, 0.35)';
      ctx.lineWidth = 1.6;
      drawRoundedRect(ctx, cx - pw / 2, py - 16, pw, 32, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDraw ? '#fff3c9' : '#f4dce9';
      ctx.fillText(this.bannerSub, cx, py + 1);
    }

    ctx.restore();
  }
}
