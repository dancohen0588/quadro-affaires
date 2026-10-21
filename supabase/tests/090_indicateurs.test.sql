-- Indicateurs (session 4.1) : calendrier SQL, périodes, KPI-01 à KPI-10, alertes RG-20 à RG-29, droits.
-- Aujourd'hui est fixé au mercredi 21 octobre 2026 par l'horloge de démo (now() est figé dans la transaction).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

update public.parametre set valeur = jsonb_build_object('decalage_secondes', extract(epoch from ('2026-10-21 12:00+02'::timestamptz - now())))
 where cle = 'horloge_demo';
update public.parametre set valeur = '{"retard_commerce_jours": 14, "retard_bpa_jours_ouvres": 3, "arc_non_recu_jours_ouvres": 5,
  "ar_non_recu_jours_ouvres": 5, "acompte_1_non_recu_jours": 3, "acompte_2_non_recu_jours": 2, "solde_non_recu_jours": 7,
  "inactivite_jours": 10, "dossier_pose_incomplet_jours": 7, "max_r2_par_jour": 1, "max_r3_par_semaine": 4,
  "relance_r2_sans_reponse_jours": 7}' where cle = 'seuils';

insert into public.societe (id, nom, code) values ('90000000-0000-0000-0000-0000000000a1', 'Société KPI', 'KPIS');
insert into public.magasin (id, nom, code, societe_id) values
  ('90000000-0000-0000-0000-0000000000b1', 'K1', 'KPIA', '90000000-0000-0000-0000-0000000000a1'),
  ('90000000-0000-0000-0000-0000000000b2', 'K2', 'KPIB', '90000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-000000000001', 'k-c1@exemple.test'),
  ('90000000-0000-0000-0000-000000000002', 'k-c2@exemple.test'),
  ('90000000-0000-0000-0000-000000000003', 'k-g@exemple.test');
insert into public.profil (id, prenom, email, role, initiales) values
  ('90000000-0000-0000-0000-000000000001', 'C1', 'k-c1@exemple.test', 'conceptrice', 'C1'),
  ('90000000-0000-0000-0000-000000000002', 'C2', 'k-c2@exemple.test', 'conceptrice', 'C2'),
  ('90000000-0000-0000-0000-000000000003', 'G', 'k-g@exemple.test', 'gerant', 'G');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000b1'),
  ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b2');
insert into public.process_version (id, nom, definition) values ('90000000-0000-0000-0000-0000000000c1', 'kpi', '{}');

insert into public.client (id, nom, magasin_id, cnq, created_at) values
  ('90000000-0000-0000-0000-0000000000d1', 'KUN', '90000000-0000-0000-0000-0000000000b1', false, '2026-10-20 10:00+02'),
  ('90000000-0000-0000-0000-0000000000d2', 'KDEUX', '90000000-0000-0000-0000-0000000000b1', true, '2026-10-19 10:00+02'),
  ('90000000-0000-0000-0000-0000000000d3', 'KTROIS', '90000000-0000-0000-0000-0000000000b1', false, '2026-09-01 10:00+02');
insert into public.vente (id, client_id, magasin_id, date_signature, montant_ht_cts, montant_ttc_cts) values
  ('90000000-0000-0000-0000-0000000000f1', '90000000-0000-0000-0000-0000000000d1', '90000000-0000-0000-0000-0000000000b1', '2026-10-20', 1000000, 1200000),
  ('90000000-0000-0000-0000-0000000000f2', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '2026-09-15', 500000, 600000);

insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id, statut, motif_perte, vente_id, montant_devis_ht_cts, created_at, derniere_activite_at) values
  ('90000000-0000-0000-0000-0000000000e1', '90000000-0000-0000-0000-0000000000d1', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'cuisine', 'A1 · Cuisine', 'KUN', '90000000-0000-0000-0000-0000000000c1', 'gagnee', null, '90000000-0000-0000-0000-0000000000f1', 1000000, default, null),
  ('90000000-0000-0000-0000-0000000000e2', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'entrée', 'A2 · Entrée', 'KTROIS', '90000000-0000-0000-0000-0000000000c1', 'active', null, null, 800000, default, null),
  ('90000000-0000-0000-0000-0000000000e3', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'placard', 'A3 · Placard', 'KTROIS', '90000000-0000-0000-0000-0000000000c1', 'active', null, null, null, default, null),
  ('90000000-0000-0000-0000-0000000000e4', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'bureau', 'A4 · Bureau', 'KTROIS', '90000000-0000-0000-0000-0000000000c1', 'active', null, null, null, '2026-10-05 10:00+02', '2026-10-05 10:00+02'),
  ('90000000-0000-0000-0000-0000000000e5', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'bibliothèque', 'A5 · Bibliothèque', 'KTROIS', '90000000-0000-0000-0000-0000000000c1', 'perdue', 'prix', null, 400000, '2026-09-20 10:00+02', null),
  ('90000000-0000-0000-0000-0000000000e6', '90000000-0000-0000-0000-0000000000d3', '90000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000001', 'dressing', 'A6 · Dressing', 'KTROIS', '90000000-0000-0000-0000-0000000000c1', 'gagnee', null, '90000000-0000-0000-0000-0000000000f2', 500000, default, null);

insert into public.etape_instance (affaire_id, etape_code, phase_code, statut, issue_code, motif, debut_at, fin_at, created_at) values
  ('90000000-0000-0000-0000-0000000000e2', 'R3', 'vente', 'en_cours', null, null, '2026-10-15 10:00+02', null, default),
  ('90000000-0000-0000-0000-0000000000e3', 'R1', 'accueil', 'en_cours', null, null, '2026-10-01 10:00+02', null, default),
  ('90000000-0000-0000-0000-0000000000e4', 'CONCEPTION', 'conception', 'en_cours', null, null, '2026-10-05 10:00+02', null, '2026-10-05 10:00+02'),
  ('90000000-0000-0000-0000-0000000000e5', 'R3', 'vente', 'faite', 'perdue', 'prix', '2026-10-01 10:00+02', '2026-10-16 10:00+02', default);

insert into public.rdv (affaire_id, client_id, type, debut, profil_id, statut) values
  ('90000000-0000-0000-0000-0000000000e1', '90000000-0000-0000-0000-0000000000d1', 'R1', '2026-10-01 10:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  ('90000000-0000-0000-0000-0000000000e1', '90000000-0000-0000-0000-0000000000d1', 'R3', '2026-10-14 10:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  ('90000000-0000-0000-0000-0000000000e2', '90000000-0000-0000-0000-0000000000d3', 'R1', '2026-09-01 10:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  ('90000000-0000-0000-0000-0000000000e2', '90000000-0000-0000-0000-0000000000d3', 'R3', '2026-10-15 10:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  ('90000000-0000-0000-0000-0000000000e2', '90000000-0000-0000-0000-0000000000d3', 'R1', '2026-10-22 10:00+02', '90000000-0000-0000-0000-000000000001', 'prevu'),
  ('90000000-0000-0000-0000-0000000000e3', '90000000-0000-0000-0000-0000000000d3', 'R1', '2026-10-01 14:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  ('90000000-0000-0000-0000-0000000000e6', '90000000-0000-0000-0000-0000000000d3', 'R1', '2026-09-01 14:00+02', '90000000-0000-0000-0000-000000000001', 'fait'),
  (null, '90000000-0000-0000-0000-0000000000d2', 'R0', '2026-10-19 10:00+02', '90000000-0000-0000-0000-000000000001', 'fait');

insert into public.echeance (vente_id, type, ordre, montant_prevu_cts, date_attendue, recu_le, montant_recu_cts) values
  ('90000000-0000-0000-0000-0000000000f1', 'acompte_1', 1, 480000, '2026-10-20', null, null),
  ('90000000-0000-0000-0000-0000000000f1', 'acompte_2', 2, 600000, '2026-11-10', null, null),
  ('90000000-0000-0000-0000-0000000000f1', 'solde', 3, 120000, null, null, null),
  ('90000000-0000-0000-0000-0000000000f2', 'acompte_1', 1, 240000, '2026-09-15', null, null),
  ('90000000-0000-0000-0000-0000000000f2', 'acompte_2', 2, 300000, '2026-10-01', '2026-10-01', 300000),
  ('90000000-0000-0000-0000-0000000000f2', 'solde', 3, 60000, '2026-10-30', null, null);

insert into public.commande_fournisseur (affaire_id, fournisseur, iteration, envoyee_le, arc_recu_le, semaine_annoncee, confirmation_recue_le, statut) values
  ('90000000-0000-0000-0000-0000000000e1', 'AGEM', 1, '2026-10-13', null, null, null, 'envoyee'),
  ('90000000-0000-0000-0000-0000000000e6', 'AGEM', 1, '2026-10-14', null, null, null, 'envoyee'),
  ('90000000-0000-0000-0000-0000000000e6', 'AGEM', 2, '2026-10-08', '2026-10-14', '2026-S45', '2026-10-15', 'en_verification');

insert into public.planning (vente_id, semaine_livraison_confirmee, date_pose_confirmee, statut) values
  ('90000000-0000-0000-0000-0000000000f1', '2026-S44', '2026-10-26', 'confirmee'),
  ('90000000-0000-0000-0000-0000000000f2', '2026-S44', '2026-11-20', 'confirmee');

-- ── Calendrier : mêmes résultats que src/lib/rules/calendrier.ts ──
select results_eq($$ select prive.paques(a) from unnest(array[2024, 2026, 2027]) a $$,
  $$ values ('2024-03-31'::date), ('2026-04-05'), ('2027-03-28') $$, 'Pâques selon Meeus');
select results_eq($$ select prive.est_ferie(d::date) from unnest(array['2026-05-14', '2026-05-25', '2026-04-06', '2026-07-14', '2026-05-15']) d $$,
  $$ values (true), (true), (true), (true), (false) $$, 'Ascension, Pentecôte, lundi de Pâques et 14 juillet sont fériés');
select results_eq($$ select prive.jours_ouvres_ecoules(a::date, b::date) from (values ('2026-04-30', '2026-05-11'), ('2026-10-21', '2026-10-21'), ('2026-10-21', '2026-10-01'), ('2026-10-16', '2026-10-19')) x(a, b) $$,
  $$ values (5), (0), (0), (1) $$, 'jours ouvrés après a jusqu''à b inclus, fériés et week-ends exclus');

-- ── Périodes calculées depuis app_today() ──
select results_eq($$ select code, debut, fin from public.kpi_periodes where code in ('semaine', 'semaine_precedente', 'mois_precedent', 'douze_mois') order by ordre $$,
  $$ values ('semaine'::text, '2026-10-19'::date, '2026-10-21'::date), ('semaine_precedente', '2026-10-12', '2026-10-18'),
            ('mois_precedent', '2026-09-01', '2026-09-30'), ('douze_mois', '2025-10-22', '2026-10-21') $$,
  'les périodes suivent l''horloge applicative');

-- ── Conceptrice C1 (magasin KPIA) ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "90000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select results_eq($$ select periode, nb_ventes, ca_ht_cts from public.kpi_ventes
                      where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode in ('semaine', 'mois_precedent', 'annee') order by periode $$,
  $$ values ('annee'::text, 2, 1500000::bigint), ('mois_precedent', 1, 500000), ('semaine', 1, 1000000) $$, 'KPI-01, KPI-02 : CA signé et ventes par période');
select results_eq($$ select sum(nb_clients)::int, sum(nb_cnq)::int from public.kpi_flux_entrant where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode = 'semaine' $$,
  $$ values (2, 1) $$, 'KPI-03 : clients créés dans la semaine, CNQ comptés à part');
select results_eq($$ select nb_affaires, potentiel_ht_cts, nb_chiffrees from public.kpi_potentiel where magasin_id = '90000000-0000-0000-0000-0000000000b1' $$,
  $$ values (2, 800000::bigint, 1) $$, 'KPI-04 : potentiel des affaires actives en conception ou en vente');
select results_eq($$ select nb_r3, nb_vendues from public.kpi_transformation where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode = 'semaine_precedente' $$,
  $$ values (2, 1) $$, 'KPI-05 : premier R3 dans la période, part vendue');
select results_eq($$ select type, sum(nb)::int from public.kpi_rdv where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode = 'mois' group by type order by type $$,
  $$ values ('R0'::text, 1), ('R1', 2), ('R3', 2) $$, 'KPI-06 : RDV faits du mois par type, RDV prévus exclus');
select results_eq($$ select attendu_30j_cts, nb_attendus_30j, retard_cts, nb_retard from public.kpi_reglements where magasin_id = '90000000-0000-0000-0000-0000000000b1' $$,
  $$ values (660000::bigint, 2, 720000::bigint, 2) $$, 'KPI-08 : règlements attendus à 30 jours et en retard');
select results_eq($$ select periode, nb_ventes, total_jours from public.kpi_delai_r1_vente where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode in ('semaine', 'annee') order by periode $$,
  $$ values ('annee'::text, 2, 33), ('semaine', 1, 19) $$, 'KPI-09 : délai entre le premier R1 et la signature');
select results_eq($$ select motif, nb from public.kpi_motifs where magasin_id = '90000000-0000-0000-0000-0000000000b1' and periode = 'semaine_precedente' $$,
  $$ values ('prix'::text, 1) $$, 'KPI-10 : motif daté par la fin de l''étape close avec motif');
select results_eq($$ select nb_affaires, nb_inactives from public.kpi_en_cours where magasin_id = '90000000-0000-0000-0000-0000000000b1' $$,
  $$ values (5, 1) $$, 'affaires en cours et inactives (RG-27)');

select results_eq($$ select a.libelle, x.regle, x.gravite from public.alertes x join public.affaire a on a.id = x.affaire_id
                      where x.magasin_id = '90000000-0000-0000-0000-0000000000b1' order by x.regle, a.libelle $$,
  $$ values ('A3 · Placard'::text, 'RG-20'::text, 1), ('A6 · Dressing', 'RG-21', 1), ('A1 · Cuisine', 'RG-22', 1), ('A6 · Dressing', 'RG-24', 1),
            ('A4 · Bureau', 'RG-27', 2), ('A1 · Cuisine', 'RG-28', 1), ('A6 · Dressing', 'RG-29', 1) $$,
  'alertes RG-20 à RG-29 aux seuils exacts (RG-22 : 6 jours ouvrés alerte, 5 non)');
select results_eq($$ select montant_cts, detail from public.alertes where regle = 'RG-24' and magasin_id = '90000000-0000-0000-0000-0000000000b1' $$,
  $$ values (240000::bigint, 'Acompte 1 non reçu, 36 jours après la signature'::text) $$, 'une alerte de règlement porte le montant et un libellé clair');

-- ── Conceptrice C2 (autre magasin) : rien du magasin KPIA ──
set local request.jwt.claims = '{"sub": "90000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is_empty($$ select 1 from public.kpi_ventes where magasin_id = '90000000-0000-0000-0000-0000000000b1'
                   union all select 1 from public.alertes where magasin_id = '90000000-0000-0000-0000-0000000000b1' $$,
  'les vues suivent la RLS : une conceptrice ne voit pas les chiffres d''un autre magasin');

-- ── Gérant : tout ──
set local request.jwt.claims = '{"sub": "90000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.alertes where magasin_id = '90000000-0000-0000-0000-0000000000b1'), 7, 'le gérant voit les alertes du magasin');

-- ── Horloge avancée de 3 jours : indicateurs et alertes à la date simulée ──
reset role;
update public.parametre set valeur = jsonb_build_object('decalage_secondes', extract(epoch from ('2026-10-24 12:00+02'::timestamptz - now())))
 where cle = 'horloge_demo';
set local role authenticated;
select results_eq($$ select a.libelle from public.alertes x join public.affaire a on a.id = x.affaire_id
                      where x.magasin_id = '90000000-0000-0000-0000-0000000000b1' and x.regle in ('RG-22', 'RG-24') order by x.regle, a.libelle $$,
  $$ values ('A1 · Cuisine'::text), ('A6 · Dressing'), ('A1 · Cuisine'), ('A6 · Dressing') $$,
  'à J+3, l''acompte 1 de la vente du 20 et l''ARC envoyé le 14 passent en alerte');
select results_eq($$ select debut, fin from public.kpi_periodes where code = 'semaine' $$,
  $$ values ('2026-10-19'::date, '2026-10-24'::date) $$, 'la semaine en cours va jusqu''à la date simulée');

-- ── anon n'a aucun accès ──
set local role anon;
select throws_ok($$ select * from public.alertes $$, '42501', null, 'anon ne lit pas les alertes');

select * from finish();
rollback;
