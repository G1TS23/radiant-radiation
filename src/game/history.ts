/**
 * history.ts — localStorage persistence: finished-game history + in-progress autosave.
 *
 * - History: a capped list of finished free-play games (result, moves, difficulty)
 *   plus the initial board so a game can be replayed from scratch.
 * - Autosave: the current in-progress free-play game, so a reload can resume it.
 */

import type { GameState } from "./engine";

export interface GameRecord {
  t: number; // timestamp (ms)
  diff: number; // difficulty index
  diffLabel: string;
  N: number;
  result: "won" | "lost";
  moves: number;
  par: number;
  limit: number;
  cells: boolean[]; // INITIAL board, for replay
}

export interface SavedGame {
  state: GameState;
  initial: GameState;
  diff: number;
  replay?: boolean; // a replayed puzzle (practice), not recorded again on finish
}

const HISTORY_KEY = "rr.history";
const SAVE_KEY = "rr.save";
const CAP = 20;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// --- finished-game history --------------------------------------------------

// --- validation (localStorage is user-writable / tamperable) ----------------

const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.trunc(v) : null;

const isBoolArray = (a: unknown, len: number): a is boolean[] =>
  Array.isArray(a) && a.length === len && a.every((x) => typeof x === "boolean");

/** Validate + normalize a record; returns null if the shape is wrong. */
function coerceRecord(r: unknown): GameRecord | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const N = int(o.N, 2, 16);
  if (N === null || !isBoolArray(o.cells, N * N)) return null;
  if (o.result !== "won" && o.result !== "lost") return null;
  const t = int(o.t), diff = int(o.diff, 0, 99);
  const moves = int(o.moves), par = int(o.par), limit = int(o.limit);
  if (t === null || diff === null || moves === null || par === null || limit === null) return null;
  return {
    t,
    diff,
    diffLabel: typeof o.diffLabel === "string" ? o.diffLabel.slice(0, 24) : "",
    N,
    result: o.result,
    moves,
    par,
    limit,
    cells: o.cells,
  };
}

/** Validate + normalize a persisted game state. */
function coerceState(s: unknown): GameState | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const N = int(o.N, 2, 16);
  if (N === null || !isBoolArray(o.cells, N * N)) return null;
  const c = o.cursor as Record<string, unknown> | undefined;
  const ci = int(c?.i, 0, N), cj = int(c?.j, 0, N);
  const moves = int(o.moves);
  if (ci === null || cj === null || moves === null) return null;
  if (o.targetColor !== null && typeof o.targetColor !== "boolean") return null;
  const numOrNull = (v: unknown) => (v === null ? null : int(v));
  return {
    N,
    cells: o.cells,
    cursor: { i: ci, j: cj },
    moves,
    targetColor: o.targetColor,
    par: numOrNull(o.par),
    limit: numOrNull(o.limit),
  };
}

export function loadHistory(): GameRecord[] {
  const raw = read(HISTORY_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map(coerceRecord).filter((r): r is GameRecord => r !== null).slice(0, CAP);
  } catch {
    return [];
  }
}

/** Prepend a record (newest first), cap the list, persist, return the new list. */
export function addRecord(rec: GameRecord): GameRecord[] {
  const list = [rec, ...loadHistory()].slice(0, CAP);
  write(HISTORY_KEY, JSON.stringify(list));
  return list;
}

export function clearHistory(): GameRecord[] {
  remove(HISTORY_KEY);
  return [];
}

// --- in-progress autosave ---------------------------------------------------

export function saveGame(s: SavedGame): void {
  write(SAVE_KEY, JSON.stringify(s));
}

export function loadGame(): SavedGame | null {
  const raw = read(SAVE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const state = coerceState(v?.state);
    const initial = coerceState(v?.initial);
    const diff = int(v?.diff, 0, 99);
    if (!state || !initial || diff === null) return null;
    return { state, initial, diff, replay: v.replay === true };
  } catch {
    return null;
  }
}

export function clearGame(): void {
  remove(SAVE_KEY);
}
