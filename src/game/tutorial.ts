/**
 * tutorial.ts — scripted onboarding steps.
 *
 * Tutorial boards are FIXED (never scrambled), so the instructions and hints can
 * be precise. The engine logic is reused as-is; the tutorial only adds the idea
 * of a fixed starting board, an imposed target color, and a recommended move.
 *
 * The tutorial starts directly on 3x3 boards: small enough to read instantly,
 * but large enough for overlapping 2x2 flips to matter. The first two steps are
 * guided; the last step removes the hint and lets the player solve the puzzle freely.
 * Win = any single color.
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
  /** Whether the current solution move should be highlighted and enforced. */
  guided: boolean;
  /**
   * The exact move sequence that solves the step. The current move (solution
   * [movesMade]) is highlighted and enforced when guided = true. Unguided steps
   * still keep a solution here, so tests can validate the scripted board.
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
  step("one-move", ["##.", "##.", "..."], {
    targetColor: false, // one flip turns it all white
    title: "tut.one.title", // i18n keys (resolved with t() where displayed)
    instruction: "tut.one.instruction",
    successText: "tut.one.success",
    guided: true,
    solution: [{ i: 0, j: 0 }],
  }),
  step("two-moves", ["..#", ".#.", "#.."], {
    targetColor: true, // the two scripted flips fill the grid with black
    title: "tut.two.title",
    instruction: "tut.two.instruction",
    successText: "tut.two.success",
    guided: true,
    solution: [
      { i: 0, j: 0 },
      { i: 1, j: 1 },
    ],
  }),
  step("three-moves", ["#.#", ".##", "##."], {
    targetColor: null,
    title: "tut.three.title",
    instruction: "tut.three.instruction",
    successText: "tut.three.success",
    guided: false,
    solution: [
      { i: 0, j: 0 },
      { i: 1, j: 0 },
      { i: 0, j: 1 },
    ],
  }),
];

/** Build a playable GameState from a tutorial step. */
export function stepToState(step: TutorialStep): GameState {
  return createState({ N: step.N, cells: step.cells.slice(), targetColor: step.targetColor });
}
