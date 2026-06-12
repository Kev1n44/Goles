(function () {
  const GRAVITY = 0.38;
  const JUGGLE_KICK = 11;
  const HORIZONTAL_DAMP = 0.98;
  const WALL_BOUNCE = 0.65;
  const HIT_COOLDOWN_MS = 120;

  const juggleView = document.getElementById('juggleView');
  const juggleArena = document.getElementById('juggleArena');
  const juggleBall = document.getElementById('juggleBall');
  const juggleScoreEl = document.getElementById('juggleScore');
  const juggleTimerEl = document.getElementById('juggleTimer');
  const backFromJuggleBtn = document.getElementById('backFromJuggleBtn');
  const restartJuggleBtn = document.getElementById('restartJuggleBtn');

  let roundActive = false;
  let showingResult = false;
  let animId = null;
  let bounceCount = 0;
  let ballX = 0;
  let ballY = 0;
  let ballVX = 0;
  let ballVY = 0;
  let floorY = 0;
  let lastHitTime = 0;

  function getArenaRect() {
    return juggleArena.getBoundingClientRect();
  }

  function getBallSize() {
    const rect = juggleBall.getBoundingClientRect();
    return rect.width || 64;
  }

  function getPlayBounds() {
    const arena = getArenaRect();
    const size = getBallSize();
    const padding = 12;
    return {
      left: padding,
      right: arena.width - size - padding,
      top: padding + arena.height * 0.08,
      floor: arena.height - size - padding,
      width: arena.width,
      height: arena.height,
    };
  }

  function applyBallPosition() {
    juggleBall.style.left = `${ballX}px`;
    juggleBall.style.top = `${ballY}px`;
  }

  function resetBall() {
    const bounds = getPlayBounds();
    const size = getBallSize();
    ballX = bounds.width / 2 - size / 2;
    ballY = bounds.top + bounds.height * 0.25;
    ballVX = 0;
    ballVY = 0;
    floorY = bounds.floor;
    applyBallPosition();
  }

  function updateScore() {
    juggleScoreEl.textContent = String(bounceCount);
  }

  function isPointerOnBall(pointerX, pointerY) {
    const size = getBallSize();
    const cx = ballX + size / 2;
    const cy = ballY + size / 2;
    const radius = size * 0.46;
    const dx = pointerX - cx;
    const dy = pointerY - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  function tryJuggleHit(pointerX, pointerY) {
    if (!isPointerOnBall(pointerX, pointerY)) return false;

    const now = performance.now();
    if (now - lastHitTime < HIT_COOLDOWN_MS) return false;

    const size = getBallSize();
    const cx = ballX + size / 2;
    const cy = ballY + size / 2;
    const dx = pointerX - cx;
    const dy = pointerY - cy;
    const normX = dx / (size / 2);
    const normY = dy / (size / 2);

    ballVX = normX * 7.5;
    ballVY = -JUGGLE_KICK - normY * 2.5;
    ballVX = Math.max(-8, Math.min(8, ballVX));
    ballVY = Math.max(-14, Math.min(-6, ballVY));

    bounceCount += 1;
    updateScore();
    lastHitTime = now;
    juggleBall.classList.add('is-hit');
    setTimeout(() => juggleBall.classList.remove('is-hit'), 120);
    return true;
  }

  function onPointerDown(event) {
    if (!roundActive) return;

    const arena = getArenaRect();
    const x = event.clientX - arena.left;
    const y = event.clientY - arena.top;

    if (!isPointerOnBall(x, y)) return;

    event.preventDefault();
    event.stopPropagation();
    tryJuggleHit(x, y);
  }

  function animateBall() {
    if (!roundActive) return;

    ballVY += GRAVITY;
    ballVX *= HORIZONTAL_DAMP;
    ballX += ballVX;
    ballY += ballVY;

    const bounds = getPlayBounds();
    floorY = bounds.floor;

    if (ballX < bounds.left) {
      ballX = bounds.left;
      ballVX = Math.abs(ballVX) * WALL_BOUNCE;
    } else if (ballX > bounds.right) {
      ballX = bounds.right;
      ballVX = -Math.abs(ballVX) * WALL_BOUNCE;
    }

    if (ballY < bounds.top) {
      ballY = bounds.top;
      ballVY = Math.abs(ballVY) * 0.4;
    }

    applyBallPosition();

    if (ballY >= floorY) {
      endRound(false);
      return;
    }

    animId = requestAnimationFrame(animateBall);
  }

  function stopAnimation() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function endRound(timeUp) {
    if (showingResult) return;
    showingResult = true;
    roundActive = false;
    stopAnimation();
    window.GamesShared.stopTimer();

    const finalBounces = bounceCount;
    const title = timeUp ? 'Tiempo' : 'Balón caído';
    const sub =
      finalBounces === 1
        ? '1 bote en el aire'
        : `${finalBounces} botes en el aire`;

    window.GamesShared.showResult(title, finalBounces, sub, () => {
      showingResult = false;
      startRound();
    });
  }

  function startRound() {
    bounceCount = 0;
    updateScore();
    roundActive = true;
    lastHitTime = 0;
    requestAnimationFrame(() => {
      resetBall();
      stopAnimation();
      animId = requestAnimationFrame(animateBall);
    });
    window.GamesShared.startTimer(juggleTimerEl, () => endRound(true));
  }

  function restartRound() {
    if (showingResult) return;
    roundActive = false;
    stopAnimation();
    window.GamesShared.stopTimer();
    startRound();
  }

  function start() {
    juggleView.hidden = false;
    window.GamesShared.showInstructions(
      '30 y una',
      [
        'Tienes <strong>1 minuto</strong> para mantener el balón en el aire.',
        'Toca el balón directamente; tocar fuera de él no cuenta.',
        'El lugar donde toques el balón cambia su dirección.',
        'Cada toque válido suma <strong>1 bote</strong>.',
        'Si el balón cae o se acaba el tiempo, verás tu total de botes.',
      ],
      startRound
    );
  }

  function stop() {
    roundActive = false;
    showingResult = false;
    stopAnimation();
    window.GamesShared.stopTimer();
    window.GamesShared.hideInstructions();
    juggleView.hidden = true;
  }

  function onResize() {
    if (!roundActive) return;
    resetBall();
  }

  backFromJuggleBtn.addEventListener('click', () => {
    stop();
    window.GamesShared.returnToMenu();
  });

  restartJuggleBtn.addEventListener('click', restartRound);
  juggleBall.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onResize);

  window.JuggleGame = { start, stop };
})();
