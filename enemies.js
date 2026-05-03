const TYPE_COLORS = {
  truck: "#d2b48c",
  sedan: "#83a8ff",
  bike: "#ff7bd8",
  sport: "#ff8a65",
  police: "#7bc6ff",
  rival: "#ff2f2f",
};

export function spawnEnemy(state, stage) {
  const laneCount = state.laneCount;
  const lane = Math.floor(Math.random() * laneCount);
  const type = stage.enemyTypes[Math.floor(Math.random() * stage.enemyTypes.length)];
  const baseSpeed = stage.baseSpeed * (0.55 + Math.random() * 0.35);
  return {
    type,
    lane,
    y: -120 - Math.random() * 600,
    xOffset: 0,
    speed: baseSpeed,
    width: 28,
    height: 50,
    zigzagTimer: 0,
    laneTimer: 0,
    panic: 0,
  };
}

export function updateEnemies(state, dt, player) {
  const dtFactor = dt * 60;
  for (const enemy of state.enemies) {
    enemy.y += (state.scrollSpeed - enemy.speed) * dt;

    if (enemy.type === "bike") {
      enemy.zigzagTimer += dt;
      const dx = player.renderX - state.laneToX(enemy.lane);
      const target = Math.atan2(0.4, Math.max(20, Math.abs(dx)));
      enemy.xOffset += Math.sin(enemy.zigzagTimer * 8 + target) * 40 * dt;
      if (enemy.zigzagTimer > 0.8) {
        enemy.zigzagTimer = 0;
        enemy.lane = clamp(enemy.lane + (Math.random() > 0.5 ? 1 : -1), 0, state.laneCount - 1);
      }
    }

    if (enemy.type === "sedan") {
      enemy.laneTimer += dt;
      if (enemy.laneTimer > 1.6 && Math.random() < 0.3) {
        enemy.lane = clamp(enemy.lane + (Math.random() > 0.5 ? 1 : -1), 0, state.laneCount - 1);
        enemy.laneTimer = 0;
      }
    }

    if (enemy.type === "police") {
      const toward = player.targetLane > enemy.lane ? 1 : -1;
      if (Math.random() < 0.015 * dtFactor) {
        enemy.lane = clamp(enemy.lane + toward, 0, state.laneCount - 1);
      }
      enemy.speed = Math.min(enemy.speed + 80 * dt, state.scrollSpeed + 30);
    }

    if (enemy.type === "rival" && state.rivalXTarget !== null) {
      enemy.lane = clamp(Math.round(state.rivalXTarget), 0, state.laneCount - 1);
      enemy.speed = state.scrollSpeed * 0.98;
      enemy.y = Math.min(enemy.y, player.y - 80);
    }
  }

  state.enemies = state.enemies.filter((e) => e.y < state.height + 120);
}

export function drawEnemy(ctx, state, enemy) {
  const laneX = state.laneToX(enemy.lane) + enemy.xOffset;
  const color = TYPE_COLORS[enemy.type] || "#ffffff";
  ctx.save();
  ctx.translate(laneX, enemy.y);
  ctx.fillStyle = color;
  ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
  if (enemy.type === "police") {
    ctx.fillStyle = "#ff2f2f";
    ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width / 2, 5);
    ctx.fillStyle = "#2fa8ff";
    ctx.fillRect(0, -enemy.height / 2, enemy.width / 2, 5);
  }
  if (enemy.type === "rival") {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
  }
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
