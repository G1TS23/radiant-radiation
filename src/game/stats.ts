/**
 * stats.ts — lifetime aggregate statistics (localStorage), independent of the
 * 20-entry history cap. Folded in once per finished free-play game (never for
 * replays or the tutorial), alongside the history record. Like history, the
 * stored blob is user-writable, so everything is validated on read.
 */

import { getItem as read, setItem as write, removeItem as remove } from "./storage";

export interface DiffStat {
  played: number;
  won: number;
  bestMoves: number | null; // fewest moves in a win
  bestSolveMs: number | null; // fastest win
}

export interface Stats {
  played: number;
  won: number;
  lost: number;
  curStreak: number; // current win streak
  bestStreak: number;
  movesWon: number; // sum of moves over won games (for the average)
  atParWins: number; // wins where moves === par
  totalPlayMs: number; // cumulative active play time
  bestSolveMs: number | null; // fastest win
  perDiff: Record<number, DiffStat>; // tracked for a future breakdown
}

/** A finished free-play game, folded into the aggregate. */
export interface Outcome {
  won: boolean;
  moves: number;
  par: number;
  ms: number;
  diff: number;
}

const STATS_KEY = "rr.stats";

export function emptyStats(): Stats {
  return {
    played: 0,
    won: 0,
    lost: 0,
    curStreak: 0,
    bestStreak: 0,
    movesWon: 0,
    atParWins: 0,
    totalPlayMs: 0,
    bestSolveMs: null,
    perDiff: {},
  };
}

// --- validation (localStorage is user-writable / tamperable) ----------------

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0;

const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

function coerceDiff(v: unknown): DiffStat {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    played: num(o.played),
    won: num(o.won),
    bestMoves: numOrNull(o.bestMoves),
    bestSolveMs: numOrNull(o.bestSolveMs),
  };
}

function coerceStats(v: unknown): Stats {
  if (!v || typeof v !== "object") return emptyStats();
  const o = v as Record<string, unknown>;
  const perDiff: Record<number, DiffStat> = {};
  if (o.perDiff && typeof o.perDiff === "object") {
    for (const [k, val] of Object.entries(o.perDiff as Record<string, unknown>)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < 100) perDiff[i] = coerceDiff(val);
    }
  }
  return {
    played: num(o.played),
    won: num(o.won),
    lost: num(o.lost),
    curStreak: num(o.curStreak),
    bestStreak: num(o.bestStreak),
    movesWon: num(o.movesWon),
    atParWins: num(o.atParWins),
    totalPlayMs: num(o.totalPlayMs),
    bestSolveMs: numOrNull(o.bestSolveMs),
    perDiff,
  };
}

export function loadStats(): Stats {
  const raw = read(STATS_KEY);
  if (!raw) return emptyStats();
  try {
    return coerceStats(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

const minNotNull = (a: number | null, b: number): number => (a === null ? b : Math.min(a, b));

/** Fold a finished game into the stats and persist. Returns the new stats. */
export function recordStat(o: Outcome): Stats {
  const s = loadStats();
  const moves = num(o.moves);
  const ms = num(o.ms);
  s.played++;
  s.totalPlayMs += ms;
  const d = s.perDiff[o.diff] ?? { played: 0, won: 0, bestMoves: null, bestSolveMs: null };
  d.played++;
  if (o.won) {
    s.won++;
    s.curStreak++;
    if (s.curStreak > s.bestStreak) s.bestStreak = s.curStreak;
    s.movesWon += moves;
    if (moves === o.par) s.atParWins++;
    s.bestSolveMs = minNotNull(s.bestSolveMs, ms);
    d.won++;
    d.bestMoves = minNotNull(d.bestMoves, moves);
    d.bestSolveMs = minNotNull(d.bestSolveMs, ms);
  } else {
    s.lost++;
    s.curStreak = 0;
  }
  s.perDiff[o.diff] = d;
  write(STATS_KEY, JSON.stringify(s));
  return s;
}

export function clearStats(): Stats {
  remove(STATS_KEY);
  return emptyStats();
}
