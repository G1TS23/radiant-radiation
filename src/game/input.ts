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
  /** Click/tap aiming at vertex (i, j) — applies the move there. */
  tapVertex(i: number, j: number): void;
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

/**
 * Nearest move vertex to the pointer: pick the cell under the pointer and the
 * corner of that cell closest to the hit point. Corners map to vertex anchors
 * (i = x-1 left / x right, j = y-1 top / y bottom); the controller clamps them.
 */
function vertexFromEvent(e: MouseEvent): [number, number] | null {
  const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>(".cell");
  if (!cell) return null;
  const r = cell.getBoundingClientRect();
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const i = (e.clientX - r.left) / r.width < 0.5 ? x - 1 : x;
  const j = (e.clientY - r.top) / r.height < 0.5 ? y - 1 : y;
  return [i, j];
}

/** Attach all input listeners. Returns a detach function. */
export function attachInput(root: HTMLElement, h: InputHandlers): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (isTextTarget(e.target)) return;
    switch (e.key) {
      case "ArrowUp": h.move(0, -1); break;
      case "ArrowDown": h.move(0, 1); break;
      case "ArrowLeft": h.move(-1, 0); break;
      case "ArrowRight": h.move(1, 0); break;
      case " ":
      case "Enter": h.commit(); break;
      case "r":
      case "R": h.regen(); break;
      case "n":
      case "N": h.newPuzzle(); break;
      case "z":
      case "Z": h.undo(); break;
      case "s":
      case "S": h.skip(); break;
      case "t":
      case "T": h.toggleTheme(); break;
      case "d":
      case "D":
      case "]": h.resize(1); break; // cycle difficulty forward
      case "[": h.resize(-1); break; // cycle difficulty backward
      default: return; // don't preventDefault for keys we ignore
    }
    e.preventDefault();
  };

  const onClick = (e: MouseEvent): void => {
    const v = vertexFromEvent(e);
    if (v) h.tapVertex(v[0], v[1]);
  };

  // Right-click anywhere on the board undoes the last move (no context menu).
  const onContext = (e: MouseEvent): void => {
    e.preventDefault();
    h.undo();
  };

  const onHover = (e: MouseEvent): void => {
    const v = vertexFromEvent(e);
    if (v) h.pointVertex(v[0], v[1]);
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
