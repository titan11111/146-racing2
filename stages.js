export const STAGES = [
  {
    id: 1,
    name: "Stage 1 | Midnight",
    lanes: 3,
    laps: 3,
    targetTime: 90,
    baseSpeed: 250,
    enemyDensity: 0.5,
    roadCurve: 0.25,
    weather: "clear",
    enemyTypes: ["truck"],
    tiles: [
      { type: "straight", len: 8, curve: 0.1, width: 1.0, dash: 1.0 },
      { type: "gentle-left", len: 5, curve: -0.35, width: 0.98, dash: 1.0 },
      { type: "straight", len: 7, curve: 0.08, width: 1.0, dash: 1.05 },
      { type: "gentle-right", len: 5, curve: 0.35, width: 0.98, dash: 1.0 },
    ],
  },
  {
    id: 2,
    name: "Stage 2 | Wangan",
    lanes: 4,
    laps: 3,
    targetTime: 80,
    baseSpeed: 290,
    enemyDensity: 0.75,
    roadCurve: 0.4,
    weather: "dawn",
    enemyTypes: ["truck", "sedan"],
    boostZones: true,
    tiles: [
      { type: "long-straight", len: 12, curve: 0.04, width: 1.04, dash: 1.15 },
      { type: "s-left", len: 5, curve: -0.5, width: 0.96, dash: 0.95 },
      { type: "s-right", len: 5, curve: 0.55, width: 0.96, dash: 0.95 },
      { type: "long-straight", len: 10, curve: 0.06, width: 1.02, dash: 1.1 },
    ],
  },
  {
    id: 3,
    name: "Stage 3 | Downhill",
    lanes: 3,
    laps: 4,
    targetTime: 100,
    baseSpeed: 265,
    enemyDensity: 0.9,
    roadCurve: 0.9,
    weather: "cloudy",
    enemyTypes: ["sedan", "bike"],
    dynamicLaneWindows: [
      { startLapProgress: 0.4, endLapProgress: 0.58, lanes: 2 },
    ],
    tiles: [
      { type: "mountain-left", len: 7, curve: -0.8, width: 0.9, dash: 0.9 },
      { type: "hairpin-right", len: 4, curve: 1.1, width: 0.82, dash: 0.85 },
      { type: "drop-straight", len: 6, curve: 0.12, width: 0.95, dash: 1.0 },
      { type: "mountain-right", len: 7, curve: 0.78, width: 0.9, dash: 0.9 },
    ],
  },
  {
    id: 4,
    name: "Stage 4 | Desert",
    lanes: 5,
    laps: 3,
    targetTime: 85,
    baseSpeed: 300,
    enemyDensity: 0.9,
    roadCurve: 0.45,
    weather: "sandstorm",
    enemyTypes: ["truck", "sport"],
    sandstorm: true,
    tiles: [
      { type: "desert-straight", len: 9, curve: 0.12, width: 1.08, dash: 1.0 },
      { type: "desert-wave-left", len: 6, curve: -0.45, width: 1.02, dash: 0.95 },
      { type: "desert-wave-right", len: 6, curve: 0.45, width: 1.02, dash: 0.95 },
    ],
  },
  {
    id: 5,
    name: "Stage 5 | Wet Night",
    lanes: 3,
    laps: 4,
    targetTime: 110,
    baseSpeed: 255,
    enemyDensity: 1.05,
    roadCurve: 0.8,
    weather: "rain",
    enemyTypes: ["sedan", "bike", "police"],
    slippery: true,
    tiles: [
      { type: "wet-straight", len: 8, curve: 0.14, width: 0.98, dash: 1.0 },
      { type: "dock-corner-left", len: 5, curve: -0.9, width: 0.86, dash: 0.8 },
      { type: "dock-corner-right", len: 5, curve: 0.9, width: 0.86, dash: 0.8 },
      { type: "wet-straight", len: 7, curve: 0.1, width: 0.98, dash: 1.0 },
    ],
  },
  {
    id: 6,
    name: "Stage 6 | Chaos",
    lanes: 4,
    laps: 4,
    targetTime: 115,
    baseSpeed: 270,
    enemyDensity: 1.1,
    roadCurve: 0.5,
    weather: "evening",
    enemyTypes: ["truck", "sedan", "bike", "sport", "police"],
    laneClosure: true,
    tiles: [
      { type: "construction-straight", len: 7, curve: 0.18, width: 0.96, dash: 1.0 },
      { type: "workzone-left", len: 5, curve: -0.65, width: 0.85, dash: 0.85 },
      { type: "merge-right", len: 5, curve: 0.72, width: 0.84, dash: 0.8 },
      { type: "construction-straight", len: 6, curve: 0.16, width: 0.94, dash: 0.95 },
    ],
  },
  {
    id: 7,
    name: "FINAL | Tokyo Loop 2086",
    lanes: 5,
    laps: 5,
    targetTime: 150,
    baseSpeed: 290,
    enemyDensity: 1.25,
    roadCurve: 1.0,
    weather: "future",
    enemyTypes: ["truck", "sedan", "bike", "sport", "police", "rival"],
    finalMix: true,
    tiles: [
      { type: "future-straight", len: 8, curve: 0.14, width: 1.06, dash: 1.05 },
      { type: "future-tight-left", len: 5, curve: -0.95, width: 0.82, dash: 0.78 },
      { type: "future-tunnel", len: 6, curve: 0.0, width: 0.76, dash: 0.65 },
      { type: "future-tight-right", len: 5, curve: 0.95, width: 0.82, dash: 0.78 },
      { type: "future-straight", len: 7, curve: 0.12, width: 1.0, dash: 1.0 },
    ],
  },
];

export function getLaneCount(stage, lapProgress) {
  if (stage.id === 7) {
    if (lapProgress < 0.33) return 3;
    if (lapProgress < 0.66) return 4;
    return 5;
  }
  if (stage.dynamicLaneWindows) {
    for (const windowDef of stage.dynamicLaneWindows) {
      if (
        lapProgress >= windowDef.startLapProgress &&
        lapProgress <= windowDef.endLapProgress
      ) {
        return windowDef.lanes;
      }
    }
  }
  return stage.lanes;
}

const DEFAULT_TILE = { type: "straight", len: 8, curve: 0, width: 1, dash: 1 };

export function getCourseTile(stage, lapDistance, lapLength) {
  if (!stage.tiles || stage.tiles.length === 0) return DEFAULT_TILE;
  const totalLen = stage.tiles.reduce((acc, tile) => acc + tile.len, 0) || 1;
  const progressInLap = (lapDistance % lapLength) / lapLength;
  const pos = progressInLap * totalLen;
  let cursor = 0;
  for (const tile of stage.tiles) {
    cursor += tile.len;
    if (pos <= cursor) return tile;
  }
  return stage.tiles[stage.tiles.length - 1];
}
