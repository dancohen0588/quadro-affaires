-- Quotidien (session 3.1) : recherche des clients existants, doublons, création d'affaires, clôture.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into public.societe (id, nom, code) values ('40000000-0000-0000-0000-0000000000a1', 'Société quotidien', 'QUOT');
insert into public.magasin (id, nom, code, societe_id) values
  ('40000000-0000-0000-0000-0000000000b1', 'Q1', 'QUOA', '40000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-0000000000b2', 'Q2', 'QUOB', '40000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'q-c1@exemple.test'),
  ('40000000-0000-0000-0000-000000000002', 'q-e@exemple.test');
insert into public.profil (id, prenom, email, role, rubriques, initiales) values
  ('40000000-0000-0000-0000-000000000001', 'C1', 'q-c1@exemple.test', 'conceptrice', '{}', 'C1'),
  ('40000000-0000-0000-0000-000000000002', 'E', 'q-e@exemple.test', 'transverse', '{r4_avis}', 'E');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-0000000000b1'),
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-0000000000b1');
insert into public.process_version (id, nom, definition) values ('40000000-0000-0000-0000-0000000000c1', 'quotidien', '{}');
-- Un client de l'autre magasin, déjà venu une fois.
insert into public.client (id, nom, prenom, telephone, ville, magasin_id) values
  ('40000000-0000-0000-0000-0000000000d2', 'ZEPHYRIN', 'Aline', '06 39 98 77 01', 'Cassis', '40000000-0000-0000-0000-0000000000b2');

-- ── Doublons (EF-21) ──
select throws_ok($$ insert into public.client (nom, telephone, magasin_id) values (' zephyrin ', '0639987701', '40000000-0000-0000-0000-0000000000b1') $$,
  '23505', null, 'même nom et même numéro, écrit autrement : doublon refusé');
select lives_ok($$ insert into public.client (nom, telephone, magasin_id) values ('ZEPHYRIN', '06 39 98 77 02', '40000000-0000-0000-0000-0000000000b1') $$,
  'même nom, autre numéro : accepté');
select lives_ok($$ insert into public.client (nom, cnq, magasin_id) values ('ZEPHYRIN', true, '40000000-0000-0000-0000-0000000000b1') $$,
  'un contact CNQ sans numéro n''est jamais un doublon');

-- ── Conceptrice du magasin Q1 ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "40000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq($$ select magasin, visible, count(*)::int from public.rechercher_clients('zéphyrin') group by 1, 2 order by 1 $$,
  $$ values ('Q1'::text, true, 2), ('Q2', false, 1) $$,
  'les clients des deux magasins sont proposés, sans tenir compte des accents, avec leur visibilité');
select isnt_empty($$ insert into public.client (nom, cnq, magasin_id) values ('NOUVEAU', true, '40000000-0000-0000-0000-0000000000b1') returning id $$,
  'C1 crée un contact dans son magasin et le relit aussitôt (EF-20)');
select results_eq($$ select ville from public.rechercher_clients('98 77 01') $$, $$ values ('Cassis'::text) $$,
  'la recherche par téléphone ignore les espaces');
select is_empty($$ select * from public.rechercher_clients('z') $$, 'une seule lettre ne déclenche pas de recherche');
select results_eq($$ select nom, prenom from public.identite_client('40000000-0000-0000-0000-0000000000d2') $$,
  $$ values ('ZEPHYRIN'::text, 'Aline'::text) $$, 'identité d''un client d''un autre magasin, pour le libellé de son affaire');

select lives_ok($$ select public.creer_affaires('40000000-0000-0000-0000-0000000000d2', '[
  {"magasin_id": "40000000-0000-0000-0000-0000000000b1", "concepteur_id": "40000000-0000-0000-0000-000000000001",
   "projet": "cuisine", "libelle": "ZEPHYRIN Aline · Cuisine", "contremarque": "ZEPHYRIN Aline",
   "process_version_id": "40000000-0000-0000-0000-0000000000c1",
   "effets": [{"type": "ouvrir_etape", "etape": "R1", "iteration": 1, "branche": "principale", "phase": "accueil", "quand": "2026-10-21T10:00:00+02:00"},
              {"type": "creer_tache", "etape": "R1", "iteration": 1, "code": "creer_affaires", "titre": "Créer la ou les affaires", "role": "concepteur", "echeance": "2026-10-21", "optionnelle": false, "origine": "process"},
              {"type": "etape_courante", "etape": "R1"}]},
  {"magasin_id": "40000000-0000-0000-0000-0000000000b1", "concepteur_id": "40000000-0000-0000-0000-000000000001",
   "projet": "dressing", "libelle": "ZEPHYRIN Aline · Dressing", "contremarque": "ZEPHYRIN Aline",
   "process_version_id": "40000000-0000-0000-0000-0000000000c1",
   "effets": [{"type": "ouvrir_etape", "etape": "R1", "iteration": 1, "branche": "principale", "phase": "accueil", "quand": "2026-10-21T10:00:00+02:00"},
              {"type": "etape_courante", "etape": "R1"}]}
]') $$, 'C1 crée deux affaires pour un client qui revient d''un autre magasin');
select results_eq($$ select a.projet, a.etape_courante_code, (select count(*)::int from public.etape_instance e where e.affaire_id = a.id and e.statut = 'en_cours')
                     from public.affaire a where a.client_id = '40000000-0000-0000-0000-0000000000d2' order by a.projet $$,
  $$ values ('cuisine'::text, 'R1'::text, 1), ('dressing', 'R1', 1) $$, 'les deux affaires sont démarrées au R1');
select is((select count(*)::int from public.client where id = '40000000-0000-0000-0000-0000000000d2'), 1,
  'le client de l''autre magasin devient visible par son affaire');
select throws_ok($$ select public.creer_affaires('40000000-0000-0000-0000-0000000000d2', '[
  {"magasin_id": "40000000-0000-0000-0000-0000000000b2", "concepteur_id": "40000000-0000-0000-0000-000000000001",
   "projet": "bureau", "libelle": "x", "contremarque": "x", "process_version_id": "40000000-0000-0000-0000-0000000000c1", "effets": []}]') $$,
  '42501', null, 'pas d''affaire dans un magasin qui n''est pas le sien');
select throws_ok($$ select public.creer_affaires('40000000-0000-0000-0000-0000000000d2', '[
  {"magasin_id": "40000000-0000-0000-0000-0000000000b1", "concepteur_id": "40000000-0000-0000-0000-000000000002",
   "projet": "bureau", "libelle": "x", "contremarque": "x", "process_version_id": "40000000-0000-0000-0000-0000000000c1", "effets": []}]') $$,
  '22023', null, 'une transverse ne peut pas être conceptrice d''une affaire');

-- Clôture avant la vente (EF-25) : l'étape ouverte est sautée.
select lives_ok($$ select public.appliquer_effets((select id from public.affaire where projet = 'dressing' and client_id = '40000000-0000-0000-0000-0000000000d2'), '[
  {"type": "sauter_etape", "etape": "R1", "iteration": 1, "motif": "projet abandonné", "quand": "2026-10-21T11:00:00+02:00", "par": "40000000-0000-0000-0000-000000000001"},
  {"type": "statut_affaire", "statut": "abandonnee", "motif": "projet abandonné"}]', '{R1.1}') $$, 'C1 clôt une affaire au R1');
select results_eq($$ select e.statut, e.motif, a.statut from public.etape_instance e join public.affaire a on a.id = e.affaire_id
                     where a.projet = 'dressing' and a.client_id = '40000000-0000-0000-0000-0000000000d2' $$,
  $$ values ('sautee'::text, 'projet abandonné'::text, 'abandonnee'::text) $$, 'l''étape est sautée avec le motif, l''affaire abandonnée');

-- ── Transverse ──
set local request.jwt.claims = '{"sub": "40000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok($$ select * from public.rechercher_clients('zephyrin') $$, '42501', null, 'une transverse ne cherche pas dans les clients');
select throws_ok($$ select * from public.identite_client('40000000-0000-0000-0000-0000000000d2') $$, '42501', null, 'ni dans leur identité');

select * from finish();
rollback;
