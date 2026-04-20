'use strict';

let _projId = 0;

// Arrow: flies toward a target X position on the path, pierces enemies
class Arrow {
  constructor(startX, startY, targetX, targetY, damage, pierce, color = 'auto') {
    this.id = ++_projId;
    this.x = startX;
    this.y = startY;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = (dx / len) * 600;
    this.vy = (dy / len) * 600;
    this.damage = damage;
    this.pierceLeft = pierce;
    this.alive = true;
    this.hit = new Set();
    // 'auto' = yellow, 'click' = cyan
    this.tipColor  = color === 'click' ? '#00e5ff' : '#ffe066';
    this.tailColor = color === 'click' ? '#00bcd4' : '#f0c040';
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x > C.CANVAS_W + 20 || this.x < -20 || this.y < -20 || this.y > C.CANVAS_H + 20) {
      this.alive = false;
    }
  }

  tryHit(monster) {
    if (!monster.alive || this.hit.has(monster.id)) return false;
    const dx = this.x - monster.x;
    const dy = this.y - monster.y;
    if (dx * dx + dy * dy <= (monster.radius + 10) ** 2) {
      this.hit.add(monster.id);
      monster.takeDamage(this.damage);
      if (this.pierceLeft <= 0) this.alive = false;
      else this.pierceLeft--;
      return true;
    }
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.tipColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.tailColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.055, this.y - this.vy * 0.055);
    ctx.stroke();
    ctx.restore();
  }
}

// Bomb: slow arc projectile, explodes on arrival
class Bomb {
  constructor(startX, startY, targetX, levelCfg) {
    this.id = ++_projId;
    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = C.PATH_Y;
    this.speed = 180;
    this.travelDist = Math.abs(targetX - startX);
    this.traveled = 0;
    this.radius = levelCfg.radius;
    this.damage = levelCfg.damage;
    this.burnDuration = levelCfg.burnDuration;
    this.burnDps = levelCfg.burnDps;
    this.alive = true;
    this.exploded = false;
  }

  update(dt) {
    if (this.exploded) { this.alive = false; return; }
    const remainingX = this.targetX - this.x;
    if (Math.abs(remainingX) < 5) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.exploded = true;
      return;
    }
    const stepX = Math.min(this.speed * dt, Math.abs(remainingX)) * Math.sign(remainingX);
    this.x += stepX;
    const hProgress = Math.max(0, Math.min(1, (this.x - this.startX) / (this.travelDist || 1)));
    this.y = this.startY + (this.targetY - this.startY) * hProgress - Math.sin(hProgress * Math.PI) * 60;
  }

  explode(monsters) {
    const results = [];
    for (const m of monsters) {
      const dx = m.x - this.targetX;
      const dy = m.y - this.targetY;
      if (dx * dx + dy * dy <= this.radius ** 2) {
        m.takeDamage(this.damage);
        m.applyBurn(this.burnDuration, this.burnDps);
        results.push(m.id);
      }
    }
    return results;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#ff6600';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(Math.round(this.x), Math.round(this.y), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawExplosion(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,100,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.targetX, this.targetY, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Lightning: instant AoE at a position
class Lightning {
  constructor(x, y, radius, damage) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.displayTimer = 0.35; // how long visual lingers
  }

  strike(monsters) {
    let hits = 0;
    for (const m of monsters) {
      const dx = m.x - this.x;
      const dy = m.y - this.y;
      if (dx * dx + dy * dy <= this.radius ** 2) {
        m.takeDamage(this.damage);
        hits++;
      }
    }
    return hits;
  }

  draw(ctx) {
    if (this.displayTimer <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.displayTimer * 3);
    // Circle
    ctx.strokeStyle = '#a5d6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Bolt lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const bolts = 6;
    for (let i = 0; i < bolts; i++) {
      const angle = (i / bolts) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      const jx = this.x + Math.cos(angle) * this.radius * (0.5 + Math.random() * 0.5);
      const jy = this.y + Math.sin(angle) * this.radius * (0.5 + Math.random() * 0.5);
      ctx.lineTo(jx, jy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Explosion visual (short-lived)
class Explosion {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.timer = 0.3;
  }

  draw(ctx) {
    if (this.timer <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.timer / 0.3 * 0.7;
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (1 - this.timer / 0.3) * 0.8 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
