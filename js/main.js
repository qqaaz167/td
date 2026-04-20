'use strict';

let gameState = Save.load();

(function init() {
  UI.initSkillTabs();

  const canvas = document.getElementById('game-canvas');
  Combat.init(
    canvas,
    gameState,
    onRoundEnd,
    msg => { document.getElementById('combat-log').textContent = msg; }
  );

  document.getElementById('btn-start').addEventListener('click', startCombat);

  document.getElementById('btn-upgrade-title').addEventListener('click', () => {
    openUpgrade();
    UI.showScreen('screen-upgrade');
  });

  document.getElementById('btn-next-level').addEventListener('click', advanceAndPlay);

  UI.updateTitleResources(gameState.resources);
  UI.showScreen('screen-title');
})();

function startCombat() {
  Combat.startRound();
  UI.showScreen('screen-combat');
  Combat.startLoop();
}

function onRoundEnd(data) {
  Save.save(gameState);
  UI.showResult(data, () => {
    openUpgrade();
    UI.showScreen('screen-upgrade');
  });
}

function openUpgrade() {
  UI.renderUpgradeScreen(
    gameState.skillLevels,
    gameState.resources,
    key => {
      if (Skills.buy(key, gameState.skillLevels, gameState.resources)) {
        Save.save(gameState);
        openUpgrade();
      }
    },
    gameState.currentLevel
  );
}

function advanceAndPlay() {
  if (gameState.currentLevel < C.LEVELS.length) {
    gameState.currentLevel++;
  }
  Save.save(gameState);
  startCombat();
}
