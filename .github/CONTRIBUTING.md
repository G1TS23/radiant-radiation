# Contributing to radiant-radiation

Thanks for your interest in improving the game! This is a small, dependency-light
project, so contributing is quick to get into.

## Getting started

```sh
npm install
npm run dev        # local dev server (http://localhost:4321)
```

Or with Docker (live hot reload):

```sh
docker compose -f docker-compose.dev.yml up --build   # http://localhost:4321
```

## Before opening a pull request

Run the same checks CI does — all four must pass:

```sh
npm run check         # astro / TypeScript type-check (strict)
npm test              # unit tests (Vitest)
npm run lint          # ESLint
npm run format:check  # Prettier (use `npm run format` to fix)
npm run build         # static build -> dist/
```

## Project layout

The game logic is pure and DOM-free, kept separate from rendering and wiring:

| File                     | Responsibility                               |
| ------------------------ | -------------------------------------------- |
| `src/game/engine.ts`     | pure game logic & puzzle generation (no DOM) |
| `src/game/render.ts`     | idempotent DOM rendering                     |
| `src/game/input.ts`      | keyboard / pointer input                     |
| `src/game/view-model.ts` | pure session → view mapping                  |
| `src/game/main.ts`       | orchestration (wires it together)            |
| `src/game/history.ts`    | `localStorage` persistence                   |
| `src/game/i18n.ts`       | dependency-free runtime translations         |

Guidelines:

- Keep `engine.ts` pure and covered by tests in `*.test.ts`.
- New user-facing strings go through `i18n.ts` — add the key to **all** locales
  (EN/FR/ES/JA); a test guards key parity across locales.
- Match the surrounding style; Prettier + ESLint are the source of truth.
- Update the docs (README, this file) when behaviour or workflow changes.

## Commits & PRs

- Write clear, focused commits (conventional-commit prefixes like `feat:`,
  `fix:`, `docs:`, `chore:` are appreciated but not required).
- Keep PRs scoped to one change; describe what and why.
- Be kind and constructive — see the [Code of Conduct](./CODE_OF_CONDUCT.md).
