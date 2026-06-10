/**
 * input.ts — keyboard + pointer wiring. No game logic, no rendering.
 *
 * Translates raw events into high-level intents and forwards them to handlers.
 * Pointer is wired by delegation on the root, so the grid can be rebuilt freely
 * without losing listeners. A pointer position is mapped to the *nearest move
 * vertex* (the intersection of 4 cells closest to the finger/cursor) so a single
 * tap flips the 2x2 you point at; the controller clamps it to a legal vertex.
 */

export interface InputHandlers {
  /** Arrow keys: move the cursor by (di, dj). */
  move(di: number, dj: number): void;
  /** Space / Enter: apply the move under the cursor (or advance when solved). */
  commit(): void;
  /**
   * Click/tap aiming at vertex (i, j) — applies the move there. The tapped cell
   * (cellX, cellY) is also reported so the tutorial can accept any tap inside the
   * highlighted 2x2, not just a precise hit on the intersection.
   */
  tapVertex(i: number, j: number, cellX: number, cellY: number): void;
  /** Hover over vertex (i, j) — previews the cursor (no move). */
  pointVertex(i: number, j: number): void;
  /** R: reset the current puzzle to its starting position. */
  regen(): void;
  /** N: generate a new puzzle (free play). */
  newPuzzle(): void;
  /** Z: undo the last move. */
  undo(): void;
  /** '[' or ']': change grid size by delta (free play only). */
  resize(delta: number): void;
  /** S: skip the tutorial. */
  skip(): void;
  /** T: toggle light / dark theme. */
  toggleTheme(): void;
}

/** True when focus is in a text field, so game keys shouldn't fire. */
function isTextTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable);
}

/** True when focus is on a control that owns Space/Enter (button, link…). */
function isControlTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  return !!n?.closest?.('button, a[href], [role="button"]');
}

/**
 * Nearest move vertex to the pointer, computed from grid geometry (not from the
 * cell under the pointer). Mapping the pointer to the closest interior gridline
 * means a hit on a gap — including the exact centre of a 2x2, which lands on the
 * intersection of 4 cells — still resolves to the right vertex. Returns null for
 * points clearly outside the board. The controller clamps the result.
 */
function pointInfo(
  grid: HTMLElement | null,
  e: MouseEvent,
): { vi: number; vj: number; cx: number; cy: number } | null {
  if (!grid) return null;
  const cells = grid.children;
  const N = Math.round(Math.sqrt(cells.length));
  if (N < 2) return null;

  const a = (cells[0] as HTMLElement).getBoundingClientRect();
  const b = (cells[cells.length - 1] as HTMLElement).getBoundingClientRect();
  const pad = 4; // tolerate the border / a gap at the very edges
  if (
    e.clientX < a.left - pad ||
    e.clientX > b.right + pad ||
    e.clientY < a.top - pad ||
    e.clientY > b.bottom + pad
  ) {
    return null;
  }

  const fx = ((e.clientX - a.left) / (b.right - a.left)) * N; // 0..N in cell units
  const fy = ((e.clientY - a.top) / (b.bottom - a.top)) * N;
  const vertex = (v: number): number => Math.min(N - 2, Math.max(0, Math.round(v) - 1));
  const cell = (v: number): number => Math.min(N - 1, Math.max(0, Math.floor(v)));
  return { vi: vertex(fx), vj: vertex(fy), cx: cell(fx), cy: cell(fy) };
}

/** Attach all input listeners. Returns a detach function. */
export function attachInput(root: HTMLElement, h: InputHandlers): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (isTextTarget(e.target)) return;
    switch (e.key) {
      case "ArrowUp":
        h.move(0, -1);
        break;
      case "ArrowDown":
        h.move(0, 1);
        break;
      case "ArrowLeft":
        h.move(-1, 0);
        break;
      case "ArrowRight":
        h.move(1, 0);
        break;
      case " ":
      case "Enter":
        // Let a focused button/link handle Space/Enter (activate itself).
        if (isControlTarget(e.target)) return;
        h.commit();
        break;
      case "r":
      case "R":
        h.regen();
        break;
      case "n":
      case "N":
        h.newPuzzle();
        break;
      case "z":
      case "Z":
        h.undo();
        break;
      case "s":
      case "S":
        h.skip();
        break;
      case "t":
      case "T":
        h.toggleTheme();
        break;
      case "d":
      case "D":
      case "]":
        h.resize(1);
        break; // cycle difficulty forward
      case "[":
        h.resize(-1);
        break; // cycle difficulty backward
      default:
        return; // don't preventDefault for keys we ignore
    }
    e.preventDefault();
  };

  const gridOf = (): HTMLElement | null => root.querySelector<HTMLElement>(".grid");

  const onClick = (e: MouseEvent): void => {
    const p = pointInfo(gridOf(), e);
    if (p) h.tapVertex(p.vi, p.vj, p.cx, p.cy);
  };

  // Right-click anywhere on the board undoes the last move (no context menu).
  const onContext = (e: MouseEvent): void => {
    e.preventDefault();
    h.undo();
  };

  const onHover = (e: MouseEvent): void => {
    const p = pointInfo(gridOf(), e);
    if (p) h.pointVertex(p.vi, p.vj);
  };

  window.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);
  root.addEventListener("contextmenu", onContext);
  root.addEventListener("mousemove", onHover);

  return () => {
    window.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
    root.removeEventListener("contextmenu", onContext);
    root.removeEventListener("mousemove", onHover);
  };
}
