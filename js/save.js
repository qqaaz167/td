'use strict';

const SAVE_KEY = 'castleDefender_v1';

const Save = {
  defaultState() {
    return {
      currentLevel: 1,
      resources: { gold: 0, crystal: 0, soul: 0 },
      // skillLevels: 0 = not bought, 1..5 = current level index (1-based)
      skillLevels: {
        'auto-normal':      0,
        'auto-bomb':        0,
        'click-arrow':      0,
        'click-lightning':  0,
        'castle':           0,
      }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return this.defaultState();
      return Object.assign(this.defaultState(), JSON.parse(raw));
    } catch {
      return this.defaultState();
    }
  },

  save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      currentLevel: state.currentLevel,
      resources: state.resources,
      skillLevels: state.skillLevels,
    }));
  },

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
};
