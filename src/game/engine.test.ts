import { describe, it, expect } from "vitest";
import {
  flip2x2,
  applyMoveAt,
  moveCursor,
  isWin,
  isLost,
  isOver,
  isMonochrome,
  isVertex,
  index,
  allVertices,
  createBoard,
  boardFromRows,
  newGameWithPar,
  type GameState,
} from "./engine";

function freeState(N: number, cells: boolean[], over: Partial<GameState> = {}): GameState {
  return {
    N,
    cells,
    cursor: { i: 0, j: 0 },
    moves: 0,
    targetColor: null,
    par: null,
    limit: null,
    ...over,
  };
}

describe("flip2x2", () => {
  it("flips the 4 cells of the 2x2 and is an involution", () => {
    const c = createBoard(3, false);
    flip2x2(c, 3, 0, 0);
    expect([c[index(3, 0, 0)], c[index(3, 1, 0)], c[index(3, 0, 1)], c[index(3, 1, 1)]]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    flip2x2(c, 3, 0, 0);
    expect(c.every((v) => v === false)).toBe(true);
  });
});

describe("applyMoveAt", () => {
  it("increments moves, flips the right block, stays immutable", () => {
    const s = freeState(3, createBoard(3));
    const s2 = applyMoveAt(s, 1, 1);
    expect(s2.moves).toBe(1);
    expect(s2.cells[index(3, 1, 1)]).toBe(true);
    expect(s.moves).toBe(0);
    expect(s.cells[index(3, 1, 1)]).toBe(false);
  });
  it("is a no-op out of bounds", () => {
    const s = freeState(3, createBoard(3));
    expect(applyMoveAt(s, 5, 5)).toBe(s);
  });
});

describe("moveCursor", () => {
  it("clamps to [0, N-2]", () => {
    const s = freeState(5, createBoard(5));
    expect(moveCursor(s, -1, -1).cursor).toEqual({ i: 0, j: 0 });
    expect(moveCursor({ ...s, cursor: { i: 3, j: 3 } }, 5, 5).cursor).toEqual({ i: 3, j: 3 });
  });
});

describe("win / loss", () => {
  it("wins on any monochrome board when targetColor is null", () => {
    expect(isWin(freeState(2, [false, false, false, false]))).toBe(true);
    expect(isWin(freeState(2, [true, true, true, true]))).toBe(true);
    expect(isWin(freeState(2, [true, false, true, true]))).toBe(false);
  });
  it("respects an imposed targetColor", () => {
    expect(isWin(freeState(2, [true, true, true, true], { targetColor: true }))).toBe(true);
    expect(isWin(freeState(2, [false, false, false, false], { targetColor: true }))).toBe(false);
  });
  it("isLost at the limit without a win; isOver = win or loss", () => {
    const unsolved = [true, false, false, false, false, false, false, false, false];
    expect(isLost(freeState(3, unsolved, { moves: 5, limit: 5 }))).toBe(true);
    expect(isOver(freeState(3, unsolved, { moves: 5, limit: 5 }))).toBe(true);
    const solved = freeState(3, createBoard(3), { moves: 5, limit: 5 });
    expect(isLost(solved)).toBe(false);
    expect(isOver(solved)).toBe(true);
  });
});

describe("solvability invariant", () => {
  it("a board built from known moves is cleared by replaying them", () => {
    const N = 4;
    const cells = createBoard(N, false);
    const moves: [number, number][] = [
      [0, 0],
      [2, 2],
      [1, 0],
    ];
    moves.forEach(([i, j]) => flip2x2(cells, N, i, j));
    expect(isMonochrome(cells)).toBe(false);
    moves.forEach(([i, j]) => flip2x2(cells, N, i, j));
    expect(isMonochrome(cells)).toBe(true);
  });
});

describe("newGameWithPar", () => {
  it("sets par and limit, starts unsolved at 0 moves", () => {
    const s = newGameWithPar(5, 10, 3);
    expect(s.par).toBe(10);
    expect(s.limit).toBe(13);
    expect(s.moves).toBe(0);
    expect(s.cursor).toEqual({ i: 0, j: 0 });
    expect(isWin(s)).toBe(false);
  });
  it("caps par at the number of legal moves", () => {
    const s = newGameWithPar(3, 99, 1); // 3x3 has only 4 moves
    expect(s.par!).toBeLessThanOrEqual(4);
  });
});

describe("helpers", () => {
  it("allVertices count = (N-1)^2", () => {
    expect(allVertices(5)).toHaveLength(16);
    expect(allVertices(3)).toHaveLength(4);
  });
  it("isVertex bounds", () => {
    expect(isVertex(5, 0, 0)).toBe(true);
    expect(isVertex(5, 3, 3)).toBe(true);
    expect(isVertex(5, 4, 0)).toBe(false);
  });
  it("boardFromRows parses '#' as black", () => {
    const { N, cells } = boardFromRows(["#.", ".#"]);
    expect(N).toBe(2);
    expect(cells).toEqual([true, false, false, true]);
  });
});
