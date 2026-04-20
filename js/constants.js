'use strict';

const C = {
  CANVAS_W: 900,
  CANVAS_H: 400,
  CASTLE_X: 60,
  CASTLE_Y: 160,
  CASTLE_W: 60,
  CASTLE_H: 80,
  PATH_Y: 280,          // monster path center Y
  ROUND_DURATION: 30,   // seconds per round

  // ── Skill tree definitions ──
  // Each skill has levels[] array of {projectiles, damage, critChance, cost{gold,crystal,soul}, ...}
  SKILLS: {
    'auto-normal': {
      label: '普通射擊',
      desc: '城堡自動發射箭矢',
      fireRate: 0.8, // seconds per shot
      levels: [
        { projectiles: 1, damage: 15, critChance: 0,    cost: { gold: 30,  crystal: 0,  soul: 0 } },
        { projectiles: 2, damage: 22, critChance: 0.05, cost: { gold: 60,  crystal: 0,  soul: 0 } },
        { projectiles: 2, damage: 32, critChance: 0.10, cost: { gold: 100, crystal: 5,  soul: 0 } },
        { projectiles: 3, damage: 45, critChance: 0.15, cost: { gold: 180, crystal: 10, soul: 0 } },
        { projectiles: 3, damage: 65, critChance: 0.25, cost: { gold: 300, crystal: 20, soul: 0 } },
      ]
    },
    'auto-bomb': {
      label: '炸彈',
      desc: '城堡自動投擲炸彈（需普通射擊 Lv2）',
      fireRate: 3.0,
      requiresKey: 'auto-normal',
      requiresLevel: 2,
      levels: [
        { radius: 60,  damage: 40,  burnDuration: 2, burnDps: 10, cost: { gold: 50,  crystal: 10, soul: 0 } },
        { radius: 80,  damage: 60,  burnDuration: 3, burnDps: 15, cost: { gold: 100, crystal: 20, soul: 0 } },
        { radius: 100, damage: 85,  burnDuration: 3, burnDps: 22, cost: { gold: 180, crystal: 35, soul: 0 } },
        { radius: 130, damage: 120, burnDuration: 4, burnDps: 30, cost: { gold: 280, crystal: 55, soul: 0 } },
        { radius: 160, damage: 170, burnDuration: 5, burnDps: 42, cost: { gold: 400, crystal: 80, soul: 0 } },
      ]
    },
    'click-arrow': {
      label: '點擊箭矢',
      desc: '點擊位置發射箭矢',
      levels: [
        { arrows: 2, damage: 65,  pierce: 0, cost: { gold: 40,  crystal: 0,  soul: 0 } },
        { arrows: 3, damage: 95,  pierce: 1, cost: { gold: 80,  crystal: 0,  soul: 0 } },
        { arrows: 4, damage: 130, pierce: 1, cost: { gold: 150, crystal: 8,  soul: 0 } },
        { arrows: 5, damage: 175, pierce: 2, cost: { gold: 250, crystal: 18, soul: 0 } },
        { arrows: 6, damage: 240, pierce: 3, cost: { gold: 400, crystal: 35, soul: 0 } },
      ]
    },
    'click-lightning': {
      label: '落雷',
      desc: '累積點擊次數後觸發閃電',
      levels: [
        { clicksNeeded: 8, radius: 80,  damage: 200, cost: { gold: 60,  crystal: 15,  soul: 0 } },
        { clicksNeeded: 7, radius: 100, damage: 300, cost: { gold: 120, crystal: 30,  soul: 0 } },
        { clicksNeeded: 6, radius: 120, damage: 450, cost: { gold: 220, crystal: 50,  soul: 0 } },
        { clicksNeeded: 5, radius: 150, damage: 650, cost: { gold: 350, crystal: 80,  soul: 0 } },
        { clicksNeeded: 4, radius: 180, damage: 950, cost: { gold: 500, crystal: 120, soul: 0 } },
      ]
    },
    'castle': {
      label: '主堡',
      desc: '提升城堡血量與防禦',
      levels: [
        { hp: 700,  defense: 0.05, cost: { gold: 0,  crystal: 0, soul: 20 } },
        { hp: 1000, defense: 0.12, cost: { gold: 0,  crystal: 0, soul: 40 } },
        { hp: 1400, defense: 0.20, cost: { gold: 0,  crystal: 0, soul: 70 } },
        { hp: 2000, defense: 0.30, cost: { gold: 0,  crystal: 0, soul: 110 } },
      ]
    }
  },

  // Base castle HP (before upgrades)
  BASE_CASTLE_HP: 500,

  // ── Level configs ──
  // spawnInterval: seconds between each monster spawn
  LEVELS: [
    { spawnInterval: 2.2, hpMult: 1.0,  atkMult: 1.0,  dist: { swarm: .90, tank: .10, ranged: .00 } },
    { spawnInterval: 2.0, hpMult: 1.2,  atkMult: 1.1,  dist: { swarm: .80, tank: .15, ranged: .05 } },
    { spawnInterval: 1.8, hpMult: 1.5,  atkMult: 1.2,  dist: { swarm: .70, tank: .20, ranged: .10 } },
    { spawnInterval: 1.6, hpMult: 1.9,  atkMult: 1.4,  dist: { swarm: .65, tank: .20, ranged: .15 } },
    { spawnInterval: 1.4, hpMult: 2.4,  atkMult: 1.6,  dist: { swarm: .55, tank: .25, ranged: .20 } },
    { spawnInterval: 1.2, hpMult: 3.0,  atkMult: 1.9,  dist: { swarm: .50, tank: .28, ranged: .22 } },
    { spawnInterval: 1.1, hpMult: 3.8,  atkMult: 2.2,  dist: { swarm: .45, tank: .30, ranged: .25 } },
    { spawnInterval: 1.0, hpMult: 4.8,  atkMult: 2.6,  dist: { swarm: .40, tank: .33, ranged: .27 } },
    { spawnInterval: 0.9, hpMult: 6.0,  atkMult: 3.1,  dist: { swarm: .35, tank: .35, ranged: .30 } },
    { spawnInterval: 0.8, hpMult: 7.5,  atkMult: 3.7,  dist: { swarm: .30, tank: .35, ranged: .35 } },
  ],

  // Base monster stats (before level multiplier)
  MONSTER_BASE: {
    swarm:  { hp: 40,   speed: 90, atk: 8,  atkRate: 1.5, reward: { gold: [1,2],  crystal: 0,   soul: 0    }, radius: 8,  color: '#e55', shape: 'circle' },
    tank:   { hp: 200,  speed: 45, atk: 20, atkRate: 2.0, reward: { gold: [5,8],  crystal: 0.04, soul: 0.05 }, radius: 14, color: '#a00', shape: 'rect'   },
    ranged: { hp: 100,  speed: 60, atk: 14, atkRate: 2.5, reward: { gold: [3,5],  crystal: 0.10, soul: 0.03 }, radius: 10, color: '#f90', shape: 'diamond'},
  },

  // Ranged monster attack range
  RANGED_ATTACK_RANGE: 260,
  RANGED_PROJ_SPEED: 150,

};
