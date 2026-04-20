'use strict';

const UI = (() => {

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function updateTitleResources(resources) {
    const el = document.getElementById('title-resources');
    el.innerHTML = `
      <span class="res gold">金幣 <b>${resources.gold}</b></span>
      <span class="res crystal">魔晶 <b>${resources.crystal}</b></span>
      <span class="res soul">靈魂 <b>${resources.soul}</b></span>
    `;
  }

  function showResult(data, onContinue) {
    document.getElementById('result-title').textContent = data.victory ? '勝利！' : '城堡陷落';
    document.getElementById('result-title').style.color = data.victory ? '#4caf50' : '#f44336';
    document.getElementById('result-stats').innerHTML = `
      <div>擊殺數：<b>${data.kills}</b></div>
    `;
    document.getElementById('result-rewards').innerHTML = `
      <div>本場收益</div>
      <span class="res gold">金幣 <b>+${data.gold}</b></span>&nbsp;&nbsp;
      <span class="res crystal">魔晶 <b>+${data.crystal}</b></span>&nbsp;&nbsp;
      <span class="res soul">靈魂 <b>+${data.soul}</b></span>
    `;
    document.getElementById('btn-to-upgrade').onclick = onContinue;
    showScreen('screen-result');
  }

  function renderUpgradeScreen(skillLevels, resources, onBuy, currentLevel) {
    // Update resource display
    document.getElementById('up-gold').textContent = resources.gold;
    document.getElementById('up-crystal').textContent = resources.crystal;
    document.getElementById('up-soul').textContent = resources.soul;

    // Update next level button label
    const nextLvl = Math.min(currentLevel + 1, C.LEVELS.length);
    document.getElementById('btn-next-level').textContent =
      currentLevel >= C.LEVELS.length ? '全關卡完成！' : `前往第 ${nextLvl} 關 →`;
    document.getElementById('btn-next-level').disabled = currentLevel >= C.LEVELS.length;

    // Render each skill panel
    const keys = ['auto-normal', 'auto-bomb', 'click-arrow', 'click-lightning', 'castle'];
    for (const key of keys) {
      renderSkillPanel(key, skillLevels, resources, onBuy);
    }
  }

  function renderSkillPanel(key, skillLevels, resources, onBuy) {
    const panel = document.getElementById(`panel-${key}`);
    if (!panel) return;

    const def = C.SKILLS[key];
    const currentLvl = skillLevels[key]; // 0 = not bought
    const maxLvl = def.levels.length;
    const isMaxed = currentLvl >= maxLvl;
    const isLocked = Skills.isLocked(key, skillLevels);

    // Build header
    let html = `<div style="margin-bottom:16px">
      <h3 style="color:#f0c040;margin-bottom:4px">${def.label}</h3>
      <p style="font-size:.8rem;color:#8b949e">${def.desc}</p>`;

    if (def.requiresKey) {
      const reqDef = C.SKILLS[def.requiresKey];
      html += `<p style="font-size:.75rem;color:${isLocked ? '#f85149' : '#4caf50'}">
        需要：${reqDef.label} Lv${def.requiresLevel} ${isLocked ? '（未解鎖）' : '（已解鎖）'}
      </p>`;
    }
    html += `</div><div class="skill-tree">`;

    for (let i = 0; i < maxLvl; i++) {
      const lvlData = def.levels[i];
      const isBought = currentLvl > i;
      const isNext = currentLvl === i;
      const canBuy = isNext && !isLocked && Skills.canAfford(key, skillLevels, resources);
      const nodeClass = isMaxed && i === maxLvl - 1 ? 'skill-node maxed' :
                        isLocked ? 'skill-node locked' : 'skill-node';

      html += `<div class="${nodeClass}">
        <h4>Lv${i + 1}</h4>
        <div class="level-display">${isBought ? '✓ 已購買' : isNext ? '▶ 可購買' : '─ 未解鎖'}</div>
        <div class="skill-stat">${formatSkillStat(key, lvlData)}</div>
        <div class="cost">${formatCost(lvlData.cost)}</div>
        <button
          ${!isNext || isLocked || !canBuy ? 'disabled' : ''}
          onclick="window.__onBuySkill('${key}')"
        >${isBought ? '已購買' : isMaxed && i === maxLvl - 1 ? '已滿等' : canBuy ? '購買' : '購買'}</button>
      </div>`;
    }

    html += '</div>';
    panel.innerHTML = html;

    // Store callback
    window.__onBuySkill = onBuy;
  }

  function formatSkillStat(key, d) {
    if (key === 'auto-normal') {
      return `投射物：${d.projectiles}<br>傷害：${d.damage}<br>爆擊率：${Math.round(d.critChance * 100)}%`;
    }
    if (key === 'auto-bomb') {
      return `範圍：${d.radius}px<br>傷害：${d.damage}<br>燃燒：${d.burnDuration}s / ${d.burnDps}DPS`;
    }
    if (key === 'click-arrow') {
      return `箭矢數：${d.arrows}<br>傷害：${d.damage}<br>穿透：${d.pierce}次`;
    }
    if (key === 'click-lightning') {
      return `觸發點擊：${d.clicksNeeded}次<br>範圍：${d.radius}px<br>傷害：${d.damage}`;
    }
    if (key === 'castle') {
      return `血量：${d.hp}<br>防禦：${Math.round(d.defense * 100)}%`;
    }
    return '';
  }

  function formatCost(cost) {
    const parts = [];
    if (cost.gold)    parts.push(`<span style="color:#f0c040">${cost.gold}金幣</span>`);
    if (cost.crystal) parts.push(`<span style="color:#79c0ff">${cost.crystal}魔晶</span>`);
    if (cost.soul)    parts.push(`<span style="color:#d2a8ff">${cost.soul}靈魂</span>`);
    return parts.length ? parts.join(' + ') : '免費';
  }

  function initSkillTabs() {
    document.querySelectorAll('#skill-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#skill-tabs .tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.skill-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panelId = 'panel-' + tab.dataset.tab;
        document.getElementById(panelId).classList.add('active');
      });
    });
  }

  return { showScreen, updateTitleResources, showResult, renderUpgradeScreen, initSkillTabs };
})();
