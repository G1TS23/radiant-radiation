/**
 * render.ts — turn a GameState into DOM. No input handling, no game logic.
 *
 * Rendering is idempotent: call `render(root, state, view)` after every change.
 * The skeleton (title bar, board, HUD, key hints) is built once and then patched.
 *
 * Layout: cells live in `.grid` (auto-placed). The cursor/hint frames live in a
 * separate, absolutely-positioned `.overlay` that mirrors the grid's template
 * and gap. Keeping the frames OUT of the cell grid is essential — an explicitly
 * placed grid item is positioned before auto-placed ones, which would otherwise
 * push the cells out of the block it covers. The overlay is `pointer-events:none`
 * so clicks fall through to the cells (mouse wiring lives in input.ts).
 */

import { index, isWin, isLost, type GameState, type Vertex } from "./engine";
import type { GameRecord } from "./history";

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
  /** Tutorial progress, e.g. step 1 of 2. */
  step?: { current: number; total: number };
  /** 2x2 to briefly flash after a move (touch feedback). */
  flash?: Vertex | null;
  /** Contextual primary button (next / retry / continue), shown when relevant. */
  cta?: { label: string; action: string; loading?: boolean } | null;
}

const PAD = (n: number): string => String(n).padStart(3, "0");
const COLOR_NAME = (c: boolean): string => (c ? "black" : "white");

/** Escape free text before interpolating into innerHTML (text or attribute). */
const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Build the static skeleton once; subsequent calls reuse it. */
function ensureSkeleton(root: HTMLElement): void {
  if (root.querySelector(".board")) return;
  root.classList.add("cli");
  root.innerHTML = `
    <p class="sr-only" role="status" aria-live="polite"></p>
    <header class="bar">
      <span class="bar-title">radiant-radiation</span>
      <span class="bar-right">
        <span class="bar-meta"></span>
        <button class="bar-theme" data-action="theme" aria-label="toggle theme">◐</button>
      </span>
    </header>
    <section class="tut-text">
      <p class="tut-title"></p>
      <p class="tut-body"></p>
      <p class="tut-keys">tip: tap a square — or use arrow keys + space</p>
      <button class="tut-skip" data-action="skip">skip tutorial →</button>
    </section>
    <div class="board">
      <div class="grid" role="grid" aria-label="puzzle grid"></div>
      <div class="overlay" aria-hidden="true">
        <div class="cursor-box"></div>
        <div class="hint-box"></div>
      </div>
    </div>
    <div class="hud">
      <span class="hud-moves">moves: 000</span>
      <span class="hud-par"></span>
      <span class="hud-goal"></span>
      <span class="hud-status"></span>
    </div>
    <div class="message-row">
      <p class="message"></p>
      <button class="cta" data-action="next"></button>
    </div>
    <nav class="toolbar" aria-label="controls">
      <button data-action="undo">undo</button>
      <button data-action="reset">reset</button>
      <button class="free-only" data-action="new">new</button>
      <button class="free-only" data-action="diff">difficulty</button>
      <button class="tut-only" data-action="skip">skip</button>
    </nav>
    <button class="hist-trigger" data-action="hist">history</button>
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

/** Render the full UI for the given state. Safe to call on every change. */
export function render(root: HTMLElement, state: GameState, view: View): void {
  ensureSkeleton(root);

  const board = root.querySelector<HTMLElement>(".board")!;
  const grid = root.querySelector<HTMLElement>(".grid")!;
  const overlay = root.querySelector<HTMLElement>(".overlay")!;

  if (grid.children.length !== state.N * state.N) buildCells(board, grid, state.N);

  // Cell colors + flash on the just-flipped 2x2.
  const f = view.flash ?? null;
  for (let y = 0; y < state.N; y++) {
    for (let x = 0; x < state.N; x++) {
      const i = index(state.N, x, y);
      const cell = grid.children[i] as HTMLElement;
      cell.classList.toggle("on", state.cells[i]);
      const inFlash = !!f && (x === f.i || x === f.i + 1) && (y === f.j || y === f.j + 1);
      cell.classList.toggle("flash", inFlash);
    }
  }

  // Cursor + hint frames (in the overlay layer).
  placeOverlay(overlay.querySelector<HTMLElement>(".cursor-box"), state.cursor);
  placeOverlay(overlay.querySelector<HTMLElement>(".hint-box"), view.hint ?? null);

  // Title bar meta: difficulty + size, or tutorial progress.
  const size = `${state.N}×${state.N}`;
  const meta =
    view.mode === "tutorial" && view.step
      ? `tutorial ${view.step.current}/${view.step.total}`
      : view.difficulty
        ? `${view.difficulty} · ${size}`
        : size;
  root.querySelector(".bar-meta")!.textContent = meta;

  // HUD: moves (with limit), par, goal.
  root.querySelector(".hud-moves")!.textContent =
    `moves: ${PAD(state.moves)}` + (state.limit !== null ? ` / ${PAD(state.limit)}` : "");
  root.querySelector(".hud-par")!.textContent = state.par !== null ? `par: ${PAD(state.par)}` : "";
  root.querySelector(".hud-goal")!.textContent =
    state.targetColor === null
      ? "goal: single color"
      : `goal: all ${COLOR_NAME(state.targetColor)}`;

  // Status: win or out of moves.
  const won = isWin(state);
  const lost = isLost(state);

  // On a win, give each cell a wave delay based on its distance from the last
  // move (the centre of the cursor's 2x2) so the victory animation radiates out
  // from where the player solved it (see .cli.won .cell in the CSS).
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
  const status = won ? ">> solved" : lost ? ">> out of moves" : "";
  root.querySelector(".hud-status")!.textContent = status;
  const tutorial = view.mode === "tutorial";
  root.classList.toggle("won", won);
  root.classList.toggle("lost", lost);
  root.classList.toggle("tutorial", tutorial);
  // Mirror onto the layout so the (sibling) history panel can hide in tutorial.
  root.parentElement?.classList.toggle("tutorial", tutorial);

  // Tutorial text block above the grid.
  root.querySelector(".tut-title")!.textContent = view.title ?? "";
  root.querySelector(".tut-body")!.textContent = tutorial ? (view.message ?? "") : "";

  // Message / instruction line (below the grid; hidden in tutorial via CSS).
  root.querySelector(".message")!.textContent = view.message ?? "";

  // Toolbar difficulty button label.
  root.querySelector('[data-action="diff"]')!.textContent = view.difficulty
    ? `diff: ${view.difficulty}`
    : "difficulty";

  // Contextual CTA button (next / retry / continue).
  const cta = root.querySelector<HTMLButtonElement>(".cta")!;
  if (view.cta) {
    cta.textContent = view.cta.label;
    cta.dataset.action = view.cta.action;
    cta.classList.add("show");
    cta.classList.toggle("loading", !!view.cta.loading);
  } else {
    cta.classList.remove("show");
    cta.classList.remove("loading");
  }
}

/**
 * Render the side history panel. The head doubles as an accordion toggle on
 * touch (it carries a chevron); the body collapses there. Rows carry data-index
 * for replay wiring.
 */
export function renderHistory(panel: HTMLElement, entries: GameRecord[]): void {
  const head =
    `<button class="hist-head" type="button" aria-label="history (toggle)">` +
    `history<span class="hist-chevron" aria-hidden="true"></span></button>`;

  if (entries.length === 0) {
    panel.innerHTML = head + `<div class="hist-body"><p class="hist-empty">no games yet</p></div>`;
    return;
  }

  const rows = entries
    .map((e, i) => {
      const icon = e.result === "won" ? "✓" : "✗";
      const diff = esc(e.diffLabel);
      const thumb =
        `<span class="hist-thumb" style="--n:${Number(e.N)}" aria-hidden="true">` +
        e.cells.map((c) => `<i${c ? ' class="on"' : ""}></i>`).join("") +
        `</span>`;
      const label = `replay ${diff} game, ${e.result} in ${Number(e.moves)} of ${Number(e.limit)} moves`;
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
    `<div class="hist-body"><ul class="hist-list">${rows}</ul></div>` +
    `<button class="hist-clear">clear history</button>`;
}
