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
  /** Intended solution length (generation subset size); null = untracked (tutorial). */
  par: number | null;
  /** Max moves allowed before it's a loss; null = unlimited. */
  limit: number | null;
}

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

/** All legal move vertices of an NxN board. */
export function allVertices(N: number): Vertex[] {
  const span = vertexSpan(N);
  const out: Vertex[] = [];
  for (let j = 0; j < span; j++) {
    for (let i = 0; i < span; i++) out.push({ i, j });
  }
  return out;
}

function shuffle<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Generate a puzzle with a KNOWN par. Instead of scrambling (where moves cancel
 * and the real solution length is unknowable), we apply `par` DISTINCT moves
 * once each — so the canonical solution is exactly those `par` moves, and the
 * board is always solvable in at most `par` moves. The move limit is par+margin.
 */
export function newGameWithPar(
  N: number,
  par: number,
  margin: number,
  rng: RNG = Math.random,
): GameState {
  const verts = allVertices(N);
  const k = Math.max(1, Math.min(par, verts.length));
  let cells = createBoard(N, false);
  for (let attempt = 0; attempt < 24; attempt++) {
    cells = createBoard(N, false);
    shuffle(verts, rng);
    for (let n = 0; n < k; n++) flip2x2(cells, N, verts[n].i, verts[n].j);
    if (!isMonochrome(cells)) break; // retry if the subset cancelled out
  }
  return createState({ N, cells, par: k, limit: k + margin });
}

/** Build a fresh game state: cursor at the origin, 0 moves, unspecified fields null. */
export function createState(opts: {
  N: number;
  cells: boolean[];
  targetColor?: boolean | null;
  par?: number | null;
  limit?: number | null;
}): GameState {
  return {
    N: opts.N,
    cells: opts.cells,
    cursor: { i: 0, j: 0 },
    moves: 0,
    targetColor: opts.targetColor ?? null,
    par: opts.par ?? null,
    limit: opts.limit ?? null,
  };
}

/** True when the move limit is reached without a win. */
export function isLost(state: GameState): boolean {
  return state.limit !== null && !isWin(state) && state.moves >= state.limit;
}

/** Win or loss — the round is finished either way. */
export function isOver(state: GameState): boolean {
  return isWin(state) || isLost(state);
}

export interface Difficulty {
  id: string;
  label: string;
  N: number;
  par: number;
  margin: number;
}

/** Presets bundle grid size, par and slack into one difficulty knob. */
export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", label: "easy", N: 4, par: 6, margin: 4 },
  { id: "normal", label: "normal", N: 5, par: 10, margin: 3 },
  { id: "hard", label: "hard", N: 6, par: 16, margin: 2 },
  { id: "expert", label: "expert", N: 7, par: 24, margin: 1 },
];

export const DEFAULT_DIFFICULTY = 1; // "normal"

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
