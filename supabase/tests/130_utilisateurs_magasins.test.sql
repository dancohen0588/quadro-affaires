-- Ajout d'un utilisateur (EF-100) et magasins et sociétés (EF-101) : droits, compte rattaché, colonnes modifiables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.societe (id, nom, code) values ('d0000000-0000-0000-0000-0000000000a1', 'Société util', 'UTIL');
insert into public.magasin (id, nom, code, societe_id) values
  ('d0000000-0000-0000-0000-0000000000b1', 'U1', 'UTLA', 'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-0000000000b2', 'U2', 'UTLB', 'd0000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'u-c@exemple.test'), ('d0000000-0000-0000-0000-000000000002', 'u-g@exemple.test'),
  ('d0000000-0000-0000-0000-000000000003', 'u-g2@exemple.test'),
  -- comptes préparés par l'AuthAdapter pour les nouveaux venus
  ('d0000000-0000-0000-0000-000000000011', 'nouvelle@exemple.test'), ('d0000000-0000-0000-0000-000000000012', 'gerant3@exemple.test'),
  ('d0000000-0000-0000-0000-000000000013', 'transverse@exemple.test');
insert into public.profil (id, prenom, email, role, initiales, est_admin) values
  ('d0000000-0000-0000-0000-000000000001', 'C', 'u-c@exemple.test', 'conceptrice', 'C', false),
  ('d0000000-0000-0000-0000-000000000002', 'G', 'u-g@exemple.test', 'gerant', 'G', true),
  ('d0000000-0000-0000-0000-000000000003', 'G2', 'u-g2@exemple.test', 'gerant', 'G2', false);
insert into public.profil_magasin (profil_id, magasin_id) values ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-0000000000b1');

set local role authenticated;
-- ── Conceptrice et gérant non administrateur : refusés ──
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'Nina', '', 'nouvelle@exemple.test', 'NI', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, '42501', null, 'une conceptrice n''ajoute personne');
select results_eq($$ with u as (update public.magasin set adresse = 'Pirate' where id = 'd0000000-0000-0000-0000-0000000000b1' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'une conceptrice ne modifie pas un magasin');
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'Nina', '', 'nouvelle@exemple.test', 'NI', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, '42501', null, 'un gérant non administrateur n''ajoute personne');

-- ── Gérant administrateur ──
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000099', 'Nina', '', 'nouvelle@exemple.test', 'NI', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, 'P0002', null, 'pas de profil sans compte de connexion');
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'Nina', '', 'autre@exemple.test', 'NI', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, 'P0002', null, 'le profil porte l''adresse de son compte, jamais celle d''un autre');
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'Nina', '', 'nouvelle@exemple.test', 'NI', 'conceptrice',
  '{}', null) $$, '22023', null, 'au moins un magasin');
select is(public.creer_profil('d0000000-0000-0000-0000-000000000011', ' Nina ', 'Roux', 'Nouvelle@Exemple.test', 'NR', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid, 'd0000000-0000-0000-0000-0000000000b2'::uuid, 'd0000000-0000-0000-0000-0000000000b1'::uuid], array['r4_avis']),
  'd0000000-0000-0000-0000-000000000011'::uuid, 'l''administrateur ajoute une conceptrice');
select results_eq($$ select prenom, email, role, est_admin, rubriques, actif, (select count(*)::int from public.profil_magasin where profil_id = p.id)
                       from public.profil p where id = 'd0000000-0000-0000-0000-000000000011' $$,
  $$ values ('Nina'::text, 'nouvelle@exemple.test'::text, 'conceptrice'::text, false, '{}'::text[], true, 2) $$,
  'profil actif, adresse en minuscules, deux magasins, pas de rubrique hors transverse');
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'Nina', '', 'nouvelle@exemple.test', 'NI', 'conceptrice',
  array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, '23505', null, 'une adresse déjà utilisée est refusée');
select lives_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000012', 'Hugo', '', 'gerant3@exemple.test', 'HU', 'gerant', array['d0000000-0000-0000-0000-0000000000b1'::uuid], null) $$, 'ajout d''un gérant');
select lives_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000013', 'Tom', '', 'transverse@exemple.test', 'TO', 'transverse', array['d0000000-0000-0000-0000-0000000000b2'::uuid], array['dossiers_pose']) $$, 'ajout d''une transverse');
select results_eq($$ select role, est_admin, rubriques from public.profil where id in ('d0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000013') order by prenom $$,
  $$ values ('gerant'::text, true, '{}'::text[]), ('transverse'::text, false, '{dossiers_pose}'::text[]) $$, 'un gérant ajouté administre ; une transverse garde ses rubriques');

-- Magasins et sociétés (EF-101)
select lives_ok($$ update public.magasin set adresse = '1 avenue des Essais', telephone = '04 00 00 00 00', nom = 'U1 bis'
                    where id = 'd0000000-0000-0000-0000-0000000000b1' $$, 'l''administrateur modifie nom, adresse et téléphone d''un magasin');
select is((select adresse from public.magasin where id = 'd0000000-0000-0000-0000-0000000000b1'), '1 avenue des Essais', 'modification enregistrée');
select throws_ok($$ update public.magasin set code = 'PIRA' where id = 'd0000000-0000-0000-0000-0000000000b1' $$, '42501', null, 'le code d''un magasin ne change pas');
select throws_ok($$ update public.magasin set pcloud_root_id = 'x' where id = 'd0000000-0000-0000-0000-0000000000b1' $$, '42501', null, 'le dossier racine PCloud attend B3');
select throws_ok($$ update public.magasin set nom = '  ' where id = 'd0000000-0000-0000-0000-0000000000b1' $$, '23514', null, 'un magasin garde un nom');
select lives_ok($$ update public.societe set siren = '999123458', nom = 'Société util bis' where id = 'd0000000-0000-0000-0000-0000000000a1' $$, 'l''administrateur modifie nom et SIREN d''une société');
select throws_ok($$ update public.societe set code = 'XX' where id = 'd0000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'le code d''une société ne change pas');

-- ── Anonyme ──
set local role anon;
select throws_ok($$ select public.creer_profil('d0000000-0000-0000-0000-000000000011', 'X', '', 'x@exemple.test', 'X', 'conceptrice', '{}', null) $$,
  '42501', null, 'anonyme : aucun accès');

select * from finish();
rollback;
