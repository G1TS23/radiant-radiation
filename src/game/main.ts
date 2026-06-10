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
  createState,
  applyMoveAtCursor,
  moveCursor,
  isWin,
  isLost,
  isOver,
  type GameState,
  type Vertex,
} from "./engine";
import { TUTORIAL_STEPS, stepToState } from "./tutorial";
import { render, renderHistory } from "./render";
import { attachInput, type InputHandlers } from "./input";
import {
  loadHistory,
  addRecord,
  clearHistory,
  saveGame,
  loadGame,
  clearGame,
  type GameRecord,
  type SavedGame,
} from "./history";
import { getItem as readStorage, setItem as writeStorage } from "./storage";
import { computeView, tutorialExpected, type Session } from "./view-model";
import {
  setLocale,
  chooseLocale,
  detectLocale,
  getLocale,
  hasChosenLocale,
  isLocale,
  localizeStatic,
  t,
  tn,
  LOCALES,
} from "./i18n";

const TUTORIAL_DONE_KEY = "rr.tutorialDone";
const DIFFICULTY_KEY = "rr.difficulty";
const THEME_KEY = "rr.theme";
const ZEN_KEY = "rr.zen";

let root: HTMLElement;
let historyPanel: HTMLElement | null;
let historyEntries: GameRecord[] = [];
let session: Session;
let zenOn = false; // zen mode: only the grid on screen (free play only)
let flash: Vertex | null = null; // 2x2 to flash after a move (touch feedback)
let flashTimer: number | undefined;
let advanceTimer: number | undefined; // auto-advance to the next puzzle after a win

/** Delay before the next puzzle appears automatically after a win. */
const AUTO_ADVANCE_MS = 5000;

function cancelAutoAdvance(): void {
  if (advanceTimer !== undefined) {
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }
}

function scheduleAutoAdvance(): void {
  cancelAutoAdvance();
  advanceTimer = window.setTimeout(() => {
    advanceTimer = undefined;
    advance();
  }, AUTO_ADVANCE_MS);
}

/** Deep-ish copy of a state (the only mutable part is the cells array). */
function snapshot(s: GameState): GameState {
  return { ...s, cells: s.cells.slice(), cursor: { ...s.cursor } };
}

// --- persistence -----------------------------------------------------------

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
  cancelAutoAdvance();
  const d = DIFFICULTIES[diff];
  const state = newGameWithPar(d.N, d.par, d.margin);
  session = {
    mode: "free",
    state,
    initial: snapshot(state),
    history: [],
    stepIndex: 0,
    diff,
    replay: false,
  };
  writeStorage(DIFFICULTY_KEY, String(diff));
  draw();
  announce(t("announce.new", { diff: t("difficulty." + d.id), n: d.N }));
}

function startTutorial(index: number): void {
  cancelAutoAdvance();
  const step = TUTORIAL_STEPS[index];
  const state = stepToState(step);
  session = {
    mode: "tutorial",
    state,
    initial: snapshot(state),
    history: [],
    stepIndex: index,
    diff: session?.diff ?? loadDifficulty(),
    replay: false,
  };
  draw();
  announce(`${t(step.title)}. ${t(step.instruction)}`);
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
function restoreGame(saved: SavedGame): void {
  cancelAutoAdvance();
  session = {
    mode: "free",
    state: saved.state,
    initial: saved.initial,
    history: [],
    stepIndex: 0,
    diff: saved.diff,
    replay: saved.replay ?? false,
  };
  draw();
}

/** Replay a finished game from its recorded initial board. */
function replayRecord(rec: GameRecord): void {
  cancelAutoAdvance();
  const state = createState({ N: rec.N, cells: rec.cells.slice(), par: rec.par, limit: rec.limit });
  session = {
    mode: "free",
    state,
    initial: snapshot(state),
    history: [],
    stepIndex: 0,
    diff: rec.diff,
    replay: true,
  };
  draw();
  announce(t("announce.replay", { diff: t("difficulty." + DIFFICULTIES[rec.diff].id), n: rec.N }));
}

/** Record the just-finished free-play game into the history panel. */
function recordCurrent(): void {
  const s = session.state;
  if (session.mode !== "free" || s.par === null || s.limit === null) return;
  clearGame(); // the game is over; nothing in-progress to resume
  if (session.replay) return; // replayed puzzles are practice — don't duplicate them
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

/** In the tutorial, only the highlighted move is allowed (guided, can't stick). */
function moveAllowed(v: Vertex): boolean {
  const exp = tutorialExpected(session);
  return !exp || (v.i === exp.i && v.j === exp.j);
}

/** Apply the move under the cursor, briefly flashing the 4 flipped cells. */
function doMove(): void {
  session.history.push(snapshot(session.state));
  session.state = applyMoveAtCursor(session.state);
  if (isOver(session.state)) {
    recordCurrent();
    // In free play, auto-advance to the next puzzle a few seconds after a win.
    if (session.mode === "free" && isWin(session.state)) scheduleAutoAdvance();
  }
  flash = { ...session.state.cursor };
  draw();
  const s = session.state;
  const black = s.cells.filter(Boolean).length;
  announce(
    isWin(s)
      ? tn("announce.solved", s.moves)
      : isLost(s)
        ? t("announce.lost")
        : t("announce.count", { black, white: s.cells.length - black }),
  );
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
    const { i, j } = session.state.cursor;
    announce(t("announce.cursor", { row: j + 1, col: i + 1 }));
  },
  commit() {
    if (isOver(session.state)) {
      advance();
      return;
    }
    if (!moveAllowed(session.state.cursor)) return; // tutorial: must be on the hint
    doMove();
  },
  tapVertex(i, j, cx, cy) {
    // Game over: the grid is inert — only the CTA button advances / retries.
    if (isOver(session.state)) return;
    // Tutorial: forgive aim — any tap inside the highlighted 2x2 snaps to the
    // expected move, so a tap on a corner cell isn't silently rejected.
    if (session.mode === "tutorial") {
      const exp = tutorialExpected(session);
      if (exp) {
        const inside = (cx === exp.i || cx === exp.i + 1) && (cy === exp.j || cy === exp.j + 1);
        if (inside) {
          setCursor(exp);
          doMove();
        } else {
          setCursor(clampVertex(session.state, i, j)); // feedback only, no flip
          draw();
        }
        return;
      }
    }
    setCursor(clampVertex(session.state, i, j));
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
    cancelAutoAdvance();
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
  zen() {
    toggleZen();
  },
};

// --- view + render ---------------------------------------------------------

function draw(): void {
  render(root, session.state, computeView(session, flash));
  applyZen(); // keep the zen class in sync with the mode on every transition
  // Autosave only an in-progress free-play game (finished games go to history).
  if (session.mode === "free" && !isOver(session.state)) {
    saveGame({
      state: session.state,
      initial: session.initial,
      diff: session.diff,
      replay: session.replay,
    });
  }
}

/** Send a message to the screen-reader live region. */
function announce(msg: string): void {
  const el = root.querySelector<HTMLElement>(".sr-only");
  if (el) el.textContent = msg;
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

/** Reflect the zen flag on the layout — only strips chrome during free play. */
function applyZen(): void {
  root.parentElement?.classList.toggle("zen", zenOn && session.mode === "free");
}

/** Zen mode: hide everything but the grid. Toggled by Esc or the corner button. */
function toggleZen(): void {
  if (session.mode !== "free") return; // the tutorial needs its text
  zenOn = !zenOn;
  writeStorage(ZEN_KEY, zenOn ? "1" : "0");
  applyZen();
}

// --- language ---------------------------------------------------------------

/** Show the language picker (first visit, and the bar's language button). */
function openLangPicker(): void {
  const screen = document.getElementById("lang-screen");
  if (!screen) return;
  const opts = LOCALES.map(
    (l) => `<button class="lang-opt" type="button" data-lang="${l.code}">${l.name}</button>`,
  ).join("");
  screen.innerHTML =
    `<div class="lang-card"><p class="lang-prompt">${t("lang.prompt")}</p>` +
    `<div class="lang-options">${opts}</div></div>`;
  screen.hidden = false;
}

/** Apply a chosen language: persist, relabel everything, hide the picker. */
function chooseLanguage(code: string): void {
  if (!isLocale(code)) return;
  chooseLocale(code);
  document.documentElement.lang = code;
  localizeStatic();
  draw();
  drawHistory();
  const screen = document.getElementById("lang-screen");
  if (screen) screen.hidden = true;
}

/** On-screen control actions (data-action values). */
const ACTIONS = [
  "undo",
  "reset",
  "new",
  "diff",
  "theme",
  "hist",
  "zen",
  "lang",
  "skip",
  "next",
] as const;
type Action = (typeof ACTIONS)[number];
const isAction = (s: string): s is Action => (ACTIONS as readonly string[]).includes(s);

/** Dispatch an on-screen toolbar / CTA button to the matching handler. */
function onAction(action: Action): void {
  switch (action) {
    case "undo":
      handlers.undo();
      break;
    case "reset":
      handlers.regen();
      break;
    case "new":
      handlers.newPuzzle();
      break;
    case "diff":
      handlers.resize(1);
      break;
    case "theme":
      handlers.toggleTheme();
      break;
    case "hist":
      toggleHistory();
      break;
    case "zen":
      toggleZen();
      break;
    case "lang":
      openLangPicker();
      break;
    case "skip":
      handlers.skip();
      break;
    case "next":
      handlers.commit();
      break; // advances when the round is over
  }
}

// --- boot ------------------------------------------------------------------

function boot(): void {
  const el = document.getElementById("game");
  if (!el) return;
  root = el;

  // Single source for the auto-advance duration: the CTA loader reads it in CSS.
  root.style.setProperty("--auto-advance", `${AUTO_ADVANCE_MS}ms`);

  zenOn = readStorage(ZEN_KEY) === "1";

  // Apply the stored/auto-detected language before the first render.
  setLocale(detectLocale());
  document.documentElement.lang = getLocale();

  // Language picker (first visit + the bar's language button) — pick a language.
  document.getElementById("lang-screen")?.addEventListener("click", (e) => {
    const code = (e.target as HTMLElement).closest<HTMLElement>("[data-lang]")?.dataset.lang;
    if (code) chooseLanguage(code);
  });

  attachInput(root, handlers);

  // On-screen controls (toolbar buttons + contextual CTA) live inside the board
  // root; a button click never maps to a cell, so it can share the root.
  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    const action = btn?.dataset.action;
    if (action && isAction(action)) {
      e.stopPropagation();
      onAction(action);
    }
  });

  // History panel: render saved games and wire replay / clear.
  historyPanel = document.getElementById("history");
  historyEntries = loadHistory();
  drawHistory();
  // Tapping the backdrop closes the mobile history bottom sheet.
  document.querySelector(".hist-backdrop")?.addEventListener("click", toggleHistory);
  historyPanel?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".hist-head")) {
      toggleHistory(); // close the sheet (touch) / no-op on desktop
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

  startInitialGame();
  localizeStatic(); // localize the now-built skeleton + the static keys list
  if (!hasChosenLocale()) openLangPicker(); // first visit: ask for a language
}

/** Pick the first screen: deep link, then tutorial, then resume / fresh game. */
function startInitialGame(): void {
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
