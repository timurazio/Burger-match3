const CFG = {
  rows: 6,
  cols: 6,
  // 2 минуты 20 секунд
  timeSeconds: 140,
  allowCascades: true
};

const TILESET = {
  useImages: true,

  // BASE_TILES — обычные плитки, они выпадают случайно
  baseTiles: [
    { key: "burger",   emoji: "🍔", img: "assets/burger.png"   },
    { key: "brownie",  emoji: "🍫", img: "assets/brownie.png"  },
    { key: "chicken",  emoji: "🍗", img: "assets/nuggets.png"  },
    { key: "roll",     emoji: "🌯", img: "assets/roll.png"     },
    { key: "fries",    emoji: "🍟", img: "assets/fries.png"    },
    { key: "sauce",    emoji: "🥫", img: "assets/sauce.png"   },
  ],

  // BOOSTERS — создаются из матчей игрока
  boosters: {
    cola: { key: "cola",  emoji: "🥤", img: "assets/cola.png"  }, // 3 колы взрывают соседние клетки 3×3
  }


// Booster pulse sync: keep all cola boosters pulsing in the same phase (iOS Safari looks cleaner too).
const BOOSTER_PULSE_MS = 1050; // must match CSS duration: 1.05s
let boosterPulseStartTS = null;

function syncBoosterPulse(el) {
  if (boosterPulseStartTS === null) boosterPulseStartTS = performance.now();
  const now = performance.now();
  const phase = (now - boosterPulseStartTS) % BOOSTER_PULSE_MS;
  // Negative delay jumps the animation forward to the correct phase.
  el.style.setProperty("--pulse-delay", `${-phase}ms`);
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
let tileEls = null; // 2D array of tile DOM nodes, created once to avoid flicker

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
    removingSet: null,
    drag: null
  };

  fitTileSize();
  ensureBoardDOM();
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
  const list = TILESET.baseTiles;
  const t = list[Math.floor(Math.random() * list.length)];
  return { ...t };
}

function makeBooster(key) {
  const b = TILESET.boosters[key];
  if (!b) throw new Error("Unknown booster: " + key);
  // Clone to avoid shared references
  return { ...b, booster: true };
}

function ensureBoardDOM() {
  const needsRebuild = !tileEls || tileEls.length !== CFG.rows || tileEls[0]?.length !== CFG.cols;
  if (!needsRebuild) return;

  tileEls = Array.from({ length: CFG.rows }, () => Array(CFG.cols).fill(null));
  const frag = document.createDocumentFragment();

  for (let r = 0; r < CFG.rows; r++) {
    for (let c = 0; c < CFG.cols; c++) {
      const el = document.createElement("div");
      el.className = "tile";
      el.dataset.r = String(r);
      el.dataset.c = String(c);

      // Attach listeners once (no rebind on every render)
      el.addEventListener("pointerdown", onTilePointerDown);
      el.addEventListener("pointermove", onTilePointerMove);
      el.addEventListener("pointerup", onTilePointerUp);
      el.addEventListener("pointercancel", onTilePointerCancel);

      tileEls[r][c] = el;
      frag.appendChild(el);
    }
  }

  // Replace once. Subsequent renders only update styles (prevents flicker).
  $board.replaceChildren(frag);
}

function applyTileVisual(el, tile) {
  if (!tile) {
    el.dataset.key = "";
    el.style.setProperty("--tile-bg", "none");
    el.textContent = "";
    return;
  }

  // Always keep dataset key in sync (cells are fixed; tiles move between cells).
  el.dataset.key = tile.key;

  if (TILESET.useImages) {
    el.style.setProperty("--tile-bg", `url('${tile.img}')`);
    el.textContent = "";
  } else {
    el.style.setProperty("--tile-bg", "none");
    el.textContent = tile.emoji;
  }
}

function renderBoard() {
  ensureBoardDOM();

  for (let r = 0; r < CFG.rows; r++) {
    for (let c = 0; c < CFG.cols; c++) {
      const el = tileEls[r][c];
      const tile = state.board[r][c];

      // Keep removing class strictly tied to the current removing set.
      if (state.removingSet && state.removingSet.has(r + "," + c)) {
        el.classList.add("removing");
      } else {
        el.classList.remove("removing");
        // Safety: if a previous pop animation left computed styles, reset.
        el.style.animation = "";
        el.style.transform = "";
        el.style.opacity = "";
      }

      applyTileVisual(el, tile);

      // Cola is a booster tile: add a subtle pulse so it's readable as a special tile.
      const isBooster = Boolean(tile && tile.key === "cola");
      if (isBooster) {
        // Only set the offset when the booster first appears in this cell.
        if (!el.classList.contains("booster")) syncBoosterPulse(el);
        el.classList.add("booster");
      } else {
        if (el.classList.contains("booster")) {
          el.classList.remove("booster");
          el.style.removeProperty("--pulse-delay");
        }
      }

      const isSel = state.selected && state.selected.r === r && state.selected.c === c;
      el.classList.toggle("selected", Boolean(isSel));
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

    const step = getTileStepPx();
  const maxShift = step * 0.95;
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

  if (!axis) {
    clearLineTransforms();
    state.drag = null;
    return;
  }

  const step = getTileStepPx();
  const threshold = step * 0.20; // 20%

  let delta = 0;
  if (axis === "row") {
    if (Math.abs(lastDx) >= threshold) delta = lastDx > 0 ? +1 : -1;
  } else {
    if (Math.abs(lastDy) >= threshold) delta = lastDy > 0 ? +1 : -1;
  }

  // Snap animation (easing) to the nearest cell, then commit the shift.
  (async () => {
    const index = axis === "row" ? startR : startC;

    // Animate line to 0 (cancel) or ±1 step (commit)
    const target = delta === 0 ? 0 : (delta * step);

    const nodes = Array.from($board.querySelectorAll(
      axis === "row" ? `.tile[data-r="${index}"]` : `.tile[data-c="${index}"]`
    ));

    nodes.forEach(n => {
      n.style.transition = "transform 140ms cubic-bezier(.2,.8,.2,1)";
    });

    if (axis === "row") applyRowTransform(index, target);
    else applyColTransform(index, target);

    await sleep(150);

    nodes.forEach(n => (n.style.transition = ""));

    // Commit shift BEFORE clearing transforms to avoid a one-frame "jump" flicker.
    if (delta !== 0) {
      applyLineShift(axis, index, delta);
      renderBoard();
    }

    clearLineTransforms();

    if (delta !== 0) {
      await attemptLineShift(axis, index, delta, { r: startR, c: startC }, true);
    }

    state.drag = null;
  })();
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

async function attemptLineShift(axis, index, delta, anchor, alreadyShifted = false) {
  // axis: "row" or "col"
  // index: row index or col index
  // delta: +1 or -1 (cyclic shift by ONE tile)
  state.busy = true;

  if (!alreadyShifted) {
    applyLineShift(axis, index, delta);
    renderBoard();
  }

  // Count the move even if it doesn't create matches (line stays shifted now)
  state.moves += 1;
  state.combo = 0;
  state.lastMove = { type: "shift", axis, index, delta, anchor };
  updateHUD();

  const matches = findAllMatches(state.board);
  if (matches.length === 0) {
    state.busy = false;
    return;
  }

  try {
    await resolveMatchesLoop();
  } finally {
    state.busy = false;
  }
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

function getGapPx() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--gap").trim();
  const n = Number(v.replace("px",""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function getTileStepPx() {
  return getTileSizePx() + getGapPx();
}


function clearLineTransforms() {
  const nodes = $board.querySelectorAll(".tile");
  nodes.forEach(n => (n.style.transform = ""));
}

function applyRowTransform(rowIndex, dx) {
  const nodes = Array.from($board.querySelectorAll(`.tile[data-r="${rowIndex}"]`));
  const step = getTileStepPx();
  const span = CFG.cols * step;

  nodes.forEach(n => {
    const c = Number(n.dataset.c);
    let x = dx;

    // Wrap preview: dragging left shows the leftmost tile entering from the right;
    // dragging right shows the rightmost tile entering from the left.
    if (dx < 0 && c === 0) x = dx + span;
    if (dx > 0 && c === CFG.cols - 1) x = dx - span;

    n.style.transform = `translateX(${x}px)`;
  });
}
function applyColTransform(colIndex, dy) {
  const nodes = Array.from($board.querySelectorAll(`.tile[data-c="${colIndex}"]`));
  const step = getTileStepPx();
  const span = CFG.rows * step;

  nodes.forEach(n => {
    const r = Number(n.dataset.r);
    let y = dy;

    if (dy < 0 && r === 0) y = dy + span;
    if (dy > 0 && r === CFG.rows - 1) y = dy - span;

    n.style.transform = `translateY(${y}px)`;
  });
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

  try {
    await resolveMatchesLoop();
  } finally {
    state.busy = false;
  }
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

    for (const run of matches) {
      for (const cell of run.cells) {
        toRemove.add(cell.r + "," + cell.c);
      }
    }

    // Create booster(s) only from the player's direct move (first chain)
    // Keep created booster cells on board (do not remove them now)
    for (const cb of createdBoosters) {
      toRemove.delete(cb.r + "," + cb.c);
    }

    // Cola booster effect:
    // If a match includes "cola" tiles (3+ colas), each matched cola explodes its neighbors (3x3).
    for (const run of matches) {
      if (run.key !== "cola") continue;

      for (const cell of run.cells) {
        spawnSplashAt(cell.r, cell.c);

        for (let rr = cell.r - 1; rr <= cell.r + 1; rr++) {
          for (let cc = cell.c - 1; cc <= cell.c + 1; cc++) {
            if (rr < 0 || rr >= CFG.rows || cc < 0 || cc >= CFG.cols) continue;
            toRemove.add(rr + "," + cc);
          }
        }
      }
    }

    const removedCount = toRemove.size;
    state.score += removedCount * 10 * chain;
    state.coins += Math.floor(removedCount / 3);

    markRemoving(toRemove);
    await sleep(260);

    // Animation done — from here on we should stop treating these cells as "removing".
    // Otherwise a new tile of the same key may land in the same cell and keep the class,
    // making it look like tiles disappear and then reappear later.
    state.removingSet = null;
    // Hard cleanup: ensure no cell stays in 'removing' visual state.
    for (let rr = 0; rr < CFG.rows; rr++) {
      for (let cc = 0; cc < CFG.cols; cc++) {
        const el = tileEls?.[rr]?.[cc];
        if (!el) continue;
        el.classList.remove("removing");
        el.style.animation = "";
        el.style.transform = "";
        el.style.opacity = "";
      }
    }

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
  ensureBoardDOM();
  // Save the set so renderBoard can consistently apply/remove the class.
  state.removingSet = toRemove;
  for (let r = 0; r < CFG.rows; r++) {
    for (let c = 0; c < CFG.cols; c++) {
      if (toRemove.has(r + "," + c)) tileEls[r][c].classList.add("removing");
    }
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
  // One-booster rule:
  // - 4+ в прямой линии (затронуто ходом игрока) -> COLA booster
  //
  // lastMove:
  // - swap: {type:"swap", a, b}
  // - shift: {type:"shift", axis, index, delta, anchor}

  const created = [];

  for (const run of matches) {
    if (run.cells.length < 4) continue;

    if (lastMove.type === "swap") {
      const a = lastMove.a;
      const b = lastMove.b;

      const containsA = run.cells.some(c => c.r === a.r && c.c === a.c);
      const containsB = run.cells.some(c => c.r === b.r && c.c === b.c);
      if (!containsA && !containsB) continue;

      const pos = pickBoosterPositionSwap(run, a, b);
      state.board[pos.r][pos.c] = makeBooster("cola");
      created.push(pos);
      break;
    }

    if (lastMove.type === "shift") {
      const axis = lastMove.axis;
      const idx = lastMove.index;

      const touchesLine = run.cells.some(c => (axis === "row") ? (c.r === idx) : (c.c === idx));
      if (!touchesLine) continue;

      const pos = pickBoosterPositionShift(run, lastMove.anchor);
      state.board[pos.r][pos.c] = makeBooster("cola");
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
// Tile images (base + boosters)
  if (TILESET.baseTiles) {
    TILESET.baseTiles.forEach(t => t.img && urls.add(t.img));
  } else if (TILESET.baseTiles) {
    TILESET.baseTiles.forEach(t => t.img && urls.add(t.img));
  }
  if (TILESET.boosters) {
    Object.values(TILESET.boosters).forEach(t => t.img && urls.add(t.img));
  }return Array.from(urls);
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