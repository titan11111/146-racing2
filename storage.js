const DB_NAME = "night-racer-86-db";
const STORE = "best-times";
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "stageId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadBestTimes() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const map = new Map();
      for (const row of req.result) map.set(row.stageId, row.bestTimeMs);
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveBestTime(stageId, timeMs) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const currentReq = store.get(stageId);
  const current = await new Promise((resolve, reject) => {
    currentReq.onsuccess = () => resolve(currentReq.result);
    currentReq.onerror = () => reject(currentReq.error);
  });
  if (!current || timeMs < current.bestTimeMs) {
    store.put({ stageId, bestTimeMs: timeMs });
  }
}
