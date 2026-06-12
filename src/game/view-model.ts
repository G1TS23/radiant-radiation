/**
 * view-model.ts — the session shape and the pure mapping from session state to
 * the render View. No DOM, no mutation: given a session (+ transient flash) it
 * returns what the UI should show.
 */

import { DIFFICULTIES, isWin, isOver, type GameState, type Vertex } from "./engine";
import { TUTORIAL_STEPS } from "./tutorial";
import { t } from "./i18n";
import type { View } from "./render";

export type Mode = "tutorial" | "free";

export interface Session {
  mode: Mode;
  state: GameState;
  initial: GameState; // pristine copy, for [r] reset
  history: GameState[]; // snapshots before each move, for [z] undo
  stepIndex: number; // tutorial only
  diff: number; // difficulty index (free play)
  replay: boolean; // a replayed puzzle (practice) — not re-recorded on finish
  replayOf?: number; // timestamp of the record being replayed (for in-place improvement)
}

/** The move the tutorial expects next (highlighted + the only one accepted). */
export function tutorialExpected(session: Session): Vertex | null {
  if (session.mode !== "tutorial" || isWin(session.state)) return null;
  const step = TUTORIAL_STEPS[session.stepIndex];
  if (!step.guided) return null;
  return step.solution[session.state.moves] ?? null;
}

/** Pure mapping from the current session to the render View. */
export function computeView(session: Session, flash: Vertex | null): View {
  const s = session.state;
  const won = isWin(s);

  if (session.mode === "tutorial") {
    const step = TUTORIAL_STEPS[session.stepIndex];
    const isLast = session.stepIndex === TUTORIAL_STEPS.length - 1;
    return {
      mode: "tutorial",
      difficulty: null,
      step: { current: session.stepIndex + 1, total: TUTORIAL_STEPS.length },
      title: t(step.title),
      message: t(won ? step.successText : step.instruction),
      hint: tutorialExpected(session),
      flash,
      cta: won ? { label: t(isLast ? "cta.start" : "cta.continue"), action: "next" } : null,
    };
  }

  // The status (">> solved" / ">> out of moves") shows in the HUD; the only
  // contextual free-play UI here is the button centred over the board.
  let cta: View["cta"] = null;
  if (won) cta = { label: t("cta.next"), action: "next", loading: true };
  else if (isOver(s)) cta = { label: t("cta.retry"), action: "reset" };

  return {
    mode: "free",
    difficulty: t("difficulty." + DIFFICULTIES[session.diff].id),
    message: "",
    hint: null,
    flash,
    cta,
  };
}
