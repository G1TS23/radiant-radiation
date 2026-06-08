/**
 * tutorial.ts — scripted onboarding steps.
 *
 * Tutorial boards are FIXED (never scrambled) so the instructions and hints can
 * be precise. The engine logic is reused as-is; the tutorial only adds the idea
 * of a fixed starting board, an imposed target color, and a recommended move.
 *
 * Step 1 (2x2): there is exactly one move, and it flips all four cells. A 2x2
 *   can never be a real puzzle (every reachable board is monochrome), so this
 *   step is a pure demonstration: start all-white, goal all-black, one click.
 *
 * Step 2 (3x3): a fixed board two moves away from solved — the first real taste
 *   of combining moves. Win = any single color.
 */

import { boardFromRows, type GameState, type Vertex } from "./engine";

export interface TutorialStep {
  id: string;
  N: number;
  cells: boolean[];
  targetColor: boolean | null;
  instruction: string;
  successText: string;
  /** Recommended next move, highlighted as a hint. */
  hint?: Vertex;
}

function step(
  id: string,
  rows: string[],
  rest: Omit<TutorialStep, "id" | "N" | "cells">,
): TutorialStep {
  const { N, cells } = boardFromRows(rows);
  return { id, N, cells, ...rest };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  step("brush", [
    "..",
    "..",
  ], {
    targetColor: true, // goal: all black
    instruction: "this is the brush. one click flips all 4 cells. make them black.",
    successText: "nice. that's the brush.",
    hint: { i: 0, j: 0 },
  }),
  step("combine", [
    "##.",
    "#.#",
    ".##",
  ], {
    targetColor: null, // any single color wins
    instruction: "now combine moves. clear the board to a single color.",
    successText: "solved. you're ready.",
    hint: { i: 0, j: 0 },
  }),
];

/** Build a playable GameState from a tutorial step. */
export function stepToState(step: TutorialStep): GameState {
  return {
    N: step.N,
    cells: step.cells.slice(),
    cursor: { i: 0, j: 0 },
    moves: 0,
    targetColor: step.targetColor,
    par: null,
    limit: null,
  };
}
