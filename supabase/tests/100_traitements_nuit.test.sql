-- Traitements de nuit (session 4.2) : clés d'idempotence, tâche automatique sans effet sur l'activité (RG-09, RG-27).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.societe (id, nom, code) values ('a0000000-0000-0000-0000-0000000000a1', 'Société nuit', 'NUIT');
insert into public.magasin (id, nom, code, societe_id) values ('a0000000-0000-0000-0000-0000000000b1', 'N1', 'NUIA', 'a0000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001', 'n-c1@exemple.test'), ('a0000000-0000-0000-0000-000000000002', 'n-c2@exemple.test');
insert into public.profil (id, prenom, email, role, initiales) values
  ('a0000000-0000-0000-0000-000000000001', 'C1', 'n-c1@exemple.test', 'conceptrice', 'C1'),
  ('a0000000-0000-0000-0000-000000000002', 'C2', 'n-c2@exemple.test', 'conceptrice', 'C2');
insert into public.profil_magasin (profil_id, magasin_id) values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.process_version (id, nom, definition) values ('a0000000-0000-0000-0000-0000000000c1', 'nuit', '{}');
insert into public.client (id, nom, magasin_id) values ('a0000000-0000-0000-0000-0000000000d1', 'NUIT', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id, created_at, derniere_activite_at) values
  ('a0000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-000000000001',
   'cuisine', 'NUIT · Cuisine', 'NUIT', 'a0000000-0000-0000-0000-0000000000c1', '2026-10-01 10:00+02', '2026-10-01 10:00+02');

-- Tâche créée par les traitements de nuit : l'inactivité qu'elle signale reste visible.
insert into public.tache (affaire_id, titre, assignee_id, echeance, origine, modele_code, cle) values
  ('a0000000-0000-0000-0000-0000000000e1', 'Relancer le projet', 'a0000000-0000-0000-0000-000000000001', '2026-10-22', 'alerte', 'RG-20', 'RG-20:e1:2026-10-01');
select is((select derniere_activite_at from public.affaire where id = 'a0000000-0000-0000-0000-0000000000e1'), '2026-10-01 10:00+02'::timestamptz,
  'une tâche des traitements de nuit ne compte pas comme une activité');

select throws_ok($$ insert into public.tache (affaire_id, titre, assignee_id, echeance, origine, cle) values
  ('a0000000-0000-0000-0000-0000000000e1', 'Doublon', 'a0000000-0000-0000-0000-000000000001', '2026-10-22', 'alerte', 'RG-20:e1:2026-10-01') $$,
  '23505', null, 'une même clé ne crée pas deux tâches');

insert into public.tache (affaire_id, titre, assignee_id, echeance, origine) values
  ('a0000000-0000-0000-0000-0000000000e1', 'Tâche libre', 'a0000000-0000-0000-0000-000000000001', '2026-10-22', 'libre');
select isnt((select derniere_activite_at from public.affaire where id = 'a0000000-0000-0000-0000-0000000000e1'), '2026-10-01 10:00+02'::timestamptz,
  'une tâche ordinaire reste une activité (RG-09)');

insert into public.mail_sortant (destinataire_id, destinataire_email, type, objet, html, cle) values
  ('a0000000-0000-0000-0000-000000000001', 'n-c1@exemple.test', 'digest_quotidien', 'Votre journée', '<p>x</p>', 'digest_quotidien:2026-10-22:c1');
select throws_ok($$ insert into public.mail_sortant (destinataire_email, type, objet, html, cle) values ('x@exemple.test', 'digest_quotidien', 'b', 'b', 'digest_quotidien:2026-10-22:c1') $$,
  '23505', null, 'un même digest n''est enregistré qu''une fois');

-- Boîte d'envoi : chacun ses mails.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is_empty($$ select 1 from public.mail_sortant where cle = 'digest_quotidien:2026-10-22:c1' $$, 'une conceptrice ne lit pas le digest d''une autre');
set local request.jwt.claims = '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select isnt_empty($$ select 1 from public.mail_sortant where cle = 'digest_quotidien:2026-10-22:c1' $$, 'le destinataire lit son digest');

select * from finish();
rollback;
