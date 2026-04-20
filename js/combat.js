'use strict';

const Combat = (() => {
  // ── State ──
  let canvas, ctx;
  let state;           // game state ref
  let combatStats;     // derived from Skills
  let levelCfg;

  // entities
  let monsters = [];
  let playerProjectiles = [];
  let enemyProjectiles = [];
  let lightnings = [];
  let explosions = [];
  let floatTexts = [];
  let stars = [];
  let sparkles = [];

  // timers
  let autoNormalTimer = 0;
  let autoBombTimer = 0;
  let roundTimer = 0;
  let spawnTimer = 0;     // counts down to next monster spawn
  let starTimer = 4.0;    // counts down to next sky star

  // castle
  let castleHp = 0;
  let castleMaxHp = 0;

  // round results
  let totalKills = 0;
  let roundGold = 0;
  let roundCrystal = 0;
  let roundSoul = 0;

  // click tracking
  let clickCount = 0;
  let lightningClicksNeeded = 8;

  // callbacks
  let onRoundEnd = null;
  let onLog = null;

  const CASTLE_RIGHT = C.CASTLE_X + C.CASTLE_W;
  const CASTLE_MID_Y = C.CASTLE_Y + C.CASTLE_H / 2;

  // ── Public API ──
  let clickListenerAttached = false;

  function init(canvasEl, gameState, endCallback, logCallback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    state = gameState;
    onRoundEnd = endCallback;
    onLog = logCallback;
  }

  function attachClickListener() {
    if (!clickListenerAttached) {
      canvas.addEventListener('mousedown', handleClick);
      canvas.addEventListener('touchstart', handleTouch, { passive: false });
      clickListenerAttached = true;
    }
  }

  function handleTouch(e) {
    e.preventDefault(); // block scroll/zoom during combat
    const touch = e.changedTouches[0];
    handleClick({ clientX: touch.clientX, clientY: touch.clientY });
  }

  function startRound() {
    attachClickListener();
    levelCfg = C.getLevelConfig(state.currentLevel);
    combatStats = Skills.getCombatStats(state.skillLevels, state.infiniteLevels);

    castleMaxHp = combatStats.castleMaxHp;
    castleHp = castleMaxHp;

    monsters = [];
    playerProjectiles = [];
    enemyProjectiles = [];
    lightnings = [];
    explosions = [];
    floatTexts = [];
    stars = [];
    sparkles = [];

    autoNormalTimer = 0;
    autoBombTimer = 0;
    roundTimer = C.ROUND_DURATION;
    spawnTimer = 0.5;
    starTimer = 4.0;

    totalKills = 0;
    roundGold = 0;
    roundCrystal = 0;
    roundSoul = 0;

    clickCount = 0;
    lightningClicksNeeded = combatStats.lightningClicksNeeded;

    updateHUD();
  }

  function updateHUD() {
    document.getElementById('hud-level').textContent = `關卡 ${state.currentLevel}`;
    document.getElementById('hud-wave').textContent = `擊殺 ${totalKills}`;
    const mins = Math.floor(roundTimer / 60);
    const secs = Math.floor(roundTimer % 60);
    document.getElementById('hud-timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('hud-hp').textContent = `城堡 ${Math.max(0, Math.ceil(castleHp))}/${castleMaxHp}`;

    // lightning bar
    const needed = lightningClicksNeeded;
    const pct = (clickCount / needed) * 100;
    document.getElementById('lightning-bar').style.width = pct + '%';
    document.getElementById('lightning-count').textContent = `${clickCount}/${needed}`;

    // resource display
    document.getElementById('res-gold').textContent = state.resources.gold;
    document.getElementById('res-crystal').textContent = state.resources.crystal;
    document.getElementById('res-soul').textContent = state.resources.soul;
  }

  let lastTime = 0;
  let rafId = null;
  let running = false;

  function startLoop() {
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    update(dt);
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  // ── Update ──
  function update(dt) {
    roundTimer -= dt;

    // continuous monster spawning
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = levelCfg.spawnInterval * (0.85 + Math.random() * 0.3); // ±15% jitter
      monsters.push(new Monster(pickMonsterType(), levelCfg));
    }

    // auto attacks
    if (combatStats.autoEnabled) {
      autoNormalTimer -= dt;
      if (autoNormalTimer <= 0) {
        autoNormalTimer = combatStats.autoRate;
        fireAutoNormal();
      }
    }
    if (combatStats.bombEnabled) {
      autoBombTimer -= dt;
      if (autoBombTimer <= 0) {
        autoBombTimer = combatStats.bombRate;
        fireAutoBomb();
      }
    }

    // update monsters
    for (const m of monsters) {
      m.update(dt, C.CASTLE_X, CASTLE_RIGHT);
    }

    // ranged monster attacks
    for (const m of monsters) {
      if (!m.alive || m.type !== 'ranged' || !m.isStopped) continue;
      m.atkTimer -= dt;
      if (m.atkTimer <= 0) {
        m.atkTimer = m.atkRate;
        const dmg = Math.round(m.atk * (1 - combatStats.castleDefense));
        enemyProjectiles.push(new RangedProjectile(m.x, m.y, dmg));
      }
    }

    // melee monster attacks
    for (const m of monsters) {
      if (!m.alive || m.type === 'ranged') continue;
      if (m.isStopped && m.x - m.radius <= CASTLE_RIGHT + 2) {
        m.atkTimer -= dt;
        if (m.atkTimer <= 0) {
          m.atkTimer = m.atkRate;
          const dmg = Math.round(m.atk * (1 - combatStats.castleDefense));
          castleHp -= dmg;
          spawnFloatText(`-${dmg}`, C.CASTLE_X + C.CASTLE_W / 2, C.CASTLE_Y, '#f85149');
        }
      }
    }

    // sky stars
    starTimer -= dt;
    if (starTimer <= 0) {
      stars.push(new Star());
      starTimer = 4.0;
    }
    for (const s of stars) s.update(dt);
    for (const sp of sparkles) sp.update(dt);

    // update player projectiles
    for (const p of playerProjectiles) {
      if (!p.alive) continue;
      p.update(dt);
      if (p instanceof Bomb && p.exploded) {
        const hits = p.explode(monsters.filter(m => m.alive));
        explosions.push(new Explosion(p.targetX, p.targetY, p.radius));
        p.alive = false;
      } else if (!(p instanceof Bomb)) {
        // check monster hits
        for (const m of monsters) {
          if (m.alive) p.tryHit && p.tryHit(m);
        }
        // arrows also hit stars
        if (p.tryHit) {
          for (const s of stars) {
            if (s.alive && p.alive) {
              const dx = p.x - s.x, dy = p.y - s.y;
              if (dx * dx + dy * dy <= (s.radius + 8) ** 2) {
                destroyStar(s);
                p.alive = false;
              }
            }
          }
        }
      }
    }

    // update enemy projectiles
    for (const ep of enemyProjectiles) {
      if (!ep.alive) continue;
      ep.update(dt);
      if (ep.x <= CASTLE_RIGHT) {
        castleHp -= ep.damage;
        spawnFloatText(`-${ep.damage}`, C.CASTLE_X + C.CASTLE_W / 2, C.CASTLE_Y - 10, '#f85149');
        ep.alive = false;
      }
    }

    // update lightning visuals
    for (const l of lightnings) {
      l.displayTimer -= dt;
    }

    // update explosions
    for (const e of explosions) {
      e.timer -= dt;
    }

    // update float texts
    for (const f of floatTexts) {
      f.timer -= dt;
      f.y -= 35 * dt;
    }

    // collect kills — add resources immediately
    for (const m of monsters) {
      if (!m.alive && !m.rewarded) {
        m.rewarded = true;
        totalKills++;
        const rm = levelCfg.rewardMult;
        const g = Math.round(randInt(m.reward.gold[0], m.reward.gold[1]) * rm);
        const c = Math.random() < m.reward.crystal * Math.min(rm, 4) ? 1 : 0;
        const s = Math.random() < m.reward.soul    * Math.min(rm, 4) ? 1 : 0;
        roundGold    += g;
        roundCrystal += c;
        roundSoul    += s;
        state.resources.gold    += g;
        state.resources.crystal += c;
        state.resources.soul    += s;
        // build float text showing all drops
        let label = `+${g}金`;
        if (c) label += ` +${c}晶`;
        if (s) label += ` +${s}魂`;
        spawnFloatText(label, m.x, m.y - m.radius - 4, c || s ? '#a5d6ff' : '#f0c040');
      }
    }

    // prune dead
    playerProjectiles = playerProjectiles.filter(p => p.alive);
    enemyProjectiles  = enemyProjectiles.filter(p => p.alive);
    lightnings        = lightnings.filter(l => l.displayTimer > 0);
    explosions        = explosions.filter(e => e.timer > 0);
    floatTexts        = floatTexts.filter(f => f.timer > 0);
    monsters          = monsters.filter(m => m.alive || !m.rewarded);
    stars             = stars.filter(s => s.alive);
    sparkles          = sparkles.filter(sp => sp.timer > 0);

    // end conditions
    if (roundTimer <= 0) { endRound(castleHp > 0); return; }
    if (castleHp <= 0)   { endRound(false); return; }

    updateHUD();
  }

  function pickMonsterType() {
    const r = Math.random();
    const d = levelCfg.dist;
    if (r < d.swarm) return 'swarm';
    if (r < d.swarm + d.tank) return 'tank';
    return 'ranged';
  }

  function fireAutoNormal() {
    const targets = getTargets(combatStats.autoProjectiles);
    for (const t of targets) {
      const isCrit = Math.random() < combatStats.autoCrit;
      const dmg = isCrit ? Math.round(combatStats.autoDamage * 2) : combatStats.autoDamage;
      const arrow = new Arrow(CASTLE_RIGHT + 5, CASTLE_MID_Y, t.x, t.y, dmg, 0, 'auto');
      playerProjectiles.push(arrow);
      if (isCrit) spawnFloatText('暴擊!', t.x, t.y - 15, '#f0c040');
    }
  }

  function fireAutoBomb() {
    const target = getLeadTarget();
    if (!target) return;
    const cfg = Skills.getStats('auto-bomb', state.skillLevels);
    playerProjectiles.push(new Bomb(CASTLE_RIGHT + 5, CASTLE_MID_Y, target.x, cfg));
  }

  function getTargets(count) {
    // target frontmost (closest to castle) alive monsters
    const alive = monsters.filter(m => m.alive).sort((a, b) => a.x - b.x);
    const targets = [];
    const used = new Set();
    for (let i = 0; i < alive.length && targets.length < count; i++) {
      if (!used.has(alive[i].id)) {
        targets.push(alive[i]);
        used.add(alive[i].id);
      }
    }
    return targets;
  }

  function getLeadTarget() {
    const alive = monsters.filter(m => m.alive);
    if (alive.length === 0) return null;
    return alive.reduce((a, b) => a.x < b.x ? a : b);
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = C.CANVAS_W / rect.width;
    const scaleY = C.CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Check star hit first (direct tap)
    for (const s of stars) {
      if (s.alive && s.containsPoint(cx, cy)) {
        destroyStar(s);
        return; // consume the click — no arrows fired
      }
    }

    // Click arrows
    const arrowDmg = combatStats.arrowDamage;
    const arrowCount = combatStats.arrowCount;
    const arrowPierce = combatStats.arrowPierce;
    const spread = 14;
    for (let i = 0; i < arrowCount; i++) {
      const offsetY = (i - (arrowCount - 1) / 2) * spread;
      playerProjectiles.push(new Arrow(CASTLE_RIGHT + 5, CASTLE_MID_Y, cx, cy + offsetY, arrowDmg, arrowPierce, 'click'));
    }

    // Lightning tracking
    clickCount++;
    if (combatStats.lightningEnabled && clickCount >= lightningClicksNeeded) {
      clickCount = 0;
      triggerLightning(cx, cy);
    }
    updateHUD();
  }

  function destroyStar(star) {
    star.alive = false;
    sparkles.push(new Sparkle(star.x, star.y));
    const r = star.reward;
    const g = r.gold * 3, c = r.crystal * 3, s = r.soul * 3;
    state.resources.gold    += g;
    state.resources.crystal += c;
    state.resources.soul    += s;
    roundGold    += g;
    roundCrystal += c;
    roundSoul    += s;
    let label = `+${g}金`;
    if (c) label += ` +${c}晶`;
    if (s) label += ` +${s}魂`;
    spawnFloatText(label, star.x, star.y - 18, r.soul ? '#d2a8ff' : r.crystal ? '#79c0ff' : '#ffe066');
    updateHUD();
  }

  function triggerLightning(x, y) {
    const l = new Lightning(x, y, combatStats.lightningRadius, combatStats.lightningDamage);
    const hits = l.strike(monsters.filter(m => m.alive));
    lightnings.push(l);
    if (hits > 0 && onLog) onLog(`⚡ 落雷命中 ${hits} 隻怪物！`);
  }

  function spawnFloatText(text, x, y, color) {
    floatTexts.push({ text, x, y: y - 20, color, timer: 0.8 });
  }

  function endRound(victory) {
    stopLoop();
    // resources already added to state on each kill; just pass totals for result screen
    if (onRoundEnd) onRoundEnd({ victory, kills: totalKills, gold: roundGold, crystal: roundCrystal, soul: roundSoul });
  }

  // ── Draw ──
  function draw() {
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    drawBackground();

    // stars in sky (behind castle / monsters)
    for (const s of stars) s.draw(ctx);
    for (const sp of sparkles) sp.draw(ctx);

    drawCastle();

    // explosions behind monsters
    for (const e of explosions) e.draw(ctx);

    // monsters
    for (const m of monsters) m.draw(ctx);

    // projectiles
    for (const p of playerProjectiles) p.draw(ctx);
    for (const ep of enemyProjectiles) ep.draw(ctx);

    // lightning
    for (const l of lightnings) l.draw(ctx);

    // float texts
    for (const f of floatTexts) drawFloatText(f);
  }

  function drawBackground() {
    // Sky
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Ground
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, C.PATH_Y + 20, C.CANVAS_W, C.CANVAS_H - C.PATH_Y - 20);

    // Path
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(0, C.PATH_Y - 25, C.CANVAS_W, 50);

    // Path dashes
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(C.CASTLE_X + C.CASTLE_W, C.PATH_Y);
    ctx.lineTo(C.CANVAS_W, C.PATH_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCastle() {
    const x = C.CASTLE_X;
    const y = C.CASTLE_Y;
    const w = C.CASTLE_W;
    const h = C.CASTLE_H;

    // Body
    ctx.fillStyle = '#2c5f8a';
    ctx.fillRect(x, y, w, h);

    // Battlements
    ctx.fillStyle = '#3a7ab5';
    const merlonW = 10, merlonH = 14, gap = 4;
    for (let mx = x + 4; mx + merlonW <= x + w - 4; mx += merlonW + gap) {
      ctx.fillRect(mx, y - merlonH, merlonW, merlonH);
    }

    // Gate
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(x + w / 2 - 8, y + h - 22, 16, 22);

    // HP bar
    const hpPct = Math.max(0, castleHp / castleMaxHp);
    const barW = w + 10;
    const barX = x - 5;
    const barY = y - 20;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 6);
    ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#f0c040' : '#f44336';
    ctx.fillRect(barX, barY, barW * hpPct, 6);
  }

  function drawFloatText(f) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.timer / 0.5);
    ctx.fillStyle = f.color || '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  return { init, startRound, startLoop, stopLoop };
})();

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
