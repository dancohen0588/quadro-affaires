# Quadro Affaires

Outil de suivi des affaires des trois showrooms Quadro (Aix La Pioline, Marseille La Valentine, La Ciotat).

- Spécification : [`docs/conception.md`](docs/conception.md)
- Démarrage (comptes, poste, variables) : [`docs/demarrage.md`](docs/demarrage.md)
- Règles de travail avec Claude Code : [`CLAUDE.md`](CLAUDE.md)

## Commandes

```bash
pnpm install
cp .env.example .env.local   # puis remplir
pnpm dev                     # http://localhost:3000
pnpm test                    # tests Vitest
pnpm build && pnpm e2e       # parcours Playwright
pnpm lint && pnpm typecheck
```

Pas de Docker sur le poste : la base de travail est le projet Supabase distant ; la base jetable des tests tourne dans la CI.
