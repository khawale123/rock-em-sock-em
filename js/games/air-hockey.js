// 🏓 Neon Rose-Gold Air Hockey 1v1 — Wifebun ♥ Husbun Date Night Arcade
// Self-contained real-time Canvas minigame adhering to the shared MiniGame interface contract.

const LOGICAL_W = 960;
const LOGICAL_H = 540;

const RINK_L = 36;
const RINK_R = LOGICAL_W - 36; // 924
const RINK_T = 26;
const RINK_B = LOGICAL_H - 26; // 514
const MID_X = LOGICAL_W / 2;   // 480
const MID_Y = LOGICAL_H / 2;   // 270
const CORNER_R = 46;

const GOAL_HALF_H = 96;
const GOAL_T = MID_Y - GOAL_HALF_H; // 174
const GOAL_B = MID_Y + GOAL_HALF_H; // 366
const POST_R = 8;

const STRIKER_R = 35;
const PUCK_R = 19;
const MAX_PUCK_SPEED = 1080;
const MAX_STRIKER_SPEED = 860;
const WIN_SCORE = 5;

const STATE_SYNC_INTERVAL = 1 / 30;
const PADDLE_SYNC_INTERVAL = 1 / 30;

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

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class AirHockeyGame {
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
    this._hitSeq = 0;
    this._lastSeenHitSeq = 0;
    this._lastHitEvent = null;
    this._gameOverEmitted = false;

    this.canvas = null;
    this.ctx = null;
    this.dpr = 1;
    this._hud = {};

    this.keys = new Set();
    this._pointers = new Map(); // pointerId -> { side, x, y }

    // Bound listeners for clean removal
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
    this.scores = { red: 0, blue: 0 };
    this.phase = 'serve'; // 'serve' | 'play' | 'goal' | 'over'
    this.phaseTimer = 0.72;
    this.lastScorer = null;
    this.serveTo = 'center'; // 'center' | 'red' | 'blue'
    this.bannerText = 'GET READY!';
    this.bannerColor = '#ffd982';
    this._gameOverEmitted = false;

    this.puck = {
      x: MID_X,
      y: MID_Y,
      vx: 0,
      vy: 0,
      lastHitBy: null, // 'red' | 'blue' | null
      spin: 0,
      trail: [],
    };

    // Network interpolation targets (for guest)
    this._netTarget = {
      px: MID_X,
      py: MID_Y,
      pvx: 0,
      pvy: 0,
      bx: RINK_R - 120,
      by: MID_Y,
      rx: RINK_L + 120,
      ry: MID_Y,
      hasState: false,
    };

    this.strikers = {
      red: {
        x: RINK_L + 120,
        y: MID_Y,
        vx: 0,
        vy: 0,
        tx: RINK_L + 120,
        ty: MID_Y,
        hasTarget: false,
        pulse: 0,
      },
      blue: {
        x: RINK_R - 120,
        y: MID_Y,
        vx: 0,
        vy: 0,
        tx: RINK_R - 120,
        ty: MID_Y,
        hasTarget: false,
        pulse: 0,
      },
    };

    // Guest target sent to host
    this._guestTarget = { x: RINK_L + 120, y: MID_Y };

    // VFX
    this.sparks = [];
    this.rings = [];
    this.confetti = [];
    this.shake = 0;
    this.goalFlash = 0;
    this.goalFlashColor = '#ffd982';

    // AI personality wobble
    this._aiBiasY = 0;
    this._aiBiasTimer = 0;
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
    this._pointers.clear();
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

    this.keys.clear();
    this._pointers.clear();

    if (this.container) {
      this.container.innerHTML = '';
    }
    this.canvas = null;
    this.ctx = null;
  }

  handleNet(payload) {
    if (this._destroyed || !payload || typeof payload !== 'object') return;

    if (this.mode === 'online-host') {
      if (payload.kind === 'paddle') {
        const guestSide = this.mySide === 'blue' ? 'red' : 'blue';
        const clamped = this._clampStrikerPos(guestSide, Number(payload.x) || MID_X, Number(payload.y) || MID_Y);
        this.strikers[guestSide].tx = clamped.x;
        this.strikers[guestSide].ty = clamped.y;
        this.strikers[guestSide].hasTarget = true;
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

      if (payload.kind === 'goal') {
        const scorer = payload.scorer === 'red' ? 'red' : 'blue';
        this.scores.red = Number(payload.sr) || 0;
        this.scores.blue = Number(payload.sb) || 0;
        this._updateHUD();
        this._triggerGoalEffects(scorer, Boolean(payload.winner));
        if (payload.winner && !this._gameOverEmitted) {
          this.phase = 'over';
          this._emitGameOver(payload.winner);
        }
        return;
      }

      if (payload.kind === 'state') {
        this._netTarget.px = Number(payload.px);
        this._netTarget.py = Number(payload.py);
        this._netTarget.pvx = Number(payload.pvx) || 0;
        this._netTarget.pvy = Number(payload.pvy) || 0;
        this._netTarget.rx = Number(payload.rx);
        this._netTarget.ry = Number(payload.ry);
        this._netTarget.bx = Number(payload.bx);
        this._netTarget.by = Number(payload.by);
        this._netTarget.hasState = true;

        if (typeof payload.lh === 'string' || payload.lh === null) {
          this.puck.lastHitBy = payload.lh;
        }

        const sr = Number(payload.sr);
        const sb = Number(payload.sb);
        if (!Number.isNaN(sr) && !Number.isNaN(sb) && (sr !== this.scores.red || sb !== this.scores.blue)) {
          this.scores.red = sr;
          this.scores.blue = sb;
          this._updateHUD();
        }

        if (payload.phase && this.phase !== 'over') {
          this.phase = payload.phase;
          this.phaseTimer = Number(payload.pt) || 0;
        }

        if (payload.hSeq && payload.hSeq > this._lastSeenHitSeq) {
          this._lastSeenHitSeq = payload.hSeq;
          const heavy = Boolean(payload.hHvy);
          const hx = Number(payload.hx) || this.puck.x;
          const hy = Number(payload.hy) || this.puck.y;
          const hColor = payload.hCol || '#ffd982';
          this._spawnHitBurst(hx, hy, hColor, heavy ? 16 : 9, heavy);
          if (payload.hWall) {
            this.sound?.playBlock?.();
          } else {
            this.sound?.playHit?.(heavy);
          }
          this.shake = Math.max(this.shake, heavy ? 7 : 3);
        }

        if (payload.winner && !this._gameOverEmitted) {
          this.phase = 'over';
          this._emitGameOver(payload.winner);
        }
      }
    }
  }

  _renderDOM() {
    const redLabel = this._escapeHtml(this.redName);
    const blueLabel = this._escapeHtml(this.blueName);
    const redYou = this.mode !== 'local' && this.mySide === 'red' ? '<span class="ah-you-tag">YOU</span>' : '';
    const blueYou = this.mode !== 'local' && this.mySide === 'blue' ? '<span class="ah-you-tag">YOU</span>' : '';

    let hintText = 'Drag on the rink or use WASD / Arrows to strike · First to 5 goals wins!';
    if (this.mode === 'local') {
      hintText = `${redLabel}: W/A/S/D or Left Touch · ${blueLabel}: Arrows or Right Touch · First to 5!`;
    } else if (this.mode === 'online-host' || this.mode === 'online-guest') {
      const sideWord = this.mySide === 'red' ? 'Left (Pink)' : 'Right (Blue)';
      hintText = `You play ${sideWord} · Drag mouse/finger or use WASD / Arrows · First to 5!`;
    }

    this.container.innerHTML = `
      <style>
        .ah-wrap {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          user-select: none;
          -webkit-user-select: none;
          font-family: var(--font-arcade, 'Chakra Petch', system-ui, sans-serif);
        }
        .ah-hud {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: linear-gradient(135deg, rgba(44, 14, 52, 0.92), rgba(24, 8, 32, 0.94));
          border: 1px solid rgba(255, 206, 158, 0.28);
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(8, 2, 12, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .ah-player {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .ah-player.blue {
          justify-content: flex-end;
          text-align: right;
        }
        .ah-name-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .ah-player.blue .ah-name-col {
          align-items: flex-end;
        }
        .ah-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: clamp(0.8rem, 1.8vw, 0.98rem);
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .ah-player.red .ah-name-row { color: #ff85c4; }
        .ah-player.blue .ah-name-row { color: #8cc2ff; }
        .ah-you-tag {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd982, #f4b7c7);
          color: #210726;
          letter-spacing: 0.06em;
        }
        .ah-pips {
          display: flex;
          gap: 5px;
        }
        .ah-pip {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.24);
          background: rgba(255, 255, 255, 0.06);
          transition: transform 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
        }
        .ah-player.red .ah-pip.filled {
          background: #ff5ca8;
          border-color: #ffd982;
          box-shadow: 0 0 10px rgba(255, 92, 168, 0.85);
          transform: scale(1.12);
        }
        .ah-player.blue .ah-pip.filled {
          background: #589eff;
          border-color: #ffd982;
          box-shadow: 0 0 10px rgba(88, 158, 255, 0.85);
          transform: scale(1.12);
        }
        .ah-score-num {
          font-family: var(--font-display, 'Bangers', Impact, sans-serif);
          font-size: clamp(1.6rem, 3.2vw, 2.2rem);
          line-height: 1;
          min-width: 28px;
          text-align: center;
        }
        .ah-player.red .ah-score-num {
          color: #ff85c4;
          text-shadow: 0 0 14px rgba(255, 92, 168, 0.7);
        }
        .ah-player.blue .ah-score-num {
          color: #8cc2ff;
          text-shadow: 0 0 14px rgba(88, 158, 255, 0.7);
        }
        .ah-center-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 4px 12px;
          border-radius: 10px;
          background: rgba(255, 217, 130, 0.09);
          border: 1px solid rgba(255, 217, 130, 0.26);
        }
        .ah-center-title {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #ffd982;
          text-transform: uppercase;
        }
        .ah-center-sub {
          font-size: 0.64rem;
          color: rgba(255, 240, 248, 0.75);
        }
        .ah-stage {
          width: 100%;
          max-width: min(100%, calc(min(60vh, 505px) * 16 / 9));
          aspect-ratio: 16 / 9;
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          border: 1.5px solid rgba(255, 206, 158, 0.34);
          box-shadow:
            0 14px 40px rgba(6, 2, 12, 0.68),
            0 0 28px rgba(255, 92, 168, 0.18),
            0 0 28px rgba(88, 158, 255, 0.16);
          background: #14061a;
        }
        .ah-canvas {
          display: block;
          width: 100%;
          height: 100%;
          touch-action: none;
          cursor: none;
        }
        .ah-hint {
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
          font-size: clamp(0.72rem, 1.5vw, 0.82rem);
          color: #d7b7cf;
          text-align: center;
          padding: 4px 12px;
          background: rgba(34, 12, 42, 0.68);
          border: 1px solid rgba(255, 194, 222, 0.16);
          border-radius: 999px;
        }
      </style>
      <div class="ah-wrap">
        <div class="ah-hud">
          <div class="ah-player red">
            <div class="ah-name-col">
              <div class="ah-name-row"><span>🎀 ${redLabel}</span>${redYou}</div>
              <div class="ah-pips" data-ah-pips="red">
                ${'<span class="ah-pip"></span>'.repeat(WIN_SCORE)}
              </div>
            </div>
            <div class="ah-score-num" data-ah-score="red">0</div>
          </div>
          <div class="ah-center-badge">
            <span class="ah-center-title">🏓 Air Hockey</span>
            <span class="ah-center-sub">First to ${WIN_SCORE}</span>
          </div>
          <div class="ah-player blue">
            <div class="ah-score-num" data-ah-score="blue">0</div>
            <div class="ah-name-col">
              <div class="ah-name-row">${blueYou}<span>${blueLabel} 💪</span></div>
              <div class="ah-pips" data-ah-pips="blue">
                ${'<span class="ah-pip"></span>'.repeat(WIN_SCORE)}
              </div>
            </div>
          </div>
        </div>
        <div class="ah-stage">
          <canvas class="ah-canvas"></canvas>
        </div>
        <div class="ah-hint">${hintText}</div>
      </div>
    `;

    this.canvas = this.container.querySelector('.ah-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._hud = {
      redScore: this.container.querySelector('[data-ah-score="red"]'),
      blueScore: this.container.querySelector('[data-ah-score="blue"]'),
      redPips: Array.from(this.container.querySelectorAll('[data-ah-pips="red"] .ah-pip')),
      bluePips: Array.from(this.container.querySelectorAll('[data-ah-pips="blue"] .ah-pip')),
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
  }

  _handleResize() {
    this._setupCanvas();
  }

  _handleBlur() {
    this.keys.clear();
    this._pointers.clear();
  }

  _handleKeyDown(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const code = e.code;
    if (
      code === 'ArrowUp' || code === 'ArrowDown' ||
      code === 'ArrowLeft' || code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }
    this.keys.add(code);
  }

  _handleKeyUp(e) {
    this.keys.delete(e.code);
  }

  _canvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: MID_X, y: MID_Y };
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    };
  }

  _handlePointerDown(e) {
    if (!this.canvas) return;
    this.sound?.init?.();
    const pt = this._canvasPoint(e);
    let side = this.mySide;
    if (this.mode === 'local') {
      side = pt.x < MID_X ? 'red' : 'blue';
    }
    this._pointers.set(e.pointerId, { side, x: pt.x, y: pt.y });
    this._applyPointerTarget(side, pt.x, pt.y);
  }

  _handlePointerMove(e) {
    if (!this.canvas) return;
    const pt = this._canvasPoint(e);

    if (this._pointers.has(e.pointerId)) {
      const entry = this._pointers.get(e.pointerId);
      entry.x = pt.x;
      entry.y = pt.y;
      this._applyPointerTarget(entry.side, pt.x, pt.y);
      return;
    }

    // Smooth hover tracking for desktop mouse (no click-hold required in solo/online!)
    if (e.pointerType === 'mouse' && this.mode !== 'local') {
      this._applyPointerTarget(this.mySide, pt.x, pt.y);
    }
  }

  _handlePointerUp(e) {
    this._pointers.delete(e.pointerId);
  }

  _applyPointerTarget(side, rawX, rawY) {
    const clamped = this._clampStrikerPos(side, rawX, rawY);
    const s = this.strikers[side];
    s.tx = clamped.x;
    s.ty = clamped.y;
    s.hasTarget = true;

    if (this.mode === 'online-guest' && side === this.mySide) {
      this._guestTarget.x = clamped.x;
      this._guestTarget.y = clamped.y;
    }
  }

  _clampStrikerPos(side, x, y) {
    const pad = STRIKER_R + 4;
    const minY = RINK_T + pad;
    const maxY = RINK_B - pad;
    if (side === 'red') {
      return {
        x: clamp(x, RINK_L + pad, MID_X - STRIKER_R - 2),
        y: clamp(y, minY, maxY),
      };
    }
    return {
      x: clamp(x, MID_X + STRIKER_R + 2, RINK_R - pad),
      y: clamp(y, minY, maxY),
    };
  }

  _updateHUD() {
    if (!this._hud.redScore) return;
    this._hud.redScore.textContent = String(this.scores.red);
    this._hud.blueScore.textContent = String(this.scores.blue);
    this._hud.redPips.forEach((pip, idx) => {
      pip.classList.toggle('filled', idx < this.scores.red);
    });
    this._hud.bluePips.forEach((pip, idx) => {
      pip.classList.toggle('filled', idx < this.scores.blue);
    });
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

  _readKeyboardVector(side) {
    let dx = 0;
    let dy = 0;
    const useWASD = this.mode === 'local' ? side === 'red' : side === this.mySide;
    const useArrows = this.mode === 'local' ? side === 'blue' : side === this.mySide;

    if (useWASD) {
      if (this.keys.has('KeyA')) dx -= 1;
      if (this.keys.has('KeyD')) dx += 1;
      if (this.keys.has('KeyW')) dy -= 1;
      if (this.keys.has('KeyS')) dy += 1;
    }
    if (useArrows) {
      if (this.keys.has('ArrowLeft')) dx -= 1;
      if (this.keys.has('ArrowRight')) dx += 1;
      if (this.keys.has('ArrowUp')) dy -= 1;
      if (this.keys.has('ArrowDown')) dy += 1;
    }

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    return { dx, dy };
  }

  _moveStrikerControlled(side, dt, maxSpeed = MAX_STRIKER_SPEED) {
    const s = this.strikers[side];
    const prevX = s.x;
    const prevY = s.y;

    const kb = this._readKeyboardVector(side);
    if (kb.dx !== 0 || kb.dy !== 0) {
      const kbSpeed = 590;
      const next = this._clampStrikerPos(side, s.x + kb.dx * kbSpeed * dt, s.y + kb.dy * kbSpeed * dt);
      s.x = next.x;
      s.y = next.y;
      s.tx = s.x;
      s.ty = s.y;
      s.hasTarget = false;
    } else if (s.hasTarget) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const follow = 1 - Math.exp(-26 * dt);
        let step = dist * follow;
        const cap = maxSpeed * dt;
        if (step > cap) step = cap;
        const next = this._clampStrikerPos(side, s.x + (dx / dist) * step, s.y + (dy / dist) * step);
        s.x = next.x;
        s.y = next.y;
      }
    }

    if (dt > 0.0001) {
      s.vx = clamp((s.x - prevX) / dt, -maxSpeed, maxSpeed);
      s.vy = clamp((s.y - prevY) / dt, -maxSpeed, maxSpeed);
    }
  }

  _moveStrikerAI(side, dt) {
    const s = this.strikers[side];
    const p = this.puck;
    const prevX = s.x;
    const prevY = s.y;

    this._aiBiasTimer -= dt;
    if (this._aiBiasTimer <= 0) {
      this._aiBiasTimer = 0.7 + Math.random() * 0.9;
      this._aiBiasY = (Math.random() - 0.5) * 44;
    }

    const isRight = side === 'blue';
    const homeX = isRight ? RINK_R - 115 : RINK_L + 115;
    const puckOnMySide = isRight ? p.x > MID_X - 18 : p.x < MID_X + 18;
    const puckMovingToMe = isRight ? p.vx > 20 : p.vx < -20;

    let targetX = homeX;
    let targetY = MID_Y + this._aiBiasY * 0.45;
    let speed = 440;

    if (this.phase === 'play') {
      if (puckOnMySide) {
        const puckBehindMe = isRight ? p.x > s.x + 12 : p.x < s.x - 12;
        if (puckBehindMe) {
          // Loop around cleanly instead of smacking it into our own goal
          targetX = isRight ? Math.min(RINK_R - STRIKER_R - 12, p.x + 48) : Math.max(RINK_L + STRIKER_R + 12, p.x - 48);
          targetY = p.y < MID_Y ? p.y + 62 : p.y - 62;
          speed = 460;
        } else {
          // Strike puck toward opponent's goal with slight angle variety
          targetX = p.x + (isRight ? -8 : 8);
          targetY = p.y + this._aiBiasY * 0.25;
          speed = 490;
        }
      } else if (puckMovingToMe) {
        // Intercept predicted trajectory at defensive line
        const timeToLine = Math.abs((homeX - p.x) / (Math.abs(p.vx) + 1));
        const predY = clamp(p.y + p.vy * Math.min(timeToLine, 0.45), GOAL_T - 20, GOAL_B + 20);
        targetX = homeX;
        targetY = predY;
        speed = 430;
      } else {
        targetX = homeX;
        targetY = lerp(MID_Y, p.y, 0.45);
        speed = 340;
      }
    }

    const clamped = this._clampStrikerPos(side, targetX, targetY);
    const dx = clamped.x - s.x;
    const dy = clamped.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, speed * dt);
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
    }

    if (dt > 0.0001) {
      s.vx = (s.x - prevX) / dt;
      s.vy = (s.y - prevY) / dt;
    }
  }

  _updateAuthoritative(dt) {
    // Move strikers
    if (this.mode === 'cpu') {
      const aiSide = this.mySide === 'red' ? 'blue' : 'red';
      this._moveStrikerControlled(this.mySide, dt);
      this._moveStrikerAI(aiSide, dt);
    } else if (this.mode === 'local') {
      this._moveStrikerControlled('red', dt);
      this._moveStrikerControlled('blue', dt);
    } else if (this.mode === 'online-host') {
      const guestSide = this.mySide === 'blue' ? 'red' : 'blue';
      this._moveStrikerControlled(this.mySide, dt);
      // Smoothly move guest striker toward latest received network target
      const gs = this.strikers[guestSide];
      const prevX = gs.x;
      const prevY = gs.y;
      if (gs.hasTarget) {
        const follow = 1 - Math.exp(-32 * dt);
        const next = this._clampStrikerPos(
          guestSide,
          lerp(gs.x, gs.tx, follow),
          lerp(gs.y, gs.ty, follow)
        );
        gs.x = next.x;
        gs.y = next.y;
      }
      if (dt > 0.0001) {
        gs.vx = clamp((gs.x - prevX) / dt, -MAX_STRIKER_SPEED, MAX_STRIKER_SPEED);
        gs.vy = clamp((gs.y - prevY) / dt, -MAX_STRIKER_SPEED, MAX_STRIKER_SPEED);
      }
    }

    // Phase state machine
    if (this.phase === 'serve') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'play';
        this._launchPuck(this.serveTo);
      }
    } else if (this.phase === 'goal') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.scores.red >= WIN_SCORE || this.scores.blue >= WIN_SCORE) {
          this.phase = 'over';
          const winner = this.scores.red >= WIN_SCORE ? 'red' : 'blue';
          this._emitGameOver(winner);
        } else {
          this._resetPositionsForServe(this.lastScorer === 'red' ? 'blue' : 'red');
        }
      }
    } else if (this.phase === 'play') {
      this._stepPuckPhysics(dt);
    }

    // Broadcast host state at ~30Hz
    if (this.mode === 'online-host') {
      this._syncAccum += dt;
      if (this._syncAccum >= STATE_SYNC_INTERVAL) {
        this._syncAccum = 0;
        this._broadcastHostState();
      }
    }
  }

  _updateGuest(dt) {
    // Move local striker immediately for zero-lag feel
    this._moveStrikerControlled(this.mySide, dt);
    const localStriker = this.strikers[this.mySide];
    this._guestTarget.x = localStriker.x;
    this._guestTarget.y = localStriker.y;

    // Send local paddle target at ~30Hz
    this._syncAccum += dt;
    if (this._syncAccum >= PADDLE_SYNC_INTERVAL) {
      this._syncAccum = 0;
      this.sendNet({
        kind: 'paddle',
        x: Math.round(this._guestTarget.x * 10) / 10,
        y: Math.round(this._guestTarget.y * 10) / 10,
      });
    }

    // Smoothly interpolate puck & remote striker
    if (this._netTarget.hasState) {
      const remoteSide = this.mySide === 'red' ? 'blue' : 'red';
      const rs = this.strikers[remoteSide];
      const targetRX = remoteSide === 'blue' ? this._netTarget.bx : this._netTarget.rx;
      const targetRY = remoteSide === 'blue' ? this._netTarget.by : this._netTarget.ry;
      const alphaStriker = 1 - Math.exp(-24 * dt);
      rs.x = lerp(rs.x, targetRX, alphaStriker);
      rs.y = lerp(rs.y, targetRY, alphaStriker);

      // Extrapolate puck slightly then blend smoothly toward host snapshot
      const p = this.puck;
      const jumpDist = Math.hypot(this._netTarget.px - p.x, this._netTarget.py - p.y);
      if (jumpDist > 180) {
        // Goal reset teleport — snap cleanly
        p.x = this._netTarget.px;
        p.y = this._netTarget.py;
        p.trail.length = 0;
      } else {
        p.x += this._netTarget.pvx * dt * 0.55;
        p.y += this._netTarget.pvy * dt * 0.55;
        const alphaPuck = 1 - Math.exp(-28 * dt);
        p.x = lerp(p.x, this._netTarget.px, alphaPuck);
        p.y = lerp(p.y, this._netTarget.py, alphaPuck);
      }
      p.vx = this._netTarget.pvx;
      p.vy = this._netTarget.pvy;

      if (this.phase === 'play') {
        this._pushPuckTrail();
      }
    }
  }

  _broadcastHostState() {
    const p = this.puck;
    const r = this.strikers.red;
    const b = this.strikers.blue;
    const payload = {
      kind: 'state',
      px: Math.round(p.x * 10) / 10,
      py: Math.round(p.y * 10) / 10,
      pvx: Math.round(p.vx),
      pvy: Math.round(p.vy),
      rx: Math.round(r.x * 10) / 10,
      ry: Math.round(r.y * 10) / 10,
      bx: Math.round(b.x * 10) / 10,
      by: Math.round(b.y * 10) / 10,
      sr: this.scores.red,
      sb: this.scores.blue,
      phase: this.phase,
      pt: Math.round(this.phaseTimer * 100) / 100,
      lh: p.lastHitBy,
    };

    if (this._lastHitEvent) {
      payload.hSeq = this._lastHitEvent.seq;
      payload.hx = Math.round(this._lastHitEvent.x);
      payload.hy = Math.round(this._lastHitEvent.y);
      payload.hHvy = this._lastHitEvent.heavy ? 1 : 0;
      payload.hWall = this._lastHitEvent.wall ? 1 : 0;
      payload.hCol = this._lastHitEvent.color;
    }

    if (this.phase === 'over') {
      payload.winner = this.scores.red >= WIN_SCORE ? 'red' : 'blue';
    }

    this.sendNet(payload);
  }

  _resetPositionsForServe(serveTo) {
    this.phase = 'serve';
    this.phaseTimer = 0.68;
    this.serveTo = serveTo;
    this.bannerText = 'SERVE!';
    this.bannerColor = '#ffd982';

    this.puck.x = serveTo === 'red' ? MID_X - 58 : serveTo === 'blue' ? MID_X + 58 : MID_X;
    this.puck.y = MID_Y;
    this.puck.vx = 0;
    this.puck.vy = 0;
    this.puck.lastHitBy = null;
    this.puck.trail.length = 0;

    this.strikers.red.x = RINK_L + 115;
    this.strikers.red.y = MID_Y;
    this.strikers.red.vx = 0;
    this.strikers.red.vy = 0;

    this.strikers.blue.x = RINK_R - 115;
    this.strikers.blue.y = MID_Y;
    this.strikers.blue.vx = 0;
    this.strikers.blue.vy = 0;
  }

  _launchPuck(serveTo) {
    const angle = (Math.random() - 0.5) * 0.7;
    const speed = 260;
    const dir = serveTo === 'red' ? -1 : serveTo === 'blue' ? 1 : (Math.random() < 0.5 ? -1 : 1);
    this.puck.vx = Math.cos(angle) * speed * dir;
    this.puck.vy = Math.sin(angle) * speed;
    this._spawnRing(this.puck.x, this.puck.y, '#ffd982', 42);
    this.sound?.playDodge?.();
  }

  _stepPuckPhysics(dt) {
    const p = this.puck;
    const subSteps = 4;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      p.x += p.vx * subDt;
      p.y += p.vy * subDt;

      // Air-hockey minimal glide drag
      const drag = Math.pow(0.9965, subDt * 60);
      p.vx *= drag;
      p.vy *= drag;

      // Striker collisions
      this._collideStriker('red');
      this._collideStriker('blue');

      // Goal post circular collisions
      const posts = [
        { x: RINK_L, y: GOAL_T },
        { x: RINK_L, y: GOAL_B },
        { x: RINK_R, y: GOAL_T },
        { x: RINK_R, y: GOAL_B },
      ];
      for (const post of posts) {
        const dx = p.x - post.x;
        const dy = p.y - post.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PUCK_R + POST_R;
        if (dist > 0.001 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = post.x + nx * (minDist + 0.5);
          p.y = post.y + ny * (minDist + 0.5);
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) {
            p.vx -= 1.92 * vn * nx;
            p.vy -= 1.92 * vn * ny;
            this._recordHit(post.x, post.y, '#ffd982', false, true);
          }
        }
      }

      // Top & bottom wall collisions
      if (p.y - PUCK_R < RINK_T) {
        p.y = RINK_T + PUCK_R;
        if (p.vy < 0) {
          p.vy = -p.vy * 0.94;
          this._recordHit(p.x, RINK_T, '#f4b7c7', Math.abs(p.vy) > 550, true);
        }
      } else if (p.y + PUCK_R > RINK_B) {
        p.y = RINK_B - PUCK_R;
        if (p.vy > 0) {
          p.vy = -p.vy * 0.94;
          this._recordHit(p.x, RINK_B, '#f4b7c7', Math.abs(p.vy) > 550, true);
        }
      }

      // Left & right walls (with goal mouths open)
      const inGoalMouth = p.y > GOAL_T + PUCK_R * 0.35 && p.y < GOAL_B - PUCK_R * 0.35;

      if (!inGoalMouth) {
        if (p.x - PUCK_R < RINK_L) {
          p.x = RINK_L + PUCK_R;
          if (p.vx < 0) {
            p.vx = -p.vx * 0.94;
            this._recordHit(RINK_L, p.y, '#ff5ca8', Math.abs(p.vx) > 550, true);
          }
        } else if (p.x + PUCK_R > RINK_R) {
          p.x = RINK_R - PUCK_R;
          if (p.vx > 0) {
            p.vx = -p.vx * 0.94;
            this._recordHit(RINK_R, p.y, '#589eff', Math.abs(p.vx) > 550, true);
          }
        }
      } else {
        // Check if puck crossed goal line!
        if (p.x < RINK_L - PUCK_R * 0.45) {
          this._scoreGoal('blue');
          return;
        }
        if (p.x > RINK_R + PUCK_R * 0.45) {
          this._scoreGoal('red');
          return;
        }
      }

      // Soft rounded-corner deflection so puck never wedges in corners
      this._deflectRoundedCorners();

      // Cap puck speed
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > MAX_PUCK_SPEED) {
        const scale = MAX_PUCK_SPEED / speed;
        p.vx *= scale;
        p.vy *= scale;
      }
    }

    p.spin += Math.hypot(p.vx, p.vy) * dt * 0.012;
    this._pushPuckTrail();
  }

  _deflectRoundedCorners() {
    const p = this.puck;
    const innerR = CORNER_R - PUCK_R;
    const corners = [
      { cx: RINK_L + CORNER_R, cy: RINK_T + CORNER_R, sx: -1, sy: -1 },
      { cx: RINK_R - CORNER_R, cy: RINK_T + CORNER_R, sx: 1, sy: -1 },
      { cx: RINK_L + CORNER_R, cy: RINK_B - CORNER_R, sx: -1, sy: 1 },
      { cx: RINK_R - CORNER_R, cy: RINK_B - CORNER_R, sx: 1, sy: 1 },
    ];

    for (const c of corners) {
      const dx = p.x - c.cx;
      const dy = p.y - c.cy;
      if (dx * c.sx > 0 && dy * c.sy > 0) {
        const dist = Math.hypot(dx, dy);
        if (dist > innerR && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = c.cx + nx * innerR;
          p.y = c.cy + ny * innerR;
          const vn = p.vx * nx + p.vy * ny;
          if (vn > 0) {
            p.vx -= 1.88 * vn * nx;
            p.vy -= 1.88 * vn * ny;
          }
        }
      }
    }
  }

  _collideStriker(side) {
    const s = this.strikers[side];
    const p = this.puck;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy);
    const minDist = STRIKER_R + PUCK_R;

    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : (side === 'red' ? 1 : -1);
      const ny = dist > 0.001 ? dy / dist : 0;

      // Separate cleanly
      p.x = s.x + nx * (minDist + 0.8);
      p.y = s.y + ny * (minDist + 0.8);

      // Relative velocity along normal
      const rvx = p.vx - s.vx;
      const rvy = p.vy - s.vy;
      const velAlongNormal = rvx * nx + rvy * ny;

      if (velAlongNormal < 0) {
        const restitution = 0.92;
        const j = -(1 + restitution) * velAlongNormal;
        p.vx += j * nx + s.vx * 0.28;
        p.vy += j * ny + s.vy * 0.28;
      } else {
        // Striker pushed gently into puck
        p.vx += nx * 180 + s.vx * 0.45;
        p.vy += ny * 180 + s.vy * 0.45;
      }

      // Ensure crisp bounce minimum speed
      const speed = Math.hypot(p.vx, p.vy);
      if (speed < 280) {
        const boost = 280 / (speed || 1);
        p.vx = (p.vx || nx) * boost;
        p.vy = (p.vy || ny) * boost;
      }

      p.lastHitBy = side;
      s.pulse = 1;

      const impactSpeed = Math.hypot(p.vx, p.vy);
      const heavy = impactSpeed > 680;
      const color = side === 'red' ? '#ff5ca8' : '#589eff';
      const contactX = s.x + nx * STRIKER_R;
      const contactY = s.y + ny * STRIKER_R;
      this._recordHit(contactX, contactY, color, heavy, false);
    }
  }

  _recordHit(x, y, color, heavy, wall) {
    this._hitSeq += 1;
    this._lastHitEvent = { seq: this._hitSeq, x, y, color, heavy, wall };

    this._spawnHitBurst(x, y, color, wall ? 7 : (heavy ? 18 : 11), heavy);
    if (wall) {
      this.sound?.playBlock?.();
      this.shake = Math.max(this.shake, heavy ? 4.5 : 2);
    } else {
      this.sound?.playHit?.(heavy);
      this.shake = Math.max(this.shake, heavy ? 8 : 3.5);
    }
  }

  _scoreGoal(scorer) {
    if (this.phase !== 'play') return;
    this.scores[scorer] += 1;
    this.lastScorer = scorer;
    this.phase = 'goal';
    this.phaseTimer = 1.45;

    const winner = this.scores[scorer] >= WIN_SCORE ? scorer : null;
    this._updateHUD();
    this._triggerGoalEffects(scorer, Boolean(winner));

    if (this.mode === 'online-host') {
      this.sendNet({
        kind: 'goal',
        scorer,
        sr: this.scores.red,
        sb: this.scores.blue,
        winner,
      });
    }
  }

  _triggerGoalEffects(scorer, isWinningGoal) {
    const color = scorer === 'red' ? '#ff5ca8' : '#589eff';
    const scorerName = scorer === 'red' ? this.redName : this.blueName;
    this.bannerText = isWinningGoal ? `👑 ${scorerName.toUpperCase()} WINS!` : `💖 ${scorerName.toUpperCase()} SCORES!`;
    this.bannerColor = color;
    this.goalFlash = 1;
    this.goalFlashColor = color;
    this.shake = 14;

    if (isWinningGoal) {
      this.sound?.playVictory?.();
    } else {
      this.sound?.playSuperReady?.();
    }

    // Celebratory confetti burst from the scored goal
    const gx = scorer === 'red' ? RINK_R : RINK_L;
    const dir = scorer === 'red' ? -1 : 1;
    const palette = ['#ff5ca8', '#ff85c4', '#ffd982', '#589eff', '#fff3c9'];
    for (let i = 0; i < 48; i++) {
      const ang = (Math.random() - 0.5) * 1.9 + (dir < 0 ? Math.PI : 0);
      const spd = 180 + Math.random() * 440;
      this.confetti.push({
        x: gx,
        y: MID_Y + (Math.random() - 0.5) * 140,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        color: palette[i % palette.length],
        heart: i % 3 === 0,
        life: 1.4 + Math.random() * 0.7,
        maxLife: 2.1,
      });
    }

    this._spawnRing(gx, MID_Y, color, 160);
    this._spawnRing(gx, MID_Y, '#ffd982', 110);
  }

  _emitGameOver(winnerSide) {
    if (this._gameOverEmitted) return;
    this._gameOverEmitted = true;
    const summary = `${this.redName} ${this.scores.red} - ${this.scores.blue} ${this.blueName}`;
    this.onGameOver(winnerSide, summary);
  }

  _pushPuckTrail() {
    const p = this.puck;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 18) p.trail.shift();
  }

  _spawnHitBurst(x, y, color, count, heavy) {
    this._spawnRing(x, y, color, heavy ? 54 : 34);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (heavy ? 180 : 110) + Math.random() * (heavy ? 320 : 210);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.2 + Math.random() * (heavy ? 3.8 : 2.5),
        color: i % 3 === 0 ? '#fff3c9' : color,
        life: 0.25 + Math.random() * 0.24,
        maxLife: 0.49,
      });
    }
  }

  _spawnRing(x, y, color, maxR) {
    this.rings.push({ x, y, r: 10, maxR, color, life: 0.34, maxLife: 0.34 });
  }

  _updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.goalFlash = Math.max(0, this.goalFlash - dt * 2.2);
    this.strikers.red.pulse = Math.max(0, this.strikers.red.pulse - dt * 4.5);
    this.strikers.blue.pulse = Math.max(0, this.strikers.blue.pulse - dt * 4.5);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= 0.92;
      sp.vy *= 0.92;
      sp.life -= dt;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      rg.life -= dt;
      const t = 1 - Math.max(0, rg.life / rg.maxLife);
      rg.r = lerp(12, rg.maxR, 1 - Math.pow(1 - t, 3));
      if (rg.life <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.97;
      c.vy += 260 * dt;
      c.rot += c.vrot * dt;
      c.life -= dt;
      if (c.life <= 0) this.confetti.splice(i, 1);
    }
  }

  _render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Screen shake offset
    if (this.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this._drawRink(ctx);
    this._drawRings(ctx);
    this._drawPuck(ctx);
    this._drawStriker(ctx, 'red');
    this._drawStriker(ctx, 'blue');
    this._drawSparks(ctx);
    this._drawConfetti(ctx);
    this._drawOverlayBanner(ctx);

    ctx.restore();
  }

  _drawRink(ctx) {
    // Deep velvet plum outer frame
    const bgGrad = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
    bgGrad.addColorStop(0, '#1e0827');
    bgGrad.addColorStop(0.5, '#120518');
    bgGrad.addColorStop(1, '#0d0c24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Recessed glowing goal pockets
    const drawPocket = (x, color, isLeft) => {
      ctx.save();
      ctx.fillStyle = isLeft ? 'rgba(255, 92, 168, 0.16)' : 'rgba(88, 158, 255, 0.16)';
      ctx.fillRect(x, GOAL_T, 24, GOAL_B - GOAL_T);
      // Net mesh lines
      ctx.strokeStyle = isLeft ? 'rgba(255, 133, 196, 0.25)' : 'rgba(140, 194, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let y = GOAL_T + 10; y < GOAL_B; y += 14) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 24, y);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, GOAL_T, 24, GOAL_B - GOAL_T);
      ctx.restore();
    };
    drawPocket(RINK_L - 24, '#ff5ca8', true);
    drawPocket(RINK_R, '#589eff', false);

    // Main ice / velvet air-table surface
    ctx.save();
    drawRoundedRectPath(ctx, RINK_L, RINK_T, RINK_R - RINK_L, RINK_B - RINK_T, CORNER_R);
    const surfGrad = ctx.createRadialGradient(MID_X, MID_Y, 40, MID_X, MID_Y, 520);
    surfGrad.addColorStop(0, '#2c1138');
    surfGrad.addColorStop(0.55, '#1d0a26');
    surfGrad.addColorStop(1, '#14071d');
    ctx.fillStyle = surfGrad;
    ctx.fill();
    ctx.clip();

    // Subtle side color ambient wash
    const leftWash = ctx.createRadialGradient(RINK_L + 40, MID_Y, 10, RINK_L + 40, MID_Y, 340);
    leftWash.addColorStop(0, 'rgba(255, 92, 168, 0.17)');
    leftWash.addColorStop(1, 'rgba(255, 92, 168, 0)');
    ctx.fillStyle = leftWash;
    ctx.fillRect(RINK_L, RINK_T, (RINK_R - RINK_L) * 0.5, RINK_B - RINK_T);

    const rightWash = ctx.createRadialGradient(RINK_R - 40, MID_Y, 10, RINK_R - 40, MID_Y, 340);
    rightWash.addColorStop(0, 'rgba(88, 158, 255, 0.17)');
    rightWash.addColorStop(1, 'rgba(88, 158, 255, 0)');
    ctx.fillStyle = rightWash;
    ctx.fillRect(MID_X, RINK_T, (RINK_R - RINK_L) * 0.5, RINK_B - RINK_T);

    // Subtle air-hole micro-dot texture
    ctx.fillStyle = 'rgba(255, 224, 240, 0.055)';
    for (let x = RINK_L + 32; x < RINK_R - 20; x += 36) {
      for (let y = RINK_T + 28; y < RINK_B - 20; y += 36) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Center rose-gold dividing line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 217, 130, 0.36)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 217, 130, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(MID_X, RINK_T);
    ctx.lineTo(MID_X, RINK_B);
    ctx.stroke();

    // Center heart circle
    const pulse = 1 + Math.sin(this._clock * 2.8) * 0.025;
    ctx.strokeStyle = 'rgba(255, 217, 130, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(MID_X, MID_Y, 76 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 133, 196, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(MID_X, MID_Y, 62, 0, Math.PI * 2);
    ctx.stroke();

    // Center glowing heart emblem
    drawHeartPath(ctx, MID_X, MID_Y + 2, 28 * pulse);
    ctx.fillStyle = 'rgba(255, 92, 168, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 217, 130, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Goal creases (left rose-pink, right sapphire-blue)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 92, 168, 0.45)';
    ctx.fillStyle = 'rgba(255, 92, 168, 0.08)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(RINK_L, MID_Y, GOAL_HALF_H + 10, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88, 158, 255, 0.45)';
    ctx.fillStyle = 'rgba(88, 158, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(RINK_R, MID_Y, GOAL_HALF_H + 10, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.fill();
    ctx.stroke();

    // Subtle faceoff dots
    const faceoffs = [
      { x: RINK_L + 190, y: RINK_T + 110, c: 'rgba(255, 92, 168, 0.3)' },
      { x: RINK_L + 190, y: RINK_B - 110, c: 'rgba(255, 92, 168, 0.3)' },
      { x: RINK_R - 190, y: RINK_T + 110, c: 'rgba(88, 158, 255, 0.3)' },
      { x: RINK_R - 190, y: RINK_B - 110, c: 'rgba(88, 158, 255, 0.3)' },
    ];
    for (const f of faceoffs) {
      ctx.strokeStyle = f.c;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = f.c;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Goal flash overlay inside rink
    if (this.goalFlash > 0.01) {
      ctx.fillStyle = this.goalFlashColor;
      ctx.globalAlpha = this.goalFlash * 0.24;
      ctx.fillRect(RINK_L, RINK_T, RINK_R - RINK_L, RINK_B - RINK_T);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // end clip

    // Glowing split-neon outer rink rail (rose-pink left, electric-blue right)
    ctx.save();
    const borderGrad = ctx.createLinearGradient(RINK_L, 0, RINK_R, 0);
    borderGrad.addColorStop(0, '#ff5ca8');
    borderGrad.addColorStop(0.45, '#f4b7c7');
    borderGrad.addColorStop(0.5, '#ffd982');
    borderGrad.addColorStop(0.55, '#9ec9ff');
    borderGrad.addColorStop(1, '#589eff');

    drawRoundedRectPath(ctx, RINK_L, RINK_T, RINK_R - RINK_L, RINK_B - RINK_T, CORNER_R);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255, 168, 214, 0.55)';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();

    // Clear goal mouth openings over the border with glowing laser goal lines
    ctx.save();
    ctx.fillStyle = '#180822';
    ctx.fillRect(RINK_L - 4, GOAL_T, 8, GOAL_B - GOAL_T);
    ctx.fillRect(RINK_R - 4, GOAL_T, 8, GOAL_B - GOAL_T);

    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 92, 168, 0.78)';
    ctx.beginPath();
    ctx.moveTo(RINK_L, GOAL_T);
    ctx.lineTo(RINK_L, GOAL_B);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(88, 158, 255, 0.78)';
    ctx.beginPath();
    ctx.moveTo(RINK_R, GOAL_T);
    ctx.lineTo(RINK_R, GOAL_B);
    ctx.stroke();
    ctx.setLineDash([]);

    // Champagne-gold goal posts
    const posts = [
      { x: RINK_L, y: GOAL_T },
      { x: RINK_L, y: GOAL_B },
      { x: RINK_R, y: GOAL_T },
      { x: RINK_R, y: GOAL_B },
    ];
    for (const post of posts) {
      ctx.beginPath();
      ctx.arc(post.x, post.y, POST_R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd982';
      ctx.shadowColor = '#ffd982';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = '#fff8e2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPuck(ctx) {
    const p = this.puck;
    const trailColor = p.lastHitBy === 'red' ? '#ff5ca8' : p.lastHitBy === 'blue' ? '#589eff' : '#ffd982';

    // Neon comet trail
    if (p.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const ratio = i / p.trail.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, PUCK_R * (0.28 + ratio * 0.65), 0, Math.PI * 2);
        ctx.fillStyle = trailColor;
        ctx.globalAlpha = ratio * ratio * 0.34;
        ctx.fill();
      }
      ctx.restore();
    }

    // Puck shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4, PUCK_R + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fill();

    // Glowing puck disc
    const grad = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, PUCK_R);
    grad.addColorStop(0, '#fffdf4');
    grad.addColorStop(0.5, '#ffe29c');
    grad.addColorStop(1, '#d98a38');

    ctx.shadowColor = trailColor;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PUCK_R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff7df';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner heart emblem on puck
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.spin * 0.2) * 0.25);
    drawHeartPath(ctx, 0, 0.5, 10.5);
    ctx.fillStyle = p.lastHitBy === 'blue' ? '#2563eb' : '#d61c72';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  _drawStriker(ctx, side) {
    const s = this.strikers[side];
    const isRed = side === 'red';
    const main = isRed ? '#ff5ca8' : '#589eff';
    const bright = isRed ? '#ff9ad0' : '#9cc8ff';
    const dark = isRed ? '#8f1250' : '#163f94';
    const isMine = this.mode !== 'local' && side === this.mySide;

    ctx.save();

    // Subtle "YOU" outer locator ring
    if (isMine) {
      const ringR = STRIKER_R + 7 + Math.sin(this._clock * 5) * 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 217, 130, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Impact pulse ring
    const scale = 1 + s.pulse * 0.08;
    ctx.translate(s.x, s.y);
    ctx.scale(scale, scale);

    // Drop shadow
    ctx.beginPath();
    ctx.arc(0, 5, STRIKER_R + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Outer neon body
    const bodyGrad = ctx.createRadialGradient(-9, -10, 4, 0, 0, STRIKER_R);
    bodyGrad.addColorStop(0, bright);
    bodyGrad.addColorStop(0.55, main);
    bodyGrad.addColorStop(1, dark);

    ctx.shadowColor = main;
    ctx.shadowBlur = 20 + s.pulse * 14;
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Champagne-gold metallic bezel
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd982';
    ctx.stroke();

    // Recessed inner ring
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_R * 0.64, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 6, 26, 0.38)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 243, 201, 0.65)';
    ctx.stroke();

    // Center dome knob
    const knobGrad = ctx.createRadialGradient(-4, -5, 1, 0, 0, 15);
    knobGrad.addColorStop(0, '#fff7fb');
    knobGrad.addColorStop(0.6, bright);
    knobGrad.addColorStop(1, main);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = knobGrad;
    ctx.fill();

    // Cute tiny bunny ears icon inside knob
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(-4, -2, 2.3, 6.2, -0.22, 0, Math.PI * 2);
    ctx.ellipse(4, -2, 2.3, 6.2, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 4, 4.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawRings(ctx) {
    for (const rg of this.rings) {
      const a = Math.max(0, rg.life / rg.maxLife);
      ctx.save();
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 2 + a * 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawSparks(ctx) {
    for (const sp of this.sparks) {
      const a = Math.max(0, sp.life / sp.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = sp.color;
      ctx.shadowColor = sp.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawConfetti(ctx) {
    for (const c of this.confetti) {
      const a = Math.max(0, Math.min(1, c.life / 0.5));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = c.color;
      if (c.heart) {
        drawHeartPath(ctx, 0, 0, c.size);
        ctx.fill();
      } else {
        ctx.fillRect(-c.size * 0.6, -c.size * 0.35, c.size * 1.2, c.size * 0.7);
      }
      ctx.restore();
    }
  }

  _drawOverlayBanner(ctx) {
    if (this.phase !== 'goal' && this.phase !== 'serve') return;
    if (this.phase === 'serve' && this.phaseTimer < 0.05) return;

    ctx.save();
    const isGoal = this.phase === 'goal';
    const text = isGoal ? this.bannerText : 'READY!';
    ctx.font = `700 ${isGoal ? 44 : 36}px 'Bangers', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const w = Math.min(540, ctx.measureText(text).width + 66);
    const h = isGoal ? 74 : 58;
    const x = MID_X - w / 2;
    const y = MID_Y - h / 2;

    drawRoundedRectPath(ctx, x, y, w, h, 18);
    ctx.fillStyle = 'rgba(20, 6, 26, 0.84)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isGoal ? this.bannerColor : '#ffd982';
    ctx.shadowColor = isGoal ? this.bannerColor : '#ffd982';
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff8fc';
    ctx.fillText(text, MID_X, MID_Y + 2);
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
