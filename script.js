import { STAGES, getLaneCount, getCourseTile } from "./stages.js";
import { spawnEnemy, updateEnemies, drawEnemy } from "./enemies.js";
import { AudioManager } from "./audio.js";
import { loadBestTimes, saveBestTime } from "./storage.js";

class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.left = false;
    this.right = false;
    this.accel = false;
    this.brake = false;
    this.boost = false;
    this.pointerId = null;
    this.pointerStartX = 0;
    this.swipeThreshold = 28;
    this.steerCooldown = 0;
  }

  bind() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") this.left = true;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") this.right = true;
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") this.accel = true;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") this.brake = true;
      if (e.key === " " || e.key.toLowerCase() === "x") this.boost = true;
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft"  || e.key.toLowerCase() === "a") this.left  = false;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") this.right = false;
      if (e.key === "ArrowUp"    || e.key.toLowerCase() === "w") this.accel = false;
      if (e.key === "ArrowDown"  || e.key.toLowerCase() === "s") this.brake = false;
      if (e.key === " "          || e.key.toLowerCase() === "x") this.boost = false;
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointerId = e.pointerId;
      this.pointerStartX = e.clientX;
      this.accel = true;
      this.swipeThreshold = clamp(this.canvas.clientWidth * 0.045, 20, 34);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.pointerId) return;
      const diff = e.clientX - this.pointerStartX;
      if (diff > this.swipeThreshold) {
        this.right = true;
        this.pointerStartX = e.clientX;
      } else if (diff < -this.swipeThreshold) {
        this.left = true;
        this.pointerStartX = e.clientX;
      }
    });
    const releasePointer = () => {
      this.accel = false;
      this.pointerId = null;
    };
    this.canvas.addEventListener("pointerup", releasePointer);
    this.canvas.addEventListener("pointercancel", releasePointer);
    this.canvas.addEventListener("pointerleave", releasePointer);

    this.bindHoldButton("padLeft", () => (this.left = true), () => (this.left = false));
    this.bindHoldButton("padRight", () => (this.right = true), () => (this.right = false));
    this.bindHoldButton("btnAccel", () => (this.accel = true), () => (this.accel = false));
    this.bindHoldButton("btnBrake", () => (this.brake = true), () => (this.brake = false));
  }

  consumeLaneMove(player, laneCount, dt) {
    this.steerCooldown = Math.max(0, this.steerCooldown - dt);
    if (this.steerCooldown <= 0) {
      if (this.left && !this.right) {
        player.targetLane -= 1;
        this.steerCooldown = 0.11;
        this.left = false;  // 消費して次の入力まで待つ（スワイプ対策）
      } else if (this.right && !this.left) {
        player.targetLane += 1;
        this.steerCooldown = 0.11;
        this.right = false; // 消費して次の入力まで待つ（スワイプ対策）
      }
    }
    player.targetLane = clamp(player.targetLane, 0, laneCount - 1);
  }

  bindHoldButton(id, onPress, onRelease) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press = (e) => {
      e.preventDefault();
      onPress();
    };
    const release = (e) => {
      e.preventDefault();
      onRelease();
    };
    btn.addEventListener("pointerdown", press, { passive: false });
    btn.addEventListener("pointerup", release, { passive: false });
    btn.addEventListener("pointercancel", release, { passive: false });
    btn.addEventListener("pointerleave", release, { passive: false });
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
  }
}

class PlayerCar {
  constructor() {
    this.lane = 1;
    this.targetLane = 1;
    this.renderX = 0;
    this.y = 0;
    this.width = 30;
    this.height = 56;
    this.heading = 0;
    this.lastX = 0;
    this.exhaust = { x: 0, y: 0 };
  }

  syncLaneBounds(laneCount) {
    this.lane = clamp(this.lane, 0, laneCount - 1);
    this.targetLane = clamp(this.targetLane, 0, laneCount - 1);
  }

  updatePosition(laneToX, laneLerp, dt) {
    const targetX = laneToX(this.targetLane);
    this.lastX = this.renderX;
    this.renderX += (targetX - this.renderX) * laneLerp * dt * 60;
    const dx = this.renderX - this.lastX;
    this.heading = clamp(dx * 0.04, -0.28, 0.28);
    this.lane = this.targetLane;
  }

  draw(ctx, speedRatio) {
    ctx.save();
    ctx.translate(this.renderX, this.y);
    ctx.rotate(this.heading);

    const w = this.width;
    const h = this.height;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.44, w * 0.6, 8 + speedRatio * 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    bodyGrad.addColorStop(0, "#64ffe6");
    bodyGrad.addColorStop(0.55, "#2fe0b0");
    bodyGrad.addColorStop(1, "#0f7e66");
    ctx.fillStyle = bodyGrad;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();

    const canopyGrad = ctx.createLinearGradient(0, -h * 0.36, 0, h * 0.1);
    canopyGrad.addColorStop(0, "#effbff");
    canopyGrad.addColorStop(1, "#4d9ccd");
    ctx.fillStyle = canopyGrad;
    roundedRect(ctx, -w * 0.24, -h * 0.25, w * 0.48, h * 0.42, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(7, 25, 28, 0.75)";
    ctx.fillRect(-w * 0.42, -h * 0.18, 3, h * 0.5);
    ctx.fillRect(w * 0.42 - 3, -h * 0.18, 3, h * 0.5);

    ctx.strokeStyle = `rgba(126, 244, 255, ${0.45 + speedRatio * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.36);
    ctx.lineTo(0, -h * 0.46);
    ctx.lineTo(w * 0.18, -h * 0.36);
    ctx.stroke();

    ctx.fillStyle = "#101319";
    ctx.fillRect(-w * 0.58, -h * 0.3, 6, 14);
    ctx.fillRect(w * 0.58 - 6, -h * 0.3, 6, 14);
    ctx.fillRect(-w * 0.58, h * 0.1, 6, 14);
    ctx.fillRect(w * 0.58 - 6, h * 0.1, 6, 14);

    ctx.fillStyle = `rgba(123, 217, 255, ${0.35 + speedRatio * 0.35})`;
    roundedRect(ctx, -w * 0.18, h * 0.26, w * 0.36, 8, 3);
    ctx.fill();

    this.exhaust.x = 0;
    this.exhaust.y = h * 0.52;

    ctx.restore();
  }
}

class HUDView {
  constructor(nodes) {
    this.nodes = nodes;
  }

  setStageName(name) {
    this.nodes.hudStage.textContent = name;
  }

  setMessage(msg) {
    this.nodes.messageBox.textContent = msg;
  }

  setBest(bestMs) {
    this.nodes.hudBest.textContent = bestMs ? `${(bestMs / 1000).toFixed(2)}s` : "--";
  }

  updateRaceStatus(lap, maxLap, speed, elapsedMs) {
    this.nodes.hudLap.textContent = `${lap}/${maxLap}`;
    this.nodes.hudSpeed.textContent = `${Math.round(speed)} km/h`;
    this.nodes.hudTime.textContent = (elapsedMs / 1000).toFixed(2);
  }
}

class RaceGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.nodes = {
      startScreen: document.getElementById("startScreen"),
      startButton: document.getElementById("startButton"),
      stageSelect: document.getElementById("stageSelect"),
      muteButton: document.getElementById("muteButton"),
      messageBox: document.getElementById("message"),
      hudStage: document.getElementById("hudStage"),
      hudLap: document.getElementById("hudLap"),
      hudSpeed: document.getElementById("hudSpeed"),
      hudTime: document.getElementById("hudTime"),
      hudBest: document.getElementById("hudBest"),
    };
    this.hud = new HUDView(this.nodes);
    this.input = new InputController(this.canvas);
    this.audio = new AudioManager();
    this.player = new PlayerCar();
    this.bestTimes = new Map();
    this.rivalWorker = new Worker("./worker-ai.js", { type: "module" });
    this.lastTs = performance.now();

    this.state = {
      stageIndex: 0,
      stage: STAGES[0],
      enemies: [],
      width: 1,
      height: 1,
      roadWidth: 1,
      laneCount: 3,
      laneClosure: -1,
      laneClosureTimer: 0,
      blurTimer: 10,
      blurActive: 0,
      policeSlow: 0,
      scrollSpeed: 250,
      currentSpeed: 250,
      boostFuel: 1,
      lapDistance: 0,
      lapLength: 4200,
      lap: 1,
      elapsedMs: 0,
      raceCleared: false,
      started: false,
      gameOver: false,
      rivalXTarget: null,
      nearMissLevel: 0,
      finishFx: 0,
      activeTile: { type: "straight", curve: 0, width: 1, dash: 1 },
      cameraOffsetX: 0,
      cameraOffsetY: 0,
      // ── NEW: score / combo ──
      score: 0,
      combo: 1,
      comboTimer: 0,
      bestScore: 0,
      // ── NEW: floating popup texts ──
      floatingTexts: [],
      // ── NEW: countdown ──
      countdownVal: 0,
      countdownTimer: 0,
      countdownActive: false,
      // ── NEW: crash cinematic ──
      crashAnim: 0,
      crashParticles: [],
      crashSlowMo: 0,
      // ── NEW: overtake tracking ──
      overtakeSet: new Set(),
    };
  }

  async boot() {
    this.rivalWorker.onmessage = (event) => {
      this.state.rivalXTarget = event.data.lane;
    };

    const loaded = await loadBestTimes().catch(() => new Map());
    for (const [k, v] of loaded.entries()) this.bestTimes.set(k, v);

    this.setupStageOptions();
    this.setupUiHandlers();
    this.setupGlobalInputGuards();
    this.input.bind();
    this.resizeCanvas();
    this.setStage(0);
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  setupStageOptions() {
    for (let i = 0; i < STAGES.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = STAGES[i].name;
      this.nodes.stageSelect.appendChild(opt);
    }
    this.nodes.stageSelect.addEventListener("change", (e) => this.setStage(Number(e.target.value)));
  }

  setupUiHandlers() {
    this.nodes.muteButton.textContent = this.audio.muted ? "🔇" : "🔊";
    this.nodes.muteButton.addEventListener("click", () => {
      this.audio.setMute(!this.audio.muted);
      this.nodes.muteButton.textContent = this.audio.muted ? "🔇" : "🔊";
      if (navigator.vibrate) navigator.vibrate(15);
    });

    this.nodes.startButton.addEventListener("click", async () => {
      await this.audio.init();
      await this.audio.ensureRunning();
      if (!this.state.started || this.state.gameOver || this.state.raceCleared) {
        this.setStage(this.state.stageIndex);
      }
      this.startRace();
    });

    window.addEventListener("focus", () => this.audio.ensureRunning());
    window.addEventListener("pageshow", () => this.audio.ensureRunning());
    window.addEventListener("resize", () => this.resizeCanvas());
    window.addEventListener("orientationchange", () => this.resizeCanvas());
  }

  setupGlobalInputGuards() {
    document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    });
  }

  resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * ratio);
    this.canvas.height = Math.floor(h * ratio);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.state.width = w;
    this.state.height = h;
    this.state.roadWidth = Math.min(460, w * 0.88);
    this.player.y = h * 0.78;
    this.syncLaneWithCount();
  }

  setStage(idx) {
    this.state.stageIndex = idx;
    this.state.stage = STAGES[idx];
    this.state.currentSpeed = this.state.stage.baseSpeed;
    this.state.scrollSpeed = this.state.stage.baseSpeed;
    this.state.lapLength = 4200 + this.state.stage.id * 350;
    this.state.lap = 1;
    this.state.lapDistance = 0;
    this.state.elapsedMs = 0;
    this.state.raceCleared = false;
    this.state.gameOver = false;
    this.state.policeSlow = 0;
    this.state.enemies = [];
    this.state.boostFuel = 1;
    this.state.blurTimer = 8 + Math.random() * 4;
    this.state.blurActive = 0;
    this.state.laneClosure = -1;
    this.state.laneClosureTimer = 0;
    this.state.rivalXTarget = null;
    this.state.nearMissLevel = 0;
    this.state.finishFx = 0;
    this.state.activeTile = getCourseTile(this.state.stage, this.state.lapDistance, this.state.lapLength);
    // reset new fields
    this.state.score = 0;
    this.state.combo = 1;
    this.state.comboTimer = 0;
    this.state.floatingTexts = [];
    this.state.countdownVal = 0;
    this.state.countdownTimer = 0;
    this.state.countdownActive = false;
    this.state.crashAnim = 0;
    this.state.crashParticles = [];
    this.state.crashSlowMo = 0;
    this.state.overtakeSet = new Set();

    this.syncLaneWithCount();
    this.player.renderX = this.laneToX(this.player.lane);
    this.hud.setStageName(this.state.stage.name);
    this.hud.setBest(this.bestTimes.get(this.state.stage.id));
    this.hud.setMessage("Avoid traffic. Finish all laps.");
  }

  startRace() {
    this.state.raceCleared = false;
    this.state.gameOver = false;
    this.nodes.startScreen.classList.add("hidden");
    this.audio.playTap();
    // ── countdown 3-2-1-GO
    this.state.countdownActive = true;
    this.state.countdownVal = 3;
    this.state.countdownTimer = 0;
    this.state.started = false; // pause input until GO
  }

  gameLoop(ts) {
    const dt = Math.min(0.033, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame((nextTs) => this.gameLoop(nextTs));
  }

  update(dt) {
    // ── countdown tick ──
    if (this.state.countdownActive) {
      this.state.countdownTimer += dt;
      if (this.state.countdownTimer >= 1.0) {
        this.state.countdownTimer = 0;
        this.state.countdownVal--;
        if (this.state.countdownVal < 0) {
          this.state.countdownActive = false;
          this.state.started = true;
        } else if (this.state.countdownVal === 0) {
          this.audio.playTap && this.audio.playTap();
        }
      }
      return; // freeze game during countdown
    }

    if (!this.state.started || this.state.gameOver) return;
    if (this.state.raceCleared) {
      this.state.finishFx = Math.min(1, this.state.finishFx + dt * 1.3);
      this.updateFloatingTexts(dt);
      return;
    }
    // ── slow-mo on crash ──
    const effectiveDt = this.state.crashSlowMo > 0 ? dt * 0.18 : dt;
    this.state.crashSlowMo = Math.max(0, this.state.crashSlowMo - dt);
    this.updateCrashParticles(dt);
    this.updateFloatingTexts(dt);
    // ── combo decay ──
    if (this.state.comboTimer > 0) {
      this.state.comboTimer -= dt;
      if (this.state.comboTimer <= 0) this.state.combo = 1;
    }
    this.state.elapsedMs += effectiveDt * 1000;
    this.syncLaneWithCount();

    this.updateSpeed(effectiveDt);
    this.updateCourseTile();
    this.input.consumeLaneMove(this.player, this.state.laneCount, effectiveDt);
    this.handleLaneClosure(effectiveDt);
    this.player.updatePosition(this.laneToX.bind(this), this.state.stage.slippery ? 0.06 : 0.15, effectiveDt);
    this.updateVisualEffects(effectiveDt);
    this.spawnAndUpdateEnemies(effectiveDt);
    this.checkOvertakes();
    this.updateRivalAI();
    this.updateNearMiss(effectiveDt);
    this.detectCollisions();
    this.updateRaceProgress(effectiveDt);
    const speedRatio = this.state.currentSpeed / (this.state.stage.baseSpeed * 1.6);
    this.audio.updateEngine(speedRatio, this.state.nearMissLevel, this.input.boost ? 1 : 0);
    this.hud.updateRaceStatus(
      this.state.lap,
      this.state.stage.laps,
      this.state.currentSpeed,
      this.state.elapsedMs,
    );
  }

  updateSpeed(dt) {
    const base = this.state.stage.baseSpeed;
    const accelTarget = base * 1.05;
    const coastTarget = base * 0.72;
    const brakeTarget = base * 0.42;
    const isBoosting = this.input.boost && this.input.accel && this.state.boostFuel > 0.02;

    if (isBoosting) {
      this.state.currentSpeed = lerp(this.state.currentSpeed, base * 1.6, 0.08 * dt * 60);
      this.state.boostFuel = Math.max(0, this.state.boostFuel - dt * 0.24);
    } else if (this.input.brake) {
      this.state.currentSpeed = lerp(this.state.currentSpeed, brakeTarget, 0.13 * dt * 60);
      this.state.boostFuel = Math.min(1, this.state.boostFuel + dt * 0.1);
    } else if (this.input.accel) {
      this.state.currentSpeed = lerp(this.state.currentSpeed, accelTarget, 0.07 * dt * 60);
      this.state.boostFuel = Math.min(1, this.state.boostFuel + dt * 0.05);
    } else {
      this.state.currentSpeed = lerp(this.state.currentSpeed, coastTarget, 0.045 * dt * 60);
      this.state.boostFuel = Math.min(1, this.state.boostFuel + dt * 0.08);
    }
    if (this.state.policeSlow > 0) {
      this.state.policeSlow -= dt;
      this.state.currentSpeed *= 0.52;
    }
    this.state.scrollSpeed = this.state.currentSpeed;
  }

  handleLaneClosure(dt) {
    if (this.state.stage.laneClosure) {
      this.state.laneClosureTimer += dt;
      if (this.state.laneClosureTimer > 8) {
        this.state.laneClosureTimer = 0;
        this.state.laneClosure = this.state.laneCount - 1;
        this.hud.setMessage("Lane closure! Move left!");
      }
    }
    if (this.state.laneClosure >= 0 && this.player.targetLane === this.state.laneClosure) {
      this.player.targetLane = clamp(this.state.laneClosure - 1, 0, this.state.laneCount - 1);
    }
  }

  updateVisualEffects(dt) {
    if (this.state.stage.sandstorm || this.state.stage.id === 7) {
      this.state.blurTimer -= dt;
      if (this.state.blurTimer <= 0) {
        this.state.blurActive = 3;
        this.state.blurTimer = 10 + Math.random() * 5;
      }
    }
    this.state.blurActive = Math.max(0, this.state.blurActive - dt);
    this.state.nearMissLevel = Math.max(0, this.state.nearMissLevel - dt * 2.4);

    // Speed-sensitive micro camera shake for 16-bit arcade weight.
    const speedRatio = this.state.currentSpeed / (this.state.stage.baseSpeed * 1.6);
    const shake = speedRatio > 0.45 ? (speedRatio - 0.45) * 3.2 : 0;
    const brakingKick = this.input.brake ? 0.9 : 0;
    this.state.cameraOffsetX = (Math.random() - 0.5) * (shake + brakingKick) * 2.2;
    this.state.cameraOffsetY = (Math.random() - 0.5) * (shake + brakingKick) * 1.3;
  }

  updateCourseTile() {
    const tile = getCourseTile(this.state.stage, this.state.lapDistance, this.state.lapLength);
    this.state.activeTile = tile;
    const targetWidth = Math.min(460, this.state.width * 0.88) * (tile.width || 1);
    this.state.roadWidth = lerp(this.state.roadWidth, targetWidth, 0.06);
  }

  spawnAndUpdateEnemies(dt) {
    const spawnRate = this.state.stage.enemyDensity * 1.2;
    if (Math.random() < spawnRate * dt) {
      this.state.enemies.push(spawnEnemy(this.withLaneToX(), this.state.stage));
    }
    updateEnemies(this.withLaneToX(), dt, this.player);
  }

  updateRivalAI() {
    if (this.state.stage.id === 7 && Math.random() < 0.03) {
      this.rivalWorker.postMessage({
        laneCount: this.state.laneCount,
        playerLane: this.player.targetLane,
        playerSpeed: this.state.scrollSpeed,
      });
    }
  }

  detectCollisions() {
    for (const enemy of this.state.enemies) {
      const ex = this.laneToX(enemy.lane) + enemy.xOffset;
      if (
        Math.abs(ex - this.player.renderX) < (enemy.width + this.player.width) * 0.45 &&
        Math.abs(enemy.y - this.player.y) < (enemy.height + this.player.height) * 0.45
      ) {
        if (enemy.type === "police") {
          this.state.policeSlow = 1.5;
          this.hud.setMessage("Police pressure! Speed reduced.");
        } else {
          this.state.gameOver = true;
          this.state.crashSlowMo = 1.1;
          for (let i = 0; i < 28; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 240;
            this.state.crashParticles.push({
              x: this.player.renderX, y: this.player.y,
              vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 120,
              life: 0.6 + Math.random() * 0.5,
              r: 3 + Math.random() * 6,
              color: ["#ff6b35","#ffdb58","#ff2255","#fff"][Math.floor(Math.random() * 4)],
            });
          }
          this.hud.setMessage("CRASH! Tap start to retry.");
        }
        return;
      }
    }
  }

  updateNearMiss(dt) {
    let best = 0;
    for (const enemy of this.state.enemies) {
      const ex = this.laneToX(enemy.lane) + enemy.xOffset;
      const dx = Math.abs(ex - this.player.renderX);
      const dy = Math.abs(enemy.y - this.player.y);
      if (dy > 80) continue;
      const nearBand = this.player.width + enemy.width + 24;
      if (dx < nearBand && dx > (this.player.width + enemy.width) * 0.45) {
        const score = 1 - dx / nearBand;
        if (score > best) best = score;
      }
    }
    if (best > 0) {
      this.state.nearMissLevel = Math.max(this.state.nearMissLevel, best);
      if (best > 0.65) {
        this.hud.setMessage("Near miss! Keep pushing!");
        const pts = Math.floor(50 * best * this.state.combo);
        this.state.score += pts;
        this.state.combo = Math.min(8, this.state.combo + 0.5);
        this.state.comboTimer = 2.0;
        this.state.floatingTexts.push({
          x: this.player.renderX + (Math.random() - 0.5) * 20,
          y: this.player.y - 20,
          text: `NEAR MISS +${pts}`,
          life: 1.0, maxLife: 1.0,
          color: "#ff9944", size: 14,
        });
      }
    } else {
      this.state.nearMissLevel = Math.max(0, this.state.nearMissLevel - dt * 1.8);
    }
  }

  updateRaceProgress(dt) {
    this.state.lapDistance += this.state.scrollSpeed * dt;
    if (this.state.lapDistance >= this.state.lapLength * this.state.stage.laps) {
      this.clearRace();
    }
    this.state.lap = Math.min(
      this.state.stage.laps,
      Math.floor(this.state.lapDistance / this.state.lapLength) + 1,
    );
  }

  clearRace() {
    this.state.raceCleared = true;
    this.state.finishFx = 0.01;
    this.hud.setMessage("Stage Clear!");
    saveBestTime(this.state.stage.id, this.state.elapsedMs)
      .then(async () => {
        const times = await loadBestTimes();
        this.bestTimes.clear();
        for (const [k, v] of times.entries()) this.bestTimes.set(k, v);
        this.hud.setBest(this.bestTimes.get(this.state.stage.id));
      })
      .catch(() => {});
  }

  draw() {
    this.ctx.save();
    this.ctx.translate(this.state.cameraOffsetX, this.state.cameraOffsetY);
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.state.height);
    grad.addColorStop(0, stageSkyTop(this.state.stage.weather));
    grad.addColorStop(1, stageSkyBottom(this.state.stage.weather));
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.state.width, this.state.height);

    const speedRatio = this.state.currentSpeed / (this.state.stage.baseSpeed * 1.6);
    const tileVisual = getTileVisualProfile(this.state.activeTile?.type);
    drawSpeedStreaks(this.ctx, this.state.width, this.state.height, speedRatio, this.state.elapsedMs * 0.001);
    const road = this.drawRoad();
    if (tileVisual.reflectionStrength > 0.01) {
      drawNeonReflections(
        this.ctx,
        road.roadLeft,
        road.roadRight,
        this.state.height,
        this.state.laneCount,
        this.state.elapsedMs * 0.001,
        tileVisual.reflectionStrength,
        tileVisual.reflectionHue,
      );
    }
    for (const enemy of this.state.enemies) drawEnemy(this.ctx, this.withLaneToX(), enemy);
    this.player.draw(this.ctx, speedRatio);
    drawTurboTrail(
      this.ctx,
      this.player.renderX,
      this.player.y,
      this.player.exhaust.x,
      this.player.exhaust.y,
      this.input.boost ? 0.4 + speedRatio * 0.6 : 0,
      this.state.elapsedMs * 0.06,
      this.player.heading,
    );
    drawNearMissFlash(this.ctx, this.state.width, this.state.height, this.state.nearMissLevel);
    drawSpeedBandOverlay(this.ctx, this.state.width, this.state.height, speedRatio);
    if (this.state.raceCleared) {
      drawFinishBurst(this.ctx, this.state.width, this.state.height, this.state.finishFx);
    }

    if (this.state.blurActive > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.15;
      this.ctx.fillStyle = "#c9b27f";
      this.ctx.filter = "blur(4px)";
      this.ctx.fillRect(0, 0, this.state.width, this.state.height);
      this.ctx.restore();
    }
    drawCrashParticles(this.ctx, this.state.crashParticles);
    drawFloatingTexts(this.ctx, this.state.floatingTexts);
    this.ctx.restore();
    // HUD overlays (fixed — no camera shake)
    drawBoostGauge(this.ctx, this.state.width, this.state.height, this.state.boostFuel, this.input.boost);
    drawScoreHUD(this.ctx, this.state.width, this.state.score, this.state.combo, this.state.comboTimer);
    if (this.state.countdownActive) {
      drawCountdown(this.ctx, this.state.width, this.state.height, this.state.countdownVal, this.state.countdownTimer);
    }
  }

  drawRoad() {
    const t = performance.now() * 0.0002;
    const tile = this.state.activeTile || { curve: 0, dash: 1 };
    const visual = getTileVisualProfile(tile.type);
    const curvePower = this.state.stage.roadCurve * 0.45 + tile.curve * 0.55;
    const centerShift = Math.sin(t * (1 + Math.abs(curvePower))) * 45 * curvePower;
    const roadLeft = this.state.width / 2 - this.state.roadWidth / 2 + centerShift;
    const roadRight = roadLeft + this.state.roadWidth;
    const speedRatio = this.state.currentSpeed / (this.state.stage.baseSpeed * 1.6);
    const scroll = (this.state.lapDistance * (0.85 + speedRatio * 0.5)) % 80;
    const forwardScroll = -scroll;
    const p = new Path2D();
    p.moveTo(roadLeft + 60, 0);
    p.bezierCurveTo(
      roadLeft - 10,
      this.state.height * 0.3,
      roadLeft + 20,
      this.state.height * 0.7,
      roadLeft,
      this.state.height,
    );
    p.lineTo(roadRight, this.state.height);
    p.bezierCurveTo(
      roadRight - 20,
      this.state.height * 0.7,
      roadRight + 10,
      this.state.height * 0.3,
      roadRight - 60,
      0,
    );
    p.closePath();

    // Layer 1: base asphalt tone per surface profile.
    this.ctx.fillStyle = visual.baseColor;
    this.ctx.fill(p);

    // Layer 2: flowing dither/noise pattern.
    this.ctx.save();
    this.ctx.clip(p);
    const texStep = 20 + visual.noiseScale * 10;
    for (let y = -texStep + forwardScroll * visual.noiseFlow; y < this.state.height + texStep; y += texStep) {
      const stripeRatio = y / Math.max(1, this.state.height);
      const alpha = 0.06 + stripeRatio * 0.14;
      this.ctx.fillStyle = `rgba(${visual.noiseRgb}, ${alpha.toFixed(3)})`;
      this.ctx.fillRect(roadLeft, y, this.state.roadWidth, 3 + stripeRatio * 4);
      if (((y / texStep) & 1) === 0) {
        this.ctx.fillStyle = `rgba(${visual.ditherRgb}, ${(alpha * 0.55).toFixed(3)})`;
        this.ctx.fillRect(roadLeft + 6, y + 2, this.state.roadWidth - 12, 2);
      }
    }

    // Layer 3: highlight reflections.
    const hi = this.ctx.createLinearGradient(0, this.state.height * 0.28, 0, this.state.height);
    hi.addColorStop(0, "rgba(255,255,255,0)");
    hi.addColorStop(0.72, visual.highlightMid);
    hi.addColorStop(1, visual.highlightEnd);
    this.ctx.fillStyle = hi;
    this.ctx.fillRect(roadLeft, this.state.height * 0.28, this.state.roadWidth, this.state.height * 0.72);
    this.ctx.restore();
    this.drawTileSurfaceDetails(p, roadLeft, roadRight, forwardScroll, tile);

    this.ctx.strokeStyle = visual.edgeStroke;
    this.ctx.lineWidth = 4;
    this.ctx.stroke(p);

    // Perspective lane markers: width/spacing vary by distance.
    this.drawPerspectiveLaneMarkers(roadLeft, roadRight, forwardScroll, tile, visual);

    // Roadside blinking lights.
    this.ctx.save();
    const lightFlow = 1.2 + speedRatio * 0.8;
    const beat = Math.sin(this.state.elapsedMs * 0.018) * 0.5 + 0.5;
    for (let y = -44 + forwardScroll * lightFlow; y < this.state.height + 60; y += 56) {
      const depth = clamp(y / this.state.height, 0, 1);
      const w = 2 + depth * 3;
      const h = 10 + depth * 14;
      const alpha = 0.2 + depth * 0.55 + beat * 0.15;
      this.ctx.fillStyle = `rgba(${visual.lightRgb}, ${alpha.toFixed(3)})`;
      this.ctx.fillRect(roadLeft + 7, y, w, h);
      this.ctx.fillRect(roadRight - 7 - w, y, w, h);
    }
    this.ctx.restore();
    return { roadLeft, roadRight };
  }

  drawPerspectiveLaneMarkers(roadLeft, roadRight, forwardScroll, tile, visual) {
    const laneSpan = roadRight - roadLeft;
    const dashScale = tile.dash || 1;
    for (let laneIndex = 1; laneIndex < this.state.laneCount; laneIndex++) {
      const laneBaseX = roadLeft + (laneSpan / this.state.laneCount) * laneIndex;
      for (let y = -80 + (forwardScroll % 90); y < this.state.height + 120; y += 32 * dashScale) {
        const depth = clamp(y / this.state.height, 0, 1);
        const thickness = 1 + depth * 4.2;
        const dashLen = 6 + depth * 22;
        const glow = 0.24 + depth * 0.5;
        const laneDrift = Math.sin((this.state.elapsedMs * 0.002 + laneIndex) * 1.4) * 1.4 * depth;
        this.ctx.strokeStyle = `rgba(${visual.laneRgb}, ${glow.toFixed(3)})`;
        this.ctx.lineWidth = thickness;
        this.ctx.beginPath();
        this.ctx.moveTo(laneBaseX + laneDrift, y);
        this.ctx.lineTo(laneBaseX + laneDrift, y + dashLen);
        this.ctx.stroke();
      }
    }
  }

  drawTileSurfaceDetails(path2d, roadLeft, roadRight, forwardScroll, tile) {
    const type = tile.type || "";
    const visual = getTileVisualProfile(type);
    this.ctx.save();
    this.ctx.clip(path2d);
    if (type.includes("construction") || type.includes("workzone") || type.includes("merge")) {
      for (let y = -30 + forwardScroll * 1.4; y < this.state.height + 60; y += 44) {
        this.ctx.fillStyle = "rgba(255, 186, 48, 0.24)";
        this.ctx.fillRect(roadRight - 34, y, 20, 14);
      }
    } else if (type.includes("wet") || type.includes("dock")) {
      const wet = this.ctx.createLinearGradient(0, this.state.height * 0.3, 0, this.state.height);
      wet.addColorStop(0, "rgba(84, 130, 190, 0.02)");
      wet.addColorStop(1, "rgba(122, 190, 255, 0.18)");
      this.ctx.fillStyle = wet;
      this.ctx.fillRect(roadLeft, this.state.height * 0.3, roadRight - roadLeft, this.state.height * 0.7);
    } else if (type.includes("desert")) {
      for (let y = -20 + forwardScroll * 0.8; y < this.state.height + 40; y += 52) {
        this.ctx.fillStyle = "rgba(209, 177, 112, 0.18)";
        this.ctx.fillRect(roadLeft + 8, y, roadRight - roadLeft - 16, 4);
      }
    } else if (type.includes("future") || type.includes("tunnel")) {
      this.ctx.strokeStyle = visual.futureGrid;
      this.ctx.lineWidth = 2;
      for (let y = -26 + forwardScroll * 1.3; y < this.state.height + 40; y += 34) {
        this.ctx.beginPath();
        this.ctx.moveTo(roadLeft + 10, y);
        this.ctx.lineTo(roadRight - 10, y);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  syncLaneWithCount() {
    this.state.laneCount = getLaneCount(this.state.stage, this.getLapProgress());
    this.player.syncLaneBounds(this.state.laneCount);
  }

  getLapProgress() {
    return (this.state.lapDistance % this.state.lapLength) / this.state.lapLength;
  }

  laneToX(lane) {
    const left = this.state.width / 2 - this.state.roadWidth / 2;
    const laneW = this.state.roadWidth / this.state.laneCount;
    return left + laneW * (lane + 0.5);
  }

  withLaneToX() {
    return {
      ...this.state,
      laneToX: this.laneToX.bind(this),
      player: this.player,
      rivalXTarget: this.state.rivalXTarget,
    };
  }

  checkOvertakes() {
    for (const enemy of this.state.enemies) {
      if (this.state.overtakeSet.has(enemy)) continue;
      const ex = this.laneToX(enemy.lane) + enemy.xOffset;
      const overtakeDy = enemy.y - this.player.y;
      if (overtakeDy > 10 && overtakeDy < 80 && Math.abs(ex - this.player.renderX) < this.state.roadWidth * 0.28) {
        this.state.overtakeSet.add(enemy);
        this.state.combo++;
        this.state.comboTimer = 3.0;
        const pts = 100 * Math.floor(this.state.combo);
        this.state.score += pts;
        const label = this.state.combo >= 3 ? `${Math.floor(this.state.combo)}x COMBO! +${pts}` : `OVERTAKE +${pts}`;
        this.state.floatingTexts.push({
          x: this.player.renderX + (Math.random() - 0.5) * 30,
          y: this.player.y - 30,
          text: label,
          life: 1.2, maxLife: 1.2,
          color: this.state.combo >= 3 ? "#ffdd00" : "#7ef9ff",
          size: this.state.combo >= 3 ? 22 : 16,
        });
      }
    }
    for (const e of this.state.overtakeSet) {
      if (!this.state.enemies.includes(e)) this.state.overtakeSet.delete(e);
    }
  }

  updateFloatingTexts(dt) {
    for (const ft of this.state.floatingTexts) {
      ft.life -= dt;
      ft.y -= 38 * dt;
    }
    this.state.floatingTexts = this.state.floatingTexts.filter(ft => ft.life > 0);
  }

  updateCrashParticles(dt) {
    for (const p of this.state.crashParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
    }
    this.state.crashParticles = this.state.crashParticles.filter(p => p.life > 0);
  }
}

function stageSkyTop(weather) {
  return (
    {
      clear: "#050a1e",
      dawn: "#2e3d75",
      cloudy: "#5f6e83",
      sandstorm: "#bd8d54",
      rain: "#1f2438",
      evening: "#515264",
      future: "#181233",
    }[weather] || "#0f1224"
  );
}

function getTileVisualProfile(type) {
  const key = type || "straight";
  if (key.includes("wet") || key.includes("dock")) {
    return {
      baseColor: "#202b40",
      noiseRgb: "84, 120, 165",
      ditherRgb: "120, 176, 225",
      highlightMid: "rgba(120, 180, 255, 0.08)",
      highlightEnd: "rgba(172, 214, 255, 0.24)",
      edgeStroke: "#9bc1f4",
      laneRgb: "214, 234, 255",
      lightRgb: "160, 221, 255",
      noiseScale: 1.2,
      noiseFlow: 1.1,
      futureGrid: "rgba(173, 232, 255, 0.22)",
      reflectionStrength: 0.9,
      reflectionHue: [120, 180, 255],
    };
  }
  if (key.includes("desert")) {
    return {
      baseColor: "#4f3f2f",
      noiseRgb: "165, 133, 88",
      ditherRgb: "214, 184, 136",
      highlightMid: "rgba(235, 180, 102, 0.08)",
      highlightEnd: "rgba(255, 220, 156, 0.2)",
      edgeStroke: "#c9a476",
      laneRgb: "251, 232, 184",
      lightRgb: "255, 214, 145",
      noiseScale: 1.35,
      noiseFlow: 0.9,
      futureGrid: "rgba(208, 174, 117, 0.2)",
      reflectionStrength: 0.2,
      reflectionHue: [255, 209, 131],
    };
  }
  if (key.includes("future") || key.includes("tunnel")) {
    return {
      baseColor: "#211a3a",
      noiseRgb: "110, 90, 165",
      ditherRgb: "176, 130, 245",
      highlightMid: "rgba(148, 126, 255, 0.1)",
      highlightEnd: "rgba(120, 225, 255, 0.2)",
      edgeStroke: "#9f8bff",
      laneRgb: "228, 217, 255",
      lightRgb: "168, 250, 255",
      noiseScale: 1.0,
      noiseFlow: 1.35,
      futureGrid: "rgba(173, 232, 255, 0.32)",
      reflectionStrength: 0.65,
      reflectionHue: [168, 220, 255],
    };
  }
  return {
    baseColor: "#26304a",
    noiseRgb: "78, 92, 124",
    ditherRgb: "120, 139, 182",
    highlightMid: "rgba(121, 140, 186, 0.08)",
    highlightEnd: "rgba(153, 183, 222, 0.18)",
    edgeStroke: "#8aa2cd",
    laneRgb: "224, 232, 255",
    lightRgb: "166, 196, 241",
    noiseScale: 1.05,
    noiseFlow: 1.0,
    futureGrid: "rgba(153, 183, 222, 0.2)",
    reflectionStrength: 0.28,
    reflectionHue: [136, 174, 236],
  };
}

function stageSkyBottom(weather) {
  return (
    {
      clear: "#17294f",
      dawn: "#ff9469",
      cloudy: "#9eb0c2",
      sandstorm: "#f2cb84",
      rain: "#293454",
      evening: "#8f7c67",
      future: "#4f2fa0",
    }[weather] || "#324466"
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const game = new RaceGame();
game.boot();

function drawSpeedStreaks(ctx, width, height, speedRatio, time) {
  const count = Math.floor(20 + speedRatio * 80);
  ctx.save();
  ctx.globalAlpha = 0.12 + speedRatio * 0.28;
  ctx.strokeStyle = "#dff5ff";
  for (let i = 0; i < count; i++) {
    const seed = i * 37.13;
    const x = (Math.sin(seed + time * 2.1) * 0.5 + 0.5) * width;
    const y = ((seed * 17 + time * (300 + speedRatio * 900)) % (height + 120)) - 60;
    const len = 10 + speedRatio * 42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNearMissFlash(ctx, width, height, nearMissLevel) {
  if (nearMissLevel <= 0) return;
  const alpha = Math.min(0.45, nearMissLevel * 0.5);
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.78, 40, width * 0.5, height * 0.78, 280);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.55, `rgba(255,140,80,${alpha * 0.6})`);
  gradient.addColorStop(1, "rgba(255,80,40,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawTurboTrail(ctx, carX, carY, exhaustLocalX, exhaustLocalY, boostPower, frame, heading) {
  if (boostPower <= 0.05) return;
  const particles = 16;
  ctx.save();
  const dirX = -Math.sin(heading);
  const dirY = Math.cos(heading);
  const originX = carX + Math.cos(heading) * exhaustLocalX - Math.sin(heading) * exhaustLocalY;
  const originY = carY + Math.sin(heading) * exhaustLocalX + Math.cos(heading) * exhaustLocalY;
  for (let i = 0; i < particles; i++) {
    const t = i / particles;
    const spread = (Math.random() - 0.5) * (8 + t * 12);
    const px = originX + dirX * (t * 96) + Math.cos(heading) * spread;
    const py = originY + dirY * (t * 96) + Math.sin(frame * 0.08 + i) * 2;
    const r = (1 - t) * (6 + boostPower * 7);
    ctx.globalAlpha = (1 - t) * (0.16 + boostPower * 0.35);
    ctx.fillStyle = i % 2 ? "#6cf8ff" : "#9f6bff";
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawNeonReflections(ctx, roadLeft, roadRight, height, laneCount, time, intensity, reflectionHue) {
  const laneW = (roadRight - roadLeft) / laneCount;
  ctx.save();
  ctx.globalAlpha = 0.12 + intensity * 0.22;
  const [rr, gg, bb] = reflectionHue;
  for (let i = 0; i < laneCount; i++) {
    const x = roadLeft + i * laneW;
    const pulse = Math.sin(time * 3 + i * 0.9) * 0.5 + 0.5;
    const grad = ctx.createLinearGradient(0, height * 0.45, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(
      0.65,
      `rgba(${Math.min(255, rr * 0.55 + pulse * 90)}, ${Math.min(255, gg * 0.55 + pulse * 70)}, ${Math.min(255, bb * 0.8 + pulse * 60)}, 0.24)`,
    );
    grad.addColorStop(1, `rgba(${Math.min(255, rr + 48)}, ${Math.min(255, gg + 24)}, ${Math.min(255, bb + 28)}, 0.35)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x + 4, height * 0.45, laneW - 8, height * 0.55);
  }
  ctx.restore();
}

function drawSpeedBandOverlay(ctx, width, height, speedRatio) {
  let color = null;
  if (speedRatio < 0.35) color = "rgba(72, 126, 210, 0.08)";
  else if (speedRatio < 0.7) color = "rgba(126, 104, 255, 0.11)";
  else color = "rgba(72, 225, 255, 0.16)";
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawFinishBurst(ctx, width, height, t) {
  if (t <= 0) return;
  const cx = width * 0.5;
  const cy = height * 0.45;
  const rays = 36;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    const r1 = 30 + t * 40;
    const r2 = 120 + t * 260;
    ctx.strokeStyle = `rgba(255, ${180 + (i % 2) * 60}, 90, ${0.35 * (1 - t)})`;
    ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const p = Math.max(0, t - i * 0.12);
    if (p <= 0) continue;
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - p)})`;
    ctx.lineWidth = 4 - i;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 + p * 280, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoostGauge(ctx, width, height, fuel, boosting) {
  const x = width - 64;
  const y = height - 148;
  const w = 14;
  const h = 100;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundedRect(ctx, x - 3, y - 3, w + 6, h + 6, 5);
  ctx.fill();
  const fill = Math.max(0, Math.min(1, fuel));
  const fillH = h * fill;
  if (fillH > 0) {
    const boostGrad = ctx.createLinearGradient(0, y + h, 0, y + h - fillH);
    boostGrad.addColorStop(0, boosting ? "#ffdd00" : "#4fffce");
    boostGrad.addColorStop(1, boosting ? "#ff6b00" : "#1a9fff");
    ctx.fillStyle = boostGrad;
    roundedRect(ctx, x, y + h - fillH, w, fillH, 3);
    ctx.fill();
  }
  ctx.fillStyle = boosting ? "#ffdd00" : "#7ef9ff";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("BOOST", x + w * 0.5, y + h + 16);
  ctx.restore();
}

function drawScoreHUD(ctx, width, score, combo, comboTimer) {
  ctx.save();
  ctx.textAlign = "right";
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = "#7ef9ff";
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 8;
  ctx.fillText(String(score).padStart(7, "0"), width - 18, 36);
  if (combo > 1 && comboTimer > 0) {
    ctx.globalAlpha = Math.min(1, comboTimer * 0.8);
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#ffdd00";
    ctx.shadowColor = "#ff8800";
    ctx.shadowBlur = 10;
    ctx.fillText(`x${Math.floor(combo)} COMBO`, width - 18, 56);
  }
  ctx.restore();
}

function drawCountdown(ctx, width, height, val, timer) {
  const label = val <= 0 ? "GO!" : String(val);
  const pulse = 1 - (timer % 1.0) * 0.3;
  const size = Math.floor(118 * pulse);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px monospace`;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = val <= 0 ? "#7ef9ff" : "#ffdd00";
  ctx.shadowColor = val <= 0 ? "#00e5ff" : "#ff9900";
  ctx.shadowBlur = 32;
  ctx.fillText(label, width * 0.5, height * 0.42);
  ctx.restore();
}

function drawCrashParticles(ctx, particles) {
  if (!particles.length) return;
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life) * 0.88;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloatingTexts(ctx, texts) {
  if (!texts.length) return;
  ctx.save();
  ctx.textAlign = "center";
  for (const ft of texts) {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size || 16}px monospace`;
    ctx.fillStyle = ft.color || "#ffffff";
    ctx.shadowColor = ft.color || "#ffffff";
    ctx.shadowBlur = 12;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();
}
