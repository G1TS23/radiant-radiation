/**
 * main.ts — orchestration. Wires engine + tutorial + render + input together.
 *
 * Flow: boot -> tutorial (unless already done) -> free play.
 * Free play is driven by difficulty presets (size + par + slack). The board is
 * generated with a known par, so we can enforce a move limit and compare to par.
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
import { render, renderHistory, type View } from "./render";
import { attachInput, type InputHandlers } from "./input";
import {
  loadHistory,
  addRecord,
  clearHistory,
  saveGame,
  loadGame,
  clearGame,
  type GameRecord,
} from "./history";

const TUTORIAL_DONE_KEY = "rr.tutorialDone";
const DIFFICULTY_KEY = "rr.difficulty";
const THEME_KEY = "rr.theme";

type Mode = "tutorial" | "free";

interface Session {
  mode: Mode;
  state: GameState;
  initial: GameState; // pristine copy, for [r] reset
  history: GameState[]; // snapshots before each move, for [z] undo
  stepIndex: number; // tutorial only
  diff: number; // difficulty index (free play)
}

let root: HTMLElement;
let historyPanel: HTMLElement | null;
let historyEntries: GameRecord[] = [];
let session: Session;
let flash: Vertex | null = null; // 2x2 to flash after a move (touch feedback)
let flashTimer: number | undefined;

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
  session = { mode: "free", state, initial: snapshot(state), history: [], stepIndex: 0, diff };
  writeStorage(DIFFICULTY_KEY, String(diff));
  draw();
}

function startTutorial(index: number): void {
  const state = stepToState(TUTORIAL_STEPS[index]);
  session = {
    mode: "tutorial",
    state,
    initial: snapshot(state),
    history: [],
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

/** Resume an autosaved in-progress free-play game. */
function restoreGame(saved: { state: GameState; initial: GameState; diff: number }): void {
  session = {
    mode: "free",
    state: saved.state,
    initial: saved.initial,
    history: [],
    stepIndex: 0,
    diff: saved.diff,
  };
  draw();
}

/** Replay a finished game from its recorded initial board. */
function replayRecord(rec: GameRecord): void {
  const state: GameState = {
    N: rec.N,
    cells: rec.cells.slice(),
    cursor: { i: 0, j: 0 },
    moves: 0,
    targetColor: null,
    par: rec.par,
    limit: rec.limit,
  };
  session = { mode: "free", state, initial: snapshot(state), history: [], stepIndex: 0, diff: rec.diff };
  draw();
}

/** Record the just-finished free-play game into the history panel. */
function recordCurrent(): void {
  const s = session.state;
  if (session.mode !== "free" || s.par === null || s.limit === null) return;
  historyEntries = addRecord({
    t: Date.now(),
    diff: session.diff,
    diffLabel: DIFFICULTIES[session.diff].label,
    N: s.N,
    result: isWin(s) ? "won" : "lost",
    moves: s.moves,
    par: s.par,
    limit: s.limit,
    cells: session.initial.cells.slice(),
  });
  clearGame(); // the game is over; nothing in-progress to resume
  drawHistory();
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

/** The move the tutorial expects next (highlighted + the only one accepted). */
function tutorialExpected(): Vertex | null {
  if (session.mode !== "tutorial" || isWin(session.state)) return null;
  return TUTORIAL_STEPS[session.stepIndex].solution[session.state.moves] ?? null;
}

/** In the tutorial, only the highlighted move is allowed (guided, can't stick). */
function moveAllowed(v: Vertex): boolean {
  const exp = tutorialExpected();
  return !exp || (v.i === exp.i && v.j === exp.j);
}

/** Apply the move under the cursor, briefly flashing the 4 flipped cells. */
function doMove(): void {
  session.history.push(snapshot(session.state));
  session.state = applyMoveAtCursor(session.state);
  if (isOver(session.state)) recordCurrent();
  flash = { ...session.state.cursor };
  draw();
  if (flashTimer !== undefined) clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flash = null;
    draw();
  }, 240);
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
    if (!moveAllowed(session.state.cursor)) return; // tutorial: must be on the hint
    doMove();
  },
  tapVertex(i, j) {
    if (isOver(session.state)) {
      advance();
      return;
    }
    const v = clampVertex(session.state, i, j);
    setCursor(v);
    if (!moveAllowed(v)) {
      draw(); // move the cursor for feedback, but don't flip (not the hinted move)
      return;
    }
    doMove();
  },
  pointVertex(i, j) {
    if (isOver(session.state)) return;
    const v = clampVertex(session.state, i, j);
    if (v.i === session.state.cursor.i && v.j === session.state.cursor.j) return;
    setCursor(v);
    draw();
  },
  regen() {
    // Reset the current puzzle to its starting position (same board, moves 0).
    session.state = snapshot(session.initial);
    session.history = [];
    draw();
  },
  undo() {
    // Undo the last move; disabled once solved (round is over — use space/r/n).
    if (isWin(session.state)) return;
    const prev = session.history.pop();
    if (!prev) return;
    session.state = prev;
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
  const won = isWin(s);

  if (session.mode === "tutorial") {
    const step = TUTORIAL_STEPS[session.stepIndex];
    const isLast = session.stepIndex === TUTORIAL_STEPS.length - 1;
    return {
      mode: "tutorial",
      difficulty: null,
      step: { current: session.stepIndex + 1, total: TUTORIAL_STEPS.length },
      title: step.title,
      message: won ? step.successText : step.instruction,
      hint: tutorialExpected(),
      flash,
      cta: won ? { label: isLast ? "start playing ▶" : "continue ▶", action: "next" } : null,
    };
  }

  // The status (">> solved" / ">> out of moves") already shows in the HUD, so the
  // message line stays empty here — only the action button appears next to it.
  let cta: View["cta"] = null;
  if (won) {
    cta = { label: "next puzzle ▶", action: "next" };
  } else if (isOver(s)) {
    cta = { label: "retry ▶", action: "reset" };
  }

  return {
    mode: "free",
    difficulty: DIFFICULTIES[session.diff].label,
    message: "",
    hint: null,
    flash,
    cta,
  };
}

function draw(): void {
  render(root, session.state, computeView());
  // Autosave only an in-progress free-play game (finished games go to history).
  if (session.mode === "free" && !isOver(session.state)) {
    saveGame({ state: session.state, initial: session.initial, diff: session.diff });
  }
}

function drawHistory(): void {
  if (!historyPanel) return;
  renderHistory(historyPanel, historyEntries);
  // Reveal the panel (and its balancing spacer) only once a game has finished.
  historyPanel.parentElement?.classList.toggle("has-history", historyEntries.length > 0);
}

/** Toggle the collapsible history panel (touch layout). */
function toggleHistory(): void {
  historyPanel?.parentElement?.classList.toggle("show-history");
}

/** Dispatch an on-screen toolbar / CTA button to the matching handler. */
function onAction(action: string): void {
  switch (action) {
    case "undo": handlers.undo(); break;
    case "reset": handlers.regen(); break;
    case "new": handlers.newPuzzle(); break;
    case "diff": handlers.resize(1); break;
    case "theme": handlers.toggleTheme(); break;
    case "skip": handlers.skip(); break;
    case "next": handlers.commit(); break; // advances when the round is over
  }
}

// --- boot ------------------------------------------------------------------

function boot(): void {
  const el = document.getElementById("game");
  if (!el) return;
  root = el;

  attachInput(root, handlers);

  // On-screen controls (toolbar buttons + contextual CTA) live inside the board
  // root; a button click never maps to a cell, so it can share the root.
  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (btn?.dataset.action) {
      e.stopPropagation();
      onAction(btn.dataset.action);
    }
  });

  // History panel: render saved games and wire replay / clear.
  historyPanel = document.getElementById("history");
  historyEntries = loadHistory();
  drawHistory();
  historyPanel?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".hist-head")) {
      toggleHistory(); // accordion toggle (touch)
      return;
    }
    if (target.closest(".hist-clear")) {
      historyEntries = clearHistory();
      drawHistory();
      return;
    }
    const row = target.closest<HTMLElement>(".hist-row");
    if (row?.dataset.index) replayRecord(historyEntries[Number(row.dataset.index)]);
  });

  // Deep link: ?d=hard starts free play directly at that difficulty.
  const dParam = new URLSearchParams(location.search).get("d");
  if (dParam !== null) {
    const idx = DIFFICULTIES.findIndex((x) => x.id === dParam);
    startFree(idx >= 0 ? idx : DEFAULT_DIFFICULTY);
    return;
  }

  if (!tutorialDone()) {
    startTutorial(0);
    return;
  }

  // Resume an in-progress game if one was autosaved, else start fresh.
  const saved = loadGame();
  if (saved) restoreGame(saved);
  else startFree(loadDifficulty());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
