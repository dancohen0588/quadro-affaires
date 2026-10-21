# Quadro Affaires — Spécification de la V1

| | |
| --- | --- |
| Client | Groupe Quadro (JVB Holding) : Jean Farhat, Valentin Tramoni, Benjamin Tramoni |
| Rédaction | Dan Cohen, DCO-IT |
| Version | 1.2 du 20 octobre 2026 : socle sans Docker (base distante + base éphémère en CI), horloge de démo côté SQL, étapes ouvertes en parallèle, accès à la démo protégé, débit d'exemple anonymisé |
| Sources | Cadre de pilotage du Groupe Quadro (25/09/2026), Process de suivi d'affaire Quadro 2026 (trame HTML), étude de faisabilité v4 (20/10/2026), réponses de Jean Farhat du 12/10/2026, débit AGEM d'exemple (29/09/2026, copie anonymisée), plan de classement Quadro |
| Usage | Référence fonctionnelle et technique pour développer l'outil avec Claude Code. À placer dans le dépôt sous `docs/conception.md`. |

Les exigences sont numérotées (`EF-xx` pour le fonctionnel, `ENF-xx` pour le non fonctionnel, `RG-xx` pour les règles de gestion) afin d'être citées dans les prompts, les tests et les pull requests. « Doit » signifie obligatoire en V1, « peut » signifie souhaitable.

---

## Sommaire

1. Objet et périmètre
2. Glossaire
3. Utilisateurs et rôles
4. Décisions de conception
5. Architecture technique
6. Modèle de données
7. Modèle de process 2026 (étapes, tâches, issues, documents)
8. Règles de gestion
9. Écrans et exigences fonctionnelles
10. Indicateurs de pilotage
11. Notifications et digests
12. Droits d'accès
13. Imports, exports et intégrations
14. Exigences non fonctionnelles
15. Plan de construction avec Claude Code
16. Méthode de travail et contenu de CLAUDE.md
17. Prérequis
18. Points ouverts

---

## 1. Objet et périmètre

### 1.1 Objet

Quadro Affaires est un outil web de suivi des affaires pour les trois showrooms Quadro (Aix La Pioline, Marseille La Valentine, La Ciotat). Il transforme la trame « Process de suivi d'affaire 2026 » en tâches datées et assignées, rappelle à chacun ce qu'il doit faire, suit les règlements clients et donne aux gérants une vue consolidée de l'activité.

Il répond aux causes d'échec citées par les gérants : manque de rappels, trop d'outils différents, process complet mais difficile à suivre.

### 1.2 Ce que fait la V1

- Suivre chaque affaire de l'accueil (R0) à l'archivage, étape par étape.
- Générer et rappeler les tâches de chacun : conceptrices, gérants, Elsie, Adrian.
- Remplacer Microsoft To Do (tâches libres) et le groupe WhatsApp « Planning de livraison et pose » (demande et confirmation de planning).
- Suivre l'échéancier de règlement de chaque vente et alerter sur les règlements non reçus.
- Suivre les commandes AGEM et autres fournisseurs (ARC, BPA, AR).
- Donner aux gérants un pipeline, des indicateurs et une vue pour la réunion du mardi.

### 1.3 Ce que la V1 ne fait pas

- Devis, chiffrage, remises, factures : restent dans Gesteos.
- Opérations bancaires, envoi des commandes fournisseurs : jamais faits par l'outil.
- Stockage de documents : PCloud reste la GED. L'outil y range des fichiers à partir du bloc B3 (simulé dès la démo).
- Application téléphone : l'outil est conçu pour l'ordinateur (affichage tablette correct).
- Lecture des boîtes mail et classement des factures : lot administratif séparé (section 15.7).

### 1.4 Volumes de référence

| Donnée | Valeur |
| --- | --- |
| Ventes | ~15 par mois et par magasin, ~45 par mois pour le groupe, ~550 par an |
| Affaires actives par conceptrice | 20 à 30 |
| Utilisateurs | 3 gérants, 6 conceptrices, 2 transverses (11 comptes) |
| Clients qui reviennent | ~30 % |
| Délai cible accueil → BDC | 2 semaines |

---

## 2. Glossaire

| Terme | Définition |
| --- | --- |
| Affaire | Un projet pour un client (cuisine, dressing, entrée, bibliothèque, placard, bureau…). Un client peut en avoir plusieurs. |
| Vente | La signature d'un BDC. Une vente regroupe une ou plusieurs affaires d'un même client (cuisine + dressing = 2 affaires, 1 vente). |
| Concepteur / conceptrice | La personne qui porte l'affaire du R0 à la clôture. Peut être une conceptrice ou un gérant (Jean vend aussi). |
| R0 | Accueil du client en magasin (rendez-vous ou passage). |
| R1 | Rendez-vous de découverte. L'affaire est créée au plus tard à ce moment. |
| R2 | Rendez-vous d'approfondissement à domicile, avec relevé des mesures. |
| R3, R3.n | Rendez-vous de présentation du projet. Sans vente et si le projet n'est pas mort : R3.2, R3.3, etc. |
| R4 | Rendez-vous de fin de chantier (photos), fait par Elsie. |
| CNQ | Contact non qualifié : personne dont on n'a pas pu prendre les coordonnées. |
| BDC | Bon de commande signé par le client. |
| Débit | Fichier Word généré par Gesteos qui détaille une commande AGEM (lignes, dimensions, points, prix d'achat). |
| ARC | Accusé de réception de commande d'AGEM : la commande est reçue, le délai est donné. |
| BPA | Bon pour accord donné par Benjamin sur la confirmation de commande AGEM, avant mise en fabrication. Versions v1.01, v2.01… |
| AR | Accusé de réception d'une commande à un autre fournisseur (électroménager, sanitaires, plan de travail…). |
| Contremarque | Référence de la commande chez AGEM, au nom du client (ex. fictif : « SAS VISIOLAB Julien ROUSSEL »). |
| Transtock | Dépôt logistique où AGEM livre (« TRANSTOCK 66 », Marseille 11e). |
| Méthode Qaméléon | Méthode de vente du groupe ; sa trame servira de check-list de l'accueil à la présentation. |
| Gesteos | CRM / ERP du groupe : contacts, devis, commandes, règlements, factures. Pas d'API ; exports CSV ou Excel. |
| PCloud | GED du groupe. Un dossier par client, sous-dossiers 01 à 12 copiés depuis le modèle « NOUVEAU CLIENT ». |
| INEXWEB | Plateforme de transmission des pièces au comptable. |

---

## 3. Utilisateurs et rôles

| Personne | Rôle dans l'outil | Magasin(s) | Usage principal |
| --- | --- | --- | --- |
| Jean Farhat | Gérant, administrateur | La Valentine, La Ciotat | Règlements, factures récapitulatives, commissions, pilotage, réunion du mardi. Vend aussi. |
| Valentin Tramoni | Gérant, administrateur | Aix, La Ciotat (logistique des 3 magasins) | Planning de livraison et de pose, vérification des dossiers de pose. |
| Benjamin Tramoni | Gérant, administrateur | Tous | BPA AGEM, plans AGEM dans les dossiers de pose, appui technique. |
| Clara, Léa | Conceptrices | La Valentine | Leurs affaires du R0 à la clôture. |
| Alexia, Lisa-Marie | Conceptrices | Aix La Pioline | Idem. |
| Manon, Eva | Conceptrices | La Ciotat (pilote) | Idem. |
| Elsie | Transverse (communication) | Tous, rubriques R4 et avis | R4 de fin de chantier, demandes d'avis Google. |
| Adrian | Transverse (pose, BAJV Agencements) | Tous, rubrique dossiers de pose | Consultation des dossiers de pose. |

La liste exacte des utilisateurs et de leurs adresses est fournie par Jean (section 17).

---

## 4. Décisions de conception

| # | Sujet | Réponse des gérants (12/10) | Décision |
| --- | --- | --- | --- |
| D1 | Client et affaire | Un client peut avoir plusieurs affaires ; ~30 % reviennent | Trois objets : client → affaires → vente |
| D2 | Identifiant affiché | PCloud : Nom / Prénom / (conceptrice) ; Gesteos : Nom Prénom ; AGEM : contremarque au nom du client | Libellé : `NOM Prénom · Projet` ; contremarque stockée, préremplie avec le nom du client (ou la raison sociale) |
| D3 | Création | Au R1 au plus tard, idéalement au R0, coordonnées parfois absentes | Contact rapide au R0 (CNQ possible) ; affaire au R1 au plus tard |
| D4 | R3 sans vente | R3.2, R3.3… tant que le projet n'est pas mort, sinon relance convenue | Boucle R3.n sans limite ; sortie « perdue » avec motif obligatoire |
| D5 | Point technique | Systématique | Tâche systématique |
| D6 | Validation des plans par Benjamin | Rarement faite | Tâche optionnelle, non bloquante |
| D7 | Acompte 1 | Pas de commande AGEM sans acompte 1 | Seule règle bloquante de la V1 (RG-01) |
| D8 | Échéancier | 40 / 50 / 10 ; Franfinance sur acompte 2 et solde ; chèques échelonnés | Échéancier généré, lignes modifiables (RG-10 à RG-13) |
| D9 | Suivi des règlements | Des règlements passent inaperçus | Date attendue, statut et alerte par échéance |
| D10 | Dossier de pose | Complet après le BPA ; conceptrice + Benjamin + vérification Valentin | Trois tâches assignées à trois personnes |
| D11 | Clôture | Facture récapitulative par Jean quand tout est payé ; R4 par Elsie | Tâches générées automatiquement |
| D12 | Avis Google | R1 sans suite, R3 après vente, R4, envoi de la facture, relance téléphone | Cinq points de demande ; arrêt dès qu'un avis est obtenu |
| D13 | Planning | Dates écrites dans WhatsApp, gérant qui valide | Demande de planning dans l'outil, confirmée par Valentin |
| D14 | Tâches | To Do est un dépannage ; les gérants ont aussi leurs tâches | Tâches libres pour tous, files par gérant |
| D15 | Fichiers | Tout pourrait passer par l'outil ; les menuisiers lisent PCloud | Dépôt dans l'outil, renommage et rangement dans PCloud (simulé en J5, réel en B3) |
| D16 | Gesteos | Exports CSV ou Excel, pas d'API | Import des exports (format réel en B4), jamais d'écriture vers Gesteos |
| D17 | Retard | Commerce : > 2 semaines entre R1 et R3 ; après-vente : BPA trop tard | Deux alertes de retard natives (RG-20, RG-21) |
| D18 | Réunion du mardi | Équipe commerciale + Elsie en visio Teams | Vue « Point du mardi » et digest du lundi |
| D19 | Indicateurs individuels | Visibles par tous dans Gesteos | Visibles par l'équipe ; alertes centrées sur les affaires |
| D20 | Administration | Les trois gérants | Trois administrateurs |
| D21 | Support | Pas besoin du téléphone | Ordinateur d'abord |
| D22 | Pilote | La Ciotat | Pilote La Ciotat, puis La Valentine et Aix |
| D23 | Débit AGEM | Généré par Gesteos, avec prix d'achat et points | Lu automatiquement au dépôt (J5, sans accès requis) ; le prix d'achat alimente la marge estimée |
| D24 | Clients professionnels | La contremarque de l'exemple est une société | Client de type particulier ou professionnel |
| D25 | Gérants vendeurs | Jean est concepteur de l'affaire d'exemple | Un gérant peut être concepteur |

---

## 5. Architecture technique

### 5.1 Vue d'ensemble

```
            Utilisateurs (navigateur, ordinateur)
                          │
          ┌───────────────▼────────────────┐
          │  Quadro Affaires · Vercel (cdg1)│
          │  Application Next.js            │──► Resend (mails)
          │  Tâches planifiées (cron)       │┄┄► PCloud API (B3)
          └───────────────┬────────────────┘
                          │ lecture / écriture
          ┌───────────────▼────────────────┐
          │  Supabase · région Paris        │◄── Microsoft 365 / Entra ID (identité)
          │  Auth (provider Azure)          │┄┄  Outlook via Microsoft Graph (B5)
          │  PostgreSQL + RLS               │◄┄┄ Exports Gesteos CSV/Excel (B4)
          └────────────────────────────────┘
  ──── V1        ┄┄┄ intégrations après la V1
```

### 5.2 Choix

| Brique | Choix | Raison |
| --- | --- | --- |
| Interface | Next.js (App Router), TypeScript strict, Tailwind CSS, shadcn/ui | Pile bien maîtrisée par Claude Code, composants accessibles |
| Logique serveur | Server Actions et Route Handlers Next.js | Pas de serveur séparé à maintenir |
| Données | Supabase PostgreSQL, Row Level Security | Droits appliqués dans la base |
| Identité | Supabase Auth, provider Azure (Entra ID), domaine magasin-quadro.fr | Comptes Microsoft 365 existants, aucun mot de passe géré |
| Tâches planifiées | Vercel Cron appelant des routes protégées par secret | Alertes et digests |
| Mails | Resend, domaine d'envoi magasin-quadro.fr | Simple ; Microsoft Graph possible plus tard |
| Validation | Zod (formulaires, process JSON, imports) | Un schéma par entrée |
| Tests | Vitest (logique), Playwright (parcours), tests SQL des RLS (pgTAP, exécutés en CI) | Critères d'acceptation exécutables |
| Hébergement | Vercel région cdg1 (Paris), Supabase eu-west-3 (Paris) | Données en France |
| Poste de développement | Node 22 LTS, pnpm, Supabase CLI, GitHub CLI ; **pas de Docker** | La base de travail est un projet Supabase distant ; la base jetable des tests tourne dans GitHub Actions |
| Coût | Démo : ~20 $ / mois (Vercel Pro ; Supabase et Resend en offre gratuite). Production : ~45 $ / mois (Vercel Pro, Supabase Pro, Resend gratuit jusqu'à 3 000 mails / mois) | Le plan Hobby de Vercel interdit l'usage commercial ; à confirmer à l'ouverture des comptes |

Les versions exactes des dépendances sont fixées en J1, à partir des dernières versions stables à cette date.

### 5.3 Environnements

Aucun Docker sur le poste de développement. Pendant la phase de démo, un seul projet Supabase distant sert au développement, aux previews et à la démo ; `pnpm seed:demo` le remet dans l'état du scénario avant chaque présentation. La base jetable des tests est créée dans GitHub Actions, où Docker est disponible.

| Environnement | Base | URL | Déploiement |
| --- | --- | --- | --- |
| Local | Projet Supabase distant `quadro-affaires-demo` (Paris), lié par `supabase link` | localhost | `pnpm dev` |
| CI | Supabase éphémère sur le runner GitHub Actions (`supabase start`) : toutes les migrations rejouées depuis zéro, tests RLS (`supabase test db`), tests Vitest | — | À chaque PR |
| Preview | Même projet distant `quadro-affaires-demo` | URL Vercel par branche | Automatique à chaque PR |
| Démo | Même projet distant, `APP_MODE=demo` | URL de production Vercel (ex. `quadro-affaires.vercel.app`) | Automatique à la fusion sur `main`, suivi de `pnpm seed:demo` avant chaque présentation |
| Production | Projet Supabase `prod` au nom du groupe (B7) | domaine à définir (ex. affaires.magasin-quadro.fr) | Automatique à la fusion sur `main` |

Migrations :
- Pendant la démo, Claude Code applique les migrations de la branche en cours au projet distant (`supabase db push`), car l'application locale en a besoin. La CI vérifie en parallèle qu'elles se rejouent proprement sur une base vierge.
- Un job de la CI applique les migrations au projet distant à chaque fusion sur `main` (idempotent).
- Un deuxième projet distant `dev` s'ajoute dès que Supabase passe en offre Pro (au plus tard en B7), pour séparer le développement de la démo puis de la production.
- `supabase db diff` demande Docker : les migrations s'écrivent à la main (ce que fait Claude Code), une migration par sujet.

### 5.4 Mode démo et adaptateurs

Chaque outil externe est caché derrière une interface (un « adaptateur »). La variable `APP_MODE` (`demo` ou `production`) choisit l'implémentation. Le code métier n'appelle jamais un outil directement.

| Interface | Implémentation démo (disponible dès la démo) | Implémentation réelle (après la démo) |
| --- | --- | --- |
| `AuthAdapter` | Page « Choisir un personnage » : connexion en un clic à des comptes Supabase créés par le seed, changement de personnage depuis le menu | Provider Azure (Microsoft 365), domaine magasin-quadro.fr (B1) |
| `Mailer` | Boîte d'envoi interne : chaque mail est enregistré dans `mail_sortant` et lisible dans l'outil, rendu identique au mail réel | Resend (B2) ; la boîte d'envoi reste comme journal |
| `FileStore` | PCloud simulé dans Supabase Storage (bucket `pcloud-demo`) : même arborescence, même renommage, écran « PCloud (simulé) » | API PCloud (B3) |
| `CalendarSource` | Les RDV saisis dans l'outil (table `rdv`) | Agendas Outlook via Microsoft Graph (B5) |
| `Clock` | Horloge de démo : heure réelle décalée du réglage `parametre.horloge_demo` (`{"decalage_secondes": N}`), réglable par un gérant ; le temps continue de s'écouler ; chaque avance exécute les traitements de nuit pour les jours franchis | Heure système, Europe/Paris |
| Traitements de nuit | Déclenchés par l'horloge de démo ou un bouton | Vercel Cron |
| Import Gesteos | Fichiers CSV d'exemple au format supposé | Exports réels (B4) |

Règles du mode démo :
- un bandeau permanent « Démonstration — données fictives » ;
- aucune donnée réelle de client en base de démo ;
- l'accès à l'URL de démo exige un code partagé (`DEMO_ACCESS_CODE`), saisi une fois puis gardé en cookie : sans lui, la page des personnages serait ouverte à quiconque connaît l'URL ;
- la page des personnages et ses routes renvoient 404 quand `APP_MODE=production` (test automatique) ;
- la commande `pnpm seed:demo` remet la base dans l'état de départ du scénario de démonstration (section 15.5) ;
- les droits (RLS) sont les mêmes qu'en production : la démo montre le vrai cloisonnement par magasin.

Horloge côté base : la date simulée doit être vue par le SQL aussi, sinon les triggers et les vues d'indicateurs restent à la date réelle pendant que l'interface avance. Deux fonctions SQL du schéma `prive`, `app_now()` (timestamptz) et `app_today()` (date, Europe/Paris), renvoient l'heure système décalée de `parametre.horloge_demo.decalage_secondes` (zéro si le réglage est nul). Un décalage plutôt qu'une date figée : deux écritures successives gardent leur ordre pendant la démo. Elles remplacent `now()` et `current_date` dans tous les triggers, vues et fonctions métier. L'adaptateur `Clock` côté TypeScript lit la même valeur.

---

## 6. Modèle de données

### 6.1 Conventions

- Clés primaires `id uuid default gen_random_uuid()`.
- Toutes les tables ont `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid` (profil).
- Montants en centimes, type `integer` (`montant_ttc_cts`). Aucun calcul monétaire en flottant.
- Dates métier en `date`, horodatages en `timestamptz`, affichage en Europe/Paris.
- « Maintenant » côté SQL : toujours `app_now()` et `app_today()` (section 5.4), jamais `now()` ni `current_date` dans le code métier.
- Énumérations en `text` avec contrainte `check`, listes métier modifiables dans `parametre`.
- Suppression logique (`archive_le`) pour clients, affaires, ventes ; aucune suppression physique côté interface.
- RLS activée sur toutes les tables (section 12).

### 6.2 Tables

#### `societe`
| Champ | Type | Règle |
| --- | --- | --- |
| nom | text | JVB La Valentine, JVB Aix, JVB La Ciotat, BAJV Agencements, JVB Holding |
| code | text unique | VAL, AIX, CIO, BAJV, HOLD |
| siren | text | facultatif |

#### `magasin`
| Champ | Type | Règle |
| --- | --- | --- |
| nom | text | Aix La Pioline, Marseille La Valentine, La Ciotat |
| code | text unique | AIX, VAL, CIO |
| societe_id | uuid → societe | |
| adresse, telephone | text | |
| pcloud_root_id | text | dossier racine des clients du magasin (B3) |

#### `profil`
| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid | = `auth.users.id` |
| prenom, nom, email | text | email du domaine magasin-quadro.fr, unique |
| role | text | `gerant`, `conceptrice`, `transverse` |
| est_admin | boolean | vrai pour les trois gérants |
| rubriques | text[] | pour les transverses : `r4_avis`, `dossiers_pose` |
| actif | boolean | un profil inactif ne peut plus se connecter |
| initiales | text | affichage dans les pastilles |

#### `profil_magasin`
| Champ | Type | Règle |
| --- | --- | --- |
| profil_id | uuid → profil | |
| magasin_id | uuid → magasin | clé primaire composée |

#### `client`
| Champ | Type | Règle |
| --- | --- | --- |
| type | text | `particulier`, `professionnel` |
| raison_sociale | text | obligatoire si professionnel |
| nom | text | obligatoire, stocké en majuscules pour l'affichage |
| prenom | text | |
| telephone, email | text | facultatifs (CNQ) |
| adresse, code_postal, ville | text | adresse du chantier par défaut |
| cnq | boolean | vrai si aucune coordonnée |
| source | text | liste `parametre.sources_contact` (passage, recommandation, internet, salon, client existant…) |
| magasin_id | uuid → magasin | magasin du premier contact |
| gesteos_ref | text | référence client Gesteos si connue |
| rappel_convenu_le | date | date de rappel convenue au R0 |

Index de recherche : `nom`, `prenom`, `raison_sociale`, `telephone`, `email` (trigram).

#### `affaire`
| Champ | Type | Règle |
| --- | --- | --- |
| client_id | uuid → client | |
| magasin_id | uuid → magasin | |
| concepteur_id | uuid → profil | conceptrice ou gérant |
| projet | text | liste `parametre.types_projet` (cuisine, dressing, entrée, bibliothèque, placard, bureau, salle de bain, autre) |
| libelle | text | calculé : `NOM Prénom · Projet` (ou raison sociale), modifiable |
| libelle_manuel | boolean | vrai si le libellé a été modifié à la main : il n'est plus recalculé (RG-03) |
| contremarque | text | préremplie avec `NOM Prénom` ou la raison sociale, modifiable |
| statut | text | `active`, `gagnee`, `perdue`, `abandonnee`, `cloturee` |
| motif_perte | text | obligatoire si `perdue` ou `abandonnee` ; liste `parametre.motifs_non_vente` |
| montant_devis_ht_cts | integer | dernier montant de devis connu |
| process_version_id | uuid → process_version | figé à la création |
| etape_courante_code | text | étape la plus avancée de la branche principale ; sert à l'affichage (pipeline, en-tête), jamais à la logique du moteur (section 7.4) |
| vente_id | uuid → vente | nul tant que non vendue |
| derniere_activite_at | timestamptz | mis à jour par trigger sur toute écriture liée |
| pcloud_folder_id, pcloud_url | text | créé dans le PCloud simulé en démo (J5), dans PCloud en B3 |
| avis_google_obtenu_le | date | arrête les demandes d'avis |

#### `vente`
| Champ | Type | Règle |
| --- | --- | --- |
| client_id | uuid → client | |
| date_signature | date | |
| magasin_id | uuid → magasin | magasin de la vente (ajout v1.2 : droits et indicateurs par magasin) |
| montant_ht_cts, montant_ttc_cts | integer | montants du BDC |
| financement | text | `aucun`, `franfinance` |
| gesteos_devis_ref | text | ex. D20260928#4538 |
| commission_saisie_le | date | entrée au tableau de commission (RG-14) |

Une vente a au moins une affaire (`affaire.vente_id`), toutes du même client.

#### `echeance`
| Champ | Type | Règle |
| --- | --- | --- |
| vente_id | uuid → vente | |
| type | text | `acompte_1`, `acompte_2`, `solde`, `autre` |
| ordre | integer | |
| pourcentage | numeric(5,2) | informatif |
| montant_prevu_cts | integer | somme des lignes = montant TTC de la vente (RG-11) |
| date_attendue | date | voir RG-12 |
| mode | text | `cheque`, `cb`, `virement`, `especes`, `franfinance` |
| recu_le | date | nul tant que non reçu |
| montant_recu_cts | integer | |
| saisi_par | uuid → profil | |
| commentaire | text | ex. « chèque à encaisser le 15/11 » |

#### `rdv`
| Champ | Type | Règle |
| --- | --- | --- |
| affaire_id | uuid → affaire | nul pour un R0 sans affaire (contact seul) |
| client_id | uuid → client | |
| type | text | `R0`, `R1`, `R2`, `R3`, `R4`, `point_technique`, `point_strategique` |
| rang | integer | 1 pour R3, 2 pour R3.2, etc. |
| debut | timestamptz | |
| profil_id | uuid → profil | qui fait le RDV |
| statut | text | `prevu`, `fait`, `annule` |
| notes | text | |

#### `process_version`
| Champ | Type | Règle |
| --- | --- | --- |
| nom | text | « 2026 v1 » |
| definition | jsonb | voir section 7.1, validée par Zod |
| active | boolean | une seule active à la fois |
| publiee_le, publiee_par | | |

#### `etape_instance`
| Champ | Type | Règle |
| --- | --- | --- |
| affaire_id | uuid → affaire | |
| etape_code | text | code de l'étape dans la définition |
| phase_code | text | phase de l'étape (`accueil` … `cloture`), copiée de la définition ; sert aux droits des transverses |
| branche | text | `principale`, `autres_fournisseurs`, `sav` |
| iteration | integer | 1 par défaut ; 2, 3… pour R3.n et SAV |
| statut | text | `a_venir`, `en_cours`, `faite`, `sautee`, `bloquee` |
| issue_code | text | issue choisie à la validation |
| motif | text | si l'issue l'exige |
| debut_at, fin_at | timestamptz | |
| valide_par | uuid → profil | |

#### `tache`
| Champ | Type | Règle |
| --- | --- | --- |
| affaire_id | uuid → affaire | nul pour une tâche libre |
| etape_instance_id | uuid → etape_instance | nul hors process |
| client_id | uuid → client | rappel convenu au R0, pour un contact sans affaire (RG-35) |
| modele_code | text | code de la tâche modèle, pour éviter les doublons |
| titre, detail | text | |
| assignee_id | uuid → profil | |
| echeance | date | |
| statut | text | `a_faire`, `faite`, `annulee` |
| origine | text | `process`, `relance`, `avis`, `alerte`, `libre` |
| optionnelle | boolean | n'empêche pas de valider l'étape |
| fait_le, fait_par | | |

#### `commande_fournisseur`
| Champ | Type | Règle |
| --- | --- | --- |
| affaire_id | uuid → affaire | |
| fournisseur | text | `AGEM` ou nom libre |
| iteration | integer | 2+ pour une recommande SAV |
| gesteos_commande_ref | text | ex. C20260929#848 |
| envoyee_le | date | |
| semaine_demandee | text | ex. `2026-S44` |
| lieu_livraison | text | ex. TRANSTOCK 66 |
| prix_achat_cts | integer | total du débit |
| points | numeric(10,2) | total du débit |
| arc_recu_le | date | AGEM |
| ar_recu_le | date | autres fournisseurs |
| semaine_annoncee | text | délai donné par l'ARC ou l'AR |
| confirmation_recue_le | date | confirmation AGEM à vérifier |
| bpa_version | text | v1.01, v2.01… |
| bpa_donne_le | date | |
| statut | text | `a_passer`, `envoyee`, `arc_recu`, `en_verification`, `bpa_donne`, `livree` |

#### `planning`
| Champ | Type | Règle |
| --- | --- | --- |
| vente_id | uuid → vente | |
| semaine_livraison_souhaitee | text | |
| date_pose_souhaitee | date | |
| semaine_livraison_confirmee | text | |
| date_pose_confirmee | date | |
| poseur | text | |
| statut | text | `demandee`, `confirmee`, `decalee` |
| demande_par, confirme_par | uuid → profil | |
| commentaire | text | |

#### `document` (J5 en simulé, B3 en réel)
| Champ | Type | Règle |
| --- | --- | --- |
| affaire_id | uuid → affaire | |
| etape_instance_id | uuid | |
| type_doc | text | code du document attendu (section 7.3) |
| nom_original, nom_final | text | |
| dossier_pcloud | text | chemin relatif dans le dossier client |
| pcloud_file_id | text | |
| version | integer | |
| depose_par | uuid → profil | |

#### `mail_sortant`
| Champ | Type | Règle |
| --- | --- | --- |
| destinataire_id | uuid → profil | |
| destinataire_email | text | |
| type | text | `digest_quotidien`, `digest_lundi`, `planning`, `bpa`, `facture_recap`, `autre` |
| objet | text | |
| html | text | rendu complet du mail |
| genere_le | timestamptz | date simulée en démo |
| envoye_le | timestamptz | nul en démo ; renseigné par Resend en production |

#### `journal`
| Champ | Type | Règle |
| --- | --- | --- |
| table_nom, ligne_id | text, uuid | |
| action | text | `insert`, `update`, `delete`, `validation`, `import` |
| avant, apres | jsonb | |
| auteur_id | uuid | |
| at | timestamptz | |
| affaire_id, vente_id, client_id | uuid | rattachement de la trace (historique d'une fiche, EF-40, et droits de lecture) ; vides pour une suppression |

Alimenté par trigger générique sur les tables métier et le référentiel ; les mises à jour qui ne touchent que des colonnes techniques (`updated_at`, `derniere_activite_at`, `etape_courante_code`) ne sont pas journalisées. Lecture seule : chacun lit l'historique de ce qu'il voit, les gérants tout. Table en ajout seul, sans `updated_at`. La trace d'une insertion est datée du `created_at` de la ligne (reprise d'historique), celle d'une mise à jour de l'heure courante.

#### `parametre`
| Champ | Type | Règle |
| --- | --- | --- |
| cle | text unique | |
| valeur | jsonb | |

Clés initiales :

| Clé | Valeur par défaut |
| --- | --- |
| `types_projet` | cuisine, dressing, entrée, bibliothèque, placard, bureau, salle de bain, autre |
| `sources_contact` | passage, recommandation, internet, réseaux sociaux, salon, client existant, autre |
| `motifs_non_vente` | prix, délai, concurrent, réflexion longue, projet abandonné, injoignable, autre |
| `echeancier_standard` | acompte_1 40 %, acompte_2 50 %, solde 10 % |
| `seuils` | voir section 8.3 |
| `gerant_logistique` | profil de Valentin |
| `gerant_bpa` | profil de Benjamin |
| `gerant_finance` | profil de Jean |
| `responsable_r4` | profil d'Elsie |
| `horloge_demo` | nul ; en mode démo `{"decalage_secondes": N}`, décalage lu par `app_now()` et l'adaptateur `Clock` ; toujours nul en production |

---

## 7. Modèle de process 2026

### 7.1 Format de la définition

La définition est un JSON (`process/2026-v1.json`) validé en deux temps : sa forme par le schéma Zod `src/lib/process/schema.ts`, sa cohérence par `src/lib/process/valider.ts` (codes uniques, cibles existantes, sens des types d'issue, étapes atteignables depuis le départ, au moins une issue qui clôture). Structure :

```ts
type ProcessDefinition = { nom: string; depart: string; phases: Phase[] };   // depart : "R0"
type Phase = { code: CodePhase; numero: string; nom: string; couleur: string; etapes: Etape[] };
type CodePhase = "accueil" | "conception" | "vente" | "commande" | "livraison_pose" | "cloture";
type Etape = {
  code: string;                     // stable, ex. "R1"
  titre: string;
  branche?: "principale" | "autres_fournisseurs" | "sav";
  responsable: Role;                // qui valide l'étape
  repetable?: boolean;              // R3, COMMANDE_AGEM, ARC, BPA, SAV
  bloquee_si?: "acompte_1_non_recu"[];
  taches: TacheModele[];
  documents: DocumentAttendu[];
  issues: Issue[];
};
type Role = "concepteur" | "gerant_bpa" | "gerant_logistique" | "gerant_finance" | "responsable_r4";
type TacheModele = { code: string; titre: string; assignee: Role; echeance: Echeance; optionnelle?: boolean;
  avis_google?: boolean };      // demande d'avis : non créée si l'avis est déjà obtenu (RG-36)
type EcheanceSimple =
  | { depuis: "ouverture_etape" | "date_pose" | "date_livraison" | "fin_chantier"; jours: number; ouvres?: boolean }
  | { depuis: "rdv"; rdv?: "R0" | "R1" | "R2" | "R3" | "R4"; jours: number; ouvres?: boolean } // par défaut le RDV de l'étape
  | { depuis: "aucune" };                                                                     // « à réception »
type Echeance = EcheanceSimple | { premiere_de: [EcheanceSimple, EcheanceSimple] };            // « J+5 ou J-7 avant la pose »
type DocumentAttendu = { code: string; libelle: string; dossier: string; gabarit_nom?: string; formats: ("jpg" | "heic" | "pdf" | "docx" | "xlsx")[] };
type Issue = {
  code: string; libelle: string;
  type: "go" | "loop" | "end" | "alert" | "wait" | "fin_branche";
  vers?: string;                    // étape suivante
  ouvre?: { etape: string; optionnel?: boolean; question?: string }[];  // étapes ouvertes en parallèle (7.4)
  motif_obligatoire?: boolean;
  demande_date?: boolean;           // relance convenue, R3.n
  relance_jours?: number;           // R2 sans réponse : relance à J+7 (RG-34)
  demande_avis_google?: boolean;    // D12
  vers_si_avis_obtenu?: string;     // R4 : archivage direct si l'avis est déjà obtenu
  statut_affaire?: "perdue" | "abandonnee" | "gagnee" | "cloturee";
};
```

Règles des types d'issue : `go` indique `vers` ; `loop` reboucle sur sa propre étape, qui doit être répétable ; `end` fixe le statut de l'affaire (motif obligatoire si perdue ou abandonnée, RG-06) ; `wait` demande une date ou une relance ; `fin_branche` termine une branche sans étape suivante (autres fournisseurs, facture récapitulative). `demande_avis_google` crée une tâche d'avis sur une issue `end` (R1 sans suite, R3 perdue) ; sur les autres issues, la demande est portée par les tâches marquées `avis_google` de l'étape.

### 7.2 Étapes de la version 2026 v1

Rôles : **C** concepteur, **B** Benjamin (`gerant_bpa`), **V** Valentin (`gerant_logistique`), **J** Jean (`gerant_finance`), **E** Elsie (`responsable_r4`). Échéances relatives : J = jour d'ouverture de l'étape sauf mention.

#### Phase 01 — Accueil & découverte (#3B6E8F)

| Code | Étape | Resp. | Tâches (assigné, échéance) | Issues |
| --- | --- | --- | --- | --- |
| R0 | Accueil client | C | Noter le RDV ou le passage dans l'agenda (C, J) · Créer le contact, ou cocher CNQ (C, J) · Si un rappel est convenu, saisir sa date (C, J) | `r1_pris` → R1 · `rappel_convenu` (date) → relance à la date · `pas_de_r1` (motif) → fin |
| R1 | Découverte | C | Créer la ou les affaires (C, J) · Positionner le R2 et le R3 (C, J) · Positionner le point technique et le point stratégique (C, J) · Enregistrer photos, plans, inspirations dans PCloud 01 (C, J+1) | `r2_pris` → R2 · `pas_de_r2` (motif) → fin + demande d'avis Google |

#### Phase 02 — Conception (#6B5B95)

| Code | Étape | Resp. | Tâches | Issues |
| --- | --- | --- | --- | --- |
| R2 | Approfondissement à domicile | C | Préparer le matériel de relevé (C, RDV-1) · Préparer le relevé : plans, adresse, échantillons (C, RDV-1) · Réaliser l'existant après le R2 (C, RDV+1) · Faire vérifier l'existant (C, RDV+2) · Point technique avec Benjamin ou Valentin (C, RDV+3) | `conception` → CONCEPTION · `sans_reponse` → relance J+7 (RG-34) · `abandon` (motif) → fin |
| CONCEPTION | Conception | C | Enregistrer les photos du relevé dans PCloud 01 → Relevés-Métrés (C, J+1) · Passer la check-list AGEM (C, avant R3) | `pret` → PREP_R3 |
| PREP_R3 | Préparation de la présentation | C | Point technique et stratégique (C, R3-3 à R3-2) | `pret` → R3 |

#### Phase 03 — Vente (#B9812E)

| Code | Étape | Resp. | Tâches | Issues |
| --- | --- | --- | --- | --- |
| R3 (répétable) | Présentation | C | Check-list Qaméléon (C, RDV) · Noter le compte rendu dans les notes du RDV (C, RDV) | `vente` → VENTE · `r3_suivant` (date) → nouvelle itération R3 (R3.n) · `relance_convenue` (date) → relance · `perdue` (motif) → fin + demande d'avis |
| VENTE | Vente | C | Vérifier remises, TVA et chiffrage dans Gesteos (C, J) · Faire signer le BDC avec plans et visuels, remettre le cadeau client (C, J) · Créer la vente et son échéancier dans l'outil (C, J) · Saisir les dates souhaitées de livraison et de pose (C, J) · Demander un avis Google (C, J) · Éditer la facture d'acompte 1 dans Gesteos si chèque ou CB (C, J) | `vendu` → ACOMPTE_1 |
| ACOMPTE_1 | Règlement acompte 1 | C | Vérifier la réception de l'acompte 1 (C, J+3) | `recu` → PREP_COMMANDE (ouvre aussi la branche autres fournisseurs si besoin) |

#### Phase 04 — Commande (#3A8073)

| Code | Étape | Resp. | Tâches | Issues |
| --- | --- | --- | --- | --- |
| PREP_COMMANDE | Préparation au passage de commande | C | Vérifications et dernières questions, plans carrés (C, J+2) · Validation des plans par Benjamin (B, J+2, **optionnelle**) | `pret` → COMMANDE_AGEM |
| COMMANDE_AGEM | Passage de commande AGEM | C | Envoyer la commande à AGEM via Gesteos avec plans et visuels définitifs (C, J+1) · Enregistrer le débit Word dans PCloud 05 (C, J+1) · Saisir n° de commande, semaine demandée, prix d'achat et points (C, J+1 ; prérempli par la lecture du débit) | **Bloquée si acompte 1 non reçu (RG-01)** · `envoyee` → ARC |
| ARC | Réception ARC | C | Enregistrer l'ARC dans PCloud 06 (C, à réception) · Saisir la semaine annoncée (C, à réception) | `recu` → BPA |
| BPA | Confirmation AGEM et BPA | B | Enregistrer la confirmation et les plans dans PCloud 06 → 02-BPA (B, à réception) · Enregistrer les retours ADV (B) · Donner le BPA (B, J+3 ouvrés) | `bpa_donne` → BL · `nouvelle_version` → nouvelle version de BPA |
| BL | Édition du BL | C | Éditer le BL dans Gesteos (enlever l'inutile, surligner l'acompte 2) et l'enregistrer dans PCloud 07 (C, J+2) | `fait` → PLANNING_LIVRAISON |
| PLANNING_LIVRAISON | Confirmation livraison AGEM et Transtock | V | Confirmer « Livraison AGEM S00 et TRANSTOCK S00 » pour la contremarque (V, J+2) | `confirme` → DOSSIER_POSE |
| DOSSIER_POSE | Dossier de pose | C | Éditer le dossier de pose Gesteos, ajouter plans 2020 avec vue d'implantation et visuels dans PCloud 08 (C, J+3) · Vérifier l'échéancier et la liste de fournitures (C, J+3) · Ajouter les plans AGEM (B, J+3) · Vérifier le dossier avant impression pour les menuisiers (V, J+5 ou J-7 avant la pose) | `complet` → MAIL_AVANT_POSE |
| AF_COMMANDE (branche autres fournisseurs) | Commande autres fournisseurs | C | Commander via le canal du fournisseur (C, J+2) · Saisir la commande manuelle dans Gesteos (C, J+2) | `envoyee` → AF_AR |
| AF_AR | Réception AR autres fournisseurs | C | Enregistrer l'AR dans PCloud 06 → AR AUTRES FOURNISSEURS (C, à réception) · Valider le délai (C, à réception) | `recu` → AF_LISTE |
| AF_LISTE | Liste fourniture poseur | C | Remplir la liste dans PCloud 08 (C, J+2) | `fait` → AF_CARTONS |
| AF_CARTONS | Cartons de fournitures | C | Réceptionner, trier, ranger par contremarque, numéroter 1/2, 2/2 (C, à réception) · Passer la fiche fournitures en vert (C) | `fait` → fin de branche |

#### Phase 05 — Livraison & pose (#B4483F)

| Code | Étape | Resp. | Tâches | Issues |
| --- | --- | --- | --- | --- |
| MAIL_AVANT_POSE | Mail récapitulatif avant pose | C | Envoyer « Les clés d'une installation réussie ! » (C, date de pose − 10 j) | `envoye` → ACOMPTE_2 |
| ACOMPTE_2 | Règlement livraison | C | Vérifier la réception de l'acompte 2 (C, date de livraison + 2 j) | `recu` → POSE |
| POSE | Pose | C | Enregistrer les photos des menuisiers dans PCloud 12 (C, date de pose + 3 j) | `ok` → SOLDE · `sav` → SAV |
| SAV (répétable) | SAV | C | Enregistrer les photos du SAV dans PCloud 10 ou 11 (C, J+1) · Si besoin, repasser commande AGEM (nouvelle itération COMMANDE_AGEM → ARC → BPA) (C) · Valider la date d'intervention (V, J+3) · Tâche d'intervention (V) | `sav_ok` → SOLDE |

#### Phase 06 — Clôture (#5B6472)

| Code | Étape | Resp. | Tâches | Issues |
| --- | --- | --- | --- | --- |
| SOLDE | Règlement du solde | C | Vérifier la réception du solde (C, fin de chantier + 7 j) | `recu` → FACTURE_RECAP |
| FACTURE_RECAP | Facture récapitulative | J | Éditer et envoyer la facture récapitulative avec la demande d'avis Google (J, J+3) | `envoyee` → R4 |
| R4 | Rendez-vous de fin de chantier | E | Prendre les photos de fin de chantier (E, J+15) · Demander un avis Google (E, RDV) | `fait` → RELANCE_AVIS si pas d'avis, sinon ARCHIVAGE |
| RELANCE_AVIS | Relance avis Google | C | Relancer par téléphone (C, J+7) | `fait` → ARCHIVAGE |
| ARCHIVAGE | Archivage | C | Archiver dans Gesteos et dans PCloud (C, J+3) | `archive` → affaire `cloturee` |

Toute fin d'affaire sans vente (`pas_de_r1`, `pas_de_r2`, `abandon`, `perdue`) mène à ARCHIVAGE avec statut `perdue` ou `abandonnee`. L'issue `archive` de l'archivage ne passe en `cloturee` qu'une affaire vendue : une affaire perdue ou abandonnée garde son statut.

R4 peut être fait avant FACTURE_RECAP si le solde arrive tard : le moteur ouvre R4 dès la fin de chantier (issue `ok` de POSE ou `sav_ok` de SAV), en parallèle de SOLDE et FACTURE_RECAP ; la facture récapitulative termine sa branche (`fin_branche`).

### 7.3 Documents attendus et nommage PCloud

| Code | Étape | Dossier PCloud (dans le dossier client) | Gabarit de nom |
| --- | --- | --- | --- |
| `entree_client` | R1 | 01 - Données d'Entrée | libre |
| `releve` | CONCEPTION | 01 - Données d'Entrée / Relevés-Métrés | libre |
| `bdc` | VENTE | 03 - BDC (à confirmer) | `BDC {CONTREMARQUE} - {Projet}` |
| `debit_agem` | COMMANDE_AGEM | 05 - Commande AGEM et autres fournisseurs / Commande AGEM | nom Gesteos conservé |
| `arc_agem` | ARC | 06 - ARC-BPA AGEM et autres fournisseurs / ARC-BPA AGEM / AR | `AR AGEM - {CONTREMARQUE} - {Projet} - S{SEM}` |
| `bpa` | BPA | 06 - … / ARC-BPA AGEM / 02-BPA | `v{N}.01` |
| `retour_adv` | BPA | 06 - … / ARC-BPA AGEM / 02-BPA | `S00-00-0000000-{CLIENT}-{PROJET}-RETOUR SUR V{N}` |
| `ar_fournisseur` | AF_AR | 06 - … / AR AUTRES FOURNISSEURS | `AR {FOURNISSEUR} - {CONTREMARQUE} - {Projet} - S{SEM}` |
| `bl` | BL | 07 - Livraison | `BL {CONTREMARQUE} - Livraison S{SEM}` |
| `dossier_pose` | DOSSIER_POSE | 08 - Pose | à définir |
| `liste_fournitures` | AF_LISTE | 08 - Pose | `{Client} - {Projet} - liste fourniture poseur` |
| `photos_sav` | SAV | 10 - SAV ou 11 - Compléments | libre |
| `photos_finales` | POSE | 12 - Photos Finales | libre |

La liste complète des sous-dossiers 01 à 12 du modèle « NOUVEAU CLIENT » est à fournir (section 17). En V1, ces documents s'affichent comme liste de contrôle sur la fiche affaire ; dès J5, le dépôt dans l'outil applique le gabarit et range le fichier (PCloud simulé, puis réel en B3).

Formats acceptés : photos JPEG ou HEIC, plans et visuels JPEG ou PDF, documents Word et Excel.

### 7.4 Étapes ouvertes en parallèle

Une affaire peut avoir plusieurs étapes `en_cours` en même temps :
- la branche autres fournisseurs (AF_COMMANDE → AF_CARTONS), ouverte à la réception de l'acompte 1, avance en parallèle de PREP_COMMANDE → DOSSIER_POSE ;
- R4 s'ouvre dès la fin de chantier, en parallèle de SOLDE et FACTURE_RECAP ;
- un SAV peut relancer une itération COMMANDE_AGEM → ARC → BPA pendant que la branche principale attend.

Le moteur raisonne donc toujours sur l'ensemble des `etape_instance` ouvertes de l'affaire : ouverture, validation, blocage et calcul des tâches se font étape par étape. `affaire.etape_courante_code` n'est qu'un résumé d'affichage (l'étape ouverte la plus avancée de la branche principale, sans compter le R4 ouvert en parallèle : une affaire au solde affiche SOLDE ; à défaut une étape d'une autre branche, comme SAV ; sans étape ouverte, la dernière étape faite), recalculé après chaque validation ; aucune règle ne s'appuie dessus. Une affaire ne passe à ARCHIVAGE que lorsque toutes ses branches ouvertes sont terminées.

Recommande AGEM pendant un SAV : l'action « Repasser une commande AGEM » ouvre une nouvelle itération de COMMANDE_AGEM dans la branche `sav` ; ARC puis BPA suivent dans cette branche, et la chaîne s'arrête après le BPA (pas de nouveau BL). Le SAV reste ouvert pendant la recommande.

### 7.5 Moteur et écriture en base

Le moteur (`src/lib/process/moteur.ts`) est pur : il reçoit l'état de l'affaire (étapes, tâches à faire, statut, acompte 1 reçu, avis obtenu) et une demande, et renvoie un refus motivé ou la liste des effets à écrire (fermer et ouvrir des étapes, annuler et créer des tâches, créer un RDV R3.n, changer le statut, recalculer l'étape courante). « Aujourd'hui » lui est fourni par Clock. Les server actions `validerEtape` et `repasserCommandeSav` lisent l'état avec les droits de l'utilisateur, appellent le moteur, puis `public.appliquer_effets(affaire, effets, ouvertes)`, qui écrit tout ou rien :
- elle vérifie les droits (section 12) et refuse si les étapes ouvertes ont changé depuis la lecture (deux validations simultanées) ;
- elle résout les rôles des tâches : concepteur de l'affaire, référent désigné dans `parametre`, et concepteur à défaut de référent ;
- un RDV R3.n est posé à 10 h, heure de Paris, chez le concepteur ; l'heure se corrige ensuite dans le RDV.

---

## 8. Règles de gestion

### 8.1 Blocage

| ID | Règle |
| --- | --- |
| RG-01 | L'étape COMMANDE_AGEM ne peut pas être validée tant qu'aucune échéance `acompte_1` de la vente n'a `recu_le` renseigné. Le bouton est désactivé et le motif affiché. Aucun autre blocage dur en V1. La base le garantit aussi par trigger, pour toute écriture faite au nom d'un utilisateur. |

### 8.2 Affaires et process

| ID | Règle |
| --- | --- |
| RG-02 | Un contact peut exister sans affaire (R0). Une affaire exige un client et un concepteur. |
| RG-03 | Le libellé d'une affaire est `NOM Prénom · Projet`, ou `Raison sociale · Projet` pour un professionnel. Il est recalculé si le client change de nom, sauf s'il a été modifié à la main. |
| RG-04 | Une affaire garde la version de process avec laquelle elle a été créée. |
| RG-05 | Valider une étape exige le choix d'une issue. Les tâches non optionnelles non faites sont signalées mais n'empêchent pas la validation (sauf RG-01) ; elles passent en `annulee` avec trace au journal. |
| RG-06 | Une issue `end` ou `perdue` exige un motif choisi dans `motifs_non_vente`. |
| RG-07 | Une issue qui demande une date (R3.n, relance convenue) crée le RDV ou la tâche de relance à cette date. |
| RG-08 | Une vente ne peut regrouper que des affaires du même client, toutes au statut `active`. À la création de la vente, ces affaires passent `gagnee` et ouvrent ACOMPTE_1. |
| RG-09 | `derniere_activite_at` est mis à jour à chaque écriture sur l'affaire, ses étapes, tâches, RDV, échéances et commandes. Une ligne insérée avec une date passée (reprise d'historique, seed de démo) date l'activité de sa création ; la dernière activité ne recule jamais. |

### 8.3 Règlements

| ID | Règle |
| --- | --- |
| RG-10 | À la création d'une vente, l'échéancier est généré depuis `echeancier_standard` (40 / 50 / 10) sur le montant TTC. |
| RG-11 | Les arrondis se font au centime ; l'écart d'arrondi est porté sur le solde. La somme des échéances doit égaler le montant TTC, sinon l'enregistrement est refusé. |
| RG-12 | Dates attendues : acompte 1 = date de signature ; acompte 2 = date de livraison confirmée ; solde = date de pose confirmée + durée de chantier (par défaut 0) ou date de fin de SAV. |
| RG-13 | Les lignes sont modifiables (chèques échelonnés, Franfinance sur acompte 2 et solde seulement). Un mode `franfinance` est refusé sur l'acompte 1. |
| RG-14 | Quand l'acompte 1 est reçu, `vente.commission_saisie_le` peut être renseigné (rappel au concepteur). Le tableau de commission reste hors outil en V1 (point ouvert). |
| RG-15 | Quand toutes les échéances sont reçues, une tâche FACTURE_RECAP est créée pour Jean. |

### 8.4 Seuils et alertes (valeurs dans `parametre.seuils`)

| ID | Règle | Déclencheur | Effet | Défaut |
| --- | --- | --- | --- | --- |
| RG-20 | Retard commerce | R1 fait, ni vente ni affaire perdue après N jours | Alerte affaire + tâche concepteur « Relancer le projet » | 14 j |
| RG-21 | Retard BPA | Confirmation AGEM reçue, BPA non donné après N jours ouvrés | Alerte Benjamin et gérants | 3 j ouvrés |
| RG-22 | ARC non reçu | Commande envoyée, pas d'ARC après N jours ouvrés | Tâche concepteur « Relancer AGEM » | 5 j ouvrés |
| RG-23 | AR non reçu | Commande autre fournisseur envoyée, pas d'AR après N jours ouvrés | Tâche concepteur | 5 j ouvrés |
| RG-24 | Acompte 1 non reçu | Date de signature + N jours | Alerte règlement (concepteur + Jean) | 3 j |
| RG-25 | Acompte 2 non reçu | Date de livraison + N jours | Alerte règlement | 2 j |
| RG-26 | Solde non reçu | Date attendue + N jours | Alerte règlement | 7 j |
| RG-27 | Inactivité | Affaire active sans activité depuis N jours | Point rouge dans le pipeline | 10 j |
| RG-28 | Dossier de pose incomplet | Date de pose − N jours, étape DOSSIER_POSE non faite | Alerte Valentin et concepteur | 7 j |
| RG-29 | Livraison menacée | Semaine annoncée par l'ARC postérieure à la semaine de livraison confirmée | Alerte Valentin et concepteur | — |

### 8.5 Règles d'organisation (avertissements non bloquants)

| ID | Règle | Défaut |
| --- | --- | --- |
| RG-30 | Au plus N R2 par jour et par concepteur ; au-delà, avertissement à la saisie | 1 |
| RG-31 | Au plus N R3 par semaine (lundi-dimanche) et par concepteur | 4 |
| RG-32 | Après un RDV fait sans notes, rappel au concepteur le lendemain | — |

### 8.6 Relances et avis

| ID | Règle | Défaut |
| --- | --- | --- |
| RG-33 | R0 sans rappel convenu : aucune relance | — |
| RG-34 | R2 fait, client sans réponse (issue `sans_reponse`) : tâche de relance | J+7 |
| RG-35 | Relance convenue : tâche à la date saisie | — |
| RG-36 | Demandes d'avis Google aux cinq moments (R1 sans suite, vente, R4, facture récapitulative, relance téléphone) ; aucune demande dès que `avis_google_obtenu_le` est renseigné | — |

### 8.7 Calendrier

Jours ouvrés : lundi à vendredi, hors jours fériés français (liste en dur pour 2026-2028, modifiable). Fuseau : Europe/Paris. « Aujourd'hui » vient toujours de l'adaptateur `Clock` côté TypeScript et de `app_today()` côté SQL.

---

## 9. Écrans et exigences fonctionnelles

Navigation latérale (teal) : Ma journée, Mes affaires, Pipeline, Planning, Règlements, Pilotage (gérants), Administration (gérants). Recherche globale dans la barre du haut (clients, affaires, contremarques, références Gesteos).

### 9.1 Connexion
- EF-01 Connexion par compte Microsoft 365 du domaine magasin-quadro.fr uniquement.
- EF-02 Un compte sans profil actif voit « Accès non autorisé, contactez un gérant ».
- EF-03 Déconnexion depuis le menu utilisateur.

### 9.2 Ma journée (écran par défaut)
- EF-10 Liste des tâches assignées à l'utilisateur, échéance aujourd'hui ou dépassée, groupées par affaire, triées par échéance ; badge « Retard N j », « Aujourd'hui ».
- EF-11 Cocher une tâche la marque faite (une action, annulable 10 secondes).
- EF-12 Reporter une tâche (nouvelle date, motif facultatif).
- EF-13 Créer une tâche libre : titre, échéance, assigné (soi par défaut, ou un collègue), affaire facultative.
- EF-14 Encadré « Règles de la semaine » : R2 du jour / max, R3 de la semaine / max.
- EF-15 Encadré « Relances » : relances dues avec bouton vers l'affaire.
- EF-16 Encadré « Règlements à suivre » : échéances attendues ou en retard de mes affaires.
- EF-17 Pour un gérant : sections supplémentaires selon son rôle (BPA à donner, plannings à confirmer, dossiers de pose à vérifier, factures récapitulatives à éditer).
- EF-18 Onglet « À venir » : tâches des 7 prochains jours.

### 9.3 Clients et affaires
- EF-20 Créer un contact rapide au R0 : nom obligatoire, autres champs facultatifs, case CNQ, source, date de rappel convenue.
- EF-21 À la saisie du nom ou du téléphone, proposer les clients existants (client qui revient) ; empêcher un doublon exact nom + téléphone.
- EF-22 Fiche client : coordonnées, affaires passées et en cours, ventes, RDV.
- EF-23 Créer une ou plusieurs affaires pour un client (projet, concepteur, magasin) ; libellé et contremarque préremplis.
- EF-24 Liste « Mes affaires » : filtres phase, étape, statut, inactivité, concepteur (gérants), magasin (gérants) ; tri par prochaine échéance ; 30 lignes lisibles sans défilement horizontal sur un portable 13 pouces.
- EF-25 Clore une affaire perdue ou abandonnée avec motif.

Précisions (session 3.1) :
- le contact rapide crée un client sans affaire (R0) ; les affaires se créent depuis la fiche client, au R0 (à rappeler) ou au R1 (découverte), une par projet, dans la version de process active (`public.creer_affaires`, tout ou rien) ;
- la détection des clients existants cherche dans les trois magasins, sans tenir compte des accents ni des espaces des numéros (`public.rechercher_clients`) ; un client d'un autre magasin reçoit une affaire sans être ressaisi et devient alors visible ; le doublon exact nom + téléphone est refusé par un index unique ;
- la clôture (EF-25) n'est proposée qu'avant la vente : les étapes ouvertes passent `sautee`, leurs tâches sont annulées et l'archivage s'ouvre ;
- Ma journée : les relances dues sont dans l'encadré « Relances » et non dans la liste « À faire » ; une tâche cochée reste affichée, barrée, jusqu'au lendemain ; les jauges et « Mes affaires » ne s'affichent que pour qui porte des affaires ; « Règlements à suivre » montre les échéances attendues sous 7 jours ou en retard (toutes pour le gérant finance) ;
- files des gérants (EF-17) selon le rôle de référent : BPA à donner (retard au-delà de 3 jours ouvrés), plannings à confirmer et dossiers de pose (gérant logistique), factures récapitulatives (gérant finance) ;
- RG-30 et RG-31 : à l'ajout d'un RDV, le dépassement est signalé sans bloquer.

### 9.4 Fiche affaire
- EF-30 En-tête : libellé, client (lien), magasin, concepteur, contremarque, montant devis ou BDC, statut, étape courante, lien PCloud.
- EF-31 Timeline des 6 phases ; pour chaque étape : statut, tâches cochables, issue choisie, date, validée par.
- EF-32 Bouton « Valider l'étape » : choix d'issue, motif ou date si exigé (RG-05 à RG-07) ; blocage RG-01 affiché clairement. Si plusieurs étapes sont ouvertes (section 7.4), l'utilisateur choisit laquelle il valide.
- EF-33 Branche « autres fournisseurs » et itérations (R3.n, SAV) visibles comme sous-parcours.
- EF-34 Bloc RDV : liste, ajout (type, date, heure, notes), marquage fait.
- EF-35 Bloc Documents attendus : liste de contrôle par étape avec dossier et gabarit de nom (dépôt et rangement dès J5, en simulé).
- EF-36 Bloc Vente et échéancier (si vendue) : lignes, statut, saisie de réception.
- EF-37 Bloc Commandes : AGEM et autres, champs de la table `commande_fournisseur`.
- EF-38 Bloc Planning : dates souhaitées et confirmées.
- EF-39 Intervenants : concepteur, Benjamin, Valentin, Elsie selon l'étape.
- EF-40 Historique issu du `journal`, en langage clair (« Acompte 1 reçu (3 720,00 €) · Clara · 15 sept. »).
- EF-41 Réassigner l'affaire (gérants).

Précisions (session 2.2) : la réassignation transfère aussi à la nouvelle personne les tâches à faire de l'ancien concepteur sur l'affaire ; un RDV R4 ajouté depuis la fiche est posé chez la responsable R4 ; le dépôt de document et l'explorateur PCloud restent inactifs jusqu'au bloc J5 ; la liste `/affaires` est une version simple (recherche par libellé ou contremarque, mes affaires ou celles du magasin) en attendant la liste complète de la session 3.1.

### 9.5 Vente et règlements
- EF-50 Créer une vente depuis une affaire en R3 ou VENTE : sélectionner les affaires du même client, saisir date de signature, montants HT et TTC, financement, référence de devis Gesteos.
- EF-51 Échéancier généré (RG-10, RG-11), modifiable (RG-13).
- EF-52 Saisir une réception : date, montant, mode. Un montant reçu inférieur au prévu laisse la ligne « partiellement reçue ».
- EF-53 Écran Règlements (gérants) : attendus, en retard, reçus cette semaine ; filtres magasin et concepteur ; total des montants ; lecture seule pour la partie bancaire.

### 9.6 Planning de livraison et de pose
- EF-60 À la validation de VENTE, création d'une demande de planning (semaine de livraison et date de pose souhaitées) assignée à Valentin.
- EF-61 Valentin confirme ou propose d'autres dates ; le concepteur est notifié.
- EF-62 Écran Planning : liste par semaine des livraisons et poses confirmées, demandes en attente en tête.

### 9.7 Commandes fournisseurs
- EF-70 Saisie d'une commande AGEM : référence de commande, date d'envoi, semaine demandée, lieu de livraison, prix d'achat, points.
- EF-71 Saisie de l'ARC (date, semaine annoncée), de la confirmation (date), des versions de BPA et du BPA donné.
- EF-72 Saisie d'une commande autre fournisseur : fournisseur, date, AR, délai.
- EF-73 File « BPA à donner » pour Benjamin, triée par ancienneté de la confirmation.

Précisions (session 3.2) :
- la vente se crée depuis une affaire en présentation (R3) ou en vente, avec les autres affaires actives du même client ; `public.creer_vente` écrit d'un bloc la vente, l'échéancier, le passage des affaires en `gagnee`, la validation de l'étape VENTE (et de la présentation si besoin), l'ouverture de l'acompte 1, la demande de planning et la tâche du gérant logistique ; l'étape VENTE ne se valide jamais seule ;
- les tâches de l'étape VENTE accomplies par la création elle-même (« Créer la vente », « Saisir les dates souhaitées ») sont marquées faites (effet `faire_taches`) ; les autres sont annulées et récapitulées (RG-05) ;
- l'échéancier se modifie tant que les lignes ne sont pas reçues ; aucune ligne n'est supprimée (6.1), une ligne inutile passe à 0 ;
- une réception fait la tâche « Vérifier la réception » correspondante ; l'acompte 1 crée le rappel de commission (RG-14) ; quand tout est reçu, la tâche et le mail de facture récapitulative partent chez le gérant finance (RG-15) ;
- le gérant confirme le planning ou propose d'autres dates (statut `decalee`, dates proposées dans les colonnes « confirmées ») ; seule une confirmation recale l'acompte 2 (lundi de la semaine de livraison) et le solde (date de pose), RG-12 ;
- la file « BPA à donner » (EF-73) part des commandes AGEM confirmées sans BPA, triées par date de confirmation, en retard au-delà de `retard_bpa_jours_ouvres` ;
- notifications de démo : mails enregistrés dans `mail_sortant` (boîte d'envoi, écran en J4) et compteurs de la navigation (tâches du jour, demandes de planning en attente pour les gérants).

### 9.8 Pipeline
- EF-80 Kanban à 6 colonnes (phases), une carte par affaire active : libellé, étape courante, concepteur, montant, prochain jalon, point d'état (actif, attente, retard).
- EF-81 Filtres magasin, concepteur, « inactives seulement ».
- EF-82 Vue liste équivalente, exportable en CSV.

### 9.9 Pilotage (gérants) et Point du mardi
- EF-90 Indicateurs de la section 10, filtrables par période et par magasin.
- EF-91 Liste des alertes triées par gravité, chacune liée à une affaire.
- EF-92 Répartition des affaires par phase ; RDV du mois par type.
- EF-93 Page `/point-du-mardi` en grand format pour le partage d'écran Teams : semaine passée (ventes, CA, RDV, transformation), semaine à venir (R3 prévus, livraisons, poses, règlements attendus), alertes, par magasin.

### 9.10 Administration (gérants)
- EF-100 Utilisateurs : inviter (adresse, rôle, magasins, rubriques), modifier, désactiver ; la désactivation exige de réassigner les affaires actives et les tâches ouvertes.
- EF-101 Magasins et sociétés : consultation et modification.
- EF-102 Paramètres : seuils, listes (types de projet, sources, motifs), échéancier standard, gérants référents.
- EF-103 Modèle de process : liste des versions, duplication, éditeur par étape (tâches, assigné, échéance, optionnelle, documents, issues), validation Zod, publication ; seules les nouvelles affaires prennent la nouvelle version.
- EF-104 Journal consultable et filtrable.

---

## 10. Indicateurs de pilotage

Chaque indicateur est une vue SQL testée, documentée dans `docs/indicateurs.md` avant d'être codée. Les vues calculent les périodes à partir de `app_today()`, jamais de `current_date`.

| ID | Indicateur | Définition |
| --- | --- | --- |
| KPI-01 | CA signé | Somme de `vente.montant_ht_cts` dont `date_signature` est dans la période (HT par défaut, à confirmer). |
| KPI-02 | Nombre de ventes, panier moyen | Nombre de ventes de la période ; CA signé / nombre de ventes. |
| KPI-03 | Flux entrant | Nombre de clients créés dans la période, par magasin (CNQ inclus, compté à part). |
| KPI-04 | Potentiel de CA | Somme de `montant_devis_ht_cts` des affaires actives en phase 02 ou 03 (pondération par phase : point ouvert). |
| KPI-05 | Taux de transformation | Parmi les affaires dont le premier R3 a eu lieu dans la période : part vendue à ce jour. |
| KPI-06 | RDV par type | Nombre de R0, R1, R2, R3 faits dans la période. |
| KPI-07 | Affaires en retard | Nombre d'affaires en alerte RG-20 (commerce) et RG-21, RG-28, RG-29 (après-vente). |
| KPI-08 | Règlements | Montant attendu dans les 30 jours ; montant en retard ; nombre d'échéances en retard. |
| KPI-09 | Délai moyen R1 → vente | Moyenne en jours sur les ventes de la période. |
| KPI-10 | Motifs de non-vente | Répartition des motifs sur la période. |
| KPI-11 | Marge estimée (dès J5) | Montant HT de la vente − somme des `prix_achat_cts` des commandes de ses affaires. |

Tous les indicateurs se déclinent par magasin et par concepteur (D19).

Précisions (session 4.1) :
- définitions exactes, vues et colonnes dans `docs/indicateurs.md` ; une vue `public.kpi_*` par indicateur et `public.alertes` pour RG-20 à RG-29, en `security_invoker` (la RLS s'applique : une conceptrice ne voit que ses magasins) ;
- périodes (`kpi_periodes`) : semaine, semaine dernière, mois, mois dernier, trimestre, année, 12 derniers mois, toutes closes sur `app_today()` ; le Pilotage s'ouvre sur « ce mois » ;
- RG-20 suit D17 : R1 fait depuis plus de 14 jours sans R3 fait ni vente ; RG-27 porte sur les affaires en cours (actives ou gagnées), comme « Ma journée » ;
- le concepteur d'une vente est celui de sa première affaire ; une alerte de règlement est rattachée à cette affaire ;
- KPI-04 n'est pas pondéré (point ouvert) ; KPI-10 date une perte par la fin de l'étape close avec motif ;
- les traitements de nuit (session 4.2) partiront de la vue `alertes` pour créer tâches et digests, sans redéfinir les règles.

---

## 11. Notifications et digests

| Envoi | Destinataire | Moment | Contenu |
| --- | --- | --- | --- |
| Digest quotidien | Chaque utilisateur ayant des tâches | 6 h 30, jours ouvrés | Tâches du jour, tâches en retard, relances, règlements à suivre ; lien vers Ma journée |
| Digest gérants | Les trois gérants | Lundi 7 h | Potentiel de CA, enjeux de la semaine (R3, livraisons, poses, règlements attendus), alertes ouvertes, par magasin |
| Demande de planning | Valentin | Immédiat | Nouvelle demande avec dates souhaitées |
| Planning confirmé ou décalé | Concepteur | Immédiat | Dates confirmées |
| Confirmation AGEM à vérifier | Benjamin | Immédiat | Affaire, version |
| Facture récapitulative à éditer | Jean | Immédiat | Affaire, montant total |

Toutes les notifications existent aussi dans l'interface (compteur dans la navigation). Aucun SMS ni message au client final en V1.

---

## 12. Droits d'accès

| Capacité | Gérant | Concepteur (conceptrice) | Transverse |
| --- | --- | --- | --- |
| Voir les clients et affaires | 3 magasins | Son ou ses magasins | Selon rubriques : `r4_avis` (affaires en phase 06), `dossiers_pose` (affaires en phases 04-05, lecture) |
| Créer un client, une affaire | Oui | Oui (son magasin) | Non |
| Modifier une affaire, valider une étape | Toutes | Celles de son magasin | Non |
| Faire ses tâches | Oui | Oui | Oui (ses tâches) |
| Être concepteur d'une affaire | Oui | Oui | Non |
| Réassigner une affaire | Oui | Non | Non |
| Créer une vente, saisir un règlement reçu | Oui | Oui (son magasin) | Non |
| Confirmer un planning | Oui | Non | Non |
| Donner un BPA | Oui | Non | Non |
| Voir les indicateurs commerciaux | Tous | Tous (D19) | Non |
| Voir l'écran Règlements | Oui | Ses affaires (dans Ma journée) | Non |
| Importer des données | Oui | Non | Non |
| Administration | Oui | Non | Non |

Précisions :
- un client est visible d'une conceptrice dès qu'elle porte une de ses affaires dans son magasin (client qui revient dans un autre magasin) ;
- les transverses voient une affaire selon la phase de ses étapes ouvertes : `r4_avis` en phase 06, `dossiers_pose` en phases 04 et 05 (lecture seule) ; la responsable R4 valide l'étape R4 et planifie ses RDV (rôle E de la section 7.2) ;
- les tâches libres sont ouvertes à tous (D14) : chacun voit et coche ses tâches, un gérant voit toutes les tâches ;
- réassigner une affaire (EF-41), donner un BPA et confirmer un planning (EF-61) sont gardés par trigger, car la RLS ne distingue pas les colonnes ;
- aucune suppression depuis l'interface (6.1) ;
- la validation d'étape passe par `public.appliquer_effets` (section 7.5) ; la responsable R4 n'y valide que l'étape R4, ce qui ouvre RELANCE_AVIS ou ARCHIVAGE sans lui donner d'autres droits d'écriture.

Implémentation : fonctions SQL `prive.auth_role()`, `prive.auth_magasins()`, `prive.auth_rubriques()`, `prive.auth_est_admin()` utilisées par les politiques RLS. Elles vivent dans le schéma `prive`, que l'API REST n'expose pas. Chaque politique a un test pgTAP dans `supabase/tests`, exécuté par la CI sur la base éphémère (section 5.3).

---

## 13. Imports, exports et intégrations

### 13.1 Reprise initiale (J5 avec données d'exemple, B7 avec les vraies affaires)

Fichier CSV UTF-8, séparateur `;`, une ligne par affaire active :

```csv
magasin;concepteur_email;client_type;client_nom;client_prenom;raison_sociale;telephone;email;adresse;code_postal;ville;projet;contremarque;etape_code;montant_devis_ht;date_r1;date_r2;date_r3;date_signature;montant_vente_ht;montant_vente_ttc;acompte1_recu_le;acompte2_recu_le;solde_recu_le;semaine_livraison;date_pose;gesteos_devis_ref
```

Le script positionne l'affaire à `etape_code`, marque les étapes antérieures `faite` sans générer leurs tâches, crée la vente et l'échéancier si une date de signature est présente. Mode « essai » sans écriture ; rapport des lignes rejetées avec motif.

### 13.2 Exports Gesteos (B4)

Gesteos n'a pas d'API. Un gérant téléverse un export CSV ou Excel (contacts, devis, BDC, règlements). Le format exact sera défini à partir d'exemples réels (section 17). Règles : rapprochement par référence Gesteos, sinon par nom + projet ; aucune écriture vers Gesteos ; rapport d'import (créés, mis à jour, ignorés, en conflit).

### 13.3 Débit AGEM (J5)

Le débit est un .docx généré par Gesteos. Au dépôt, l'outil extrait :

| Champ | Exemple (débit d'exemple anonymisé) | Emplacement dans le document |
| --- | --- | --- |
| N° de devis | D20260928#4538 | « N° du devis : » |
| N° de commande | C20260929#848 | « notre commande : » |
| Contremarque | SAS VISIOLAB Julien ROUSSEL | « Nom de la contremarque : » |
| Semaine demandée | 44 / 2026 | « Semaine de livraison demandée : » |
| Lieu de livraison | TRANSTOCK 66, Marseille 11 | « Adresse de livraison demandée : » |
| Concepteur | Jean FARHAT | « Votre concepteur : » |
| Prix d'achat total | 3 102,72 € | « PRIX D'ACHAT : » |
| Points | 4 162,57 | « POINTS : » |

Particularités du fichier à respecter dans l'extraction : un espace insécable précède les deux-points (« N° du devis : »), les milliers sont séparés par un espace insécable (« 3 102,72 € »), et l'apostrophe de « PRIX D'ACHAT » est typographique (’).

Les valeurs extraites sont proposées à la validation avant enregistrement, jamais écrites sans confirmation.

Le débit d'exemple contenait de vraies données client : le dépôt de code n'en garde qu'une copie anonymisée (`docs/sources/debit-agem-exemple-anonymise.docx`). Client, adresse et téléphones y sont fictifs ; la structure, les références de devis et de commande, les lignes et les montants sont intacts. L'original reste dans le dossier DCO-IT et n'entre jamais dans le dépôt.

### 13.4 PCloud (simulé en J5, réel en B3)

- Connexion OAuth au compte PCloud du groupe ; jeton stocké chiffré côté serveur.
- À la création d'une affaire : copie du dossier modèle « NOUVEAU CLIENT » vers `{racine magasin}/{NOM Prénom (concepteur)}` (convention à confirmer) ; enregistrement de `pcloud_folder_id`.
- Dépôt d'un fichier sur la fiche affaire : choix du document attendu, renommage selon le gabarit (section 7.3), envoi dans le sous-dossier, création de la ligne `document`.
- Contrôle : un document attendu est marqué présent s'il existe dans le bon sous-dossier.
- Les menuisiers continuent de lire PCloud ; l'outil ne déplace ni ne supprime aucun fichier existant.

### 13.5 Outlook (B5)

Lecture seule des agendas des conceptrices via Microsoft Graph (permission `Calendars.Read`, consentement administrateur). Un RDV dont le titre commence par `R1`, `R2`, `R3`, `R3.2`… est rattaché à l'affaire par le nom du client ; les règles RG-30 et RG-31 se calculent alors sans saisie. Convention de titre à valider : `R2 - NOM Prénom - Projet`.

### 13.6 Exports
- Pipeline, règlements et indicateurs exportables en CSV (séparateur `;`, UTF-8 avec BOM pour Excel).

---

## 14. Exigences non fonctionnelles

| ID | Exigence |
| --- | --- |
| ENF-01 | Interface entièrement en français ; vocabulaire de la section 2. |
| ENF-02 | Navigateurs : Chrome, Edge et Safari récents. Largeur de référence 1280 px ; utilisable à 1024 px (tablette) ; pas d'optimisation téléphone. |
| ENF-03 | Temps d'affichage d'un écran < 1,5 s avec les volumes de la section 1.4 multipliés par 5. |
| ENF-04 | Charte : couleurs et polices de `CLAUDE.md` ; une seule action principale par écran ; la couleur n'est jamais le seul porteur d'information. |
| ENF-05 | Accessibilité : contrastes AA, navigation clavier, focus visible, libellés de formulaires. |
| ENF-06 | Sécurité : RLS sur toutes les tables, clés de service uniquement côté serveur, routes cron protégées par secret, en-têtes de sécurité, aucune donnée client dans les logs, accès à la démo protégé par code et page des personnages absente en production. |
| ENF-07 | RGPD : données hébergées en France ; registre de traitement fourni au groupe ; export des données d'un client sur demande ; anonymisation des clients sans affaire depuis 3 ans (durée à valider). |
| ENF-08 | Sauvegardes : sauvegarde quotidienne Supabase (plan Pro) avec restauration à un instant donné ; test de restauration avant la mise en production. |
| ENF-09 | Traçabilité : toute modification métier est journalisée (table `journal`). |
| ENF-10 | Qualité : TypeScript strict, lint sans erreur, tests verts obligatoires pour fusionner ; couverture ≥ 90 % sur `src/lib/process` et `src/lib/rules`. |
| ENF-11 | Réversibilité : le code et la base appartiennent au groupe (comptes à son nom ou transférés), export SQL complet possible. |
| ENF-12 | Fuseau Europe/Paris pour toutes les dates affichées et les tâches planifiées. |

---

## 15. Plan de construction avec Claude Code

### 15.1 Stratégie : une démo complète avant tout branchement

La démo à Jean a lieu une semaine après cette version. Aucun outil du groupe ne sera branché d'ici là : ni Microsoft 365, ni PCloud, ni Outlook, ni Gesteos, ni Teams. Le plan est donc réordonné en deux temps.

1. **Démo (5 jours de travail)** : tout le cœur métier est construit pour de vrai (base, droits, moteur de process, règles, écrans, indicateurs). Chaque outil externe est remplacé par un adaptateur de démonstration (section 5.4) qui se comporte comme le vrai. Les données sont fictives et réalistes. L'application tourne sur les comptes Vercel, Supabase et GitHub de DCO-IT.
2. **Branchement (après la démo)** : on remplace les adaptateurs de démo par les vrais, un par un, à mesure que les accès arrivent. Le code métier ne change pas.

Ce qui se construit sans aucun accès au groupe : 100 % du cœur métier, la lecture du débit AGEM (le débit d'exemple anonymisé suffit), l'import CSV (avec des fichiers d'exemple), la simulation du rangement PCloud, les mails (dans une boîte d'envoi interne), les tâches planifiées (avec une horloge de démo).

Ce qui attend les accès : la connexion Microsoft, l'envoi réel des mails, l'écriture dans PCloud, la lecture des agendas Outlook, le format exact des exports Gesteos, la reprise des vraies affaires de La Ciotat.

### 15.2 Vue d'ensemble

| Bloc | Contenu | Quand | Charge |
| --- | --- | --- | --- |
| J1 | Socle, mode démo, connexion par personnage, schéma, process 2026, générateur de données | Démo | 1 j |
| J2 | Moteur de process et règles (tests d'abord), fiche affaire | Démo | 1 j |
| J3 | Clients et affaires, Ma journée, vente et échéancier, planning et commandes | Démo | 1 j |
| J4 | Pipeline, pilotage, point du mardi, alertes, horloge de démo, boîte d'envoi | Démo | 1 j |
| J5 | PCloud simulé, lecture du débit AGEM, import CSV, administration légère, répétition | Démo | 1 j |
| B1 | Connexion Microsoft 365 | Après la démo | 1 j |
| B2 | Envoi réel des mails (Resend, DNS magasin-quadro.fr) | Après la démo | 0,5 j |
| B3 | PCloud réel (OAuth, copie de NOUVEAU CLIENT, dépôt et renommage) | Après la démo | 3 j |
| B4 | Imports Gesteos au format réel | Après la démo | 2 à 4 j |
| B5 | Agenda Outlook | Après la démo | 3 j |
| B6 | Finitions V1 : éditeur de process complet, RGPD, sauvegardes, accessibilité, performances | Après la démo | 5 j |
| B7 | Passage en production, reprise des affaires de La Ciotat, pilote de 3 semaines | Après la démo | 3 j + 3 semaines |

Les journées J1 à J5 sont des journées Claude Code denses : chaque bloc enchaîne plusieurs sessions courtes, une par prompt, avec une PR chacune. Si une journée déborde, l'ordre de repli est indiqué en 15.4.

### 15.3 Les journées de la démo

#### J1 — Socle, mode démo, schéma, données

Avant la session 1.1 : les comptes et le projet distant existent, `.env.local` est rempli (voir `docs/demarrage.md`).

Session 1.1 — socle et mode démo

```text
Lis CLAUDE.md et docs/conception.md (sections 5.2, 5.3 et 5.4 en particulier). Initialise le projet Next.js (App Router, TypeScript strict) avec Tailwind, shadcn/ui, Zod, Vitest, Playwright et la Supabase CLI en dépendance de développement. Il n'y a pas de Docker sur le poste : en local, l'application et la CLI travaillent sur le projet Supabase distant lié par `supabase link` (variables dans .env.local). Crée la CI GitHub Actions : lint, typecheck, tests Vitest, puis une base Supabase éphémère sur le runner (`supabase start`) où toutes les migrations sont rejouées depuis zéro et où `supabase test db` exécute les tests pgTAP ; à la fusion sur main, un job applique les migrations au projet distant (`supabase db push`, secrets SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF). Ajoute les scripts pnpm db:push, db:types (supabase gen types --linked) et seed:demo. Applique la charte de CLAUDE.md (polices via next/font). Crée la coquille : barre latérale avec les entrées de la section 9, barre du haut, bandeau permanent « Démonstration — données fictives » quand APP_MODE=demo. Ajoute un middleware qui exige le code DEMO_ACCESS_CODE quand APP_MODE=demo (formulaire, puis cookie). Crée le dossier src/adapters avec les interfaces AuthAdapter, Mailer, FileStore, CalendarSource, Clock et leur sélection par variable d'environnement (section 5.4) ; n'implémente que les versions démo.
```

Session 1.2 — connexion par personnage et droits

```text
Implémente l'AuthAdapter démo : une page de connexion qui liste les personnages (3 gérants, 6 conceptrices, Elsie, Adrian) ; un clic connecte le compte Supabase Auth correspondant (comptes créés par le seed, mot de passe commun lu dans DEMO_PERSONA_PASSWORD côté serveur uniquement). Un sélecteur dans le menu utilisateur permet de changer de personnage sans se déconnecter. La page et ses routes renvoient 404 quand APP_MODE=production, avec un test. Crée les migrations societe, magasin, profil, profil_magasin, les fonctions auth_role(), auth_magasins(), auth_rubriques(), auth_est_admin() et les politiques RLS de la section 12. Tests pgTAP des politiques dans supabase/tests (exécutés par la CI).
```

Session 1.3 — schéma et process

```text
Crée d'abord la table parametre et les fonctions SQL app_now() et app_today() de la section 5.4 (date simulée lue dans parametre.horloge_demo, sinon heure système, Europe/Paris), avec leurs tests. Puis les migrations de toutes les tables de la section 6 (dont mail_sortant), triggers updated_at, derniere_activite_at et journal, RLS ; aucun trigger ni fonction métier n'utilise now() ou current_date. Écris le schéma Zod de la section 7.1 puis process/2026-v1.json conforme aux sections 7.2 et 7.3. Tests : JSON valide, chaque issue pointe vers une étape existante, chaque étape est atteignable depuis R0.
```

Session 1.4 — générateur de données de démo

```text
Écris scripts/seed-demo.ts, déterministe (graine fixe), qui génère avec des noms fictifs français : 5 sociétés, 3 magasins, 11 utilisateurs, environ 6 mois d'historique (environ 270 ventes, 45 par mois) et environ 75 affaires actives réparties sur les 6 phases comme dans la maquette Pipeline. Les affaires sont créées en rejouant le moteur de process (pas d'insertion directe des états) dès que le moteur existe ; en attendant, insère les états directement derrière une fonction unique à remplacer en J2. Inclure volontairement : 3 R3.n en cours, 2 ARC en retard, 1 BPA en retard, 2 acomptes 1 non reçus, 1 acompte 2 en retard, 2 retards commerce (R1 + 14 j), 1 SAV ouvert, 1 client professionnel, 1 client qui revient avec une 2e affaire, 1 affaire où Jean est concepteur, 1 affaire avec la branche autres fournisseurs ouverte en parallèle de BPA. Le script travaille sur le projet distant avec la clé secrète (SUPABASE_SECRET_KEY), vide les tables métier et parametre.horloge_demo puis les remplit. Commande `pnpm seed:demo`.
```

Fin de J1 : la preview Vercel s'ouvre derrière le code d'accès, on se connecte en Manon ou en Jean, les données existent en base, la CI est verte (migrations rejouées sur base vierge et tests RLS passés).

#### J2 — Moteur de process et fiche affaire

Session 2.1 — moteur

```text
Implémente src/lib/process (module pur) et src/lib/rules pour RG-01 à RG-09, en écrivant les tests Vitest d'abord. Une affaire peut avoir plusieurs étapes ouvertes en même temps (section 7.4) : le moteur raisonne sur l'ensemble des etape_instance ouvertes, et etape_courante_code n'est qu'un résumé d'affichage recalculé après chaque validation. Tests : parcours complet R0 → ARCHIVAGE, R3.n trois fois puis vente, perte sans motif refusée, COMMANDE_AGEM refusée sans acompte 1 puis acceptée, branche autres fournisseurs ouverte en parallèle de BPA et terminée après DOSSIER_POSE, SAV avec recommande, R4 avant FACTURE_RECAP, archivage refusé tant qu'une branche est ouverte. Toute date « aujourd'hui » vient de l'adaptateur Clock. Puis les server actions transactionnelles. Remplace l'insertion directe du seed par un rejeu du moteur.
```

Session 2.2 — fiche affaire

```text
Construis la fiche affaire (EF-30 à EF-41) d'après docs/maquettes/fiche-affaire.png : en-tête, timeline des 6 phases, validation d'étape avec issue, motif ou date (choix de l'étape quand plusieurs sont ouvertes), blocage RG-01 expliqué, RDV, documents attendus (liste de contrôle), intervenants, historique lisible. Le lien PCloud ouvre l'explorateur PCloud simulé (J5) ; en attendant, un lien inactif. Test Playwright R1 → vente.
```

Fin de J2 : une affaire se suit de bout en bout ; le blocage de la commande AGEM sans acompte 1 fonctionne.

#### J3 — Le quotidien des conceptrices et des gérants

Session 3.1 — clients, affaires, Ma journée

```text
Construis la création rapide de contact (R0, CNQ, rappel convenu), la détection des clients existants, la fiche client, la création d'une ou plusieurs affaires et la liste Mes affaires (EF-20 à EF-25). Puis Ma journée (EF-10 à EF-18) pour concepteurs et gérants, avec tâches libres, report, jauges RG-30 et RG-31, relances RG-33 à RG-36 et files des gérants.
```

Session 3.2 — vente, règlements, planning, commandes

```text
Implémente la vente multi-affaires et l'échéancier (EF-50 à EF-53, RG-08, RG-10 à RG-15) en centimes, l'écran Règlements, la demande et la confirmation de planning (EF-60 à EF-62), les commandes AGEM et autres fournisseurs avec ARC, confirmation et BPA (EF-70 à EF-73), la file BPA de Benjamin. Les notifications passent par le Mailer démo (boîte d'envoi) et par le compteur de l'interface.
```

Fin de J3 : on joue en entier le parcours Manon → Valentin → Benjamin → Jean sur une affaire.

#### J4 — Pilotage, alertes et horloge

Session 4.1 — indicateurs

```text
Écris docs/indicateurs.md à partir de la section 10, puis une vue SQL testée par indicateur (KPI-01 à KPI-10), périodes calculées depuis app_today(). Construis Pipeline (EF-80 à EF-82), Pilotage (EF-90 à EF-92) et /point-du-mardi (EF-93) en grand format pour un partage d'écran.
```

Session 4.2 — traitements de nuit, horloge, boîte d'envoi

```text
Implémente le job « traitements de nuit » (recalcul des alertes RG-20 à RG-29, relances, digest quotidien, digest du lundi) comme une fonction idempotente appelée par le cron en production et par l'horloge de démo. Construis le panneau Horloge de démo (gérants) : date simulée écrite dans parametre.horloge_demo (lue par app_now() et par l'adaptateur Clock), boutons « +1 jour », « +1 semaine », « Lundi 7 h », « Revenir à aujourd'hui » ; chaque avance exécute les traitements de nuit pour chaque jour franchi. Vérifie par un test qu'après « +3 jours » les vues d'indicateurs et les alertes sont calculées à la date simulée. Construis l'écran Boîte d'envoi : liste des mails générés avec destinataire, objet, aperçu HTML fidèle au rendu final.
```

Fin de J4 : en avançant l'horloge de 3 jours, de nouvelles alertes apparaissent, les indicateurs suivent la date simulée et le digest du lundi est lisible dans la boîte d'envoi.

#### J5 — PCloud simulé, débit AGEM, import, répétition

Session 5.1 — PCloud simulé et débit AGEM

```text
Implémente le FileStore démo sur Supabase Storage (bucket pcloud-demo) : à la création d'une affaire, copie de l'arborescence NOUVEAU CLIENT (liste provisoire des sous-dossiers 01 à 12 dans parametre, à corriger quand Benjamin la fournit) ; dépôt d'un fichier sur la fiche affaire avec choix du document attendu, renommage selon le gabarit (section 7.3), rangement dans le sous-dossier ; écran « PCloud (simulé) » qui montre l'arborescence d'un client. Puis la lecture du débit AGEM (section 13.3, y compris espaces insécables et apostrophe typographique) : extraction depuis le .docx, formulaire de validation prérempli, enregistrement dans commande_fournisseur, KPI-11 marge estimée. Tests d'extraction sur docs/sources/debit-agem-exemple-anonymise.docx.
```

Session 5.2 — import et administration légère

```text
Implémente l'import CSV de reprise (section 13.1) avec mode essai et rapport de rejets, et un fichier d'exemple docs/import/affaires-exemple.csv. Construis une administration légère : utilisateurs (lecture, rôle, magasins, désactivation avec réassignation), paramètres (seuils et listes), version de process en lecture seule. L'éditeur de process complet attend le bloc B6.
```

Session 5.3 — répétition

```text
Écris e2e/demo.spec.ts qui rejoue le scénario de la section 15.5 de bout en bout, après `pnpm seed:demo`. Corrige tout ce qui casse. Vérifie l'affichage à 1280 et 1024 px.
```

Fin de J5 : le scénario de démo passe en automatique ; on le répète une fois à la main.

### 15.4 Ordre de repli si le temps manque

Abandonner dans cet ordre, sans toucher au parcours principal :

1. Administration légère (montrer les paramètres directement dans Supabase si besoin).
2. Import CSV de reprise.
3. Écran Règlements des gérants (les règlements restent visibles sur la fiche et dans Ma journée).
4. Point du mardi (le Pilotage suffit).
5. PCloud simulé (garder la lecture du débit AGEM, qui est le moment fort).

Ne jamais sacrifier : le moteur et ses tests, la fiche affaire, Ma journée, le blocage acompte 1, l'horloge de démo.

### 15.5 Scénario de démonstration (25 minutes)

Chaque séquence répond à une réponse de Jean du 12 octobre. Dérouler avec le bandeau « données fictives » visible.

| # | Personnage | Ce qu'on montre | Réponse de Jean illustrée |
| --- | --- | --- | --- |
| 1 | Manon (La Ciotat) | Ma journée : tâches du jour et en retard, relances, jauges R2/R3 | « Manque de rappel » ; « aide et facilitateur au quotidien » |
| 2 | Manon | Un client entre en magasin : contact rapide au R0 sans coordonnées (CNQ), puis R1 avec deux affaires cuisine + dressing | « Un client = une ou plusieurs affaires » ; création au R0 ou R1 |
| 3 | Manon | Fiche affaire : R3 sans vente → R3.2 ; puis vente des deux affaires en une seule vente, échéancier 40 / 50 / 10 | R3.2, R3.3… ; échéancier standard |
| 4 | Manon | Tentative de commande AGEM refusée, saisie de l'acompte 1, commande débloquée | « Pas de commande AGEM sans acompte 1 » |
| 5 | Manon | Dépôt du débit AGEM : champs lus automatiquement, fichier renommé et rangé dans le PCloud simulé, marge estimée | « Tout pourrait passer par l'outil » ; marge |
| 6 | Valentin | Demande de planning reçue, confirmation de la livraison et de la pose ; Manon le voit sans WhatsApp | Groupe WhatsApp du planning |
| 7 | Benjamin | File des BPA à donner, alerte BPA en retard | « Le bon pour accord est donné trop tard à AGEM » |
| 8 | Jean | Horloge +3 jours : acompte 2 non reçu remonte, digest dans la boîte d'envoi | « On passe à côté d'un règlement » |
| 9 | Jean | Pilotage : CA, flux entrant, potentiel, transformation, retards ; Point du mardi en grand écran | Les 5 informations cherchées à la main ; réunion du mardi |
| 10 | Jean | Administration : seuils modifiables, utilisateurs, version de process | Les trois gérants administrent |

Fin de démo : présenter la liste des accès à obtenir (section 17) et les points ouverts (section 18) pour les trancher sur place.

Données préparées par `pnpm seed:demo` (`src/lib/demo/generer.ts`, liste `CAS_DEMO`) : le jeu est déterministe et daté par rapport au jour du seed, à lancer la veille de la présentation. Il contient environ 6 mois d'historique (≈ 270 ventes, affaires perdues avec motif, contacts CNQ), 76 affaires actives sur les 6 phases et les cas de la session 1.4 : 3 R3.n en cours, 2 ARC et 1 BPA en retard, 2 acomptes 1 non reçus, 1 acompte 2 en retard et 1 autre qui le devient après « +3 jours » (séquence 8), 2 retards commerce, 1 SAV, 1 client professionnel, des clients qui reviennent, des affaires dont Jean est concepteur, une branche autres fournisseurs en parallèle du BPA, une vente à deux affaires, et la journée de Manon (R2 aujourd'hui, R3 de la semaine, tâches du jour et en retard, rappel convenu).

### 15.6 Après la démo : brancher les vrais outils

Chaque branchement remplace un adaptateur démo par sa version réelle, derrière la même interface ; les tests métier ne changent pas.

| Bloc | Adaptateur | Travail | Accès requis |
| --- | --- | --- | --- |
| B1 | AuthAdapter → microsoft | Provider Azure dans Supabase Auth, restriction au domaine, rattachement des profils existants par email ; la page des personnages disparaît en production | Administrateur du tenant Microsoft 365 |
| B2 | Mailer → resend | Envoi réel, la boîte d'envoi reste comme journal | DNS de magasin-quadro.fr |
| B3 | FileStore → pcloud | OAuth PCloud, copie du vrai NOUVEAU CLIENT, dépôt et renommage, contrôle des documents attendus (section 13.4) | Compte PCloud et accès API, arborescence réelle |
| B4 | Import Gesteos | Mapping des vrais exports (section 13.2) | Exemples d'exports réels |
| B5 | CalendarSource → outlook | Lecture des agendas (section 13.5) | Consentement administrateur, convention de titre des RDV |
| B6 | — | Éditeur de process complet (EF-103), RGPD (ENF-07), sauvegardes et test de restauration (ENF-08), accessibilité (ENF-05), performances (ENF-03) | — |
| B7 | — | Projet Supabase de production en région Paris au nom du groupe (offre Pro), projet `dev` séparé, APP_MODE=production, reprise CSV des affaires de La Ciotat, formation, pilote de 3 semaines | Liste des affaires en cours, utilisateurs |

### 15.7 Lot administratif (hors V1)

Objectif : lire les boîtes mail personnelles et déléguées, extraire les factures (10 à 20 par société et par semaine), les renommer, les ranger dans PCloud et préparer l'envoi INEXWEB ; rattacher les factures AGEM à l'affaire par la contremarque pour calculer la marge réelle.

Référentiel : le plan de classement Quadro.

| Entité | Dossier PCloud | Nommage |
| --- | --- | --- |
| JVB La Valentine | JVB La Valentine / Factures / [Fournisseur] | `AAAAMM_FOURNISSEUR_MONTANT€_JVB-VALENTINE.pdf` |
| JVB Aix | JVB Aix / Factures / [Fournisseur] | `AAAAMM_FOURNISSEUR_MONTANT€_JVB-AIX.pdf` |
| JVB La Ciotat | JVB La Ciotat / FACTURES / [Fournisseur] | `AAAAMM_FOURNISSEUR_MONTANT€_JVB-CIOTAT.pdf` |
| BAJV Agencements | BAJV Agencements / Factures / [Fournisseur] | `AAAAMM_FOURNISSEUR_MONTANT€_BAJV.pdf` |
| JVB Holding | JVB Holding / Factures / [Fournisseur] | `AAAAMM_FOURNISSEUR_MONTANT€_JVB-HOLDING.pdf` |

Circuit : dépôt dans `_A_TRIER`, passage par `_A_ENVOYER_AU_COMPTABLE` avant archivage, documents non identifiés dans `_A_TRIER/_INCERTAIN`. Le plan prévoit un démarrage sous forme de projet Claude ; le rattachement à l'affaire se branchera ensuite sur la base de Quadro Affaires (table à ajouter : `facture_fournisseur` liée à `commande_fournisseur`). À chiffrer séparément.

---

## 16. Méthode de travail et contenu de CLAUDE.md

### 16.1 Cycle d'une étape

1. Ouvrir une session Claude Code dans le dépôt, coller le prompt de l'étape, demander d'abord un plan et le valider.
2. Tests d'abord pour le moteur, les règles et les indicateurs, puis le code.
3. Vérifier la preview Vercel de la branche ; faire relire la PR par une session neuve.
4. Fusionner, cocher les critères « Terminé quand », noter les écarts dans CLAUDE.md.

Les connecteurs Supabase, Vercel et GitHub de Claude Code servent à appliquer les migrations sur le projet distant de démo, lire les logs et suivre la CI. La production (B7) n'est modifiée que par la CI après fusion sur `main`.

### 16.2 Structure du dépôt

```text
quadro-affaires/
├ CLAUDE.md
├ .env.example               variables attendues (jamais de valeur réelle)
├ .github/workflows/ci.yml   lint, typecheck, Vitest, Supabase éphémère + pgTAP, db push sur main
├ docs/
│  ├ conception.md            ce document
│  ├ demarrage.md             création des comptes et du poste, variables et secrets
│  ├ indicateurs.md           définition de chaque KPI (J4)
│  ├ maquettes/               captures des 5 écrans et de la charte
│  ├ sources/                 débit AGEM d'exemple anonymisé (trame process, cadre de pilotage et plan de classement restent dans le dossier DCO-IT)
│  └ import/affaires.csv      gabarit de reprise
├ process/2026-v1.json
├ scripts/seed-demo.ts       données fictives du scénario de démo
├ supabase/
│  ├ config.toml
│  ├ migrations/
│  └ tests/                   tests pgTAP des politiques RLS (CI)
├ src/
│  ├ app/                     ma-journee, affaires, clients, pipeline, planning, reglements, pilotage, point-du-mardi, admin
│  ├ components/
│  ├ lib/process/             moteur pur + tests
│  ├ lib/rules/               règles et alertes + tests
│  ├ lib/kpi/                 accès aux vues d'indicateurs
│  ├ adapters/                auth, mailer, filestore, calendar, clock (démo et réel)
│  └ server/                  server actions, crons, mails
└ e2e/                        parcours Playwright
```

### 16.3 CLAUDE.md

Le fichier `CLAUDE.md` à la racine du dépôt reprend le contenu ci-dessous.

```markdown
# Quadro Affaires
Outil de suivi d'affaire des 3 showrooms Quadro. Utilisateurs : 3 gérants, 6 conceptrices, 2 transverses.
Lire docs/conception.md avant toute tâche ; citer les identifiants EF-, RG-, ENF- dans les commits et PR.

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

## Charte
Teal 900 #0E3B45, Teal 700 #1B5A66, Teal 500 #2F7A86, Sage 500 #9DBFAE, Sage 100 #E8F0EC, fond #F4F7F6, encre #15262B.
Phases : 01 #3B6E8F, 02 #6B5B95, 03 #B9812E, 04 #3A8073, 05 #B4483F, 06 #5B6472.
États : OK #2F7D5B, attention #B07A1F, retard #B4483F.
Titres Quicksand 700, texte Source Sans 3, références IBM Plex Mono.
Rayons : cartes 12 px, boutons et champs 8 px. Une action principale par écran.
Maquettes de référence : docs/maquettes/.

## Commandes
pnpm dev · pnpm test · pnpm e2e · pnpm lint · pnpm typecheck · pnpm db:push · pnpm db:types · pnpm seed:demo
```

---

## 17. Prérequis

### 17.1 Pour la démo

Aucun accès du groupe n'est nécessaire.

| Élément | Fournisseur | État |
| --- | --- | --- |
| Organisation GitHub DCO-IT et dépôt privé `quadro-affaires` | Dan, voir `docs/demarrage.md` | À faire avant J1 |
| Organisation Supabase DCO-IT et projet `quadro-affaires-demo` en région Paris (eu-west-3), offre gratuite | Dan, voir `docs/demarrage.md` | À faire avant J1 |
| Équipe Vercel DCO-IT en offre Pro, projet `quadro-affaires` relié au dépôt, région cdg1 | Dan, voir `docs/demarrage.md` | À faire avant J1 |
| Poste : Node 22 LTS, pnpm, Supabase CLI, GitHub CLI (pas de Docker) | Dan | À faire avant J1 |
| Copie anonymisée du débit AGEM d'exemple | Dan | Fait : `docs/sources/debit-agem-exemple-anonymise.docx` |
| Maquettes exportées en PNG dans `docs/maquettes/` | Dan, depuis « Charte et maquettes » | Fait |

### 17.2 À obtenir pendant ou après la démo

| Élément | Fournisseur | Requis pour | État |
| --- | --- | --- | --- |
| Décision sur la propriété des comptes de production | Gérants | B7 | À décider |
| Administrateur du tenant Microsoft 365 pour l'application Entra | Gérant ou prestataire informatique | B1, B5 | À faire |
| Liste des utilisateurs : nom, adresse, magasin, rôle | Jean | B1 | À faire |
| DNS de magasin-quadro.fr pour l'envoi des mails | Prestataire informatique | B2 | À faire |
| Type de compte PCloud et accès API | Jean ou Benjamin | B3 | À faire |
| Arborescence du dossier NOUVEAU CLIENT (01 à 12) | Benjamin | B3 (une liste provisoire sert à la démo) | À faire |
| Exemples d'exports Gesteos (contacts, devis, BDC, règlements) | Jean | B4 | À faire |
| Convention de titre des RDV dans Outlook | Gérants | B5 | À valider |
| Trame de la méthode Qaméléon | Jean | B6 (check-lists) | À faire |
| Tableau Teams des délais AGEM | Benjamin | B6 (réglage des seuils) | À faire |
| Rattachement des magasins aux 5 sociétés | Jean | B7 | À confirmer |
| Liste des affaires en cours de La Ciotat | Jean | B7 | À faire |
| Exemple de débit AGEM | Jean | J5 | Reçu (29/09/2026), copie anonymisée dans le dépôt |
| Plan de classement des factures | Jean | Lot administratif | Reçu |

---

## 18. Points ouverts

À trancher en visio avec Jean, Valentin et Benjamin. Les choix par défaut retenus dans cette spécification sont indiqués.

| # | Question | Choix par défaut |
| --- | --- | --- |
| PO-1 | Où une affaire attend-elle le plus entre BDC et pose (fabrication AGEM, BPA, poseurs, client) ? | Seuils de la section 8.4, ajustés pendant le pilote |
| PO-2 | Une conceptrice peut-elle valider une étape sur l'affaire d'une collègue du même magasin ? | Oui (section 12) |
| PO-3 | Quels champs ne saisir que dans Gesteos et reprendre par import ? | Coordonnées et montants saisis dans les deux en V1, import en B4 |
| PO-4 | Le tableau de commission entre-t-il dans l'outil ? | Non en V1 ; rappel RG-14 seulement |
| PO-5 | Potentiel de CA brut ou pondéré par phase ? | Brut |
| PO-6 | CA affiché en HT ou en TTC ? | HT |
| PO-7 | Indicateurs individuels visibles par tous, y compris en réunion du mardi ? | Oui, comme dans Gesteos |
| PO-8 | Propriété des comptes : JVB Holding dès le départ ou transfert à la mise en production ? | Comptes DCO-IT pour la démo ; à décider avant B7 |
| PO-9 | Nom du dossier client dans PCloud : `NOM Prénom (concepteur)` ? | Convention actuelle à confirmer par Benjamin |
| PO-10 | Durée de conservation des données clients (RGPD) | 3 ans après la dernière affaire |
| PO-11 | Dossier du BDC signé dans PCloud | « 03 - BDC », à confirmer avec l'arborescence |
