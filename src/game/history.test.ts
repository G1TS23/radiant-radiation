import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  addRecord,
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
  it("returns null for a malformed save", () => {
    localStorage.setItem("rr.save", JSON.stringify({ nope: 1 }));
    expect(loadGame()).toBeNull();
  });
});
