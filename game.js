const CFG = {
  rows: 6,
  cols: 6,
  timeSeconds: 90,
  allowCascades: true
};

const TILESET = {
  useImages: false, // поставь true, когда добавишь PNG в /assets

  // BASE_TILES — обычные плитки, они выпадают случайно
  baseTiles: [
    { key: "burger",   emoji: "🍔", img: "assets/burger.png"   },
    { key: "brownie",  emoji: "🍫", img: "assets/brownie.png"  },
    { key: "icecream", emoji: "🍦", img: "assets/icecream.png" },
    { key: "chicken",  emoji: "🍗", img: "assets/nuggets.png"  },
    { key: "roll",     emoji: "🌯", img: "assets/roll.png"     },
    { key: "sauce",    emoji: "🥫", img: "assets/sauce.png"    },
  ],

  // BOOSTERS — создаются из матчей игрока
  boosters: {
    fries: { key: "fries", emoji: "🍟", img: "assets/fries.png" }, // чистит ряд
    cola:  { key: "cola",  emoji: "🥤", img: "assets/cola.png"  }, // взрыв 3×3
  }
};

const $board = document.getElementById("board");
const $fxLayer = document.getElementById("fxLayer");
const $time = document.getElementById("time");
const $score = document.getElementById("score");
const $combo = document.getElementById("combo");
const $moves = document.getElementById("moves");
const $coins = document.getElementById("coins");

const $overlay = document.getElementById("overlay");
const $finalScore = document.getElementById("finalScore");
const $finalMoves = document.getElementById("finalMoves");
const $finalCrowns = document.getElementById("finalCrowns");
const $homeBtn = document.getElementById("homeBtn");
const $playAgain = document.getElementById("playAgain");
const $resetBtn = document.getElementById("resetBtn");

let state;

function newGame() {
  state = {
    board: makeInitialBoard(CFG.rows, CFG.cols),
    selected: null,
    busy: false,
    score: 0,
    combo: 0,
    moves: 0,
    coins: 0,
    timeLeft: CFG.timeSeconds,
    timerId: null,
    lastSwap: null,
    lastMove: null,
    drag: null
  };

  fitTileSize();
  renderBoard();
  updateHUD();
  hideOverlay();

  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
}

function fitTileSize() {
  const wrapWidth = Math.min(520, window.innerWidth) - 32;
  const maxTile = Math.floor((wrapWidth - (CFG.cols - 1) * 10 - 28) / CFG.cols);
  const tile = Math.max(56, Math.min(84, maxTile));
  document.documentElement.style.setProperty("--boardCols", String(CFG.cols));
  document.documentElement.style.setProperty("--tileSize", tile + "px");
}

window.addEventListener("resize", () => fitTileSize());

function tick() {
  state.timeLeft -= 1;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateHUD();
    endGame();
    return;
  }
  updateHUD();
}

function endGame() {
  state.busy = true;
  clearInterval(state.timerId);
  showOverlay();
}

function showOverlay() {
  $finalScore.textContent = String(state.score);
  if ($finalMoves) $finalMoves.textContent = String(state.moves);
  if ($finalCrowns) $finalCrowns.textContent = String(state.coins);
  $overlay.classList.remove("hidden");
}
function hideOverlay() { $overlay.classList.add("hidden"); }

function updateHUD() {
  $score.textContent = String(state.score);
  $combo.textContent = String(state.combo);
  $moves.textContent = String(state.moves);
  $coins.textContent = String(state.coins);

  const m = Math.floor(state.timeLeft / 60);
  const s = state.timeLeft % 60;
  $time.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function makeInitialBoard(rows, cols) {
  const b = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      b[r][c] = randomTileAvoidingMatch(b, r, c);
    }
  }
  return b;
}

function randomTileAvoidingMatch(board, r, c) {
  for (let i = 0; i < 30; i++) {
    const t = randTile();
    if (!wouldFormMatch(board, r, c, t)) return t;
  }
  return randTile();
}
function wouldFormMatch(board, r, c, t) {
  if (c >= 2 && board[r][c-1]?.key === t.key && board[r][c-2]?.key === t.key) return true;
  if (r >= 2 && board[r-1][c]?.key === t.key && board[r-2][c]?.key === t.key) return true;
  return false;
}
function randTile() {
  const t = TILESET.tiles[Math.floor(Math.random() * TILESET.tiles.length)];
  return { ...t };
}

function renderBoard() {
  $board.innerHTML = "";
  for (let r = 0; r < CFG.rows; r++) {
    for (let c = 0; c < CFG.cols; c++) {
      const tile = state.board[r][c];
      const el = document.createElement("div");
      el.className = "tile";
      el.dataset.r = String(r);
      el.dataset.c = String(c);

      if (tile) {
        if (TILESET.useImages) {
          el.style.backgroundImage = `url('${tile.img}')`;
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.style.backgroundSize = "75% 75%";
          el.textContent = "";
        } else {
          el.textContent = tile.emoji;
        }
      }

      if (state.selected && state.selected.r === r && state.selected.c === c) {
        el.classList.add("selected");
      }

      el.addEventListener("pointerdown", onTilePointerDown);
      el.addEventListener("pointermove", onTilePointerMove);
      el.addEventListener("pointerup", onTilePointerUp);
      el.addEventListener("pointercancel", onTilePointerCancel);
      $board.appendChild(el);
    }
  }
}

function onTilePointerDown(e) {
  if (state.busy || state.timeLeft <= 0) return;

  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);

  state.drag = {
    active: true,
    pointerId: e.pointerId,
    startR: r,
    startC: c,
    startX: e.clientX,
    startY: e.clientY,
    axis: null, // "row" | "col"
    lastDx: 0,
    lastDy: 0
  };

  e.currentTarget.setPointerCapture(e.pointerId);
}

function onTilePointerMove(e) {
  if (!state.drag || !state.drag.active || state.busy) return;
  if (e.pointerId !== state.drag.pointerId) return;

  const dx = e.clientX - state.drag.startX;
  const dy = e.clientY - state.drag.startY;

  state.drag.lastDx = dx;
  state.drag.lastDy = dy;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (!state.drag.axis) {
    if (absX < 8 && absY < 8) return;
    state.drag.axis = absX >= absY ? "row" : "col";
  }

  clearLineTransforms();

  const tileSize = getTileSizePx();
  const maxShift = tileSize * 0.95;
  const clampedDx = Math.max(-maxShift, Math.min(maxShift, dx));
  const clampedDy = Math.max(-maxShift, Math.min(maxShift, dy));

  if (state.drag.axis === "row") {
    applyRowTransform(state.drag.startR, clampedDx);
  } else {
    applyColTransform(state.drag.startC, clampedDy);
  }
}

async function onTilePointerUp(e) {
  if (!state.drag || !state.drag.active) return;
  if (e.pointerId !== state.drag.pointerId) return;

  const { axis, startR, startC, lastDx, lastDy } = state.drag;

  state.drag.active = false;
  clearLineTransforms();

  if (!axis) {
    state.drag = null;
    return;
  }

  const tileSize = getTileSizePx();
  const threshold = tileSize * 0.45;

  let delta = 0;
  if (axis === "row") {
    if (Math.abs(lastDx) >= threshold) delta = lastDx > 0 ? +1 : -1;
  } else {
    if (Math.abs(lastDy) >= threshold) delta = lastDy > 0 ? +1 : -1;
  }

  state.drag = null;
  if (delta === 0) return;

  await attemptLineShift(axis, axis === "row" ? startR : startC, delta, { r: startR, c: startC });
}

function onTilePointerCancel(e) {
  if (!state.drag) return;
  if (e.pointerId !== state.drag.pointerId) return;
  state.drag.active = false;
  state.drag = null;
  clearLineTransforms();
}

function isAdjacent(a, b) { // legacy helper, not used now
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc) === 1;
}


async function attemptLineShift(axis, index, delta, anchor) {
  // axis: "row" or "col"
  // index: row index or col index
  // delta: +1 or -1 (cyclic shift)
  state.busy = true;

  const backup = (axis === "row")
    ? state.board[index].map(t => t ? { ...t } : null)
    : state.board.map(row => row[index] ? { ...row[index] } : null);

  applyLineShift(axis, index, delta);
  renderBoard();

  const matches = findAllMatches(state.board);
  if (matches.length === 0) {
    restoreLine(axis, index, backup);
    renderBoard();
    state.busy = false;
    return;
  }

  state.moves += 1;
  state.combo = 0;
  state.lastMove = { type: "shift", axis, index, delta, anchor };
  updateHUD();

  await resolveMatchesLoop();
  state.busy = false;
}

function applyLineShift(axis, index, delta) {
  if (axis === "row") {
    const row = state.board[index];
    if (delta === 1) row.unshift(row.pop());
    else row.push(row.shift());
  } else {
    if (delta === 1) {
      const last = state.board[CFG.rows - 1][index];
      for (let r = CFG.rows - 1; r > 0; r--) state.board[r][index] = state.board[r - 1][index];
      state.board[0][index] = last;
    } else {
      const first = state.board[0][index];
      for (let r = 0; r < CFG.rows - 1; r++) state.board[r][index] = state.board[r + 1][index];
      state.board[CFG.rows - 1][index] = first;
    }
  }
}

function restoreLine(axis, index, backup) {
  if (axis === "row") {
    state.board[index] = backup.map(t => t ? { ...t } : null);
  } else {
    for (let r = 0; r < CFG.rows; r++) state.board[r][index] = backup[r] ? { ...backup[r] } : null;
  }
}

function getTileSizePx() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--tileSize").trim();
  const n = Number(v.replace("px",""));
  return Number.isFinite(n) && n > 0 ? n : 72;
}

function clearLineTransforms() {
  const nodes = $board.querySelectorAll(".tile");
  nodes.forEach(n => (n.style.transform = ""));
}

function applyRowTransform(rowIndex, dx) {
  const nodes = $board.querySelectorAll(`.tile[data-r="${rowIndex}"]`);
  nodes.forEach(n => (n.style.transform = `translateX(${dx}px)`));
}
function applyColTransform(colIndex, dy) {
  const nodes = $board.querySelectorAll(`.tile[data-c="${colIndex}"]`);
  nodes.forEach(n => (n.style.transform = `translateY(${dy}px)`));
}

async function attemptSwap(a, b) {
  state.busy = true;
  swapTiles(a, b);
  renderBoard();

  const matches = findAllMatches(state.board);
  if (matches.length === 0) {
    swapTiles(a, b);
    renderBoard();
    state.busy = false;
    return;
  }

  state.moves += 1;
  state.combo = 0;
  state.lastMove = { type: "swap", a, b };
  updateHUD();

  await resolveMatchesLoop();
  state.busy = false;
}

function swapTiles(a, b) {
  const tmp = state.board[a.r][a.c];
  state.board[a.r][a.c] = state.board[b.r][b.c];
  state.board[b.r][b.c] = tmp;
}

async function resolveMatchesLoop() {
  let chain = 0;

  while (true) {
    const matches = findAllMatches(state.board);
    if (matches.length === 0) break;

    chain += 1;
    state.combo = chain;

    // Create boosters only from the player's direct move (first chain)
    const createdBoosters = [];
    if (chain === 1 && state.lastMove) {
      createdBoosters.push(...createBoostersFromPlayerMove(matches, state.lastMove));
      // after using it once
      state.lastMove = null;
    }

    // Base removals: all matched cells
    const toRemove = new Set();
    const boosterQueue = [];
    const processedBoosters = new Set();

    for (const m of matches) {
      for (const cell of m.cells) {
        const key = cell.r + "," + cell.c;
        toRemove.add(key);

        const t = state.board[cell.r][cell.c];
        if (t && (t.key === "cola" || t.key === "fries")) {
          boosterQueue.push({ r: cell.r, c: cell.c, key: t.key });
        }
      }
    }

    // Keep the created booster cells on board (do not remove them now)
    for (const cb of createdBoosters) {
      const k = cb.r + "," + cb.c;
      toRemove.delete(k);
    }

    // Booster chain reactions:
    // - cola: clears 3x3 around itself (with splash)
    // - fries: clears whole row (with fries scatter)
    while (boosterQueue.length) {
      const b = boosterQueue.shift();
      const bId = b.r + "," + b.c + ":" + b.key;
      if (processedBoosters.has(bId)) continue;
      processedBoosters.add(bId);

      if (b.key === "cola") {
        spawnSplashAt(b.r, b.c);
        for (let rr = b.r - 1; rr <= b.r + 1; rr++) {
          for (let cc = b.c - 1; cc <= b.c + 1; cc++) {
            if (rr < 0 || rr >= CFG.rows || cc < 0 || cc >= CFG.cols) continue;
            const k = rr + "," + cc;
            if (!toRemove.has(k)) {
              toRemove.add(k);
              const t2 = state.board[rr][cc];
              if (t2 && (t2.key === "cola" || t2.key === "fries")) {
                boosterQueue.push({ r: rr, c: cc, key: t2.key });
              }
            }
          }
        }
      } else if (b.key === "fries") {
        spawnFriesAt(b.r, b.c);
        for (let cc = 0; cc < CFG.cols; cc++) {
          const k = b.r + "," + cc;
          if (!toRemove.has(k)) {
            toRemove.add(k);
            const t2 = state.board[b.r][cc];
            if (t2 && (t2.key === "cola" || t2.key === "fries")) {
              boosterQueue.push({ r: b.r, c: cc, key: t2.key });
            }
          }
        }
      }
    }

    // Make sure created boosters are not removed even after chain effects
    for (const cb of createdBoosters) {
      const k = cb.r + "," + cb.c;
      toRemove.delete(k);
    }

    const removedCount = toRemove.size;
    state.score += removedCount * 10 * chain;
    state.coins += Math.floor(removedCount / 3);

    markRemoving(toRemove);
    await sleep(160);

    for (const key of toRemove) {
      const [r, c] = key.split(",").map(Number);
      state.board[r][c] = null;
    }

    collapseBoard(state.board);
    fillBoard(state.board);

    renderBoard();
    updateHUD();

    if (!CFG.allowCascades) break;
    await sleep(90);
  }
}

function markRemoving(toRemove) {
  const nodes = $board.querySelectorAll(".tile");
  for (const el of nodes) {
    const r = el.dataset.r;
    const c = el.dataset.c;
    if (toRemove.has(r + "," + c)) el.classList.add("removing");
  }
}

function collapseBoard(board) {
  for (let c = 0; c < CFG.cols; c++) {
    let writeRow = CFG.rows - 1;
    for (let r = CFG.rows - 1; r >= 0; r--) {
      const t = board[r][c];
      if (t) {
        board[writeRow][c] = t;
        if (writeRow !== r) board[r][c] = null;
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) board[r][c] = null;
  }
}

function fillBoard(board) {
  for (let r = 0; r < CFG.rows; r++) {
    for (let c = 0; c < CFG.cols; c++) {
      if (board[r][c] === null) board[r][c] = randTile();
    }
  }
}


function createBoostersFromPlayerMove(matches, lastMove) {
  // Rules:
  // - 4 in a straight line -> FRIES
  // - 5+ in a straight line -> COLA
  // - T/L shapes (intersection) -> COLA at intersection
  //
  // lastMove:
  // - swap: {type:"swap", a, b}
  // - shift: {type:"shift", axis, index, delta, anchor}

  const cellKey = (r,c) => r + "," + c;

  // Intersection detection
  const hitCount = new Map();
  for (const run of matches) {
    for (const cell of run.cells) {
      const k = cellKey(cell.r, cell.c);
      hitCount.set(k, (hitCount.get(k) || 0) + 1);
    }
  }

  const created = [];

  const preferred = [];
  if (lastMove.type === "swap") preferred.push(lastMove.b, lastMove.a);
  if (lastMove.type === "shift") preferred.push(lastMove.anchor);

  // Best intersection (closest to preferred)
  let bestIntersection = null;
  let bestScore = Infinity;
  for (const [k, cnt] of hitCount.entries()) {
    if (cnt < 2) continue;
    const [r,c] = k.split(",").map(Number);
    const score = minDist({r,c}, preferred);
    if (score < bestScore) { bestScore = score; bestIntersection = { r, c }; }
  }

  if (bestIntersection) {
    state.board[bestIntersection.r][bestIntersection.c] = makeBooster("cola");
    created.push(bestIntersection);
    return created;
  }

  // Straight runs >= 4
  const candidateRuns = matches
    .filter(run => run.cells.length >= 4)
    .sort((x,y) => y.cells.length - x.cells.length);

  for (const run of candidateRuns) {
    if (lastMove.type === "swap") {
      const a = lastMove.a, b = lastMove.b;
      const containsA = run.cells.some(c => c.r === a.r && c.c === a.c);
      const containsB = run.cells.some(c => c.r === b.r && c.c === b.c);
      if (!containsA && !containsB) continue;

      const boosterKey = (run.cells.length >= 5) ? "cola" : "fries";
      const pos = pickBoosterPositionSwap(run, a, b);
      state.board[pos.r][pos.c] = makeBooster(boosterKey);
      created.push(pos);
      break;
    } else if (lastMove.type === "shift") {
      const axis = lastMove.axis;
      const idx = lastMove.index;

      const touchesLine = run.cells.some(c => (axis === "row") ? (c.r === idx) : (c.c === idx));
      if (!touchesLine) continue;

      const boosterKey = (run.cells.length >= 5) ? "cola" : "fries";
      const pos = pickBoosterPositionShift(run, lastMove.anchor);
      state.board[pos.r][pos.c] = makeBooster(boosterKey);
      created.push(pos);
      break;
    }
  }

  return created;
}

function minDist(p, arr) {
  if (!arr || arr.length === 0) return 9999;
  let best = 9999;
  for (const a of arr) {
    if (!a) continue;
    const d = Math.abs(p.r - a.r) + Math.abs(p.c - a.c);
    if (d < best) best = d;
  }
  return best;
}

function pickBoosterPositionSwap(run, a, b) {
  const inRun = (p) => run.cells.some(c => c.r === p.r && c.c === p.c);
  if (inRun(b)) return { r: b.r, c: b.c };
  if (inRun(a)) return { r: a.r, c: a.c };
  const mid = run.cells[Math.floor(run.cells.length / 2)];
  return { r: mid.r, c: mid.c };
}

function pickBoosterPositionShift(run, anchor) {
  let best = run.cells[0];
  let bestD = 9999;
  for (const c of run.cells) {
    const d = Math.abs(c.r - anchor.r) + Math.abs(c.c - anchor.c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { r: best.r, c: best.c };
}

function findAllMatches(board) {
  const matches = [];

  // Horizontal
  for (let r = 0; r < CFG.rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= CFG.cols; c++) {
      const prev = board[r][c-1];
      const cur = c < CFG.cols ? board[r][c] : null;
      const same = prev && cur && prev.key === cur.key;

      if (!same) {
        const runLen = c - runStart;
        if (runLen >= 3 && prev) {
          const cells = [];
          for (let k = runStart; k < c; k++) cells.push({ r, c: k });
          matches.push({ dir: "h", key: prev.key, cells });
        }
        runStart = c;
      }
    }
  }

  // Vertical
  for (let c = 0; c < CFG.cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= CFG.rows; r++) {
      const prev = board[r-1][c];
      const cur = r < CFG.rows ? board[r][c] : null;
      const same = prev && cur && prev.key === cur.key;

      if (!same) {
        const runLen = r - runStart;
        if (runLen >= 3 && prev) {
          const cells = [];
          for (let k = runStart; k < r; k++) cells.push({ r: k, c });
          matches.push({ dir: "v", key: prev.key, cells });
        }
        runStart = r;
      }
    }
  }

  return matches;
}


function spawnSplashAt(r, c) {
  const pos = tileCenterPx(r, c);
  if (!pos) return;
  const el = document.createElement("div");
  el.className = "fx fx-splash";
  el.style.left = pos.x + "px";
  el.style.top = pos.y + "px";

  // droplets
  for (let i = 0; i < 6; i++) {
    const d = document.createElement("span");
    d.className = "drop";
    const ang = (Math.PI * 2) * (i / 6);
    const dist = 34 + Math.random() * 22;
    d.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    d.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    d.style.setProperty("--rot", (Math.random() * 120 - 60) + "deg");
    d.style.width = (6 + Math.random() * 6) + "px";
    d.style.height = d.style.width;
    el.appendChild(d);
  }

  $fxLayer.appendChild(el);
  cleanupFx(el, 520);
}

function spawnFriesAt(r, c) {
  const pos = tileCenterPx(r, c);
  if (!pos) return;
  const el = document.createElement("div");
  el.className = "fx fx-fries";
  el.style.left = pos.x + "px";
  el.style.top = pos.y + "px";

  for (let i = 0; i < 10; i++) {
    const s = document.createElement("span");
    s.className = "crumb";
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    s.style.setProperty("--rot", (Math.random() * 360) + "deg");
    s.style.width = (10 + Math.random() * 8) + "px";
    s.style.height = (4 + Math.random() * 3) + "px";
    el.appendChild(s);
  }

  $fxLayer.appendChild(el);
  cleanupFx(el, 520);
}

function cleanupFx(el, ms) {
  window.setTimeout(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }, ms);
}

function tileCenterPx(r, c) {
  // compute center relative to fx layer
  const tileEl = $board.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!tileEl) return null;
  const tileRect = tileEl.getBoundingClientRect();
  const layerRect = $fxLayer.getBoundingClientRect();
  return {
    x: (tileRect.left + tileRect.width / 2) - layerRect.left,
    y: (tileRect.top + tileRect.height / 2) - layerRect.top
  };
}

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }


function setPreloaderProgress(pct) {
  const fill = document.getElementById("preloaderFill");
  const pctEl = document.getElementById("preloaderPct");
  if (fill) fill.style.width = pct + "%";
  if (pctEl) pctEl.textContent = String(Math.round(pct));
}

function hidePreloader() {
  const p = document.getElementById("preloader");
  if (p) p.classList.add("hidden");
}

function listAssetUrlsToPreload() {
  const urls = new Set();

  // Optional background (Variant A). If file doesn't exist, onerror is fine.
  urls.add("assets/bg.webp");
  urls.add("assets/bg.jpg");
  urls.add("assets/bg.png");

  // Tile images (base + boosters)
  if (TILESET.baseTiles) {
    TILESET.baseTiles.forEach(t => t.img && urls.add(t.img));
  } else if (TILESET.tiles) {
    TILESET.tiles.forEach(t => t.img && urls.add(t.img));
  }
  if (TILESET.boosters) {
    Object.values(TILESET.boosters).forEach(t => t.img && urls.add(t.img));
  }

  // Optional UI/extra assets (safe to ignore if not present)
  urls.add("assets/tile-bg.png");
  urls.add("assets/tile-bg.webp");

  return Array.from(urls);
}

function preloadImages(urls) {
  return new Promise((resolve) => {
    if (!urls || urls.length === 0) {
      setPreloaderProgress(100);
      resolve();
      return;
    }

    let loaded = 0;
    const total = urls.length;

    const doneOne = () => {
      loaded += 1;
      const pct = (loaded / total) * 100;
      setPreloaderProgress(pct);
      if (loaded >= total) resolve();
    };

    // Small trick: if an asset is missing, we still count it as "done"
    urls.forEach((url) => {
      const img = new Image();
      img.onload = doneOne;
      img.onerror = doneOne;
      img.src = url;
    });
  });
}

async function startWithPreloader() {
  setPreloaderProgress(0);
  const urls = listAssetUrlsToPreload();

  // Show quick progress even on fast loads
  setPreloaderProgress(8);

  await preloadImages(urls);

  // Small delay for nicer feel
  await sleep(120);
  hidePreloader();

  newGame();
}

// UI
$playAgain.addEventListener("click", () => newGame());

$homeBtn.addEventListener("click", () => {
  hideOverlay();
  window.scrollTo({ top: 0, behavior: "smooth" });
  newGame();
});
$resetBtn.addEventListener("click", () => newGame());

document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    if (state.timeLeft <= 0) return;
    state.timeLeft += Number(btn.dataset.addtime || 0);
    updateHUD();
  });
});


document.addEventListener("DOMContentLoaded", () => {
  startWithPreloader();
});

