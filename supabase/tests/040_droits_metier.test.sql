-- Droits du schéma métier (section 12) et triggers (RG-09, ENF-09, gardes BPA / planning / réassignation).
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ── Jeu de données (en tant que propriétaire : la RLS ne s'applique pas) ────────────────────────
insert into public.societe (id, nom, code) values ('10000000-0000-0000-0000-0000000000a1', 'Société test', 'TEST');
insert into public.magasin (id, nom, code, societe_id) values
  ('10000000-0000-0000-0000-0000000000b1', 'Val', 'TVAL', '10000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000b2', 'Cio', 'TCIO', '10000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'g@exemple.test'),
  ('10000000-0000-0000-0000-000000000002', 'c1@exemple.test'),
  ('10000000-0000-0000-0000-000000000003', 'c2@exemple.test'),
  ('10000000-0000-0000-0000-000000000004', 'e@exemple.test'),
  ('10000000-0000-0000-0000-000000000005', 'a@exemple.test');
insert into public.profil (id, prenom, email, role, est_admin, rubriques, initiales) values
  ('10000000-0000-0000-0000-000000000001', 'Gérant', 'g@exemple.test', 'gerant', true, '{}', 'G'),
  ('10000000-0000-0000-0000-000000000002', 'C1', 'c1@exemple.test', 'conceptrice', false, '{}', 'C1'),
  ('10000000-0000-0000-0000-000000000003', 'C2', 'c2@exemple.test', 'conceptrice', false, '{}', 'C2'),
  ('10000000-0000-0000-0000-000000000004', 'Elsie', 'e@exemple.test', 'transverse', false, '{r4_avis}', 'E'),
  ('10000000-0000-0000-0000-000000000005', 'Adrian', 'a@exemple.test', 'transverse', false, '{dossiers_pose}', 'A');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000b2');
insert into public.process_version (id, nom, definition, active) values
  ('10000000-0000-0000-0000-0000000000c1', 'test', '{}', false);
-- K1 : client de Val ; K2 : client de Cio.
insert into public.client (id, nom, magasin_id) values
  ('10000000-0000-0000-0000-0000000000d1', 'MARTIN', '10000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-0000000000d2', 'PETIT', '10000000-0000-0000-0000-0000000000b2');
-- A1 : Val, phase vente. A2 : Cio, phase clôture. A3 : Cio pour le client de Val, phase commande.
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id) values
  ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002', 'cuisine', 'MARTIN · Cuisine', 'MARTIN', '10000000-0000-0000-0000-0000000000c1'),
  ('10000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000003', 'dressing', 'PETIT · Dressing', 'PETIT', '10000000-0000-0000-0000-0000000000c1'),
  ('10000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000003', 'placard', 'MARTIN · Placard', 'MARTIN', '10000000-0000-0000-0000-0000000000c1');
insert into public.etape_instance (id, affaire_id, etape_code, phase_code, statut) values
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000e1', 'R3', 'vente', 'en_cours'),
  ('10000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000e2', 'R4', 'cloture', 'en_cours'),
  ('10000000-0000-0000-0000-0000000000f4', '10000000-0000-0000-0000-0000000000e2', 'SOLDE', 'cloture', 'en_cours'),
  ('10000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-0000000000e3', 'BPA', 'commande', 'en_cours');
insert into public.commande_fournisseur (id, affaire_id, fournisseur, confirmation_recue_le) values
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000e3', 'AGEM', '2026-10-15');
insert into public.vente (id, client_id, magasin_id, date_signature, montant_ht_cts, montant_ttc_cts) values
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000b1', '2026-10-01', 1000000, 1200000);
insert into public.mail_sortant (destinataire_id, destinataire_email, type, objet, html) values
  ('10000000-0000-0000-0000-000000000002', 'c1@exemple.test', 'digest_quotidien', 'Votre journée', '<p>…</p>');

-- ── Journal (ENF-09) ──
select ok((select count(*) from public.journal where table_nom = 'affaire' and affaire_id = '10000000-0000-0000-0000-0000000000e1' and action = 'insert') = 1,
  'la création d''une affaire est journalisée avec son affaire_id');

-- ── Horloge, dernière activité (RG-09) ──
update public.parametre set valeur = '{"decalage_secondes": 172800}' where cle = 'horloge_demo';
select lives_ok($$ insert into public.tache (affaire_id, titre, assignee_id) values
  ('10000000-0000-0000-0000-0000000000e1', 'Relancer le client', '10000000-0000-0000-0000-000000000002') $$, 'création d''une tâche liée');
select ok(abs(extract(epoch from ((select derniere_activite_at from public.affaire where id = '10000000-0000-0000-0000-0000000000e1') - (now() + interval '2 days')))) < 2,
  'une tâche met à jour derniere_activite_at de l''affaire, à l''heure de l''horloge de démo');
select is((select count(*)::int from public.journal where table_nom = 'affaire' and ligne_id = '10000000-0000-0000-0000-0000000000e1'), 1,
  'la seule mise à jour de derniere_activite_at n''est pas journalisée');
select ok(abs(extract(epoch from ((select created_at from public.tache where titre = 'Relancer le client') - (now() + interval '2 days')))) < 2,
  'created_at suit l''horloge de démo');
update public.parametre set valeur = null where cle = 'horloge_demo';

-- ── Conceptrice de Val (C1) ──
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select results_eq($$ select id from public.affaire order by id $$, $$ values ('10000000-0000-0000-0000-0000000000e1'::uuid) $$, 'C1 ne voit que les affaires de son magasin');
select results_eq($$ select id from public.client order by id $$, $$ values ('10000000-0000-0000-0000-0000000000d1'::uuid) $$, 'C1 ne voit que les clients de son magasin');
select isnt_empty($$ update public.affaire set montant_devis_ht_cts = 900000 where id = '10000000-0000-0000-0000-0000000000e1' returning id $$, 'C1 modifie une affaire de son magasin');
select is_empty($$ update public.affaire set montant_devis_ht_cts = 1 where id = '10000000-0000-0000-0000-0000000000e2' returning id $$, 'C1 ne modifie pas une affaire d''un autre magasin');
select throws_ok($$ insert into public.affaire (client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id)
  values ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000002', 'bureau', 'X', 'X', '10000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'C1 ne crée pas d''affaire dans un autre magasin');
select throws_ok($$ update public.affaire set concepteur_id = '10000000-0000-0000-0000-000000000003' where id = '10000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'C1 ne réassigne pas une affaire (EF-41)');
select isnt_empty($$ select id from public.vente $$, 'C1 voit la vente de son magasin');
select lives_ok($$ insert into public.planning (vente_id, semaine_livraison_souhaitee, demande_par) values
  ('10000000-0000-0000-0000-000000000201', '2026-S46', '10000000-0000-0000-0000-000000000002') $$, 'C1 demande un planning (EF-60)');
select throws_ok($$ update public.planning set statut = 'confirmee', semaine_livraison_confirmee = '2026-S46' where vente_id = '10000000-0000-0000-0000-000000000201' $$,
  '42501', null, 'C1 ne confirme pas un planning (EF-61)');
select is((select count(*)::int from public.mail_sortant), 1, 'C1 lit les mails qui lui sont destinés');
select isnt_empty($$ select id from public.journal where affaire_id = '10000000-0000-0000-0000-0000000000e1' $$, 'C1 lit l''historique de son affaire (EF-40)');
select is_empty($$ select id from public.journal where table_nom = 'profil' $$, 'C1 ne lit pas le journal du référentiel');
select throws_ok($$ insert into public.journal (table_nom, action) values ('affaire', 'update') $$, '42501', null, 'personne n''écrit directement dans le journal');

-- ── Conceptrice de Cio (C2) ──
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select results_eq($$ select id from public.client order by id $$,
  $$ values ('10000000-0000-0000-0000-0000000000d1'::uuid), ('10000000-0000-0000-0000-0000000000d2'::uuid) $$,
  'C2 voit le client de Val dont elle porte une affaire à Cio');
select is_empty($$ select id from public.vente $$, 'C2 ne voit pas la vente de Val');
select is_empty($$ select id from public.journal where affaire_id = '10000000-0000-0000-0000-0000000000e1' $$, 'C2 ne lit pas l''historique d''une affaire de Val');
select is_empty($$ select id from public.tache where titre = 'Relancer le client' $$, 'C2 ne voit pas les tâches d''une affaire de Val');
select is((select count(*)::int from public.mail_sortant), 0, 'C2 ne lit pas les mails des autres');
select throws_ok($$ update public.commande_fournisseur set bpa_donne_le = '2026-10-16', statut = 'bpa_donne' where id = '10000000-0000-0000-0000-000000000101' $$,
  '42501', null, 'C2 ne donne pas le BPA');
select isnt_empty($$ update public.commande_fournisseur set arc_recu_le = '2026-10-10' where id = '10000000-0000-0000-0000-000000000101' returning id $$,
  'C2 saisit l''ARC de son affaire');

-- ── Elsie (r4_avis) ──
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select results_eq($$ select id from public.affaire order by id $$, $$ values ('10000000-0000-0000-0000-0000000000e2'::uuid) $$,
  'Elsie ne voit que les affaires en phase clôture');
select is_empty($$ update public.affaire set avis_google_obtenu_le = '2026-10-20' where id = '10000000-0000-0000-0000-0000000000e2' returning id $$,
  'Elsie ne modifie pas l''affaire');
select isnt_empty($$ update public.etape_instance set statut = 'faite', issue_code = 'fait' where id = '10000000-0000-0000-0000-0000000000f2' returning id $$,
  'Elsie valide l''étape R4');
select is_empty($$ update public.etape_instance set statut = 'faite' where id = '10000000-0000-0000-0000-0000000000f4' returning id $$,
  'Elsie ne valide pas une autre étape (SOLDE)');
select lives_ok($$ insert into public.rdv (affaire_id, client_id, type, debut, profil_id) values
  ('10000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000d2', 'R4', now(), '10000000-0000-0000-0000-000000000004') $$,
  'Elsie planifie le R4');

-- ── Adrian (dossiers_pose) ──
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000005", "role": "authenticated"}';
select results_eq($$ select id from public.affaire order by id $$, $$ values ('10000000-0000-0000-0000-0000000000e3'::uuid) $$,
  'Adrian ne voit que les affaires en phase commande ou livraison et pose');
select is_empty($$ update public.commande_fournisseur set arc_recu_le = '2026-10-11' where id = '10000000-0000-0000-0000-000000000101' returning id $$,
  'Adrian consulte sans modifier');

-- ── Gérant ──
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.affaire where id::text like '10000000-%'), 3, 'le gérant voit toutes les affaires, quel que soit le magasin');
select lives_ok($$ update public.commande_fournisseur set bpa_donne_le = '2026-10-16', statut = 'bpa_donne' where id = '10000000-0000-0000-0000-000000000101' $$,
  'le gérant donne le BPA');
select lives_ok($$ update public.planning set statut = 'confirmee', semaine_livraison_confirmee = '2026-S46', confirme_par = '10000000-0000-0000-0000-000000000001'
  where vente_id = '10000000-0000-0000-0000-000000000201' $$, 'le gérant confirme le planning');
select lives_ok($$ update public.affaire set concepteur_id = '10000000-0000-0000-0000-000000000003' where id = '10000000-0000-0000-0000-0000000000e1' $$,
  'le gérant réassigne une affaire');
select lives_ok($$ insert into public.tache (titre, assignee_id) values ('Préparer le salon', '10000000-0000-0000-0000-000000000004') $$,
  'le gérant crée une tâche libre pour Elsie (EF-13)');

set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select isnt_empty($$ update public.tache set statut = 'faite', fait_le = now() where titre = 'Préparer le salon' returning id $$,
  'Elsie coche sa tâche libre');

-- ── Anonyme ──
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select id from public.affaire $$, '42501', null, 'anonyme : aucun accès aux affaires');

select * from finish();
rollback;
