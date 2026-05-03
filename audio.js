const MUTE_KEY = "night-racer-86-mute";

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineNode = null;
    this.engineInput = null;
    this.driveShaper = null;
    this.pumpGain = null;
    this.initialized = false;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
  }

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.2;
    this.master.connect(this.ctx.destination);

    try {
      const workletCode = `
        class EngineWorklet extends AudioWorkletProcessor {
          static get parameterDescriptors() {
            return [
              { name: 'rpm', defaultValue: 0.4, minValue: 0, maxValue: 1 },
              { name: 'drive', defaultValue: 0, minValue: 0, maxValue: 1 },
              { name: 'pump', defaultValue: 0, minValue: 0, maxValue: 1 }
            ];
          }
          constructor() {
            super();
            this.phase = 0;
          }
          process(inputs, outputs, parameters) {
            const output = outputs[0][0];
            const rpm = parameters.rpm;
            const drive = parameters.drive;
            const pump = parameters.pump;
            for (let i = 0; i < output.length; i++) {
              const r = rpm.length > 1 ? rpm[i] : rpm[0];
              const d = drive.length > 1 ? drive[i] : drive[0];
              const p = pump.length > 1 ? pump[i] : pump[0];
              const freq = 50 + r * 220;
              this.phase += (Math.PI * 2 * freq) / sampleRate;
              const raw = Math.sin(this.phase) * 0.25 + Math.sin(this.phase * 0.5) * 0.08;
              const saturated = Math.tanh(raw * (1.6 + d * 4.2));
              const pumpLfo = 1 - p * (0.22 + 0.18 * Math.sin(this.phase * 0.08));
              output[i] = saturated * pumpLfo;
            }
            return true;
          }
        }
        registerProcessor('engine-worklet', EngineWorklet);
      `;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(url);
      this.engineNode = new AudioWorkletNode(this.ctx, "engine-worklet");
      URL.revokeObjectURL(url);
    } catch (_err) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.engineNode = { osc, gain, fallback: true };
    }

    if (this.engineNode instanceof AudioWorkletNode) {
      this.engineInput = this.engineNode;
    }
    this.setupEngineEffectsChain();
    this.initialized = true;
  }

  async ensureRunning() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMute(mute) {
    this.muted = mute;
    localStorage.setItem(MUTE_KEY, mute ? "1" : "0");
    if (this.master) this.master.gain.value = mute ? 0 : 0.2;
  }

  setupEngineEffectsChain() {
    this.driveShaper = this.ctx.createWaveShaper();
    this.driveShaper.curve = createDriveCurve(220);
    this.driveShaper.oversample = "2x";

    this.pumpGain = this.ctx.createGain();
    this.pumpGain.gain.value = 1;

    if (this.engineInput) {
      this.engineInput.connect(this.driveShaper);
      this.driveShaper.connect(this.pumpGain);
      this.pumpGain.connect(this.master);
    } else if (this.engineNode?.fallback) {
      this.engineNode.gain.disconnect();
      this.engineNode.gain.connect(this.driveShaper);
      this.driveShaper.connect(this.pumpGain);
      this.pumpGain.connect(this.master);
    }
  }

  updateEngine(speedRatio, nearMissLevel = 0, boostLevel = 0) {
    if (!this.initialized) return;
    const value = Math.max(0, Math.min(1, speedRatio));
    const driveAmount = Math.max(0, Math.min(1, nearMissLevel));
    const pumpAmount = Math.max(0, Math.min(1, boostLevel));
    if (this.engineNode instanceof AudioWorkletNode) {
      const rpm = this.engineNode.parameters.get("rpm");
      const drive = this.engineNode.parameters.get("drive");
      const pump = this.engineNode.parameters.get("pump");
      rpm.setTargetAtTime(value, this.ctx.currentTime, 0.04);
      drive.setTargetAtTime(driveAmount, this.ctx.currentTime, 0.035);
      pump.setTargetAtTime(pumpAmount, this.ctx.currentTime, 0.05);
    } else if (this.engineNode?.fallback) {
      this.engineNode.osc.frequency.setTargetAtTime(70 + value * 280, this.ctx.currentTime, 0.03);
      this.engineNode.gain.gain.setTargetAtTime(0.05 + value * 0.05, this.ctx.currentTime, 0.03);
      if (this.pumpGain) {
        const pumping = 1 - pumpAmount * 0.28;
        this.pumpGain.gain.setTargetAtTime(pumping, this.ctx.currentTime, 0.035);
      }
    }
    if (this.driveShaper) {
      this.driveShaper.curve = createDriveCurve(220 + driveAmount * 420);
    }
    if (this.pumpGain) {
      const pumping = 1 - pumpAmount * 0.28;
      this.pumpGain.gain.setTargetAtTime(pumping, this.ctx.currentTime, 0.035);
    }
  }

  playTap() {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 780;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(this.master);
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.09);
  }
}

function createDriveCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = typeof amount === "number" ? amount : 50;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}
