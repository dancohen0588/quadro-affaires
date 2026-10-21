# Indicateurs de pilotage — définitions

Référence : `docs/conception.md`, section 10 (KPI-01 à KPI-11), section 8.4 (alertes RG-20 à RG-29), exigences EF-80 à EF-93.

Ce document fixe la définition exacte de chaque indicateur **avant** son code. Chaque indicateur est une vue SQL du schéma `public`, en `security_invoker` : elle ne montre que ce que la RLS laisse voir à la personne connectée (un gérant voit les trois magasins, une conceptrice ses magasins). Les vues sont testées en pgTAP (`supabase/tests/090_indicateurs.test.sql`).

## Règles communes

- **Aujourd'hui** vient de `prive.app_today()`, jamais de `current_date` : l'horloge de démo avance les indicateurs avec elle.
- **Périodes** (vue `kpi_periodes`), toutes closes sur aujourd'hui inclus :

  | Code | Libellé | Début | Fin |
  | --- | --- | --- | --- |
  | `semaine` | Cette semaine | lundi de la semaine ISO | aujourd'hui |
  | `semaine_precedente` | Semaine dernière | lundi précédent | dimanche précédent |
  | `mois` | Ce mois | 1er du mois | aujourd'hui |
  | `mois_precedent` | Mois dernier | 1er du mois précédent | dernier jour du mois précédent |
  | `trimestre` | Ce trimestre | 1er jour du trimestre | aujourd'hui |
  | `annee` | Cette année | 1er janvier | aujourd'hui |
  | `douze_mois` | 12 derniers mois | aujourd'hui − 12 mois + 1 jour | aujourd'hui |

- **Dates** : une date stockée en `timestamptz` (RDV) est ramenée au jour de Paris (`at time zone 'Europe/Paris'`).
- **Déclinaison** (D19) : chaque vue porte `magasin_id` et `concepteur_id` ; l'écran agrège selon les filtres. Les vues par période portent aussi `periode`.
- **Concepteur d'une vente** : celui de la première affaire rattachée (une vente regroupe des affaires du même client, en pratique du même concepteur). **Magasin d'une vente** : `vente.magasin_id`.
- **Montants** en centimes, HT sauf mention contraire.
- **Affaire en cours** : statut `active` ou `gagnee`.
- **Jours ouvrés** : lundi à vendredi hors fériés français, calculés en SQL par `prive.jours_ouvres_ecoules(a, b)`, identique à `joursOuvresEcoules` en TypeScript (jours ouvrés après `a`, jusqu'à `b` inclus).

## Indicateurs

| ID | Vue | Colonnes | Définition |
| --- | --- | --- | --- |
| KPI-01, KPI-02 | `kpi_ventes` | periode, magasin_id, concepteur_id, nb_ventes, ca_ht_cts, ca_ttc_cts | Ventes dont `date_signature` est dans la période. CA signé = somme HT ; panier moyen = CA HT / nombre de ventes (calculé à l'écran après filtres). |
| KPI-03 | `kpi_flux_entrant` | periode, magasin_id, concepteur_id, nb_clients, nb_cnq | Clients créés (`created_at`, jour de Paris) dans la période, dans le magasin du client ; concepteur = auteur de la saisie ; les CNQ sont inclus et comptés à part. |
| KPI-04 | `kpi_potentiel` | magasin_id, concepteur_id, nb_affaires, potentiel_ht_cts | Affaires `active` ayant une étape ouverte de la branche principale en phase `conception` (02) ou `vente` (03) ; somme de `montant_devis_ht_cts`. Pas de pondération par phase (point ouvert). Photo à aujourd'hui, sans période. |
| KPI-05 | `kpi_transformation` | periode, magasin_id, concepteur_id, nb_r3, nb_vendues | Affaires dont le **premier R3 fait** a eu lieu dans la période ; vendues = rattachées à une vente aujourd'hui. Taux = nb_vendues / nb_r3. |
| KPI-06 | `kpi_rdv` | periode, magasin_id, concepteur_id, type, nb | RDV `fait` de type R0, R1, R2, R3 dans la période ; concepteur = personne du RDV ; magasin = celui de l'affaire, à défaut celui du client. |
| KPI-07 | `alertes` | affaire_id, magasin_id, concepteur_id, regle, gravite, depuis, montant_cts, detail, echeance_id | Une ligne par alerte en cours (RG-20 à RG-29, ci-dessous). KPI-07 = nombre d'affaires distinctes en alerte RG-20 (commerce) ou RG-21, RG-28, RG-29 (après-vente). |
| KPI-08 | `kpi_reglements` | magasin_id, concepteur_id, attendu_30j_cts, nb_attendus_30j, retard_cts, nb_retard | Échéances non reçues : attendues entre aujourd'hui et J+30 ; en retard si la date attendue est passée. Photo à aujourd'hui. |
| KPI-09 | `kpi_delai_r1_vente` | periode, magasin_id, concepteur_id, nb_ventes, total_jours | Ventes de la période dont une affaire a un R1 fait : jours entre le premier R1 fait de ses affaires et la signature. Moyenne = total_jours / nb_ventes. |
| KPI-10 | `kpi_motifs` | periode, magasin_id, concepteur_id, motif, nb | Affaires `perdue` ou `abandonnee` ; date de la perte = dernière étape close avec un motif, à défaut dernier RDV fait, à défaut création de l'affaire. |
| — | `kpi_en_cours` | magasin_id, concepteur_id, nb_affaires, nb_inactives | Affaires en cours ; inactives = sans activité depuis plus de `inactivite_jours` (RG-27). |
| KPI-11 | — | — | Marge estimée : livrée avec la lecture du débit AGEM (J5). |

## Alertes (vue `alertes`, EF-91)

Seuils lus dans `parametre.seuils` par `prive.seuil(cle)`. Gravité 1 (rouge) avant gravité 2 (orange), puis ancienneté.

| Règle | Condition | Gravité | Depuis |
| --- | --- | --- | --- |
| RG-20 Retard commerce | Affaire `active` non vendue, premier R1 fait il y a plus de `retard_commerce_jours`, aucun R3 fait (D17 : « > 2 semaines entre R1 et R3 ») | 1 | date du R1 |
| RG-21 Retard BPA | Commande AGEM confirmée, BPA non donné, plus de `retard_bpa_jours_ouvres` jours ouvrés depuis la confirmation | 1 | confirmation |
| RG-22 ARC non reçu | Commande AGEM envoyée, sans ARC, plus de `arc_non_recu_jours_ouvres` jours ouvrés | 1 | envoi |
| RG-23 AR non reçu | Commande autre fournisseur envoyée, sans AR, plus de `ar_non_recu_jours_ouvres` jours ouvrés | 2 | envoi |
| RG-24 Acompte 1 non reçu | Non reçu, signature + `acompte_1_non_recu_jours` dépassée | 1 | signature |
| RG-25 Acompte 2 non reçu | Non reçu, date attendue (livraison) + `acompte_2_non_recu_jours` dépassée | 1 | date attendue |
| RG-26 Solde non reçu | Non reçu, date attendue + `solde_non_recu_jours` dépassée | 2 | date attendue |
| RG-27 Inactivité | Affaire en cours (`active` ou `gagnee`, comme « Ma journée ») sans activité depuis plus de `inactivite_jours` | 2 | dernière activité |
| RG-28 Dossier de pose incomplet | Pose confirmée dans `dossier_pose_incomplet_jours` jours au plus (et pas encore passée), étape DOSSIER_POSE non faite | 1 | pose − seuil |
| RG-29 Livraison menacée | Semaine annoncée par l'ARC postérieure à la semaine de livraison confirmée | 1 | ARC |

Une alerte de règlement est rattachée à la première affaire de la vente et porte `echeance_id` et `montant_cts` (tableau « Règlements à vérifier »). Les traitements de nuit (session 4.2) s'appuient sur cette vue pour créer les tâches et le digest ; la vue reste la seule définition des alertes.

## Écrans

- **Pipeline** (EF-80 à EF-82) : affaires en cours en 6 colonnes selon la phase de leur étape courante (affichage) ; point rouge si une alerte de gravité 1 ou une inactivité, orange si une alerte de gravité 2 ou une relance en attente, vert sinon ; prochain jalon = tâche à faire non optionnelle la plus proche ; « signés en attente de pose » = devis des affaires vendues hors phase Clôture ; vue liste et export CSV (`/pipeline/export`, séparateur « ; », UTF-8 avec BOM) avec les mêmes filtres.
- **Pilotage** (EF-90 à EF-92, gérants) : cartes KPI-01, 02, 05, 07 ; flux entrant, potentiel, règlements, délai R1 → vente, motifs ; alertes par gravité ; affaires par phase ; RDV de la période par type.
- **Point du mardi** (EF-93, `/point-du-mardi`, hors coquille) : semaine précédente (ventes, CA, RDV, transformation) et 7 prochains jours (R3 prévus, livraisons des semaines ISO touchées, poses, règlements attendus), alertes, une colonne par magasin, en grand format.
- **Navigation** : le badge Pilotage des gérants compte les alertes de gravité 1.
