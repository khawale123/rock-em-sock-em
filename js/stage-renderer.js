/**
 * StageRenderer — Painterly Moonlit Parisian Riverfront Promenade
 * For "Wifebun ♥ Husbun — Beatdown Sesh"
 *
 * Pure ES module, zero external image dependencies.
 * High-DPI Canvas 2D procedural illustration using cached 2x offscreen art layers
 * (moon, Parisian Mansard skyline, lattice Eiffel Tower, arched Seine bridge,
 * painterly multi-tone sakura bough clusters, ornate streetlamps, bokeh glow sprites)
 * combined with 60fps real-time atmospheric animation.
 */

// Deterministic PRNG for reproducible hand-crafted composition
function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeOffscreen(w, h, scale = 2) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  return { canvas: c, ctx, w, h, scale };
}

function traceHeartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.36);
  ctx.bezierCurveTo(
    x - size * 1.05, y - size * 0.28,
    x - size * 0.62, y - size * 1.04,
    x, y - size * 0.34
  );
  ctx.bezierCurveTo(
    x + size * 0.62, y - size * 1.04,
    x + size * 1.05, y - size * 0.28,
    x, y + size * 0.36
  );
  ctx.closePath();
}

function traceSakuraPetal(ctx, r) {
  // Authentic notched cherry-blossom petal silhouette
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 0.72, r * 0.45, -r * 0.88, -r * 0.52, -r * 0.26, -r * 0.98);
  ctx.quadraticCurveTo(0, -r * 0.62, 0, -r * 0.56);
  ctx.quadraticCurveTo(0, -r * 0.62, r * 0.26, -r * 0.98);
  ctx.bezierCurveTo(r * 0.88, -r * 0.52, r * 0.72, r * 0.45, 0, r * 0.95);
  ctx.closePath();
}

export class StageRenderer {
  constructor(W = 960, H = 540, STAGE_W = 1480, GROUND_Y = 446) {
    this.W = W;
    this.H = H;
    this.STAGE_W = STAGE_W;
    this.GROUND_Y = GROUND_Y;
    this._time = 0;

    // Key landmark layout constants
    this.horizonY = Math.round(H * 0.588); // ~318 for H=540
    this.eiffelX = Math.round(W * 0.49);   // ~470 in far panoramic coords
    this.eiffelBaseY = this.horizonY;
    this.eiffelTopY = Math.round(H * 0.215); // ~116
    this.moonBaseX = Math.round(W * 0.665);
    this.moonY = Math.round(H * 0.172);    // ~93

    // World-space architectural positions
    this.lampPositions = [95, 415, 740, 1065, 1385];
    this.treeDefs = this._buildTreeDefs();
    this.bgTreeDefs = this._buildBgTreeDefs();
    this.roseClusters = this._buildRoseClusters();
    this.fallenPetals = this._buildFallenPetals();

    // Animated entities
    this.stars = this._initStars();
    this.clouds = this._initClouds();
    this.waterRipples = this._initWaterRipples();
    this.fireflies = this._initFireflies();
    this.petals = this._initPetals();
    this.floatingHearts = this._initFloatingHearts();
    this.eiffelSparkles = this._initEiffelSparkles();
    this.shootingStar = { active: false, timer: 5.5, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0.75 };

    // Cached 2x High-DPI painterly offscreen sprites
    this._glowSprites = this._buildGlowSprites();
    this._moonSprite = this._buildMoonSprite();
    this._cloudSprites = this._buildCloudSprites();
    this._skylineCache = this._buildSkylineCache();
    this._sakuraSprites = this._buildSakuraClusterSprites();
    this._lampSprite = this._buildLampPostSprite();
  }

  // ============================================================
  // INITIALIZATION — PARTICLES & WORLD LAYOUT
  // ============================================================
  _initStars() {
    const rng = createRng(104729);
    const stars = [];
    const colors = [
      [255, 244, 214], // warm champagne
      [255, 218, 240], // rose-white
      [226, 238, 255], // pale moonlight blue
      [255, 255, 255], // pure pearl
    ];
    for (let i = 0; i < 88; i++) {
      const yBias = Math.pow(rng(), 1.35);
      stars.push({
        x: rng() * (this.W + 180) - 90,
        y: 10 + yBias * (this.horizonY - 82),
        r: i < 12 ? 1.8 + rng() * 1.1 : 0.7 + rng() * 1.1,
        isHero: i < 12,
        phase: rng() * Math.PI * 2,
        speed: 1.4 + rng() * 2.8,
        rgb: colors[Math.floor(rng() * colors.length)],
      });
    }
    return stars;
  }

  _initClouds() {
    const rng = createRng(22913);
    const list = [];
    const span = this.W + 520;
    for (let i = 0; i < 9; i++) {
      const layer = i < 4 ? 0 : 1; // 0 = high wispy, 1 = fuller backlit cumulus
      list.push({
        x: (i / 9) * span - 240 + (rng() - 0.5) * 90,
        y: layer === 0 ? 52 + rng() * 92 : 122 + rng() * 112,
        scaleX: layer === 0 ? 0.9 + rng() * 0.65 : 0.8 + rng() * 0.6,
        scaleY: layer === 0 ? 0.65 + rng() * 0.35 : 0.72 + rng() * 0.35,
        speed: layer === 0 ? 4.5 + rng() * 4.0 : 8.0 + rng() * 6.5,
        alpha: layer === 0 ? 0.42 + rng() * 0.22 : 0.56 + rng() * 0.24,
        spriteIdx: i % 3,
        layer,
        parallax: layer === 0 ? 0.045 : 0.085,
      });
    }
    return list;
  }

  _initWaterRipples() {
    const rng = createRng(88421);
    const list = [];
    for (let i = 0; i < 42; i++) {
      const depth = i / 42; // 0 = near far bank, 1 = near promenade
      list.push({
        x: rng() * (this.W + 560) - 280,
        depth,
        width: 18 + depth * 64 + rng() * 34,
        speed: (rng() < 0.5 ? -1 : 1) * (5 + rng() * 11),
        phase: rng() * Math.PI * 2,
        alpha: 0.14 + (1 - depth * 0.5) * 0.26,
        warm: rng() < 0.48,
      });
    }
    return list;
  }

  _initFireflies() {
    const rng = createRng(55109);
    const list = [];
    for (let i = 0; i < 36; i++) {
      list.push({
        baseX: rng() * this.STAGE_W,
        baseY: 130 + rng() * (this.GROUND_Y - 155),
        x: 0,
        y: 0,
        ampX: 16 + rng() * 34,
        ampY: 10 + rng() * 24,
        freqX: 0.45 + rng() * 0.75,
        freqY: 0.55 + rng() * 0.85,
        phase: rng() * Math.PI * 2,
        pulseSpeed: 1.8 + rng() * 2.8,
        r: 1.8 + rng() * 2.1,
        tint: rng() < 0.76 ? 'gold' : 'rose',
      });
    }
    return list;
  }

  _initPetals() {
    const rng = createRng(77123);
    const palettes = [
      { top: '#ffe4f2', bottom: '#e067a2' },
      { top: '#ffc2e2', bottom: '#c44586' },
      { top: '#ffd8ec', bottom: '#f082b8' },
      { top: '#fff0f7', bottom: '#e896be' },
      { top: '#ffe7b3', bottom: '#f2a8c2' }, // subtle champagne-blush
    ];
    const list = [];
    for (let i = 0; i < 46; i++) {
      const tier = i < 16 ? 0 : i < 38 ? 1 : 2; // 0 = delicate far, 1 = crisp mid, 2 = bokeh lens foreground
      const pal = palettes[Math.floor(rng() * palettes.length)];
      list.push({
        x: rng() * (this.W + 140) - 70,
        y: rng() * (this.H + 80) - 40,
        vx: -(14 + tier * 14 + rng() * 22),
        vy: 13 + tier * 10 + rng() * 20,
        swayAmp: 12 + rng() * 26,
        swayFreq: 0.9 + rng() * 1.4,
        size: tier === 0 ? 3.2 + rng() * 2.0 : tier === 1 ? 5.2 + rng() * 3.2 : 11 + rng() * 7,
        rot: rng() * Math.PI * 2,
        rotSpeed: (rng() - 0.5) * 2.6,
        flip: rng() * Math.PI * 2,
        flipSpeed: 2.2 + rng() * 3.4,
        phase: rng() * Math.PI * 2,
        tier,
        isHeart: tier === 2 ? i % 3 === 0 : i % 9 === 0,
        topColor: pal.top,
        bottomColor: pal.bottom,
      });
    }
    return list;
  }

  _initFloatingHearts() {
    const rng = createRng(99317);
    const list = [];
    for (let i = 0; i < 14; i++) {
      list.push({
        x: rng() * this.W,
        y: rng() * this.H,
        vy: -(10 + rng() * 16),
        vx: (rng() - 0.5) * 10,
        size: 5 + rng() * 7.5,
        phase: rng() * Math.PI * 2,
        swayAmp: 10 + rng() * 18,
        alpha: 0.14 + rng() * 0.24,
        warm: rng() < 0.35,
      });
    }
    return list;
  }

  _initEiffelSparkles() {
    const rng = createRng(31415);
    const list = [];
    for (let i = 0; i < 24; i++) {
      const t = 0.08 + rng() * 0.84; // normalized height along tower (0 = top, 1 = base)
      const halfW = 2 + Math.pow(t, 1.85) * 34;
      list.push({
        t,
        nx: (rng() * 2 - 1) * halfW,
        phase: rng() * Math.PI * 2,
        speed: 3.5 + rng() * 5.0,
      });
    }
    return list;
  }

  _buildTreeDefs() {
    // 4 hero sakura trees framing the promenade with asymmetric artistic silhouettes
    const configs = [
      { x: 168, scale: 1.06, lean: 14, seed: 11, swayPhase: 0.0 },
      { x: 515, scale: 0.94, lean: -12, seed: 23, swayPhase: 1.5 },
      { x: 965, scale: 0.96, lean: 11, seed: 37, swayPhase: 2.9 },
      { x: 1312, scale: 1.08, lean: -15, seed: 53, swayPhase: 4.3 },
    ];
    return configs.map((cfg) => {
      const rng = createRng(cfg.seed * 997);
      const s = cfg.scale;
      // Layered canopy cluster attachments: back shadow, mid blossom, bright moonlit top
      const clusters = [
        // Back deep-shadow tier
        { ox: -102 * s, oy: -214 * s, sc: 0.92 * s, sprite: 0, tier: 0, phase: rng() * 6 },
        { ox: 96 * s, oy: -222 * s, sc: 0.95 * s, sprite: 1, tier: 0, phase: rng() * 6 },
        { ox: -12 * s, oy: -252 * s, sc: 1.12 * s, sprite: 0, tier: 0, phase: rng() * 6 },
        // Mid vibrant sakura tier
        { ox: -138 * s, oy: -196 * s, sc: 0.78 * s, sprite: 2, tier: 1, phase: rng() * 6 },
        { ox: -64 * s, oy: -236 * s, sc: 0.94 * s, sprite: 3, tier: 1, phase: rng() * 6 },
        { ox: 48 * s, oy: -242 * s, sc: 0.98 * s, sprite: 2, tier: 1, phase: rng() * 6 },
        { ox: 134 * s, oy: -206 * s, sc: 0.80 * s, sprite: 3, tier: 1, phase: rng() * 6 },
        { ox: -6 * s, oy: -278 * s, sc: 0.96 * s, sprite: 4, tier: 1, phase: rng() * 6 },
        // Front moonlit crest highlight tier
        { ox: -88 * s, oy: -226 * s, sc: 0.74 * s, sprite: 4, tier: 2, phase: rng() * 6 },
        { ox: 18 * s, oy: -286 * s, sc: 0.84 * s, sprite: 4, tier: 2, phase: rng() * 6 },
        { ox: 82 * s, oy: -236 * s, sc: 0.76 * s, sprite: 4, tier: 2, phase: rng() * 6 },
        // Delicate drooping blossom boughs
        { ox: -124 * s, oy: -168 * s, sc: 0.52 * s, sprite: 3, tier: 2, phase: rng() * 6 },
        { ox: 118 * s, oy: -176 * s, sc: 0.54 * s, sprite: 2, tier: 2, phase: rng() * 6 },
      ];
      return { ...cfg, clusters };
    });
  }

  _buildBgTreeDefs() {
    // Softer atmospheric sakura crowns behind the balustrade for extra stage depth
    return [
      { x: -18, y: this.GROUND_Y - 142, rx: 95, ry: 58, phase: 0.4 },
      { x: 342, y: this.GROUND_Y - 126, rx: 82, ry: 48, phase: 1.9 },
      { x: 1138, y: this.GROUND_Y - 128, rx: 84, ry: 50, phase: 3.1 },
      { x: 1498, y: this.GROUND_Y - 144, rx: 96, ry: 58, phase: 4.7 },
    ];
  }

  _buildRoseClusters() {
    const rng = createRng(40219);
    const clusters = [];
    // Climbing rose vines along balustrade bays and near lamp bases
    for (let x = -40; x <= this.STAGE_W + 60; x += 128) {
      const hasVine = rng() < 0.82;
      if (!hasVine) continue;
      const offsetX = x + (rng() - 0.5) * 44;
      const roses = [];
      const count = 3 + Math.floor(rng() * 4);
      for (let r = 0; r < count; r++) {
        roses.push({
          dx: (rng() - 0.5) * 58,
          dy: -54 + rng() * 36,
          size: 4.5 + rng() * 3.8,
          hue: rng() < 0.45 ? 'crimson' : rng() < 0.78 ? 'rose' : 'blush',
          rot: rng() * Math.PI * 2,
        });
      }
      const leaves = [];
      for (let l = 0; l < count * 2 + 2; l++) {
        leaves.push({
          dx: (rng() - 0.5) * 68,
          dy: -56 + rng() * 40,
          angle: (rng() - 0.5) * Math.PI,
          len: 7 + rng() * 6,
        });
      }
      clusters.push({ x: offsetX, roses, leaves });
    }
    return clusters;
  }

  _buildFallenPetals() {
    const rng = createRng(61832);
    const colors = ['#ffb3d9', '#ff7eb8', '#ffd8ec', '#e85b9a', '#ffe3b8'];
    const list = [];
    for (let i = 0; i < 72; i++) {
      // Cluster slightly more near the curb and under the 4 sakura trees
      const underTree = rng() < 0.55;
      const tree = this.treeDefs[Math.floor(rng() * this.treeDefs.length)];
      const x = underTree
        ? tree.x + (rng() - 0.5) * 250
        : -60 + rng() * (this.STAGE_W + 120);
      const yOff = Math.pow(rng(), 1.2) * 86 + 5;
      list.push({
        x,
        y: this.GROUND_Y + yOff,
        rx: 2.6 + (yOff / 90) * 3.4 + rng() * 1.8,
        ry: 1.1 + (yOff / 90) * 1.3 + rng() * 0.7,
        rot: (rng() - 0.5) * 0.9,
        color: colors[Math.floor(rng() * colors.length)],
        alpha: 0.42 + rng() * 0.36,
      });
    }
    return list;
  }

  // ============================================================
  // OFFSCREEN CACHED PAINTERLY SPRITES (CRISP 2x HIGH-DPI)
  // ============================================================
  _buildGlowSprites() {
    const makeGlow = (inner, mid, outer) => {
      const size = 64;
      const buf = makeOffscreen(size, size, 2);
      if (!buf) return null;
      const { ctx } = buf;
      const c = size * 0.5;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, inner);
      g.addColorStop(0.28, mid);
      g.addColorStop(0.65, outer);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return buf.canvas;
    };

    return {
      gold: makeGlow('rgba(255, 250, 224, 1)', 'rgba(255, 214, 130, 0.58)', 'rgba(255, 165, 95, 0.14)'),
      rose: makeGlow('rgba(255, 232, 246, 1)', 'rgba(255, 128, 196, 0.56)', 'rgba(235, 65, 155, 0.14)'),
      pearl: makeGlow('rgba(255, 255, 255, 1)', 'rgba(255, 236, 220, 0.52)', 'rgba(255, 195, 220, 0.10)'),
      amber: makeGlow('rgba(255, 245, 200, 0.95)', 'rgba(255, 192, 110, 0.42)', 'rgba(255, 130, 145, 0.08)'),
    };
  }

  _buildMoonSprite() {
    const size = 128;
    const buf = makeOffscreen(size, size, 2);
    if (!buf) return null;
    const { ctx } = buf;
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = 40;

    // Soft immediate corona around lunar disk
    const corona = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.52);
    corona.addColorStop(0, 'rgba(255, 248, 228, 0.65)');
    corona.addColorStop(0.55, 'rgba(255, 210, 205, 0.18)');
    corona.addColorStop(1, 'rgba(255, 175, 200, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.52, 0, Math.PI * 2);
    ctx.fill();

    // Clipped lunar surface with painterly shading and craters
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const diskGrad = ctx.createRadialGradient(cx - 10, cy - 11, 4, cx + 4, cy + 5, r * 1.15);
    diskGrad.addColorStop(0, '#fffef7');
    diskGrad.addColorStop(0.42, '#fff5e2');
    diskGrad.addColorStop(0.76, '#f6decb');
    diskGrad.addColorStop(1, '#dba9b0');
    ctx.fillStyle = diskGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Soft lunar maria (seas) in painterly dusty rose-lavender
    const maria = [
      [-14, -10, 15, 11, -0.35, 0.22],
      [-4, -17, 11, 8, 0.2, 0.16],
      [11, -6, 13, 10, 0.45, 0.20],
      [15, 9, 12, 9, -0.25, 0.24],
      [-11, 13, 14, 8, 0.3, 0.18],
      [2, 5, 9, 7, 0.1, 0.13],
    ];
    for (const [mx, my, rx, ry, rot, a] of maria) {
      ctx.save();
      ctx.translate(cx + mx, cy + my);
      ctx.rotate(rot);
      const mg = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.max(rx, ry));
      mg.addColorStop(0, `rgba(178, 136, 154, ${a})`);
      mg.addColorStop(0.7, `rgba(198, 158, 168, ${a * 0.55})`);
      mg.addColorStop(1, 'rgba(198, 158, 168, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Subtle crater rings with delicate lit rims
    const craters = [
      [-17, 4, 5.2], [9, -15, 4.1], [17, 13, 4.8], [-3, 19, 3.6], [6, 11, 3.2], [-9, -19, 3.0],
    ];
    for (const [kx, ky, kr] of craters) {
      ctx.fillStyle = 'rgba(164, 124, 144, 0.16)';
      ctx.beginPath();
      ctx.arc(cx + kx, cy + ky, kr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.35)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(cx + kx - 0.6, cy + ky - 0.6, kr, Math.PI * 0.85, Math.PI * 1.85);
      ctx.stroke();
    }

    // Luminous rim light along top-left crescent
    ctx.strokeStyle = 'rgba(255, 254, 248, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.8, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();

    ctx.restore();
    return { canvas: buf.canvas, size, r };
  }

  _buildCloudSprites() {
    // 3 distinct painterly twilight nebula / backlit cumulus cloud stamps
    const variants = [];
    for (let v = 0; v < 3; v++) {
      const w = 320;
      const h = 110;
      const buf = makeOffscreen(w, h, 2);
      if (!buf) return [];
      const { ctx } = buf;
      const rng = createRng(9011 + v * 1777);

      // Soft ambient rose-plum nebula mist base
      const mist = ctx.createRadialGradient(w * 0.5, h * 0.56, 12, w * 0.5, h * 0.56, w * 0.46);
      mist.addColorStop(0, 'rgba(235, 130, 175, 0.24)');
      mist.addColorStop(0.55, 'rgba(165, 68, 128, 0.14)');
      mist.addColorStop(1, 'rgba(120, 40, 95, 0)');
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.56, w * 0.48, h * 0.40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Painted cumulus puffs: deep twilight plum body -> rose mid -> champagne sunset underside
      const puffCount = v === 0 ? 11 : 14;
      const puffs = [];
      for (let i = 0; i < puffCount; i++) {
        const t = i / (puffCount - 1);
        const arch = Math.sin(t * Math.PI);
        puffs.push({
          x: 54 + t * (w - 108) + (rng() - 0.5) * 26,
          y: h * 0.64 - arch * (22 + rng() * 24) + (rng() - 0.5) * 8,
          rx: 26 + arch * 30 + rng() * 14,
          ry: 13 + arch * 14 + rng() * 7,
        });
      }

      // Pass 1: twilight shadow body
      for (const p of puffs) {
        const g = ctx.createRadialGradient(p.x, p.y - p.ry * 0.2, 2, p.x, p.y, p.rx);
        g.addColorStop(0, 'rgba(84, 28, 78, 0.44)');
        g.addColorStop(0.7, 'rgba(66, 20, 68, 0.20)');
        g.addColorStop(1, 'rgba(66, 20, 68, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pass 2: sunlit/moonlit rose-gold rims along lower edge & top wisps
      for (const p of puffs) {
        const g2 = ctx.createRadialGradient(p.x + 4, p.y + p.ry * 0.42, 1, p.x, p.y + p.ry * 0.35, p.rx * 0.92);
        g2.addColorStop(0, 'rgba(255, 198, 178, 0.36)');
        g2.addColorStop(0.55, 'rgba(246, 134, 176, 0.16)');
        g2.addColorStop(1, 'rgba(246, 134, 176, 0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.ry * 0.28, p.rx * 0.92, p.ry * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      variants.push({ canvas: buf.canvas, w, h });
    }
    return variants;
  }

  _buildSkylineCache() {
    // Wide panoramic layer covering parallax shift seamlessly: x in [-320 .. W + 320]
    const padX = 320;
    const totalW = this.W + padX * 2;
    const totalH = this.horizonY + 46;
    const buf = makeOffscreen(totalW, totalH, 2);
    if (!buf) return null;
    const { ctx } = buf;
    const rng = createRng(188905); // 1889 Eiffel Tower year!

    ctx.save();
    ctx.translate(padX, 0);

    const baseY = this.horizonY;

    // 1. Far misty Parisian horizon domes & silhouettes (atmospheric mauve-plum)
    ctx.fillStyle = 'rgba(54, 18, 56, 0.72)';
    const farSilhouettes = [
      [-280, 48, 74], [-200, 62, 68], [-125, 52, 80], [-40, 70, 66], [35, 56, 75],
      [125, 64, 72], [210, 46, 84], [305, 34, 62], [585, 38, 66], [665, 62, 74],
      [750, 74, 64], [830, 56, 72], [915, 66, 70], [1005, 52, 76], [1095, 64, 70],
    ];
    for (const [bx, bh, bw] of farSilhouettes) {
      ctx.fillRect(bx, baseY - bh, bw, bh + 4);
    }
    // Distant Panthéon / Invalides-style romantic domes on left & right horizon
    this._drawDistantDome(ctx, 248, baseY - 46, 26, 32, 'rgba(60, 20, 62, 0.78)');
    this._drawDistantDome(ctx, 738, baseY - 58, 22, 28, 'rgba(60, 20, 62, 0.78)');

    // 2. Detailed Lattice Eiffel Tower (center hero landmark)
    this._drawDetailedEiffelTower(ctx, this.eiffelX, baseY, this.eiffelTopY);

    // 3. Mid-far classic Parisian Haussmann / Mansard buildings flanking the Eiffel Tower
    const buildings = [
      // Left bank skyline
      { x: -305, w: 66, h: 78, roof: 'mansard' },
      { x: -242, w: 60, h: 98, roof: 'mansard' },
      { x: -186, w: 54, h: 72, roof: 'gable' },
      { x: -135, w: 68, h: 112, roof: 'mansard', cupola: true },
      { x: -70, w: 58, h: 86, roof: 'mansard' },
      { x: -16, w: 64, h: 106, roof: 'mansard' },
      { x: 45, w: 56, h: 80, roof: 'mansard' },
      { x: 98, w: 66, h: 96, roof: 'mansard', cupola: true },
      { x: 162, w: 58, h: 74, roof: 'mansard' },
      { x: 218, w: 52, h: 58, roof: 'mansard' },
      // Right bank skyline (clear opening around Eiffel Tower ~285..615)
      { x: 625, w: 54, h: 66, roof: 'mansard' },
      { x: 676, w: 64, h: 92, roof: 'mansard', cupola: true },
      { x: 738, w: 62, h: 116, roof: 'mansard' },
      { x: 798, w: 56, h: 82, roof: 'mansard' },
      { x: 852, w: 66, h: 104, roof: 'mansard' },
      { x: 915, w: 58, h: 76, roof: 'gable' },
      { x: 970, w: 68, h: 100, roof: 'mansard', cupola: true },
      { x: 1035, w: 60, h: 86, roof: 'mansard' },
      { x: 1092, w: 66, h: 94, roof: 'mansard' },
      { x: 1155, w: 72, h: 78, roof: 'mansard' },
    ];

    for (const b of buildings) {
      this._drawMansardBuilding(ctx, b.x, baseY, b.w, b.h, b.roof, Boolean(b.cupola), rng);
    }

    // 4. Riverside poplar / chestnut tree silhouettes along the far Seine embankment
    ctx.fillStyle = '#1b0722';
    for (let tx = -280; tx <= this.W + 280; tx += 22) {
      const nearEiffel = Math.abs(tx - this.eiffelX) < 150;
      const tr = nearEiffel ? 11 + rng() * 11 : 8 + rng() * 9;
      const ty = baseY - 2 - rng() * 6;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, Math.PI, 0);
      ctx.fill();
    }

    // 5. Arched Parisian Stone River Bridge (Pont Alexandre III / Pont Neuf style)
    const bridgeLamps = this._drawParisianBridge(ctx, -310, this.W + 310, baseY - 4);

    ctx.restore();
    return { canvas: buf.canvas, padX, totalW, totalH, bridgeLamps };
  }

  _drawDistantDome(ctx, cx, baseY, r, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(cx - r * 0.9, baseY - h * 0.45, r * 1.8, h * 0.55);
    ctx.beginPath();
    ctx.arc(cx, baseY - h * 0.42, r * 0.82, Math.PI, 0);
    ctx.fill();
    // Lantern cupola + spire
    ctx.fillRect(cx - 4, baseY - h * 0.42 - r * 0.82 - 8, 8, 9);
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h * 0.42 - r * 0.82 - 20);
    ctx.lineTo(cx - 2.5, baseY - h * 0.42 - r * 0.82 - 8);
    ctx.lineTo(cx + 2.5, baseY - h * 0.42 - r * 0.82 - 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawDetailedEiffelTower(ctx, cx, baseY, topY) {
    const H = baseY - topY;
    const deck1Y = baseY - H * 0.24;
    const deck2Y = baseY - H * 0.49;
    const deck3Y = topY + H * 0.10;
    const halfBase = 48;

    // Parabolic outer profile helper: t in [0..1] from topY to baseY
    const outerHalfW = (y) => {
      const t = Math.max(0, Math.min(1, (y - topY) / H));
      return 3.2 + Math.pow(t, 2.08) * (halfBase - 3.2);
    };
    const innerHalfW = (y) => {
      const t = Math.max(0, Math.min(1, (y - topY) / H));
      if (t < 0.46) return 0;
      return Math.pow((t - 0.44) / 0.56, 1.55) * (halfBase * 0.60);
    };

    ctx.save();

    // Soft atmospheric twilight silhouette rim behind tower
    const towerGrad = ctx.createLinearGradient(cx - 32, topY, cx + 38, baseY);
    towerGrad.addColorStop(0, '#3a1438');
    towerGrad.addColorStop(0.55, '#250a29');
    towerGrad.addColorStop(1, '#19061f');

    // Outer left & right structural ribs (sweeping legs)
    ctx.strokeStyle = '#1d0723';
    ctx.lineCap = 'round';

    const drawLegSilhouette = (side) => {
      ctx.beginPath();
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const y = topY + (H * i) / steps;
        const x = cx + side * outerHalfW(y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = steps; i >= 0; i--) {
        const y = topY + (H * i) / steps;
        const iw = innerHalfW(y);
        const ow = outerHalfW(y);
        const x = cx + side * (iw > 0 ? iw : Math.max(0.8, ow * 0.28));
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = towerGrad;
      ctx.fill();
    };

    drawLegSilhouette(-1);
    drawLegSilhouette(1);

    // Criss-cross iron lattice work inside the upper shaft & legs
    ctx.strokeStyle = '#290c2e';
    ctx.lineWidth = 1.3;
    const latticeBands = 18;
    for (let i = 1; i < latticeBands; i++) {
      const y0 = topY + 14 + ((H - 22) * (i - 1)) / latticeBands;
      const y1 = topY + 14 + ((H - 22) * i) / latticeBands;
      const ow0 = outerHalfW(y0);
      const ow1 = outerHalfW(y1);
      const iw0 = innerHalfW(y0);
      const iw1 = innerHalfW(y1);

      if (iw0 < 2) {
        // Upper shaft X-bracing across full width
        ctx.beginPath();
        ctx.moveTo(cx - ow0, y0); ctx.lineTo(cx + ow1, y1);
        ctx.moveTo(cx + ow0, y0); ctx.lineTo(cx - ow1, y1);
        ctx.moveTo(cx - ow1, y1); ctx.lineTo(cx + ow1, y1);
        ctx.stroke();
      } else {
        // Lower legs X-bracing on left and right legs separately
        ctx.beginPath();
        ctx.moveTo(cx - ow0, y0); ctx.lineTo(cx - iw1, y1);
        ctx.moveTo(cx - iw0, y0); ctx.lineTo(cx - ow1, y1);
        ctx.moveTo(cx + ow0, y0); ctx.lineTo(cx + iw1, y1);
        ctx.moveTo(cx + iw0, y0); ctx.lineTo(cx + ow1, y1);
        ctx.stroke();
      }
    }

    // Ornate lower decorative arch between the legs
    ctx.strokeStyle = '#1b0722';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.arc(cx, baseY + 6, halfBase * 0.62, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 200, 175, 0.22)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, baseY + 4, halfBase * 0.62, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

    // Three classic observation decks with subtle warm golden railings
    const decks = [
      { y: deck1Y, hw: outerHalfW(deck1Y) + 4, h: 6.5 },
      { y: deck2Y, hw: outerHalfW(deck2Y) + 3.5, h: 5.5 },
      { y: deck3Y, hw: outerHalfW(deck3Y) + 3.5, h: 5.0 },
    ];
    for (const d of decks) {
      ctx.fillStyle = '#19051f';
      ctx.fillRect(cx - d.hw, d.y - d.h * 0.5, d.hw * 2, d.h);
      // Warm champagne deck trim & tiny lit gallery dots
      ctx.fillStyle = 'rgba(255, 222, 155, 0.52)';
      ctx.fillRect(cx - d.hw + 1, d.y - 0.8, d.hw * 2 - 2, 1.5);
    }

    // Summit cupola & needle spire
    ctx.fillStyle = '#1c0622';
    ctx.beginPath();
    ctx.moveTo(cx - 4.2, deck3Y - 2);
    ctx.lineTo(cx - 2.2, topY + 6);
    ctx.lineTo(cx + 2.2, topY + 6);
    ctx.lineTo(cx + 4.2, deck3Y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a0d30';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, topY + 6);
    ctx.lineTo(cx, topY - 12);
    ctx.stroke();

    // Delicate moonlight rim highlight along the moon-facing right edge
    ctx.strokeStyle = 'rgba(255, 212, 224, 0.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const y = topY + (H * i) / 22;
      const x = cx + outerHalfW(y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  _drawMansardBuilding(ctx, x, baseY, w, h, roofType, hasCupola, rng) {
    const topY = baseY - h;

    // Building facade with subtle twilight vertical gradient
    const bGrad = ctx.createLinearGradient(x, topY, x, baseY);
    bGrad.addColorStop(0, '#2a0e32');
    bGrad.addColorStop(0.55, '#1e0825');
    bGrad.addColorStop(1, '#14041a');
    ctx.fillStyle = bGrad;
    ctx.fillRect(x, topY, w, h + 4);

    // Subtle moonlit edge highlight on right facade edge
    ctx.fillStyle = 'rgba(255, 192, 218, 0.11)';
    ctx.fillRect(x + w - 2.5, topY, 2.5, h);

    // Classic Parisian Mansard sloped zinc roof
    ctx.fillStyle = '#190621';
    if (roofType === 'mansard') {
      const rh = 13 + rng() * 5;
      ctx.beginPath();
      ctx.moveTo(x - 3, topY);
      ctx.lineTo(x + 7, topY - rh);
      ctx.lineTo(x + w - 7, topY - rh);
      ctx.lineTo(x + w + 3, topY);
      ctx.closePath();
      ctx.fill();

      // Moonlit zinc roof ridge sheen
      ctx.strokeStyle = 'rgba(255, 206, 225, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 7, topY - rh);
      ctx.lineTo(x + w - 7, topY - rh);
      ctx.stroke();

      // Dormer windows tucked in the mansard roof
      const dormers = Math.max(2, Math.floor(w / 22));
      for (let d = 0; d < dormers; d++) {
        const dx = x + 10 + ((w - 20) * (d + 0.5)) / dormers;
        ctx.fillStyle = '#220a2a';
        ctx.fillRect(dx - 3.5, topY - rh * 0.72, 7, rh * 0.72);
        if (rng() < 0.65) {
          ctx.fillStyle = 'rgba(255, 214, 138, 0.62)';
          ctx.fillRect(dx - 2, topY - rh * 0.56, 4, rh * 0.42);
        }
      }

      // Parisian chimney stacks
      const chimX = x + 12 + rng() * (w - 26);
      ctx.fillStyle = '#17051d';
      ctx.fillRect(chimX, topY - rh - 8, 7, 9);
      ctx.fillRect(chimX + 1, topY - rh - 11, 2, 3);
      ctx.fillRect(chimX + 4, topY - rh - 11, 2, 3);

      // Optional romantic corner cupola dome
      if (hasCupola) {
        const cx = x + w * 0.5;
        ctx.fillStyle = '#1b0723';
        ctx.beginPath();
        ctx.arc(cx, topY - rh, 10, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, topY - rh - 20);
        ctx.lineTo(cx - 1.5, topY - rh - 9);
        ctx.lineTo(cx + 1.5, topY - rh - 9);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 2, topY);
      ctx.lineTo(x + w * 0.5, topY - 17);
      ctx.lineTo(x + w + 2, topY);
      ctx.closePath();
      ctx.fill();
    }

    // Horizontal stone cornice molding bands
    ctx.fillStyle = 'rgba(255, 185, 215, 0.09)';
    ctx.fillRect(x - 1, topY, w + 2, 2);
    ctx.fillRect(x, topY + Math.round(h * 0.42), w, 1.5);

    // Glowing Parisian apartment windows
    const cols = Math.max(3, Math.floor((w - 10) / 14));
    const colSpacing = (w - 14) / cols;
    for (let wy = topY + 10; wy < baseY - 12; wy += 14) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 7 + c * colSpacing + (colSpacing - 5.5) * 0.5;
        const litRoll = rng();
        if (litRoll < 0.62) {
          const warmHue = rng();
          const winCol = warmHue < 0.55
            ? 'rgba(255, 214, 132, 0.72)'
            : warmHue < 0.85
            ? 'rgba(255, 184, 118, 0.58)'
            : 'rgba(255, 165, 200, 0.52)';
          // Soft halo around lit window
          ctx.fillStyle = 'rgba(255, 198, 125, 0.15)';
          ctx.fillRect(wx - 1.8, wy - 1.8, 9.1, 11.6);
          // Warm pane
          ctx.fillStyle = winCol;
          ctx.fillRect(wx, wy, 5.5, 8);
          // Tiny dark muntin cross
          ctx.fillStyle = 'rgba(28, 8, 34, 0.45)';
          ctx.fillRect(wx + 2.4, wy, 0.7, 8);
        } else {
          // Dim twilight-reflected glass pane
          ctx.fillStyle = 'rgba(110, 56, 108, 0.25)';
          ctx.fillRect(wx, wy, 5.5, 8);
        }
      }
    }
  }

  _drawParisianBridge(ctx, startX, endX, deckY) {
    const lamps = [];
    const span = 152;

    ctx.save();
    // Solid bridge spandrel wall above arches
    const stoneGrad = ctx.createLinearGradient(0, deckY - 6, 0, deckY + 26);
    stoneGrad.addColorStop(0, '#3a173c');
    stoneGrad.addColorStop(0.45, '#250b29');
    stoneGrad.addColorStop(1, '#15041a');

    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.moveTo(startX, deckY);
    ctx.lineTo(endX, deckY);
    ctx.lineTo(endX, deckY + 26);

    // Carve graceful elliptical stone arches
    for (let x = endX; x >= startX; x -= span) {
      const archRight = x - 14;
      const archLeft = x - span + 14;
      const archMid = (archRight + archLeft) * 0.5;
      const archW = (archRight - archLeft) * 0.5;
      ctx.lineTo(archRight, deckY + 26);
      ctx.ellipse(archMid, deckY + 26, archW, 18, 0, 0, Math.PI, true);
      ctx.lineTo(archLeft, deckY + 26);
    }
    ctx.lineTo(startX, deckY + 26);
    ctx.closePath();
    ctx.fill();

    // Moonlit stone parapet cornice along top of bridge
    ctx.fillStyle = 'rgba(255, 200, 215, 0.26)';
    ctx.fillRect(startX, deckY - 2, endX - startX, 2.2);
    ctx.fillStyle = '#1f0824';
    ctx.fillRect(startX, deckY - 6, endX - startX, 4);

    // Bridge piers, keystone accents, and golden candelabra lamp posts
    for (let x = startX; x <= endX; x += span) {
      // Stone pier buttress
      ctx.fillStyle = '#200825';
      ctx.fillRect(x - 10, deckY - 4, 20, 32);
      ctx.fillStyle = 'rgba(255, 198, 218, 0.16)';
      ctx.fillRect(x + 7, deckY - 4, 3, 30);

      // Ornate double-globe bridge candelabra post
      ctx.fillStyle = '#18051d';
      ctx.fillRect(x - 1.4, deckY - 20, 2.8, 16);
      ctx.fillRect(x - 5.5, deckY - 17, 11, 1.5);
      lamps.push({ x: x - 4.5, y: deckY - 19 });
      lamps.push({ x: x + 4.5, y: deckY - 19 });
    }

    ctx.restore();
    return lamps;
  }

  _buildSakuraClusterSprites() {
    // 5 richly illustrated, painterly sakura blossom cluster stamps (NO flat plain circles!)
    // Built from watercolor shadow washes, layered brushstroke tufts, and dozens of individual 5-petal blossoms.
    const specs = [
      { seed: 301, tone: 'deep', w: 184, h: 124 },
      { seed: 409, tone: 'deep', w: 192, h: 128 },
      { seed: 521, tone: 'mid', w: 178, h: 120 },
      { seed: 631, tone: 'mid', w: 186, h: 122 },
      { seed: 743, tone: 'bright', w: 170, h: 112 },
    ];

    const sprites = [];
    for (const sp of specs) {
      const buf = makeOffscreen(sp.w, sp.h, 2);
      if (!buf) return [];
      const { ctx } = buf;
      const rng = createRng(sp.seed * 733);
      const cx = sp.w * 0.5;
      const cy = sp.h * 0.52;

      const palettes = {
        deep: {
          shadow: '#52123d',
          mid: '#87225c',
          petal: '#b83c7e',
          hi: '#eb7eb8',
          rim: '#ffd1ea',
        },
        mid: {
          shadow: '#6b194c',
          mid: '#b03276',
          petal: '#e663a5',
          hi: '#ffa3d0',
          rim: '#ffe4f2',
        },
        bright: {
          shadow: '#8a2561',
          mid: '#d64f95',
          petal: '#ff8cc5',
          hi: '#ffc7e3',
          rim: '#fff4fa',
        },
      };
      const pal = palettes[sp.tone];

      // 1. Soft painterly base canopy silhouette (organic overlapping soft-edged clouds)
      const lobes = 15;
      for (let i = 0; i < lobes; i++) {
        const a = (i / lobes) * Math.PI * 2 + rng() * 0.4;
        const dist = (0.14 + rng() * 0.42) * (sp.w * 0.42);
        const lx = cx + Math.cos(a) * dist;
        const ly = cy + Math.sin(a) * dist * 0.62 + 6;
        const lr = 20 + rng() * 20;
        const g = ctx.createRadialGradient(lx, ly - lr * 0.25, 2, lx, ly, lr);
        g.addColorStop(0, pal.shadow);
        g.addColorStop(0.75, pal.shadow);
        g.addColorStop(1, 'rgba(82, 18, 61, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr * 1.15, lr * 0.84, (rng() - 0.5) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Subtle dark twig veins peeking inside lower cluster
      ctx.strokeStyle = 'rgba(42, 12, 30, 0.55)';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      for (let t = 0; t < 4; t++) {
        ctx.beginPath();
        ctx.moveTo(cx + (rng() - 0.5) * 32, cy + 28);
        ctx.quadraticCurveTo(
          cx + (rng() - 0.5) * 60, cy + (rng() - 0.5) * 20,
          cx + (rng() - 0.5) * 95, cy - 10 + (rng() - 0.5) * 32
        );
        ctx.stroke();
      }

      // 3. Mid-tone directional painterly foliage brushstrokes
      for (let i = 0; i < 42; i++) {
        const a = rng() * Math.PI * 2;
        const rad = Math.pow(rng(), 0.62);
        const bx = cx + Math.cos(a) * rad * (sp.w * 0.36);
        const by = cy + Math.sin(a) * rad * (sp.h * 0.32);
        const isUpper = by < cy + 4;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rng() * Math.PI * 2);
        ctx.fillStyle = isUpper ? pal.petal : pal.mid;
        ctx.globalAlpha = 0.78 + rng() * 0.22;
        // Painted organic 3-petal brush dab
        for (let k = 0; k < 3; k++) {
          ctx.rotate((Math.PI * 2) / 3);
          ctx.beginPath();
          ctx.ellipse(5.5, 0, 7.2 + rng() * 3.5, 4.4 + rng() * 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 4. Crisp individual 5-petal illustrated cherry blossoms (concentrated on moonlit upper-right crest!)
      const blossomCount = sp.tone === 'bright' ? 54 : 44;
      for (let i = 0; i < blossomCount; i++) {
        const a = rng() * Math.PI * 2;
        const rad = Math.pow(rng(), 0.65);
        const bx = cx + Math.cos(a) * rad * (sp.w * 0.39);
        const by = cy + Math.sin(a) * rad * (sp.h * 0.36);
        // Moonlight comes from upper-right!
        const moonFactor = ((bx - cx) / (sp.w * 0.5)) * 0.38 - ((by - cy) / (sp.h * 0.5)) * 0.62;
        const col = moonFactor > 0.28
          ? pal.rim
          : moonFactor > -0.05
          ? pal.hi
          : moonFactor > -0.35
          ? pal.petal
          : pal.mid;
        const pr = 4.0 + rng() * 3.8;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rng() * Math.PI * 2);
        ctx.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.save();
          ctx.translate(0, -pr * 0.78);
          traceSakuraPetal(ctx, pr * 0.66);
          ctx.fill();
          ctx.restore();
        }
        // Warm golden-rose stamen center on brighter blossoms
        if (moonFactor > -0.1) {
          ctx.fillStyle = moonFactor > 0.25 ? '#ffe699' : '#ffd1a3';
          ctx.beginPath();
          ctx.arc(0, 0, pr * 0.24, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 5. Delicate stray outer petals softening the silhouette edges
      for (let i = 0; i < 24; i++) {
        const a = rng() * Math.PI * 2;
        const bx = cx + Math.cos(a) * (sp.w * (0.34 + rng() * 0.12));
        const by = cy + Math.sin(a) * (sp.h * (0.31 + rng() * 0.13));
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rng() * Math.PI * 2);
        ctx.fillStyle = by < cy ? pal.rim : pal.hi;
        ctx.globalAlpha = 0.85;
        traceSakuraPetal(ctx, 3.2 + rng() * 2.4);
        ctx.fill();
        ctx.restore();
      }

      sprites.push({ canvas: buf.canvas, w: sp.w, h: sp.h });
    }
    return sprites;
  }

  _buildLampPostSprite() {
    // Ornate Belle-Époque wrought-iron Parisian streetlamp (base at y = 266, lantern center at y = 34)
    const w = 72;
    const h = 272;
    const buf = makeOffscreen(w, h, 2);
    if (!buf) return null;
    const { ctx } = buf;
    const cx = w * 0.5;
    const baseY = h - 4;
    const lanternY = 38;

    const ironGrad = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
    ironGrad.addColorStop(0, '#140514');
    ironGrad.addColorStop(0.45, '#2b1029');
    ironGrad.addColorStop(0.82, '#471e40');
    ironGrad.addColorStop(1, '#1b071c');

    // Fluted cast-iron pedestal base
    ctx.fillStyle = ironGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 16, baseY);
    ctx.lineTo(cx - 13, baseY - 12);
    ctx.quadraticCurveTo(cx - 11, baseY - 26, cx - 8, baseY - 46);
    ctx.lineTo(cx + 8, baseY - 46);
    ctx.quadraticCurveTo(cx + 11, baseY - 26, cx + 13, baseY - 12);
    ctx.lineTo(cx + 16, baseY);
    ctx.closePath();
    ctx.fill();

    // Decorative pedestal collar rings
    ctx.fillStyle = '#3c1836';
    ctx.fillRect(cx - 11, baseY - 48, 22, 4);
    ctx.fillRect(cx - 9, baseY - 54, 18, 3);

    // Tapered slender iron shaft
    ctx.fillStyle = ironGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 5.2, baseY - 54);
    ctx.lineTo(cx - 3.4, lanternY + 18);
    ctx.lineTo(cx + 3.4, lanternY + 18);
    ctx.lineTo(cx + 5.2, baseY - 54);
    ctx.closePath();
    ctx.fill();

    // Subtle moonlight metallic edge highlight along shaft
    ctx.strokeStyle = 'rgba(255, 206, 224, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + 3.2, baseY - 54);
    ctx.lineTo(cx + 2.2, lanternY + 20);
    ctx.stroke();

    // Ornate Art-Nouveau scroll brackets below the lantern head
    ctx.strokeStyle = '#250b24';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 3, lanternY + 34);
      ctx.bezierCurveTo(cx + side * 20, lanternY + 32, cx + side * 22, lanternY + 16, cx + side * 12, lanternY + 14);
      ctx.stroke();
      // Little scroll curl
      ctx.beginPath();
      ctx.arc(cx + side * 15, lanternY + 25, 3.2, 0, Math.PI * 1.6);
      ctx.stroke();
    }

    // Lantern decorative cross-arm & collar
    ctx.fillStyle = '#220a22';
    ctx.beginPath();
    ctx.moveTo(cx - 10, lanternY + 18);
    ctx.lineTo(cx + 10, lanternY + 18);
    ctx.lineTo(cx + 6, lanternY + 23);
    ctx.lineTo(cx - 6, lanternY + 23);
    ctx.closePath();
    ctx.fill();

    // Glowing hexagonal Parisian glass lantern panes
    const glassGrad = ctx.createRadialGradient(cx, lanternY + 1, 2, cx, lanternY + 1, 18);
    glassGrad.addColorStop(0, '#fffdf0');
    glassGrad.addColorStop(0.55, '#ffe8a8');
    glassGrad.addColorStop(1, '#ffb86e');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 12.5, lanternY - 9);
    ctx.lineTo(cx + 12.5, lanternY - 9);
    ctx.lineTo(cx + 9.5, lanternY + 17);
    ctx.lineTo(cx - 9.5, lanternY + 17);
    ctx.closePath();
    ctx.fill();

    // Crisp iron lantern cage frame & vertical glass muntins
    ctx.strokeStyle = '#1b071c';
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, lanternY - 9); ctx.lineTo(cx - 3.2, lanternY + 17);
    ctx.moveTo(cx + 4.5, lanternY - 9); ctx.lineTo(cx + 3.2, lanternY + 17);
    ctx.stroke();

    // Domed wrought-iron Parisian lantern cap & finial spire
    ctx.fillStyle = '#19061b';
    ctx.beginPath();
    ctx.moveTo(cx - 16, lanternY - 8);
    ctx.quadraticCurveTo(cx - 13, lanternY - 19, cx, lanternY - 22);
    ctx.quadraticCurveTo(cx + 13, lanternY - 19, cx + 16, lanternY - 8);
    ctx.closePath();
    ctx.fill();
    // Finial spike & orb
    ctx.beginPath();
    ctx.arc(cx, lanternY - 24, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, lanternY - 33);
    ctx.lineTo(cx - 1.8, lanternY - 24);
    ctx.lineTo(cx + 1.8, lanternY - 24);
    ctx.closePath();
    ctx.fill();

    // Warm rim gleam on the lantern cap
    ctx.strokeStyle = 'rgba(255, 224, 175, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - 14, lanternY - 8.5);
    ctx.lineTo(cx + 14, lanternY - 8.5);
    ctx.stroke();

    return { canvas: buf.canvas, w, h, anchorX: cx, anchorY: baseY, lanternOffsetY: baseY - lanternY };
  }

  // ============================================================
  // SIMULATION UPDATE
  // ============================================================
  update(dt, time) {
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.05);
    this._time = typeof time === 'number' ? time : this._time + safeDt;
    const t = this._time;

    // 1. Drift twilight clouds
    const cloudSpan = this.W + 520;
    for (const c of this.clouds) {
      c.x += c.speed * safeDt;
      if (c.x > this.W + 260) c.x -= cloudSpan;
    }

    // 2. Advance animated river ripples
    const rippleSpan = this.W + 560;
    for (const r of this.waterRipples) {
      r.x += r.speed * safeDt;
      if (r.x > this.W + 280) r.x -= rippleSpan;
      else if (r.x < -280) r.x += rippleSpan;
    }

    // 3. Advance golden garden fireflies
    for (const ff of this.fireflies) {
      ff.x = ff.baseX + Math.sin(t * ff.freqX + ff.phase) * ff.ampX;
      ff.y = ff.baseY + Math.cos(t * ff.freqY + ff.phase * 1.3) * ff.ampY;
    }

    // 4. Advance 3D-tumbling cherry-blossom petals
    for (const p of this.petals) {
      const breeze = Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
      const flutterY = Math.cos(t * p.swayFreq * 1.35 + p.phase) * 6;
      p.x += (p.vx + breeze) * safeDt;
      p.y += (p.vy + flutterY) * safeDt;
      p.rot += p.rotSpeed * safeDt;
      p.flip += p.flipSpeed * safeDt;

      if (p.y > this.H + 36) {
        p.y = -28;
        p.x = ((p.x + this.W * 0.45) % (this.W + 140)) - 30;
      }
      if (p.x < -64) p.x = this.W + 48;
      if (p.x > this.W + 84) p.x = -40;
    }

    // 5. Advance soft floating romantic hearts
    for (const h of this.floatingHearts) {
      h.y += h.vy * safeDt;
      h.x += (h.vx + Math.sin(t * 1.1 + h.phase) * h.swayAmp * 0.45) * safeDt;
      if (h.y < -30) {
        h.y = this.H + 24;
        h.x = ((h.x + 193) % this.W + this.W) % this.W;
      }
    }

    // 6. Occasional romantic shooting star
    const ss = this.shootingStar;
    if (!ss.active) {
      ss.timer -= safeDt;
      if (ss.timer <= 0) {
        ss.active = true;
        ss.life = ss.maxLife;
        ss.x = this.W * (0.2 + 0.55 * ((Math.sin(t * 7.3) + 1) * 0.5));
        ss.y = 24 + 54 * ((Math.cos(t * 3.1) + 1) * 0.5);
        ss.vx = -310;
        ss.vy = 115;
      }
    } else {
      ss.x += ss.vx * safeDt;
      ss.y += ss.vy * safeDt;
      ss.life -= safeDt;
      if (ss.life <= 0) {
        ss.active = false;
        ss.timer = 9.5 + ((Math.sin(t * 1.7) + 1) * 4.5);
      }
    }
  }

  // ============================================================
  // LAYER 1: SCREEN-SPACE SKY, MOON, PARISIAN SKYLINE & SEINE
  // ============================================================
  drawSky(ctx, camX = this.STAGE_W * 0.5, time = this._time) {
    const W = this.W;
    const H = this.H;
    const horizonY = this.horizonY;
    const camDelta = camX - this.STAGE_W * 0.5;

    ctx.save();

    // 1. Lush twilight velvet-plum to rose-gold sunset horizon sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0.00, '#0d0418');
    skyGrad.addColorStop(0.20, '#220a30');
    skyGrad.addColorStop(0.42, '#4d1747');
    skyGrad.addColorStop(0.54, '#8d2a5e');
    skyGrad.addColorStop(0.60, '#d2617e');
    skyGrad.addColorStop(0.64, '#f2a48e');
    skyGrad.addColorStop(0.68, '#531b47');
    skyGrad.addColorStop(1.00, '#140419');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Warm rose-gold sunset dome glow behind the Eiffel Tower
    const eiffelScreenX = this.eiffelX - camDelta * 0.20;
    const sunsetGlow = ctx.createRadialGradient(
      eiffelScreenX, horizonY + 8, 12,
      eiffelScreenX, horizonY - 12, W * 0.48
    );
    sunsetGlow.addColorStop(0, 'rgba(255, 212, 168, 0.52)');
    sunsetGlow.addColorStop(0.32, 'rgba(255, 138, 174, 0.30)');
    sunsetGlow.addColorStop(0.68, 'rgba(182, 54, 120, 0.10)');
    sunsetGlow.addColorStop(1, 'rgba(120, 25, 85, 0)');
    ctx.fillStyle = sunsetGlow;
    ctx.fillRect(0, 0, W, horizonY + 40);

    // 2. Twinkling starfield + occasional shooting star
    this._drawStars(ctx, camDelta, time);

    // 3. High wispy nebula clouds (behind moon)
    this._drawClouds(ctx, camDelta, 0);

    // 4. Luminous full moon with crater shading & volumetric moonlight halo
    const moonX = this.moonBaseX - camDelta * 0.06;
    const moonY = this.moonY;
    this._drawMoon(ctx, moonX, moonY, time);

    // 5. Lower backlit rose-gold cumulus clouds (drifting partly across moon halo)
    this._drawClouds(ctx, camDelta, 1);

    // 6. Slow-parallax (0.20x) distant Parisian skyline, Eiffel Tower, arched bridge & Seine river
    const offsetFar = -camDelta * 0.20;
    ctx.save();
    ctx.translate(offsetFar, 0);

    // River water base starting at the far shoreline (visible right through the stone bridge arches!)
    this._drawRiverBase(ctx);

    // Subtle Eiffel Tower rotating golden searchlight beam (behind/around tower tip)
    this._drawEiffelSearchlight(ctx, this.eiffelX, this.eiffelTopY + 8, time);

    if (this._skylineCache) {
      ctx.drawImage(
        this._skylineCache.canvas,
        -this._skylineCache.padX, 0,
        this._skylineCache.totalW, this._skylineCache.totalH
      );
    }

    // Animated golden Eiffel beacon & champagne glitter sparkles
    this._drawEiffelBeaconAndSparkles(ctx, time);

    // Animated glowing bridge lamps
    if (this._skylineCache && this._skylineCache.bridgeLamps) {
      const goldGlow = this._glowSprites.gold;
      for (let i = 0; i < this._skylineCache.bridgeLamps.length; i++) {
        const l = this._skylineCache.bridgeLamps[i];
        const flicker = 0.78 + 0.22 * Math.sin(time * 3.1 + i * 1.3);
        if (goldGlow) {
          ctx.globalAlpha = 0.65 * flicker;
          ctx.drawImage(goldGlow, l.x - 11, l.y - 11, 22, 22);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff5cc';
        ctx.beginPath();
        ctx.arc(l.x, l.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 7. Shimmering moonlit Seine river reflections & animated horizontal water caustics
    this._drawMoonlitRiverReflections(ctx, moonX - offsetFar, time);

    ctx.restore();
    ctx.restore();
  }

  _drawStars(ctx, camDelta, time) {
    const W = this.W;
    const shift = -camDelta * 0.03;

    ctx.save();
    for (const s of this.stars) {
      const sx = (((s.x + shift) % W) + W) % W;
      const tw = 0.30 + 0.70 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
      const [r, g, b] = s.rgb;

      if (s.isHero) {
        const glow = this._glowSprites.pearl;
        if (glow) {
          ctx.globalAlpha = tw * 0.55;
          ctx.drawImage(glow, sx - 9, s.y - 9, 18, 18);
        }
        ctx.globalAlpha = tw;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${tw * 0.9})`;
        ctx.lineWidth = 1.0;
        const arm = 3.5 + tw * 3.8;
        ctx.beginPath();
        ctx.moveTo(sx - arm, s.y); ctx.lineTo(sx + arm, s.y);
        ctx.moveTo(sx, s.y - arm); ctx.lineTo(sx, s.y + arm);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tw})`;
      ctx.beginPath();
      ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Delicate shooting star
    const ss = this.shootingStar;
    if (ss.active) {
      const p = Math.max(0, ss.life / ss.maxLife);
      const alpha = Math.sin(p * Math.PI) * 0.85;
      const tailLen = 58;
      const g = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 0.18, ss.y - ss.vy * 0.18);
      g.addColorStop(0, `rgba(255, 248, 224, ${alpha})`);
      g.addColorStop(0.4, `rgba(255, 195, 226, ${alpha * 0.5})`);
      g.addColorStop(1, 'rgba(255, 195, 226, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x + tailLen * 0.92, ss.y - tailLen * 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawClouds(ctx, camDelta, layer) {
    if (!this._cloudSprites.length) return;
    ctx.save();
    for (const c of this.clouds) {
      if (c.layer !== layer) continue;
      const sp = this._cloudSprites[c.spriteIdx];
      const cx = c.x - camDelta * c.parallax;
      const dw = sp.w * c.scaleX;
      const dh = sp.h * c.scaleY;
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(sp.canvas, cx - dw * 0.5, c.y - dh * 0.5, dw, dh);
    }
    ctx.restore();
  }

  _drawMoon(ctx, moonX, moonY, time) {
    const breath = 1 + Math.sin(time * 0.9) * 0.035;

    // Large outer volumetric moonlight halo
    const outerR = 235 * breath;
    const halo = ctx.createRadialGradient(moonX, moonY, 26, moonX, moonY, outerR);
    halo.addColorStop(0.00, 'rgba(255, 248, 226, 0.72)');
    halo.addColorStop(0.22, 'rgba(255, 220, 206, 0.34)');
    halo.addColorStop(0.48, 'rgba(255, 152, 198, 0.15)');
    halo.addColorStop(0.76, 'rgba(184, 72, 148, 0.05)');
    halo.addColorStop(1.00, 'rgba(150, 40, 120, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, outerR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle atmospheric moonlight ring (lunar halo)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 220, 232, 0.08)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 94 * breath, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (this._moonSprite) {
      const sz = this._moonSprite.size;
      ctx.drawImage(this._moonSprite.canvas, moonX - sz * 0.5, moonY - sz * 0.5, sz, sz);
    } else {
      ctx.fillStyle = '#fff6e4';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawEiffelSearchlight(ctx, cx, cy, time) {
    // Twin subtle golden-champagne rotating Parisian beacon beams sweeping the night sky
    const sweep = Math.sin(time * 0.52);
    const angle = -0.22 + sweep * 0.36;
    const len = 340;
    const spread = 0.075;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const dir of [1, -1]) {
      const a = dir === 1 ? angle : Math.PI - angle;
      const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      const intensity = dir === 1 ? 0.16 : 0.11;
      g.addColorStop(0, `rgba(255, 234, 170, ${intensity})`);
      g.addColorStop(0.45, `rgba(255, 206, 155, ${intensity * 0.42})`);
      g.addColorStop(1, 'rgba(255, 180, 165, 0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - spread) * len, cy + Math.sin(a - spread) * len);
      ctx.lineTo(cx + Math.cos(a + spread) * len, cy + Math.sin(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawEiffelBeaconAndSparkles(ctx, time) {
    const cx = this.eiffelX;
    const beaconY = this.eiffelTopY + 5;
    const pulse = 0.78 + 0.22 * Math.sin(time * 4.2);

    const goldGlow = this._glowSprites.gold;
    if (goldGlow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 * pulse;
      const sz = 44 + pulse * 10;
      ctx.drawImage(goldGlow, cx - sz * 0.5, beaconY - sz * 0.5, sz, sz);
      ctx.restore();
    }

    ctx.fillStyle = '#fff9d6';
    ctx.beginPath();
    ctx.arc(cx, beaconY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Parisian midnight Eiffel Tower champagne-glitter twinkles
    const H = this.eiffelBaseY - this.eiffelTopY;
    for (const sp of this.eiffelSparkles) {
      const v = Math.sin(time * sp.speed + sp.phase);
      if (v < 0.72) continue;
      const a = (v - 0.72) / 0.28;
      const sx = cx + sp.nx;
      const sy = this.eiffelTopY + sp.t * H;
      ctx.fillStyle = `rgba(255, 244, 196, ${a * 0.92})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3 + a * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRiverBase(ctx) {
    const riverTop = this.horizonY - 2;
    const riverH = this.H - riverTop + 60;
    const leftX = -340;
    const width = this.W + 680;

    // Deep velvet-plum to rose-wine water gradient starting right at the far shoreline
    // so shimmering water is visible cleanly through the carved stone bridge arches!
    const waterGrad = ctx.createLinearGradient(0, riverTop, 0, riverTop + riverH);
    waterGrad.addColorStop(0.00, '#72285a');
    waterGrad.addColorStop(0.12, '#5a1f4c');
    waterGrad.addColorStop(0.28, '#3f153e');
    waterGrad.addColorStop(0.58, '#240b29');
    waterGrad.addColorStop(1.00, '#130419');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(leftX, riverTop, width, riverH);
  }

  _drawMoonlitRiverReflections(ctx, localMoonX, time) {
    const waterTop = this.horizonY + 18;
    const leftX = -340;
    const width = this.W + 680;

    // 1. Soft mirrored sunset glow & subtle shoreline mist along the bridge base
    const refGlow = ctx.createRadialGradient(
      this.eiffelX, waterTop + 26, 8,
      this.eiffelX, waterTop + 42, 240
    );
    refGlow.addColorStop(0, 'rgba(255, 168, 165, 0.24)');
    refGlow.addColorStop(0.5, 'rgba(186, 68, 128, 0.10)');
    refGlow.addColorStop(1, 'rgba(120, 30, 90, 0)');
    ctx.fillStyle = refGlow;
    ctx.fillRect(leftX, waterTop, width, 120);

    // Subtle rippling dark silhouette reflection of Eiffel Tower
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const p = i / 16;
      const ry = waterTop + 6 + p * 88;
      const rw = (1 - p * 0.82) * 58;
      const wave = Math.sin(time * 2.8 + i * 0.9) * (3 + p * 6);
      ctx.fillStyle = `rgba(18, 4, 24, ${0.28 * (1 - p * 0.65)})`;
      ctx.fillRect(this.eiffelX - rw * 0.5 + wave, ry, rw, 3.5);
    }
    ctx.restore();

    // 3. Shimmering warm reflections from Parisian bridge lamps
    if (this._skylineCache && this._skylineCache.bridgeLamps) {
      for (let i = 0; i < this._skylineCache.bridgeLamps.length; i += 2) {
        const l = this._skylineCache.bridgeLamps[i];
        const lx = l.x + 4.5;
        for (let k = 0; k < 6; k++) {
          const ry = waterTop + 4 + k * 10;
          const rw = (12 - k * 1.4) + Math.sin(time * 3.8 + i + k * 1.4) * 4;
          const shift = Math.sin(time * 2.4 + k * 1.7 + i) * 3.5;
          ctx.fillStyle = `rgba(255, 206, 125, ${0.22 - k * 0.03})`;
          ctx.fillRect(lx - rw * 0.5 + shift, ry, Math.max(3, rw), 2.2);
        }
      }
    }

    // 4. Luminous moon reflection path with animated horizontal water caustics
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 18; r++) {
      const p = r / 18;
      const ry = waterTop + 4 + Math.pow(p, 1.15) * 124;
      const wave = Math.sin(time * 2.7 + r * 1.15) * (5 + p * 12);
      const rw = (36 + p * 86) * (0.75 + 0.25 * Math.cos(time * 3.4 + r * 1.7));
      const a = (0.34 - p * 0.21) * (0.75 + 0.25 * Math.sin(time * 4.1 + r));
      const h = 1.6 + p * 2.2;

      const cg = ctx.createLinearGradient(localMoonX - rw * 0.5 + wave, ry, localMoonX + rw * 0.5 + wave, ry);
      cg.addColorStop(0, 'rgba(255, 210, 210, 0)');
      cg.addColorStop(0.25, `rgba(255, 232, 205, ${a * 0.7})`);
      cg.addColorStop(0.5, `rgba(255, 250, 232, ${a})`);
      cg.addColorStop(0.75, `rgba(255, 224, 214, ${a * 0.7})`);
      cg.addColorStop(1, 'rgba(255, 210, 210, 0)');
      ctx.fillStyle = cg;
      ctx.fillRect(localMoonX - rw * 0.5 + wave, ry, rw, h);
    }
    ctx.restore();

    // 5. Drifting horizontal caustic glints across the whole Seine surface
    for (const rp of this.waterRipples) {
      const ry = waterTop + 6 + Math.pow(rp.depth, 1.18) * 130;
      const shimmer = 0.45 + 0.55 * Math.sin(time * 2.8 + rp.phase);
      const a = rp.alpha * shimmer;
      ctx.fillStyle = rp.warm
        ? `rgba(255, 216, 178, ${a})`
        : `rgba(255, 178, 220, ${a * 0.85})`;
      ctx.fillRect(rp.x, ry, rp.width, 1.2 + rp.depth * 1.2);
    }
  }

  // ============================================================
  // LAYER 2: WORLD-SPACE PROMENADE MIDGROUND
  // (Sakura Trees, Balustrade & Climbing Roses, Lamps, Fairy Lights, Fireflies)
  // ============================================================
  drawMidground(ctx, camX = this.STAGE_W * 0.5, time = this._time) {
    const GY = this.GROUND_Y;
    const SW = this.STAGE_W;

    ctx.save();

    // 1. Soft atmospheric rose-gold river mist rising behind the balustrade
    // (Creates clean value separation so fighters pop sharply!)
    const mistGrad = ctx.createLinearGradient(0, GY - 145, 0, GY + 4);
    mistGrad.addColorStop(0, 'rgba(255, 165, 205, 0)');
    mistGrad.addColorStop(0.62, 'rgba(255, 170, 200, 0.11)');
    mistGrad.addColorStop(1, 'rgba(92, 26, 68, 0.28)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(-160, GY - 145, SW + 320, 150);

    // 2. Soft distant silhouetted sakura crowns behind the parapet
    this._drawBackgroundTreeSilhouettes(ctx, time);

    // 3. Layered painterly cherry-blossom trees (curved textured trunks + swaying illustrated clusters)
    for (const tree of this.treeDefs) {
      this._drawPainterlySakuraTree(ctx, tree, time);
    }

    // 4. Draped champagne-and-rose fairy string lights (strung across lamps)
    this._drawFairyStringLights(ctx, time);

    // 5. Wrought-iron heart balustrade railing + stone parapet + climbing roses
    this._drawHeartBalustradeAndRoses(ctx, time);

    // 6. Ornate wrought-iron Parisian streetlamps + warm volumetric light cones
    this._drawParisianStreetlamps(ctx, time);

    // 7. Drifting golden & rose garden fireflies
    this._drawFireflies(ctx, time);

    ctx.restore();
  }

  _drawBackgroundTreeSilhouettes(ctx, time) {
    ctx.save();
    for (const bt of this.bgTreeDefs) {
      const sway = Math.sin(time * 0.85 + bt.phase) * 4;
      const g = ctx.createRadialGradient(bt.x + sway, bt.y - 12, 8, bt.x + sway, bt.y, bt.rx);
      g.addColorStop(0, 'rgba(116, 36, 86, 0.42)');
      g.addColorStop(0.68, 'rgba(64, 18, 56, 0.34)');
      g.addColorStop(1, 'rgba(42, 10, 42, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bt.x + sway, bt.y, bt.rx, bt.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawPainterlySakuraTree(ctx, tree, time) {
    const tx = tree.x;
    const baseY = this.GROUND_Y - 12;
    const s = tree.scale;
    const lean = tree.lean;
    const sway = Math.sin(time * 1.15 + tree.swayPhase) * 6.5 * s;

    ctx.save();

    // --- Back-tier blossom clusters (behind upper twigs for rich depth) ---
    this._drawTreeClustersByTier(ctx, tree, baseY, sway, time, 0);

    // --- Sculpted gnarled cherry-bark trunk & curving boughs ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawBranchStroke = (width, color, offsetX = 0, offsetY = 0) => {
      ctx.strokeStyle = color;
      // Main curved trunk
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(tx + offsetX, baseY + offsetY);
      ctx.bezierCurveTo(
        tx - 20 * s + offsetX, baseY - 76 * s + offsetY,
        tx + lean * 1.2 + offsetX, baseY - 148 * s + offsetY,
        tx + lean + sway * 0.65 + offsetX, baseY - 228 * s + offsetY
      );
      ctx.stroke();

      // Sweeping left bough
      ctx.lineWidth = width * 0.56;
      ctx.beginPath();
      ctx.moveTo(tx + lean * 0.35 + sway * 0.25 + offsetX, baseY - 134 * s + offsetY);
      ctx.bezierCurveTo(
        tx - 38 * s + offsetX, baseY - 172 * s + offsetY,
        tx - 78 * s + sway * 0.6 + offsetX, baseY - 194 * s + offsetY,
        tx - 118 * s + sway * 0.95 + offsetX, baseY - 204 * s + offsetY
      );
      ctx.stroke();

      // Sweeping right bough
      ctx.lineWidth = width * 0.52;
      ctx.beginPath();
      ctx.moveTo(tx + lean * 0.55 + sway * 0.32 + offsetX, baseY - 148 * s + offsetY);
      ctx.bezierCurveTo(
        tx + 46 * s + offsetX, baseY - 178 * s + offsetY,
        tx + 82 * s + sway * 0.6 + offsetX, baseY - 196 * s + offsetY,
        tx + 122 * s + sway * 0.95 + offsetX, baseY - 212 * s + offsetY
      );
      ctx.stroke();

      // Upper crown fork twigs
      ctx.lineWidth = width * 0.30;
      ctx.beginPath();
      ctx.moveTo(tx + lean * 0.8 + sway * 0.45 + offsetX, baseY - 188 * s + offsetY);
      ctx.quadraticCurveTo(tx - 32 * s + sway * 0.7 + offsetX, baseY - 228 * s + offsetY, tx - 62 * s + sway + offsetX, baseY - 242 * s + offsetY);
      ctx.moveTo(tx + lean * 0.85 + sway * 0.5 + offsetX, baseY - 192 * s + offsetY);
      ctx.quadraticCurveTo(tx + 34 * s + sway * 0.7 + offsetX, baseY - 232 * s + offsetY, tx + 64 * s + sway + offsetX, baseY - 246 * s + offsetY);
      ctx.stroke();
    };

    // Flared gnarled root base
    ctx.fillStyle = '#1f0918';
    ctx.beginPath();
    ctx.moveTo(tx - 24 * s, baseY + 4);
    ctx.quadraticCurveTo(tx - 12 * s, baseY - 26 * s, tx - 10 * s, baseY - 46 * s);
    ctx.lineTo(tx + 12 * s, baseY - 46 * s);
    ctx.quadraticCurveTo(tx + 13 * s, baseY - 24 * s, tx + 25 * s, baseY + 4);
    ctx.closePath();
    ctx.fill();

    // Pass 1: Deep dark cherry bark silhouette
    drawBranchStroke(22 * s, '#1f0918', 0, 0);
    // Pass 2: Rich mulberry bark midtone
    drawBranchStroke(13 * s, '#3b152a', 1.8 * s, -1.0 * s);
    // Pass 3: Warm moonlit rose rim-light along moon-facing edge
    drawBranchStroke(3.2 * s, 'rgba(255, 194, 224, 0.32)', 5.6 * s, -2.5 * s);

    // Textured bark grain strokes along trunk
    ctx.strokeStyle = 'rgba(22, 6, 18, 0.65)';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) {
      const y0 = baseY - (26 + k * 24) * s;
      ctx.beginPath();
      ctx.moveTo(tx - 6 * s + k * 1.4, y0);
      ctx.quadraticCurveTo(tx - 1 * s, y0 - 12 * s, tx + 3 * s, y0 - 20 * s);
      ctx.stroke();
    }

    // --- Mid & front moonlit painterly sakura blossom tiers ---
    this._drawTreeClustersByTier(ctx, tree, baseY, sway, time, 1);
    this._drawTreeClustersByTier(ctx, tree, baseY, sway, time, 2);

    ctx.restore();
  }

  _drawTreeClustersByTier(ctx, tree, baseY, baseSway, time, targetTier) {
    if (!this._sakuraSprites.length) return;
    for (const cl of tree.clusters) {
      if (cl.tier !== targetTier) continue;
      const sp = this._sakuraSprites[cl.sprite % this._sakuraSprites.length];
      const localSwayX = baseSway * (0.85 + targetTier * 0.14) + Math.sin(time * 1.65 + cl.phase) * 3.8;
      const localSwayY = Math.cos(time * 1.35 + cl.phase) * 2.2;
      const rot = Math.sin(time * 1.2 + cl.phase) * 0.035;
      const cx = tree.x + tree.lean * 0.7 + cl.ox + localSwayX;
      const cy = baseY + cl.oy + localSwayY;
      const dw = sp.w * cl.sc;
      const dh = sp.h * cl.sc;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(sp.canvas, -dw * 0.5, -dh * 0.5, dw, dh);
      ctx.restore();
    }
  }

  _drawFairyStringLights(ctx, time) {
    const GY = this.GROUND_Y;
    const wireY = GY - 236;
    const posts = [-225, ...this.lampPositions, this.STAGE_W + 225];
    const goldGlow = this._glowSprites.gold;
    const roseGlow = this._glowSprites.rose;
    const pearlGlow = this._glowSprites.pearl;

    ctx.save();
    for (let i = 0; i < posts.length - 1; i++) {
      const x1 = posts[i];
      const x2 = posts[i + 1];
      const mx = (x1 + x2) * 0.5;
      const sag = 58 + Math.sin(time * 1.3 + i * 1.1) * 3.5;
      const ctrlY = wireY + sag;

      // Secondary upper delicate garland swag
      const ctrlY2 = wireY + sag * 0.62;
      ctx.strokeStyle = 'rgba(42, 14, 38, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x1, wireY);
      ctx.quadraticCurveTo(mx, ctrlY, x2, wireY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 206, 170, 0.22)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1, wireY - 3);
      ctx.quadraticCurveTo(mx, ctrlY2, x2, wireY - 3);
      ctx.stroke();

      // Draped champagne & rose glowing bulbs with lush bokeh halos
      const bulbCount = 9;
      for (let b = 1; b <= bulbCount; b++) {
        const u = b / (bulbCount + 1);
        const inv = 1 - u;
        const bx = inv * inv * x1 + 2 * inv * u * mx + u * u * x2;
        const by = inv * inv * wireY + 2 * inv * u * ctrlY + u * u * wireY;

        const twinkle = 0.68 + 0.32 * Math.sin(time * 3.2 + b * 1.15 + i * 2.1);
        const isGold = b % 3 !== 0;
        const isPearl = b % 5 === 0;
        const sprite = isPearl ? pearlGlow : isGold ? goldGlow : roseGlow;
        const haloSize = (24 + twinkle * 11) * (isPearl ? 1.1 : 1.0);

        if (sprite) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.62 * twinkle;
          ctx.drawImage(sprite, bx - haloSize * 0.5, by + 2 - haloSize * 0.5, haloSize, haloSize);
          ctx.restore();
        }

        // Tiny dark bulb socket
        ctx.fillStyle = '#240a22';
        ctx.fillRect(bx - 1.3, by - 0.5, 2.6, 2.5);

        // Luminous bulb glass core
        ctx.fillStyle = isPearl ? '#fffef6' : isGold ? '#ffe9a6' : '#ff9ed4';
        ctx.beginPath();
        ctx.arc(bx, by + 3.2, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx - 0.5, by + 2.5, 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawHeartBalustradeAndRoses(ctx, time) {
    const GY = this.GROUND_Y;
    const startX = -150;
    const endX = this.STAGE_W + 150;
    const railTopY = GY - 54;
    const curbTopY = GY - 14;

    ctx.save();

    // 1. Carved Parisian stone parapet curb base
    const curbGrad = ctx.createLinearGradient(0, curbTopY, 0, GY);
    curbGrad.addColorStop(0, '#5a284e');
    curbGrad.addColorStop(0.32, '#3a1636');
    curbGrad.addColorStop(1, '#1e0820');
    ctx.fillStyle = curbGrad;
    ctx.fillRect(startX, curbTopY, endX - startX, 15);

    // Moonlit bevel top edge on stone parapet
    ctx.fillStyle = 'rgba(255, 206, 224, 0.34)';
    ctx.fillRect(startX, curbTopY, endX - startX, 2);

    // Subtle stone block seams
    ctx.strokeStyle = 'rgba(20, 4, 22, 0.55)';
    ctx.lineWidth = 1.2;
    for (let sx = startX; sx <= endX; sx += 64) {
      ctx.beginPath();
      ctx.moveTo(sx, curbTopY);
      ctx.lineTo(sx, GY);
      ctx.stroke();
    }

    // 2. Wrought-iron top & bottom rails
    ctx.fillStyle = '#1b061d';
    ctx.fillRect(startX, railTopY, endX - startX, 5.5);
    ctx.fillRect(startX, curbTopY - 4, endX - startX, 4);
    // Warm rose-gold sheen along handrail top
    ctx.fillStyle = 'rgba(255, 202, 220, 0.30)';
    ctx.fillRect(startX, railTopY, endX - startX, 1.4);

    // 3. Ornate wrought-iron bays with sculpted S-scroll heart motifs
    const bayW = 64;
    ctx.strokeStyle = '#1f0822';
    ctx.lineCap = 'round';
    for (let bx = -128; bx <= this.STAGE_W + 128; bx += bayW) {
      // Main vertical baluster post with decorative collar ring & finial
      ctx.fillStyle = '#1c061e';
      ctx.fillRect(bx - 2.6, railTopY - 2, 5.2, curbTopY - railTopY + 3);
      ctx.fillStyle = 'rgba(255, 195, 222, 0.18)';
      ctx.fillRect(bx + 1.0, railTopY, 1.3, curbTopY - railTopY);
      // Little decorative sphere finial on post
      ctx.fillStyle = '#250b27';
      ctx.beginPath();
      ctx.arc(bx, railTopY - 3.5, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Centered wrought-iron heart filigree inside each bay
      const mx = bx + bayW * 0.5;
      const my = (railTopY + curbTopY) * 0.5 + 1;

      ctx.strokeStyle = '#210824';
      ctx.lineWidth = 2.4;
      traceHeartPath(ctx, mx, my + 2, 13.5);
      ctx.stroke();

      // Delicate inner metallic highlight on heart arch
      ctx.strokeStyle = 'rgba(255, 192, 220, 0.20)';
      ctx.lineWidth = 0.9;
      traceHeartPath(ctx, mx + 0.6, my + 1.4, 13.0);
      ctx.stroke();

      // Symmetrical S-scroll side curls connecting heart to posts
      ctx.strokeStyle = '#210824';
      ctx.lineWidth = 1.9;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mx + side * 13, my - 3);
        ctx.bezierCurveTo(
          mx + side * 22, my - 14,
          mx + side * 26, my + 10,
          bx + (side === 1 ? bayW - 4 : 4), my + 6
        );
        ctx.stroke();
      }
    }

    // 4. Climbing rose vines & painterly blossoms twining along the balustrade
    for (const cl of this.roseClusters) {
      const sway = Math.sin(time * 1.4 + cl.x * 0.02) * 1.5;

      // Twining dark emerald vine stem
      ctx.strokeStyle = '#193430';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cl.x - 32, GY - 15);
      ctx.bezierCurveTo(
        cl.x - 16, GY - 48,
        cl.x + 10, GY - 24,
        cl.x + 30 + sway, GY - 52
      );
      ctx.stroke();

      // Shaded rose leaves
      for (const lf of cl.leaves) {
        ctx.save();
        ctx.translate(cl.x + lf.dx + sway * 0.5, GY + lf.dy);
        ctx.rotate(lf.angle);
        ctx.fillStyle = '#173832';
        ctx.beginPath();
        ctx.ellipse(0, 0, lf.len, lf.len * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(130, 212, 184, 0.28)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-lf.len * 0.7, 0);
        ctx.lineTo(lf.len * 0.7, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Multi-petal painterly spiral roses
      for (const r of cl.roses) {
        this._drawPainterlyRose(ctx, cl.x + r.dx + sway * 0.7, GY + r.dy, r.size, r.hue, r.rot);
      }
    }

    ctx.restore();
  }

  _drawPainterlyRose(ctx, x, y, size, hue, rot) {
    const colors = {
      crimson: ['#6e0d34', '#c91c5c', '#ff6499'],
      rose: ['#8a154d', '#e63c88', '#ff9ecd'],
      blush: ['#a8366e', '#ff8ac2', '#ffe0f0'],
    }[hue];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Outer petals
    ctx.fillStyle = colors[0];
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Mid-layer ruffled petals
    ctx.fillStyle = colors[1];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * size * 0.34, Math.sin(a) * size * 0.34, size * 0.56, size * 0.42, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moonlit highlighted spiral center
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(-size * 0.12, -size * 0.14, size * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawParisianStreetlamps(ctx, time) {
    const GY = this.GROUND_Y;
    const amberGlow = this._glowSprites.amber;
    const goldGlow = this._glowSprites.gold;

    for (let i = 0; i < this.lampPositions.length; i++) {
      const px = this.lampPositions[i];
      const flicker = 0.92 + 0.08 * Math.sin(time * 4.3 + i * 1.9);
      const lanternY = this._lampSprite ? GY - this._lampSprite.lanternOffsetY : GY - 228;

      // 1. Soft downward volumetric light cone (additive warm champagne-amber beam!)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const coneGrad = ctx.createLinearGradient(px, lanternY + 6, px, GY + 18);
      coneGrad.addColorStop(0.00, `rgba(255, 224, 152, ${0.24 * flicker})`);
      coneGrad.addColorStop(0.35, `rgba(255, 190, 128, ${0.11 * flicker})`);
      coneGrad.addColorStop(0.80, `rgba(255, 150, 165, ${0.045 * flicker})`);
      coneGrad.addColorStop(1.00, 'rgba(255, 140, 165, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(px - 14, lanternY + 12);
      ctx.lineTo(px + 14, lanternY + 12);
      ctx.lineTo(px + 108, GY + 18);
      ctx.lineTo(px - 108, GY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Ornate cast-iron streetlamp sprite
      if (this._lampSprite) {
        const sp = this._lampSprite;
        ctx.drawImage(sp.canvas, px - sp.anchorX, GY - sp.anchorY, sp.w, sp.h);
      } else {
        ctx.fillStyle = '#240b1f';
        ctx.fillRect(px - 4, GY - 240, 8, 240);
      }

      // 3. Layered warm lantern radial halo on top of glass cage
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (amberGlow) {
        const outerSz = 148 * flicker;
        ctx.globalAlpha = 0.72 * flicker;
        ctx.drawImage(amberGlow, px - outerSz * 0.5, lanternY - outerSz * 0.5, outerSz, outerSz);
      }
      if (goldGlow) {
        const innerSz = 62 * flicker;
        ctx.globalAlpha = 0.85 * flicker;
        ctx.drawImage(goldGlow, px - innerSz * 0.5, lanternY - innerSz * 0.5, innerSz, innerSz);
      }
      ctx.restore();
    }
  }

  _drawFireflies(ctx, time) {
    const goldGlow = this._glowSprites.gold;
    const roseGlow = this._glowSprites.rose;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ff of this.fireflies) {
      const fx = ff.x || ff.baseX;
      const fy = ff.y || ff.baseY;
      const pulse = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(time * ff.pulseSpeed + ff.phase), 1.4);
      const sprite = ff.tint === 'gold' ? goldGlow : roseGlow;
      const halo = ff.r * (7.5 + pulse * 5.0);

      if (sprite) {
        ctx.globalAlpha = pulse * 0.78;
        ctx.drawImage(sprite, fx - halo * 0.5, fy - halo * 0.5, halo, halo);
      }

      ctx.globalAlpha = pulse;
      ctx.fillStyle = ff.tint === 'gold' ? '#fff7cf' : '#ffd9ef';
      ctx.beginPath();
      ctx.arc(fx, fy, ff.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // LAYER 3: WORLD-SPACE GLOSSY MOONLIT PROMENADE FLOOR
  // ============================================================
  drawFloor(ctx, fighters = [], time = this._time) {
    const GY = this.GROUND_Y;
    const SW = this.STAGE_W;
    const leftX = -160;
    const fullW = SW + 320;
    const floorH = this.H - GY + 140;
    const centerX = SW * 0.5;

    ctx.save();

    // 1. Glossy moonlit rose-marble & wet cobblestone promenade base gradient
    const floorGrad = ctx.createLinearGradient(0, GY, 0, GY + floorH);
    floorGrad.addColorStop(0.00, '#6a2d54');
    floorGrad.addColorStop(0.14, '#4c1d40');
    floorGrad.addColorStop(0.45, '#2b0e2a');
    floorGrad.addColorStop(0.82, '#18061a');
    floorGrad.addColorStop(1.00, '#0e0312');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(leftX, GY, fullW, floorH);

    // 2. Perspective cobblestone & rose-marble flagstones
    const rows = [0, 12, 28, 49, 76, 112, 160];
    const tileStep = 74;

    // Alternating subtle translucent rose-marble / plum-slate slabs
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = GY + rows[r];
      const y1 = GY + rows[r + 1];
      const p0 = rows[r] / 120;
      const p1 = rows[r + 1] / 120;
      const spread0 = 1 + p0 * 0.24;
      const spread1 = 1 + p1 * 0.24;
      const stagger = (r % 2) * (tileStep * 0.5);

      for (let tx = -tileStep * 3; tx <= SW + tileStep * 3; tx += tileStep) {
        const idx = Math.round((tx + stagger) / tileStep) + r * 3;
        const x0L = centerX + (tx + stagger - centerX) * spread0;
        const x0R = centerX + (tx + stagger + tileStep - centerX) * spread0;
        const x1L = centerX + (tx + stagger - centerX) * spread1;
        const x1R = centerX + (tx + stagger + tileStep - centerX) * spread1;

        if ((idx & 1) === 0) {
          ctx.fillStyle = r < 2 ? 'rgba(255, 198, 226, 0.055)' : 'rgba(255, 180, 218, 0.032)';
          ctx.beginPath();
          ctx.moveTo(x0L, y0);
          ctx.lineTo(x0R, y0);
          ctx.lineTo(x1R, y1);
          ctx.lineTo(x1L, y1);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Crisp perspective mortar lines & bevel gleam
    ctx.strokeStyle = 'rgba(18, 4, 22, 0.44)';
    ctx.lineWidth = 1.4;
    for (let r = 1; r < rows.length - 1; r++) {
      const ry = GY + rows[r];
      ctx.beginPath();
      ctx.moveTo(leftX, ry);
      ctx.lineTo(leftX + fullW, ry);
      ctx.stroke();

      // Wet moonlight highlight edge along each horizontal course
      ctx.strokeStyle = `rgba(255, 206, 228, ${Math.max(0.03, 0.14 - r * 0.022)})`;
      ctx.beginPath();
      ctx.moveTo(leftX, ry + 1.4);
      ctx.lineTo(leftX + fullW, ry + 1.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(18, 4, 22, 0.44)';
    }

    // Radial perspective joints
    ctx.strokeStyle = 'rgba(255, 196, 226, 0.09)';
    ctx.lineWidth = 1.3;
    for (let px = -148; px <= SW + 148; px += tileStep) {
      const botX = centerX + (px - centerX) * 1.30;
      ctx.beginPath();
      ctx.moveTo(px, GY);
      ctx.lineTo(botX, GY + 150);
      ctx.stroke();
    }

    // 3. Wet moonlight specular reflection sheen & warm streetlamp puddles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Broad central moonlit specular wash across the damp promenade
    const moonSheen = ctx.createRadialGradient(
      centerX + 120, GY + 24, 18,
      centerX + 120, GY + 42, 420
    );
    moonSheen.addColorStop(0, 'rgba(255, 232, 220, 0.19)');
    moonSheen.addColorStop(0.45, 'rgba(255, 168, 212, 0.09)');
    moonSheen.addColorStop(1, 'rgba(255, 130, 190, 0)');
    ctx.fillStyle = moonSheen;
    ctx.fillRect(leftX, GY, fullW, 130);

    // Warm golden streetlamp light puddles reflecting on the wet cobblestones
    for (let i = 0; i < this.lampPositions.length; i++) {
      const lx = this.lampPositions[i];
      const flicker = 0.90 + 0.10 * Math.sin(time * 4.3 + i * 1.9);
      const puddle = ctx.createRadialGradient(lx, GY + 18, 4, lx, GY + 26, 98);
      puddle.addColorStop(0, `rgba(255, 222, 146, ${0.26 * flicker})`);
      puddle.addColorStop(0.48, `rgba(255, 174, 130, ${0.11 * flicker})`);
      puddle.addColorStop(1, 'rgba(255, 140, 160, 0)');
      ctx.fillStyle = puddle;
      ctx.beginPath();
      ctx.ellipse(lx, GY + 24, 98, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 4. Illuminated promenade curb trim along GROUND_Y
    const edgeGrad = ctx.createLinearGradient(0, GY, SW, GY);
    edgeGrad.addColorStop(0.00, 'rgba(255, 180, 218, 0.28)');
    edgeGrad.addColorStop(0.32, 'rgba(255, 218, 198, 0.62)');
    edgeGrad.addColorStop(0.55, 'rgba(255, 240, 204, 0.80)');
    edgeGrad.addColorStop(0.82, 'rgba(255, 210, 210, 0.56)');
    edgeGrad.addColorStop(1.00, 'rgba(255, 180, 218, 0.28)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(leftX, GY, fullW, 3.2);
    ctx.fillStyle = 'rgba(20, 4, 24, 0.55)';
    ctx.fillRect(leftX, GY + 3.2, fullW, 2.2);

    // 5. Subtle glowing rose-gold heart mosaic inlaid at center stage
    this._drawCenterHeartMosaic(ctx, centerX, GY + 38, time);

    // 6. Scattered fallen cherry-blossom & rose petals on the wet stones
    for (const fp of this.fallenPetals) {
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.rot);
      // Tiny dark contact shadow under petal
      ctx.fillStyle = 'rgba(14, 3, 18, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0.8, 1.0, fp.rx, fp.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Petal
      ctx.globalAlpha = fp.alpha;
      ctx.fillStyle = fp.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, fp.rx, fp.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Soft mirrored glow & stylized silhouette reflections under each fighter
    if (Array.isArray(fighters)) {
      for (const f of fighters) {
        if (!f || typeof f.x !== 'number') continue;
        this._drawFighterFloorReflection(ctx, f, time);
      }
    }

    ctx.restore();
  }

  _drawCenterHeartMosaic(ctx, cx, cy, time) {
    const pulse = 0.72 + 0.28 * Math.sin(time * 2.1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.34); // Foreshortened onto the promenade floor plane

    // Outer soft romantic rose-gold glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const mGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, 82);
    mGlow.addColorStop(0, `rgba(255, 146, 202, ${0.28 * pulse})`);
    mGlow.addColorStop(0.55, `rgba(255, 206, 152, ${0.12 * pulse})`);
    mGlow.addColorStop(1, 'rgba(255, 120, 185, 0)');
    ctx.fillStyle = mGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inlaid octagonal/circular rose-gold medallion borders
    ctx.strokeStyle = `rgba(255, 214, 162, ${0.32 * pulse})`;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 168, 214, ${0.26 * pulse})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Decorative compass diamond inlays around medallion rim
    ctx.fillStyle = `rgba(255, 224, 170, ${0.36 * pulse})`;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(56, 0);
      ctx.lineTo(50, -3.5);
      ctx.lineTo(44, 0);
      ctx.lineTo(50, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Center inlaid glowing mother-of-pearl / rose-quartz heart
    ctx.fillStyle = `rgba(255, 122, 188, ${0.30 * pulse})`;
    traceHeartPath(ctx, 0, 4, 34);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 228, 178, ${0.48 * pulse})`;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Inner nested heart filigree
    ctx.strokeStyle = `rgba(255, 232, 245, ${0.34 * pulse})`;
    ctx.lineWidth = 1.5;
    traceHeartPath(ctx, 0, 4, 21);
    ctx.stroke();

    ctx.restore();
  }

  _drawFighterFloorReflection(ctx, f, time) {
    const GY = this.GROUND_Y;
    const fy = typeof f.y === 'number' ? f.y : GY;
    const airH = Math.max(0, GY - fy);
    const airFade = Math.max(0.16, 1 - airH / 260);
    const isRed = f.side === 'red';
    const facing = f.facing === -1 ? -1 : 1;
    const hasSuper = (f.superMeter || 0) >= 100;
    const lowHp = typeof f.hp === 'number' && f.hp > 0 && f.hp <= 25;

    const baseRgb = isRed ? '255, 112, 184' : '96, 168, 255';
    const hiRgb = isRed ? '255, 210, 232' : '186, 226, 255';
    const pulse = hasSuper
      ? 0.85 + 0.15 * Math.sin(time * 7.0)
      : lowHp
      ? 0.78 + 0.22 * Math.sin(time * 9.0)
      : 1;

    ctx.save();

    // 1. Wet-marble colored puddle glow under fighter
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spreadX = 52 + airH * 0.14;
    const spreadY = 21 + airH * 0.04;
    const puddleY = GY + 18 + airH * 0.05;
    const rGrad = ctx.createRadialGradient(f.x, puddleY, 4, f.x, puddleY + 4, spreadX);
    rGrad.addColorStop(0.00, `rgba(${hiRgb}, ${0.30 * airFade * pulse})`);
    rGrad.addColorStop(0.45, `rgba(${baseRgb}, ${0.18 * airFade * pulse})`);
    rGrad.addColorStop(1.00, `rgba(${baseRgb}, 0)`);
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.ellipse(f.x, puddleY, spreadX, spreadY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Extra golden champagne shimmer when Super Meter is MAX
    if (hasSuper) {
      const sGrad = ctx.createRadialGradient(f.x, puddleY, 3, f.x, puddleY, spreadX * 0.85);
      sGrad.addColorStop(0, `rgba(255, 224, 136, ${0.28 * airFade * pulse})`);
      sGrad.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.ellipse(f.x, puddleY, spreadX * 0.85, spreadY * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Soft mirrored bunny silhouette reflection stretched across the wet promenade
    ctx.save();
    ctx.translate(f.x, GY + 5 + airH * 0.14);
    ctx.scale(facing, 0.42); // Vertically foreshortened upside-down reflection
    ctx.globalAlpha = 0.21 * airFade;

    const silGrad = ctx.createLinearGradient(0, 0, 0, 145);
    silGrad.addColorStop(0.00, `rgba(${baseRgb}, 0.88)`);
    silGrad.addColorStop(0.55, `rgba(${baseRgb}, 0.42)`);
    silGrad.addColorStop(1.00, `rgba(${baseRgb}, 0)`);
    ctx.fillStyle = silGrad;

    // Legs / lower stance
    ctx.beginPath();
    ctx.ellipse(-11, 20, 9, 22, 0.08, 0, Math.PI * 2);
    ctx.ellipse(11, 20, 9, 22, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.ellipse(0, 56, isRed ? 19 : 22, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, 92, isRed ? 18 : 20, 0, Math.PI * 2);
    ctx.fill();

    // Signature mirrored bunny ears!
    ctx.beginPath();
    ctx.ellipse(-7, 124, 5.5, 22, isRed ? 0.26 : -0.10, 0, Math.PI * 2);
    ctx.ellipse(7, 126, 5.5, 22, isRed ? 0.36 : 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. Delicate horizontal specular ripple streaks breaking across the reflection
    ctx.fillStyle = `rgba(${hiRgb}, ${0.14 * airFade})`;
    for (let k = 0; k < 3; k++) {
      const rw = (36 - k * 8) + Math.sin(time * 2.5 + k + f.x * 0.03) * 4;
      ctx.fillRect(f.x - rw * 0.5, GY + 14 + k * 12, rw, 1.3);
    }

    ctx.restore();
  }

  // ============================================================
  // LAYER 4: SCREEN-SPACE FOREGROUND PETALS, VIGNETTE & ROMANCE BLOOM
  // ============================================================
  drawForeground(ctx, time = this._time, romanceBloom = 0) {
    const W = this.W;
    const H = this.H;

    ctx.save();

    // 1. Delicate floating romantic hearts rising lazily in the air
    for (const h of this.floatingHearts) {
      const pulse = 0.72 + 0.28 * Math.sin(time * 2.3 + h.phase);
      const a = h.alpha * pulse;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Math.sin(time * 1.1 + h.phase) * 0.22);
      ctx.globalAlpha = a;
      ctx.fillStyle = h.warm ? '#ffd9a0' : '#ff8cc8';
      traceHeartPath(ctx, 0, 0, h.size);
      ctx.fill();
      ctx.restore();
    }

    // 2. Multi-depth 3D-tumbling cherry-blossom petals & foreground bokeh petals
    for (const p of this.petals) {
      const flipCos = Math.cos(p.flip);
      const scaleY = Math.sign(flipCos || 1) * Math.max(0.22, Math.abs(flipCos));
      const showingTop = flipCos >= 0;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.tier === 2) {
        // Large dreamy out-of-focus foreground bokeh petal / rose heart
        const glowSprite = p.isHeart ? this._glowSprites.rose : this._glowSprites.pearl;
        if (glowSprite) {
          ctx.globalAlpha = 0.26;
          ctx.drawImage(glowSprite, -p.size * 1.6, -p.size * 1.6, p.size * 3.2, p.size * 3.2);
        }
        ctx.scale(1, scaleY);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = showingTop ? p.topColor : p.bottomColor;
        if (p.isHeart) traceHeartPath(ctx, 0, 0, p.size * 0.95);
        else traceSakuraPetal(ctx, p.size);
        ctx.fill();
      } else {
        // Crisp 3D-tumbling sakura petal or petite rose heart
        ctx.scale(1, scaleY);
        ctx.globalAlpha = p.tier === 0 ? 0.52 : 0.80;
        ctx.fillStyle = showingTop ? p.topColor : p.bottomColor;

        if (p.isHeart) {
          traceHeartPath(ctx, 0, 0, p.size * 1.05);
          ctx.fill();
        } else {
          traceSakuraPetal(ctx, p.size);
          ctx.fill();
          // Subtle sunlit petal center vein highlight
          if (showingTop && p.tier === 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, p.size * 0.65);
            ctx.lineTo(0, -p.size * 0.35);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }

    // 3. Subtle dark velvet romantic vignette framing the arena
    const vig = ctx.createRadialGradient(
      W * 0.5, H * 0.48, W * 0.33,
      W * 0.5, H * 0.50, W * 0.69
    );
    vig.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.68, 'rgba(26, 5, 28, 0.14)');
    vig.addColorStop(1.00, 'rgba(18, 3, 22, 0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 4. Soft glowing pink romance bloom when romanceBloom > 0
    if (romanceBloom > 0.005) {
      const b = Math.min(1, Math.max(0, romanceBloom));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Dreamy rose-pink radial heartlight wash
      const bloom = ctx.createRadialGradient(
        W * 0.5, H * 0.46, 36,
        W * 0.5, H * 0.46, W * 0.62
      );
      bloom.addColorStop(0.00, `rgba(255, 138, 204, ${b * 0.34})`);
      bloom.addColorStop(0.48, `rgba(255, 92, 174, ${b * 0.22})`);
      bloom.addColorStop(0.82, `rgba(255, 168, 210, ${b * 0.14})`);
      bloom.addColorStop(1.00, 'rgba(255, 80, 155, 0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, W, H);

      // Soft pearlescent romantic edge bokeh orbs pulsing gently around frame perimeter
      const roseGlow = this._glowSprites.rose;
      const orbCount = 8;
      for (let i = 0; i < orbCount; i++) {
        const angle = (i / orbCount) * Math.PI * 2 + time * 0.35;
        const ox = W * 0.5 + Math.cos(angle) * (W * 0.40);
        const oy = H * 0.5 + Math.sin(angle) * (H * 0.38);
        const sz = (58 + (i % 3) * 26) * (0.85 + 0.15 * Math.sin(time * 3 + i));
        if (roseGlow) {
          ctx.globalAlpha = b * 0.38;
          ctx.drawImage(roseGlow, ox - sz * 0.5, oy - sz * 0.5, sz, sz);
        }
        ctx.globalAlpha = b * 0.24;
        ctx.fillStyle = '#ffc7e6';
        traceHeartPath(ctx, ox, oy, 10 + (i % 3) * 4);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
