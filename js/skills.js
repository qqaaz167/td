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

  // Derived combat stats from current skill levels
  getCombatStats(skillLevels) {
    const an = this.getStats('auto-normal', skillLevels);
    const ab = this.getStats('auto-bomb', skillLevels);
    const ca = this.getStats('click-arrow', skillLevels);
    const cl = this.getStats('click-lightning', skillLevels);
    const cs = this.getStats('castle', skillLevels);

    return {
      // auto normal — always active with base stats; buying upgrades it
      autoEnabled: true,
      autoProjectiles: an ? an.projectiles : 1,
      autoDamage: an ? an.damage : 8,
      autoCrit: an ? an.critChance : 0,
      autoRate: C.SKILLS['auto-normal'].fireRate,

      // auto bomb — still requires purchase
      bombEnabled: !!ab,
      bombRadius: ab ? ab.radius : 0,
      bombDamage: ab ? ab.damage : 0,
      bombBurnDuration: ab ? ab.burnDuration : 0,
      bombBurnDps: ab ? ab.burnDps : 0,
      bombRate: C.SKILLS['auto-bomb'].fireRate,

      // click arrow — always active with base stats; buying upgrades it
      arrowEnabled: true,
      arrowCount: ca ? ca.arrows : 1,
      arrowDamage: ca ? ca.damage : 35,
      arrowPierce: ca ? ca.pierce : 0,

      // click lightning
      // lightning — always active with base stats; buying upgrades it
      lightningEnabled: true,
      lightningClicksNeeded: cl ? cl.clicksNeeded : 8,
      lightningRadius: cl ? cl.radius : 70,
      lightningDamage: cl ? cl.damage : 150,

      // castle
      castleMaxHp: cs ? cs.hp : C.BASE_CASTLE_HP,
      castleDefense: cs ? cs.defense : 0,
    };
  }
};
