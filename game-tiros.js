(function () {
  const tirosLocosView = document.getElementById('tirosLocosView');
  const backToRankingBtn = document.getElementById('backToRankingBtn');
  const restartTirosBtn = document.getElementById('restartTirosBtn');
  const gameArena = document.getElementById('gameArena');
  const fieldPlayArea = document.getElementById('fieldPlayArea');
  const fieldBg = document.getElementById('fieldBg');
  const goalMover = document.getElementById('goalMover');
  const goalTarget = document.getElementById('goalTarget');
  const playerBall = document.getElementById('playerBall');
  const aimLine = document.getElementById('aimLine');
  const gameScoreEl = document.getElementById('gameScore');
  const tirosTimerEl = document.getElementById('tirosTimer');

  const GOAL_MIN_SPEED = 3.5;
  const GOAL_MAX_SPEED = 6.6;
  const GOAL_BURST_MULTIPLIER = 2.1;
  const GOAL_PADDING = 6;
  const SHOT_POWER = 0.22;
  const MIN_SHOT_SPEED = 4;
  const MAX_SHOT_SPEED = 28;

  let gameScore = 0;
  let goalAnimId = null;
  let ballAnimId = null;
  let roundActive = false;
  let showingResult = false;

  let goalX = 0;
  let goalY = 0;
  let goalVX = 0;
  let goalVY = 0;
  let nextDirectionChange = 0;

  let ballState = 'idle';
  let ballX = 0;
  let ballY = 0;
  let ballVX = 0;
  let ballVY = 0;

  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragCurrentY = 0;
  let activePointerId = null;

  let feedbackEl = null;

  function getBallSize() {
    const rect = playerBall.getBoundingClientRect();
    return rect.width || 64;
  }

  function getGoalSize() {
    const rect = goalTarget.getBoundingClientRect();
    return { w: rect.width || 48, h: rect.height || 36 };
  }

  function getFieldMetrics() {
    const arena = getArenaRect();
    const containerRect = fieldPlayArea.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;
    const naturalW = fieldBg.naturalWidth || 800;
    const naturalH = fieldBg.naturalHeight || 500;
    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    const renderedW = naturalW * scale;
    const renderedH = naturalH * scale;
    const offsetX = (containerW - renderedW) / 2;
    const offsetY = (containerH - renderedH) / 2;
    const containerLeft = containerRect.left - arena.left;
    const containerTop = containerRect.top - arena.top;
    const inset = GOAL_PADDING;

    return {
      left: containerLeft + offsetX + inset,
      top: containerTop + offsetY + inset,
      width: renderedW - inset * 2,
      height: renderedH - inset * 2,
      localLeft: offsetX + inset,
      localTop: offsetY + inset,
    };
  }

  function getArenaRect() {
    return gameArena.getBoundingClientRect();
  }

  function applyGoalPosition() {
    goalMover.style.transform = `translate3d(${Math.round(goalX)}px, ${Math.round(goalY)}px, 0)`;
  }

  function randomGoalVelocity() {
    const angle = Math.random() * Math.PI * 2;
    const speed = GOAL_MIN_SPEED + Math.random() * (GOAL_MAX_SPEED - GOAL_MIN_SPEED);
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function scheduleDirectionChange() {
    nextDirectionChange = performance.now() + 90 + Math.random() * 260;
  }

  function applyRandomGoalVelocity(options = {}) {
    const { burst = Math.random() < 0.38 } = options;
    const vel = randomGoalVelocity();
    goalVX = burst ? vel.vx * GOAL_BURST_MULTIPLIER : vel.vx;
    goalVY = burst ? vel.vy * GOAL_BURST_MULTIPLIER : vel.vy;
    scheduleDirectionChange();
  }

  function clampGoalSpeed() {
    const speed = Math.hypot(goalVX, goalVY);
    const maxSpeed = GOAL_MAX_SPEED * GOAL_BURST_MULTIPLIER;
    if (speed > maxSpeed) {
      goalVX = (goalVX / speed) * maxSpeed;
      goalVY = (goalVY / speed) * maxSpeed;
    } else if (speed < GOAL_MIN_SPEED * 0.6) {
      applyRandomGoalVelocity();
    }
  }

  function pickRandomGoalPosition() {
    const field = getFieldMetrics();
    const size = getGoalSize();
    const minX = field.localLeft;
    const maxX = field.localLeft + field.width - size.w;
    const minY = field.localTop;
    const maxY = field.localTop + field.height - size.h;
    return {
      x: minX + Math.random() * Math.max(maxX - minX, 0),
      y: minY + Math.random() * Math.max(maxY - minY, 0),
    };
  }

  function placeGoalRandomly() {
    const pos = pickRandomGoalPosition();
    goalX = pos.x;
    goalY = pos.y;
    applyGoalPosition();
    applyRandomGoalVelocity({ burst: false });
  }

  function nudgeGoalOnBounce() {
    goalVX += (Math.random() - 0.5) * 2;
    goalVY += (Math.random() - 0.5) * 2;
    clampGoalSpeed();
    if (Math.random() < 0.58) {
      applyRandomGoalVelocity({ burst: Math.random() < 0.48 });
    } else {
      scheduleDirectionChange();
    }
  }

  function resetBallPosition() {
    const arena = getArenaRect();
    const containerRect = fieldPlayArea.getBoundingClientRect();
    const size = getBallSize();
    const ballZoneTop = containerRect.bottom - arena.top;
    const ballZoneHeight = arena.height - ballZoneTop;
    ballX = arena.width / 2 - size / 2;
    ballY = ballZoneTop + (ballZoneHeight - size) / 2;
    applyBallPosition();
  }

  function applyBallPosition() {
    playerBall.style.left = `${ballX}px`;
    playerBall.style.top = `${ballY}px`;
  }

  function setBallState(state) {
    ballState = state;
    playerBall.classList.toggle('is-dragging', state === 'dragging');
    playerBall.classList.toggle('is-flying', state === 'flying');
    playerBall.classList.toggle('is-hidden', state === 'hidden');
  }

  function showFeedback(text) {
    if (!feedbackEl) {
      feedbackEl = document.createElement('div');
      feedbackEl.className = 'game-feedback';
      document.body.appendChild(feedbackEl);
    }
    feedbackEl.textContent = text;
    feedbackEl.classList.add('is-visible');
    setTimeout(() => feedbackEl.classList.remove('is-visible'), 700);
  }

  function updateScore() {
    gameScoreEl.textContent = String(gameScore);
  }

  function animateGoal(timestamp) {
    if (!roundActive) return;

    if (timestamp >= nextDirectionChange) {
      applyRandomGoalVelocity({ burst: Math.random() < 0.42 });
    }

    if (Math.random() < 0.2) {
      goalVX += (Math.random() - 0.5) * 1.7;
      goalVY += (Math.random() - 0.5) * 1.7;
      clampGoalSpeed();
    }

    if (Math.random() < 0.06) {
      if (Math.random() < 0.5) goalVX *= -(1.1 + Math.random() * 0.5);
      else goalVY *= -(1.1 + Math.random() * 0.5);
      clampGoalSpeed();
      scheduleDirectionChange();
    }

    goalX += goalVX;
    goalY += goalVY;

    const field = getFieldMetrics();
    const size = getGoalSize();
    const minX = field.localLeft;
    const maxX = field.localLeft + field.width - size.w;
    const minY = field.localTop;
    const maxY = field.localTop + field.height - size.h;
    let bounced = false;

    if (goalX <= minX) {
      goalX = minX;
      goalVX = Math.abs(goalVX);
      bounced = true;
    } else if (goalX >= maxX) {
      goalX = maxX;
      goalVX = -Math.abs(goalVX);
      bounced = true;
    }

    if (goalY <= minY) {
      goalY = minY;
      goalVY = Math.abs(goalVY);
      bounced = true;
    } else if (goalY >= maxY) {
      goalY = maxY;
      goalVY = -Math.abs(goalVY);
      bounced = true;
    }

    if (bounced) nudgeGoalOnBounce();

    applyGoalPosition();
    goalAnimId = requestAnimationFrame(animateGoal);
  }

  function drawAimLine() {
    const ctx = aimLine.getContext('2d');
    const arena = getArenaRect();
    aimLine.width = arena.width;
    aimLine.height = arena.height;
    ctx.clearRect(0, 0, arena.width, arena.height);
    if (ballState !== 'dragging') return;

    const size = getBallSize();
    const ballCenterX = ballX + size / 2;
    const ballCenterY = ballY + size / 2;
    const dx = dragStartX - dragCurrentX;
    const dy = dragStartY - dragCurrentY;

    ctx.beginPath();
    ctx.moveTo(ballCenterX, ballCenterY);
    ctx.lineTo(ballCenterX + dx, ballCenterY + dy);
    ctx.strokeStyle = 'rgba(245, 197, 24, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function rectsOverlap(a, b) {
    return !(a.left > b.right || a.right < b.left || a.top > b.bottom || a.bottom < b.top);
  }

  function getGoalHitRect() {
    const rect = goalTarget.getBoundingClientRect();
    const marginX = rect.width * 0.1;
    const marginTop = rect.height * 0.12;
    const marginBottom = rect.height * 0.28;
    return {
      left: rect.left + marginX,
      right: rect.right - marginX,
      top: rect.top + marginTop,
      bottom: rect.bottom - marginBottom,
    };
  }

  function checkGoalCollision() {
    return rectsOverlap(playerBall.getBoundingClientRect(), getGoalHitRect());
  }

  function isBallOutOfBounds() {
    const arena = getArenaRect();
    const size = getBallSize();
    return (
      ballX + size < -size ||
      ballX > arena.width + size ||
      ballY + size < -size ||
      ballY > arena.height + size
    );
  }

  function stopBallAnimation() {
    if (ballAnimId) {
      cancelAnimationFrame(ballAnimId);
      ballAnimId = null;
    }
  }

  function respawnBall(delay = 400) {
    if (!roundActive) return;
    setBallState('hidden');
    stopBallAnimation();
    setTimeout(() => {
      if (!roundActive) return;
      resetBallPosition();
      setBallState('idle');
    }, delay);
  }

  function onShotComplete(scored) {
    if (!roundActive) return;
    if (scored) {
      gameScore += 1;
      updateScore();
      playerBall.classList.add('is-goal');
      goalTarget.classList.add('is-hit');
      showFeedback('¡GOL!');
      setTimeout(() => {
        playerBall.classList.remove('is-goal');
        goalTarget.classList.remove('is-hit');
      }, 500);
      applyRandomGoalVelocity({ burst: true });
      respawnBall(600);
    } else {
      respawnBall(350);
    }
  }

  function animateBall() {
    if (!roundActive) return;
    ballX += ballVX;
    ballY += ballVY;
    applyBallPosition();

    if (checkGoalCollision()) {
      setBallState('flying');
      stopBallAnimation();
      onShotComplete(true);
      return;
    }

    if (isBallOutOfBounds()) {
      stopBallAnimation();
      onShotComplete(false);
      return;
    }

    ballAnimId = requestAnimationFrame(animateBall);
  }

  function shootBall() {
    const dx = dragStartX - dragCurrentX;
    const dy = dragStartY - dragCurrentY;
    const speed = Math.min(Math.hypot(dx, dy) * SHOT_POWER, MAX_SHOT_SPEED);
    if (speed < MIN_SHOT_SPEED) {
      setBallState('idle');
      drawAimLine();
      return;
    }
    const angle = Math.atan2(dy, dx);
    ballVX = Math.cos(angle) * speed;
    ballVY = Math.sin(angle) * speed;
    setBallState('flying');
    drawAimLine();
    stopBallAnimation();
    ballAnimId = requestAnimationFrame(animateBall);
  }

  function getPointerCoords(event) {
    const arena = getArenaRect();
    return { x: event.clientX - arena.left, y: event.clientY - arena.top };
  }

  function isPointerOnBall(event) {
    const coords = getPointerCoords(event);
    const size = getBallSize();
    return coords.x >= ballX && coords.x <= ballX + size && coords.y >= ballY && coords.y <= ballY + size;
  }

  function onPointerDown(event) {
    if (!roundActive || ballState !== 'idle') return;
    if (!isPointerOnBall(event)) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    playerBall.setPointerCapture(event.pointerId);
    const coords = getPointerCoords(event);
    dragStartX = coords.x;
    dragStartY = coords.y;
    dragCurrentX = coords.x;
    dragCurrentY = coords.y;
    setBallState('dragging');
    drawAimLine();
  }

  function onPointerMove(event) {
    if (ballState !== 'dragging' || event.pointerId !== activePointerId) return;
    event.preventDefault();
    const coords = getPointerCoords(event);
    dragCurrentX = coords.x;
    dragCurrentY = coords.y;
    drawAimLine();
  }

  function onPointerUp(event) {
    if (ballState !== 'dragging' || event.pointerId !== activePointerId) return;
    event.preventDefault();
    activePointerId = null;
    shootBall();
  }

  function stopGoalAnimation() {
    if (goalAnimId) {
      cancelAnimationFrame(goalAnimId);
      goalAnimId = null;
    }
  }

  function setupArena() {
    placeGoalRandomly();
    resetBallPosition();
    setBallState('idle');
    drawAimLine();
    stopGoalAnimation();
    goalAnimId = requestAnimationFrame(animateGoal);
  }

  function endRound() {
    if (showingResult) return;
    showingResult = true;
    roundActive = false;
    stopBallAnimation();
    stopGoalAnimation();
    window.GamesShared.stopTimer();

    const finalScore = gameScore;
    window.GamesShared.showResult(
      'Goles en 1 minuto',
      finalScore,
      finalScore === 1 ? '1 gol marcado' : `${finalScore} goles marcados`,
      () => {
        showingResult = false;
        startRound();
      }
    );
  }

  function restartRound() {
    if (showingResult) return;
    roundActive = false;
    stopBallAnimation();
    stopGoalAnimation();
    activePointerId = null;
    window.GamesShared.stopTimer();
    startRound();
  }

  function startRound() {
    gameScore = 0;
    updateScore();
    roundActive = true;
    requestAnimationFrame(setupArena);
    window.GamesShared.startTimer(tirosTimerEl, endRound);
  }

  function start() {
    window.GamesShared.resetScroll();
    tirosLocosView.hidden = false;
    window.GamesShared.showInstructions(
      'Tiros locos',
      [
        'Tienes <strong>1 minuto</strong> para marcar la mayor cantidad de goles.',
        'La portería se mueve por la cancha de forma impredecible.',
        'Arrastra el balón desde abajo y suéltalo para disparar.',
        'Si aciertas la portería, sumas <strong>1 gol</strong>.',
        'Al terminar el tiempo verás tu resultado y podrás jugar de nuevo.',
      ],
      startRound
    );
  }

  function stop() {
    roundActive = false;
    showingResult = false;
    stopBallAnimation();
    stopGoalAnimation();
    window.GamesShared.stopTimer();
    window.GamesShared.hideInstructions();
    activePointerId = null;
    setBallState('idle');
    drawAimLine();
    tirosLocosView.hidden = true;
  }

  function onResize() {
    if (!roundActive) return;
    placeGoalRandomly();
    if (ballState === 'idle') resetBallPosition();
    drawAimLine();
  }

  backToRankingBtn.addEventListener('click', () => {
    stop();
    window.GamesShared.returnToMenu();
  });

  restartTirosBtn.addEventListener('click', restartRound);

  gameArena.addEventListener('pointerdown', onPointerDown);
  gameArena.addEventListener('pointermove', onPointerMove);
  gameArena.addEventListener('pointerup', onPointerUp);
  gameArena.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', onResize);

  window.TirosLocos = { start, stop };
})();
