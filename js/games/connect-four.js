// 🔴 Romantic Bunny Connect 4 1v1 — Wifebun ♥ Husbun Date Night Arcade
// 7×6 velvet-rose & champagne-gold board, bouncy gravity drop physics, smart minimax AI, & turn-based online sync.

const COLS = 7;
const ROWS = 6;
const LOGICAL_W = 760;
const LOGICAL_H = 620;

// Board geometry inside logical canvas
const BOARD_X = 60;
const BOARD_Y = 104;
const BOARD_W = 640;
const BOARD_H = 486;
const CELL_PAD_X = 24;
const CELL_PAD_TOP = 20;
const CELL_PAD_BOT = 36;
const CELL_W = (BOARD_W - CELL_PAD_X * 2) / COLS;
const CELL_H = (BOARD_H - CELL_PAD_TOP - CELL_PAD_BOT) / ROWS;
const DISC_R = Math.min(CELL_W, CELL_H) * 0.415;

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

function cellCenterX(col) {
  return BOARD_X + CELL_PAD_X + CELL_W * (col + 0.5);
}

function cellCenterY(row) {
  return BOARD_Y + CELL_PAD_TOP + CELL_H * (row + 0.5);
}

export class ConnectFourGame {
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

    // Game state
    this.matchIndex = 0;
    this.board = [];
    this.turn = 'red'; // Wifebun goes first on Round 1!
    this.hoverCol = 3;
    this.gameOver = false;
    this.winner = null;
    this.winningCells = [];
    this.lastMove = null; // { row, col, side, age }
    this.moveCount = 0;
    this.gameOverFired = false;

    // Animation state
    this.activeDrop = null; // { col, targetRow, side, y, vy, bounces, done }
    this.particles = [];
    this.elapsed = 0;
    this.lastFrameTime = 0;
    this.cpuThinking = false;

    // Bound handlers
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onResize = this._resizeCanvas.bind(this);
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

  _clearAllTimers() {
    for (const id of this.timers) {
      window.clearTimeout(id);
    }
    this.timers.clear();
  }

  start() {
    if (this.destroyed || !this.container) return;
    this.matchIndex = 0;
    this._renderDOM();
    this._bindEvents();
    this._resizeCanvas();
    this._resetBoard('red');

    this.lastFrameTime = performance.now();
    this._startLoop();
    this._maybeTriggerCpuTurn();
  }

  restart() {
    if (this.destroyed) return;
    this._clearAllTimers();
    this.matchIndex += 1;
    // Alternate first turn on rematch cleanly (deterministic on both peers!)
    const firstTurn = this.matchIndex % 2 === 0 ? 'red' : 'blue';
    this._resetBoard(firstTurn);
    this._maybeTriggerCpuTurn();
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

  _resetBoard(firstTurn = 'red') {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.turn = firstTurn;
    this.hoverCol = 3;
    this.gameOver = false;
    this.winner = null;
    this.winningCells = [];
    this.lastMove = null;
    this.moveCount = 0;
    this.activeDrop = null;
    this.particles = [];
    this.cpuThinking = false;
    this.gameOverFired = false;
    this._updateBanner();
  }

  _renderDOM() {
    const isLocal = this.mode === 'local';
    const redYou = (!isLocal && this.mySide === 'red') ? '<span class="c4-tag">YOU</span>' : '';
    const blueYou = (!isLocal && this.mySide === 'blue') ? '<span class="c4-tag">YOU</span>' : '';
    const redCpu = (this.mode === 'cpu' && this.mySide === 'blue') ? '<span class="c4-tag c4-tag--cpu">CPU</span>' : '';
    const blueCpu = (this.mode === 'cpu' && this.mySide === 'red') ? '<span class="c4-tag c4-tag--cpu">CPU</span>' : '';

    this.container.innerHTML = `
      <style>
        .c4-root {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          user-select: none;
          -webkit-user-select: none;
          font-family: var(--font-body, 'Inter', system-ui, sans-serif);
          color: var(--text, #fff8fc);
        }
        .c4-hud {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(44, 15, 48, 0.94), rgba(24, 8, 30, 0.95));
          border: 1px solid rgba(255, 217, 130, 0.3);
          box-shadow: 0 8px 24px rgba(8, 2, 16, 0.45);
        }
        .c4-side {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
          min-width: 0;
        }
        .c4-side--blue {
          justify-content: flex-end;
          text-align: right;
        }
        .c4-side--red.is-active {
          background: rgba(255, 92, 168, 0.18);
          border-color: rgba(255, 133, 196, 0.65);
          box-shadow: 0 0 18px rgba(255, 92, 168, 0.28);
        }
        .c4-side--blue.is-active {
          background: rgba(88, 158, 255, 0.18);
          border-color: rgba(140, 194, 255, 0.65);
          box-shadow: 0 0 18px rgba(88, 158, 255, 0.28);
        }
        .c4-disc-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 0.92rem;
          flex-shrink: 0;
          border: 2px solid #ffd982;
        }
        .c4-disc-icon--red {
          background: radial-gradient(circle at 30% 30%, #ff9ad1, #d42076);
        }
        .c4-disc-icon--blue {
          background: radial-gradient(circle at 30% 30%, #99ccff, #2152c2);
        }
        .c4-name {
          font-weight: 700;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .c4-tag {
          font-size: 0.64rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 1px 6px;
          border-radius: 999px;
          background: rgba(255, 217, 130, 0.22);
          color: #ffd982;
          border: 1px solid rgba(255, 217, 130, 0.45);
        }
        .c4-tag--cpu {
          background: rgba(255, 255, 255, 0.1);
          color: #d7b7cf;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .c4-turn-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-align: center;
        }
        .c4-turn-pill {
          font-family: var(--font-arcade, system-ui, sans-serif);
          font-size: 0.86rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 5px 14px;
          border-radius: 999px;
          background: rgba(255, 92, 168, 0.2);
          border: 1px solid rgba(255, 194, 222, 0.45);
          color: #fff8fc;
          white-space: nowrap;
          transition: background 0.2s, border-color 0.2s;
        }
        .c4-turn-pill.is-blue {
          background: rgba(88, 158, 255, 0.22);
          border-color: rgba(140, 194, 255, 0.5);
        }
        .c4-turn-pill.is-win {
          background: linear-gradient(90deg, rgba(255, 92, 168, 0.35), rgba(255, 217, 130, 0.35));
          border-color: #ffd982;
          color: #fff3c9;
        }
        .c4-hint {
          font-size: 0.72rem;
          color: #d7b7cf;
        }
        .c4-board-wrap {
          width: 100%;
          max-width: 650px;
          aspect-ratio: 760 / 620;
          max-height: 62vh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          touch-action: manipulation;
        }
        .c4-canvas {
          width: 100%;
          height: 100%;
          display: block;
          border-radius: 18px;
        }
        .c4-col-bar {
          width: 100%;
          max-width: 556px;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .c4-col-btn {
          border: 1px solid rgba(255, 217, 130, 0.32);
          background: rgba(45, 15, 50, 0.85);
          color: #fff3c9;
          font-family: var(--font-arcade, system-ui, sans-serif);
          font-weight: 800;
          font-size: 0.82rem;
          padding: 6px 0;
          border-radius: 10px;
          cursor: pointer;
          transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .c4-col-btn:hover:not(:disabled) {
          background: rgba(255, 92, 168, 0.3);
          border-color: #ffd982;
          transform: translateY(-1px);
        }
        .c4-col-btn:disabled {
          opacity: 0.32;
          cursor: default;
        }
        @media (max-width: 600px) {
          .c4-hud {
            padding: 7px 9px;
            gap: 5px;
          }
          .c4-side {
            padding: 4px 6px;
            gap: 5px;
          }
          .c4-disc-icon {
            width: 24px;
            height: 24px;
            font-size: 0.78rem;
          }
          .c4-name {
            font-size: 0.78rem;
          }
          .c4-turn-pill {
            font-size: 0.76rem;
            padding: 4px 10px;
          }
          .c4-hint {
            display: none;
          }
        }
      </style>
      <div class="c4-root">
        <div class="c4-hud">
          <div class="c4-side c4-side--red" data-side-pill="red">
            <div class="c4-disc-icon c4-disc-icon--red">🎀</div>
            <div class="c4-name">${escapeHtml(this.redName)} ${redYou}${redCpu}</div>
          </div>

          <div class="c4-turn-box">
            <div class="c4-turn-pill" data-turn-pill>Wifebun's Turn 🎀</div>
            <div class="c4-hint" data-hint>Click a column or press 1–7</div>
          </div>

          <div class="c4-side c4-side--blue" data-side-pill="blue">
            <div class="c4-name">${blueYou}${blueCpu} ${escapeHtml(this.blueName)}</div>
            <div class="c4-disc-icon c4-disc-icon--blue">💪</div>
          </div>
        </div>

        <div class="c4-board-wrap" data-board-wrap>
          <canvas class="c4-canvas" data-canvas width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        </div>

        <div class="c4-col-bar" data-col-bar>
          ${Array.from({ length: COLS }, (_, i) => `
            <button type="button" class="c4-col-btn" data-col="${i}" aria-label="Drop in column ${i + 1}">${i + 1}</button>
          `).join('')}
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('[data-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.els = {
      redPill: this.container.querySelector('[data-side-pill="red"]'),
      bluePill: this.container.querySelector('[data-side-pill="blue"]'),
      turnPill: this.container.querySelector('[data-turn-pill]'),
      hint: this.container.querySelector('[data-hint]'),
      colButtons: Array.from(this.container.querySelectorAll('.c4-col-btn')),
    };
  }

  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);

    const getColFromEvent = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
      const rel = nx - (BOARD_X + CELL_PAD_X);
      const col = Math.floor(rel / CELL_W);
      return Math.max(0, Math.min(COLS - 1, col));
    };

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.destroyed) return;
      this.hoverCol = getColFromEvent(e);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.destroyed) return;
      e.preventDefault();
      const col = getColFromEvent(e);
      this.hoverCol = col;
      this._attemptLocalDrop(col);
    });

    for (const btn of this.els.colButtons) {
      const col = Number(btn.dataset.col);
      btn.addEventListener('pointerenter', () => {
        this.hoverCol = col;
      });
      btn.addEventListener('click', () => {
        this.hoverCol = col;
        this._attemptLocalDrop(col);
      });
    }
  }

  _handleKeyDown(e) {
    if (this.destroyed || e.repeat) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key >= '1' && e.key <= '7') {
      e.preventDefault();
      const col = Number(e.key) - 1;
      this.hoverCol = col;
      this._attemptLocalDrop(col);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      this.hoverCol = (this.hoverCol + COLS - 1) % COLS;
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      this.hoverCol = (this.hoverCol + 1) % COLS;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this._attemptLocalDrop(this.hoverCol);
    }
  }

  _resizeCanvas() {
    if (!this.canvas || !this.ctx || this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(LOGICAL_W * dpr);
    this.canvas.height = Math.round(LOGICAL_H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _canLocalPlayerMove() {
    if (this.gameOver || this.activeDrop || this.cpuThinking) return false;
    if (this.mode === 'local') return true;
    return this.turn === this.mySide;
  }

  _updateBanner() {
    if (this.destroyed || !this.els.turnPill) return;

    const isRedTurn = this.turn === 'red';
    this.els.redPill.classList.toggle('is-active', !this.gameOver && isRedTurn);
    this.els.bluePill.classList.toggle('is-active', !this.gameOver && !isRedTurn);

    this.els.turnPill.classList.remove('is-blue', 'is-win');

    if (this.gameOver) {
      this.els.turnPill.classList.add('is-win');
      if (this.winner === 'draw') {
        this.els.turnPill.textContent = 'Full Board — Draw! 🤝';
        this.els.hint.textContent = 'Rematch for the tiebreaker!';
      } else {
        const wName = this.winner === 'red' ? this.redName : this.blueName;
        this.els.turnPill.textContent = `${wName} Wins! 4 in a Row 💕`;
        this.els.hint.textContent = 'Sparkling victory!';
      }
    } else {
      const turnName = isRedTurn ? this.redName : this.blueName;
      const emoji = isRedTurn ? '🎀' : '💪';
      this.els.turnPill.textContent = `${turnName}'s Turn ${emoji}`;
      if (!isRedTurn) this.els.turnPill.classList.add('is-blue');

      if (this.mode === 'online-host' || this.mode === 'online-guest') {
        this.els.hint.textContent = this.turn === this.mySide
          ? 'Your move! Click a column or press 1–7'
          : `Waiting for ${turnName} to drop...`;
      } else if (this.mode === 'cpu') {
        this.els.hint.textContent = this.turn === this.mySide
          ? 'Your move! Click a column or press 1–7'
          : `${turnName} is thinking...`;
      } else {
        this.els.hint.textContent = 'Click a column or press 1–7';
      }
    }

    const canAct = this._canLocalPlayerMove();
    for (const btn of this.els.colButtons) {
      const col = Number(btn.dataset.col);
      const isFull = this.board[0] && this.board[0][col] !== null;
      btn.disabled = !canAct || isFull;
    }
  }

  // ---- Move Execution & Online Sync ----

  _findOpenRow(board, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === null) return r;
    }
    return -1;
  }

  _attemptLocalDrop(col) {
    if (!this._canLocalPlayerMove()) return;
    if (col < 0 || col >= COLS) return;
    const row = this._findOpenRow(this.board, col);
    if (row < 0) {
      this.sound?.playBlock?.();
      return;
    }

    const side = this.turn;
    if (this.mode === 'online-host' || this.mode === 'online-guest') {
      this.sendNet({ kind: 'drop', col, side });
    }
    this._startDropAnimation(col, row, side);
  }

  handleNet(payload) {
    if (this.destroyed || !payload || typeof payload !== 'object') return;
    if (payload.kind !== 'drop') return;

    const col = Number(payload.col);
    const side = payload.side === 'blue' ? 'blue' : 'red';
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return;

    // If an animation is still bouncing, snap it cleanly before applying partner's drop
    if (this.activeDrop) {
      this._finishActiveDrop(true);
    }

    if (this.gameOver || side !== this.turn) return;
    const row = this._findOpenRow(this.board, col);
    if (row < 0) return;

    this.hoverCol = col;
    this._startDropAnimation(col, row, side);
  }

  _startDropAnimation(col, targetRow, side) {
    this.activeDrop = {
      col,
      targetRow,
      side,
      y: BOARD_Y - 46,
      vy: 140,
      bounces: 0,
    };
    this.sound?.playJump?.();
    this._updateBanner();
  }

  _finishActiveDrop(silent = false) {
    const drop = this.activeDrop;
    if (!drop) return;
    this.activeDrop = null;

    this.board[drop.targetRow][drop.col] = drop.side;
    this.moveCount += 1;
    this.lastMove = { row: drop.targetRow, col: drop.col, side: drop.side, age: 0 };

    if (!silent) {
      this.sound?.playBlock?.();
      const cx = cellCenterX(drop.col);
      const cy = cellCenterY(drop.targetRow);
      this._spawnSparkles(cx, cy, drop.side === 'red' ? '#ff85c4' : '#8cc2ff', 8);
    }

    // Check 4-in-a-row win!
    const winCells = this._findWinningCells(this.board, drop.targetRow, drop.col, drop.side);
    if (winCells.length >= 4) {
      this.gameOver = true;
      this.winner = drop.side;
      this.winningCells = winCells;
      this._updateBanner();
      this.sound?.playVictory?.();
      this._spawnWinCelebration(winCells);

      this._setTimer(() => {
        if (!this.gameOverFired) {
          this.gameOverFired = true;
          this.onGameOver(drop.side, '4 in a Row! 💕');
        }
      }, 950);
      return;
    }

    // Check full-board draw
    if (this.moveCount >= ROWS * COLS) {
      this.gameOver = true;
      this.winner = 'draw';
      this._updateBanner();
      this.sound?.playBell?.();

      this._setTimer(() => {
        if (!this.gameOverFired) {
          this.gameOverFired = true;
          this.onGameOver('draw', 'Full Board — Draw! 🤝');
        }
      }, 750);
      return;
    }

    // Switch turn
    this.turn = drop.side === 'red' ? 'blue' : 'red';
    this._updateBanner();
    this._maybeTriggerCpuTurn();
  }

  // ---- Win Detection ----

  _findWinningCells(board, row, col, side) {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    const allWinning = [];
    const seen = new Set();

    for (const [dr, dc] of dirs) {
      const line = [[row, col]];
      for (let step = 1; step < 6; step++) {
        const r = row + dr * step;
        const c = col + dc * step;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== side) break;
        line.push([r, c]);
      }
      for (let step = 1; step < 6; step++) {
        const r = row - dr * step;
        const c = col - dc * step;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== side) break;
        line.unshift([r, c]);
      }
      if (line.length >= 4) {
        for (const cell of line) {
          const key = `${cell[0]},${cell[1]}`;
          if (!seen.has(key)) {
            seen.add(key);
            allWinning.push(cell);
          }
        }
      }
    }
    return allWinning;
  }

  // ---- Smart Minimax / Heuristic CPU AI ----

  _maybeTriggerCpuTurn() {
    if (this.mode !== 'cpu' || this.gameOver || this.destroyed) return;
    const cpuSide = this.mySide === 'red' ? 'blue' : 'red';
    if (this.turn !== cpuSide) return;

    this.cpuThinking = true;
    this._updateBanner();

    const thinkMs = Math.round(420 + Math.random() * 220);
    this._setTimer(() => {
      this.cpuThinking = false;
      if (this.gameOver || this.destroyed || this.turn !== cpuSide) return;
      const bestCol = this._chooseCpuColumn(cpuSide);
      if (bestCol < 0) return;
      const row = this._findOpenRow(this.board, bestCol);
      if (row < 0) return;
      this.hoverCol = bestCol;
      this._startDropAnimation(bestCol, row, cpuSide);
    }, thinkMs);
  }

  _chooseCpuColumn(cpuSide) {
    const oppSide = cpuSide === 'red' ? 'blue' : 'red';
    const validCols = this._getValidCols(this.board);
    if (validCols.length === 0) return -1;

    // 1) Take immediate winning move right away
    for (const c of validCols) {
      const r = this._findOpenRow(this.board, c);
      this.board[r][c] = cpuSide;
      const wins = this._findWinningCells(this.board, r, c, cpuSide).length >= 4;
      this.board[r][c] = null;
      if (wins) return c;
    }

    // 2) Block opponent's immediate 3-in-a-row threat!
    for (const c of validCols) {
      const r = this._findOpenRow(this.board, c);
      this.board[r][c] = oppSide;
      const oppWins = this._findWinningCells(this.board, r, c, oppSide).length >= 4;
      this.board[r][c] = null;
      if (oppWins) return c;
    }

    // 3) Depth-4 alpha-beta minimax with center column preference
    let bestScore = -Infinity;
    let bestCol = validCols[0];

    for (const c of validCols) {
      const r = this._findOpenRow(this.board, c);
      this.board[r][c] = cpuSide;
      const score = this._minimax(this.board, 3, -Infinity, Infinity, false, cpuSide, oppSide)
        + (Math.random() * 1.4);
      this.board[r][c] = null;

      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }

    return bestCol;
  }

  _getValidCols(board) {
    // Center-first ordering maximizes alpha-beta pruning & strategic strength
    const order = [3, 2, 4, 1, 5, 0, 6];
    return order.filter((c) => board[0][c] === null);
  }

  _hasFour(board, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        if (board[r][c] === side && board[r][c + 1] === side && board[r][c + 2] === side && board[r][c + 3] === side) {
          return true;
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 3; r++) {
        if (board[r][c] === side && board[r + 1][c] === side && board[r + 2][c] === side && board[r + 3][c] === side) {
          return true;
        }
      }
    }
    for (let r = 0; r < ROWS - 3; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        if (board[r][c] === side && board[r + 1][c + 1] === side && board[r + 2][c + 2] === side && board[r + 3][c + 3] === side) {
          return true;
        }
      }
    }
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        if (board[r][c] === side && board[r - 1][c + 1] === side && board[r - 2][c + 2] === side && board[r - 3][c + 3] === side) {
          return true;
        }
      }
    }
    return false;
  }

  _scoreWindow(cells, cpuSide, oppSide) {
    let cpuCount = 0;
    let oppCount = 0;
    let emptyCount = 0;
    for (const v of cells) {
      if (v === cpuSide) cpuCount++;
      else if (v === oppSide) oppCount++;
      else emptyCount++;
    }
    if (cpuCount === 4) return 10000;
    if (oppCount === 4) return -10000;
    if (cpuCount === 3 && emptyCount === 1) return 14;
    if (cpuCount === 2 && emptyCount === 2) return 4;
    if (oppCount === 3 && emptyCount === 1) return -18;
    if (oppCount === 2 && emptyCount === 2) return -4;
    return 0;
  }

  _evaluateBoard(board, cpuSide, oppSide) {
    let score = 0;

    // Prefer center column & inner columns
    for (let r = 0; r < ROWS; r++) {
      if (board[r][3] === cpuSide) score += 6;
      else if (board[r][3] === oppSide) score -= 5;
      if (board[r][2] === cpuSide || board[r][4] === cpuSide) score += 2;
    }

    // Horizontal windows
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        score += this._scoreWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], cpuSide, oppSide);
      }
    }
    // Vertical windows
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 3; r++) {
        score += this._scoreWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], cpuSide, oppSide);
      }
    }
    // Positive diagonals
    for (let r = 0; r < ROWS - 3; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        score += this._scoreWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]], cpuSide, oppSide);
      }
    }
    // Negative diagonals
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c < COLS - 3; c++) {
        score += this._scoreWindow([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]], cpuSide, oppSide);
      }
    }

    return score;
  }

  _minimax(board, depth, alpha, beta, maximizing, cpuSide, oppSide) {
    if (this._hasFour(board, cpuSide)) return 50000 + depth * 100;
    if (this._hasFour(board, oppSide)) return -50000 - depth * 100;
    const validCols = this._getValidCols(board);
    if (validCols.length === 0) return 0;
    if (depth === 0) return this._evaluateBoard(board, cpuSide, oppSide);

    if (maximizing) {
      let value = -Infinity;
      for (const c of validCols) {
        const r = this._findOpenRow(board, c);
        board[r][c] = cpuSide;
        value = Math.max(value, this._minimax(board, depth - 1, alpha, beta, false, cpuSide, oppSide));
        board[r][c] = null;
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const c of validCols) {
        const r = this._findOpenRow(board, c);
        board[r][c] = oppSide;
        value = Math.min(value, this._minimax(board, depth - 1, alpha, beta, true, cpuSide, oppSide));
        board[r][c] = null;
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  // ---- Particles & Celebration ----

  _spawnSparkles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = 45 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35,
        size: 3 + Math.random() * 4,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
        color,
        kind: i % 2 === 0 ? 'heart' : 'spark',
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 6,
      });
    }
  }

  _spawnWinCelebration(cells) {
    const palette = ['#ffd982', '#ff6db7', '#fff3c9', '#8cc2ff'];
    for (const [r, c] of cells) {
      this._spawnSparkles(cellCenterX(c), cellCenterY(r), '#ffd982', 12);
    }
    for (let i = 0; i < 42; i++) {
      this.particles.push({
        x: BOARD_X + Math.random() * BOARD_W,
        y: BOARD_Y - 20 - Math.random() * 70,
        vx: (Math.random() - 0.5) * 120,
        vy: 90 + Math.random() * 180,
        size: 5 + Math.random() * 5,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.0,
        color: palette[i % palette.length],
        kind: i % 3 === 0 ? 'heart' : 'confetti',
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 7,
      });
    }
  }

  // ---- Main Loop ----

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

    if (this.lastMove) {
      this.lastMove.age += dt;
    }

    // Gravity + realistic bounce physics for falling disc
    if (this.activeDrop) {
      const d = this.activeDrop;
      const targetY = cellCenterY(d.targetRow);
      d.vy += 3750 * dt;
      d.y += d.vy * dt;

      if (d.y >= targetY) {
        d.y = targetY;
        if (Math.abs(d.vy) > 220 && d.bounces < 2) {
          d.vy = -d.vy * 0.34;
          d.bounces += 1;
          if (d.bounces === 1) {
            this.sound?.playBlock?.();
          }
        } else {
          this._finishActiveDrop(false);
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'confetti' || p.kind === 'spark') {
        p.vy += 220 * dt;
      } else {
        p.vy -= 25 * dt;
      }
      p.rot += p.vrot * dt;
    }
  }

  // ---- High-DPI Canvas Rendering ----

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle soft ambient backdrop glow behind board
    const bgGlow = ctx.createRadialGradient(LOGICAL_W / 2, LOGICAL_H / 2 + 20, 40, LOGICAL_W / 2, LOGICAL_H / 2 + 20, 390);
    bgGlow.addColorStop(0, 'rgba(255, 92, 168, 0.14)');
    bgGlow.addColorStop(0.55, 'rgba(255, 217, 130, 0.06)');
    bgGlow.addColorStop(1, 'rgba(20, 6, 26, 0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Column hover spotlight & floating preview token above the board
    if (!this.gameOver && this._canLocalPlayerMove()) {
      const col = this.hoverCol;
      const isColOpen = this.board[0] && this.board[0][col] === null;
      if (isColOpen) {
        const hx = cellCenterX(col);

        // Soft vertical champagne-rose column guide beam
        const beam = ctx.createLinearGradient(hx, 18, hx, BOARD_Y + BOARD_H);
        beam.addColorStop(0, this.turn === 'red' ? 'rgba(255, 133, 196, 0.22)' : 'rgba(140, 194, 255, 0.22)');
        beam.addColorStop(1, 'rgba(255, 217, 130, 0.03)');
        ctx.fillStyle = beam;
        drawRoundedRect(ctx, hx - CELL_W * 0.44, 22, CELL_W * 0.88, BOARD_H + 76, 16);
        ctx.fill();

        // Bobbing preview disc
        const bobY = 50 + Math.sin(this.elapsed * 5.2) * 5;
        this._drawBunnyDisc(ctx, hx, bobY, DISC_R * 0.96, this.turn, 0.96);

        // Cute champagne chevron below preview disc
        ctx.fillStyle = 'rgba(255, 217, 130, 0.85)';
        ctx.beginPath();
        ctx.moveTo(hx - 8, 91);
        ctx.lineTo(hx + 8, 91);
        ctx.lineTo(hx, 99);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 1) Board Backplate (deep plum velvet interior seen through empty slots)
    ctx.save();
    ctx.fillStyle = '#180720';
    drawRoundedRect(ctx, BOARD_X + 4, BOARD_Y + 4, BOARD_W - 8, BOARD_H - 8, 22);
    ctx.fill();
    ctx.restore();

    // 2) Draw all placed discs & currently falling disc BEHIND the velvet faceplate!
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const side = this.board[r][c];
        if (side) {
          this._drawBunnyDisc(ctx, cellCenterX(c), cellCenterY(r), DISC_R, side, 1);
        }
      }
    }

    if (this.activeDrop) {
      const d = this.activeDrop;
      this._drawBunnyDisc(ctx, cellCenterX(d.col), d.y, DISC_R, d.side, 1);
    }

    // 3) Luxury Velvet-Rose & Champagne-Gold Faceplate WITH real circular cutouts
    this._drawVelvetBoardFaceplate(ctx);

    // 4) Last-move golden landing ring pulse
    if (this.lastMove && !this.gameOver) {
      const lx = cellCenterX(this.lastMove.col);
      const ly = cellCenterY(this.lastMove.row);
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsed * 6);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 243, 201, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(lx, ly, DISC_R + 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5) Sparkling 4-in-a-row Golden Winning Highlight!
    if (this.winningCells.length >= 4) {
      this._drawWinningHighlight(ctx);
    }

    // 6) Particles / confetti
    this._drawParticles(ctx);
  }

  _drawVelvetBoardFaceplate(ctx) {
    ctx.save();

    // Decorative champagne-gold stand feet
    const footGrad = ctx.createLinearGradient(0, BOARD_Y + BOARD_H - 10, 0, BOARD_Y + BOARD_H + 24);
    footGrad.addColorStop(0, '#ffd982');
    footGrad.addColorStop(1, '#9f681d');
    ctx.fillStyle = footGrad;
    drawRoundedRect(ctx, BOARD_X - 10, BOARD_Y + BOARD_H - 18, 42, 34, 12);
    ctx.fill();
    drawRoundedRect(ctx, BOARD_X + BOARD_W - 32, BOARD_Y + BOARD_H - 18, 42, 34, 12);
    ctx.fill();

    // Drop shadow around board cabinet
    ctx.shadowColor = 'rgba(6, 1, 12, 0.65)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    // Even-odd clip path: outer cabinet minus 42 circular holes
    ctx.beginPath();
    const r = 24;
    ctx.moveTo(BOARD_X + r, BOARD_Y);
    ctx.arcTo(BOARD_X + BOARD_W, BOARD_Y, BOARD_X + BOARD_W, BOARD_Y + BOARD_H, r);
    ctx.arcTo(BOARD_X + BOARD_W, BOARD_Y + BOARD_H, BOARD_X, BOARD_Y + BOARD_H, r);
    ctx.arcTo(BOARD_X, BOARD_Y + BOARD_H, BOARD_X, BOARD_Y, r);
    ctx.arcTo(BOARD_X, BOARD_Y, BOARD_X + BOARD_W, BOARD_Y, r);
    ctx.closePath();

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = cellCenterX(col);
        const cy = cellCenterY(row);
        ctx.moveTo(cx + DISC_R, cy);
        ctx.arc(cx, cy, DISC_R, 0, Math.PI * 2, true);
      }
    }

    // Velvet-rose vertical gradient fill
    const velvet = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X, BOARD_Y + BOARD_H);
    velvet.addColorStop(0, '#6a1f4d');
    velvet.addColorStop(0.45, '#4b1439');
    velvet.addColorStop(1, '#2f0b27');
    ctx.fillStyle = velvet;
    ctx.fill('evenodd');

    // Subtle sheen highlight along top of velvet board
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip('evenodd');
    const sheen = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X, BOARD_Y + 120);
    sheen.addColorStop(0, 'rgba(255, 210, 232, 0.16)');
    sheen.addColorStop(1, 'rgba(255, 210, 232, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, 120);
    ctx.restore();

    // Champagne-gold beveled outer frame
    const goldFrame = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X + BOARD_W, BOARD_Y + BOARD_H);
    goldFrame.addColorStop(0, '#fff3c9');
    goldFrame.addColorStop(0.35, '#ffd982');
    goldFrame.addColorStop(0.7, '#d19236');
    goldFrame.addColorStop(1, '#ffe6a3');
    ctx.strokeStyle = goldFrame;
    ctx.lineWidth = 4.5;
    drawRoundedRect(ctx, BOARD_X + 2, BOARD_Y + 2, BOARD_W - 4, BOARD_H - 4, 22);
    ctx.stroke();

    // Chamfered champagne-gold rims around every 7×6 cutout hole
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = cellCenterX(col);
        const cy = cellCenterY(row);
        ctx.strokeStyle = 'rgba(255, 217, 130, 0.34)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, DISC_R + 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Engraved champagne-gold column numbers 1-7 along the bottom bevel
    ctx.font = '700 13px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let col = 0; col < COLS; col++) {
      const isHovered = col === this.hoverCol && !this.gameOver;
      ctx.fillStyle = isHovered ? '#fff3c9' : 'rgba(255, 217, 130, 0.62)';
      ctx.fillText(String(col + 1), cellCenterX(col), BOARD_Y + BOARD_H - 16);
    }

    // Tiny corner gold hearts
    ctx.fillStyle = '#ffd982';
    drawHeartPath(ctx, BOARD_X + 16, BOARD_Y + 15, 6);
    ctx.fill();
    drawHeartPath(ctx, BOARD_X + BOARD_W - 16, BOARD_Y + 15, 6);
    ctx.fill();

    ctx.restore();
  }

  _drawBunnyDisc(ctx, cx, cy, r, side, alpha = 1) {
    const isRed = side === 'red';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    // Glossy enamel body
    const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.12, 0, 0, r);
    if (isRed) {
      grad.addColorStop(0, '#ffc2e2');
      grad.addColorStop(0.45, '#ff5ca8');
      grad.addColorStop(1, '#a9135c');
    } else {
      grad.addColorStop(0, '#c2e0ff');
      grad.addColorStop(0.45, '#4b92ff');
      grad.addColorStop(1, '#1842a1');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner recessed ring
    ctx.strokeStyle = isRed ? 'rgba(255, 232, 244, 0.55)' : 'rgba(220, 240, 255, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // Glossy glass crescent highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.44, r * 0.48, r * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cute Bunny Emblem inside disc!
    if (isRed) {
      // Wifebun: Pink Heart-Bunny
      ctx.fillStyle = '#fff5fb';
      // Ears
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.34, r * 0.13, r * 0.3, -0.2, 0, Math.PI * 2);
      ctx.ellipse(r * 0.2, -r * 0.34, r * 0.13, r * 0.3, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Little satin bow
      ctx.fillStyle = '#ffd982';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Center pink heart on cheek/face
      ctx.fillStyle = '#ff3b93';
      drawHeartPath(ctx, 0, r * 0.12, r * 0.24);
      ctx.fill();
    } else {
      // Husbun: Blue Crown-Bunny
      ctx.fillStyle = '#f2f7ff';
      // Ears
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.32, r * 0.12, r * 0.28, -0.15, 0, Math.PI * 2);
      ctx.ellipse(r * 0.2, -r * 0.32, r * 0.12, r * 0.28, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.beginPath();
      ctx.arc(0, r * 0.12, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // Gold mini-crown between ears
      ctx.fillStyle = '#ffd982';
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.16);
      ctx.lineTo(-r * 0.18, -r * 0.4);
      ctx.lineTo(0, -r * 0.26);
      ctx.lineTo(r * 0.18, -r * 0.4);
      ctx.lineTo(r * 0.22, -r * 0.16);
      ctx.closePath();
      ctx.fill();
      // Charming eyes + smirk
      ctx.fillStyle = '#1b356e';
      ctx.beginPath();
      ctx.arc(-r * 0.13, r * 0.08, r * 0.055, 0, Math.PI * 2);
      ctx.arc(r * 0.13, r * 0.08, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1b356e';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, r * 0.16, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawWinningHighlight(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 9);
    const sorted = [...this.winningCells].sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    ctx.save();

    // Glowing golden connecting beam across the winning line
    ctx.strokeStyle = `rgba(255, 224, 130, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 10 + pulse * 4;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffd982';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(cellCenterX(first[1]), cellCenterY(first[0]));
    ctx.lineTo(cellCenterX(last[1]), cellCenterY(last[0]));
    ctx.stroke();

    // Radiant golden halo rings + orbiting sparkles on each winning cell
    for (let i = 0; i < this.winningCells.length; i++) {
      const [r, c] = this.winningCells[i];
      const cx = cellCenterX(c);
      const cy = cellCenterY(r);

      ctx.strokeStyle = '#fff6d6';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(cx, cy, DISC_R + 2 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting star glints
      const angle = this.elapsed * 3.2 + i * 1.4;
      const sx = cx + Math.cos(angle) * (DISC_R + 4);
      const sy = cy + Math.sin(angle) * (DISC_R + 4);
      ctx.fillStyle = '#fff9e6';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        drawHeartPath(ctx, 0, 0, p.size);
        ctx.fill();
      } else if (p.kind === 'confetti') {
        ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
