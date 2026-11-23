// ============================================================================
// WIFEBUN ♥ HUSBUN — BEATDOWN SESH
// Capcom / Street Fighter III / Skullgirls-Inspired 2D Cel-Shaded
// Character & VFX Renderer (Pure ES Module, Zero External Dependencies)
// ============================================================================

const HERO_SCALE = 1.22;

export class CharacterRenderer {
  constructor(W = 960, H = 540, STAGE_W = 1480, GROUND_Y = 446, MAX_SUPER = 100) {
    this.W = W;
    this.H = H;
    this.STAGE_W = STAGE_W;
    this.GROUND_Y = GROUND_Y;
    this.MAX_SUPER = MAX_SUPER;
  }

  // ==========================================================================
  // PUBLIC API — FIGHTER DISPATCH
  // ==========================================================================
  drawFighter(ctx, f, time = 0) {
    if (!f) return;
    if (f.side === 'red') {
      this._drawWifebun(ctx, f, time);
    } else {
      this._drawHusbun(ctx, f, time);
    }
  }

  // ==========================================================================
  // 1. WIFEBUN (side === 'red') — GLAMOUR LOLA-BUNNY HONEY-CARAMEL FIGHTER
  // ==========================================================================
  _drawWifebun(ctx, f, time) {
    const dir = f.facing || 1;
    const hitFlash = (f.hitFlash || 0) > 0;

    // 3-Tone Cel Palette + Warm Moonlight Rim
    const P = {
      furHi: hitFlash ? '#ffffff' : '#f4cca6',
      furBase: hitFlash ? '#ffffff' : '#cc8b55',
      furShade: hitFlash ? '#ffe4f2' : '#8f5029',
      furDeep: hitFlash ? '#ffd6eb' : '#633117',
      cream: hitFlash ? '#ffffff' : '#fff4e8',
      creamShade: hitFlash ? '#fff0f7' : '#ebd3be',
      ink: '#260b19',
      rim: 'rgba(255, 240, 224, 0.72)',
      roseHi: hitFlash ? '#ffffff' : '#ffa6d5',
      rose: hitFlash ? '#ffffff' : '#ff3f9b',
      roseShade: hitFlash ? '#ffd6eb' : '#b81464',
      roseDeep: '#7d0a43',
      gold: '#ffd670',
      goldShade: '#d4942a',
      stocking: hitFlash ? '#ffffff' : '#fff2f7',
      stockingShade: hitFlash ? '#ffe4f2' : '#e6c2d6',
    };

    const moveId = f.move ? f.move.id : null;
    const movePhase = f.move ? f.move.phase : null;
    const isMoving = Math.abs(f.vx || 0) > 25 && f.grounded && !f.move;
    const isPearBounce = moveId === 'pear_bounce' && movePhase !== 'recover';
    const isDjSpin = moveId === 'dj_spin' && movePhase !== 'recover';
    const isCokeBurp = moveId === 'coke_burp' && movePhase !== 'recover';
    const isMangoSeed = moveId === 'mango_seed' && movePhase !== 'recover';
    const isActive = movePhase === 'active';
    const isWindup = movePhase === 'windup';
    const isStunned = (f.stunTimer || 0) > 0;
    const isBlushSwoon = (f.blushTimer || 0) > 0 && isStunned;

    const t = time * 5.6;
    const stride = Math.sin(f.runCycle || 0);
    const hipSway = isMoving ? stride * 5.2 : Math.sin(t) * 5.4;
    const koFall = f.koFallProgress || 0;
    const bounceY = f.koState
      ? 18 * koFall
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8.2
      : Math.sin(t * 2) * 2.8;

    ctx.save();
    ctx.translate(f.x, f.y);

    // Contact shadow on moonlit floor
    this._drawGroundShadow(ctx, f, 44, 11);

    // Dodge invincibility translucency + speed shimmer
    if ((f.dodgeTimer || 0) > 0) {
      ctx.globalAlpha = 0.76;
    }

    // Super-Ready / Counter-Window Anime Aura
    this._drawFighterAura(ctx, f, time, -82, 56, 94, '#ff4da6', '#ffd670');

    ctx.translate(0, bounceY);
    if (f.rollAngle) {
      ctx.translate(0, -68);
      ctx.rotate(f.rollAngle);
      ctx.translate(0, 68);
    }

    // Heroic Scale (~1.22x) + Facing (Pear Bounce spins hip-first toward opponent!)
    const bodyFlip = isPearBounce ? -dir : dir;
    const sx = (f.squashX || 1) * HERO_SCALE;
    const sy = (f.squashY || 1) * HERO_SCALE;
    ctx.scale(bodyFlip * sx, sy);

    // DJ Spin turntable whirl foreshortening
    if (f.spinAngle) {
      const sp = Math.cos(f.spinAngle);
      const clamped = Math.abs(sp) < 0.26 ? (sp >= 0 ? 0.26 : -0.26) : sp;
      ctx.scale(clamped, 1);
    }

    // K.O. dramatic tumble
    if (f.koState) {
      ctx.translate(0, 18 * koFall);
      ctx.rotate(-0.48 * koFall);
    }

    // ---- Limb Pose Angles (Fluid 2-Bone Articulation) ----
    let backHipA, backKneeA, frontHipA, frontKneeA;
    if (f.koState) {
      backHipA = 0.88; backKneeA = 0.44;
      frontHipA = 1.12; frontKneeA = 0.36;
    } else if (isPearBounce) {
      backHipA = -0.44; backKneeA = 0.34;
      frontHipA = 0.50; frontKneeA = 0.18;
    } else if (isMangoSeed && isActive) {
      backHipA = -0.52; backKneeA = 0.30;
      frontHipA = 0.44; frontKneeA = 0.25;
    } else if (!f.grounded) {
      const rising = (f.vy || 0) < 0;
      backHipA = rising ? 0.48 : 0.32;
      backKneeA = rising ? 0.78 : 0.45;
      frontHipA = rising ? -0.42 : -0.18;
      frontKneeA = rising ? 0.88 : 0.42;
    } else if (f.blocking) {
      backHipA = -0.34; backKneeA = 0.42;
      frontHipA = 0.26; frontKneeA = 0.32;
    } else if (isMoving) {
      backHipA = -stride * 0.70;
      backKneeA = Math.max(0.06, stride * 0.82);
      frontHipA = stride * 0.70;
      frontKneeA = Math.max(0.06, -stride * 0.82);
    } else {
      backHipA = -0.24 - Math.sin(t) * 0.04;
      backKneeA = 0.22;
      frontHipA = 0.22 + Math.sin(t) * 0.04;
      frontKneeA = 0.14;
    }

    // ---- BACK LEG ----
    this._drawWifebunLeg(
      ctx, -6 + hipSway * 0.26, -48,
      backHipA, backKneeA,
      P.furShade, P.furDeep, P.stockingShade, P.roseShade, P.roseDeep, P.goldShade, P.ink, true
    );

    // ---- BACK ARM ----
    let bShA, bElA;
    if (f.blocking) { bShA = -1.18; bElA = -0.88; }
    else if (isPearBounce) { bShA = 0.72; bElA = -0.55; }
    else if (isDjSpin) { bShA = -0.25; bElA = -0.20; }
    else if (isCokeBurp) { bShA = isWindup ? -1.05 : 0.45; bElA = -0.75; }
    else if (isMangoSeed) { bShA = isActive ? 0.85 : -0.95; bElA = -0.55; }
    else if (isStunned) { bShA = -0.95; bElA = -0.45; }
    else if (isMoving) { bShA = stride * 0.62 - 0.1; bElA = -0.75; }
    else { bShA = -0.42 + Math.sin(t) * 0.16; bElA = -0.80; }

    this._drawWifebunArm(
      ctx, 9 + hipSway * 0.25, -86,
      bShA, bElA,
      P.furShade, P.furDeep, P.roseShade, P.goldShade, P.ink, false
    );

    // ---- CURVY HOURGLASS TORSO + DRAMATIC EXPANDING PEAR-BOUNCE BOOTY ----
    const torsoRot = isPearBounce
      ? 0.42
      : isBlushSwoon
      ? -0.18
      : isStunned
      ? -0.22
      : isCokeBurp
      ? (isWindup ? -0.22 : 0.16)
      : isMangoSeed
      ? (isWindup ? -0.18 : 0.18)
      : isActive
      ? 0.12
      : isWindup
      ? -0.14
      : isMoving
      ? 0.10
      : Math.sin(t) * 0.055;

    ctx.save();
    ctx.translate(hipSway * 0.36, 0);
    ctx.rotate(torsoRot);

    // Expanding Pear-Bounce Booty & Plush Cotton Bunny Tail!
    const bs = Math.max(1, f.buttScale || 1);
    this._drawWifebunButtAndTail(ctx, bs, P, hitFlash, time);

    // Sculpted Hourglass Honey-Caramel Midriff & Waist
    const torsoGrad = ctx.createLinearGradient(-15, -94, 17, -48);
    torsoGrad.addColorStop(0, P.furHi);
    torsoGrad.addColorStop(0.52, P.furBase);
    torsoGrad.addColorStop(1, P.furShade);

    ctx.fillStyle = torsoGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-11.5, -92);
    ctx.bezierCurveTo(-17.5, -78, -6.5, -63, -13.5, -49);
    ctx.quadraticCurveTo(0, -45, 15.5, -49);
    ctx.bezierCurveTo(10.5, -62, 19.5, -77, 14.5, -92);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Warm cream tummy contour + subtle navel accent
    ctx.fillStyle = P.cream;
    ctx.beginPath();
    ctx.ellipse(4.5, -64.5, 6.2, 11.2, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(143, 80, 41, 0.38)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(4.8, -59.5, 1.4, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // Glamour Satin Sweetheart Blush-Pink Crop Corset Top
    const topGrad = ctx.createLinearGradient(-15, -93, 18, -66);
    topGrad.addColorStop(0, P.roseHi);
    topGrad.addColorStop(0.42, P.rose);
    topGrad.addColorStop(1, P.roseShade);
    ctx.fillStyle = topGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-13.5, -89.5);
    ctx.bezierCurveTo(-7, -96.5, 0, -93, 3.5, -88.2);
    ctx.bezierCurveTo(9, -95.5, 15.5, -93, 17.5, -84.5);
    ctx.bezierCurveTo(20.5, -74, 15.5, -68, 12.5, -67.5);
    ctx.quadraticCurveTo(0.5, -64.5, -13.5, -69.5);
    ctx.bezierCurveTo(-16, -76, -16, -83, -13.5, -89.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Satin specular sheen & corset boning highlights
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(255, 240, 248, 0.44)';
      ctx.beginPath();
      ctx.ellipse(9.5, -82.5, 4.4, 2.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-5.5, -83.5, 3.6, 2.0, 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Subtle corset seam lines
      ctx.strokeStyle = 'rgba(125, 10, 67, 0.35)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-4, -85); ctx.quadraticCurveTo(-5, -76, -4, -67.5);
      ctx.moveTo(6, -84); ctx.quadraticCurveTo(7.5, -76, 6.5, -67);
      ctx.stroke();
    }

    // Gold sweetheart trim + gleaming heart charm
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(-12.5, -89.2);
    ctx.quadraticCurveTo(-3.5, -94.5, 3.5, -88.0);
    ctx.quadraticCurveTo(11, -94.2, 16.2, -85.2);
    ctx.stroke();
    this._drawHeart(ctx, 4.2, -80.2, 4.6, P.gold);
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath();
    ctx.arc(3.0, -81.4, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Cheeky High-Waisted Rose Shorts with Satin Waistband & Side Bow
    const shortGrad = ctx.createLinearGradient(-15, -56, 16, -39);
    shortGrad.addColorStop(0, P.roseHi);
    shortGrad.addColorStop(0.35, P.rose);
    shortGrad.addColorStop(1, P.roseShade);
    ctx.fillStyle = shortGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-14.5, -55);
    ctx.quadraticCurveTo(0, -57.5, 15.5, -55);
    ctx.quadraticCurveTo(18, -46, 15, -40.5);
    ctx.quadraticCurveTo(7, -38.5, 2, -42.5);
    ctx.quadraticCurveTo(-5, -38.5, -14.5, -41.5);
    ctx.quadraticCurveTo(-17, -48, -14.5, -55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold & blush waistband trim + cute satin hip bow
    ctx.fillStyle = '#ffd6ec';
    ctx.beginPath();
    ctx.roundRect(-14.2, -55.5, 29.4, 4.2, 2);
    ctx.fill();
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-13.8, -51.4); ctx.lineTo(14.8, -51.4);
    ctx.stroke();

    // Tiny satin ribbon bow on front hip
    ctx.fillStyle = P.roseHi;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(9.5, -52.5, 4.2, 2.4, -0.35, 0, Math.PI * 2);
    ctx.ellipse(14.5, -52.2, 4.0, 2.3, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.arc(12, -52.4, 2.1, 0, Math.PI * 2); ctx.fill();

    // Moonlight back-rim accent along spine
    if (!hitFlash) {
      ctx.strokeStyle = P.rim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-12.5, -88);
      ctx.quadraticCurveTo(-15.5, -75, -11.5, -62);
      ctx.stroke();
    }

    ctx.restore(); // torso

    // ---- FRONT LEG ----
    this._drawWifebunLeg(
      ctx, 6 + hipSway * 0.26, -48,
      frontHipA, frontKneeA,
      P.furBase, P.furShade, P.stocking, P.rose, P.roseShade, P.gold, P.ink, false
    );

    // ---- EXPRESSIVE SULTRY LOLA-STYLE HEAD ----
    ctx.save();
    ctx.translate(3 + hipSway * 0.38, -113 + (isStunned ? 4 : 0));
    // On Pear Bounce, peek cheekily back over her shoulder toward Husbun!
    if (isPearBounce) {
      ctx.translate(-5, 3);
      ctx.scale(-1, 1);
      ctx.rotate(-0.14);
    } else {
      ctx.rotate(isStunned ? -0.22 : isCokeBurp && isWindup ? -0.18 : isActive ? 0.10 : Math.sin(t) * 0.055);
    }
    this._drawWifebunHead(ctx, f, time, isPearBounce);
    ctx.restore();

    // ---- FRONT ARM (Expressive pose per move!) ----
    let fShA, fElA, extended = false;
    if (f.blocking) {
      fShA = -1.32; fElA = -1.08;
    } else if (isPearBounce) {
      // Sassy hand planted on hip while bouncing!
      fShA = 0.62; fElA = 1.18;
    } else if (isDjSpin) {
      fShA = -0.32; fElA = 0.18; extended = true;
    } else if (isCokeBurp) {
      // Holding frosty cola can near mouth during windup, thrust out on active
      fShA = isWindup ? -0.92 : -0.18;
      fElA = isWindup ? -1.22 : -0.25;
    } else if (isMangoSeed) {
      fShA = isWindup ? 0.92 : -0.14;
      fElA = isWindup ? -0.95 : 0.04;
      extended = isActive;
    } else if (isStunned) {
      fShA = 0.65; fElA = -0.75;
    } else if (isMoving) {
      fShA = -stride * 0.65 + 0.15;
      fElA = -0.82;
    } else {
      // Sassy flirty fighting stance
      fShA = 0.24 + Math.sin(t) * 0.14;
      fElA = -0.92 - Math.sin(t) * 0.18;
    }

    this._drawWifebunArm(
      ctx, -4 + hipSway * 0.30, -86,
      fShA, fElA,
      P.furBase, P.furShade, P.rose, P.gold, P.ink, extended,
      isMangoSeed && isActive ? '#ffb703' : null
    );

    // ---- GUARD BARRIER ----
    if (f.blocking) {
      this._drawGuardBarrier(ctx, 32, -74, 42, '#ffd670', '#ff69b4', time);
    }

    ctx.restore();
  }

  _drawWifebunButtAndTail(ctx, bs, P, hitFlash, time) {
    ctx.save();
    // Smoothly shifts rearward & billows dramatically as buttScale grows to ~3.2x!
    const grow = bs - 1;
    ctx.translate(-11 - grow * 14.5, -45.5 - grow * 2.5);

    if (bs > 1.25) {
      // Glowing rose-gold aura behind expanding Pear Bounce!
      ctx.save();
      const auraR = 22 * bs;
      const aura = ctx.createRadialGradient(0, 0, auraR * 0.3, 0, 0, auraR * 1.45);
      aura.addColorStop(0, 'rgba(255, 119, 186, 0.58)');
      aura.addColorStop(0.6, 'rgba(255, 214, 112, 0.32)');
      aura.addColorStop(1, 'rgba(255, 119, 186, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, auraR * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Plush contoured pear/heart-curve booty with 3-tone satin cel-shading!
    const rx = 16.5 * bs;
    const ry = 15.2 * bs;
    const buttGrad = ctx.createRadialGradient(-4.5 * bs, -5.5 * bs, 2 * bs, 1 * bs, 2 * bs, 21 * bs);
    buttGrad.addColorStop(0, hitFlash ? '#ffffff' : '#ffc2e2');
    buttGrad.addColorStop(0.38, hitFlash ? '#ffffff' : P.rose);
    buttGrad.addColorStop(0.84, hitFlash ? '#ffe4f2' : P.roseShade);
    buttGrad.addColorStop(1, hitFlash ? '#ffd6eb' : P.roseDeep);

    ctx.fillStyle = buttGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.4 + Math.min(1.0, grow * 0.35);

    // Sculpted voluptuous pear-heart curve (subtle crease hint when huge!)
    ctx.beginPath();
    ctx.moveTo(rx * 0.65, -ry * 0.72);
    ctx.bezierCurveTo(-rx * 0.35, -ry * 1.12, -rx * 1.15, -ry * 0.52, -rx * 1.02, ry * 0.14);
    ctx.bezierCurveTo(-rx * 0.92, ry * 0.95, -rx * 0.05, ry * 1.14, rx * 0.62, ry * 0.78);
    ctx.bezierCurveTo(rx * 1.04, ry * 0.48, rx * 1.05, -ry * 0.36, rx * 0.65, -ry * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glossy satin specular crescent + secondary rim light!
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(255, 245, 252, 0.58)';
      ctx.beginPath();
      ctx.ellipse(-4.8 * bs, -5.2 * bs, 6.2 * bs, 3.6 * bs, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-7.2 * bs, -6.5 * bs, 2.2 * bs, 1.3 * bs, -0.45, 0, Math.PI * 2);
      ctx.fill();

      // Glowing gold shimmer ring on big Pear Bounce!
      if (bs > 1.5) {
        ctx.strokeStyle = 'rgba(255, 214, 112, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, rx * 1.08, Math.PI * 0.62, Math.PI * 1.48);
        ctx.stroke();
        // Cute cheek-bounce sparkle star
        this._drawSparkleStar(ctx, -rx * 0.82, -ry * 0.65, 5.5 + Math.sin(time * 18) * 1.8, '#fff7cc');
      }
    }

    // Fluffy Multi-Puff Cotton Bunny Tail!
    const tailX = -11.5 * bs;
    const tailY = -6.5 * bs * 0.68;
    const tr = 8.2 + grow * 3.4;
    ctx.fillStyle = hitFlash ? '#ffffff' : '#fffaf7';
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(tailX, tailY, tr, 0, Math.PI * 2);
    ctx.arc(tailX - tr * 0.48, tailY - tr * 0.32, tr * 0.64, 0, Math.PI * 2);
    ctx.arc(tailX + tr * 0.38, tailY - tr * 0.44, tr * 0.58, 0, Math.PI * 2);
    ctx.arc(tailX - tr * 0.24, tailY + tr * 0.44, tr * 0.56, 0, Math.PI * 2);
    ctx.fill();
    // Clean outer cloud contour stroke
    ctx.beginPath();
    ctx.arc(tailX - tr * 0.12, tailY - tr * 0.05, tr * 1.02, 0, Math.PI * 2);
    ctx.stroke();
    // Soft lavender-pink cel shadow underside on tail
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(235, 196, 218, 0.52)';
      ctx.beginPath();
      ctx.arc(tailX + tr * 0.18, tailY + tr * 0.25, tr * 0.68, 0.1, Math.PI * 0.95);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawWifebunHead(ctx, f, time = 0, isPearBounce = false) {
    const hitFlash = (f.hitFlash || 0) > 0;
    const furBase = hitFlash ? '#ffffff' : '#cc8b55';
    const furHi = hitFlash ? '#ffffff' : '#f4cca6';
    const furShade = hitFlash ? '#ffe4f2' : '#8f5029';
    const cream = hitFlash ? '#ffffff' : '#fff4e8';
    const ink = '#260b19';
    const rose = hitFlash ? '#ffffff' : '#ff3f9b';
    const roseHi = '#ffa6d5';
    const roseShade = '#b81464';

    // ---- LONG SILKY PONYTAIL BUNNY EARS + SATIN SCRUNCHIE & FLOWING RIBBONS ----
    const earLag = f.earLag || 0;
    const earSway = Math.sin(time * 5.8) * 0.085 + earLag;
    const ribbonWave = Math.sin(time * 7.8) * 5.5 + earLag * 24;

    ctx.save();
    ctx.translate(-12, -16);

    // Two flowing satin ribbon tails behind scrunchie
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6.2;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.bezierCurveTo(-18, -2 + ribbonWave * 0.5, -26, 8 + ribbonWave, -34, 19 + ribbonWave * 0.7);
    ctx.stroke();
    ctx.strokeStyle = rose;
    ctx.lineWidth = 3.4;
    ctx.stroke();

    ctx.strokeStyle = ink;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.bezierCurveTo(-22, -10 + ribbonWave * 0.6, -32, -2 + ribbonWave * 1.1, -39, 7 + ribbonWave * 0.9);
    ctx.stroke();
    ctx.strokeStyle = roseHi;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Back silky ponytail ear & front silky ponytail ear
    const ears = [
      { a: -1.04 + earSway * 1.15, col: furShade, hi: furBase, len: 53, w: 13.5 },
      { a: -0.66 + earSway * 0.75, col: furBase, hi: furHi, len: 58, w: 14.5 },
    ];
    for (const e of ears) {
      ctx.save();
      ctx.rotate(e.a);
      const earGrad = ctx.createLinearGradient(-e.w, 0, e.w, -e.len);
      earGrad.addColorStop(0, e.col);
      earGrad.addColorStop(0.65, e.hi);
      earGrad.addColorStop(1, e.col);
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.bezierCurveTo(-e.w * 1.15, -e.len * 0.35, -e.w * 1.18, -e.len * 0.85, -1, -e.len);
      ctx.bezierCurveTo(e.w * 1.05, -e.len * 0.88, e.w * 0.95, -e.len * 0.35, 5.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Soft blush-pink inner ear gradient
      if (!hitFlash) {
        const innerGrad = ctx.createLinearGradient(0, -e.len * 0.22, 0, -e.len * 0.84);
        innerGrad.addColorStop(0, '#ff8fc7');
        innerGrad.addColorStop(1, '#ffd4ea');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.moveTo(-2.5, -e.len * 0.18);
        ctx.bezierCurveTo(-6.2, -e.len * 0.48, -5.8, -e.len * 0.78, 0, -e.len * 0.86);
        ctx.bezierCurveTo(5.6, -e.len * 0.78, 5.2, -e.len * 0.48, 2.5, -e.len * 0.18);
        ctx.closePath();
        ctx.fill();

        // Silky moonlight sheen along outer ear curve
        ctx.strokeStyle = 'rgba(255, 244, 232, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-e.w * 0.62, -e.len * 0.32);
        ctx.quadraticCurveTo(-e.w * 0.82, -e.len * 0.68, -2.5, -e.len * 0.92);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Plush Satin Rose-Pink Scrunchie with Ruffle Folds
    ctx.save();
    ctx.translate(-7.5, -9.5);
    ctx.rotate(-0.76);
    const scrGrad = ctx.createLinearGradient(0, -6, 0, 6);
    scrGrad.addColorStop(0, '#ffb3da');
    scrGrad.addColorStop(0.5, rose);
    scrGrad.addColorStop(1, roseShade);
    ctx.fillStyle = scrGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Scrunchie gathers & pearl highlight
    ctx.strokeStyle = roseShade;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-5, -4.5); ctx.quadraticCurveTo(-3, 0, -5, 4.5);
    ctx.moveTo(4.5, -4.5); ctx.quadraticCurveTo(3, 0, 4.5, 4.5);
    ctx.stroke();
    ctx.fillStyle = '#fff5fa';
    ctx.beginPath();
    ctx.ellipse(-1.5, -2.2, 3.2, 1.4, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore(); // ears

    // ---- SCULPTED HONEY-CARAMEL HEAD WITH CHEEKBONE CURVE & RIM LIGHT ----
    const headGrad = ctx.createRadialGradient(-5, -10, 3, 1, 2, 29);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.62, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-22.5, -3);
    ctx.bezierCurveTo(-24, -18, -10, -23.5, 3, -22.5);
    ctx.bezierCurveTo(17, -21.5, 24.5, -11, 23.5, 1.5);
    ctx.bezierCurveTo(23, 12.5, 14, 21.5, 1, 21.5);
    ctx.bezierCurveTo(-13.5, 21.5, -21.5, 11.5, -22.5, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft moonlight highlight rim along upper skull
    if (!hitFlash) {
      ctx.strokeStyle = 'rgba(255, 242, 224, 0.58)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -1, 20.5, Math.PI * 1.12, Math.PI * 1.65);
      ctx.stroke();
    }

    // ---- FLUFFY SWEPT GLAM LOLA BANGS ----
    const bangsGrad = ctx.createLinearGradient(-12, -26, 20, -10);
    bangsGrad.addColorStop(0, furHi);
    bangsGrad.addColorStop(0.7, furBase);
    bangsGrad.addColorStop(1, furShade);
    ctx.fillStyle = bangsGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.bezierCurveTo(-2, -31, 14, -27, 22, -13);
    ctx.quadraticCurveTo(12, -16.5, 6, -11.5);
    ctx.quadraticCurveTo(1, -15.5, -5.5, -9.5);
    ctx.quadraticCurveTo(-9, -14, -12, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ---- DJ SPIN GLOWING HEADPHONES ----
    if (f.move && f.move.id === 'dj_spin') {
      ctx.save();
      ctx.strokeStyle = '#ff69b4';
      ctx.shadowColor = '#ff4da6';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.arc(0, -3.5, 27.5, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-30, -10, 9.5, 20, 4.5);
      ctx.roundRect(20.5, -10, 9.5, 20, 4.5);
      ctx.fill();
      ctx.stroke();
      // Pulsing neon equalizer glow dot on earcup
      const eq = 0.6 + 0.4 * Math.sin(time * 24);
      ctx.fillStyle = `rgba(255, 105, 180, ${eq})`;
      ctx.beginPath();
      ctx.arc(25.2, 0, 2.8, 0, Math.PI * 2);
      ctx.arc(-25.2, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- SOFT CREAM MUZZLE (Dramatic puff on Coke Burp!) ----
    const cheekPuff = f.cheekPuff || 0;
    const puff = 1 + cheekPuff * 0.72;
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.ellipse(12.5, 7.5, 10.8 * puff, 7.8 * puff, -0.05, 0, Math.PI * 2);
    ctx.fill();
    if (cheekPuff > 0.15) {
      // Comic puffed cheek outline + pressurized blush!
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 86, 152, ${0.42 + cheekPuff * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(6.5, 8.5, 6.2 * puff, 4.2 * puff, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- CUTE HEART-SHAPED ROSE NOSE ----
    ctx.fillStyle = rose;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(15.2, 2.2);
    ctx.quadraticCurveTo(18.5, 1.2, 20.4, 3.8);
    ctx.quadraticCurveTo(18.4, 6.8, 15.6, 6.5);
    ctx.quadraticCurveTo(14.0, 4.4, 15.2, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(17.2, 3.3, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // ---- WARM ROSY BLUSH (Intense swoon blush when Forehead Kissed!) ----
    const blushing = (f.blushTimer || 0) > 0;
    const blushAlpha = blushing ? 0.82 : 0.48;
    const blushGrad = ctx.createRadialGradient(2.5, 7.5, 1, 2.5, 7.5, blushing ? 10.5 : 7);
    blushGrad.addColorStop(0, `rgba(255, 58, 140, ${blushAlpha})`);
    blushGrad.addColorStop(1, 'rgba(255, 118, 178, 0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(2.5, 7.5, blushing ? 10.5 : 7.0, blushing ? 5.8 : 3.8, -0.06, 0, Math.PI * 2);
    ctx.fill();
    if (blushing) {
      // Cute anime blush diagonal hatch lines!
      ctx.strokeStyle = 'rgba(255, 36, 118, 0.72)';
      ctx.lineWidth = 1.3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(2.5 + i * 3.4 - 1.2, 9.5);
        ctx.lineTo(2.5 + i * 3.4 + 1.4, 5.8);
        ctx.stroke();
      }
    }

    // ---- GLOSSY ROSE LIPS (Kissy Pout / Cheeky Smile / Burp / Dizzy) ----
    ctx.strokeStyle = '#4d1a2c';
    ctx.lineWidth = 1.7;
    if (f.move && f.move.id === 'coke_burp' && f.move.phase === 'active') {
      ctx.fillStyle = '#5c2112';
      ctx.beginPath();
      ctx.ellipse(16.5, 10.2, 5.6, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if ((f.winkTimer || 0) > 0 || (f.heartEyesTimer || 0) > 0 || isPearBounce) {
      // Glossy sculpted kissy pout!
      ctx.fillStyle = '#ff2f92';
      ctx.beginPath();
      ctx.ellipse(15.2, 9.2, 3.6, 2.1, -0.15, 0, Math.PI * 2);
      ctx.ellipse(15.6, 11.4, 3.8, 2.3, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a0f4d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(12.2, 10.2); ctx.quadraticCurveTo(15.4, 10.8, 18.4, 10.0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(16.4, 11.2, 1.6, 0.8, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.koState) {
      ctx.beginPath();
      ctx.arc(13.5, 11.2, 3.3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Cheeky glamorous smile with glossy rose lip tint
      ctx.fillStyle = '#ff5cab';
      ctx.beginPath();
      ctx.ellipse(14.8, 10.5, 4.6, 2.4, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(9.4, 9.4);
      ctx.quadraticCurveTo(14.8, 13.8, 19.6, 8.6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(15.4, 10.1, 1.8, 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- BIG EXPRESSIVE GLEAMING ALMOND VIOLET-AMBER EYES ----
    const isBlinking = !f.koState && (time % 3.7) > 3.56;
    if (f.koState) {
      ctx.strokeStyle = '#ffd670';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const ex of [5, 16]) {
        ctx.beginPath();
        ctx.moveTo(ex - 3.4, -6.5); ctx.lineTo(ex + 3.4, 0.3);
        ctx.moveTo(ex + 3.4, -6.5); ctx.lineTo(ex - 3.4, 0.3);
        ctx.stroke();
      }
      // Swirling dizzy hearts & stars
      for (let i = 0; i < 3; i++) {
        const a = time * 5.2 + (i * Math.PI * 2) / 3;
        const hx = Math.cos(a) * 25;
        const hy = -31 + Math.sin(a) * 6.5;
        if (i % 2 === 0) this._drawHeart(ctx, hx, hy, 6.2, '#ff77ba');
        else this._drawSparkleStar(ctx, hx, hy, 5.5, '#ffd670');
      }
    } else if ((f.heartEyesTimer || 0) > 0 || (f.counterWindow || 0) > 0) {
      const pulse = 1 + Math.sin(time * 16) * 0.14;
      for (const ex of [5, 16]) {
        this._drawHeart(ctx, ex, -3.2, 7.2 * pulse, '#ff2e93');
        this._drawHeart(ctx, ex - 0.8, -4.4, 3.0 * pulse, '#ffcce6');
      }
    } else {
      const eyes = [
        { ex: 4.8, rx: 6.2, ry: 6.9, isFront: false },
        { ex: 16.0, rx: 5.0, ry: 6.7, isFront: true },
      ];
      for (const eye of eyes) {
        const winkThisEye = ((f.winkTimer || 0) > 0 || isPearBounce) && eye.isFront;
        if (isBlinking || winkThisEye) {
          // Sultry curved wink with sweeping winged lash!
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(eye.ex, -1.6, 4.6, Math.PI * 1.12, Math.PI * 1.92);
          ctx.stroke();
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          ctx.moveTo(eye.ex - 4.0, -2.0);
          ctx.quadraticCurveTo(eye.ex - 7.5, -3.5, eye.ex - 9.4, -6.4);
          ctx.stroke();
        } else {
          const { ex, rx, ry } = eye;
          // Crisp white almond sclera
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(ex, -3.4, rx, ry, -0.06, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Multi-tone gleaming Violet-to-Amber iris!
          const irisGrad = ctx.createLinearGradient(ex, -3.4 - ry * 0.7, ex, -3.4 + ry * 0.7);
          irisGrad.addColorStop(0, '#4a177a');
          irisGrad.addColorStop(0.52, '#8b3fd1');
          irisGrad.addColorStop(0.84, '#f59e0b');
          irisGrad.addColorStop(1, '#fde68a');
          ctx.fillStyle = irisGrad;
          ctx.beginPath();
          ctx.ellipse(ex + 1.0, -2.9, rx * 0.68, ry * 0.74, 0, 0, Math.PI * 2);
          ctx.fill();

          // Deep pupil
          ctx.fillStyle = '#1c081a';
          ctx.beginPath();
          ctx.ellipse(ex + 1.2, -3.0, rx * 0.36, ry * 0.42, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dual anime specular sparkles
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + 2.2, -5.8, 2.2, 0, Math.PI * 2);
          ctx.arc(ex - 0.8, -0.6, 1.05, 0, Math.PI * 2);
          ctx.fill();

          // Shimmering rose-plum sultry upper eyelid
          const lidGrad = ctx.createLinearGradient(ex, -10.5, ex, -4.0);
          lidGrad.addColorStop(0, 'rgba(255, 130, 198, 0.82)');
          lidGrad.addColorStop(1, 'rgba(186, 48, 128, 0.62)');
          ctx.fillStyle = lidGrad;
          ctx.beginPath();
          ctx.arc(ex, -4.6, rx + 0.5, Math.PI * 1.02, Math.PI * 1.98);
          ctx.closePath();
          ctx.fill();

          // Sweeping winged eyeliner & lush curved lashes!
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(ex, -4.2, rx + 0.6, Math.PI * 1.02, Math.PI * 1.98);
          ctx.stroke();

          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(ex - rx + 0.4, -4.8);
          ctx.quadraticCurveTo(ex - rx - 3.6, -6.4, ex - rx - 5.6, -9.8);
          ctx.moveTo(ex - rx * 0.45, -8.8);
          ctx.quadraticCurveTo(ex - rx * 0.75, -11.2, ex - rx - 1.4, -13.2);
          ctx.stroke();

          // Delicate arched glam eyebrow
          ctx.strokeStyle = '#5c2c16';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(ex - rx * 0.7, -12.2);
          ctx.quadraticCurveTo(ex + 0.5, -14.8, ex + rx * 0.8, -11.6);
          ctx.stroke();
        }
      }
    }
  }

  _drawWifebunLeg(ctx, x, y, hipA, kneeA, furCol, furShade, stockCol, bootCol, bootShade, goldCol, ink, isBack) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);

    // Sculpted curvy honey-caramel thigh (organic tapered bezier!)
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-7.2, -2);
    ctx.bezierCurveTo(-8.8, 7, -6.5, 17, -4.8, 24);
    ctx.quadraticCurveTo(0, 26, 5.2, 24);
    ctx.bezierCurveTo(7.4, 16, 8.6, 6, 6.8, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cel-shade inner thigh strip
    if (!isBack) {
      ctx.fillStyle = furShade;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(-4.2, 11, 2.4, 9.5, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- KNEE -> CALF (Sheer Cream Thigh-High Stocking + Lace Garter + Heeled Boot) ----
    ctx.translate(0, 22.5);
    ctx.rotate(kneeA);

    // Sculpted calf in sheer cream stocking
    ctx.fillStyle = stockCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-5.2, -3);
    ctx.bezierCurveTo(-6.2, 5, -4.5, 13, -3.8, 19);
    ctx.lineTo(4.2, 19);
    ctx.bezierCurveTo(6.4, 11, 6.2, 4, 5.0, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rose lace garter band + tiny side bow!
    ctx.fillStyle = bootCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-5.8, -3.5, 11.6, 4.4, 2);
    ctx.fill();
    ctx.stroke();
    // Little garter bow
    ctx.fillStyle = '#ffb3da';
    ctx.beginPath();
    ctx.arc(5.4, -1.2, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Sleek Rose-Pink Heeled Fighter Boot!
    const bootGrad = ctx.createLinearGradient(-5, 12, 14, 26);
    bootGrad.addColorStop(0, isBack ? bootCol : '#ff85c0');
    bootGrad.addColorStop(0.5, bootCol);
    bootGrad.addColorStop(1, bootShade);
    ctx.fillStyle = bootGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-5.0, 12);
    ctx.lineTo(5.2, 12);
    ctx.quadraticCurveTo(8.5, 18, 15.2, 22.5);
    ctx.quadraticCurveTo(16.2, 25.5, 12.8, 26.2);
    ctx.lineTo(-1.2, 26.2);
    ctx.lineTo(-2.5, 22.5);
    ctx.lineTo(-4.0, 26.2);
    ctx.lineTo(-6.6, 26.2);
    ctx.lineTo(-5.8, 17.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold ankle cuff & platform sole highlight
    ctx.fillStyle = goldCol;
    ctx.fillRect(-5.0, 11.6, 10.2, 2.8);
    ctx.fillRect(0.2, 23.6, 13.8, 2.2);

    ctx.restore();
  }

  _drawWifebunArm(ctx, x, y, shA, elA, furCol, furShade, gloveCol, goldCol, ink, extended = false, energyGlow = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);

    // Tapered organic upper arm
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-4, -4.4);
    ctx.bezierCurveTo(4, -5.2, 14, -4.4, 19.5, -3.4);
    ctx.quadraticCurveTo(21.5, 0, 19.5, 3.4);
    ctx.bezierCurveTo(13, 4.8, 4, 5.2, -4, 4.4);
    ctx.quadraticCurveTo(-6, 0, -4, -4.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forearm + Fingerless Rose Opera-Fighter Glove!
    ctx.translate(18.5, 0);
    ctx.rotate(elA);
    const fLen = extended ? 24 : 18.5;

    ctx.fillStyle = furCol;
    ctx.beginPath();
    ctx.moveTo(-2.5, -3.8);
    ctx.bezierCurveTo(5, -4.4, fLen * 0.7, -3.4, fLen, -2.8);
    ctx.lineTo(fLen, 2.8);
    ctx.bezierCurveTo(fLen * 0.7, 3.8, 5, 4.4, -2.5, 3.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Satin rose forearm cuff with gold wrist ring
    ctx.fillStyle = gloveCol;
    ctx.beginPath();
    ctx.roundRect(fLen * 0.32, -4.1, fLen * 0.68, 8.2, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = goldCol;
    ctx.fillRect(fLen * 0.30, -4.1, 3.0, 8.2);

    // Expressive fighter glove fist/hand
    if (energyGlow) {
      ctx.save();
      ctx.shadowColor = energyGlow;
      ctx.shadowBlur = 20;
      ctx.fillStyle = energyGlow;
      ctx.beginPath();
      ctx.arc(fLen + 3.5, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = gloveCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    const gr = extended ? 9.2 : 7.4;
    ctx.beginPath();
    ctx.ellipse(fLen + 3.2, 0, gr, gr * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Glove knuckle highlight
    ctx.fillStyle = 'rgba(255, 224, 242, 0.62)';
    ctx.beginPath();
    ctx.ellipse(fLen + 4.8, -gr * 0.32, gr * 0.42, gr * 0.24, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ==========================================================================
  // 2. HUSBUN (side === 'blue') — TALL SUAVE BUGS-BUNNY ESPRESSO FIGHTER
  // ==========================================================================
  _drawHusbun(ctx, f, time) {
    const dir = f.facing || 1;
    const hitFlash = (f.hitFlash || 0) > 0;

    // 3-Tone Cel Palette + Warm Moonlight Rim
    const P = {
      furHi: hitFlash ? '#ffffff' : '#a36e47',
      furBase: hitFlash ? '#ffffff' : '#6c4023',
      furShade: hitFlash ? '#dbeafe' : '#432411',
      furDeep: '#2b1508',
      cream: hitFlash ? '#ffffff' : '#f8e9d6',
      creamShade: hitFlash ? '#eff6ff' : '#dfc6aa',
      ink: '#1b0c12',
      rim: 'rgba(255, 236, 206, 0.62)',
      jacketHi: hitFlash ? '#ffffff' : '#315eb0',
      jacket: hitFlash ? '#ffffff' : '#1b3770',
      jacketShade: hitFlash ? '#bfdbfe' : '#0f2047',
      jacketDeep: '#09132b',
      gold: '#ffd670',
      goldShade: '#c98821',
      glove: '#ffffff',
      gloveShade: '#dce6f5',
      shoe: '#2563eb',
      shoeShade: '#173e9e',
    };

    const moveId = f.move ? f.move.id : null;
    const movePhase = f.move ? f.move.phase : null;
    const isMoving = Math.abs(f.vx || 0) > 25 && f.grounded && !f.move;
    const isWhiteClaw = moveId === 'white_claw' && movePhase !== 'recover';
    const isHeightMog = moveId === 'height_mog' && movePhase !== 'recover';
    const isKissing = moveId === 'forehead_kiss' && movePhase !== 'recover';
    const isEypReport = moveId === 'eyp_report' && movePhase !== 'recover';
    const isActive = movePhase === 'active';
    const isWindup = movePhase === 'windup';
    const isStunned = (f.stunTimer || 0) > 0;

    const t = time * 5.0 + 1.4;
    const stride = Math.sin(f.runCycle || 0);
    const koFall = f.koFallProgress || 0;
    const bounceY = f.koState
      ? 18 * koFall
      : !f.grounded
      ? 0
      : isMoving
      ? -Math.abs(stride) * 8.4
      : Math.sin(t * 2) * 2.6;

    ctx.save();
    ctx.translate(f.x, f.y);

    // Ground shadow
    this._drawGroundShadow(ctx, f, 50, 11.8);

    if ((f.dodgeTimer || 0) > 0) {
      ctx.globalAlpha = 0.76;
    }

    // Super-Ready / Counter-Window Aura
    this._drawFighterAura(ctx, f, time, -98, 66, 112, '#60a5fa', '#ffd670');

    ctx.translate(0, bounceY);
    if (f.rollAngle) {
      ctx.translate(0, -76);
      ctx.rotate(f.rollAngle);
      ctx.translate(0, 76);
    }

    // Heroic Scale (~1.22x)
    const sx = (f.squashX || 1) * HERO_SCALE;
    const sy = (f.squashY || 1) * HERO_SCALE;
    ctx.scale(dir * sx, sy);

    if (f.koState) {
      ctx.translate(0, 20 * koFall);
      ctx.rotate(-0.48 * koFall);
    }

    // Looney-Tunes Height Mog accordion tall-stretch!
    const stretchH = f.stretchH || 0;
    const legStretch = stretchH * 0.46;
    const hipY = -63 - legStretch;
    const torsoH = 62 + stretchH * 0.54;
    const torsoTop = hipY - torsoH;

    // ---- Limb Pose Angles ----
    let backHipA, backKneeA, frontHipA, frontKneeA;
    if (f.koState) {
      backHipA = 0.88; backKneeA = 0.42;
      frontHipA = 1.08; frontKneeA = 0.36;
    } else if (isHeightMog) {
      // Towering proud stance
      backHipA = -0.14; backKneeA = 0.12;
      frontHipA = 0.14; frontKneeA = 0.08;
    } else if (isKissing) {
      // Suave romantic forward dip!
      backHipA = -0.45; backKneeA = 0.25;
      frontHipA = 0.42; frontKneeA = 0.32;
    } else if (!f.grounded) {
      const rising = (f.vy || 0) < 0;
      backHipA = rising ? 0.45 : 0.30;
      backKneeA = rising ? 0.72 : 0.45;
      frontHipA = rising ? -0.36 : -0.16;
      frontKneeA = rising ? 0.82 : 0.40;
    } else if (f.blocking) {
      backHipA = -0.34; backKneeA = 0.40;
      frontHipA = 0.28; frontKneeA = 0.32;
    } else if (isMoving) {
      backHipA = -stride * 0.68;
      backKneeA = Math.max(0.06, stride * 0.78);
      frontHipA = stride * 0.68;
      frontKneeA = Math.max(0.06, -stride * 0.78);
    } else {
      backHipA = -0.26; backKneeA = 0.24;
      frontHipA = 0.24; frontKneeA = 0.14;
    }

    // ---- BACK LEG ----
    this._drawHusbunLeg(
      ctx, -8.5, hipY,
      backHipA, backKneeA, legStretch,
      P.furShade, P.furDeep, P.shoeShade, '#dbeafe', P.goldShade, P.ink, true
    );

    // ---- FLUFFY COTTON TAIL ----
    ctx.save();
    ctx.fillStyle = hitFlash ? '#ffffff' : '#fff7ef';
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(-24, hipY - 3, 11.2, 0, Math.PI * 2);
    ctx.arc(-30, hipY - 7, 7.0, 0, Math.PI * 2);
    ctx.arc(-28, hipY + 3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-25.5, hipY - 3, 11.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ---- BACK ARM ----
    let bShA, bElA;
    if (f.blocking) { bShA = -1.16; bElA = -0.92; }
    else if (isHeightMog) { bShA = -2.15; bElA = -0.55; } // flexing / towering
    else if (isKissing) { bShA = 0.85; bElA = -0.45; } // dashing prince pose
    else if (isEypReport) { bShA = isWindup ? -2.2 : -0.35; bElA = -0.5; }
    else if (isWhiteClaw) { bShA = isWindup ? 0.78 : -1.05; bElA = -0.75; }
    else if (isStunned) { bShA = -0.92; bElA = -0.5; }
    else if (isMoving) { bShA = stride * 0.58 - 0.15; bElA = -0.88; }
    else { bShA = -0.42 + Math.sin(t) * 0.12; bElA = -0.95; }

    this._drawHusbunArm(
      ctx, 14, torsoTop + 14,
      bShA, bElA,
      P.furShade, P.jacketShade, P.gloveShade, P.goldShade, P.ink, false
    );

    // ---- BROAD MASCULINE TORSO WITH TAILORED OPEN MIDNIGHT-VELVET JACKET & GOLD CHAIN ----
    const torsoRot = isKissing
      ? 0.34
      : isHeightMog
      ? -0.06
      : isStunned
      ? -0.20
      : isWhiteClaw
      ? (isWindup ? -0.22 : 0.22)
      : isEypReport
      ? (isWindup ? -0.24 : 0.20)
      : isActive
      ? 0.14
      : isWindup
      ? -0.14
      : isMoving
      ? 0.09
      : Math.sin(t) * 0.035;

    ctx.save();
    ctx.rotate(torsoRot);

    // Athletic V-taper espresso torso
    const bodyGrad = ctx.createLinearGradient(-26, torsoTop, 28, hipY);
    bodyGrad.addColorStop(0, P.furHi);
    bodyGrad.addColorStop(0.55, P.furBase);
    bodyGrad.addColorStop(1, P.furShade);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(-26, torsoTop + 2);
    ctx.quadraticCurveTo(0, torsoTop - 4, 28, torsoTop + 2);
    ctx.bezierCurveTo(25, torsoTop + torsoH * 0.45, 21, hipY - 12, 18.5, hipY + 3);
    ctx.lineTo(-18.5, hipY + 3);
    ctx.bezierCurveTo(-21, hipY - 12, -25, torsoTop + torsoH * 0.45, -26, torsoTop + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Looney-Tunes comedic accordion stretch lines when Height Mogging!
    if (stretchH > 14 && !hitFlash) {
      ctx.strokeStyle = 'rgba(255, 214, 112, 0.38)';
      ctx.lineWidth = 1.6;
      for (let sy2 = torsoTop + 18; sy2 < hipY - 10; sy2 += 14) {
        ctx.beginPath();
        ctx.moveTo(-14, sy2);
        ctx.quadraticCurveTo(0, sy2 + 4, 14, sy2);
        ctx.stroke();
      }
    }

    // Warm Cream Chest Fur with V-tuft contour
    ctx.fillStyle = P.cream;
    ctx.beginPath();
    ctx.moveTo(-8, torsoTop + 3);
    ctx.quadraticCurveTo(4, torsoTop + 1, 16, torsoTop + 3);
    ctx.bezierCurveTo(18, torsoTop + torsoH * 0.42, 13, hipY - 6, 4, hipY - 2);
    ctx.bezierCurveTo(-6, hipY - 6, -10, torsoTop + torsoH * 0.42, -8, torsoTop + 3);
    ctx.closePath();
    ctx.fill();

    // Sleek Gold Chain Necklace + Gleaming Medallion Glint!
    ctx.strokeStyle = P.goldShade;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(4.5, torsoTop + 4, 12.2, 0.24, Math.PI - 0.24);
    ctx.stroke();
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2.0;
    ctx.stroke();
    // Pendant tag
    ctx.fillStyle = P.gold;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(2.2, torsoTop + 14.5, 4.8, 6.2, 1.5);
    ctx.fill();
    ctx.stroke();
    if (!hitFlash) {
      const glint = 0.5 + 0.5 * Math.sin(time * 7);
      if (glint > 0.72) {
        this._drawSparkleStar(ctx, 4.6, torsoTop + 17.5, 4.2 * glint, '#fffbe6');
      }
    }

    // Open-Front Tailored Midnight-Velvet Fighter Jacket (Left & Right Lapels + Flared Tails!)
    const jGrad = ctx.createLinearGradient(-28, torsoTop, 28, hipY + 12);
    jGrad.addColorStop(0, P.jacketHi);
    jGrad.addColorStop(0.45, P.jacket);
    jGrad.addColorStop(1, P.jacketShade);
    ctx.fillStyle = jGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.2;

    // Back/Left jacket panel + upturned collar + subtle coat tail flare
    ctx.beginPath();
    ctx.moveTo(-27.5, torsoTop + 2);
    ctx.lineTo(-14, torsoTop - 7); // suave popped collar!
    ctx.lineTo(-4.5, torsoTop + 1);
    ctx.bezierCurveTo(-6.5, torsoTop + torsoH * 0.45, -5.5, hipY - 10, -4.5, hipY + 5);
    ctx.lineTo(-22.5, hipY + 7);
    ctx.bezierCurveTo(-25, hipY - 12, -28.5, torsoTop + torsoH * 0.4, -27.5, torsoTop + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front/Right jacket panel + lapel
    ctx.beginPath();
    ctx.moveTo(13, torsoTop + 1);
    ctx.lineTo(22.5, torsoTop - 5.5);
    ctx.lineTo(28.5, torsoTop + 3);
    ctx.bezierCurveTo(28, torsoTop + torsoH * 0.4, 24, hipY - 10, 21.5, hipY + 5);
    ctx.lineTo(11.5, hipY + 4);
    ctx.bezierCurveTo(13.5, torsoTop + torsoH * 0.45, 13.5, torsoTop + 18, 13, torsoTop + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold lapel piping & velvet rim highlight
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5.5, torsoTop + 2); ctx.lineTo(-5.5, hipY + 3);
    ctx.moveTo(13.2, torsoTop + 2); ctx.lineTo(12.6, hipY + 2);
    ctx.stroke();

    if (!hitFlash) {
      ctx.strokeStyle = P.rim;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-26, torsoTop + 6);
      ctx.quadraticCurveTo(-27, torsoTop + torsoH * 0.5, -21, hipY);
      ctx.stroke();
    }

    // Athletic Navy Fight Shorts with Gold Waistband & Side Stripe
    const shortGrad = ctx.createLinearGradient(-20, hipY - 7, 20, hipY + 18);
    shortGrad.addColorStop(0, P.jacket);
    shortGrad.addColorStop(1, P.jacketDeep);
    ctx.fillStyle = shortGrad;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-20.5, hipY - 6.5, 41, 23, 6.5);
    ctx.fill();
    ctx.stroke();

    // Gold fighter belt & center emblem
    ctx.fillStyle = P.gold;
    ctx.fillRect(-19.5, hipY - 6, 39, 5.2);
    ctx.fillStyle = P.jacketHi;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-5.5, hipY - 7, 11, 7.2, 2);
    ctx.fill();
    ctx.stroke();
    // Side athletic gold chevron
    ctx.fillStyle = P.gold;
    ctx.fillRect(-19.5, hipY + 11.5, 39, 2.4);

    ctx.restore(); // torso

    // ---- FRONT LEG ----
    this._drawHusbunLeg(
      ctx, 8.5, hipY,
      frontHipA, frontKneeA, legStretch,
      P.furBase, P.furShade, P.shoe, '#ffffff', P.gold, P.ink, false
    );

    // ---- HANDSOME SUAVE BUGS-STYLE HEAD ----
    ctx.save();
    ctx.translate(4.5, torsoTop - 25.5 + (isStunned ? 4 : 0));
    const headRot = isKissing
      ? 0.28
      : isHeightMog
      ? -0.14
      : isStunned
      ? -0.22
      : isActive
      ? 0.14
      : Math.sin(t) * 0.04;
    ctx.rotate(headRot);
    this._drawHusbunHead(ctx, f, time, isKissing);
    ctx.restore();

    // ---- FRONT ARM (Classic Crisp White Bugs Gloves!) ----
    let fShA, fElA, extended = false;
    if (f.blocking) {
      fShA = -1.35; fElA = -1.10;
    } else if (isWhiteClaw) {
      fShA = isWindup ? 1.15 : -0.35;
      fElA = isWindup ? -0.85 : 0.12;
      extended = isActive;
    } else if (isHeightMog) {
      // Confident chin-up / flex pose!
      fShA = -0.25; fElA = -1.65;
    } else if (isKissing) {
      // Gentle romantic reach forward
      fShA = -0.18; fElA = -0.38; extended = isActive;
    } else if (isEypReport) {
      fShA = isWindup ? -1.85 : -0.12;
      fElA = isWindup ? -0.45 : 0.08;
      extended = isActive;
    } else if (isStunned) {
      fShA = 0.55; fElA = -0.65;
    } else if (isMoving) {
      fShA = -stride * 0.62 + 0.15;
      fElA = -0.92;
    } else {
      fShA = 0.24 + Math.sin(t) * 0.10;
      fElA = -1.08 + Math.sin(t * 2) * 0.15;
    }

    this._drawHusbunArm(
      ctx, -7, torsoTop + 14.5,
      fShA, fElA,
      P.furBase, P.jacket, P.glove, P.gold, P.ink, extended,
      isWhiteClaw && isActive ? '#38bdf8' : isEypReport && isActive ? '#60a5fa' : null
    );

    // ---- GUARD BARRIER ----
    if (f.blocking) {
      this._drawGuardBarrier(ctx, 36, hipY - 32, 46, '#ffd670', '#60a5fa', time);
    }

    ctx.restore();
  }

  _drawHusbunHead(ctx, f, time = 0, isKissing = false) {
    const hitFlash = (f.hitFlash || 0) > 0;
    const furBase = hitFlash ? '#ffffff' : '#6c4023';
    const furHi = hitFlash ? '#ffffff' : '#a36e47';
    const furShade = hitFlash ? '#dbeafe' : '#432411';
    const cream = hitFlash ? '#ffffff' : '#f8e9d6';
    const ink = '#1b0c12';
    const gold = '#ffd670';

    // ---- TALL EXPRESSIVE UPRIGHT BUGS-STYLE EARS ----
    const earLag = f.earLag || 0;
    const earSway = Math.sin(time * 5.0 + 1.2) * 0.055 + earLag;
    this._drawBugsEar(ctx, -9.5, -22, -0.22 + earSway, 10.5, 59, furShade, furBase, '#cfa082', ink, false, hitFlash);
    this._drawBugsEar(ctx, 7.5, -23.5, 0.11 - earSway * 0.55, 10.5, 57, furBase, furHi, '#e2b294', ink, true, hitFlash);

    // ---- HANDSOME SCULPTED ESPRESSO HEAD ----
    const headGrad = ctx.createRadialGradient(-4, -9, 3.5, 0, 0, 31);
    headGrad.addColorStop(0, furHi);
    headGrad.addColorStop(0.62, furBase);
    headGrad.addColorStop(1, furShade);
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.ellipse(0, -2, 22.2, 24.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Subtle moonlight rim along crown
    if (!hitFlash) {
      ctx.strokeStyle = 'rgba(255, 236, 206, 0.50)';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(0, -2, 20.5, Math.PI * 1.15, Math.PI * 1.68);
      ctx.stroke();
    }

    // ---- ICONIC FLUFFY BUGS CREAM CHEEK TUFTS & MUZZLE ----
    ctx.fillStyle = cream;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-18, 2.5);
    ctx.quadraticCurveTo(-29.5, 5.5, -21.5, 11.2);
    ctx.quadraticCurveTo(-27.5, 15.8, -16.5, 17.5);
    ctx.quadraticCurveTo(-4, 22.8, 14.5, 19.2);
    ctx.quadraticCurveTo(27.5, 15.2, 25.5, 4.2);
    ctx.quadraticCurveTo(18.5, -2.5, 6.5, 1.5);
    ctx.quadraticCurveTo(-5, -1, -18, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft cheek cel-shadow
    if (!hitFlash) {
      ctx.fillStyle = 'rgba(180, 142, 110, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 16.8, 15, 3.6, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- FLUTTERING MIDNIGHT-NAVY & GOLD FIGHTER HEADBAND ----
    const tailWave1 = Math.sin(time * 10.5) * 5.2 + earLag * 26;
    const tailWave2 = Math.cos(time * 9.5) * 4.5 + earLag * 22;

    // Two fluttering ribbon tails
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7.2;
    ctx.beginPath();
    ctx.moveTo(-21, -16.5);
    ctx.quadraticCurveTo(-34, -15 + tailWave1, -46, -6 + tailWave2);
    ctx.stroke();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 4.4;
    ctx.stroke();

    ctx.strokeStyle = ink;
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(-21, -14.5);
    ctx.quadraticCurveTo(-32, -8 + tailWave2, -40, 3 + tailWave1 * 0.8);
    ctx.stroke();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Headband wrap + gold stripe
    const hbGrad = ctx.createLinearGradient(-22, -20.5, 22, -13);
    hbGrad.addColorStop(0, '#1e3a8a');
    hbGrad.addColorStop(0.5, '#2563eb');
    hbGrad.addColorStop(1, '#172554');
    ctx.fillStyle = hbGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(-22.5, -20.8, 45, 8.0, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(-21.2, -17.8, 42.4, 2.4);

    // ---- EXPRESSIVE BUGS NOSE & MOUTH ----
    ctx.fillStyle = '#cf5a78';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(19.8, 3.2, 4.6, 3.3, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(18.6, 2.0, 1.1, 0, Math.PI * 2);
    ctx.fill();

    if (isKissing) {
      // Suave puckered kissy lips!
      ctx.fillStyle = '#ff4d9e';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(22.4, 10.6, 5.8, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(23.5, 9.5, 1.8, 1.0, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.koState) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(14.5, 12.2, 3.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Charming Bugs Bunny crooked smirk + crisp white buck-tooth!
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(5.5, 10.2);
      ctx.quadraticCurveTo(15.5, 16.2, 23.2, 8.6);
      ctx.stroke();
      // Cheek smirk crease
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(4.8, 9.6, 2.6, Math.PI * 0.4, Math.PI * 1.1);
      ctx.stroke();
      // Iconic Bugs buck-tooth
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(14.0, 12.0, 5.0, 5.0, 1.2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16.5, 12.2); ctx.lineTo(16.5, 16.8);
      ctx.stroke();
    }

    // ---- TALL EXPRESSIVE BUGS OVAL EYES & CONFIDENT BROWS ----
    const isBlinking = !f.koState && ((time + 1.8) % 3.9) > 3.76;
    if (f.koState) {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const ex of [6, 16.5]) {
        ctx.beginPath();
        ctx.moveTo(ex - 3.4, -8.5); ctx.lineTo(ex + 3.4, -1.8);
        ctx.moveTo(ex + 3.4, -8.5); ctx.lineTo(ex - 3.4, -1.8);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = time * 5.2 + (i * Math.PI * 2) / 3;
        const hx = Math.cos(a) * 25;
        const hy = -35 + Math.sin(a) * 6.5;
        if (i % 2 === 0) this._drawHeart(ctx, hx, hy, 6.2, '#60a5fa');
        else this._drawSparkleStar(ctx, hx, hy, 5.5, gold);
      }
    } else if ((f.heartEyesTimer || 0) > 0 || (f.counterWindow || 0) > 0) {
      const pulse = 1 + Math.sin(time * 16) * 0.14;
      for (const ex of [6, 16.5]) {
        this._drawHeart(ctx, ex, -5.2, 6.8 * pulse, '#ff4da6');
        this._drawHeart(ctx, ex - 0.7, -6.2, 2.8 * pulse, '#ffd6ec');
      }
    } else if (isBlinking || isKissing) {
      // Dreamy closed / blinking eyes
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      for (const ex of [6, 16.5]) {
        ctx.beginPath();
        ctx.arc(ex, -4.5, 4.2, isKissing ? 0.15 : Math.PI * 1.1, isKissing ? Math.PI - 0.15 : Math.PI * 1.9);
        ctx.stroke();
      }
    } else {
      const eyes = [
        { ex: 5.8, rx: 5.1, ry: 7.8 },
        { ex: 16.2, rx: 4.4, ry: 7.5 },
      ];
      for (const { ex, rx, ry } of eyes) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(ex, -6.0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Warm walnut-amber iris + dark pupil + specular gleam
        ctx.fillStyle = '#5c3317';
        ctx.beginPath();
        ctx.ellipse(ex + 1.0, -5.2, 3.0, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#170a05';
        ctx.beginPath();
        ctx.ellipse(ex + 1.2, -5.2, 2.0, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 2.0, -7.4, 1.45, 0, Math.PI * 2);
        ctx.fill();

        // Suave half-lidded confident upper lid & brow!
        ctx.fillStyle = furBase;
        ctx.beginPath();
        ctx.ellipse(ex, -11.2, rx + 0.6, 3.4, 0.08, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#1f0f08';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - rx - 0.6, -12.2);
        ctx.quadraticCurveTo(ex + 0.5, -13.2, ex + rx + 0.6, -10.4);
        ctx.stroke();
      }
    }

    // ---- GLINTING GOLD ANIME GLASSES ON EYP REPORT SUPER! ----
    if (f.move && f.move.id === 'eyp_report') {
      ctx.save();
      // Sleek rectangular executive gold glasses
      ctx.fillStyle = 'rgba(219, 234, 254, 0.42)';
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(0.2, -12.8, 11.4, 10.6, 2.6);
      ctx.roundRect(12.2, -12.8, 10.2, 10.6, 2.6);
      ctx.fill();
      ctx.stroke();
      // Bridge & temple arm
      ctx.beginPath();
      ctx.moveTo(11.6, -8.2); ctx.lineTo(12.2, -8.2);
      ctx.moveTo(0.2, -9.2); ctx.lineTo(-10.5, -10.5);
      ctx.stroke();

      // Iconic anime diagonal white lens flash + 4-point star glint!
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(2.5, -12.0); ctx.lineTo(6.2, -12.0); ctx.lineTo(3.6, -3.0); ctx.lineTo(1.2, -3.0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14.4, -12.0); ctx.lineTo(17.8, -12.0); ctx.lineTo(15.2, -3.0); ctx.lineTo(13.2, -3.0);
      ctx.closePath();
      ctx.fill();

      const glintScale = 6.5 + Math.sin(time * 22) * 2.5;
      this._drawSparkleStar(ctx, 19.5, -11.5, glintScale, '#ffffff');
      ctx.restore();
    }
  }

  _drawBugsEar(ctx, x, y, angle, rx, ry, outerCol, hiCol, innerCol, ink, bendTip, hitFlash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const eGrad = ctx.createLinearGradient(-rx, 0, rx, -ry);
    eGrad.addColorStop(0, outerCol);
    eGrad.addColorStop(0.55, hiCol);
    eGrad.addColorStop(1, outerCol);
    ctx.fillStyle = eGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;

    if (bendTip) {
      // Iconic Bugs-Bunny cool slight tip bend!
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.bezierCurveTo(-13.5, -ry * 0.42, -11, -ry * 0.85, -1, -ry * 0.96);
      ctx.bezierCurveTo(6, -ry * 1.04, 15, -ry * 0.94, 13.5, -ry * 0.78);
      ctx.bezierCurveTo(10, -ry * 0.76, 8, -ry * 0.82, 5.5, -ry * 0.72);
      ctx.bezierCurveTo(11, -ry * 0.46, 10, -ry * 0.22, 6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.bezierCurveTo(-13.5, -ry * 0.44, -11.5, -ry * 0.92, 0, -ry);
      ctx.bezierCurveTo(11.5, -ry * 0.92, 12.5, -ry * 0.44, 6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (!hitFlash) {
      ctx.fillStyle = innerCol;
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.48, rx * 0.44, ry * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawHusbunLeg(ctx, x, y, hipA, kneeA, stretch, furCol, furShade, shoeCol, soleCol, goldCol, ink, isBack) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hipA);

    const thighLen = 32 + stretch * 0.50;
    // Sculpted athletic thigh
    ctx.fillStyle = furCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-7.6, -2);
    ctx.bezierCurveTo(-9, thighLen * 0.4, -7.2, thighLen * 0.8, -5.8, thighLen);
    ctx.lineTo(6.0, thighLen);
    ctx.bezierCurveTo(8.0, thighLen * 0.75, 8.6, thighLen * 0.35, 7.2, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ---- KNEE -> CALF & HIGH-TOP FIGHTER SNEAKER ----
    ctx.translate(0, thighLen - 3.5);
    ctx.rotate(kneeA);
    const calfLen = 29 + stretch * 0.50;

    ctx.fillStyle = furCol;
    ctx.beginPath();
    ctx.moveTo(-6.2, -2);
    ctx.bezierCurveTo(-7.2, calfLen * 0.38, -5.6, calfLen * 0.76, -5.0, calfLen);
    ctx.lineTo(5.4, calfLen);
    ctx.bezierCurveTo(7.4, calfLen * 0.65, 7.4, calfLen * 0.32, 6.0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // High-Top Fighter Sneaker!
    const shoeGrad = ctx.createLinearGradient(-8, calfLen - 11, 20, calfLen + 8);
    shoeGrad.addColorStop(0, isBack ? shoeCol : '#3b82f6');
    shoeGrad.addColorStop(0.55, shoeCol);
    shoeGrad.addColorStop(1, '#172554');
    ctx.fillStyle = shoeGrad;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-7.5, calfLen - 11);
    ctx.lineTo(6.2, calfLen - 11);
    ctx.lineTo(9.5, calfLen - 4);
    ctx.quadraticCurveTo(21, calfLen - 2, 20.5, calfLen + 5.5);
    ctx.lineTo(-8.5, calfLen + 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crisp white sneaker collar, rubber sole & gold lace stripes
    ctx.fillStyle = soleCol;
    ctx.fillRect(-8.2, calfLen + 2.5, 28.4, 3.8);
    ctx.fillStyle = goldCol;
    ctx.fillRect(-7.0, calfLen - 11, 13.0, 2.8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(5.5, calfLen - 5.5); ctx.lineTo(10.2, calfLen - 4.5);
    ctx.moveTo(7.5, calfLen - 2.5); ctx.lineTo(12.2, calfLen - 1.5);
    ctx.stroke();

    ctx.restore();
  }

  _drawHusbunArm(ctx, x, y, shA, elA, furCol, sleeveCol, gloveCol, goldCol, ink, extended = false, energyGlow = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shA);

    // Rolled midnight-velvet jacket sleeve upper arm
    ctx.fillStyle = sleeveCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5.5, -6.8);
    ctx.bezierCurveTo(6, -7.8, 17, -6.6, 22, -5.6);
    ctx.lineTo(22, 5.6);
    ctx.bezierCurveTo(17, 6.8, 6, 7.8, -5.5, 6.8);
    ctx.quadraticCurveTo(-8, 0, -5.5, -6.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold jacket sleeve cuff stripe
    ctx.fillStyle = goldCol;
    ctx.fillRect(17.5, -5.5, 3.4, 11.0);

    // Muscular espresso forearm
    ctx.translate(21, 0);
    ctx.rotate(elA);
    const fLen = extended ? 28 : 22.5;
    ctx.fillStyle = furCol;
    ctx.beginPath();
    ctx.moveTo(-3, -5.0);
    ctx.bezierCurveTo(6, -5.6, fLen * 0.72, -4.4, fLen, -3.8);
    ctx.lineTo(fLen, 3.8);
    ctx.bezierCurveTo(fLen * 0.72, 4.8, 6, 5.6, -3, 5.0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crisp White Bugs-Bunny Cartoon Fighter Glove!
    if (energyGlow) {
      ctx.save();
      ctx.shadowColor = energyGlow;
      ctx.shadowBlur = 22;
      ctx.fillStyle = energyGlow;
      ctx.beginPath();
      ctx.arc(fLen + 5, 0, 14.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flared glove cuff
    ctx.fillStyle = gloveCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(fLen - 5.5, -6.2, 7.5, 12.4, 3);
    ctx.fill();
    ctx.stroke();

    // Sculpted white fighter fist + classic 3 cartoon backhand lines!
    const gr = extended ? 12.2 : 10.2;
    ctx.fillStyle = gloveCol;
    ctx.beginPath();
    ctx.ellipse(fLen + 5.2, 0, gr, gr * 0.90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Classic 3 Bugs glove lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fLen + 1.5, -3.6); ctx.lineTo(fLen + 7.2, -3.6);
    ctx.moveTo(fLen + 1.2, 0); ctx.lineTo(fLen + 8.0, 0);
    ctx.moveTo(fLen + 1.5, 3.6); ctx.lineTo(fLen + 7.2, 3.6);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================================================
  // SHARED FIGHTER HELPERS (Shadow, Aura, Guard Barrier)
  // ==========================================================================
  _drawGroundShadow(ctx, f, rx, ry) {
    const airScale = Math.max(0.42, 1 - (this.GROUND_Y - f.y) / 360);
    const sy = this.GROUND_Y - f.y + 4;
    const grad = ctx.createRadialGradient(0, sy, 4, 0, sy, rx * airScale);
    grad.addColorStop(0, 'rgba(16, 3, 22, 0.56)');
    grad.addColorStop(0.7, 'rgba(16, 3, 22, 0.28)');
    grad.addColorStop(1, 'rgba(16, 3, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, sy, rx * airScale * 1.12, ry * airScale * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawFighterAura(ctx, f, time, cy, rx, ry, superCol, counterCol) {
    if (f.koState) return;
    const isCounter = (f.counterWindow || 0) > 0;
    const isSuperReady = (f.superMeter || 0) >= this.MAX_SUPER;
    if (!isCounter && !isSuperReady) return;

    const col = isCounter ? counterCol : superCol;
    const pulse = 1 + Math.sin(time * 12) * 0.06;

    ctx.save();
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = isCounter ? 24 : 18;
    ctx.lineWidth = isCounter ? 4.2 : 2.8;
    ctx.globalAlpha = isCounter ? 0.92 : 0.65;
    ctx.beginPath();
    ctx.ellipse(0, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner rising anime ki-flames
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 4; i++) {
      const a = time * 3.5 + (i * Math.PI) / 2;
      const ox = Math.cos(a) * rx * 0.88;
      const oy = cy + Math.sin(a) * ry * 0.72;
      ctx.beginPath();
      ctx.moveTo(ox, oy + 14);
      ctx.quadraticCurveTo(ox + Math.sin(time * 10 + i) * 6, oy, ox, oy - 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawGuardBarrier(ctx, x, y, r, goldCol, accentCol, time) {
    ctx.save();
    const pulse = 1 + Math.sin(time * 16) * 0.04;
    const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * pulse);
    grad.addColorStop(0, 'rgba(255, 244, 214, 0.08)');
    grad.addColorStop(0.75, 'rgba(255, 214, 112, 0.22)');
    grad.addColorStop(1, 'rgba(255, 214, 112, 0.48)');

    ctx.fillStyle = grad;
    ctx.strokeStyle = goldCol;
    ctx.shadowColor = accentCol;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, -Math.PI * 0.46, Math.PI * 0.46);
    ctx.stroke();
    ctx.fill();

    // Inner crisp highlight arc + emblem sparkle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - 3, y, (r - 6) * pulse, -Math.PI * 0.36, Math.PI * 0.36);
    ctx.stroke();
    this._drawSparkleStar(ctx, x + r * 0.92, y - r * 0.25, 6, '#fff8db');
    ctx.restore();
  }

  // ==========================================================================
  // 3. AFTERIMAGES — CRISP CEL-SHADED BUNNY SILHOUETTE GHOSTS
  // ==========================================================================
  drawAfterimages(ctx, afterimages) {
    if (!afterimages || !afterimages.length) return;
    for (const a of afterimages) {
      const ratio = Math.max(0, (a.life || 0) / (a.maxLife || 0.26));
      const isWife = a.isWifebun !== undefined ? a.isWifebun : a.side === 'red';
      const facing = a.facing || 1;

      ctx.save();
      ctx.globalAlpha = ratio * 0.56;
      ctx.translate(a.x, a.y);

      if (a.rollAngle) {
        ctx.translate(0, isWife ? -68 : -76);
        ctx.rotate(a.rollAngle);
        ctx.translate(0, isWife ? 68 : 76);
      }

      ctx.scale(facing * HERO_SCALE, HERO_SCALE);

      const fillGrad = ctx.createLinearGradient(0, isWife ? -155 : -190, 0, 0);
      if (isWife) {
        fillGrad.addColorStop(0, 'rgba(255, 166, 213, 0.85)');
        fillGrad.addColorStop(0.55, 'rgba(255, 63, 155, 0.65)');
        fillGrad.addColorStop(1, 'rgba(168, 85, 247, 0.22)');
      } else {
        fillGrad.addColorStop(0, 'rgba(125, 211, 252, 0.85)');
        fillGrad.addColorStop(0.55, 'rgba(59, 130, 246, 0.65)');
        fillGrad.addColorStop(1, 'rgba(30, 58, 138, 0.22)');
      }
      ctx.fillStyle = fillGrad;
      ctx.strokeStyle = isWife ? '#ffb3da' : '#7dd3fc';
      ctx.lineWidth = 2.0;

      if (isWife) {
        // Wifebun curvy silhouette + swept ponytail ears
        ctx.beginPath();
        // Ponytail ears
        ctx.moveTo(-10, -128);
        ctx.bezierCurveTo(-36, -150, -56, -138, -52, -124);
        ctx.bezierCurveTo(-40, -118, -22, -116, -14, -110);
        // Head & curvy body
        ctx.bezierCurveTo(-22, -96, -12, -74, -22, -52);
        ctx.bezierCurveTo(-32, -40, -18, -12, -14, 0);
        ctx.lineTo(18, 0);
        ctx.bezierCurveTo(22, -26, 20, -48, 15, -72);
        ctx.bezierCurveTo(24, -84, 24, -118, 12, -130);
        ctx.quadraticCurveTo(0, -138, -10, -128);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Husbun tall Bugs silhouette + upright ears
        ctx.beginPath();
        // Tall upright ears
        ctx.moveTo(-10, -142);
        ctx.bezierCurveTo(-22, -185, -8, -206, 0, -196);
        ctx.bezierCurveTo(6, -204, 24, -196, 16, -142);
        // Broad shoulders & tall athletic frame
        ctx.bezierCurveTo(30, -130, 30, -96, 22, -62);
        ctx.lineTo(20, 0);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-22, -62);
        ctx.bezierCurveTo(-30, -96, -28, -128, -10, -142);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 4. CAPCOM CRESCENT MOTION SMEARS
  // ==========================================================================
  drawSmears(ctx, smears) {
    if (!smears || !smears.length) return;
    for (const s of smears) {
      const alpha = Math.max(0, (s.life || 0) / (s.maxLife || 0.2));
      const r = s.radius || 84;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.dir || 1, 1);
      ctx.globalAlpha = alpha * 0.94;

      // True tapered Capcom crescent blade (outer arc forward, inner arc offset)
      const thick = 22 * alpha + 4;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.24, 1.06, false);
      ctx.arc(-thick * 0.85, 2, Math.max(8, r - thick * 0.55), 0.96, -1.14, true);
      ctx.closePath();
      ctx.fill();

      // Blazing pure white inner core crescent
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r - 3.5, -1.04, 0.86, false);
      ctx.arc(-thick * 0.45, 1, Math.max(6, r - thick * 0.35 - 3.5), 0.78, -0.96, true);
      ctx.closePath();
      ctx.fill();

      // Crisp anime speed-streak lines along wake
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2.0 * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, -0.8, 0.35);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ==========================================================================
  // 5. PROJECTILES — MANGO SEED SUPER COMET & EYP REPORT BINDER SLAM
  // ==========================================================================
  drawProjectiles(ctx, projectiles, time = 0) {
    if (!projectiles || !projectiles.length) return;
    for (const pr of projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);

      if (pr.kind === 'mango_seed') {
        const dir = Math.sign(pr.vx || 1);
        const flicker = Math.sin(time * 42) * 5;

        // Multi-layered Blazing Comet Flame Wake!
        const wakeLen = 175 + flicker;
        const outerFlame = ctx.createLinearGradient(-wakeLen * dir, 0, 26 * dir, 0);
        outerFlame.addColorStop(0, 'rgba(255, 77, 166, 0)');
        outerFlame.addColorStop(0.35, 'rgba(255, 115, 0, 0.65)');
        outerFlame.addColorStop(0.75, 'rgba(255, 183, 3, 0.95)');
        outerFlame.addColorStop(1, 'rgba(255, 250, 220, 1)');

        ctx.fillStyle = outerFlame;
        ctx.beginPath();
        ctx.moveTo(26 * dir, 0);
        ctx.bezierCurveTo(6 * dir, -34, -76 * dir, -28 - flicker * 0.4, -wakeLen * dir, 0);
        ctx.bezierCurveTo(-76 * dir, 28 + flicker * 0.4, 6 * dir, 34, 26 * dir, 0);
        ctx.closePath();
        ctx.fill();

        // White-hot inner supersonic plasma cone
        const coreGrad = ctx.createLinearGradient(-110 * dir, 0, 20 * dir, 0);
        coreGrad.addColorStop(0, 'rgba(255, 240, 180, 0)');
        coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.96)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.moveTo(22 * dir, 0);
        ctx.quadraticCurveTo(-24 * dir, -15, -110 * dir, 0);
        ctx.quadraticCurveTo(-24 * dir, 15, 22 * dir, 0);
        ctx.closePath();
        ctx.fill();

        // Swirling golden energy ribbons
        ctx.strokeStyle = 'rgba(255, 232, 130, 0.85)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(14 * dir, -18);
        ctx.quadraticCurveTo(-45 * dir, -28 + Math.sin(time * 28) * 10, -135 * dir, -8);
        ctx.moveTo(14 * dir, 18);
        ctx.quadraticCurveTo(-45 * dir, 28 - Math.sin(time * 28) * 10, -135 * dir, 8);
        ctx.stroke();

        // Rotating Sculpted Mango Seed Core!
        ctx.rotate(pr.rot || 0);
        ctx.shadowColor = '#ffb703';
        ctx.shadowBlur = 28;
        const seedGrad = ctx.createRadialGradient(-10, -8, 4, 0, 0, 42);
        seedGrad.addColorStop(0, '#fff7cc');
        seedGrad.addColorStop(0.45, '#ffd166');
        seedGrad.addColorStop(0.85, '#f59e0b');
        seedGrad.addColorStop(1, '#b45309');
        ctx.fillStyle = seedGrad;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 42, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Organic fibrous mango seed ridges & specular gleam
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-28, -6); ctx.quadraticCurveTo(0, -10, 28, -5);
        ctx.moveTo(-30, 1); ctx.quadraticCurveTo(0, 3, 30, 0);
        ctx.moveTo(-22, 8); ctx.quadraticCurveTo(0, 11, 22, 7);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.beginPath();
        ctx.ellipse(-10, -11, 14, 4.5, -0.15, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.kind === 'eyp_report') {
        // Colossal Skyscraper EYP REPORT Executive Audit Deck!
        ctx.rotate((pr.rot || 0) * 0.36);
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 28;

        // 3D stacked pages depth edge
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(-42, -56, 98, 124, 7);
        ctx.fill();
        ctx.stroke();

        // Crisp front report cover
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-50, -64, 98, 124, 7);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Royal blue binder spine & metallic ring notches
        ctx.fillStyle = '#172554';
        ctx.fillRect(-50, -64, 14, 124);
        ctx.fillStyle = '#93c5fd';
        for (let ry = -46; ry <= 44; ry += 22) {
          ctx.beginPath();
          ctx.roundRect(-53, ry, 10, 6, 3);
          ctx.fill();
        }

        // Bold EYP Header Band
        const hdrGrad = ctx.createLinearGradient(-36, -62, 46, -34);
        hdrGrad.addColorStop(0, '#1d4ed8');
        hdrGrad.addColorStop(1, '#2563eb');
        ctx.fillStyle = hdrGrad;
        ctx.fillRect(-36, -62, 82, 26);
        ctx.fillStyle = '#ffd670';
        ctx.fillRect(-36, -38, 82, 3);

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 14px 'Chakra Petch', Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('EYP REPORT', 5, -44);

        // Executive bar chart + upward arrow!
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-26, -24, 62, 58);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(-20, 4, 12, 30);
        ctx.fillStyle = '#ff4da6'; ctx.fillRect(-2, -14, 12, 48);
        ctx.fillStyle = '#10b981'; ctx.fillRect(16, -2, 12, 36);
        ctx.strokeStyle = '#ffd670';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-22, 18); ctx.lineTo(-4, 2); ctx.lineTo(14, -8); ctx.lineTo(30, -20);
        ctx.stroke();

        // Bold Tilted Red Ink Stamp: APPROVED ♥
        ctx.save();
        ctx.translate(4, 12);
        ctx.rotate(-0.24);
        ctx.fillStyle = 'rgba(255, 240, 242, 0.86)';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.roundRect(-40, -12, 80, 24, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.font = `700 13.5px 'Chakra Petch', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('APPROVED ♥', 0, 5);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 6. BESPOKE MOVE VFX (pear_bounce, dj_spin, coke_burp, white_claw, height_mog,
  //    forehead_kiss, kiss_bloom)
  // ==========================================================================
  drawVfx(ctx, vfx, fightersMap, time = 0) {
    if (!vfx || !vfx.length) return;
    for (const v of vfx) {
      const p = Math.min(1, Math.max(0, (v.t || 0) / (v.duration || 0.5)));
      const f = fightersMap && v.side ? fightersMap[v.side] : null;
      const fx = f ? f.x : v.x;
      const fy = f ? f.y : v.y;
      const dir = f ? (f.facing || 1) : (v.dir || 1);

      ctx.save();
      if (v.kind === 'pear_bounce') {
        // Luminous rose-gold & pearlescent shockwave arcs + floating hearts!
        const cx = fx + 40 * dir;
        const cy = fy - 64;
        const aStart = dir > 0 ? -1.15 : Math.PI - 1.15;
        const aEnd = dir > 0 ? 1.15 : Math.PI + 1.15;

        ctx.shadowColor = '#ff69b4';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(255, 119, 186, ${1 - p})`;
        ctx.lineWidth = 12 * (1 - p) + 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, 32 + p * 105, aStart, aEnd);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 214, 112, ${(1 - p) * 0.92})`;
        ctx.lineWidth = 5.5 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + p * 78, aStart * 0.9, aEnd * 0.9);
        ctx.stroke();

        // Sparkle hearts popping from the bounce
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 3; i++) {
          const ang = (i - 1) * 0.55 + (dir < 0 ? Math.PI : 0);
          const dist = 42 + p * 90 + i * 8;
          this._drawHeart(ctx, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 9 + (1 - p) * 5, i === 1 ? '#ffd670' : '#ff77ba');
        }
      } else if (v.kind === 'dj_spin') {
        // Glamorous Disco Club Spotlight + Neon Whirlwind Turntable Rings!
        const cone = ctx.createLinearGradient(fx, fy - 275, fx, fy);
        cone.addColorStop(0, `rgba(255, 105, 180, ${0.46 * (1 - p)})`);
        cone.addColorStop(0.5, `rgba(56, 189, 248, ${0.22 * (1 - p)})`);
        cone.addColorStop(1, 'rgba(255, 105, 180, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(fx - 22, fy - 275);
        ctx.lineTo(fx + 22, fy - 275);
        ctx.lineTo(fx + 115, fy);
        ctx.lineTo(fx - 115, fy);
        ctx.closePath();
        ctx.fill();

        // Rotating whirlwind neon equalizer rings
        ctx.translate(fx, fy - 76);
        for (let r = 0; r < 4; r++) {
          const cols = ['#ff4da6', '#ffd670', '#38bdf8', '#ff99cc'];
          ctx.strokeStyle = cols[r % cols.length];
          ctx.globalAlpha = (1 - p * 0.85) * 0.9;
          ctx.lineWidth = 6.5 - r * 1.2;
          const radX = 52 + p * (96 - r * 12);
          ctx.beginPath();
          ctx.ellipse(0, (r - 1.5) * 26, radX, 17, Math.sin(time * 12 + r) * 0.08, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Spinning glossy vinyl disc
        ctx.globalAlpha = 1 - p * 0.7;
        ctx.rotate(p * Math.PI * 10);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Vinyl groove sheen
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0.2, 1.4);
        ctx.arc(0, 0, 23, Math.PI + 0.2, Math.PI + 1.4);
        ctx.stroke();
        ctx.fillStyle = '#ff4da6';
        ctx.beginPath();
        ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd670';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (v.kind === 'coke_burp') {
        // Frosty Red Cola Can + Fizzy Expanding Sonic Burp Beam!
        const canX = fx + 26 * dir;
        const canY = fy - 108;
        ctx.save();
        ctx.translate(canX, canY);
        ctx.rotate(dir * -0.22);
        const canGrad = ctx.createLinearGradient(-10, 0, 10, 0);
        canGrad.addColorStop(0, '#991b1b');
        canGrad.addColorStop(0.45, '#ef4444');
        canGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = canGrad;
        ctx.strokeStyle = '#260b19';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 32, 4);
        ctx.fill();
        ctx.stroke();
        // Silver rim + white classic wave ribbon
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-9, -16, 18, 3.5);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, -6, 9, 1);
        ctx.stroke();
        ctx.restore();

        // Fizzy translucent cola sonic cone
        const mouthX = fx + 34 * dir;
        const mouthY = fy - 114;
        const reach = 70 + p * 270;
        const coneGrad = ctx.createLinearGradient(mouthX, mouthY, mouthX + reach * dir, mouthY);
        coneGrad.addColorStop(0, `rgba(255, 224, 200, ${0.65 * (1 - p)})`);
        coneGrad.addColorStop(0.5, `rgba(255, 110, 170, ${0.42 * (1 - p)})`);
        coneGrad.addColorStop(1, 'rgba(139, 69, 19, 0)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(mouthX, mouthY);
        ctx.lineTo(mouthX + reach * dir, mouthY - (34 + p * 48));
        ctx.lineTo(mouthX + reach * dir, mouthY + (34 + p * 48));
        ctx.closePath();
        ctx.fill();

        // Concentric fizzy shock-rings
        const a1 = dir > 0 ? -0.95 : Math.PI - 0.95;
        const a2 = dir > 0 ? 0.95 : Math.PI + 0.95;
        for (let i = 0; i < 5; i++) {
          const wx = mouthX + (20 + p * 250 + i * 26) * dir;
          ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 128, 185, ${1 - p})` : `rgba(255, 240, 212, ${1 - p})`;
          ctx.lineWidth = Math.max(2, 11 - i * 1.8) * (1 - p * 0.5);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(wx, mouthY, 22 + p * 58, a1, a2);
          ctx.stroke();
        }
      } else if (v.kind === 'white_claw') {
        // Sleek Tall White Claw Can + Blazing Triple Icy-Cyan Crescent Claw Slash!
        const canX = fx + 22 * dir;
        const canY = fy - 138;
        ctx.save();
        ctx.translate(canX, canY);
        ctx.rotate(dir * 0.18);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.roundRect(-8.5, -18, 17, 36, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-7.5, -6, 15, 11);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-7.5, -14, 15, 3);
        ctx.restore();

        // Triple Razor-Sharp Icy-Cyan Crescent Claw Slashes!
        const alpha = Math.max(0, 1 - p * 0.78);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 22;
        [-26, 0, 26].forEach((off, idx) => {
          const sx = fx + (10 + idx * 4) * dir;
          const sy = fy - 126 + off;
          const mx = fx + (92 + p * 28) * dir;
          const my = fy - 104 + off;
          const ex = fx + (175 + p * 36) * dir;
          const ey = fy - 66 + off;

          // Tapered cyan energy claw blade
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(mx, my - 9 * alpha, ex, ey);
          ctx.quadraticCurveTo(mx - 6 * dir, my + 7 * alpha, sx, sy);
          ctx.closePath();
          ctx.fill();

          // Pure white blazing slash core
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 3.2 * alpha;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx + 8 * dir, sy + 2);
          ctx.quadraticCurveTo(mx, my - 2, ex - 6 * dir, ey - 2);
          ctx.stroke();
        });
      } else if (v.kind === 'height_mog') {
        // Golden Theatrical Spotlight + Towering 6'5" Metallic Measuring Ruler!
        const cone = ctx.createLinearGradient(fx, fy - 370, fx, fy);
        cone.addColorStop(0, `rgba(255, 214, 112, ${0.48 * (1 - p * 0.85)})`);
        cone.addColorStop(0.65, `rgba(255, 232, 160, ${0.18 * (1 - p * 0.85)})`);
        cone.addColorStop(1, 'rgba(255, 214, 112, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(fx - 36, fy - 370);
        ctx.lineTo(fx + 36, fy - 370);
        ctx.lineTo(fx + 124, fy);
        ctx.lineTo(fx - 124, fy);
        ctx.closePath();
        ctx.fill();

        const rx = fx - 74 * dir;
        const rh = 328 * Math.min(1, p * 2.4);
        const rulerGrad = ctx.createLinearGradient(rx, 0, rx + 28, 0);
        rulerGrad.addColorStop(0, '#fff3b0');
        rulerGrad.addColorStop(0.5, '#ffd670');
        rulerGrad.addColorStop(1, '#d97706');

        ctx.shadowColor = '#ffd670';
        ctx.shadowBlur = 18;
        ctx.fillStyle = rulerGrad;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(rx, this.GROUND_Y - rh, 28, rh, 4);
        ctx.fill();
        ctx.stroke();

        // Precision ruler tick marks
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.0;
        for (let ty = 14; ty < rh - 10; ty += 14) {
          const major = ty % 28 === 0;
          ctx.beginPath();
          ctx.moveTo(rx, this.GROUND_Y - ty);
          ctx.lineTo(rx + (major ? 16 : 9), this.GROUND_Y - ty);
          ctx.stroke();
        }

        // Bold gleaming 6'5" callout badge
        ctx.font = `700 38px 'Bangers', Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1b0c12';
        ctx.strokeText(`6'5"`, rx + 14, this.GROUND_Y - rh - 12);
        ctx.fillStyle = '#ffd670';
        ctx.fillText(`6'5"`, rx + 14, this.GROUND_Y - rh - 12);
        this._drawSparkleStar(ctx, rx + 42, this.GROUND_Y - rh - 30, 8 * (1 - p * 0.5), '#fffbe6');
      } else if (v.kind === 'forehead_kiss') {
        // Suave Romantic Heart Ribbon + Shimmer Trail!
        ctx.globalAlpha = 1 - p;
        ctx.shadowColor = '#ff4da6';
        ctx.shadowBlur = 16;
        this._drawHeart(ctx, fx + 46 * dir, fy - 134, 22 + p * 18, '#ff4da6');
        this._drawHeart(ctx, fx + 24 * dir, fy - 148 - p * 16, 11 + p * 6, '#ffd670');
        this._drawSparkleStar(ctx, fx + 64 * dir, fy - 144, 7.5 * (1 - p), '#fff0f7');
      } else if (v.kind === 'kiss_bloom') {
        // Blooming Glowing 💋 ♥ Romantic Impact Mandala!
        const sc = 0.78 + Math.sin(p * Math.PI) * 1.32;
        ctx.translate(v.x, v.y - p * 42);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.max(0, 1 - p * 0.58);

        // Radiant golden-pink halo ring
        ctx.strokeStyle = 'rgba(255, 214, 112, 0.85)';
        ctx.lineWidth = 3.5 * (1 - p * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, 34 + p * 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowColor = '#ff3f9b';
        ctx.shadowBlur = 28;
        this._drawHeart(ctx, 0, 0, 42, '#ff3596');
        this._drawHeart(ctx, 0, -2, 27, '#ff85c0');
        ctx.shadowBlur = 0;

        // Crisp glossy vector lipstick kiss mark + emoji accent
        ctx.font = `36px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💋', 0, 2);

        // Orbiting tiny love sparkles
        for (let i = 0; i < 4; i++) {
          const a = p * 3.5 + (i * Math.PI) / 2;
          this._drawSparkleStar(ctx, Math.cos(a) * 44, Math.sin(a) * 44, 6.5 * (1 - p * 0.4), '#ffd670');
        }
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // 7. SHOCKWAVES
  // ==========================================================================
  drawShockwaves(ctx, shockwaves) {
    if (!shockwaves || !shockwaves.length) return;
    for (const s of shockwaves) {
      const alpha = Math.max(0, (s.life || 0) / (s.maxLife || 0.28));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 7.5 * alpha + 1.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Secondary crisp white inner echo ring
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.72;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2 * alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(2, s.radius * 0.84), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ==========================================================================
  // 8. CAPCOM MULTI-LAYERED HIT SPARKS (4-Point & 8-Point Cross-Star Bursts!)
  // ==========================================================================
  drawHitSparks(ctx, hitSparks) {
    if (!hitSparks || !hitSparks.length) return;
    for (const h of hitSparks) {
      const alpha = Math.max(0, (h.life || 0) / (h.maxLife || 0.22));
      const sc = 0.58 + (1 - alpha) * 0.92;
      const sz = h.size || 52;

      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot || 0);
      ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;

      // Radial anime impact speed needles
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * sz * 0.45, Math.sin(a) * sz * 0.45);
        ctx.lineTo(Math.cos(a) * sz * 1.28, Math.sin(a) * sz * 1.28);
        ctx.stroke();
      }

      // Layer 1: Outer vibrant 8-point Capcom star burst
      ctx.shadowColor = h.color;
      ctx.shadowBlur = 18;
      this._drawMultiPointStar(ctx, 8, sz, sz * 0.20, h.color);

      // Layer 2: Offset sharp 4-point cross-flare
      ctx.save();
      ctx.rotate(Math.PI / 8);
      this._drawMultiPointStar(ctx, 4, sz * 1.25, sz * 0.14, '#ffd670');
      ctx.restore();

      // Layer 3: Blazing pure white 8-point core
      ctx.shadowBlur = 0;
      this._drawMultiPointStar(ctx, 8, sz * 0.62, sz * 0.18, '#ffffff');

      // Hot circular center flash
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ==========================================================================
  // 9. PARTICLES (Hearts, Notes, EYP Pages, Fizzy Bubbles, Dust, Sparkles)
  // ==========================================================================
  drawParticles(ctx, particles) {
    if (!particles || !particles.length) return;
    for (const p of particles) {
      const alpha = Math.max(0, (p.life || 0) / (p.maxLife || 0.6));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      if (p.shape === 'heart') {
        ctx.rotate(Math.sin(p.rot || 0) * 0.35);
        this._drawHeart(ctx, 0, 0, p.size * 1.7, p.color);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(-p.size * 0.45, -p.size * 0.45, p.size * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'note') {
        const fontSize = Math.round(p.size * 2.8);
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#1b0c12';
        ctx.lineWidth = 3;
        const glyph = (p.rot || 0) > Math.PI ? '♪' : '♫';
        ctx.strokeText(glyph, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(glyph, 0, 0);
      } else if (p.shape === 'page') {
        // Tumbling EYP Report sheet with mini chart bars!
        ctx.rotate(p.rot || 0);
        const flipX = Math.cos((p.rot || 0) * 1.4);
        ctx.scale(Math.abs(flipX) < 0.25 ? 0.25 : flipX, 1);
        const w = p.size * 2.0;
        const h = p.size * 2.5;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.4;
        ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
        ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
        // Blue header + mini bars
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(-w * 0.42, -h * 0.42, w * 0.84, h * 0.18);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-w * 0.36, -h * 0.12, w * 0.72, 1.8);
        ctx.fillRect(-w * 0.36, h * 0.08, w * 0.54, 1.8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-w * 0.32, h * 0.22, w * 0.22, h * 0.18);
      } else if (p.shape === 'bubble') {
        const r = p.size * 1.25;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Glossy bubble crescent specular
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.beginPath();
        ctx.arc(-r * 0.34, -r * 0.34, r * 0.26, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'dust') {
        // Soft billowing moonlit dust puff cloud
        const r = p.size;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.arc(r * 0.48, -r * 0.16, r * 0.68, 0, Math.PI * 2);
        ctx.arc(-r * 0.44, r * 0.12, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'sparkle') {
        this._drawSparkleStar(ctx, 0, 0, p.size * 1.8, p.color);
      } else {
        // Gleaming diamond spark dot
        ctx.rotate(p.rot || 0);
        this._drawSparkleStar(ctx, 0, 0, p.size * 1.35, p.color);
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // 10. BOLD ARCADE COMIC CALLOUTS
  // ==========================================================================
  drawCallouts(ctx, callouts) {
    if (!callouts || !callouts.length) return;
    for (const c of callouts) {
      const lifeRatio = Math.max(0, (c.life || 0) / (c.maxLife || 0.88));
      const alpha = Math.min(1, lifeRatio * 1.75);
      // Punchy arcade pop-in spring scale
      const elapsed = 1 - lifeRatio;
      const pop = elapsed < 0.12 ? 0.72 + (elapsed / 0.12) * 0.42 : 1.0 + Math.max(0, 0.14 - (elapsed - 0.12) * 0.8);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(-0.04);
      ctx.scale(pop, pop);

      const fontSize = Math.round(38 * (c.scale || 1));
      ctx.font = `700 ${fontSize}px 'Bangers', Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Hard comic drop shadow
      ctx.fillStyle = 'rgba(18, 4, 24, 0.78)';
      ctx.fillText(c.text, 4, 5);

      // Thick dark ink outline
      ctx.lineWidth = 7.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#18061a';
      ctx.strokeText(c.text, 0, 0);

      // Glossy top-to-bottom comic gradient fill
      const tGrad = ctx.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.45);
      tGrad.addColorStop(0, '#ffffff');
      tGrad.addColorStop(0.32, c.color);
      tGrad.addColorStop(1, c.color);
      ctx.fillStyle = tGrad;
      ctx.fillText(c.text, 0, 0);

      ctx.restore();
    }
  }

  // ==========================================================================
  // 11. CAPCOM SUPER-FREEZE CUT-IN WITH LARGE ILLUSTRATED BUNNY PORTRAIT!!
  // ==========================================================================
  drawSuperFreezeCutIn(ctx, superFreeze, time = 0) {
    if (!superFreeze) return;
    const sf = superFreeze;
    const p = 1 - Math.max(0, (sf.timer || 0) / (sf.maxTimer || 0.58));
    const isWife = sf.side === 'red';
    const W = this.W;
    const H = this.H;

    ctx.save();

    // Dramatic dark cinema flash overlay
    const flash = Math.max(0, 1 - p * 4.2);
    ctx.fillStyle = `rgba(14, 4, 24, 0.42)`;
    ctx.fillRect(0, 0, W, H);
    if (flash > 0.01) {
      ctx.fillStyle = isWife ? `rgba(255, 166, 213, ${flash * 0.35})` : `rgba(147, 197, 253, ${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- ANIME SPEED-LINE RADIAL BURST ----
    ctx.save();
    ctx.translate(W * 0.5, H * 0.48);
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2 + time * 4.5;
      const innerR = 95 + (i % 3) * 38;
      ctx.strokeStyle = i % 3 === 0
        ? 'rgba(255, 214, 112, 0.52)'
        : isWife
        ? 'rgba(255, 105, 180, 0.46)'
        : 'rgba(96, 165, 250, 0.46)';
      ctx.lineWidth = i % 2 === 0 ? 4.2 : 2.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
      ctx.lineTo(Math.cos(a) * 680, Math.sin(a) * 680);
      ctx.stroke();
    }
    ctx.restore();

    // ---- DIAGONAL GOLD-TRIMMED CAPCOM BANNER ----
    ctx.save();
    ctx.translate(W * 0.5, H * 0.48);
    ctx.rotate(-0.075);

    const bandH = 148;
    const grad = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
    grad.addColorStop(0, 'rgba(18, 4, 28, 0.98)');
    grad.addColorStop(0.28, isWife ? 'rgba(186, 20, 104, 0.96)' : 'rgba(20, 56, 152, 0.96)');
    grad.addColorStop(0.54, isWife ? 'rgba(255, 63, 155, 0.97)' : 'rgba(37, 99, 235, 0.97)');
    grad.addColorStop(0.80, isWife ? 'rgba(150, 18, 86, 0.96)' : 'rgba(20, 56, 152, 0.96)');
    grad.addColorStop(1, 'rgba(18, 4, 28, 0.98)');

    // Outer dark shadow band
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.fillRect(-W, -bandH / 2 + 8, W * 2, bandH);

    // Main banner fill + clipped kinetic diagonal stripes & portrait!
    ctx.save();
    ctx.beginPath();
    ctx.rect(-W, -bandH / 2, W * 2, bandH);
    ctx.clip();

    ctx.fillStyle = grad;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);

    // Kinetic sliding white speed streaks inside banner
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 3;
    const shift = (time * 900) % 160;
    for (let sx = -W; sx < W; sx += 90) {
      ctx.beginPath();
      ctx.moveTo(sx + shift, -bandH / 2);
      ctx.lineTo(sx + shift - 48, bandH / 2);
      ctx.stroke();
    }

    // Smooth ease-out slide for Illustrated Close-Up Bunny Portrait!
    const ease = 1 - Math.pow(1 - Math.min(1, p * 3.8), 3);
    const slide = (1 - ease) * (isWife ? -320 : 320);

    // Radiant halo behind close-up portrait
    const pX = (isWife ? -250 : 250) + slide;
    const pHalo = ctx.createRadialGradient(pX, 12, 16, pX, 12, 130);
    pHalo.addColorStop(0, 'rgba(255, 240, 210, 0.65)');
    pHalo.addColorStop(0.55, isWife ? 'rgba(255, 119, 186, 0.30)' : 'rgba(96, 165, 250, 0.30)');
    pHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pHalo;
    ctx.beginPath();
    ctx.arc(pX, 12, 130, 0, Math.PI * 2);
    ctx.fill();

    // Large Illustrated Close-Up Portrait (Winking Wifebun or Glasses-Glinting Husbun!)
    ctx.save();
    ctx.translate(pX, 24);
    ctx.scale(isWife ? 2.35 : -2.35, 2.35);
    if (isWife) {
      this._drawWifebunHead(
        ctx,
        {
          winkTimer: 1,
          heartEyesTimer: 0,
          blushTimer: 1,
          hitFlash: 0,
          koState: false,
          cheekPuff: 0,
          earLag: -0.14,
          move: null,
        },
        time,
        false
      );
    } else {
      this._drawHusbunHead(
        ctx,
        {
          heartEyesTimer: 0,
          hitFlash: 0,
          koState: false,
          earLag: -0.10,
          move: { id: 'eyp_report' },
        },
        time,
        false
      );
    }
    ctx.restore();

    // Twinkling anime stars & hearts beside portrait
    this._drawSparkleStar(ctx, pX + (isWife ? 78 : -78), -36, 11, '#fff8db');
    this._drawHeart(ctx, pX + (isWife ? 98 : -98), 26, 12, isWife ? '#ffd670' : '#ff77ba');

    // Bold Supersized Arcade Super Move Title
    const textX = (isWife ? 82 : -82) + slide * 0.45;
    const title = `★ ${sf.title} ★`;
    ctx.font = `700 62px 'Bangers', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Kinetic echo shadow
    ctx.fillStyle = 'rgba(18, 4, 28, 0.72)';
    ctx.fillText(title, textX + 6, 10);

    // Heavy ink outline + gleaming gold-to-white gradient
    ctx.lineWidth = 9.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#18061a';
    ctx.strokeText(title, textX, 4);

    const titleGrad = ctx.createLinearGradient(0, -32, 0, 34);
    titleGrad.addColorStop(0, '#fffbe6');
    titleGrad.addColorStop(0.45, '#ffd670');
    titleGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = titleGrad;
    ctx.fillText(title, textX, 4);

    // Subtitle flair strip
    ctx.font = `700 15px 'Chakra Petch', sans-serif`;
    ctx.fillStyle = '#fff0f7';
    ctx.fillText(
      isWife ? '♥ WIFEBUN ULTIMATE FINISH ♥' : '★ HUSBUN EXECUTIVE FINISH ★',
      textX,
      46
    );

    ctx.restore(); // end banner clip

    // Gleaming Gold Top & Bottom Banner Trim Borders
    ctx.strokeStyle = '#ffd670';
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.moveTo(-W, -bandH / 2); ctx.lineTo(W, -bandH / 2);
    ctx.moveTo(-W, bandH / 2); ctx.lineTo(W, bandH / 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-W, -bandH / 2 + 6); ctx.lineTo(W, -bandH / 2 + 6);
    ctx.moveTo(-W, bandH / 2 - 6); ctx.lineTo(W, bandH / 2 - 6);
    ctx.stroke();

    ctx.restore(); // diagonal banner
    ctx.restore();
  }

  // ==========================================================================
  // PRIMITIVE GEOMETRY HELPERS
  // ==========================================================================
  _drawHeart(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.36);
    ctx.bezierCurveTo(-size, -size * 0.28, -size * 0.62, -size, 0, -size * 0.34);
    ctx.bezierCurveTo(size * 0.62, -size, size, -size * 0.28, 0, size * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawSparkleStar(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? r : r * 0.22;
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawMultiPointStar(ctx, points, outerR, innerR, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / points;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
