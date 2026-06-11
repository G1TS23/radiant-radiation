/**
 * i18n.ts — tiny runtime localization. No dependency, no build step.
 *
 * The site is built once (in English); strings are localized in the browser:
 * dynamic text goes through `t()`, static skeleton text carries `data-i18n`
 * attributes patched by `localizeStatic()`. The chosen locale is persisted and
 * can change at any time (see main.ts), which re-runs both paths.
 */

import { getItem, setItem } from "./storage";

export type Locale = "en" | "fr" | "es" | "ja";

/** Languages offered in the picker, with their autonym (never translated). */
export const LOCALES: { code: Locale; name: string }[] = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "ja", name: "日本語" },
];

const LANG_KEY = "rr.lang";

type Catalog = Record<string, string>;

const en: Catalog = {
  "keys.title": "keys",
  "action.move": "move",
  "action.flip": "flip",
  "action.undo": "undo",
  "action.reset": "reset",
  "action.new": "new game",
  "action.difficulty": "difficulty",
  "action.theme": "theme",
  "action.zen": "zen mode",
  "action.skip": "skip",
  "action.history": "history",

  "hud.moves": "moves:",
  "hud.par": "par:",
  "status.solved": ">> solved",
  "status.lost": ">> out of moves",

  "bar.tutorial": "tutorial {current}/{total}",
  "toolbar.diff": "diff: {label}",

  "aria.theme": "toggle theme",
  "aria.zen": "toggle zen mode",
  "title.zen": "zen mode (esc)",
  "aria.lang": "change language",
  "aria.history": "history (toggle)",

  "cta.next": "next puzzle ▶",
  "cta.retry": "retry ↻",
  "cta.continue": "continue ▶",
  "cta.start": "start playing ▶",

  "difficulty.easy": "easy",
  "difficulty.normal": "normal",
  "difficulty.hard": "hard",
  "difficulty.expert": "expert",

  "history.empty": "no games yet",
  "history.clear": "clear history",
  "result.won": "won",
  "result.lost": "lost",
  "aria.replay": "replay {diff} game, {result} in {moves} of {limit} moves",

  "tut.tip": "tip: tap a square — or use arrow keys + space",
  "tut.skip": "skip tutorial →",
  "tut.one.title": "one move",
  "tut.one.instruction":
    "this is the grid. you can flip the shade (black/white) of a 2×2 block of 4 cells. the goal is to fill the grid with a single shade. here, one move turns it all white.",
  "tut.one.success": "nice! you can move on to the next step.",
  "tut.two.title": "two moves",
  "tut.two.instruction":
    "that was too easy. here's a step up. by combining several moves you can fill the grid with black. follow the hints.",
  "tut.two.success": "great! combining moves is the heart of the game.",
  "tut.three.title": "your turn",
  "tut.three.instruction":
    "now solve this one without hints. you can use as many moves as you like.",
  "tut.three.success":
    "you're ready for the adventure! have fun, and remember: you can fill the grid with white or black.",

  "announce.new": "new {diff} puzzle, {n} by {n}",
  "announce.replay": "replaying {diff} puzzle, {n} by {n}",
  "announce.cursor": "cursor row {row}, column {col}",
  "announce.solved.one": "solved in {n} move",
  "announce.solved.other": "solved in {n} moves",
  "announce.lost": "out of moves",
  "announce.count": "{black} black, {white} white",

  "lang.prompt": "Choose your language",
};

const fr: Catalog = {
  "keys.title": "touches",
  "action.move": "déplacer",
  "action.flip": "inverser",
  "action.undo": "annuler",
  "action.reset": "réinitialiser",
  "action.new": "nouvelle partie",
  "action.difficulty": "difficulté",
  "action.theme": "thème",
  "action.zen": "mode zen",
  "action.skip": "passer",
  "action.history": "historique",

  "hud.moves": "coups :",
  "hud.par": "par :",
  "status.solved": ">> résolu",
  "status.lost": ">> plus de coups",

  "bar.tutorial": "tutoriel {current}/{total}",
  "toolbar.diff": "diff : {label}",

  "aria.theme": "changer le thème",
  "aria.zen": "basculer le mode zen",
  "title.zen": "mode zen (échap)",
  "aria.lang": "changer de langue",
  "aria.history": "historique (afficher/masquer)",

  "cta.next": "puzzle suivant ▶",
  "cta.retry": "réessayer ↻",
  "cta.continue": "continuer ▶",
  "cta.start": "commencer ▶",

  "difficulty.easy": "facile",
  "difficulty.normal": "normal",
  "difficulty.hard": "difficile",
  "difficulty.expert": "expert",

  "history.empty": "aucune partie",
  "history.clear": "effacer l'historique",
  "result.won": "gagnée",
  "result.lost": "perdue",
  "aria.replay": "rejouer la partie {diff}, {result} en {moves} sur {limit} coups",

  "tut.tip": "astuce : tape une case — ou flèches + espace",
  "tut.skip": "passer le tutoriel →",
  "tut.one.title": "un coup",
  "tut.one.instruction":
    "voici la grille. tu peux inverser les nuances (noir/blanc) de 4 cases (2×2). le but est de remplir la grille d'une seule nuance. ici, un seul coup et tout passe en blanc.",
  "tut.one.success": "bravo ! tu peux passer à l'étape suivante.",
  "tut.two.title": "deux coups",
  "tut.two.instruction":
    "c'était trop facile. voici un niveau de difficulté supplémentaire. en combinant plusieurs coups, tu peux remplir la grille de noir. suis les indications.",
  "tut.two.success": "très bien ! combiner les coups est le cœur du jeu.",
  "tut.three.title": "à toi",
  "tut.three.instruction":
    "maintenant, résous ce puzzle sans indice. tu peux utiliser autant de coups que tu veux.",
  "tut.three.success":
    "tu es prêt pour l'aventure ! amuse-toi bien, et n'oublie pas : tu peux remplir la grille de blanc ou de noir.",

  "announce.new": "nouveau puzzle {diff}, {n} par {n}",
  "announce.replay": "rejeu du puzzle {diff}, {n} par {n}",
  "announce.cursor": "curseur ligne {row}, colonne {col}",
  "announce.solved.one": "résolu en {n} coup",
  "announce.solved.other": "résolu en {n} coups",
  "announce.lost": "plus de coups",
  "announce.count": "{black} noires, {white} blanches",

  "lang.prompt": "Choisissez votre langue",
};

const es: Catalog = {
  "keys.title": "teclas",
  "action.move": "mover",
  "action.flip": "voltear",
  "action.undo": "deshacer",
  "action.reset": "reiniciar",
  "action.new": "nueva partida",
  "action.difficulty": "dificultad",
  "action.theme": "tema",
  "action.zen": "modo zen",
  "action.skip": "saltar",
  "action.history": "historial",

  "hud.moves": "movs:",
  "hud.par": "par:",
  "status.solved": ">> resuelto",
  "status.lost": ">> sin movimientos",

  "bar.tutorial": "tutorial {current}/{total}",
  "toolbar.diff": "dif: {label}",

  "aria.theme": "cambiar tema",
  "aria.zen": "alternar modo zen",
  "title.zen": "modo zen (esc)",
  "aria.lang": "cambiar idioma",
  "aria.history": "historial (abrir/cerrar)",

  "cta.next": "siguiente ▶",
  "cta.retry": "reintentar ↻",
  "cta.continue": "continuar ▶",
  "cta.start": "empezar ▶",

  "difficulty.easy": "fácil",
  "difficulty.normal": "normal",
  "difficulty.hard": "difícil",
  "difficulty.expert": "experto",

  "history.empty": "aún no hay partidas",
  "history.clear": "borrar historial",
  "result.won": "ganada",
  "result.lost": "perdida",
  "aria.replay": "repetir partida {diff}, {result} en {moves} de {limit} movimientos",

  "tut.tip": "consejo: toca una casilla — o flechas + espacio",
  "tut.skip": "saltar tutorial →",
  "tut.one.title": "un movimiento",
  "tut.one.instruction":
    "esta es la cuadrícula. puedes invertir el tono (negro/blanco) de un bloque 2×2 de 4 casillas. el objetivo es llenar la cuadrícula de un solo tono. aquí, un solo movimiento y todo se vuelve blanco.",
  "tut.one.success": "¡bien! puedes pasar al siguiente paso.",
  "tut.two.title": "dos movimientos",
  "tut.two.instruction":
    "eso fue demasiado fácil. aquí tienes un nivel más. combinando varios movimientos puedes llenar la cuadrícula de negro. sigue las indicaciones.",
  "tut.two.success": "¡muy bien! combinar movimientos es el corazón del juego.",
  "tut.three.title": "tu turno",
  "tut.three.instruction":
    "ahora resuelve este sin pistas. puedes usar tantos movimientos como quieras.",
  "tut.three.success":
    "¡estás listo para la aventura! diviértete, y recuerda: puedes llenar la cuadrícula de blanco o de negro.",

  "announce.new": "nuevo puzzle {diff}, {n} por {n}",
  "announce.replay": "repitiendo puzzle {diff}, {n} por {n}",
  "announce.cursor": "cursor fila {row}, columna {col}",
  "announce.solved.one": "resuelto en {n} movimiento",
  "announce.solved.other": "resuelto en {n} movimientos",
  "announce.lost": "sin movimientos",
  "announce.count": "{black} negras, {white} blancas",

  "lang.prompt": "Elige tu idioma",
};

const ja: Catalog = {
  "keys.title": "キー",
  "action.move": "移動",
  "action.flip": "反転",
  "action.undo": "取り消し",
  "action.reset": "リセット",
  "action.new": "新しいゲーム",
  "action.difficulty": "難易度",
  "action.theme": "テーマ",
  "action.zen": "禅モード",
  "action.skip": "スキップ",
  "action.history": "履歴",

  "hud.moves": "手数:",
  "hud.par": "パー:",
  "status.solved": ">> クリア",
  "status.lost": ">> 手数切れ",

  "bar.tutorial": "チュートリアル {current}/{total}",
  "toolbar.diff": "難易度: {label}",

  "aria.theme": "テーマを切り替え",
  "aria.zen": "禅モードを切り替え",
  "title.zen": "禅モード (esc)",
  "aria.lang": "言語を変更",
  "aria.history": "履歴 (開閉)",

  "cta.next": "次のパズル ▶",
  "cta.retry": "やり直す ↻",
  "cta.continue": "続ける ▶",
  "cta.start": "プレイ開始 ▶",

  "difficulty.easy": "やさしい",
  "difficulty.normal": "ふつう",
  "difficulty.hard": "むずかしい",
  "difficulty.expert": "達人",

  "history.empty": "まだ記録がありません",
  "history.clear": "履歴を消去",
  "result.won": "クリア",
  "result.lost": "失敗",
  "aria.replay": "{diff}のゲームを再挑戦、{limit}手中{moves}手で{result}",

  "tut.tip": "ヒント: マスをタップ — または矢印キー + スペース",
  "tut.skip": "チュートリアルをスキップ →",
  "tut.one.title": "ひと手",
  "tut.one.instruction":
    "これがグリッドです。2×2の4マスの濃淡（白黒）を反転できます。目的はグリッドを1色で埋めること。ここでは1手ですべて白になります。",
  "tut.one.success": "いいね！次のステップに進めます。",
  "tut.two.title": "ふた手",
  "tut.two.instruction":
    "簡単すぎましたね。少し難しくします。複数の手を組み合わせると、グリッドを黒で埋められます。指示に従ってください。",
  "tut.two.success": "お見事！手を組み合わせるのがこのゲームの核心です。",
  "tut.three.title": "あなたの番",
  "tut.three.instruction": "今度はヒントなしで解いてみよう。手数はいくらでも使えます。",
  "tut.three.success":
    "冒険の準備は完了です！楽しんでね。グリッドは白でも黒でも埋められることをお忘れなく。",

  "announce.new": "新しい{diff}パズル、{n}×{n}",
  "announce.replay": "{diff}パズルを再挑戦、{n}×{n}",
  "announce.cursor": "カーソル {row}行 {col}列",
  "announce.solved.one": "{n}手でクリア",
  "announce.solved.other": "{n}手でクリア",
  "announce.lost": "手数切れ",
  "announce.count": "黒{black}、白{white}",

  "lang.prompt": "言語を選択",
};

/** All catalogs (exported for the coverage test). */
export const messages: Record<Locale, Catalog> = { en, fr, es, ja };

let current: Locale = "en";

export function getLocale(): Locale {
  return current;
}

/** Set the active locale without persisting (e.g. the auto-detected default). */
export function setLocale(l: Locale): void {
  current = l;
}

/** Set the active locale and remember it as the user's explicit choice. */
export function chooseLocale(l: Locale): void {
  current = l;
  setItem(LANG_KEY, l);
}

export function isLocale(s: string | null): s is Locale {
  return !!s && LOCALES.some((x) => x.code === s);
}

/** True once the user has explicitly picked a language (drives the picker). */
export function hasChosenLocale(): boolean {
  return isLocale(getItem(LANG_KEY));
}

/** Stored choice, else the browser language if supported, else English. */
export function detectLocale(): Locale {
  const stored = getItem(LANG_KEY);
  if (isLocale(stored)) return stored;
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  return isLocale(nav) ? nav : "en";
}

const fill = (s: string, params?: Record<string, string | number>): string => {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
};

/** Translate a key, interpolating {params}. Falls back to English, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = messages[current][key] ?? messages.en[key] ?? key;
  return fill(s, params);
}

/** Plural-aware translate: picks `${key}.${pluralForm}` for the count `n`. */
export function tn(key: string, n: number, params?: Record<string, string | number>): string {
  const form = new Intl.PluralRules(current).select(n);
  return t(`${key}.${form}`, { n, ...params });
}

/** (Re)apply the catalog to all static-text nodes under `scope`. */
export function localizeStatic(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  scope.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria!));
  });
  scope.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.dataset.i18nTitle!));
  });
}
