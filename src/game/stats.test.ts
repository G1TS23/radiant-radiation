import { describe, it, expect, beforeEach } from "vitest";
import { loadStats, recordStat, clearStats, emptyStats, type Outcome } from "./stats";

const win = (over: Partial<Outcome> = {}): Outcome => ({
  won: true,
  moves: 8,
  par: 8,
  ms: 30_000,
  diff: 1,
  ...over,
});
const loss = (over: Partial<Outcome> = {}): Outcome => win({ won: false, ...over });

beforeEach(() => localStorage.clear());

describe("stats aggregation", () => {
  it("starts empty", () => {
    expect(loadStats()).toEqual(emptyStats());
  });

  it("counts played / won / lost", () => {
    recordStat(win());
    recordStat(loss());
    recordStat(win());
    const s = loadStats();
    expect(s.played).toBe(3);
    expect(s.won).toBe(2);
    expect(s.lost).toBe(1);
  });

  it("tracks current and best win streak; a loss resets the current streak", () => {
    recordStat(win());
    recordStat(win());
    recordStat(win());
    expect(loadStats().curStreak).toBe(3);
    recordStat(loss());
    expect(loadStats().curStreak).toBe(0);
    expect(loadStats().bestStreak).toBe(3);
    recordStat(win());
    const s = loadStats();
    expect(s.curStreak).toBe(1);
    expect(s.bestStreak).toBe(3); // best is preserved
  });

  it("averages moves over wins only and counts par finishes", () => {
    recordStat(win({ moves: 6, par: 8 })); // under par (cannot happen, but folded as a win)
    recordStat(win({ moves: 8, par: 8 })); // at par
    recordStat(win({ moves: 10, par: 8 }));
    recordStat(loss({ moves: 20, par: 8 })); // loss: ignored by movesWon / atPar
    const s = loadStats();
    expect(s.movesWon).toBe(24);
    expect(s.movesWon / s.won).toBe(8); // average
    expect(s.atParWins).toBe(1);
  });

  it("accumulates total time and keeps the fastest win", () => {
    recordStat(win({ ms: 40_000 }));
    recordStat(loss({ ms: 60_000 }));
    recordStat(win({ ms: 25_000 }));
    const s = loadStats();
    expect(s.totalPlayMs).toBe(125_000); // losses count toward time played
    expect(s.bestSolveMs).toBe(25_000); // fastest win only
  });

  it("a loss alone leaves bestSolveMs null", () => {
    recordStat(loss());
    expect(loadStats().bestSolveMs).toBeNull();
  });

  it("keeps a per-difficulty breakdown (best moves / time per diff)", () => {
    recordStat(win({ diff: 0, moves: 4, ms: 10_000 }));
    recordStat(win({ diff: 0, moves: 3, ms: 12_000 }));
    recordStat(win({ diff: 2, moves: 14, ms: 90_000 }));
    const s = loadStats();
    expect(s.perDiff[0]).toEqual({ played: 2, won: 2, bestMoves: 3, bestSolveMs: 10_000 });
    expect(s.perDiff[2]).toEqual({ played: 1, won: 1, bestMoves: 14, bestSolveMs: 90_000 });
  });

  it("clearStats wipes the aggregate", () => {
    recordStat(win());
    expect(clearStats()).toEqual(emptyStats());
    expect(loadStats()).toEqual(emptyStats());
  });
});

describe("validation against tampered storage", () => {
  it("falls back to empty on corrupt JSON", () => {
    localStorage.setItem("rr.stats", "{not json");
    expect(loadStats()).toEqual(emptyStats());
  });

  it("coerces out-of-range / wrong-typed fields to safe defaults", () => {
    localStorage.setItem(
      "rr.stats",
      JSON.stringify({
        played: -5,
        won: "lots",
        bestSolveMs: -1,
        perDiff: { "0": { played: 3, won: 2 }, bad: { played: 1 } },
      }),
    );
    const s = loadStats();
    expect(s.played).toBe(0); // negative -> 0
    expect(s.won).toBe(0); // non-number -> 0
    expect(s.bestSolveMs).toBe(0); // negative -> coerced, not null
    expect(s.perDiff[0]).toEqual({ played: 3, won: 2, bestMoves: null, bestSolveMs: null });
    expect("bad" in s.perDiff).toBe(false); // non-integer key dropped
  });
});
