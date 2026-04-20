'use strict';

let _monsterId = 0;

class Monster {
  constructor(type, levelCfg) {
    this.id = ++_monsterId;
    this.type = type;
    const base = C.MONSTER_BASE[type];
    this.hp = Math.floor(base.hp * levelCfg.hpMult);
    this.maxHp = this.hp;
    this.speed = base.speed;
    this.atk = Math.floor(base.atk * levelCfg.atkMult);
    this.atkRate = base.atkRate; // seconds between attacks
    this.atkTimer = 0;
    this.reward = base.reward;
    this.radius = base.radius;
    this.color = base.color;
    this.shape = base.shape;

    // spawn off right edge
    this.x = C.CANVAS_W + this.radius + Math.random() * 60;
    this.y = C.PATH_Y;

    // burn state
    this.burnTimer = 0;
    this.burnDps = 0;

    // ranged: does this monster stop to attack?
    this.isStopped = false;

    // alive flag
    this.alive = true;
  }

  update(dt, castleX, castleRight) {
    if (!this.alive) return;

    // burn tick
    if (this.burnTimer > 0) {
      this.hp -= this.burnDps * dt;
      this.burnTimer -= dt;
      if (this.burnTimer < 0) this.burnTimer = 0;
      if (this.hp <= 0) { this.hp = 0; this.alive = false; return; }
    }

    if (this.type === 'ranged') {
      const distToCastle = this.x - castleRight;
      if (distToCastle <= C.RANGED_ATTACK_RANGE) {
        this.isStopped = true;
        // attack handled in combat.js
        return;
      }
    }

    this.isStopped = false;
    this.x -= this.speed * dt;

    // hit castle boundary
    if (this.x - this.radius <= castleRight) {
      this.x = castleRight + this.radius;
      this.isStopped = true;
    }
  }

  applyBurn(duration, dps) {
    if (this.burnTimer < duration) this.burnTimer = duration;
    if (this.burnDps < dps) this.burnDps = dps;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();

    // burn glow
    if (this.burnTimer > 0) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 10;
    }

    ctx.fillStyle = this.color;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const r = this.radius;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'rect') {
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (this.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = r * 2.2;
      const barH = 3;
      const bx = x - barW / 2;
      const by = y - r - 6;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = this.hp / this.maxHp > 0.5 ? '#4caf50' : '#f44336';
      ctx.fillRect(bx, by, barW * (this.hp / this.maxHp), barH);
    }
  }
}

// Ranged monster projectile (fired at castle)
let _rpId = 0;
class RangedProjectile {
  constructor(x, y, damage) {
    this.id = ++_rpId;
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.speed = C.RANGED_PROJ_SPEED;
    this.alive = true;
  }

  update(dt) {
    this.x -= this.speed * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#f90';
    ctx.beginPath();
    ctx.arc(Math.round(this.x), Math.round(this.y), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Sky Star ──
let _starId = 0;
class Star {
  constructor() {
    this.id = ++_starId;
    // spawn in sky area, clear of castle
    this.x = 140 + Math.random() * (C.CANVAS_W - 180);
    this.y = 18  + Math.random() * 180;
    this.radius = 13;
    this.alive = true;
    this.lifeTimer = 7.0;   // disappears after 7s if not hit
    this.phase = Math.random() * Math.PI * 2;
    // pick reward type
    const r = Math.random();
    if (r < 0.55)      this.reward = { gold: 2 + Math.floor(Math.random() * 3), crystal: 0, soul: 0 };
    else if (r < 0.85) this.reward = { gold: 1, crystal: 1, soul: 0 };
    else               this.reward = { gold: 1, crystal: 0, soul: 1 };
  }

  update(dt) {
    this.phase += dt * 2.8;
    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) this.alive = false;
  }

  containsPoint(px, py) {
    const dx = px - this.x, dy = py - this.y;
    return dx * dx + dy * dy <= (this.radius + 10) ** 2;
  }

  draw(ctx) {
    if (!this.alive) return;
    const fadeAlpha = Math.min(1, this.lifeTimer * 0.6);
    const pulse = 0.88 + Math.sin(this.phase) * 0.12;
    const r = this.radius * pulse;

    ctx.save();
    ctx.globalAlpha = fadeAlpha;

    // outer glow
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.4);
    grd.addColorStop(0, 'rgba(255,230,80,0.45)');
    grd.addColorStop(1, 'rgba(255,180,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // 5-pointed star shape
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      const rad   = i % 2 === 0 ? r : r * 0.42;
      const sx    = this.x + Math.cos(angle) * rad;
      const sy    = this.y + Math.sin(angle) * rad;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // reward hint dot
    const dotColor = this.reward.soul ? '#d2a8ff' : this.reward.crystal ? '#79c0ff' : '#f0c040';
    ctx.shadowBlur = 0;
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Sparkle effect when star is destroyed ──
class Sparkle {
  constructor(x, y) {
    this.timer = 0.65;
    this.maxTimer = 0.65;
    this.particles = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const spd   = 55 + Math.random() * 70;
      return { x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd };
    });
  }

  update(dt) {
    this.timer -= dt;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt; // slight gravity
    }
  }

  draw(ctx) {
    if (this.timer <= 0) return;
    const alpha = this.timer / this.maxTimer;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.fillStyle = i % 3 === 0 ? '#d2a8ff' : i % 3 === 1 ? '#79c0ff' : '#ffe066';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // central flash ring fading out
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(
      this.particles[0].x - this.particles[0].vx * (this.maxTimer - this.timer),
      this.particles[0].y - this.particles[0].vy * (this.maxTimer - this.timer) + 30 * (this.maxTimer - this.timer) ** 2,
      (1 - alpha) * 28, 0, Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  }
}
