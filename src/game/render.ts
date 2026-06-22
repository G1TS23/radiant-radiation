/**
 * render.ts — turn a GameState into DOM. No input handling, no game logic.
 *
 * Rendering is idempotent: call `render(root, state, view)` after every change.
 * The skeleton (title bar, board, HUD, key hints) is built once and then patched.
 *
 * Layout: cells live in `.grid` (auto-placed). The cursor/hint frames live in a
 * separate, absolutely positioned `.overlay` that mirrors the grid's template
 * and gap. Keeping the frames OUT of the cell grid is essential — an explicitly
 * placed grid item is positioned before auto-placed ones, which would otherwise
 * push the cells out of the block it covers. The overlay is `pointer-events:none`
 * so clicks fall through to the cells (mouse wiring lives in input.ts).
 */

import { index, isWin, isLost, DIFFICULTIES, type GameState, type Vertex } from "./engine";
import { t, getLocale } from "./i18n";
import type { GameRecord } from "./history";
import type { Stats } from "./stats";

export interface View {
  /** Free play vs. tutorial — drives the title bar and HUD copy. */
  mode: "free" | "tutorial";
  /** Difficulty label for the title bar (free play); null in tutorial. */
  difficulty?: string | null;
  /** Tutorial heading shown above the grid. */
  title?: string | null;
  /** Instruction / status line (tutorial prompt, or a free-play hint). */
  message?: string;
  /** Recommended move to highlight, if any. */
  hint?: Vertex | null;
  /** Tutorial progress, e.g., step 1 of 2. */
  step?: { current: number; total: number };
  /** 2x2 to briefly flash after a move (touch feedback). */
  flash?: Vertex | null;
  /** Contextual primary button (next / retry / continue), shown when relevant. */
  cta?: { label: string; action: string; loading?: boolean } | null;
  /** Current win streak to surface for momentum; null hides the line. */
  streak?: { count: number; pulse: boolean } | null;
}

const PAD = (n: number): string => String(n).padStart(3, "0");

/** Escape free text before interpolating into innerHTML (text or attribute). */
const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Build the static skeleton once; later calls reuse it. */
function ensureSkeleton(root: HTMLElement): void {
  if (root.querySelector(".board")) return;
  root.classList.add("cli");
  root.innerHTML = `
    <p class="sr-only" role="status" aria-live="polite"></p>
    <header class="bar">
      <span class="bar-title" data-i18n="app.title">radiant-radiation</span>
      <span class="bar-right">
        <span class="bar-meta"></span>
        <button class="bar-lang" data-action="lang" data-i18n-aria="aria.lang">EN</button>
        <button class="bar-theme" data-action="theme" data-i18n-aria="aria.theme"><svg class="ic" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"></path></svg></button>
        <button class="bar-zen" data-action="zen" data-i18n-aria="aria.zen" data-i18n-title="title.zen">⛶</button>
      </span>
    </header>
    <section class="tut-text">
      <p class="tut-title"></p>
      <p class="tut-body"></p>
      <p class="tut-keys" data-i18n="tut.tip"></p>
      <button class="tut-skip" data-action="skip" data-i18n="tut.skip"></button>
    </section>
    <div class="board">
      <div class="grid" role="grid" aria-label="puzzle grid"></div>
      <div class="overlay" aria-hidden="true">
        <div class="cursor-box"></div>
        <div class="hint-box"></div>
      </div>
      <button class="cta" data-action="next"></button>
    </div>
    <div class="hud">
      <span class="hud-moves"></span>
      <span class="hud-par"></span>
      <span class="hud-status"></span>
      <span class="hud-streak" aria-live="polite"></span>
    </div>
    <nav class="toolbar" aria-label="controls">
      <button data-action="undo" data-i18n="action.undo"></button>
      <button data-action="reset" data-i18n="action.reset"></button>
      <button class="free-only" data-action="new" data-i18n="action.new"></button>
      <button class="free-only" data-action="diff"></button>
      <button class="tut-only" data-action="skip" data-i18n="action.skip"></button>
    </nav>
    <button class="hist-trigger" data-action="hist" data-i18n="action.historyStats"></button>
    `;
}

/** Rebuild the cell nodes when the grid size changes. */
function buildCells(board: HTMLElement, grid: HTMLElement, N: number): void {
  board.style.setProperty("--n", String(N));
  const frag = document.createDocumentFragment();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      frag.appendChild(cell);
    }
  }
  grid.replaceChildren(frag);
}

/** Place an overlay box over the 2x2 block anchored at vertex (i, j). */
function placeOverlay(box: HTMLElement | null, v: Vertex | null | undefined): void {
  if (!box) return;
  if (!v) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";
  box.style.gridColumn = `${v.i + 1} / span 2`;
  box.style.gridRow = `${v.j + 1} / span 2`;
}

// Helpers extracted from `render` to reduce cognitive complexity.
function updateCells(
  grid: HTMLElement,
  N: number,
  cellsArr: boolean[],
  flash: Vertex | null,
): void {
  const f = flash ?? null;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = index(N, x, y);
      const cell = grid.children[i] as HTMLElement;
      cell.classList.toggle("on", cellsArr[i]);
      const inFlash = !!f && (x === f.i || x === f.i + 1) && (y === f.j || y === f.j + 1);
      cell.classList.toggle("flash", inFlash);
    }
  }
  // Flip-point markers (touch): color each quadrant with the INVERSE of the
  // cell under it — a live preview of what tapping this intersection produces.
  const inv = (x: number, y: number): string =>
    cellsArr[index(N, x, y)] ? "var(--cell-off)" : "var(--cell-on)";
  for (let y = 1; y < N; y++) {
    for (let x = 1; x < N; x++) {
      const m = grid.children[index(N, x, y)] as HTMLElement;
      m.style.setProperty("--m-tl", inv(x - 1, y - 1));
      m.style.setProperty("--m-tr", inv(x, y - 1));
      m.style.setProperty("--m-bl", inv(x - 1, y));
      m.style.setProperty("--m-br", inv(x, y));
    }
  }
}

function updateOverlays(
  overlay: HTMLElement,
  cursor: Vertex,
  hint: Vertex | null | undefined,
): void {
  placeOverlay(overlay.querySelector<HTMLElement>(".cursor-box"), cursor);
  placeOverlay(overlay.querySelector<HTMLElement>(".hint-box"), hint ?? null);
}

function updateBarMeta(root: HTMLElement, state: GameState, view: View): void {
  const size = `${state.N}×${state.N}`;
  const metaEl = root.querySelector(".bar-meta")!;
  if (view.mode === "tutorial" && view.step) {
    metaEl.textContent = t("bar.tutorial", { current: view.step.current, total: view.step.total });
  } else if (view.difficulty) {
    // Desktop shows "difficulty · NxN"; the label + separator are hidden on touch
    // (CSS) so the bar stays on one line on narrow screens.
    metaEl.innerHTML =
      `<span class="bar-diff">${esc(view.difficulty)}</span>` +
      `<span class="bar-sep"> · </span>${esc(size)}`;
  } else {
    metaEl.textContent = size;
  }
  root.querySelector(".bar-lang")!.textContent = getLocale().toUpperCase();
}

function updateHUD(root: HTMLElement, state: GameState): void {
  root.querySelector(".hud-moves")!.textContent =
    `${t("hud.moves")} ${PAD(state.moves)}` +
    (state.limit === null ? "" : ` / ${PAD(state.limit)}`);
  root.querySelector(".hud-par")!.textContent =
    state.par === null ? "" : `${t("hud.par")} ${PAD(state.par)}`;
}

function updateStatusAndClasses(
  root: HTMLElement,
  state: GameState,
  grid: HTMLElement,
  tutorial: boolean,
): void {
  const won = isWin(state);
  const lost = isLost(state);

  // On a win, melt the grid lines into the winning color so the board becomes
  // one solid surface — but keep the border as a frame around it.
  const winColor = state.cells[0] ? "var(--cell-on)" : "var(--cell-off)";
  grid.style.backgroundColor = won ? winColor : "";

  if (won) {
    const ox = state.cursor.i + 0.5;
    const oy = state.cursor.j + 0.5;
    for (let y = 0; y < state.N; y++) {
      for (let x = 0; x < state.N; x++) {
        const cell = grid.children[index(state.N, x, y)] as HTMLElement;
        cell.style.setProperty("--wd", `${Math.round(Math.hypot(x - ox, y - oy) * 40)}ms`);
      }
    }
  }

  let status = "";
  if (won) status = t("status.solved");
  else if (lost) status = t("status.lost");

  root.querySelector(".hud-status")!.textContent = status;
  root.classList.toggle("won", won);
  root.classList.toggle("lost", lost);
  root.classList.toggle("tutorial", tutorial);
  // Mirror onto the layout so the (sibling) history panel can hide in tutorial.
  root.parentElement?.classList.toggle("tutorial", tutorial);
}

function updateTutorialAndMessage(root: HTMLElement, view: View): void {
  const tutorial = view.mode === "tutorial";
  root.querySelector(".tut-title")!.textContent = view.title ?? "";
  root.querySelector(".tut-body")!.textContent = tutorial ? (view.message ?? "") : "";
}

function updateToolbarDiff(root: HTMLElement, view: View): void {
  root.querySelector('[data-action="diff"]')!.textContent = view.difficulty
    ? t("toolbar.diff", { label: view.difficulty })
    : t("action.difficulty");
}

const PAD2 = (n: number): string => String(n).padStart(2, "0");
const STREAK_MARKS_CAP = 10; // marks stop growing past this; the count still climbs

/**
 * The win-streak momentum line. Rebuilt only when the count (or visibility)
 * changes, so the per-move flash re-render can't re-trigger the pulse — the new
 * mark animates exactly once, when the streak actually grows.
 */
function updateStreak(root: HTMLElement, view: View): void {
  const el = root.querySelector<HTMLElement>(".hud-streak")!;
  const s = view.streak ?? null;
  const key = s ? String(s.count) : "";
  if (el.dataset.key === key) return; // unchanged — leave the DOM (and animation) be
  el.dataset.key = key;
  if (!s) {
    el.classList.remove("show");
    el.replaceChildren();
    return;
  }
  const shown = Math.min(s.count, STREAK_MARKS_CAP);
  let marks = "";
  for (let i = 0; i < shown; i++) {
    const last = i === shown - 1;
    marks += `<span class="mark${last && s.pulse ? " pulse" : ""}">▮</span>`;
  }
  el.innerHTML =
    `<span class="streak-label">${esc(t("stats.streak"))}</span>` +
    `<span class="streak-marks" aria-hidden="true">${marks}</span>` +
    `<span class="streak-n">${PAD2(s.count)}</span>`;
  el.classList.add("show");
}

function updateCTA(root: HTMLElement, view: View): void {
  const cta = root.querySelector<HTMLButtonElement>(".cta")!;
  if (view.cta) {
    cta.textContent = view.cta.label;
    cta.dataset.action = view.cta.action;
    cta.classList.add("show");
    cta.classList.toggle("loading", !!view.cta.loading);
  } else {
    cta.classList.remove("show", "loading");
  }
}

/** Render the full UI for the given state. Safe to call on every change. */
export function render(root: HTMLElement, state: GameState, view: View): void {
  ensureSkeleton(root);

  const board = root.querySelector<HTMLElement>(".board")!;
  const grid = root.querySelector<HTMLElement>(".grid")!;
  const overlay = root.querySelector<HTMLElement>(".overlay")!;

  if (grid.children.length !== state.N * state.N) buildCells(board, grid, state.N);

  // Cells + flash
  updateCells(grid, state.N, state.cells, view.flash ?? null);

  // Cursor + hint overlays
  updateOverlays(overlay, state.cursor, view.hint ?? null);

  // Title bar meta and HUD
  updateBarMeta(root, state, view);
  updateHUD(root, state);

  // Status, classes and win animation delays
  const tutorial = view.mode === "tutorial";
  updateStatusAndClasses(root, state, grid, tutorial);

  // Tutorial text + message line
  updateTutorialAndMessage(root, view);

  // Toolbar difficulty label
  updateToolbarDiff(root, view);

  // Contextual CTA
  updateCTA(root, view);

  // Win-streak momentum line
  updateStreak(root, view);
}

/** Format a duration in ms as M:SS, or H:MM:SS past an hour. Locale-neutral. */
function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Lifetime stats block shown at the top of the history panel (when non-empty). */
function renderStats(s: Stats): string {
  const winRate = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
  const avgMoves = s.won > 0 ? (s.movesWon / s.won).toFixed(1) : "–";
  const bestTime = s.bestSolveMs === null ? "–" : fmtDuration(s.bestSolveMs);
  const item = (k: string, v: string): string =>
    `<div class="stat"><span class="stat-k">${esc(t(k))}</span>` +
    `<span class="stat-v">${esc(v)}</span></div>`;
  return (
    `<section class="stats" aria-label="${esc(t("stats.title"))}">` +
    item("stats.played", String(s.played)) +
    item("stats.won", `${s.won} · ${winRate}%`) +
    item("stats.streak", String(s.curStreak)) +
    item("stats.bestStreak", String(s.bestStreak)) +
    item("stats.avgMoves", String(avgMoves)) +
    item("stats.atPar", String(s.atParWins)) +
    item("stats.time", fmtDuration(s.totalPlayMs)) +
    item("stats.bestTime", bestTime) +
    `<button class="stats-clear" type="button">${esc(t("stats.clear"))}</button>` +
    `</section>`
  );
}

/**
 * Render the side history panel. The head doubles as an accordion toggle on
 * touch (it carries a chevron); the body collapses there. Rows carry data-index
 * for replay wiring. Lifetime stats sit between the head and the list, so they
 * stay put while the list scrolls and survive an empty (cleared) history.
 */
export function renderHistory(panel: HTMLElement, entries: GameRecord[], stats: Stats): void {
  // Two labels, swapped by CSS: desktop shows "history" (the stats block is
  // visibly labelled beside it); touch shows "history & stats" since the panel
  // is a collapsed sheet where the stats aren't visible until it's opened.
  const head =
    `<button class="hist-head" type="button" aria-label="${esc(t("aria.history"))}">` +
    `<span class="head-history">${esc(t("action.history"))}</span>` +
    `<span class="head-history-stats">${esc(t("action.historyStats"))}</span>` +
    `<span class="hist-chevron" aria-hidden="true"></span></button>`;
  const statsBlock = stats.played > 0 ? renderStats(stats) : "";

  if (entries.length === 0) {
    panel.innerHTML =
      head +
      statsBlock +
      `<div class="hist-body"><p class="hist-empty">${esc(t("history.empty"))}</p></div>`;
    return;
  }

  const rows = entries
    .map((e, i) => {
      const icon = e.result === "won" ? "✓" : "✗";
      // Render the difficulty from its stored index, so old games re-localize.
      const id = DIFFICULTIES[e.diff]?.id ?? "normal";
      const diff = esc(t("difficulty." + id));
      const thumb =
        `<span class="hist-thumb" style="--n:${Number(e.N)}" aria-hidden="true">` +
        e.cells.map((c) => `<i${c ? ' class="on"' : ""}></i>`).join("") +
        `</span>`;
      const label = esc(
        t("aria.replay", {
          diff: t("difficulty." + id),
          result: t("result." + e.result),
          moves: Number(e.moves),
          limit: Number(e.limit),
        }),
      );
      return (
        `<li>` +
        `<button class="hist-row ${e.result}" type="button" data-index="${i}" aria-label="${label}">` +
        thumb +
        `<span class="hist-result">${icon}</span>` +
        `<span class="hist-diff">${diff}</span>` +
        `<span class="hist-moves">${Number(e.moves)}/${Number(e.limit)}</span>` +
        `<span class="hist-replay" aria-hidden="true">↻</span>` +
        `</button></li>`
      );
    })
    .join("");

  panel.innerHTML =
    head +
    statsBlock +
    `<div class="hist-body"><ul class="hist-list">${rows}</ul></div>` +
    `<button class="hist-clear">${esc(t("history.clear"))}</button>`;
}
