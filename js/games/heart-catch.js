// 🎯 Moonlit Heart Catch Rush 1v1 — Wifebun ♥ Husbun Date Night Arcade
// Self-contained real-time Canvas minigame adhering to the shared MiniGame interface contract.

const LOGICAL_W = 960;
const LOGICAL_H = 540;
const GROUND_Y = 468;
const LEFT_BOUND = 46;
const RIGHT_BOUND = LOGICAL_W - 46;

const MATCH_DURATION = 30.0;
const BASE_MOVE_SPEED = 415;
const DASH_SPEED = 940;
const DASH_DURATION = 0.23;
const DASH_COOLDOWN = 1.15;
const STUN_DURATION = 0.7;

const STATE_SYNC_INTERVAL = 1 / 28;
const INPUT_SYNC_INTERVAL = 1 / 28;

const ITEM_TYPES = {
  rose:       { pts: 1,  r: 20, speedMin: 165, speedMax: 240, label: '+1', color: '#ff6eb4', glow: '#ff5ca8' },
  gold_heart: { pts: 3,  r: 22, speedMin: 215, speedMax: 305, label: '+3', color: '#ffd982', glow: '#ffbe45' },
  diamond:    { pts: 5,  r: 21, speedMin: 275, speedMax: 365, label: '+5', color: '#7ef9ff', glow: '#4ce4ff' },
  cloud:      { pts: -2, r: 24, speedMin: 185, speedMax: 275, label: '-2', color: '#b47aff', glow: '#8e44ff' },
};

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawHeartPath(ctx, x, y, size) {
  ctx.beginPath();
  const topY = y - size * 0.25;
  ctx.moveTo(x, y + size * 0.62);
  ctx.bezierCurveTo(
    x - size * 0.95, y + size * 0.05,
    x - size * 0.92, topY - size * 0.65,
    x, topY - size * 0.08
  );
  ctx.bezierCurveTo(
    x + size * 0.92, topY - size * 0.65,
    x + size * 0.95, y + size * 0.05,
    x, y + size * 0.62
  );
  ctx.closePath();
}

export class HeartCatchGame {
  constructor(containerEl, opts = {}) {
    this.container = containerEl;
    this.mode = opts.mode || 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
    this.mySide = opts.mySide || (this.mode === 'online-host' ? 'blue' : 'red');
    this.redName = opts.redName || 'Wifebun';
    this.blueName = opts.blueName || 'Husbun';
    this.sendNet = typeof opts.sendNet === 'function' ? opts.sendNet : () => {};
    this.onGameOver = typeof opts.onGameOver === 'function' ? opts.onGameOver : () => {};
    this.sound = opts.sound || null;

    this._destroyed = false;
    this._rafId = null;
    this._lastTime = 0;
    this._clock = 0;
    this._syncAccum = 0;
    this._nextItemId = 1;
    this._gameOverEmitted = false;
    this._lastCountdownSec = 4;
    this._rushAnnounced = false;

    this.canvas = null;
    this.ctx = null;
    this.dpr = 1;
    this._hud = {};
    this._btnListeners = [];

    // Input state
    this.keys = new Set();
    this._btnDir = 0; // -1, 0, 1 from on-screen buttons
    this._pendingLocalDash = { red: false, blue: false };
    this._pointerActive = false;
    this._pointerTargetX = null;
    this._lastTapTime = 0;

    // Guest remote input received on host
    this._remoteInput = { dir: 0, dash: false, targetX: null };
    // Guest latched dash flag waiting for next net tick
    this._guestDashLatch = false;

    // Ambient moonlit stars & petals
    this._stars = Array.from({ length: 46 }, (_, i) => ({
      x: ((i * 197 + 31) % LOGICAL_W),
      y: 22 + ((i * 89 + 17) % 240),
      r: 0.9 + (i % 4) * 0.55,
      phase: i * 0.9,
      speed: 1.4 + (i % 5) * 0.45,
    }));
    this._fireflies = Array.from({ length: 14 }, (_, i) => ({
      x: (i * 73) % LOGICAL_W,
      y: 250 + ((i * 53) % 190),
      phase: i * 1.3,
      speed: 18 + (i % 4) * 7,
    }));

    // Bound listeners
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._loop = this._tick.bind(this);

    this._initState();
  }

  _initState() {
    this.timeLeft = MATCH_DURATION;
    this.phase = 'play'; // 'play' | 'over'
    this.scores = { red: 0, blue: 0 };
    this._gameOverEmitted = false;
    this._lastCountdownSec = 4;
    this._rushAnnounced = false;
    this._spawnTimer = 0.25;
    this._rushBannerTimer = 0;

    this.players = {
      red: this._createPlayer('red', 270, 1),
      blue: this._createPlayer('blue', 690, -1),
    };

    this.items = [];
    this.popups = [];
    this.particles = [];
    this.afterimages = [];
    this.shake = 0;

    this._pendingLocalDash = { red: false, blue: false };
    this._remoteInput = { dir: 0, dash: false, targetX: null };
    this._guestDashLatch = false;
    this._netItemsMap = new Map();
    this._netPlayers = null;
  }

  _createPlayer(side, x, facing) {
    return {
      side,
      x,
      vx: 0,
      facing,
      dashTimer: 0,
      dashCooldown: 0,
      dashDir: facing,
      stunTimer: 0,
      happyTimer: 0,
      runPhase: 0,
      streak: 0,
      afterimageTimer: 0,
    };
  }

  start() {
    if (this._destroyed || !this.container) return;
    this._renderDOM();
    this._setupCanvas();
    this._bindEvents();
    this._updateHUD();
    this.sound?.playBell?.();

    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
  }

  restart() {
    if (this._destroyed) return;
    this._initState();
    this._updateHUD();
    this.sound?.playBell?.();

    if (this.mode === 'online-host') {
      this.sendNet({ kind: 'reset' });
      this._broadcastHostState();
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
    }

    for (const { el, ev, fn } of this._btnListeners) {
      el.removeEventListener(ev, fn);
    }
    this._btnListeners.length = 0;

    this.keys.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.canvas = null;
    this.ctx = null;
  }

  handleNet(payload) {
    if (this._destroyed || !payload || typeof payload !== 'object') return;

    if (this.mode === 'online-host') {
      if (payload.kind === 'input') {
        this._remoteInput.dir = clamp(Number(payload.dir) || 0, -1, 1);
        if (payload.dash) this._remoteInput.dash = true;
        this._remoteInput.targetX = typeof payload.tx === 'number' ? clamp(payload.tx, LEFT_BOUND, RIGHT_BOUND) : null;
      }
      return;
    }

    if (this.mode === 'online-guest') {
      if (payload.kind === 'reset') {
        this._initState();
        this._updateHUD();
        this.sound?.playBell?.();
        return;
      }

      if (payload.kind === 'pickup') {
        const side = payload.side === 'blue' ? 'blue' : 'red';
        const type = ITEM_TYPES[payload.type] ? payload.type : 'rose';
        const x = Number(payload.x) || this.players[side].x;
        const y = Number(payload.y) || GROUND_Y - 56;
        if (typeof payload.sr === 'number') this.scores.red = payload.sr;
        if (typeof payload.sb === 'number') this.scores.blue = payload.sb;
        this._updateHUD();
        this._triggerPickupVisuals(side, type, x, y);
        return;
      }

      if (payload.kind === 'over') {
        if (typeof payload.sr === 'number') this.scores.red = payload.sr;
        if (typeof payload.sb === 'number') this.scores.blue = payload.sb;
        this.timeLeft = 0;
        this.phase = 'over';
        this._updateHUD();
        this._emitGameOver(payload.winner || this._computeWinner());
        return;
      }

      if (payload.kind === 'state') {
        const prevTime = this.timeLeft;
        this.timeLeft = Math.max(0, Number(payload.t) || 0);
        if (typeof payload.sr === 'number') this.scores.red = payload.sr;
        if (typeof payload.sb === 'number') this.scores.blue = payload.sb;
        this._checkTimerMilestones(prevTime, this.timeLeft);
        this._updateHUD();

        this._netPlayers = {
          red: payload.r,
          blue: payload.b,
        };

        // Sync falling items smoothly by ID
        const incomingIds = new Set();
        const rawItems = Array.isArray(payload.items) ? payload.items : [];
        for (const it of rawItems) {
          incomingIds.add(it.id);
          let existing = this._netItemsMap.get(it.id);
          if (!existing) {
            existing = {
              id: it.id,
              type: ITEM_TYPES[it.tp] ? it.tp : 'rose',
              x: Number(it.x) || 480,
              y: Number(it.y) || -20,
              tx: Number(it.x) || 480,
              ty: Number(it.y) || -20,
              vy: Number(it.vy) || 200,
              wobble: Number(it.wb) || 0,
            };
            this._netItemsMap.set(it.id, existing);
          } else {
            existing.tx = Number(it.x) || existing.tx;
            existing.ty = Number(it.y) || existing.ty;
            existing.vy = Number(it.vy) || existing.vy;
          }
        }
        for (const id of Array.from(this._netItemsMap.keys())) {
          if (!incomingIds.has(id)) {
            this._netItemsMap.delete(id);
          }
        }
        this.items = Array.from(this._netItemsMap.values());
      }
    }
  }

  _renderDOM() {
    const redLabel = this._escapeHtml(this.redName);
    const blueLabel = this._escapeHtml(this.blueName);
    const redYou = this.mode !== 'local' && this.mySide === 'red' ? '<span class="hc-you">YOU</span>' : '';
    const blueYou = this.mode !== 'local' && this.mySide === 'blue' ? '<span class="hc-you">YOU</span>' : '';

    let hintText = 'Move: A/D, Arrows, or Drag · Dash: Space/Shift or ✨ button';
    if (this.mode === 'local') {
      hintText = `${redLabel}: A/D + W Dash · ${blueLabel}: ←/→ + ↑ Dash`;
    }

    this.container.innerHTML = `
      <style>
        .hc-wrap {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          user-select: none;
          -webkit-user-select: none;
          font-family: var(--font-arcade, 'Chakra Petch', system-ui, sans-serif);
        }
        .hc-hud {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding: 7px 14px;
          background: linear-gradient(135deg, rgba(44, 14, 52, 0.92), rgba(22, 9, 34, 0.95));
          border: 1px solid rgba(255, 206, 158, 0.28);
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(8, 2, 12, 0.45);
        }
        .hc-side {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .hc-side.blue {
          justify-content: flex-end;
          text-align: right;
        }
        .hc-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: clamp(0.8rem, 1.8vw, 0.96rem);
          white-space: nowrap;
        }
        .hc-side.red .hc-name { color: #ff85c4; }
        .hc-side.blue .hc-name { color: #8cc2ff; }
        .hc-you {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd982, #f4b7c7);
          color: #210726;
        }
        .hc-pts {
          font-family: var(--font-display, 'Bangers', Impact, sans-serif);
          font-size: clamp(1.55rem, 3vw, 2.15rem);
          line-height: 1;
          min-width: 44px;
          text-align: center;
        }
        .hc-side.red .hc-pts {
          color: #ff85c4;
          text-shadow: 0 0 12px rgba(255, 92, 168, 0.65);
        }
        .hc-side.blue .hc-pts {
          color: #8cc2ff;
          text-shadow: 0 0 12px rgba(88, 158, 255, 0.65);
        }
        .hc-timer-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 14px;
          border-radius: 12px;
          background: rgba(255, 217, 130, 0.1);
          border: 1px solid rgba(255, 217, 130, 0.3);
        }
        .hc-timer {
          font-family: var(--font-display, 'Bangers', Impact, sans-serif);
          font-size: clamp(1.4rem, 2.8vw, 1.85rem);
          line-height: 1;
          letter-spacing: 0.05em;
          color: #ffd982;
          text-shadow: 0 0 12px rgba(255, 217, 130, 0.55);
        }
        .hc-timer.urgent {
          color: #ff6b9e;
          text-shadow: 0 0 14px rgba(255, 92, 168, 0.9);
        }
        .hc-legend {
          font-size: 0.64rem;
          color: rgba(255, 240, 248, 0.8);
          white-space: nowrap;
        }
        .hc-stage {
          width: 100%;
          max-width: min(100%, calc(min(56vh, 475px) * 16 / 9));
          aspect-ratio: 16 / 9;
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          border: 1.5px solid rgba(255, 206, 158, 0.34);
          box-shadow:
            0 14px 38px rgba(6, 2, 12, 0.66),
            0 0 26px rgba(255, 92, 168, 0.16),
            0 0 26px rgba(88, 158, 255, 0.14);
          background: #10061c;
        }
        .hc-canvas {
          display: block;
          width: 100%;
          height: 100%;
          touch-action: none;
          cursor: pointer;
        }
        .hc-controls-row {
          width: 100%;
          max-width: 620px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .hc-btn {
          appearance: none;
          border: 1px solid rgba(255, 206, 158, 0.34);
          background: linear-gradient(180deg, rgba(64, 24, 74, 0.92), rgba(34, 12, 44, 0.95));
          color: #fff8fc;
          font-family: var(--font-arcade, 'Chakra Petch', system-ui, sans-serif);
          font-weight: 700;
          font-size: 0.86rem;
          padding: 7px 18px;
          border-radius: 12px;
          cursor: pointer;
          touch-action: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
          transition: transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .hc-btn:active, .hc-btn.active {
          transform: scale(0.95);
          border-color: #ffd982;
          box-shadow: 0 0 14px rgba(255, 217, 130, 0.45);
        }
        .hc-btn.dash {
          background: linear-gradient(135deg, #ff5ca8, #b545ff);
          border-color: rgba(255, 243, 201, 0.55);
          padding: 7px 22px;
          letter-spacing: 0.05em;
        }
        .hc-hint {
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
          font-size: 0.75rem;
          color: #d7b7cf;
          text-align: center;
        }
      </style>
      <div class="hc-wrap">
        <div class="hc-hud">
          <div class="hc-side red">
            <div class="hc-name"><span>🎀 ${redLabel}</span>${redYou}</div>
            <div class="hc-pts" data-hc-score="red">0</div>
          </div>
          <div class="hc-timer-box">
            <div class="hc-timer" data-hc-timer>30.0s</div>
            <div class="hc-legend">🌹+1 · 💛+3 · 💎+5 · ⛈️-2</div>
          </div>
          <div class="hc-side blue">
            <div class="hc-pts" data-hc-score="blue">0</div>
            <div class="hc-name">${blueYou}<span>${blueLabel} 💪</span></div>
          </div>
        </div>
        <div class="hc-stage">
          <canvas class="hc-canvas"></canvas>
        </div>
        <div class="hc-controls-row">
          ${this.mode !== 'local' ? `
            <button type="button" class="hc-btn" data-hc-btn="left">◀</button>
            <button type="button" class="hc-btn dash" data-hc-btn="dash">✨ DASH</button>
            <button type="button" class="hc-btn" data-hc-btn="right">▶</button>
          ` : ''}
          <span class="hc-hint">${hintText}</span>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('.hc-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._hud = {
      redScore: this.container.querySelector('[data-hc-score="red"]'),
      blueScore: this.container.querySelector('[data-hc-score="blue"]'),
      timer: this.container.querySelector('[data-hc-timer]'),
    };
  }

  _setupCanvas() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(LOGICAL_W * this.dpr);
    this.canvas.height = Math.round(LOGICAL_H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);

    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      this.canvas.addEventListener('pointermove', this._onPointerMove);
    }

    const bindBtn = (selector, onDown, onUp) => {
      const el = this.container.querySelector(selector);
      if (!el) return;
      const downFn = (e) => {
        e.preventDefault();
        this.sound?.init?.();
        el.classList.add('active');
        onDown();
      };
      const upFn = () => {
        el.classList.remove('active');
        if (onUp) onUp();
      };
      el.addEventListener('pointerdown', downFn);
      el.addEventListener('pointerup', upFn);
      el.addEventListener('pointerleave', upFn);
      el.addEventListener('pointercancel', upFn);
      this._btnListeners.push(
        { el, ev: 'pointerdown', fn: downFn },
        { el, ev: 'pointerup', fn: upFn },
        { el, ev: 'pointerleave', fn: upFn },
        { el, ev: 'pointercancel', fn: upFn }
      );
    };

    bindBtn('[data-hc-btn="left"]', () => {
      this._pointerTargetX = null;
      this._btnDir = -1;
    }, () => {
      if (this._btnDir === -1) this._btnDir = 0;
    });

    bindBtn('[data-hc-btn="right"]', () => {
      this._pointerTargetX = null;
      this._btnDir = 1;
    }, () => {
      if (this._btnDir === 1) this._btnDir = 0;
    });

    bindBtn('[data-hc-btn="dash"]', () => {
      this._queueDash(this.mySide);
    });
  }

  _handleResize() {
    this._setupCanvas();
  }

  _handleBlur() {
    this.keys.clear();
    this._btnDir = 0;
    this._pointerActive = false;
    this._pointerTargetX = null;
  }

  _handleKeyDown(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const code = e.code;
    if (
      code === 'ArrowLeft' || code === 'ArrowRight' ||
      code === 'ArrowUp' || code === 'ArrowDown' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    const wasDown = this.keys.has(code);
    this.keys.add(code);

    // Clear pointer target when keyboard steering begins
    if (code === 'KeyA' || code === 'KeyD' || code === 'ArrowLeft' || code === 'ArrowRight') {
      this._pointerTargetX = null;
    }

    if (!wasDown) {
      if (this.mode === 'local') {
        if (code === 'KeyW' || code === 'ShiftLeft' || code === 'Space') {
          this._queueDash('red');
        }
        if (code === 'ArrowUp' || code === 'ShiftRight' || code === 'Enter') {
          this._queueDash('blue');
        }
      } else {
        if (
          code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight' ||
          code === 'KeyW' || code === 'ArrowUp'
        ) {
          this._queueDash(this.mySide);
        }
      }
    }
  }

  _handleKeyUp(e) {
    this.keys.delete(e.code);
  }

  _canvasX(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return LOGICAL_W / 2;
    return clamp(((e.clientX - rect.left) / rect.width) * LOGICAL_W, LEFT_BOUND, RIGHT_BOUND);
  }

  _handlePointerDown(e) {
    if (!this.canvas || this.mode === 'local') return;
    this.sound?.init?.();
    this._pointerActive = true;
    this._pointerTargetX = this._canvasX(e);

    // Double-tap / double-click triggers dash!
    const now = performance.now();
    if (now - this._lastTapTime < 280) {
      this._queueDash(this.mySide);
      this._lastTapTime = 0;
    } else {
      this._lastTapTime = now;
    }
  }

  _handlePointerMove(e) {
    if (!this.canvas || this.mode === 'local') return;
    if (this._pointerActive || e.pointerType === 'mouse') {
      this._pointerTargetX = this._canvasX(e);
    }
  }

  _handlePointerUp() {
    this._pointerActive = false;
  }

  _queueDash(side) {
    if (this.mode === 'online-guest') {
      this._guestDashLatch = true;
      return;
    }
    this._pendingLocalDash[side] = true;
  }

  _updateHUD() {
    if (!this._hud.redScore) return;
    this._hud.redScore.textContent = String(this.scores.red);
    this._hud.blueScore.textContent = String(this.scores.blue);
    this._hud.timer.textContent = `${this.timeLeft.toFixed(1)}s`;
    this._hud.timer.classList.toggle('urgent', this.timeLeft <= 10 && this.timeLeft > 0);
  }

  _checkTimerMilestones(prevT, curT) {
    if (!this._rushAnnounced && prevT > 10 && curT <= 10) {
      this._rushAnnounced = true;
      this._rushBannerTimer = 2.0;
      this.sound?.playBell?.();
    }
    const sec = Math.ceil(curT);
    if (sec <= 3 && sec >= 1 && sec < this._lastCountdownSec) {
      this._lastCountdownSec = sec;
      this.sound?.playBlock?.();
    }
  }

  _tick(now) {
    if (this._destroyed) return;
    const dt = clamp((now - this._lastTime) / 1000, 0, 0.05);
    this._lastTime = now;
    this._clock += dt;

    if (this.mode === 'online-guest') {
      this._updateGuest(dt);
    } else {
      this._updateAuthoritative(dt);
    }

    this._updateEffects(dt);
    this._render();

    this._rafId = requestAnimationFrame(this._loop);
  }

  _readLocalDir(side) {
    let dir = 0;
    const useAD = this.mode === 'local' ? side === 'red' : side === this.mySide;
    const useArrows = this.mode === 'local' ? side === 'blue' : side === this.mySide;

    if (useAD) {
      if (this.keys.has('KeyA')) dir -= 1;
      if (this.keys.has('KeyD')) dir += 1;
    }
    if (useArrows) {
      if (this.keys.has('ArrowLeft')) dir -= 1;
      if (this.keys.has('ArrowRight')) dir += 1;
    }
    if (this.mode !== 'local' && side === this.mySide && this._btnDir !== 0) {
      dir = this._btnDir;
    }
    return clamp(dir, -1, 1);
  }

  _stepPlayer(p, dir, wantDash, targetX, dt) {
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.happyTimer = Math.max(0, p.happyTimer - dt);

    if (p.stunTimer > 0) {
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.dashTimer = 0;
      p.vx = 0;
      return;
    }

    // Resolve steering direction from pointer target if no explicit directional press
    let effDir = dir;
    if (effDir === 0 && typeof targetX === 'number') {
      const diff = targetX - p.x;
      if (Math.abs(diff) > 6) {
        effDir = clamp(diff / 28, -1, 1);
      }
    }

    if (Math.abs(effDir) > 0.08) {
      p.facing = effDir > 0 ? 1 : -1;
    }

    if (wantDash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashDir = Math.abs(effDir) > 0.08 ? (effDir > 0 ? 1 : -1) : p.facing;
      p.facing = p.dashDir;
      this.sound?.playDodge?.();
      this._spawnBurst(p.x, GROUND_Y - 30, p.side === 'red' ? '#ff5ca8' : '#589eff', 10);
    }

    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.vx = p.dashDir * DASH_SPEED;
      p.afterimageTimer -= dt;
      if (p.afterimageTimer <= 0) {
        p.afterimageTimer = 0.035;
        this.afterimages.push({
          side: p.side,
          x: p.x,
          facing: p.facing,
          life: 0.24,
          maxLife: 0.24,
        });
      }
    } else {
      p.vx = effDir * BASE_MOVE_SPEED;
    }

    p.x = clamp(p.x + p.vx * dt, LEFT_BOUND, RIGHT_BOUND);
    if (Math.abs(p.vx) > 20) {
      p.runPhase += dt * (p.dashTimer > 0 ? 24 : 14);
    }
  }

  _stepAIPlayer(p, dt) {
    // Evaluate best item to chase while avoiding purple rainclouds
    let bestItem = null;
    let bestScore = -Infinity;
    let dangerCloud = null;

    for (const it of this.items) {
      const spec = ITEM_TYPES[it.type];
      const timeToLand = Math.max(0.08, (GROUND_Y - 56 - it.y) / Math.max(60, it.vy));
      const distX = Math.abs(it.x - p.x);

      if (it.type === 'cloud') {
        if (it.y > 160 && distX < 58 && timeToLand < 0.85) {
          dangerCloud = it;
        }
        continue;
      }

      if (it.y > GROUND_Y - 26) continue;
      // Can we reach it in time?
      const maxReach = BASE_MOVE_SPEED * timeToLand + 65;
      if (distX > maxReach + 120) continue;

      const valueWeight = spec.pts * 140;
      const urgency = it.y * 0.45;
      const score = valueWeight + urgency - distX * 1.15;
      if (score > bestScore) {
        bestScore = score;
        bestItem = it;
      }
    }

    let dir = 0;
    let wantDash = false;

    if (dangerCloud) {
      dir = p.x >= dangerCloud.x ? 1 : -1;
      if (p.x < LEFT_BOUND + 70) dir = 1;
      if (p.x > RIGHT_BOUND - 70) dir = -1;
      if (Math.abs(p.x - dangerCloud.x) < 34 && p.dashCooldown <= 0) {
        wantDash = true;
      }
    } else if (bestItem) {
      const diff = bestItem.x - p.x;
      if (Math.abs(diff) > 12) {
        dir = diff > 0 ? 0.92 : -0.92;
      }
      if (
        (bestItem.type === 'diamond' || bestItem.type === 'gold_heart') &&
        Math.abs(diff) > 130 &&
        bestItem.y > 190 &&
        p.dashCooldown <= 0 &&
        Math.random() < 0.08
      ) {
        wantDash = true;
      }
    } else {
      // Drift gently back toward center-ish patrol
      const home = p.side === 'blue' ? 620 : 340;
      if (Math.abs(home - p.x) > 30) {
        dir = home > p.x ? 0.5 : -0.5;
      }
    }

    this._stepPlayer(p, dir, wantDash, null, dt);
  }

  _updateAuthoritative(dt) {
    if (this.phase === 'over') return;

    const prevTime = this.timeLeft;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this._checkTimerMilestones(prevTime, this.timeLeft);

    // Move players
    if (this.mode === 'cpu') {
      const aiSide = this.mySide === 'red' ? 'blue' : 'red';
      this._stepPlayer(
        this.players[this.mySide],
        this._readLocalDir(this.mySide),
        this._pendingLocalDash[this.mySide],
        this._pointerTargetX,
        dt
      );
      this._pendingLocalDash[this.mySide] = false;
      this._stepAIPlayer(this.players[aiSide], dt);
    } else if (this.mode === 'local') {
      this._stepPlayer(this.players.red, this._readLocalDir('red'), this._pendingLocalDash.red, null, dt);
      this._stepPlayer(this.players.blue, this._readLocalDir('blue'), this._pendingLocalDash.blue, null, dt);
      this._pendingLocalDash.red = false;
      this._pendingLocalDash.blue = false;
    } else if (this.mode === 'online-host') {
      const guestSide = this.mySide === 'blue' ? 'red' : 'blue';
      this._stepPlayer(
        this.players[this.mySide],
        this._readLocalDir(this.mySide),
        this._pendingLocalDash[this.mySide],
        this._pointerTargetX,
        dt
      );
      this._pendingLocalDash[this.mySide] = false;

      this._stepPlayer(
        this.players[guestSide],
        this._remoteInput.dir,
        this._remoteInput.dash,
        this._remoteInput.targetX,
        dt
      );
      this._remoteInput.dash = false;
    }

    // Spawn falling items
    const isRush = this.timeLeft <= 10;
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnItem(isRush);
      this._spawnTimer = isRush
        ? 0.24 + Math.random() * 0.22
        : 0.36 + Math.random() * 0.30;
    }

    // Update falling items & check catches
    const catchY = GROUND_Y - 52;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.vy * dt;
      it.wobble += dt * 3.2;

      if (it.y > GROUND_Y + 26) {
        this.items.splice(i, 1);
        continue;
      }

      // Check catch against players (randomize tie-break fairness)
      const order = Math.random() < 0.5 ? ['red', 'blue'] : ['blue', 'red'];
      let caught = false;
      for (const side of order) {
        const pl = this.players[side];
        const dx = Math.abs(it.x - pl.x);
        const dy = Math.abs(it.y - catchY);
        if (dx < 40 + it.r * 0.55 && dy < 38 + it.r * 0.55) {
          this._handleCatch(pl, it);
          this.items.splice(i, 1);
          caught = true;
          break;
        }
      }
      if (caught) continue;
    }

    this._updateHUD();

    // Check match end
    if (this.timeLeft <= 0) {
      this.phase = 'over';
      const winner = this._computeWinner();
      if (this.mode === 'online-host') {
        this.sendNet({
          kind: 'over',
          winner,
          sr: this.scores.red,
          sb: this.scores.blue,
        });
      }
      this._emitGameOver(winner);
      return;
    }

    // Broadcast host state at ~28Hz
    if (this.mode === 'online-host') {
      this._syncAccum += dt;
      if (this._syncAccum >= STATE_SYNC_INTERVAL) {
        this._syncAccum = 0;
        this._broadcastHostState();
      }
    }
  }

  _updateGuest(dt) {
    const dir = this._readLocalDir(this.mySide);
    const tx = dir !== 0 ? null : this._pointerTargetX;

    this._syncAccum += dt;
    if (this._syncAccum >= INPUT_SYNC_INTERVAL || this._guestDashLatch) {
      this._syncAccum = 0;
      this.sendNet({
        kind: 'input',
        dir,
        dash: this._guestDashLatch ? 1 : 0,
        tx: typeof tx === 'number' ? Math.round(tx) : null,
      });
      this._guestDashLatch = false;
    }

    // Smoothly interpolate players from host snapshots
    if (this._netPlayers) {
      for (const side of ['red', 'blue']) {
        const np = this._netPlayers[side];
        const p = this.players[side];
        if (!np) continue;
        const prevX = p.x;
        const alpha = 1 - Math.exp(-24 * dt);
        p.x = lerp(p.x, Number(np.x) || p.x, alpha);
        p.facing = np.f || p.facing;
        p.stunTimer = Number(np.st) || 0;
        p.dashCooldown = Number(np.dc) || 0;
        const wasDashing = p.dashTimer > 0;
        p.dashTimer = Number(np.dt) || 0;
        if (p.dashTimer > 0 && !wasDashing) {
          this.sound?.playDodge?.();
        }
        if (p.dashTimer > 0) {
          p.afterimageTimer -= dt;
          if (p.afterimageTimer <= 0) {
            p.afterimageTimer = 0.038;
            this.afterimages.push({
              side: p.side,
              x: p.x,
              facing: p.facing,
              life: 0.24,
              maxLife: 0.24,
            });
          }
        }
        p.happyTimer = Math.max(0, p.happyTimer - dt);
        const moved = Math.abs(p.x - prevX);
        if (moved > 0.6) {
          p.runPhase += dt * (p.dashTimer > 0 ? 24 : 14);
        }
      }
    }

    // Smoothly extrapolate & blend falling items
    for (const it of this.items) {
      it.y += it.vy * dt * 0.65;
      it.x = lerp(it.x, it.tx, 1 - Math.exp(-20 * dt));
      it.y = lerp(it.y, it.ty, 1 - Math.exp(-20 * dt));
      it.wobble += dt * 3.2;
    }
  }

  _broadcastHostState() {
    const packPlayer = (p) => ({
      x: Math.round(p.x * 10) / 10,
      f: p.facing,
      st: Math.round(p.stunTimer * 100) / 100,
      dt: Math.round(p.dashTimer * 100) / 100,
      dc: Math.round(p.dashCooldown * 100) / 100,
    });

    this.sendNet({
      kind: 'state',
      t: Math.round(this.timeLeft * 100) / 100,
      sr: this.scores.red,
      sb: this.scores.blue,
      r: packPlayer(this.players.red),
      b: packPlayer(this.players.blue),
      items: this.items.map((it) => ({
        id: it.id,
        tp: it.type,
        x: Math.round(it.x),
        y: Math.round(it.y),
        vy: Math.round(it.vy),
        wb: Math.round(it.wobble * 10) / 10,
      })),
    });
  }

  _spawnItem(isRush) {
    const roll = Math.random();
    let type = 'rose';
    if (isRush) {
      if (roll < 0.16) type = 'diamond';
      else if (roll < 0.50) type = 'gold_heart';
      else if (roll < 0.78) type = 'rose';
      else type = 'cloud';
    } else {
      if (roll < 0.09) type = 'diamond';
      else if (roll < 0.36) type = 'gold_heart';
      else if (roll < 0.78) type = 'rose';
      else type = 'cloud';
    }

    const spec = ITEM_TYPES[type];
    const vy = spec.speedMin + Math.random() * (spec.speedMax - spec.speedMin) + (isRush ? 35 : 0);
    const x = 68 + Math.random() * (LOGICAL_W - 136);

    this.items.push({
      id: this._nextItemId++,
      type,
      x,
      y: -26,
      r: spec.r,
      vy,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  _handleCatch(player, item) {
    const spec = ITEM_TYPES[item.type];
    if (item.type === 'cloud') {
      this.scores[player.side] = Math.max(0, this.scores[player.side] + spec.pts);
      player.stunTimer = STUN_DURATION;
      player.dashTimer = 0;
      player.streak = 0;
    } else {
      this.scores[player.side] += spec.pts;
      player.happyTimer = 0.45;
      player.streak += 1;
    }

    this._triggerPickupVisuals(player.side, item.type, item.x, item.y);

    if (this.mode === 'online-host') {
      this.sendNet({
        kind: 'pickup',
        side: player.side,
        type: item.type,
        x: Math.round(item.x),
        y: Math.round(item.y),
        sr: this.scores.red,
        sb: this.scores.blue,
      });
    }
  }

  _triggerPickupVisuals(side, type, x, y) {
    const spec = ITEM_TYPES[type] || ITEM_TYPES.rose;
    const pl = this.players[side];

    if (type === 'cloud') {
      pl.stunTimer = Math.max(pl.stunTimer, STUN_DURATION);
      this.sound?.playHit?.(false);
      this.shake = Math.max(this.shake, 7);
      this.popups.push({
        x,
        y: y - 10,
        text: '-2 ⚡ DIZZY!',
        color: '#d4a6ff',
        scale: 1.15,
        life: 0.95,
        maxLife: 0.95,
      });
      this._spawnBurst(x, y, '#a864ff', 14);
    } else {
      pl.happyTimer = 0.45;
      if (type === 'diamond') {
        this.sound?.playSuperReady?.();
        this.shake = Math.max(this.shake, 4);
      } else if (type === 'gold_heart') {
        this.sound?.playJump?.();
      } else {
        this.sound?.playBlock?.();
      }
      const emoji = type === 'diamond' ? '💎' : type === 'gold_heart' ? '💛' : '🌹';
      this.popups.push({
        x,
        y: y - 12,
        text: `${spec.label}! ${emoji}`,
        color: spec.color,
        scale: type === 'diamond' ? 1.35 : type === 'gold_heart' ? 1.15 : 1.0,
        life: 0.85,
        maxLife: 0.85,
      });
      this._spawnBurst(x, y, spec.color, type === 'diamond' ? 18 : 10);
    }
  }

  _spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 210;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 45,
        size: 2.5 + Math.random() * 3.5,
        color: i % 3 === 0 ? '#fff6d6' : color,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
      });
    }
  }

  _computeWinner() {
    if (this.scores.red > this.scores.blue) return 'red';
    if (this.scores.blue > this.scores.red) return 'blue';
    return 'draw';
  }

  _emitGameOver(winnerSide) {
    if (this._gameOverEmitted) return;
    this._gameOverEmitted = true;
    this.sound?.playVictory?.();
    const summary = `${this.redName} ${this.scores.red} pts - ${this.scores.blue} pts ${this.blueName}`;
    this.onGameOver(winnerSide, summary);
  }

  _updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 24);
    this._rushBannerTimer = Math.max(0, this._rushBannerTimer - dt);

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 62 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 280 * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const af = this.afterimages[i];
      af.life -= dt;
      if (af.life <= 0) this.afterimages.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this._drawMoonlitBackdrop(ctx);
    this._drawAfterimages(ctx);
    this._drawPlayer(ctx, this.players.red);
    this._drawPlayer(ctx, this.players.blue);
    this._drawItems(ctx);
    this._drawParticles(ctx);
    this._drawPopups(ctx);
    this._drawRushBanner(ctx);

    ctx.restore();
  }

  _drawMoonlitBackdrop(ctx) {
    const isRush = this.timeLeft <= 10;

    // Romantic midnight plum-indigo sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    skyGrad.addColorStop(0, isRush ? '#270b33' : '#110722');
    skyGrad.addColorStop(0.55, isRush ? '#381242' : '#210d35');
    skyGrad.addColorStop(1, '#2f143c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Twinkling stars
    for (const st of this._stars) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this._clock * st.speed + st.phase));
      ctx.fillStyle = `rgba(255, 245, 224, ${twinkle.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Luminous moon with soft champagne halo
    const moonX = 770;
    const moonY = 104;
    const halo = ctx.createRadialGradient(moonX, moonY, 18, moonX, moonY, 155);
    halo.addColorStop(0, 'rgba(255, 240, 195, 0.36)');
    halo.addColorStop(0.45, 'rgba(255, 195, 222, 0.12)');
    halo.addColorStop(1, 'rgba(255, 195, 222, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 155, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = '#fff3cf';
    ctx.shadowColor = '#ffd982';
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 36, 0, Math.PI * 2);
    ctx.fill();
    // Subtle moon craters
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(225, 196, 140, 0.28)';
    ctx.beginPath();
    ctx.arc(moonX - 10, moonY - 7, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 9, 6, 0, Math.PI * 2);
    ctx.arc(moonX + 6, moonY - 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Distant romantic Parisian silhouette & Eiffel glow
    ctx.save();
    ctx.fillStyle = 'rgba(20, 7, 32, 0.72)';
    // Subtle rooftop blocks
    const buildings = [
      [0, 350, 95, 120], [85, 325, 85, 145], [160, 360, 110, 110],
      [260, 338, 90, 132], [580, 345, 95, 125], [665, 322, 110, 148],
      [765, 350, 100, 120], [855, 332, 110, 138],
    ];
    for (const [bx, by, bw, bh] of buildings) {
      ctx.fillRect(bx, by, bw, bh);
    }

    // Eiffel Tower silhouette centered behind terrace
    const ex = 480;
    ctx.beginPath();
    ctx.moveTo(ex, 178);
    ctx.lineTo(ex + 9, 240);
    ctx.lineTo(ex + 22, 315);
    ctx.lineTo(ex + 54, 415);
    ctx.lineTo(ex + 26, 415);
    ctx.quadraticCurveTo(ex, 365, ex - 26, 415);
    ctx.lineTo(ex - 54, 415);
    ctx.lineTo(ex - 22, 315);
    ctx.lineTo(ex - 9, 240);
    ctx.closePath();
    ctx.fill();

    // Warm golden tower twinkle tip
    ctx.fillStyle = '#ffd982';
    ctx.shadowColor = '#ffd982';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(ex, 178, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floating warm fireflies / bokeh sparkles
    for (const ff of this._fireflies) {
      const x = (ff.x + this._clock * ff.speed) % LOGICAL_W;
      const y = ff.y + Math.sin(this._clock * 1.8 + ff.phase) * 14;
      const a = 0.22 + 0.38 * (0.5 + 0.5 * Math.sin(this._clock * 3 + ff.phase));
      ctx.fillStyle = `rgba(255, 217, 130, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead warm fairy lights garland
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 206, 158, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.quadraticCurveTo(LOGICAL_W * 0.25, 42, LOGICAL_W * 0.5, 20);
    ctx.quadraticCurveTo(LOGICAL_W * 0.75, 42, LOGICAL_W, 14);
    ctx.stroke();
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const lx = t * LOGICAL_W;
      const sag = Math.sin(t * Math.PI * 2) * 10 + 18;
      const ly = sag + Math.sin(t * Math.PI) * 8;
      const bulbColor = i % 2 === 0 ? '#ffd982' : '#ff85c4';
      ctx.fillStyle = bulbColor;
      ctx.shadowColor = bulbColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Stone balustrade railing behind terrace
    ctx.fillStyle = '#331742';
    ctx.fillRect(0, GROUND_Y - 56, LOGICAL_W, 8);
    ctx.fillStyle = '#261033';
    for (let x = 22; x < LOGICAL_W; x += 48) {
      ctx.fillRect(x, GROUND_Y - 48, 12, 48);
    }
    ctx.fillStyle = 'rgba(255, 217, 130, 0.22)';
    ctx.fillRect(0, GROUND_Y - 56, LOGICAL_W, 2);

    // Moonlit terrace floor
    const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, LOGICAL_H);
    floorGrad.addColorStop(0, '#3a1a49');
    floorGrad.addColorStop(0.35, '#250e31');
    floorGrad.addColorStop(1, '#14061d');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GROUND_Y, LOGICAL_W, LOGICAL_H - GROUND_Y);

    // Luminous terrace trim line
    ctx.fillStyle = isRush ? 'rgba(255, 133, 196, 0.65)' : 'rgba(255, 217, 130, 0.45)';
    ctx.fillRect(0, GROUND_Y, LOGICAL_W, 3);
  }

  _drawAfterimages(ctx) {
    for (const af of this.afterimages) {
      const a = Math.max(0, af.life / af.maxLife) * 0.42;
      const isRed = af.side === 'red';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = isRed ? '#ff5ca8' : '#589eff';
      ctx.shadowColor = isRed ? '#ff5ca8' : '#589eff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(af.x, GROUND_Y - 34, 22, 30, af.facing * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawPlayer(ctx, p) {
    const isRed = p.side === 'red';
    const isMine = this.mode !== 'local' && p.side === this.mySide;
    const accent = isRed ? '#ff5ca8' : '#589eff';
    const accentBright = isRed ? '#ff9ad0' : '#9cc8ff';
    const furMain = isRed ? '#e3a570' : '#6c4936';
    const furLight = isRed ? '#f8d2ae' : '#966d54';
    const earInner = isRed ? '#ffa8cf' : '#c98e7c';

    const running = Math.abs(p.vx) > 25 && p.stunTimer <= 0;
    const bounce = running ? Math.abs(Math.sin(p.runPhase)) * 7 : Math.sin(this._clock * 3.5 + (isRed ? 0 : 1.5)) * 2;
    const lean = p.stunTimer > 0
      ? Math.sin(this._clock * 28) * 0.16
      : clamp(p.vx / 1100, -0.22, 0.22);

    ctx.save();
    ctx.translate(p.x, GROUND_Y - bounce);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, bounce + 2, 28 - bounce * 0.6, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing catching aura ring around bunny
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = p.dashTimer > 0 ? 0.65 : 0.24;
    ctx.lineWidth = p.dashTimer > 0 ? 3 : 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, -34, 34, 38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(lean);

    // Little feet hopping
    const stride = running ? Math.sin(p.runPhase) * 9 : 0;
    ctx.fillStyle = isRed ? '#b62067' : '#254ea8';
    ctx.beginPath();
    ctx.ellipse(-10 + stride, -5, 9, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(10 - stride, -5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bunny body / outfit
    ctx.fillStyle = isRed ? '#d92878' : '#22479b';
    ctx.beginPath();
    ctx.ellipse(0, -24, 18, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd982';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Ears (bouncy!)
    const earSwing = Math.sin(p.runPhase * 0.9) * 0.14;
    if (isRed) {
      // Wifebun silky swept ears with rose ribbon scrunchie
      ctx.save();
      ctx.translate(-9, -62);
      ctx.rotate(-0.32 + earSwing);
      ctx.fillStyle = furMain;
      ctx.beginPath();
      ctx.ellipse(0, -14, 7, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(0, -13, 3.6, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(9, -62);
      ctx.rotate(0.32 - earSwing);
      ctx.fillStyle = furMain;
      ctx.beginPath();
      ctx.ellipse(0, -14, 7, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(0, -13, 3.6, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pink hair bow
      ctx.fillStyle = '#ff5ca8';
      ctx.beginPath();
      ctx.arc(0, -64, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd982';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // Husbun tall upright ears (one playful bent tip)
      ctx.save();
      ctx.translate(-8, -64);
      ctx.rotate(-0.12 + earSwing);
      ctx.fillStyle = furMain;
      ctx.beginPath();
      ctx.ellipse(0, -17, 6.2, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(0, -16, 3.2, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(8, -64);
      ctx.rotate(0.16 - earSwing);
      ctx.fillStyle = furMain;
      ctx.beginPath();
      ctx.ellipse(0, -15, 6.2, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(0, -14, 3.2, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bunny head
    ctx.fillStyle = furMain;
    ctx.beginPath();
    ctx.arc(0, -49, 19, 0, Math.PI * 2);
    ctx.fill();

    // Cute lighter muzzle cheeks
    ctx.fillStyle = furLight;
    ctx.beginPath();
    ctx.ellipse(0, -43, 12, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Husbun navy-gold headband
    if (!isRed) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-17, -61, 34, 5.5);
      ctx.fillStyle = '#ffd982';
      ctx.fillRect(-17, -57, 34, 1.5);
    }

    // Expressive eyes!
    const eyeShift = p.facing * 2.5;
    if (p.stunTimer > 0) {
      // Dizzy X / swirl eyes
      ctx.strokeStyle = '#1b0924';
      ctx.lineWidth = 2.2;
      for (const ex of [-6.5 + eyeShift, 6.5 + eyeShift]) {
        ctx.beginPath();
        ctx.moveTo(ex - 3.5, -53);
        ctx.lineTo(ex + 3.5, -47);
        ctx.moveTo(ex + 3.5, -53);
        ctx.lineTo(ex - 3.5, -47);
        ctx.stroke();
      }
    } else if (p.happyTimer > 0) {
      // Joyful smiling arc eyes ^ ^
      ctx.strokeStyle = '#1b0924';
      ctx.lineWidth = 2.3;
      for (const ex of [-6.5 + eyeShift, 6.5 + eyeShift]) {
        ctx.beginPath();
        ctx.arc(ex, -49, 4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else {
      // Gleaming anime bunny eyes
      for (const ex of [-6.5 + eyeShift, 6.5 + eyeShift]) {
        ctx.fillStyle = '#190822';
        ctx.beginPath();
        ctx.ellipse(ex, -51, 3.2, 4.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 1, -52.8, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pink nose & blush
    ctx.fillStyle = '#ff7eb9';
    ctx.beginPath();
    ctx.ellipse(eyeShift, -44.5, 3, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 110, 175, 0.36)';
    ctx.beginPath();
    ctx.ellipse(-11, -44, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11, -44, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing velvet catching basket held up front!
    ctx.save();
    ctx.translate(p.facing * 4, -27);
    ctx.fillStyle = isRed ? '#ff5ca8' : '#589eff';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(22, -4);
    ctx.lineTo(16, 12);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd982';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Tiny emblem on basket
    drawHeartPath(ctx, 0, 3.5, 5.5);
    ctx.fillStyle = '#fff3c9';
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end lean

    // Spinning dizzy stars overhead when stunned
    if (p.stunTimer > 0) {
      for (let i = 0; i < 3; i++) {
        const ang = this._clock * 8 + (i * Math.PI * 2) / 3;
        const sx = Math.cos(ang) * 20;
        const sy = -88 + Math.sin(ang) * 6;
        ctx.fillStyle = '#ffd982';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mini dash-ready cooldown bar right under feet
    const readyRatio = clamp(1 - p.dashCooldown / DASH_COOLDOWN, 0, 1);
    const barW = 40;
    ctx.fillStyle = 'rgba(18, 6, 26, 0.72)';
    ctx.fillRect(-barW / 2, bounce + 8, barW, 4);
    ctx.fillStyle = readyRatio >= 0.99 ? '#ffd982' : accentBright;
    ctx.fillRect(-barW / 2, bounce + 8, barW * readyRatio, 4);

    // Nameplate & YOU marker above head
    if (isMine || this.mode === 'local') {
      const label = isMine ? '▼ YOU' : (isRed ? 'P1' : 'P2');
      ctx.font = "700 11px 'Chakra Petch', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = isMine ? '#ffd982' : accentBright;
      ctx.fillText(label, 0, -96);
    }

    ctx.restore();
  }

  _drawItems(ctx) {
    for (const it of this.items) {
      const x = it.x + Math.sin(it.wobble) * (it.type === 'cloud' ? 5 : 3);
      const y = it.y;

      ctx.save();
      ctx.translate(x, y);

      if (it.type === 'rose') {
        ctx.rotate(Math.sin(it.wobble) * 0.16);
        ctx.shadowColor = '#ff5ca8';
        ctx.shadowBlur = 14;
        // Emerald leaves
        ctx.fillStyle = '#3ed99a';
        ctx.beginPath();
        ctx.ellipse(-9, 9, 7, 3.5, -0.5, 0, Math.PI * 2);
        ctx.ellipse(9, 9, 7, 3.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Lush layered pink rose petals
        ctx.fillStyle = '#ff4b9b';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff87c2';
        ctx.beginPath();
        ctx.arc(-3, -2, 8.5, 0, Math.PI * 2);
        ctx.arc(4, 1, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd1e8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -1, 5, 0.2, Math.PI * 1.7);
        ctx.stroke();
      } else if (it.type === 'gold_heart') {
        const pulse = 1 + Math.sin(it.wobble * 2) * 0.08;
        ctx.scale(pulse, pulse);
        ctx.shadowColor = '#ffbe45';
        ctx.shadowBlur = 18;
        const g = ctx.createLinearGradient(-14, -14, 14, 16);
        g.addColorStop(0, '#fff7cf');
        g.addColorStop(0.45, '#ffd982');
        g.addColorStop(1, '#d9871e');
        drawHeartPath(ctx, 0, 0, 20);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#fff9e6';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (it.type === 'diamond') {
        ctx.rotate(Math.sin(it.wobble * 1.5) * 0.22);
        ctx.shadowColor = '#4ce4ff';
        ctx.shadowBlur = 22;
        // Sparkling outer starburst rays
        ctx.strokeStyle = 'rgba(255, 245, 195, 0.75)';
        ctx.lineWidth = 1.8;
        for (let k = 0; k < 4; k++) {
          const a = this._clock * 2.5 + (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23);
          ctx.stroke();
        }
        // Faceted diamond crystal
        const dg = ctx.createLinearGradient(0, -18, 0, 18);
        dg.addColorStop(0, '#ffffff');
        dg.addColorStop(0.4, '#8ffaff');
        dg.addColorStop(1, '#3b9eff');
        ctx.beginPath();
        ctx.moveTo(0, -17);
        ctx.lineTo(15, -3);
        ctx.lineTo(0, 18);
        ctx.lineTo(-15, -3);
        ctx.closePath();
        ctx.fillStyle = dg;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // Inner facet line
        ctx.beginPath();
        ctx.moveTo(-14, -3);
        ctx.lineTo(14, -3);
        ctx.moveTo(0, -17);
        ctx.lineTo(-5, -3);
        ctx.lineTo(0, 18);
        ctx.moveTo(0, -17);
        ctx.lineTo(5, -3);
        ctx.lineTo(0, 18);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else if (it.type === 'cloud') {
        // Mischievous grumpy purple raincloud!
        ctx.shadowColor = '#8e44ff';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#5a2b8a';
        ctx.beginPath();
        ctx.arc(-11, 2, 11, 0, Math.PI * 2);
        ctx.arc(0, -5, 14, 0, Math.PI * 2);
        ctx.arc(12, 2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c59cff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Mischievous furrowed eyes
        ctx.strokeStyle = '#ffe58f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-2, 0);
        ctx.moveTo(8, -3);
        ctx.lineTo(2, 0);
        ctx.stroke();

        // Tiny golden-purple lightning bolt underneath
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.moveTo(2, 10);
        ctx.lineTo(-4, 18);
        ctx.lineTo(1, 18);
        ctx.lineTo(-2, 26);
        ctx.lineTo(6, 16);
        ctx.lineTo(1, 16);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawParticles(ctx) {
    for (const pt of this.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawPopups(ctx) {
    for (const pop of this.popups) {
      const a = Math.max(0, Math.min(1, pop.life / 0.35));
      const bounceScale = pop.scale * (1 + (1 - pop.life / pop.maxLife) * 0.12);
      ctx.save();
      ctx.translate(pop.x, pop.y);
      ctx.scale(bounceScale, bounceScale);
      ctx.globalAlpha = a;
      ctx.font = "700 24px 'Bangers', Impact, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(18, 6, 26, 0.9)';
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }
  }

  _drawRushBanner(ctx) {
    if (this._rushBannerTimer <= 0) return;
    const a = Math.min(1, this._rushBannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = "700 40px 'Bangers', Impact, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff5ca8';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(20, 6, 28, 0.9)';
    ctx.strokeText('✨ FINAL 10s LOVE RUSH! ✨', LOGICAL_W / 2, 118);
    ctx.fillStyle = '#ffd982';
    ctx.fillText('✨ FINAL 10s LOVE RUSH! ✨', LOGICAL_W / 2, 118);
    ctx.restore();
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
