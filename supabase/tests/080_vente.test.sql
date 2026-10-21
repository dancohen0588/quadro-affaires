-- Vente et planning (session 3.2) : création tout ou rien (RG-08, RG-11, EF-60), confirmation (EF-61, RG-12).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.societe (id, nom, code) values ('50000000-0000-0000-0000-0000000000a1', 'Société vente', 'VENT');
insert into public.magasin (id, nom, code, societe_id) values ('50000000-0000-0000-0000-0000000000b1', 'V1', 'VENA', '50000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-000000000001', 'v-c1@exemple.test'),
  ('50000000-0000-0000-0000-000000000002', 'v-g@exemple.test');
insert into public.profil (id, prenom, email, role, initiales) values
  ('50000000-0000-0000-0000-000000000001', 'C1', 'v-c1@exemple.test', 'conceptrice', 'C1'),
  ('50000000-0000-0000-0000-000000000002', 'Val', 'v-g@exemple.test', 'gerant', 'VA');
insert into public.profil_magasin (profil_id, magasin_id) values ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-0000000000b1');
update public.parametre set valeur = '"50000000-0000-0000-0000-000000000002"' where cle = 'gerant_logistique';
insert into public.process_version (id, nom, definition) values ('50000000-0000-0000-0000-0000000000c1', 'vente', '{}');
insert into public.client (id, nom, magasin_id) values
  ('50000000-0000-0000-0000-0000000000d1', 'VENDU', '50000000-0000-0000-0000-0000000000b1'),
  ('50000000-0000-0000-0000-0000000000d2', 'AUTRE', '50000000-0000-0000-0000-0000000000b1');
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id) values
  ('50000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001', 'cuisine', 'VENDU · Cuisine', 'VENDU', '50000000-0000-0000-0000-0000000000c1'),
  ('50000000-0000-0000-0000-0000000000e2', '50000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001', 'dressing', 'VENDU · Dressing', 'VENDU', '50000000-0000-0000-0000-0000000000c1'),
  ('50000000-0000-0000-0000-0000000000e3', '50000000-0000-0000-0000-0000000000d2', '50000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001', 'bureau', 'AUTRE · Bureau', 'AUTRE', '50000000-0000-0000-0000-0000000000c1');
insert into public.etape_instance (id, affaire_id, etape_code, phase_code, statut, debut_at) values
  ('50000000-0000-0000-0000-000000000101', '50000000-0000-0000-0000-0000000000e1', 'VENTE', 'vente', 'en_cours', '2026-10-20 10:00+02');
insert into public.tache (affaire_id, etape_instance_id, modele_code, titre, assignee_id, origine) values
  ('50000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-000000000101', 'creer_vente', 'Créer la vente', '50000000-0000-0000-0000-000000000001', 'process'),
  ('50000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-000000000101', 'demander_avis', 'Demander un avis Google', '50000000-0000-0000-0000-000000000001', 'process');
insert into public.etape_instance (affaire_id, etape_code, phase_code, statut, debut_at) values
  ('50000000-0000-0000-0000-0000000000e2', 'VENTE', 'vente', 'en_cours', '2026-10-20 10:00+02');

set local role authenticated;
set local request.jwt.claims = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Refus : somme fausse, autre client.
select throws_ok($$ select public.creer_vente(
  '{"client_id": "50000000-0000-0000-0000-0000000000d1", "magasin_id": "50000000-0000-0000-0000-0000000000b1", "date_signature": "2026-10-21", "montant_ht_cts": 1000000, "montant_ttc_cts": 1200000}',
  '[{"type": "acompte_1", "ordre": 1, "montant_prevu_cts": 480000}]',
  '[{"id": "50000000-0000-0000-0000-0000000000e1", "effets": [], "ouvertes": ["VENTE.1"]}]', null) $$,
  '22023', null, 'une somme d''échéances différente du TTC est refusée (RG-11)');
select throws_ok($$ select public.creer_vente(
  '{"client_id": "50000000-0000-0000-0000-0000000000d1", "magasin_id": "50000000-0000-0000-0000-0000000000b1", "date_signature": "2026-10-21", "montant_ht_cts": 100, "montant_ttc_cts": 120}',
  '[{"type": "acompte_1", "ordre": 1, "montant_prevu_cts": 120}]',
  '[{"id": "50000000-0000-0000-0000-0000000000e3", "effets": [], "ouvertes": []}]', null) $$,
  '22023', 'Les affaires d''une vente doivent appartenir au même client (RG-08).', 'une affaire d''un autre client est refusée (RG-08)');

-- Vente de deux affaires, échéancier 40 / 50 / 10, VENTE validée, demande de planning.
select lives_ok($$ select public.creer_vente(
  '{"client_id": "50000000-0000-0000-0000-0000000000d1", "magasin_id": "50000000-0000-0000-0000-0000000000b1", "date_signature": "2026-10-21",
    "montant_ht_cts": 1000000, "montant_ttc_cts": 1200000, "financement": "aucun", "gesteos_devis_ref": "D20261021#4600"}',
  '[{"type": "acompte_1", "ordre": 1, "pourcentage": 40, "montant_prevu_cts": 480000, "date_attendue": "2026-10-21"},
    {"type": "acompte_2", "ordre": 2, "pourcentage": 50, "montant_prevu_cts": 600000},
    {"type": "solde", "ordre": 3, "pourcentage": 10, "montant_prevu_cts": 120000}]',
  '[{"id": "50000000-0000-0000-0000-0000000000e1", "ouvertes": ["VENTE.1"], "effets": [
      {"type": "faire_taches", "etape": "VENTE", "iteration": 1, "codes": ["creer_vente"]},
      {"type": "fermer_etape", "etape": "VENTE", "iteration": 1, "issue": "vendu", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "50000000-0000-0000-0000-000000000001"},
      {"type": "annuler_taches", "etape": "VENTE", "iteration": 1},
      {"type": "ouvrir_etape", "etape": "ACOMPTE_1", "iteration": 1, "branche": "principale", "phase": "vente", "quand": "2026-10-21T10:00:00+02:00"},
      {"type": "etape_courante", "etape": "ACOMPTE_1"}]},
    {"id": "50000000-0000-0000-0000-0000000000e2", "ouvertes": ["VENTE.1"], "effets": [
      {"type": "fermer_etape", "etape": "VENTE", "iteration": 1, "issue": "vendu", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "50000000-0000-0000-0000-000000000001"},
      {"type": "ouvrir_etape", "etape": "ACOMPTE_1", "iteration": 1, "branche": "principale", "phase": "vente", "quand": "2026-10-21T10:00:00+02:00"}]}]',
  '{"semaine_livraison_souhaitee": "2026-S47", "date_pose_souhaitee": "2026-11-19"}') $$, 'C1 vend les deux affaires du client en une vente');

select results_eq($$ select a.statut, a.vente_id is not null, (select string_agg(e.etape_code || ':' || e.statut, ',' order by e.etape_code) from public.etape_instance e where e.affaire_id = a.id)
                     from public.affaire a where a.client_id = '50000000-0000-0000-0000-0000000000d1' order by a.projet $$,
  $$ values ('gagnee'::text, true, 'ACOMPTE_1:en_cours,VENTE:faite'::text), ('gagnee', true, 'ACOMPTE_1:en_cours,VENTE:faite') $$,
  'les affaires sont gagnées, rattachées, et passent à l''acompte 1 (RG-08)');
select results_eq($$ select modele_code, statut from public.tache where affaire_id = '50000000-0000-0000-0000-0000000000e1' and etape_instance_id is not null order by modele_code $$,
  $$ values ('creer_vente'::text, 'faite'::text), ('demander_avis', 'annulee') $$, 'la tâche accomplie par la création est faite, les autres annulées (RG-05)');
select results_eq($$ select type, montant_prevu_cts from public.echeance e join public.vente v on v.id = e.vente_id where v.client_id = '50000000-0000-0000-0000-0000000000d1' order by ordre $$,
  $$ values ('acompte_1'::text, 480000), ('acompte_2', 600000), ('solde', 120000) $$, 'l''échéancier est enregistré');
select results_eq($$ select p.statut, p.semaine_livraison_souhaitee, p.demande_par from public.planning p join public.vente v on v.id = p.vente_id where v.client_id = '50000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('demandee'::text, '2026-S47'::text, '50000000-0000-0000-0000-000000000001'::uuid) $$, 'la demande de planning est créée (EF-60)');
select is((select assignee_id from public.tache where modele_code = 'confirmer_planning' and affaire_id = '50000000-0000-0000-0000-0000000000e1'),
  '50000000-0000-0000-0000-000000000002'::uuid, 'la confirmation du planning est confiée au gérant logistique');
select throws_ok($$ select public.creer_vente(
  '{"client_id": "50000000-0000-0000-0000-0000000000d1", "magasin_id": "50000000-0000-0000-0000-0000000000b1", "date_signature": "2026-10-21", "montant_ht_cts": 100, "montant_ttc_cts": 120}',
  '[{"type": "acompte_1", "ordre": 1, "montant_prevu_cts": 120}]',
  '[{"id": "50000000-0000-0000-0000-0000000000e1", "effets": [], "ouvertes": []}]', null) $$,
  '22023', null, 'une affaire déjà vendue ne l''est pas deux fois');

select throws_ok($$ select public.confirmer_planning((select id from public.vente where client_id = '50000000-0000-0000-0000-0000000000d1'), 'confirmee', '2026-S47', '2026-11-19', 'BAJV', null) $$,
  '42501', null, 'une conceptrice ne confirme pas le planning (EF-61)');

-- ── Gérant logistique ──
set local request.jwt.claims = '{"sub": "50000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok($$ select public.confirmer_planning((select id from public.vente where client_id = '50000000-0000-0000-0000-0000000000d1'), 'peut-etre', null, null, null, null) $$,
  '22023', null, 'une réponse inconnue est refusée');
select lives_ok($$ select public.confirmer_planning((select id from public.vente where client_id = '50000000-0000-0000-0000-0000000000d1'), 'decalee', '2026-S48', '2026-11-26', null, 'Transtock complet en S47') $$,
  'le gérant propose d''autres dates');
select is((select date_attendue from public.echeance e join public.vente v on v.id = e.vente_id where v.client_id = '50000000-0000-0000-0000-0000000000d1' and e.type = 'acompte_2'),
  null, 'une proposition ne change pas les dates attendues');
select lives_ok($$ select public.confirmer_planning((select id from public.vente where client_id = '50000000-0000-0000-0000-0000000000d1'), 'confirmee', '2026-S48', '2026-11-26', 'BAJV Agencements', null) $$,
  'le gérant confirme la livraison et la pose');
select results_eq($$ select e.type, e.date_attendue from public.echeance e join public.vente v on v.id = e.vente_id
                     where v.client_id = '50000000-0000-0000-0000-0000000000d1' and e.type in ('acompte_2', 'solde') order by e.ordre $$,
  $$ values ('acompte_2'::text, '2026-11-23'::date), ('solde', '2026-11-26'::date) $$, 'acompte 2 au lundi de la livraison, solde à la pose (RG-12)');
select is((select statut from public.tache where modele_code = 'confirmer_planning' and affaire_id = '50000000-0000-0000-0000-0000000000e1'), 'faite',
  'la tâche de confirmation est faite');

select * from finish();
rollback;
