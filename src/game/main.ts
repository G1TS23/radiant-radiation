/**
 * main.ts — orchestration. Wires engine + tutorial + render + input together.
 *
 * Flow: boot -> tutorial (unless already done) -> free play.
 * Free play is driven by difficulty presets (size + par + slack). The board is
 * generated with a known par, so we can enforce a move limit and score stars.
 * Tutorial boards stay unlimited (par/limit = null).
 */

import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  newGameWithPar,
  applyMoveAtCursor,
  moveCursor,
  isWin,
  isOver,
  type GameState,
  type Vertex,
} from "./engine";
import { TUTORIAL_STEPS, stepToState } from "./tutorial";
import { render, type View } from "./render";
import { attachInput, type InputHandlers } from "./input";

const TUTORIAL_DONE_KEY = "rr.tutorialDone";
const DIFFICULTY_KEY = "rr.difficulty";
const THEME_KEY = "rr.theme";

type Mode = "tutorial" | "free";

interface Session {
  mode: Mode;
  state: GameState;
  initial: GameState; // pristine copy, for [r] reset
  stepIndex: number; // tutorial only
  diff: number; // difficulty index (free play)
}

let root: HTMLElement;
let session: Session;

/** Deep-ish copy of a state (the only mutable part is the cells array). */
function snapshot(s: GameState): GameState {
  return { ...s, cells: s.cells.slice(), cursor: { ...s.cursor } };
}

// --- persistence -----------------------------------------------------------

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore (private mode / disabled storage) */
  }
}

const tutorialDone = (): boolean => readStorage(TUTORIAL_DONE_KEY) === "1";

function loadDifficulty(): number {
  const v = Number(readStorage(DIFFICULTY_KEY));
  return Number.isInteger(v) && v >= 0 && v < DIFFICULTIES.length ? v : DEFAULT_DIFFICULTY;
}

// --- theme -----------------------------------------------------------------
// The initial theme class is applied inline in <head> (Layout.astro) to avoid a
// flash; here we only handle runtime toggling.

// --- session transitions ---------------------------------------------------

function startFree(diff: number): void {
  const d = DIFFICULTIES[diff];
  const state = newGameWithPar(d.N, d.par, d.margin);
  session = { mode: "free", state, initial: snapshot(state), stepIndex: 0, diff };
  writeStorage(DIFFICULTY_KEY, String(diff));
  draw();
}

function startTutorial(index: number): void {
  const state = stepToState(TUTORIAL_STEPS[index]);
  session = {
    mode: "tutorial",
    state,
    initial: snapshot(state),
    stepIndex: index,
    diff: session?.diff ?? loadDifficulty(),
  };
  draw();
}

/** Move on once the round is finished (won, lost, or skipped). */
function advance(): void {
  if (session.mode === "tutorial") {
    const next = session.stepIndex + 1;
    if (next < TUTORIAL_STEPS.length) {
      startTutorial(next);
    } else {
      writeStorage(TUTORIAL_DONE_KEY, "1");
      startFree(session.diff);
    }
  } else {
    startFree(session.diff); // fresh puzzle, same difficulty
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
    if (isOver(session.state)) return;
    session.state = moveCursor(session.state, di, dj);
    draw();
  },
  commit() {
    if (isOver(session.state)) {
      advance();
      return;
    }
    session.state = applyMoveAtCursor(session.state);
    draw();
  },
  clickCell(x, y) {
    if (isOver(session.state)) {
      advance();
      return;
    }
    setCursor(clampVertex(session.state, x, y));
    session.state = applyMoveAtCursor(session.state);
    draw();
  },
  hoverCell(x, y) {
    if (isOver(session.state)) return;
    const v = clampVertex(session.state, x, y);
    if (v.i === session.state.cursor.i && v.j === session.state.cursor.j) return;
    setCursor(v);
    draw();
  },
  regen() {
    // Reset the current puzzle to its starting position (same board, moves 0).
    session.state = snapshot(session.initial);
    draw();
  },
  newPuzzle() {
    // New random board (free play only; tutorial boards are fixed).
    if (session.mode === "free") startFree(session.diff);
  },
  resize(delta) {
    // In free play, 'd' / '[' / ']' cycle difficulty presets (wrapping).
    if (session.mode !== "free") return;
    const len = DIFFICULTIES.length;
    const d = (session.diff + delta + len) % len;
    if (d !== session.diff) startFree(d);
  },
  skip() {
    if (session.mode !== "tutorial") return;
    writeStorage(TUTORIAL_DONE_KEY, "1");
    startFree(session.diff);
  },
  toggleTheme() {
    const light = document.documentElement.classList.toggle("light");
    writeStorage(THEME_KEY, light ? "light" : "dark");
  },
};

// --- view + render ---------------------------------------------------------

function computeView(): View {
  const s = session.state;

  if (session.mode === "tutorial") {
    const step = TUTORIAL_STEPS[session.stepIndex];
    const isLast = session.stepIndex === TUTORIAL_STEPS.length - 1;
    const won = isWin(s);
    const cont = isLast ? "press [space] to start playing" : "press [space] to continue";
    return {
      mode: "tutorial",
      difficulty: null,
      step: { current: session.stepIndex + 1, total: TUTORIAL_STEPS.length },
      message: won ? `${step.successText} — ${cont}` : step.instruction,
      hint: !won && s.moves === 0 ? step.hint ?? null : null,
    };
  }

  let message = "";
  if (isWin(s)) message = "solved — [space] next puzzle · [r] replay";
  else if (isOver(s)) message = "out of moves — [r] retry · [space] new puzzle";

  return {
    mode: "free",
    difficulty: DIFFICULTIES[session.diff].label,
    message,
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

  // Deep link: ?d=hard starts free play directly at that difficulty.
  const dParam = new URLSearchParams(location.search).get("d");
  if (dParam !== null) {
    const idx = DIFFICULTIES.findIndex((x) => x.id === dParam);
    startFree(idx >= 0 ? idx : DEFAULT_DIFFICULTY);
    return;
  }

  if (tutorialDone()) startFree(loadDifficulty());
  else startTutorial(0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
