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
  vertexSpan,
  type GameState,
} from "./engine";

/** Deterministic RNG so generation-based assertions are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weight (# moves) of the unique GF(2) solution reaching `target`, or null. */
function solveWeight(N: number, target: bigint): number | null {
  const span = vertexSpan(N);
  const highBit = (b: bigint) => b.toString(2).length - 1;
  const pivots: { mask: bigint; combo: bigint }[] = [];
  for (let j = 0; j < span; j++)
    for (let i = 0; i < span; i++) {
      let mask = 0n;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        mask |= 1n << BigInt(index(N, i + dx, j + dy));
      let combo = 1n << BigInt(j * span + i);
      while (mask) {
        const h = highBit(mask);
        if (!pivots[h]) {
          pivots[h] = { mask, combo };
          break;
        }
        mask ^= pivots[h].mask;
        combo ^= pivots[h].combo;
      }
    }
  let mask = target;
  let combo = 0n;
  while (mask) {
    const h = highBit(mask);
    if (!pivots[h]) return null;
    mask ^= pivots[h].mask;
    combo ^= pivots[h].combo;
  }
  let w = 0;
  while (combo) {
    w += Number(combo & 1n);
    combo >>= 1n;
  }
  return w;
}

function boardMask(cells: boolean[]): bigint {
  let m = 0n;
  for (let k = 0; k < cells.length; k++) if (cells[k]) m |= 1n << BigInt(k);
  return m;
}

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
  it("par is the TRUE minimum (either colour), and limit = par + margin", () => {
    for (const { N, par, margin } of [
      { N: 4, par: 6, margin: 4 },
      { N: 6, par: 16, margin: 2 },
    ]) {
      const allOnes = (1n << BigInt(N * N)) - 1n;
      for (let seed = 1; seed <= 40; seed++) {
        const s = newGameWithPar(N, par, margin, mulberry32(seed));
        const tgt = boardMask(s.cells);
        const whiteW = solveWeight(N, tgt);
        const blackW = solveWeight(N, tgt ^ allOnes);
        const trueMin = Math.min(whiteW ?? Infinity, blackW ?? Infinity);
        expect(s.par).toBe(trueMin); // reported par is the genuine optimum
        expect(s.par!).toBeLessThanOrEqual(par); // never exceeds the generation knob
        expect(s.limit).toBe(s.par! + margin); // budget tracks the true par
      }
    }
  });
  it("keeps variety: easy yields short and long pars, not a fixed value", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) seen.add(newGameWithPar(4, 6, 4, mulberry32(seed)).par!);
    expect(seen.size).toBeGreaterThan(1); // not pinned to one number
    expect(Math.min(...seen)).toBeLessThan(6); // genuinely short boards still appear
  });
  it("odd-N: random base yields BOTH white- and black-target puzzles, par = k", () => {
    const allOnes = (1n << 25n) - 1n; // N=5 -> 25 cells
    const whiteSolvable = new Set<boolean>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGameWithPar(5, 10, 3, mulberry32(seed));
      expect(s.par).toBe(10); // no shortcut on odd N, par stays the knob
      expect(s.limit).toBe(13);
      const tgt = boardMask(s.cells);
      const toWhite = solveWeight(5, tgt);
      const toBlack = solveWeight(5, tgt ^ allOnes);
      expect((toWhite === null) !== (toBlack === null)).toBe(true); // exactly one colour reachable
      whiteSolvable.add(toWhite !== null);
    }
    expect(whiteSolvable.size).toBe(2); // both target colours occur
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
