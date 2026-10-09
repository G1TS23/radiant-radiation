# radiant-radiation

Jeu de puzzle minimaliste en style terminal (Astro, 100 % statique) : retourner des cellules avec un pinceau 2×2 jusqu'à ce que la grille ait une seule couleur. En ligne : radiant-radiation.netlify.app.

## Stack et commandes

- Stack : Astro 6, TypeScript strict, Vitest, ESLint, Prettier. Node 24.18.0 (`.nvmrc`).
- Installer : `npm ci`
- Dev : `npm run dev`
- Typecheck : `npm run check`
- Lint / format : `npm run lint` et `npm run format:check` (corriger avec `npm run format`)
- Tests : `npm test`
- Build : `npm run build`

La CI exécute check, test, lint, format:check et build : tout doit passer avant de considérer une tâche terminée.

## Langue

- Code, identifiants, commentaires, messages de commit, noms de branches et titres de PR : **anglais**.
- Documentation : **français** pour les nouveaux documents. Le `README.md` existant est en anglais : reste dans la langue du document que tu modifies.
- Réponses à l'utilisateur : français.

## Stack et outillage

- Versions de runtime épinglées (`.nvmrc`, `rust-toolchain.toml`, `.python-version`).
- Formatage et lint obligatoires avant commit :
  - JS/TS : Prettier + ESLint (`npm run format`, `npm run lint`)
  - Rust : `cargo fmt` + `cargo clippy -- -D warnings`
  - Python : Ruff (`ruff format`, `ruff check`)
- Dependabot activé, avec les mises à jour mineures/patch groupées (`minor-and-patch`).
- N'ajoute pas un outil de lint ou de format à un projet qui n'en a pas sans me le demander.

## Commits

Conventional Commits, un seul sujet par commit :

```
type(scope): description
```

- Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Description à l'impératif, en minuscules, sans point final, 72 caractères max.
- `scope` optionnel : le module ou dossier touché (`ci`, `hooks`, `auth`).
- Corps (si le changement n'est pas évident) : explique le **pourquoi**, ce qui a été vérifié et ce qui reste hors de portée. Ligne vide avant. Un changement trivial se contente d'une ligne.
- Issue liée : pied `Refs #123` (ou `Closes #123` si la PR la résout).
- Rupture de compatibilité : `!` après le type/scope et un pied `BREAKING CHANGE: ...`.
- Un commit = un changement logique. Ne mélange pas refactor et feature.
- Ne commite jamais de code qui ne passe pas les tests.
- Conserve le trailer `Co-Authored-By` ajouté pour Claude.
- Le format est vérifié par le hook `.githooks/commit-msg`. Si un commit est refusé, corrige le message, ne contourne jamais le hook (`--no-verify` interdit).

### Activer les hooks

Les hooks vivent dans `.githooks/` (versionnés) et s'activent automatiquement à l'installation :

```json
"prepare": "git config core.hooksPath .githooks || true"
```

Hors projet Node : `git config core.hooksPath .githooks` une fois après le clone.

## Git et branches

- Ne travaille **jamais** directement sur `main`. Crée une branche : `feat/...`, `fix/...`, `docs/...`, `chore/...` (kebab-case, anglais).
- Tu peux commiter et pousser sur ta branche de travail sans demander.
- Ouvre une PR vers `main` : titre au format Conventional Commits, description courte (contexte, changements, comment tester).
- Merge en **squash**. Tu ne merges jamais toi-même une PR : c'est l'utilisateur qui merge.
- Historique linéaire : squash ou rebase uniquement, pas de merge commit. Avant d'ouvrir une PR, rebase ta branche sur `main` (`git rebase origin/main`).
- Le réglage « linear history » du repo GitHub est activé (à faire dans les settings, pas par Claude).
- Jamais de `push --force` (utilise `--force-with-lease` seulement sur ta propre branche, et uniquement si l'utilisateur le demande).
- Ne réécris pas l'historique déjà poussé sur `main`.

## Style de code

- Lis le code voisin avant d'écrire : suis ses conventions, même si tu en préfères d'autres.
- Fais le plus petit changement qui résout le problème. Pas de refactor, de renommage ou de nettoyage hors périmètre.
- Pas de sur-ingénierie : pas d'abstraction, de config ou de paramètre « au cas où ».
- Early return plutôt que des `if` imbriqués. Fonctions courtes, noms explicites.
- Commentaires rares : ils expliquent le **pourquoi**, jamais ce que le code dit déjà.
- Gère les erreurs aux frontières du système (entrées utilisateur, I/O, réseau), pas partout.
- Pas de code mort, pas de `console.log` / `print` de debug laissé dans le code.

## Tests

- Tout changement de comportement vient avec un test. Un bug corrigé vient avec un test qui l'aurait attrapé.
- Teste le comportement, pas l'implémentation.
- Ne supprime pas et n'affaiblis pas un test pour le faire passer : corrige le code, ou dis pourquoi le test est faux.
- Lance d'abord le test concerné, puis la suite complète avant de pousser.

## Spécificités du projet

- Logique du jeu dans `src/game/`, tests dans `test/` (Vitest). Toute règle de jeu modifiée vient avec un test.
- **Chaque puzzle doit rester résoluble**, et le « par » affiché est le vrai minimum de coups (calculé sur GF(2), le plus court entre solution toute blanche et toute noire). Ne le surestime jamais.
- Le site reste **100 % statique** (Netlify ; `Dockerfile`, `docker-compose*.yml` et `nginx.conf` servent le build). Pas de code serveur.
- La version de Node est alignée dans `.nvmrc`, `netlify.toml` (`NODE_VERSION`), la CI et le champ `engines` : change-les toujours ensemble.
- Dependabot ignore le majeur de TypeScript tant que `@astrojs/check` et `typescript-eslint` ne le supportent pas.

## Sécurité et dépendances

- Jamais de secret, token ou clé dans le code, les logs, les commits ni les messages. Utilise des variables d'environnement. `.env` reste dans `.gitignore`.
- Ne lis pas et n'affiche pas le contenu de fichiers `.env`, clés privées ou credentials.
- Pas de données personnelles dans les logs.
- N'ajoute une dépendance qu'en cas de vrai besoin : dis laquelle, pourquoi, et préfère la stdlib.
- Versions épinglées et lockfile commité. Installe avec `npm ci` (ou équivalent), jamais `npm install` en CI.
- Scripts de cycle de vie désactivés quand c'est possible (`--ignore-scripts`), et exécutés explicitement.
- Ne télécharge et n'exécute jamais de script distant (`curl ... | sh`) sans l'accord de l'utilisateur.

## Demande avant d'agir

Demande une confirmation explicite avant de :
- supprimer des fichiers ou des branches, ou toute action destructive (`rm -r`, `reset --hard`, `DROP`, `TRUNCATE`) ;
- modifier la CI, les workflows, les migrations de base de données ou la config de déploiement ;
- changer la version d'une dépendance majeure ou la version publiée du projet ;
- toucher aux fichiers générés (`dist/`, lockfiles édités à la main).

## Sessions cloud et autonomes

Sans supervision en direct, sois plus prudent, pas plus audacieux :
- Travaille uniquement sur une branche dédiée, ouvre une PR, ne merge pas.
- Ne modifie pas la CI ni les secrets pour « faire passer » un build : signale le problème dans la PR.
- Si une tâche est ambiguë, choisis l'interprétation la plus conservatrice et note ton hypothèse dans la description de la PR.
- Termine par un résumé : ce qui est fait, ce qui reste, ce qui a été vérifié (tests lancés ou non).

## Travailler avec moi

- Réponses courtes et directes. Donne une recommandation plutôt qu'un inventaire d'options.
- Si un test, un lint ou une commande échoue, dis-le avec la sortie. Ne prétends jamais que c'est vérifié si ça ne l'est pas.
- Dis ce que tu as sauté ou ce dont tu n'es pas sûr.
