/**
 * engine.ts — pure game logic, no DOM.
 *
 * The board is an NxN grid of boolean cells (false = white, true = black),
 * stored row-major in a flat array: cell (x, y) lives at index `y * N + x`.
 *
 * A "move" picks an interior vertex (i, j) with i, j in [0 .. N-2] and flips the
 * 2x2 block of cells touching that vertex: (i,j), (i+1,j), (i,j+1), (i+1,j+1).
 * There are (N-1) * (N-1) legal moves. Moves are involutions and commute, so a
 * board is solvable iff it was reached from a monochrome board by such moves —
 * which is exactly how we generate puzzles (never tile randomly).
 */

export type RNG = () => number;

/** A clickable interior vertex; the anchor (top-left cell) of a 2x2 move. */
export interface Vertex {
  i: number;
  j: number;
}

export interface GameState {
  N: number;
  cells: boolean[];
  cursor: Vertex;
  moves: number;
  /**
   * null  -> any monochrome board wins (free play).
   * true  -> must be all black; false -> all white (tutorial goals).
   */
  targetColor: boolean | null;
}

/** Grid-size bounds for free play (2x2 has no real puzzle, so min is 3). */
export const MIN_N = 3;
export const MAX_N = 8;

/** Flat-array index of cell (x, y) on an NxN board. */
export const index = (N: number, x: number, y: number): number => y * N + x;

/** Number of legal moves / clickable vertices per axis. */
export const vertexSpan = (N: number): number => Math.max(0, N - 1);

/** True if (i, j) is a valid move anchor on an NxN board. */
export const isVertex = (N: number, i: number, j: number): boolean =>
  i >= 0 && j >= 0 && i <= N - 2 && j <= N - 2;

/** A fresh monochrome board (default all white). */
export const createBoard = (N: number, color = false): boolean[] =>
  new Array(N * N).fill(color);

/** True if every cell shares the same color. */
export const isMonochrome = (cells: boolean[]): boolean =>
  cells.length > 0 && cells.every((c) => c === cells[0]);

/** Mutates `cells`: flips the 2x2 block anchored at vertex (i, j). */
export function flip2x2(cells: boolean[], N: number, i: number, j: number): void {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const k = index(N, i + dx, j + dy);
    cells[k] = !cells[k];
  }
}

/** How many random moves to apply when generating a puzzle of size N. */
export const scrambleCount = (N: number): number => 3 * (N - 1) * (N - 1);

/** Mutates `cells`: applies `k` random legal moves. */
export function scramble(cells: boolean[], N: number, k: number, rng: RNG = Math.random): void {
  const span = vertexSpan(N);
  if (span < 1) return;
  for (let n = 0; n < k; n++) {
    const i = Math.floor(rng() * span);
    const j = Math.floor(rng() * span);
    flip2x2(cells, N, i, j);
  }
}

/**
 * Build a fresh, guaranteed-solvable free-play game of size N.
 * Scrambles a solved board; retries if it lands back on monochrome (so the
 * player always gets something to do — except N=2 where it's unavoidable).
 */
export function newGame(N: number, rng: RNG = Math.random): GameState {
  const cells = createBoard(N, false);
  for (let attempts = 0; attempts < 20; attempts++) {
    scramble(cells, N, scrambleCount(N), rng);
    if (!isMonochrome(cells)) break;
  }
  return {
    N,
    cells,
    cursor: { i: 0, j: 0 },
    moves: 0,
    targetColor: null,
  };
}

/** True when the current board satisfies the win condition. */
export function isWin(state: GameState): boolean {
  const { cells, targetColor } = state;
  if (cells.length === 0) return false;
  if (targetColor === null) return isMonochrome(cells);
  return cells.every((c) => c === targetColor);
}

/** Returns a new state with the move at (i, j) applied. No-op if out of bounds. */
export function applyMoveAt(state: GameState, i: number, j: number): GameState {
  if (!isVertex(state.N, i, j)) return state;
  const cells = state.cells.slice();
  flip2x2(cells, state.N, i, j);
  return { ...state, cells, moves: state.moves + 1 };
}

/** Applies the move under the cursor. */
export const applyMoveAtCursor = (state: GameState): GameState =>
  applyMoveAt(state, state.cursor.i, state.cursor.j);

/** Returns a new state with the cursor moved by (di, dj), clamped to bounds. */
export function moveCursor(state: GameState, di: number, dj: number): GameState {
  const max = state.N - 2;
  const i = Math.min(max, Math.max(0, state.cursor.i + di));
  const j = Math.min(max, Math.max(0, state.cursor.j + dj));
  if (i === state.cursor.i && j === state.cursor.j) return state;
  return { ...state, cursor: { i, j } };
}

/**
 * Parse a board from ASCII rows: '#' = black (true), anything else = white.
 * The number of rows defines N; rows are assumed square. Handy for fixed
 * tutorial boards.
 */
export function boardFromRows(rows: string[]): { N: number; cells: boolean[] } {
  const N = rows.length;
  const cells: boolean[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      cells.push(rows[y][x] === "#");
    }
  }
  return { N, cells };
}
