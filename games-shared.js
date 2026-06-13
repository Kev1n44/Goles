(function () {
  const GAME_DURATION_MS = 60000;
  const RESULT_DISPLAY_MS = 3200;

  const rankingView = document.getElementById('rankingView');
  const gameMenuView = document.getElementById('gameMenuView');
  const openGameBtn = document.getElementById('openGameBtn');
  const backFromMenuBtn = document.getElementById('backFromMenuBtn');
  const playTirosLocosBtn = document.getElementById('playTirosLocosBtn');
  const playTreintaYUnaBtn = document.getElementById('playTreintaYUnaBtn');
  const resultOverlay = document.getElementById('gameResultOverlay');
  const resultTitle = document.getElementById('gameResultTitle');
  const resultValue = document.getElementById('gameResultValue');
  const resultSub = document.getElementById('gameResultSub');
  const instructionsOverlay = document.getElementById('gameInstructionsOverlay');
  const instructionsTitle = document.getElementById('instructionsTitle');
  const instructionsList = document.getElementById('instructionsList');
  const startGameBtn = document.getElementById('startGameBtn');

  let timerInterval = null;
  let resultTimeout = null;
  let instructionsOnStart = null;

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startTimer(displayEl, onEnd) {
    stopTimer();
    const endAt = Date.now() + GAME_DURATION_MS;
    displayEl.textContent = formatTime(GAME_DURATION_MS);

    timerInterval = setInterval(() => {
      const remaining = endAt - Date.now();
      displayEl.textContent = formatTime(remaining);

      if (remaining <= 0) {
        stopTimer();
        onEnd();
      }
    }, 100);
  }

  function resetScroll() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    gameMenuView.scrollTop = 0;
  }

  function showMenu() {
    resetScroll();
    rankingView.hidden = true;
    gameMenuView.hidden = false;

    if (window.RankingApp?.pauseAutoRefresh) {
      window.RankingApp.pauseAutoRefresh();
    }
  }

  function hideMenu() {
    gameMenuView.hidden = true;
  }

  function showRanking() {
    hideInstructions();
    window.TirosLocos?.stop();
    window.JuggleGame?.stop();
    hideMenu();
    rankingView.hidden = false;
    resetScroll();

    if (window.RankingApp?.resumeAutoRefresh) {
      window.RankingApp.resumeAutoRefresh();
    }
  }

  function returnToMenu() {
    hideInstructions();
    window.TirosLocos?.stop();
    window.JuggleGame?.stop();
    rankingView.hidden = true;
    gameMenuView.hidden = false;
    resetScroll();
  }

  function hideInstructions() {
    instructionsOverlay.hidden = true;
    instructionsOnStart = null;
  }

  function showInstructions(title, steps, onStart) {
    hideInstructions();
    instructionsTitle.textContent = title;
    instructionsList.innerHTML = steps.map((step) => `<li>${step}</li>`).join('');
    instructionsOnStart = onStart;
    instructionsOverlay.hidden = false;
  }

  function handleStartGame() {
    const callback = instructionsOnStart;
    hideInstructions();
    callback?.();
  }

  startGameBtn.addEventListener('click', handleStartGame);

  function showResult(title, value, subtitle, onDone) {
    if (resultTimeout) clearTimeout(resultTimeout);

    resultTitle.textContent = title;
    resultValue.textContent = String(value);
    resultSub.textContent = subtitle || 'Preparando nueva ronda...';
    resultOverlay.hidden = false;

    resultTimeout = setTimeout(() => {
      resultOverlay.hidden = true;
      resultTimeout = null;
      onDone?.();
    }, RESULT_DISPLAY_MS);
  }

  openGameBtn.addEventListener('click', showMenu);
  backFromMenuBtn.addEventListener('click', showRanking);

  playTirosLocosBtn.addEventListener('click', () => {
    resetScroll();
    hideMenu();
    window.TirosLocos.start();
  });

  playTreintaYUnaBtn.addEventListener('click', () => {
    resetScroll();
    hideMenu();
    window.JuggleGame.start();
  });

  window.GamesShared = {
    GAME_DURATION_MS,
    startTimer,
    stopTimer,
    showResult,
    showInstructions,
    hideInstructions,
    showRanking,
    hideMenu,
    returnToMenu,
    resetScroll,
  };
})();
