-- Import de reprise et administration légère (session 5.2) : droits, tout ou rien, doublons, désactivation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.societe (id, nom, code) values ('c0000000-0000-0000-0000-0000000000a1', 'Société import', 'IMPO');
insert into public.magasin (id, nom, code, societe_id) values ('c0000000-0000-0000-0000-0000000000b1', 'I1', 'IMPA', 'c0000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'i-c1@exemple.test'), ('c0000000-0000-0000-0000-000000000002', 'i-g@exemple.test'),
  ('c0000000-0000-0000-0000-000000000003', 'i-c2@exemple.test'), ('c0000000-0000-0000-0000-000000000004', 'i-g2@exemple.test');
insert into public.profil (id, prenom, email, role, initiales, est_admin) values
  ('c0000000-0000-0000-0000-000000000001', 'C1', 'i-c1@exemple.test', 'conceptrice', 'C1', false),
  ('c0000000-0000-0000-0000-000000000002', 'G', 'i-g@exemple.test', 'gerant', 'G', true),
  ('c0000000-0000-0000-0000-000000000003', 'C2', 'i-c2@exemple.test', 'conceptrice', 'C2', false),
  ('c0000000-0000-0000-0000-000000000004', 'G2', 'i-g2@exemple.test', 'gerant', 'G2', false);
insert into public.profil_magasin (profil_id, magasin_id) values
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000b1'), ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000b1');
insert into public.process_version (id, nom, definition) values ('c0000000-0000-0000-0000-0000000000c1', 'import', '{}');

create temp table plan_import as select jsonb_build_object(
  'client', jsonb_build_object('id', 'c0000000-0000-0000-0000-0000000000d1', 'nom', 'REPRIS', 'prenom', 'Jean', 'magasin_id', 'c0000000-0000-0000-0000-0000000000b1'),
  'vente', null,
  'affaire', jsonb_build_object('id', 'c0000000-0000-0000-0000-0000000000e1', 'client_id', 'c0000000-0000-0000-0000-0000000000d1',
    'magasin_id', 'c0000000-0000-0000-0000-0000000000b1', 'concepteur_id', 'c0000000-0000-0000-0000-000000000001', 'projet', 'cuisine',
    'libelle', 'REPRIS Jean · Cuisine', 'contremarque', 'REPRIS Jean', 'process_version_id', 'c0000000-0000-0000-0000-0000000000c1',
    'etape_courante_code', 'R2', 'created_at', '2026-10-01 10:00+02', 'derniere_activite_at', '2026-10-10 17:00+02'),
  'echeances', '[]'::jsonb, 'planning', null,
  'rdv', jsonb_build_array(jsonb_build_object('affaire_id', 'c0000000-0000-0000-0000-0000000000e1', 'client_id', 'c0000000-0000-0000-0000-0000000000d1',
    'type', 'R1', 'debut', '2026-10-01 10:00+02', 'profil_id', 'c0000000-0000-0000-0000-000000000001', 'statut', 'fait', 'created_at', '2026-10-01 09:00+02')),
  'etapes', jsonb_build_array(
    jsonb_build_object('affaire_id', 'c0000000-0000-0000-0000-0000000000e1', 'etape_code', 'R0', 'phase_code', 'accueil', 'statut', 'faite', 'created_at', '2026-10-01 09:00+02'),
    jsonb_build_object('id', 'c0000000-0000-0000-0000-0000000000f1', 'affaire_id', 'c0000000-0000-0000-0000-0000000000e1', 'etape_code', 'R2', 'phase_code', 'conception', 'statut', 'en_cours', 'created_at', '2026-10-10 17:00+02')),
  'taches', jsonb_build_array(jsonb_build_object('affaire_id', 'c0000000-0000-0000-0000-0000000000e1', 'etape_instance_id', 'c0000000-0000-0000-0000-0000000000f1',
    'modele_code', 'preparer_releve', 'titre', 'Préparer le relevé', 'assignee_id', 'c0000000-0000-0000-0000-000000000001', 'origine', 'process', 'created_at', '2026-10-10 17:00+02'))
) as p;
grant select on plan_import to authenticated;

set local role authenticated;
-- ── Conceptrice : refusé ──
set local request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.importer_affaire((select p from plan_import)) $$, '42501', null, 'une conceptrice n''importe pas');
select throws_ok($$ select prive.inserer_ligne('client', '{}') $$, '42501', null, 'l''insertion générique n''est pas appelable directement');
select throws_ok($$ select public.desactiver_profil('c0000000-0000-0000-0000-000000000003', null) $$, '42501', null, 'une conceptrice ne désactive personne');

-- ── Gérant administrateur ──
set local request.jwt.claims = '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(public.importer_affaire((select p from plan_import)), 'c0000000-0000-0000-0000-0000000000e1'::uuid, 'le gérant importe une affaire');
select results_eq($$ select (select count(*) from public.etape_instance where affaire_id = a.id)::int, (select count(*) from public.tache where affaire_id = a.id)::int,
                            (select count(*) from public.rdv where affaire_id = a.id)::int, a.etape_courante_code, a.created_at
                       from public.affaire a where a.id = 'c0000000-0000-0000-0000-0000000000e1' $$,
  $$ values (2, 1, 1, 'R2'::text, '2026-10-01 10:00+02'::timestamptz) $$, 'client, affaire, RDV, étapes et tâche écrits, colonnes absentes à leur valeur par défaut');
select throws_ok($$ select public.importer_affaire(jsonb_set((select p from plan_import), '{client,id}', '"c0000000-0000-0000-0000-0000000000d2"')) $$,
  '23505', null, 'une affaire déjà présente (contremarque, projet, magasin) est refusée');
select is((select count(*)::int from public.client where nom = 'REPRIS'), 1, 'le refus n''a rien laissé derrière lui (tout ou rien)');

select throws_ok($$ select public.modifier_profil('c0000000-0000-0000-0000-000000000002', 'conceptrice', array['c0000000-0000-0000-0000-0000000000b1'::uuid], null) $$,
  '22023', null, 'un administrateur ne change pas son propre rôle');
select lives_ok($$ select public.modifier_profil('c0000000-0000-0000-0000-000000000003', 'transverse', array['c0000000-0000-0000-0000-0000000000b1'::uuid], array['dossiers_pose']) $$,
  'rôle, magasins et rubriques modifiés');
select results_eq($$ select role, rubriques from public.profil where id = 'c0000000-0000-0000-0000-000000000003' $$,
  $$ values ('transverse'::text, array['dossiers_pose']) $$, 'le profil est à jour');

select throws_ok($$ select public.desactiver_profil('c0000000-0000-0000-0000-000000000001', null) $$, '22023', null,
  'désactiver exige un repreneur pour les affaires et tâches ouvertes');
select is(public.desactiver_profil('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004'), '{"affaires": 1, "taches": 1}'::jsonb,
  'affaires en cours et tâches ouvertes réassignées');
select results_eq($$ select (select concepteur_id from public.affaire where id = 'c0000000-0000-0000-0000-0000000000e1'),
                            (select assignee_id from public.tache where affaire_id = 'c0000000-0000-0000-0000-0000000000e1'),
                            (select actif from public.profil where id = 'c0000000-0000-0000-0000-000000000001') $$,
  $$ values ('c0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, false) $$, 'le repreneur a tout, le profil est inactif');

select * from finish();
rollback;
