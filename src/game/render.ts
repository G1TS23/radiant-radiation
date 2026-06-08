/**
 * render.ts — turn a GameState into DOM. No input handling, no game logic.
 *
 * Rendering is idempotent: call `render(root, state, view)` after every change.
 * The skeleton (title bar, grid, HUD, key hints) is built once and then patched.
 * Cells are plain divs auto-placed into a CSS grid; the cursor and hint are two
 * overlay boxes placed explicitly on the same grid tracks so they frame the 2x2
 * block cleanly. Overlays are `pointer-events: none` so clicks fall through to
 * the cells underneath (mouse wiring lives in input.ts via event delegation).
 */

import { index, isWin, type GameState, type Vertex } from "./engine";

export interface View {
  /** Free play vs. tutorial — drives the title bar and HUD copy. */
  mode: "free" | "tutorial";
  /** Instruction / status line (tutorial prompt, or a free-play hint). */
  message?: string;
  /** Recommended move to highlight, if any. */
  hint?: Vertex | null;
  /** Tutorial progress, e.g. step 1 of 2. */
  step?: { current: number; total: number };
}

const PAD = (n: number): string => String(n).padStart(3, "0");
const COLOR_NAME = (c: boolean): string => (c ? "black" : "white");

/** Build the static skeleton once; subsequent calls reuse it. */
function ensureSkeleton(root: HTMLElement): void {
  if (root.querySelector(".grid")) return;
  root.classList.add("cli");
  root.innerHTML = `
    <header class="bar">
      <span class="bar-title">radiant-radiation</span>
      <span class="bar-meta"></span>
    </header>
    <div class="grid" role="grid" aria-label="puzzle grid"></div>
    <div class="hud">
      <span class="hud-moves">moves: 000</span>
      <span class="hud-goal"></span>
      <span class="hud-status"></span>
    </div>
    <p class="message"></p>
    <footer class="keys">
      <span>[arrows] move</span>
      <span>[space/enter] flip</span>
      <span>[r] regen</span>
      <span class="keys-free">[ / ] size</span>
      <span class="keys-tut">[s] skip</span>
    </footer>`;
}

/** Rebuild the cell nodes + overlays when the grid size changes. */
function buildGrid(grid: HTMLElement, state: GameState): void {
  grid.style.setProperty("--n", String(state.N));
  const frag = document.createDocumentFragment();
  for (let y = 0; y < state.N; y++) {
    for (let x = 0; x < state.N; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      frag.appendChild(cell);
    }
  }
  // Overlays come last so cells auto-place first, then frames sit on top.
  const cursor = document.createElement("div");
  cursor.className = "cursor-box";
  const hint = document.createElement("div");
  hint.className = "hint-box";
  frag.append(cursor, hint);

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

  const grid = root.querySelector<HTMLElement>(".grid")!;
  const cellCount = grid.querySelectorAll(".cell").length;
  if (cellCount !== state.N * state.N) buildGrid(grid, state);

  // Cell colors.
  for (let y = 0; y < state.N; y++) {
    for (let x = 0; x < state.N; x++) {
      const cell = grid.children[index(state.N, x, y)] as HTMLElement;
      cell.classList.toggle("on", state.cells[index(state.N, x, y)]);
    }
  }

  // Cursor + hint frames.
  placeOverlay(grid.querySelector<HTMLElement>(".cursor-box"), state.cursor);
  placeOverlay(grid.querySelector<HTMLElement>(".hint-box"), view.hint ?? null);

  // Title bar meta: size or tutorial progress.
  const meta = view.mode === "tutorial" && view.step
    ? `tutorial ${view.step.current}/${view.step.total}`
    : `N=${state.N}`;
  root.querySelector(".bar-meta")!.textContent = meta;

  // HUD.
  root.querySelector(".hud-moves")!.textContent = `moves: ${PAD(state.moves)}`;
  root.querySelector(".hud-goal")!.textContent =
    state.targetColor === null ? "goal: single color" : `goal: all ${COLOR_NAME(state.targetColor)}`;

  const won = isWin(state);
  root.querySelector(".hud-status")!.textContent = won ? ">> solved" : "";
  root.classList.toggle("won", won);
  root.classList.toggle("tutorial", view.mode === "tutorial");

  // Message / instruction line.
  root.querySelector(".message")!.textContent = view.message ?? "";
}
