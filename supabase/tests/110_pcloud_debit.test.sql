-- PCloud simulé et débit AGEM (session 5.1) : modèle « NOUVEAU CLIENT », KPI-11 marge estimée, droits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

update public.parametre set valeur = jsonb_build_object('decalage_secondes', extract(epoch from ('2026-10-21 12:00+02'::timestamptz - now())))
 where cle = 'horloge_demo';

insert into public.societe (id, nom, code) values ('b0000000-0000-0000-0000-0000000000a1', 'Société PCloud', 'PCLD');
insert into public.magasin (id, nom, code, societe_id) values
  ('b0000000-0000-0000-0000-0000000000b1', 'P1', 'PCLA', 'b0000000-0000-0000-0000-0000000000a1'),
  ('b0000000-0000-0000-0000-0000000000b2', 'P2', 'PCLB', 'b0000000-0000-0000-0000-0000000000a1');
insert into auth.users (id, email) values ('b0000000-0000-0000-0000-000000000001', 'p-c1@exemple.test'), ('b0000000-0000-0000-0000-000000000002', 'p-c2@exemple.test');
insert into public.profil (id, prenom, email, role, initiales) values
  ('b0000000-0000-0000-0000-000000000001', 'C1', 'p-c1@exemple.test', 'conceptrice', 'C1'),
  ('b0000000-0000-0000-0000-000000000002', 'C2', 'p-c2@exemple.test', 'conceptrice', 'C2');
insert into public.profil_magasin (profil_id, magasin_id) values
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000b1'),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-0000000000b2');
insert into public.process_version (id, nom, definition) values ('b0000000-0000-0000-0000-0000000000c1', 'pcloud', '{}');
insert into public.client (id, nom, magasin_id) values ('b0000000-0000-0000-0000-0000000000d1', 'VISIO', 'b0000000-0000-0000-0000-0000000000b1');
insert into public.vente (id, client_id, magasin_id, date_signature, montant_ht_cts, montant_ttc_cts) values
  ('b0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000b1', '2026-10-20', 745000, 894000);
insert into public.affaire (id, client_id, magasin_id, concepteur_id, projet, libelle, contremarque, process_version_id, statut, vente_id) values
  ('b0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001',
   'bureau', 'VISIO · Bureau', 'VISIO', 'b0000000-0000-0000-0000-0000000000c1', 'gagnee', 'b0000000-0000-0000-0000-0000000000f1');
insert into public.commande_fournisseur (affaire_id, fournisseur, iteration, prix_achat_cts, statut) values
  ('b0000000-0000-0000-0000-0000000000e1', 'AGEM', 1, 310272, 'envoyee'),
  ('b0000000-0000-0000-0000-0000000000e1', 'Hettich', 1, null, 'envoyee');

select ok((select jsonb_array_length(valeur) >= 12 from public.parametre where cle = 'pcloud_modele'), 'le modèle NOUVEAU CLIENT liste les sous-dossiers');

set local role authenticated;
set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select results_eq($$ select nb_ventes, ca_ht_cts, achats_cts from public.kpi_marge where magasin_id = 'b0000000-0000-0000-0000-0000000000b1' and periode = 'semaine' $$,
  $$ values (1, 745000::bigint, 310272::bigint) $$, 'KPI-11 : CA HT et prix d''achat des commandes de la vente');

set local request.jwt.claims = '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is_empty($$ select 1 from public.kpi_marge where magasin_id = 'b0000000-0000-0000-0000-0000000000b1' $$, 'la marge d''un autre magasin reste invisible');

set local role anon;
select throws_ok($$ select * from public.kpi_marge $$, '42501', null, 'anon ne lit pas la marge');

select * from finish();
rollback;
