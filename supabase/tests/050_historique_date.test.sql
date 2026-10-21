-- Reprise d'historique : la dernière activité et le journal suivent la date de l'écriture (session 1.4).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.societe (id, nom, code) values ('20000000-0000-0000-0000-0000000000a1', 'Société h', 'HIST');
insert into public.magasin (id, nom, code, societe_id) values ('20000000-0000-0000-0000-0000000000b1', 'Hist', 'THIS', '20000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values ('20000000-0000-0000-0000-000000000001', 'h@exemple.test');
insert into public.profil (id, prenom, email, role, initiales) values ('20000000-0000-0000-0000-000000000001', 'H', 'h@exemple.test', 'conceptrice', 'H');
insert into public.process_version (id, nom, definition) values ('20000000-0000-0000-0000-0000000000c1', 'hist', '{}');
insert into public.client (id, nom, magasin_id, created_at) values
  ('20000000-0000-0000-0000-0000000000d1', 'ANCIEN', '20000000-0000-0000-0000-0000000000b1', '2026-05-04 10:00+02');
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id, created_at) values
  ('20000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000b1',
   '20000000-0000-0000-0000-000000000001', 'cuisine', 'ANCIEN · Cuisine', 'ANCIEN', '20000000-0000-0000-0000-0000000000c1', '2026-05-04 10:00+02');

select is((select derniere_activite_at from public.affaire where id = '20000000-0000-0000-0000-0000000000e1'), '2026-05-04 10:00+02'::timestamptz,
  'une affaire historique garde sa date de création comme dernière activité');
select is((select at from public.journal where table_nom = 'affaire' and ligne_id = '20000000-0000-0000-0000-0000000000e1'), '2026-05-04 10:00+02'::timestamptz,
  'la trace d''insertion est datée du created_at de la ligne');

insert into public.rdv (affaire_id, client_id, type, debut, profil_id, statut, created_at) values
  ('20000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000d1', 'R2', '2026-05-12 14:00+02', '20000000-0000-0000-0000-000000000001', 'fait', '2026-05-12 15:00+02');
select is((select derniere_activite_at from public.affaire where id = '20000000-0000-0000-0000-0000000000e1'), '2026-05-12 15:00+02'::timestamptz,
  'une ligne liée historique avance la dernière activité à sa date');

insert into public.rdv (affaire_id, client_id, type, debut, profil_id, statut, created_at) values
  ('20000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000d1', 'R1', '2026-05-05 10:00+02', '20000000-0000-0000-0000-000000000001', 'fait', '2026-05-05 11:00+02');
select is((select derniere_activite_at from public.affaire where id = '20000000-0000-0000-0000-0000000000e1'), '2026-05-12 15:00+02'::timestamptz,
  'la dernière activité ne recule jamais');

update public.affaire set montant_devis_ht_cts = 1200000 where id = '20000000-0000-0000-0000-0000000000e1';
select ok(abs(extract(epoch from ((select derniere_activite_at from public.affaire where id = '20000000-0000-0000-0000-0000000000e1') - now()))) < 2,
  'une modification de l''affaire compte comme une activité à l''heure courante');
select ok(abs(extract(epoch from ((select max(at) from public.journal where table_nom = 'affaire' and action = 'update' and ligne_id = '20000000-0000-0000-0000-0000000000e1') - now()))) < 2,
  'une mise à jour est journalisée à l''heure courante');

select * from finish();
rollback;
