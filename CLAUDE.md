# Quadro Affaires
Outil de suivi d'affaire des 3 showrooms Quadro. Utilisateurs : 3 gérants, 6 conceptrices, 2 transverses.
Lire docs/conception.md avant toute tâche ; citer les identifiants EF-, RG-, ENF- dans les commits et PR.
Lire aussi AGENTS.md : Next.js 16 diffère des versions connues (ex. `proxy.ts` remplace `middleware.ts`) ; consulter node_modules/next/dist/docs/ avant d'utiliser une API Next.

## Règles
- Interface en français, vocabulaire de la section 2 : R0-R4, BDC, ARC, BPA, contremarque, CNQ, débit.
- Gesteos et PCloud sont les référentiels : ne jamais dupliquer un document, stocker des références.
- Aucune opération bancaire, aucun envoi de commande fournisseur depuis l'outil.
- Toute règle de gestion vit dans src/lib/rules avec un test ; tout seuil dans la table parametre.
- RLS obligatoire sur chaque table ; tester les droits en pgTAP dans supabase/tests.
- Montants en centimes (integer), dates en Europe/Paris.
- Tout outil externe passe par src/adapters (AuthAdapter, Mailer, FileStore, CalendarSource, Clock) ; jamais d'appel direct depuis le code métier.
- « Aujourd'hui » vient de Clock côté TypeScript et de app_now() / app_today() côté SQL ; jamais now() ni current_date dans le code métier.
- Une affaire peut avoir plusieurs étapes ouvertes (section 7.4) ; etape_courante_code sert à l'affichage, jamais à la logique.
- Aucune donnée réelle de client dans le dépôt ni dans la base de démo.
- Ne pas ajouter de dépendance sans le justifier dans la PR.
- Ne jamais fusionner une PR dont la CI n'est pas verte.

## Base de données (pas de Docker sur le poste)
- Le poste travaille sur le projet Supabase distant lié (supabase link). Pas de supabase start, pas de db diff en local.
- Migrations écrites à la main dans supabase/migrations, une par sujet, puis pnpm db:push et pnpm db:types.
- La CI rejoue toutes les migrations sur une base éphémère et lance les tests pgTAP : une migration qui ne se rejoue pas depuis zéro est un échec.
- pnpm seed:demo remet la base distante dans l'état du scénario de démo ; ne jamais le lancer pendant une présentation.

## Choix techniques (session 1.1)
- Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui (base Base UI), Zod 4, Vitest, Playwright.
- cacheComponents désactivé : rendu dynamique classique, toutes les pages dépendent de l'utilisateur.
- Polices servies depuis src/app/fonts (next/font/local), jamais Google Fonts.
- Code d'accès de la démo vérifié dans src/proxy.ts (src/lib/demo-access.ts).

## Choix techniques (session 1.2)
- Session lue par src/server/session.ts (lireSession), gardes dans src/server/garde.ts (exigerProfil, exigerGerant, exigerModeDemo).
- Clé secrète uniquement via clientAdmin() (src/lib/supabase/server.ts), jamais dans un composant client.
- Horloge de démo = décalage en secondes (parametre.horloge_demo), même règle en SQL (app_now) et en TypeScript (DemoClock).
- Jointures PostgREST depuis profil : préciser la relation (`profil_magasin!profil_magasin_profil_id_fkey(...)`), car created_by crée une seconde clé étrangère vers profil.
- Tests pgTAP : se faire passer pour un utilisateur avec `set local role authenticated` et `set local request.jwt.claims`.

## Charte
Teal 900 #0E3B45, Teal 700 #1B5A66, Teal 500 #2F7A86, Sage 500 #9DBFAE, Sage 100 #E8F0EC, fond #F4F7F6, encre #15262B.
Phases : 01 #3B6E8F, 02 #6B5B95, 03 #B9812E, 04 #3A8073, 05 #B4483F, 06 #5B6472.
États : OK #2F7D5B, attention #B07A1F, retard #B4483F.
Titres Quicksand 700, texte Source Sans 3, références IBM Plex Mono.
Rayons : cartes 12 px, boutons et champs 8 px. Une action principale par écran.
Maquettes de référence : docs/maquettes/.

## Commandes
pnpm dev · pnpm test · pnpm e2e · pnpm lint · pnpm typecheck · pnpm db:push · pnpm db:types · pnpm seed:demo
