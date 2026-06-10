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

import { boardFromRows, createState, type GameState, type Vertex } from "./engine";

export interface TutorialStep {
  id: string;
  N: number;
  cells: boolean[];
  targetColor: boolean | null;
  /** Welcome / heading line shown above the grid. */
  title: string;
  /** Explanation shown above the grid. */
  instruction: string;
  successText: string;
  /**
   * The exact move sequence that solves the step. The current move (solution
   * [movesMade]) is highlighted, and in the tutorial only that move is accepted,
   * so the player is guided step by step and can't get stuck.
   */
  solution: Vertex[];
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
  step("brush", ["..", ".."], {
    targetColor: true, // goal: all black
    title: "welcome — make one color",
    instruction: "Tap the glowing square: its 4 cells flip together. Make them all black.",
    successText: "that's the brush — it flips 4 cells at once.",
    solution: [{ i: 0, j: 0 }],
  }),
  step("combine", ["##.", "#.#", ".##"], {
    targetColor: null, // any single color wins
    title: "combine flips",
    instruction:
      "Flips overlap, so each one also changes its neighbours. Tap the glowing squares in order until the grid is one color.",
    successText: "solved — the whole grid is one color. you've got it!",
    solution: [
      { i: 0, j: 0 },
      { i: 1, j: 1 },
    ],
  }),
];

/** Build a playable GameState from a tutorial step. */
export function stepToState(step: TutorialStep): GameState {
  return createState({ N: step.N, cells: step.cells.slice(), targetColor: step.targetColor });
}
