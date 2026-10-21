-- Application des effets du moteur de process (session 2.1) : droits, concurrence, RG-01, rôles, RDV.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ── Jeu de données (en tant que propriétaire : la RLS ne s'applique pas) ────────────────────────
insert into public.societe (id, nom, code) values ('30000000-0000-0000-0000-0000000000a1', 'Société moteur', 'MOTR');
insert into public.magasin (id, nom, code, societe_id) values
  ('30000000-0000-0000-0000-0000000000b1', 'M1', 'MOTA', '30000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000b2', 'M2', 'MOTB', '30000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'm-c1@exemple.test'),
  ('30000000-0000-0000-0000-000000000002', 'm-c2@exemple.test'),
  ('30000000-0000-0000-0000-000000000003', 'm-e@exemple.test'),
  ('30000000-0000-0000-0000-000000000004', 'm-b@exemple.test');
insert into public.profil (id, prenom, email, role, rubriques, initiales) values
  ('30000000-0000-0000-0000-000000000001', 'C1', 'm-c1@exemple.test', 'conceptrice', '{}', 'C1'),
  ('30000000-0000-0000-0000-000000000002', 'C2', 'm-c2@exemple.test', 'conceptrice', '{}', 'C2'),
  ('30000000-0000-0000-0000-000000000003', 'E', 'm-e@exemple.test', 'transverse', '{r4_avis}', 'E'),
  ('30000000-0000-0000-0000-000000000004', 'B', 'm-b@exemple.test', 'gerant', '{}', 'B');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-0000000000b1'),
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-0000000000b2'),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-0000000000b1');
update public.parametre set valeur = '"30000000-0000-0000-0000-000000000004"' where cle = 'gerant_bpa';
update public.parametre set valeur = null where cle = 'gerant_finance';
insert into public.process_version (id, nom, definition) values ('30000000-0000-0000-0000-0000000000c1', 'moteur', '{}');
insert into public.client (id, nom, magasin_id) values ('30000000-0000-0000-0000-0000000000d1', 'MOTEUR', '30000000-0000-0000-0000-0000000000b1');
insert into public.vente (id, client_id, magasin_id, date_signature, montant_ht_cts, montant_ttc_cts) values
  ('30000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000b1', '2026-10-01', 1000000, 1200000);
insert into public.echeance (id, vente_id, type, ordre, montant_prevu_cts) values
  ('30000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000f1', 'acompte_1', 1, 480000);
-- A1 : au R0. A2 : vendue, à la commande AGEM. A3 : en clôture, R4 et solde ouverts. A4 : reprise d'historique.
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id, statut, vente_id) values
  ('30000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'cuisine', 'MOTEUR · Cuisine', 'MOTEUR', '30000000-0000-0000-0000-0000000000c1', 'active', null),
  ('30000000-0000-0000-0000-0000000000e2', '30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'dressing', 'MOTEUR · Dressing', 'MOTEUR', '30000000-0000-0000-0000-0000000000c1', 'gagnee', '30000000-0000-0000-0000-0000000000f1'),
  ('30000000-0000-0000-0000-0000000000e3', '30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'placard', 'MOTEUR · Placard', 'MOTEUR', '30000000-0000-0000-0000-0000000000c1', 'gagnee', null),
  ('30000000-0000-0000-0000-0000000000e4', '30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-000000000001', 'bureau', 'MOTEUR · Bureau', 'MOTEUR', '30000000-0000-0000-0000-0000000000c1', 'gagnee', null);
insert into public.etape_instance (id, affaire_id, etape_code, phase_code, statut, debut_at) values
  ('30000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-0000000000e1', 'R0', 'accueil', 'en_cours', '2026-10-20 10:00+02'),
  ('30000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-0000000000e2', 'COMMANDE_AGEM', 'commande', 'en_cours', '2026-10-20 10:00+02'),
  ('30000000-0000-0000-0000-000000000103', '30000000-0000-0000-0000-0000000000e3', 'SOLDE', 'cloture', 'en_cours', '2026-10-20 10:00+02'),
  ('30000000-0000-0000-0000-000000000104', '30000000-0000-0000-0000-0000000000e3', 'R4', 'cloture', 'en_cours', '2026-10-20 10:00+02');
insert into public.tache (affaire_id, etape_instance_id, modele_code, titre, assignee_id, origine) values
  ('30000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-000000000101', 'noter_agenda', 'Noter le RDV', '30000000-0000-0000-0000-000000000001', 'process');

-- ── Serveur (clé secrète, sans utilisateur) : la reprise d'historique n'est pas bloquée par RG-01 ──
select lives_ok($$ insert into public.etape_instance (affaire_id, etape_code, phase_code, statut, issue_code, debut_at, fin_at)
  values ('30000000-0000-0000-0000-0000000000e4', 'COMMANDE_AGEM', 'commande', 'faite', 'envoyee', '2026-09-01 10:00+02', '2026-09-02 10:00+02') $$,
  'le seed écrit une commande AGEM passée sans échéance');

-- ── Conceptrice du magasin (C1) ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "30000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e1', '[
  {"type": "fermer_etape", "etape": "R0", "iteration": 1, "issue": "r1_pris", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "30000000-0000-0000-0000-000000000001"},
  {"type": "annuler_taches", "etape": "R0", "iteration": 1},
  {"type": "ouvrir_etape", "etape": "R1", "iteration": 1, "branche": "principale", "phase": "accueil", "quand": "2026-10-21T10:00:00+02:00"},
  {"type": "creer_tache", "etape": "R1", "iteration": 1, "code": "creer_affaires", "titre": "Créer la ou les affaires", "role": "concepteur", "echeance": "2026-10-21", "optionnelle": false, "origine": "process"},
  {"type": "creer_tache", "etape": "R1", "iteration": 1, "code": "valider_plans", "titre": "Valider les plans", "role": "gerant_bpa", "echeance": "2026-10-23", "optionnelle": true, "origine": "process"},
  {"type": "creer_tache", "etape": "R1", "iteration": 1, "code": "facture", "titre": "Facture", "role": "gerant_finance", "echeance": null, "optionnelle": false, "origine": "process"},
  {"type": "etape_courante", "etape": "R1"}
]', '{R0.1}') $$, 'C1 valide le R0 de son affaire');

select results_eq($$ select statut, issue_code, valide_par, fin_at from public.etape_instance where id = '30000000-0000-0000-0000-000000000101' $$,
  $$ values ('faite'::text, 'r1_pris'::text, '30000000-0000-0000-0000-000000000001'::uuid, '2026-10-21 10:00+02'::timestamptz) $$,
  'le R0 est fait, avec son issue, son auteur et sa date');
select is((select statut from public.tache where titre = 'Noter le RDV'), 'annulee', 'les tâches restantes du R0 sont annulées (RG-05)');
select results_eq($$ select etape_code, phase_code, statut, debut_at from public.etape_instance
                     where affaire_id = '30000000-0000-0000-0000-0000000000e1' and statut = 'en_cours' $$,
  $$ values ('R1'::text, 'accueil'::text, 'en_cours'::text, '2026-10-21 10:00+02'::timestamptz) $$, 'le R1 est ouvert');
select results_eq($$ select modele_code, assignee_id, etape_instance_id is not null from public.tache
                     where affaire_id = '30000000-0000-0000-0000-0000000000e1' and origine = 'process' and statut = 'a_faire' order by modele_code $$,
  $$ values ('creer_affaires'::text, '30000000-0000-0000-0000-000000000001'::uuid, true),
            ('facture', '30000000-0000-0000-0000-000000000001'::uuid, true),
            ('valider_plans', '30000000-0000-0000-0000-000000000004'::uuid, true) $$,
  'les tâches vont au concepteur, au référent désigné, ou au concepteur si le référent manque');
select is((select etape_courante_code from public.affaire where id = '30000000-0000-0000-0000-0000000000e1'), 'R1', 'l''étape courante est recalculée');

select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e1', '[{"type": "etape_courante", "etape": "R2"}]', '{R0.1}') $$,
  '40001', null, 'une validation sur un état périmé est refusée (validation simultanée)');
select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e1', '[{"type": "inconnu"}]', '{R1.1}') $$,
  '22023', null, 'un effet inconnu est refusé');

select lives_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e1', '[
  {"type": "creer_rdv", "rdv": "R3", "rang": 2, "date": "2026-11-04"},
  {"type": "statut_affaire", "statut": "perdue", "motif": "prix"}
]', '{R1.1}') $$, 'C1 crée un RDV et passe l''affaire en perdue');
select results_eq($$ select type, rang, debut, profil_id, client_id from public.rdv where affaire_id = '30000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('R3'::text, 2, '2026-11-04 10:00+01'::timestamptz, '30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-0000000000d1'::uuid) $$,
  'le RDV R3.2 est posé à 10 h, heure de Paris, chez le concepteur (RG-07)');
select results_eq($$ select statut, motif_perte from public.affaire where id = '30000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('perdue'::text, 'prix'::text) $$, 'le statut et le motif sont enregistrés (RG-06)');

-- RG-01 : commande AGEM sans acompte 1.
select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e2', '[
  {"type": "fermer_etape", "etape": "COMMANDE_AGEM", "iteration": 1, "issue": "envoyee", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "30000000-0000-0000-0000-000000000001"}
]', '{COMMANDE_AGEM.1}') $$, 'P0001', 'La commande AGEM attend l''acompte 1 (RG-01).', 'la commande AGEM est refusée sans acompte 1 (RG-01)');
select throws_ok($$ update public.etape_instance set statut = 'faite' where id = '30000000-0000-0000-0000-000000000102' $$,
  'P0001', null, 'RG-01 tient aussi pour une écriture directe');
update public.echeance set recu_le = '2026-10-20', montant_recu_cts = 480000 where id = '30000000-0000-0000-0000-0000000000f2';
select lives_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e2', '[
  {"type": "fermer_etape", "etape": "COMMANDE_AGEM", "iteration": 1, "issue": "envoyee", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "30000000-0000-0000-0000-000000000001"}
]', '{COMMANDE_AGEM.1}') $$, 'la commande AGEM passe une fois l''acompte 1 reçu');

-- ── Conceptrice d'un autre magasin (C2) ──
set local request.jwt.claims = '{"sub": "30000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e3', '[{"type": "etape_courante", "etape": "R4"}]', '{R4.1,SOLDE.1}') $$,
  '42501', null, 'C2 ne valide pas une affaire d''un autre magasin');

-- ── Responsable R4 (Elsie) ──
set local request.jwt.claims = '{"sub": "30000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select lives_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e3', '[
  {"type": "fermer_etape", "etape": "R4", "iteration": 1, "issue": "fait", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "30000000-0000-0000-0000-000000000003"},
  {"type": "annuler_taches", "etape": "R4", "iteration": 1},
  {"type": "ouvrir_etape", "etape": "RELANCE_AVIS", "iteration": 1, "branche": "principale", "phase": "cloture", "quand": "2026-10-21T10:00:00+02:00"},
  {"type": "creer_tache", "etape": "RELANCE_AVIS", "iteration": 1, "code": "relancer_telephone", "titre": "Relancer par téléphone", "role": "concepteur", "echeance": "2026-10-28", "optionnelle": false, "origine": "process"},
  {"type": "etape_courante", "etape": "RELANCE_AVIS"}
]', '{SOLDE.1,R4.1}') $$, 'Elsie valide le R4 et ouvre la relance d''avis');
select is((select assignee_id from public.tache where modele_code = 'relancer_telephone' and affaire_id = '30000000-0000-0000-0000-0000000000e3'),
  '30000000-0000-0000-0000-000000000001'::uuid, 'la relance téléphone va au concepteur');
select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e3', '[
  {"type": "fermer_etape", "etape": "SOLDE", "iteration": 1, "issue": "recu", "motif": null, "quand": "2026-10-21T10:00:00+02:00", "par": "30000000-0000-0000-0000-000000000003"}
]', '{SOLDE.1,RELANCE_AVIS.1}') $$, '42501', null, 'Elsie ne valide que le R4');

-- ── Anonyme ──
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select public.appliquer_effets('30000000-0000-0000-0000-0000000000e3', '[]', '{}') $$,
  '42501', null, 'anonyme : pas d''accès à la fonction');

select * from finish();
rollback;
