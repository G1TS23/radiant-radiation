import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  addRecord,
  improveRecord,
  clearHistory,
  saveGame,
  loadGame,
  clearGame,
  type GameRecord,
  type SavedGame,
} from "./history";

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  t: Date.now(),
  diff: 1,
  diffLabel: "normal",
  N: 5,
  result: "won",
  moves: 9,
  par: 10,
  limit: 13,
  cells: new Array(25).fill(false),
  ...over,
});

beforeEach(() => localStorage.clear());

describe("history records", () => {
  it("loads [] when empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("prepends newest first and caps at 20", () => {
    let list: GameRecord[] = [];
    for (let i = 0; i < 25; i++) list = addRecord(rec({ moves: i }));
    expect(list).toHaveLength(20);
    expect(list[0].moves).toBe(24);
    expect(list[19].moves).toBe(5);
    expect(loadHistory()).toHaveLength(20);
  });
  it("clearHistory empties storage", () => {
    addRecord(rec());
    expect(clearHistory()).toEqual([]);
    expect(loadHistory()).toEqual([]);
  });
  it("ignores corrupted JSON", () => {
    localStorage.setItem("rr.history", "{not json");
    expect(loadHistory()).toEqual([]);
  });
});

describe("improveRecord (better replay)", () => {
  it("a win in fewer moves replaces a slower win", () => {
    addRecord(rec({ t: 100, result: "won", moves: 9 }));
    const { list, improved } = improveRecord(100, 6);
    expect(improved).toBe(true);
    expect(list[0].moves).toBe(6);
    expect(list[0].result).toBe("won");
    expect(loadHistory()[0].moves).toBe(6); // persisted
  });
  it("a win replaces a previous loss", () => {
    addRecord(rec({ t: 100, result: "lost", moves: 13 }));
    const { list, improved } = improveRecord(100, 11);
    expect(improved).toBe(true);
    expect(list[0].result).toBe("won");
    expect(list[0].moves).toBe(11);
  });
  it("never downgrades: equal or more moves on a prior win is a no-op", () => {
    addRecord(rec({ t: 100, result: "won", moves: 6 }));
    expect(improveRecord(100, 6).improved).toBe(false);
    expect(improveRecord(100, 8).improved).toBe(false);
    expect(loadHistory()[0].moves).toBe(6);
  });
  it("only touches the matching timestamp, others untouched", () => {
    addRecord(rec({ t: 1, moves: 9 }));
    addRecord(rec({ t: 2, moves: 9 })); // newest first -> index 0
    improveRecord(1, 4);
    const list = loadHistory();
    expect(list.find((r) => r.t === 1)!.moves).toBe(4);
    expect(list.find((r) => r.t === 2)!.moves).toBe(9);
  });
  it("is a safe no-op when the record is gone (cleared)", () => {
    expect(improveRecord(999, 3)).toEqual({ list: [], improved: false });
  });
});

describe("in-progress autosave", () => {
  const saved = (): SavedGame => ({
    diff: 2,
    replay: false,
    state: {
      N: 5,
      cells: new Array(25).fill(false),
      cursor: { i: 1, j: 1 },
      moves: 3,
      targetColor: null,
      par: 10,
      limit: 13,
    },
    initial: {
      N: 5,
      cells: new Array(25).fill(false),
      cursor: { i: 0, j: 0 },
      moves: 0,
      targetColor: null,
      par: 10,
      limit: 13,
    },
  });

  it("round-trips through localStorage and clears", () => {
    saveGame(saved());
    const loaded = loadGame();
    expect(loaded?.state.moves).toBe(3);
    expect(loaded?.diff).toBe(2);
    clearGame();
    expect(loadGame()).toBeNull();
  });
  it("round-trips the play clock (elapsedMs) so a reload resumes timing", () => {
    saveGame({ ...saved(), elapsedMs: 45_000 });
    expect(loadGame()?.elapsedMs).toBe(45_000);
  });
  it("returns null for a malformed save", () => {
    localStorage.setItem("rr.save", JSON.stringify({ nope: 1 }));
    expect(loadGame()).toBeNull();
  });
});

describe("validation against tampered storage", () => {
  it("drops malformed records and keeps valid ones", () => {
    const tampered: unknown[] = [
      rec({ moves: 1 }),
      { ...rec(), cells: [true] }, // wrong cells length
      "garbage",
      { ...rec(), result: "nope" }, // invalid result
      { ...rec(), N: 0 }, // out-of-range N
    ];
    localStorage.setItem("rr.history", JSON.stringify(tampered));
    const list = loadHistory();
    expect(list).toHaveLength(1);
    expect(list[0].moves).toBe(1);
  });
  it("rejects a save with a mismatched board", () => {
    localStorage.setItem(
      "rr.save",
      JSON.stringify({ diff: 1, state: { N: 5, cells: [true] }, initial: {} }),
    );
    expect(loadGame()).toBeNull();
  });
});
