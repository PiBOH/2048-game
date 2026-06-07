/*!
 * Gioco 2048
 * Autore: PiBOH
 * Versione: 1.0.0d
 */
(function () {
  "use strict";

  const VERSION = "1.0.0d";
  const AUTHOR = "PiBOH";
  const SIZE = 4;
  const STORAGE_KEY = "gioco2048_best";

  // test4 OK
  let grid = [];          // matrice oggetti e tessere
  let score = 0;
  let best = 0;
  let tileIdCounter = 0;
  let won = false;
  let keepPlaying = false;
  let gameOver = false;
  let busy = false;

  // test 4 OK
  const tileContainer = document.getElementById("tile-container");
  const gridBg = document.getElementById("grid-bg");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("game-message");
  const messageText = document.getElementById("message-text");
  const newGameBtn = document.getElementById("new-game");
  const retryBtn = document.getElementById("retry");

  // sfondo griglia
  function buildBackground() {
    gridBg.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      gridBg.appendChild(cell);
    }
  }

  // Utilità griglia
  function emptyGrid() {
    const g = [];
    for (let r = 0; r < SIZE; r++) {
      g.push(new Array(SIZE).fill(null));
    }
    return g;
  }

  function getEmptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) cells.push({ r, c });
      }
    }
    return cells;
  }

  function createTile(r, c, value, isNew) {
    return {
      id: tileIdCounter++,
      r, c,
      value,
      isNew: !!isNew,
      merged: false,
      mergedFrom: null
    };
  }

  function addRandomTile() {
    const empty = getEmptyCells();
    if (empty.length === 0) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[r][c] = createTile(r, c, value, true);
  }

  // rendering tessere
  function getMetrics() {
    const root = getComputedStyle(document.documentElement);
    const gap = parseFloat(root.getPropertyValue("--gap")) || 14;
    const inner = tileContainer.clientWidth;
    const cell = (inner - (SIZE - 1) * gap) / SIZE;
    return { gap, cell };
  }

  function tilePosition(index, metrics) {
    return index * (metrics.cell + metrics.gap);
  }

  function classForValue(v) {
    return v <= 2048 ? "tile-" + v : "tile-super";
  }

  function render() {
    tileContainer.innerHTML = "";
    const m = getMetrics();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = grid[r][c];
        if (!t) continue;
        const el = document.createElement("div");
        el.className = "tile " + classForValue(t.value);
        if (t.isNew) el.classList.add("tile-new");
        if (t.merged) el.classList.add("tile-merged");
        el.textContent = t.value;
        // dimensioni reali calcolate in JS
        el.style.width = m.cell + "px";
        el.style.height = m.cell + "px";
        el.style.lineHeight = m.cell + "px";
        const x = tilePosition(c, m);
        const y = tilePosition(r, m);
        el.style.transform = "translate(" + x + "px," + y + "px)";
        tileContainer.appendChild(el);
        // azzera i flag dopo il render
        t.isNew = false;
        t.merged = false;
      }
    }
    scoreEl.textContent = score;
    bestEl.textContent = best;
  }

  function showScoreAddition(amount) {
    if (amount <= 0) return;
    const box = scoreEl.parentElement;
    const add = document.createElement("span");
    add.className = "score-add";
    add.textContent = "+" + amount;
    box.appendChild(add);
    setTimeout(() => add.remove(), 600);
  }

  // ---- Logica di movimento ----
  // direzione: 0=su, 1=destra, 2=giù, 3=sinistra
  function getTraversals(dir) {
    const rows = [];
    const cols = [];
    for (let i = 0; i < SIZE; i++) { rows.push(i); cols.push(i); }
    if (dir === 2) rows.reverse();    // giù: parti dal basso
    if (dir === 1) cols.reverse();    // destra: parti da destra
    return { rows, cols };
  }

  function vector(dir) {
    switch (dir) {
      case 0: return { dr: -1, dc: 0 };
      case 1: return { dr: 0, dc: 1 };
      case 2: return { dr: 1, dc: 0 };
      case 3: return { dr: 0, dc: -1 };
    }
  }

  function withinBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function findFarthest(r, c, vec) {
    let prev;
    let cur = { r, c };
    do {
      prev = cur;
      cur = { r: prev.r + vec.dr, c: prev.c + vec.dc };
    } while (withinBounds(cur.r, cur.c) && !grid[cur.r][cur.c]);
    return { farthest: prev, next: cur };
  }

  function move(dir) {
    if (busy || gameOver) return;
    const vec = vector(dir);
    const { rows, cols } = getTraversals(dir);
    let moved = false;
    let gained = 0;

    // reset flag merge
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c]) {
          grid[r][c].merged = false;
          grid[r][c].mergedFrom = null;
        }
      }
    }

    rows.forEach((r) => {
      cols.forEach((c) => {
        const tile = grid[r][c];
        if (!tile) return;
        const positions = findFarthest(r, c, vec);
        const next = positions.next;
        const nextTile = withinBounds(next.r, next.c) ? grid[next.r][next.c] : null;

        if (nextTile && nextTile.value === tile.value && !nextTile.merged) {
          // unisci
          const newValue = tile.value * 2;
          nextTile.value = newValue;
          nextTile.merged = true;
          grid[r][c] = null;
          gained += newValue;
          if (newValue === 2048 && !won) {
            won = true;
          }
          moved = true;
        } else {
          const far = positions.farthest;
          if (far.r !== r || far.c !== c) {
            grid[far.r][far.c] = tile;
            grid[r][c] = null;
            tile.r = far.r;
            tile.c = far.c;
            moved = true;
          }
        }
      });
    });

    if (moved) {
      score += gained;
      if (score > best) {
        best = score;
        saveBest();
      }
      showScoreAddition(gained);
      busy = true;
      // prima renderizza gli spostamenti, poi aggiungi nuova tessera
      render();
      setTimeout(() => {
        addRandomTile();
        render();
        busy = false;
        checkGameState();
      }, 130);
    }
  }

  function movesAvailable() {
    if (getEmptyCells().length > 0) return true;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c].value;
        if (c < SIZE - 1 && grid[r][c + 1].value === v) return true;
        if (r < SIZE - 1 && grid[r + 1][c].value === v) return true;
      }
    }
    return false;
  }

  function checkGameState() {
    if (won && !keepPlaying) {
      showMessage("Hai vinto!", true);
      return;
    }
    if (!movesAvailable()) {
      gameOver = true;
      showMessage("Game over!", false);
    }
  }

  function showMessage(text, isWin) {
    messageText.textContent = text;
    messageEl.classList.toggle("win", isWin);
    messageEl.classList.add("show");
    retryBtn.textContent = isWin ? "Continua" : "Riprova";
    retryBtn.dataset.action = isWin ? "continue" : "restart";
  }

  function hideMessage() {
    messageEl.classList.remove("show", "win");
  }

  // ---- Persistenza record ----
  function loadBest() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      best = v ? parseInt(v, 10) || 0 : 0;
    } catch (e) {
      best = 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(STORAGE_KEY, String(best));
    } catch (e) { /* ignora */ }
  }

  // ---- Nuova partita ----
  function newGame() {
    grid = emptyGrid();
    score = 0;
    won = false;
    keepPlaying = false;
    gameOver = false;
    busy = false;
    hideMessage();
    addRandomTile();
    addRandomTile();
    render();
  }

  // ---- Input tastiera ----
  const keyMap = {
    ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
    w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3
  };

  document.addEventListener("keydown", (e) => {
    if (e.key in keyMap) {
      e.preventDefault();
      move(keyMap[e.key]);
    }
  });

  // ---- Input touch (swipe) ----
  let touchStartX = 0, touchStartY = 0;
  const boardWrapper = document.querySelector(".board-wrapper");

  boardWrapper.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  boardWrapper.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 30) return; // troppo corto
    if (absX > absY) {
      move(dx > 0 ? 1 : 3);
    } else {
      move(dy > 0 ? 2 : 0);
    }
  }, { passive: true });

  // ---- Input mouse (trascina per muovere, come uno swipe) ----
  let mouseDown = false;
  let mouseStartX = 0, mouseStartY = 0;

  boardWrapper.addEventListener("mousedown", (e) => {
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
  });

  document.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 30) return; // trascinamento troppo corto
    if (absX > absY) {
      move(dx > 0 ? 1 : 3);
    } else {
      move(dy > 0 ? 2 : 0);
    }
  });

  // Evita la selezione del testo durante il trascinamento sul board
  boardWrapper.addEventListener("dragstart", (e) => e.preventDefault());

  // ---- Pulsanti ----
  newGameBtn.addEventListener("click", newGame);
  retryBtn.addEventListener("click", () => {
    if (retryBtn.dataset.action === "continue") {
      keepPlaying = true;
      hideMessage();
    } else {
      newGame();
    }
  });

  // Ricalcola posizioni al ridimensionamento (le tessere usano px)
  window.addEventListener("resize", () => {
    if (!busy) render();
  });

  // ---- Avvio ----
  buildBackground();
  loadBest();
  newGame();
})();
