self.onmessage = (event) => {
  const { laneCount, playerLane, playerSpeed } = event.data;
  const left = Math.max(0, playerLane - 1);
  const right = Math.min(laneCount - 1, playerLane + 1);
  const blockLane = Math.random() > 0.5 ? right : left;
  const aheadSeconds = 0.5 + Math.random() * 0.5;
  self.postMessage({
    lane: blockLane,
    aheadDistance: playerSpeed * aheadSeconds,
  });
};
