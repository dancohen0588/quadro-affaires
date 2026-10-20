# Démarrage — comptes, poste et variables

À faire une fois, avant la session 1.1 de J1. Durée : environ 45 minutes. Référence : `docs/conception.md`, sections 5.2, 5.3 et 17.1.

Principe : pas de Docker sur le poste. L'application locale travaille sur un projet Supabase distant ; la base jetable des tests tourne dans GitHub Actions.

---

## 1. Poste (macOS)

```bash
brew install node@22 pnpm gh supabase/tap/supabase
node -v        # v22.x
pnpm -v
supabase -v
gh auth login
```

Pas de Docker, pas d'OrbStack : `supabase start` et `supabase db diff` ne servent pas sur le poste.

---

## 2. GitHub

1. Créer l'organisation **DCO-IT** (offre Free) : github.com → Your organizations → New organization.
2. Créer le dépôt **privé** `quadro-affaires` dans cette organisation, **sans** README, sans .gitignore et sans licence (le kit les apporte).
3. Pousser le kit de démarrage (ce dossier) comme premier commit :

   ```bash
   cd quadro-affaires        # le dossier du kit
   git init -b main
   git add .
   git commit -m "Kit de démarrage : spécification v1.2, CLAUDE.md, maquettes, débit d'exemple anonymisé"
   git remote add origin https://github.com/<org>/quadro-affaires.git
   git push -u origin main
   ```

4. Ajouter trois secrets pour la CI (Settings → Secrets and variables → Actions → New repository secret). Leurs valeurs viennent de l'étape 3 :

   | Secret | Valeur |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | jeton personnel Supabase (étape 3.5) |
   | `SUPABASE_DB_PASSWORD` | mot de passe de la base du projet (étape 3.2) |
   | `SUPABASE_PROJECT_REF` | identifiant du projet (étape 3.3) |

À savoir : sur l'offre Free, les règles de protection de branche ne s'appliquent pas aux dépôts privés (il faut GitHub Team, 4 $ par utilisateur et par mois). En solo, on s'en passe : la règle « pas de fusion sans CI verte » est écrite dans `CLAUDE.md`.

---

## 3. Supabase

1. Créer l'organisation **DCO-IT** (offre Free), séparée de l'organisation Growi.
2. Créer le projet **`quadro-affaires-demo`** :
   - région **West EU (Paris)**, c'est-à-dire `eu-west-3` ;
   - mot de passe de base fort, rangé dans ton gestionnaire de mots de passe.
3. Noter l'identifiant du projet (Project Settings → General → Project ID), par exemple `abcd1234…`.
4. Récupérer les clés (Project Settings → API Keys) :
   - la clé **publishable** (`sb_publishable_…`), utilisable côté navigateur ;
   - la clé **secret** (`sb_secret_…`), **côté serveur uniquement**.
5. Créer un jeton personnel : Account → Access Tokens → Generate new token, nommé « quadro-affaires CLI et CI ».
6. Fermer les inscriptions publiques : Authentication → Sign In / Providers → décocher « Allow new users to sign up ». Les comptes des personnages sont créés par le seed avec la clé secrète, ce réglage ne les bloque pas.
7. Lier le dossier local au projet :

   ```bash
   supabase login
   supabase link --project-ref <SUPABASE_PROJECT_REF>
   ```

   `supabase init` est lancé par Claude Code en session 1.1, s'il n'existe pas encore de dossier `supabase/`. Dans ce cas, refaire `supabase link` après la session.

À savoir sur l'offre gratuite :
- il y a au plus 2 projets gratuits actifs par compte, et le projet Growi en occupe déjà un ;
- un projet sans activité pendant 7 jours est mis en pause. La veille d'une démo, ouvrir le tableau de bord et relancer le projet si besoin (quelques minutes) ;
- il n'y a pas de sauvegarde avec restauration à un instant donné, ce qui est acceptable pour des données fictives. L'offre Pro arrive en B7.

---

## 4. Vercel

1. Créer l'équipe **DCO-IT** en offre **Pro** (20 $ par mois). L'offre Hobby interdit l'usage commercial.
2. Installer l'application GitHub de Vercel sur l'organisation DCO-IT, avec accès au dépôt `quadro-affaires`.
3. **Après la session 1.1** (quand le dépôt contient une application Next.js), importer le dépôt : Add New → Project.
   - Framework : Next.js. Gestionnaire : pnpm (détecté).
   - Settings → Functions → Function Region : **Paris, France (cdg1)**.
   - Settings → Environment Variables : les variables du tableau ci-dessous, pour **Production** et **Preview**.
   - Deployment Protection : garder la protection standard (les previews demandent une connexion Vercel). L'URL de production, qui sert de démo, reste publique et protégée par `DEMO_ACCESS_CODE`.
4. L'URL de démo est l'URL de production du projet, par exemple `quadro-affaires.vercel.app`. Un sous-domaine personnalisé pourra être ajouté plus tard.

---

## 5. Variables d'environnement

Copier `.env.example` en `.env.local` (jamais commité) et remplir :

| Variable | Où la trouver | Local | Vercel | GitHub Actions |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | oui | oui | — |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publishable | oui | oui | — |
| `SUPABASE_SECRET_KEY` | clé secret | oui | oui | — |
| `SUPABASE_PROJECT_REF` | identifiant du projet | oui | — | secret |
| `SUPABASE_DB_PASSWORD` | mot de passe de la base | oui | — | secret |
| `SUPABASE_ACCESS_TOKEN` | jeton personnel | facultatif (sinon `supabase login`) | — | secret |
| `APP_MODE` | `demo` | oui | oui | — |
| `DEMO_ACCESS_CODE` | code choisi, à donner à Jean le jour J | oui | oui | — |
| `DEMO_PERSONA_PASSWORD` | `openssl rand -base64 24` | oui | oui | — |
| `CRON_SECRET` | `openssl rand -hex 32` | oui | oui | — |
| `RESEND_API_KEY` | vide jusqu'au bloc B2 | — | — | — |

---

## 6. Lancer J1

1. Ouvrir le dossier du dépôt dans Claude Code (sur le Mac).
2. Vérifier que les connecteurs GitHub, Supabase et Vercel sont actifs dans Claude Code.
3. Coller le prompt de la session 1.1 (`docs/conception.md`, section 15.3), demander d'abord un plan, le valider.
4. Note pour la session 1.1 : le dossier n'est pas vide (CLAUDE.md, docs/). Si `create-next-app` refuse de s'y installer, Claude Code crée le projet dans un sous-dossier temporaire puis remonte les fichiers, sans écraser `CLAUDE.md`, `.gitignore` ni `docs/`.

## Check-list « prêt pour J1 »

- [ ] Node 22, pnpm, Supabase CLI et `gh` installés ; pas de Docker
- [ ] Organisation GitHub DCO-IT, dépôt privé `quadro-affaires`, kit poussé sur `main`
- [ ] Trois secrets GitHub Actions renseignés
- [ ] Organisation Supabase DCO-IT, projet `quadro-affaires-demo` en eu-west-3, inscriptions publiques fermées
- [ ] `supabase link` fait, `.env.local` rempli
- [ ] Équipe Vercel DCO-IT en Pro, application GitHub installée (import du projet après la session 1.1)
