-- Droits sur le référentiel (section 12) : fonctions de contexte et politiques RLS par rôle.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Jeu de données : 3 magasins, un gérant, une conceptrice, une transverse, un profil inactif, un compte sans profil.
insert into public.societe (id, nom, code) values ('00000000-0000-0000-0000-0000000000a1', 'Société test', 'TEST');
insert into public.magasin (id, nom, code, societe_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Magasin A', 'MA', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', 'Magasin B', 'MB', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b3', 'Magasin C', 'MC', '00000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'gerant@exemple.test'),
  ('00000000-0000-0000-0000-000000000002', 'conceptrice@exemple.test'),
  ('00000000-0000-0000-0000-000000000003', 'transverse@exemple.test'),
  ('00000000-0000-0000-0000-000000000004', 'inactif@exemple.test'),
  ('00000000-0000-0000-0000-000000000005', 'sansprofil@exemple.test');
insert into public.profil (id, prenom, email, role, est_admin, rubriques, actif, initiales) values
  ('00000000-0000-0000-0000-000000000001', 'Gérant', 'gerant@exemple.test', 'gerant', true, '{}', true, 'GE'),
  ('00000000-0000-0000-0000-000000000002', 'Conceptrice', 'conceptrice@exemple.test', 'conceptrice', false, '{}', true, 'CO'),
  ('00000000-0000-0000-0000-000000000003', 'Transverse', 'transverse@exemple.test', 'transverse', false, '{r4_avis}', true, 'TR'),
  ('00000000-0000-0000-0000-000000000004', 'Inactive', 'inactif@exemple.test', 'conceptrice', false, '{}', false, 'IN');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1');

-- Contraintes du modèle
select throws_ok(
  $$ insert into public.profil (id, prenom, email, role, est_admin, initiales) values ('00000000-0000-0000-0000-000000000005', 'X', 'x@exemple.test', 'conceptrice', true, 'X') $$,
  '23514', null, 'seul un gérant peut être administrateur');
select throws_ok(
  $$ insert into public.profil (id, prenom, email, role, rubriques, initiales) values ('00000000-0000-0000-0000-000000000005', 'X', 'x@exemple.test', 'conceptrice', '{r4_avis}', 'X') $$,
  '23514', null, 'seul un transverse a des rubriques');

-- ── Gérant ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(prive.auth_role(), 'gerant', 'gérant : rôle');
select is(prive.auth_est_admin(), true, 'gérant : administrateur');
select is(cardinality(prive.auth_magasins()), (select count(*)::int from public.magasin), 'gérant : voit tous les magasins sans rattachement');
select isnt_empty($$ update public.parametre set valeur = '{"decalage_secondes": 0}' where cle = 'horloge_demo' returning cle $$, 'gérant : modifie un paramètre (horloge de démo)');
select lives_ok($$ insert into public.magasin (nom, code, societe_id) values ('Magasin D', 'MD', '00000000-0000-0000-0000-0000000000a1') $$, 'gérant : ajoute un magasin');

-- ── Conceptrice ──
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(prive.auth_role(), 'conceptrice', 'conceptrice : rôle');
select is(prive.auth_est_admin(), false, 'conceptrice : pas administratrice');
select is(prive.auth_magasins(), array['00000000-0000-0000-0000-0000000000b1']::uuid[], 'conceptrice : seulement son magasin');
select ok((select count(*) from public.profil) >= 4, 'conceptrice : voit ses collègues (assignation)');
select is_empty($$ update public.parametre set valeur = '{"decalage_secondes": 99}' where cle = 'horloge_demo' returning cle $$, 'conceptrice : ne modifie pas les paramètres');
select is_empty($$ update public.profil set role = 'gerant', est_admin = true where id = '00000000-0000-0000-0000-000000000002' returning id $$, 'conceptrice : ne peut pas s''élever en gérante');
select throws_ok($$ insert into public.magasin (nom, code, societe_id) values ('Pirate', 'PIR', '00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'conceptrice : n''ajoute pas de magasin');

-- ── Transverse ──
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select is(prive.auth_rubriques(), array['r4_avis']::text[], 'transverse : ses rubriques');

-- ── Profil inactif (EF-02) ──
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select is(prive.auth_role(), null, 'inactif : aucun rôle');
select is(prive.auth_magasins(), '{}'::uuid[], 'inactif : aucun magasin malgré son rattachement');
select is_empty($$ select id from public.magasin $$, 'inactif : ne lit rien');

-- ── Compte sans profil ──
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000005", "role": "authenticated"}';
select is_empty($$ select id from public.profil $$, 'compte sans profil : ne lit rien');

-- ── Anonyme ──
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select id from public.magasin $$, '42501', null, 'anonyme : aucun accès');

select * from finish();
rollback;
