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

import { index, isWin, isLost, stars, type GameState, type Vertex } from "./engine";

export interface View {
  /** Free play vs. tutorial — drives the title bar and HUD copy. */
  mode: "free" | "tutorial";
  /** Difficulty label for the title bar (free play); null in tutorial. */
  difficulty?: string | null;
  /** Instruction / status line (tutorial prompt, or a free-play hint). */
  message?: string;
  /** Recommended move to highlight, if any. */
  hint?: Vertex | null;
  /** Tutorial progress, e.g. step 1 of 2. */
  step?: { current: number; total: number };
}

const PAD = (n: number): string => String(n).padStart(3, "0");
const COLOR_NAME = (c: boolean): string => (c ? "black" : "white");
const STARS = (n: number): string => "★".repeat(n) + "☆".repeat(3 - n);

/** Build the static skeleton once; subsequent calls reuse it. */
function ensureSkeleton(root: HTMLElement): void {
  if (root.querySelector(".board")) return;
  root.classList.add("cli");
  root.innerHTML = `
    <header class="bar">
      <span class="bar-title">radiant-radiation</span>
      <span class="bar-meta"></span>
    </header>
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
    <p class="message"></p>
    <footer class="keys">
      <span>[arrows] move</span>
      <span>[space/enter] flip</span>
      <span>[r] regen</span>
      <span class="keys-free">[ / ] difficulty</span>
      <span class="keys-tut">[s] skip</span>
    </footer>`;
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

  // Cell colors.
  for (let y = 0; y < state.N; y++) {
    for (let x = 0; x < state.N; x++) {
      const i = index(state.N, x, y);
      (grid.children[i] as HTMLElement).classList.toggle("on", state.cells[i]);
    }
  }

  // Cursor + hint frames (in the overlay layer).
  placeOverlay(overlay.querySelector<HTMLElement>(".cursor-box"), state.cursor);
  placeOverlay(overlay.querySelector<HTMLElement>(".hint-box"), view.hint ?? null);

  // Title bar meta: difficulty + size, or tutorial progress.
  const meta = view.mode === "tutorial" && view.step
    ? `tutorial ${view.step.current}/${view.step.total}`
    : view.difficulty
      ? `${view.difficulty} · N=${state.N}`
      : `N=${state.N}`;
  root.querySelector(".bar-meta")!.textContent = meta;

  // HUD: moves (with limit), par, goal.
  root.querySelector(".hud-moves")!.textContent =
    `moves: ${PAD(state.moves)}` + (state.limit !== null ? ` / ${PAD(state.limit)}` : "");
  root.querySelector(".hud-par")!.textContent =
    state.par !== null ? `par: ${PAD(state.par)}` : "";
  root.querySelector(".hud-goal")!.textContent =
    state.targetColor === null ? "goal: single color" : `goal: all ${COLOR_NAME(state.targetColor)}`;

  // Status: win (+ stars when scored) or out of moves.
  const won = isWin(state);
  const lost = isLost(state);
  const status = won
    ? state.par !== null ? `>> solved  ${STARS(stars(state))}` : ">> solved"
    : lost ? ">> out of moves" : "";
  root.querySelector(".hud-status")!.textContent = status;
  root.classList.toggle("won", won);
  root.classList.toggle("lost", lost);
  root.classList.toggle("tutorial", view.mode === "tutorial");

  // Message / instruction line.
  root.querySelector(".message")!.textContent = view.message ?? "";
}
