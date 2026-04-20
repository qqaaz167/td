'use strict';

// Skills provides read helpers on top of game state skillLevels
const Skills = {
  // Returns current stats for a skill key, or null if not unlocked
  getStats(key, skillLevels) {
    const lvl = skillLevels[key];
    if (lvl <= 0) return null;
    return C.SKILLS[key].levels[lvl - 1];
  },

  // Returns stats for the NEXT level (what you'll get after buying)
  getNextStats(key, skillLevels) {
    const lvl = skillLevels[key];
    const maxLvl = C.SKILLS[key].levels.length;
    if (lvl >= maxLvl) return null;
    return C.SKILLS[key].levels[lvl]; // 0-indexed = next level
  },

  isMaxed(key, skillLevels) {
    return skillLevels[key] >= C.SKILLS[key].levels.length;
  },

  isLocked(key, skillLevels) {
    const def = C.SKILLS[key];
    if (!def.requiresKey) return false;
    return skillLevels[def.requiresKey] < def.requiresLevel;
  },

  canAfford(key, skillLevels, resources) {
    if (this.isMaxed(key, skillLevels)) return false;
    if (this.isLocked(key, skillLevels)) return false;
    const next = this.getNextStats(key, skillLevels);
    if (!next) return false;
    const cost = next.cost;
    return resources.gold >= cost.gold &&
           resources.crystal >= cost.crystal &&
           resources.soul >= cost.soul;
  },

  buy(key, skillLevels, resources) {
    if (!this.canAfford(key, skillLevels, resources)) return false;
    const next = this.getNextStats(key, skillLevels);
    resources.gold -= next.cost.gold;
    resources.crystal -= next.cost.crystal;
    resources.soul -= next.cost.soul;
    skillLevels[key]++;
    return true;
  },

  // Derived combat stats from current skill levels + infinite upgrades
  getCombatStats(skillLevels, infiniteLevels) {
    const an = this.getStats('auto-normal', skillLevels);
    const ab = this.getStats('auto-bomb', skillLevels);
    const ca = this.getStats('click-arrow', skillLevels);
    const cl = this.getStats('click-lightning', skillLevels);
    const cs = this.getStats('castle', skillLevels);
    const il = infiniteLevels || {};

    // damage multipliers from infinite upgrades
    const mAN = 1 + (il['auto-normal']     || 0) * C.INFINITE_UPGRADES['auto-normal'].bonusPerLevel;
    const mAB = 1 + (il['auto-bomb']       || 0) * C.INFINITE_UPGRADES['auto-bomb'].bonusPerLevel;
    const mCA = 1 + (il['click-arrow']     || 0) * C.INFINITE_UPGRADES['click-arrow'].bonusPerLevel;
    const mCL = 1 + (il['click-lightning'] || 0) * C.INFINITE_UPGRADES['click-lightning'].bonusPerLevel;
    const hpBonus = (il['castle'] || 0) * C.INFINITE_UPGRADES['castle'].bonusPerLevel;

    return {
      // auto normal — always active; buying upgrades it
      autoEnabled: true,
      autoProjectiles: an ? an.projectiles : 1,
      autoDamage: Math.round((an ? an.damage : 8) * mAN),
      autoCrit: an ? an.critChance : 0,
      autoRate: C.SKILLS['auto-normal'].fireRate,

      // auto bomb — requires purchase
      bombEnabled: !!ab,
      bombRadius: ab ? ab.radius : 0,
      bombDamage: Math.round((ab ? ab.damage : 0) * mAB),
      bombBurnDuration: ab ? ab.burnDuration : 0,
      bombBurnDps: Math.round((ab ? ab.burnDps : 0) * mAB),
      bombRate: C.SKILLS['auto-bomb'].fireRate,

      // click arrow — always active
      arrowEnabled: true,
      arrowCount: ca ? ca.arrows : 1,
      arrowDamage: Math.round((ca ? ca.damage : 35) * mCA),
      arrowPierce: ca ? ca.pierce : 0,

      // lightning — always active
      lightningEnabled: true,
      lightningClicksNeeded: cl ? cl.clicksNeeded : 8,
      lightningRadius: cl ? cl.radius : 70,
      lightningDamage: Math.round((cl ? cl.damage : 150) * mCL),

      // castle
      castleMaxHp: (cs ? cs.hp : C.BASE_CASTLE_HP) + hpBonus,
      castleDefense: cs ? cs.defense : 0,
    };
  },

  // ── Infinite upgrade helpers ──
  infiniteUpgradeCost(key, infiniteLevels) {
    return C.infiniteUpgradeCost(key, (infiniteLevels || {})[key] || 0);
  },

  canAffordInfinite(key, infiniteLevels, resources) {
    const cost = this.infiniteUpgradeCost(key, infiniteLevels);
    return resources.gold    >= cost.gold &&
           resources.crystal >= cost.crystal &&
           resources.soul    >= cost.soul;
  },

  buyInfinite(key, infiniteLevels, resources) {
    if (!this.canAffordInfinite(key, infiniteLevels, resources)) return false;
    const cost = this.infiniteUpgradeCost(key, infiniteLevels);
    resources.gold    -= cost.gold;
    resources.crystal -= cost.crystal;
    resources.soul    -= cost.soul;
    infiniteLevels[key] = (infiniteLevels[key] || 0) + 1;
    return true;
  }
};
