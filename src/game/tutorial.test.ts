import { describe, expect, it } from "vitest";
import { applyMoveAt, isWin } from "./engine";
import { TUTORIAL_STEPS, stepToState } from "./tutorial";

describe("tutorial steps", () => {
  it("all scripted solutions solve their board", () => {
    for (const step of TUTORIAL_STEPS) {
      let state = stepToState(step);
      for (const move of step.solution) {
        state = applyMoveAt(state, move.i, move.j);
      }
      expect(isWin(state), step.id).toBe(true);
    }
  });
});
