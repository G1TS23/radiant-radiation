/**
 * history.ts — localStorage persistence: finished-game history + in-progress autosave.
 *
 * - History: a capped list of finished free-play games (result, moves, difficulty,
 *   stars) plus the initial board so a game can be replayed from scratch.
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
  stars: number;
  cells: boolean[]; // INITIAL board, for replay
}

export interface SavedGame {
  state: GameState;
  initial: GameState;
  diff: number;
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

export function loadHistory(): GameRecord[] {
  const raw = read(HISTORY_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GameRecord[]) : [];
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
    const v = JSON.parse(raw);
    if (v && v.state && v.initial && typeof v.diff === "number") return v as SavedGame;
    return null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  remove(SAVE_KEY);
}
