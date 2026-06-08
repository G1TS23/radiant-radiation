/**
 * main.ts — orchestration. Wires engine + tutorial + render + input together.
 *
 * Flow: boot -> tutorial (unless already done) -> free play.
 * Holds the single source of truth (the current session) and re-renders after
 * every change. Keeps no DOM logic of its own beyond reading the mount point.
 */

import {
  MIN_N,
  MAX_N,
  newGame,
  applyMoveAtCursor,
  moveCursor,
  isWin,
  type GameState,
  type Vertex,
} from "./engine";
import { TUTORIAL_STEPS, stepToState } from "./tutorial";
import { render, type View } from "./render";
import { attachInput, type InputHandlers } from "./input";

const TUTORIAL_DONE_KEY = "rr.tutorialDone";
const DEFAULT_N = 5;

type Mode = "tutorial" | "free";

interface Session {
  mode: Mode;
  state: GameState;
  stepIndex: number; // tutorial only
  freeN: number; // remembered grid size for free play
}

let root: HTMLElement;
let session: Session;

// --- persistence -----------------------------------------------------------

function tutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {
    /* ignore (private mode / disabled storage) */
  }
}

// --- session transitions ---------------------------------------------------

function startFree(N: number): void {
  session = { mode: "free", state: newGame(N), stepIndex: 0, freeN: N };
  draw();
}

function startTutorial(index: number): void {
  session = {
    mode: "tutorial",
    state: stepToState(TUTORIAL_STEPS[index]),
    stepIndex: index,
    freeN: session?.freeN ?? DEFAULT_N,
  };
  draw();
}

/** Move on once the current board is solved (or skipped). */
function advance(): void {
  if (session.mode === "tutorial") {
    const next = session.stepIndex + 1;
    if (next < TUTORIAL_STEPS.length) {
      startTutorial(next);
    } else {
      markTutorialDone();
      startFree(session.freeN);
    }
  } else {
    startFree(session.freeN); // fresh puzzle, same size
  }
}

// --- input handlers --------------------------------------------------------

/** Clamp a raw cell (x, y) to the nearest legal move vertex. */
function clampVertex(state: GameState, x: number, y: number): Vertex {
  const max = state.N - 2;
  return {
    i: Math.min(max, Math.max(0, x)),
    j: Math.min(max, Math.max(0, y)),
  };
}

function setCursor(v: Vertex): void {
  session.state = { ...session.state, cursor: v };
}

const handlers: InputHandlers = {
  move(di, dj) {
    session.state = moveCursor(session.state, di, dj);
    draw();
  },
  commit() {
    if (isWin(session.state)) {
      advance();
      return;
    }
    session.state = applyMoveAtCursor(session.state);
    draw();
  },
  clickCell(x, y) {
    if (isWin(session.state)) {
      advance();
      return;
    }
    setCursor(clampVertex(session.state, x, y));
    session.state = applyMoveAtCursor(session.state);
    draw();
  },
  hoverCell(x, y) {
    const v = clampVertex(session.state, x, y);
    if (v.i === session.state.cursor.i && v.j === session.state.cursor.j) return;
    setCursor(v);
    draw();
  },
  regen() {
    if (session.mode === "tutorial") startTutorial(session.stepIndex);
    else startFree(session.freeN);
  },
  resize(delta) {
    if (session.mode !== "free") return;
    const N = Math.min(MAX_N, Math.max(MIN_N, session.freeN + delta));
    if (N !== session.freeN) startFree(N);
  },
  skip() {
    if (session.mode !== "tutorial") return;
    markTutorialDone();
    startFree(session.freeN);
  },
};

// --- view + render ---------------------------------------------------------

function computeView(): View {
  const s = session.state;
  const won = isWin(s);

  if (session.mode === "tutorial") {
    const step = TUTORIAL_STEPS[session.stepIndex];
    const isLast = session.stepIndex === TUTORIAL_STEPS.length - 1;
    const cont = isLast ? "press [space] to start playing" : "press [space] to continue";
    return {
      mode: "tutorial",
      step: { current: session.stepIndex + 1, total: TUTORIAL_STEPS.length },
      message: won ? `${step.successText} — ${cont}` : step.instruction,
      // Hint only guides the first move, then steps aside.
      hint: !won && s.moves === 0 ? step.hint ?? null : null,
    };
  }

  return {
    mode: "free",
    message: won ? "press [space] or [r] for a new puzzle" : "",
    hint: null,
  };
}

function draw(): void {
  render(root, session.state, computeView());
}

// --- boot ------------------------------------------------------------------

function boot(): void {
  const el = document.getElementById("game");
  if (!el) return;
  root = el;

  attachInput(root, handlers);

  if (tutorialDone()) startFree(DEFAULT_N);
  else startTutorial(0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
