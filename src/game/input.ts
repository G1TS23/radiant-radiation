/**
 * input.ts — keyboard + mouse wiring. No game logic, no rendering.
 *
 * Translates raw events into high-level intents and forwards them to handlers.
 * Mouse is wired by delegation on the root, so the grid can be rebuilt freely
 * without losing listeners. Cell coordinates are passed raw; clamping a cell to
 * a legal move vertex is the controller's job (it owns N).
 */

export interface InputHandlers {
  /** Arrow keys: move the cursor by (di, dj). */
  move(di: number, dj: number): void;
  /** Space / Enter: apply the move under the cursor (or advance when solved). */
  commit(): void;
  /** Click on a cell at (x, y). */
  clickCell(x: number, y: number): void;
  /** Hover a cell at (x, y) — used to preview the cursor. */
  hoverCell(x: number, y: number): void;
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

function cellCoords(e: Event): [number, number] | null {
  const target = e.target as HTMLElement | null;
  const cell = target?.closest<HTMLElement>(".cell");
  if (!cell) return null;
  return [Number(cell.dataset.x), Number(cell.dataset.y)];
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
    const c = cellCoords(e);
    if (c) h.clickCell(c[0], c[1]);
  };

  const onHover = (e: MouseEvent): void => {
    const c = cellCoords(e);
    if (c) h.hoverCell(c[0], c[1]);
  };

  window.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);
  root.addEventListener("mousemove", onHover);

  return () => {
    window.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
    root.removeEventListener("mousemove", onHover);
  };
}
