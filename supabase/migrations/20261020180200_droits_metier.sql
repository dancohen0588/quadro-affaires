-- Droits d'accès du schéma métier (section 12).
--   Gérant : tout, sur les 3 magasins.
--   Conceptrice : les affaires, ventes et clients de son ou ses magasins ; un client d'un autre magasin
--     dès qu'elle porte une de ses affaires dans son magasin (client qui revient ailleurs).
--   Transverse : uniquement les affaires de sa rubrique, selon la phase des étapes ouvertes
--     (r4_avis : phase 06 « cloture » ; dossiers_pose : phases 04-05, lecture seule), et ses tâches.
--     La responsable R4 valide l'étape R4 et ses RDV (section 7.2, rôle E).
-- Aucune suppression depuis l'interface (6.1). Fonctions SECURITY DEFINER dans le schéma prive.

create or replace function prive.peut_modifier_magasin(m uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case prive.auth_role()
    when 'gerant' then true
    when 'conceptrice' then m = any (prive.auth_magasins())
    else false
  end;
$$;

create or replace function prive.affaire_visible(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case prive.auth_role()
    when 'gerant' then true
    when 'conceptrice' then exists (
      select 1 from public.affaire x where x.id = a and x.magasin_id = any (prive.auth_magasins()))
    when 'transverse' then exists (
      select 1
        from public.affaire x
        join public.etape_instance ei on ei.affaire_id = x.id and ei.statut = 'en_cours'
       where x.id = a
         and x.magasin_id = any (prive.auth_magasins())
         and (('r4_avis' = any (prive.auth_rubriques()) and ei.phase_code = 'cloture')
           or ('dossiers_pose' = any (prive.auth_rubriques()) and ei.phase_code in ('commande', 'livraison_pose'))))
    else false
  end;
$$;

create or replace function prive.affaire_modifiable(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select prive.peut_modifier_magasin(x.magasin_id) from public.affaire x where x.id = a), false);
$$;

-- Responsable R4 (rubrique r4_avis) sur une affaire qu'elle voit.
create or replace function prive.r4_autorise(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select 'r4_avis' = any (prive.auth_rubriques()) and prive.affaire_visible(a);
$$;

create or replace function prive.client_visible(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case prive.auth_role()
    when 'gerant' then true
    when 'conceptrice' then exists (
        select 1 from public.client k where k.id = c and k.magasin_id = any (prive.auth_magasins()))
      or exists (
        select 1 from public.affaire x where x.client_id = c and x.magasin_id = any (prive.auth_magasins()))
    when 'transverse' then exists (
        select 1 from public.affaire x where x.client_id = c and prive.affaire_visible(x.id))
    else false
  end;
$$;

create or replace function prive.client_modifiable(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select prive.auth_role() in ('gerant', 'conceptrice') and prive.client_visible(c);
$$;

create or replace function prive.vente_visible(v uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case prive.auth_role()
    when 'gerant' then true
    when 'conceptrice' then exists (
      select 1 from public.vente x where x.id = v and x.magasin_id = any (prive.auth_magasins()))
    when 'transverse' then exists (
      select 1 from public.affaire x where x.vente_id = v and prive.affaire_visible(x.id))
    else false
  end;
$$;

create or replace function prive.vente_modifiable(v uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select prive.peut_modifier_magasin(x.magasin_id) from public.vente x where x.id = v), false);
$$;

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;

-- ── RLS ────────────────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['process_version', 'client', 'vente', 'affaire', 'echeance', 'rdv', 'etape_instance', 'tache',
                           'commande_fournisseur', 'planning', 'document', 'mail_sortant', 'journal'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;
-- Le journal n'est jamais écrit directement : seul le trigger prive.journaliser() l'alimente.
revoke insert, update on public.journal from authenticated;

-- process_version : lecture pour tous, publication par les administrateurs (EF-103).
create policy process_version_lecture on public.process_version for select to authenticated
  using (prive.auth_role() is not null);
create policy process_version_admin_ajout on public.process_version for insert to authenticated
  with check (prive.auth_est_admin());
create policy process_version_admin_modif on public.process_version for update to authenticated
  using (prive.auth_est_admin()) with check (prive.auth_est_admin());

-- client
create policy client_lecture on public.client for select to authenticated using (prive.client_visible(id));
create policy client_ajout on public.client for insert to authenticated with check (prive.peut_modifier_magasin(magasin_id));
create policy client_modif on public.client for update to authenticated
  using (prive.client_modifiable(id)) with check (prive.auth_role() in ('gerant', 'conceptrice'));

-- affaire (la réassignation et le changement de magasin sont gardés par trigger, EF-41)
create policy affaire_lecture on public.affaire for select to authenticated using (prive.affaire_visible(id));
create policy affaire_ajout on public.affaire for insert to authenticated with check (prive.peut_modifier_magasin(magasin_id));
create policy affaire_modif on public.affaire for update to authenticated
  using (prive.peut_modifier_magasin(magasin_id)) with check (prive.peut_modifier_magasin(magasin_id));

-- vente, echeance, planning (confirmation gardée par trigger, EF-61)
create policy vente_lecture on public.vente for select to authenticated using (prive.vente_visible(id));
create policy vente_ajout on public.vente for insert to authenticated with check (prive.peut_modifier_magasin(magasin_id));
create policy vente_modif on public.vente for update to authenticated
  using (prive.peut_modifier_magasin(magasin_id)) with check (prive.peut_modifier_magasin(magasin_id));

create policy echeance_lecture on public.echeance for select to authenticated using (prive.vente_visible(vente_id));
create policy echeance_ajout on public.echeance for insert to authenticated with check (prive.vente_modifiable(vente_id));
create policy echeance_modif on public.echeance for update to authenticated
  using (prive.vente_modifiable(vente_id)) with check (prive.vente_modifiable(vente_id));

create policy planning_lecture on public.planning for select to authenticated using (prive.vente_visible(vente_id));
create policy planning_ajout on public.planning for insert to authenticated with check (prive.vente_modifiable(vente_id));
create policy planning_modif on public.planning for update to authenticated
  using (prive.vente_modifiable(vente_id)) with check (prive.vente_modifiable(vente_id));

-- rdv
create policy rdv_lecture on public.rdv for select to authenticated using (
  profil_id = auth.uid()
  or (affaire_id is not null and prive.affaire_visible(affaire_id))
  or (affaire_id is null and prive.client_visible(client_id)));
create policy rdv_ajout on public.rdv for insert to authenticated with check (
  (affaire_id is not null and prive.affaire_modifiable(affaire_id))
  or (affaire_id is null and prive.client_modifiable(client_id))
  or (type = 'R4' and affaire_id is not null and prive.r4_autorise(affaire_id)));
create policy rdv_modif on public.rdv for update to authenticated
  using (
    (affaire_id is not null and prive.affaire_modifiable(affaire_id))
    or (affaire_id is null and prive.client_modifiable(client_id))
    or (type = 'R4' and affaire_id is not null and prive.r4_autorise(affaire_id)))
  with check (
    (affaire_id is not null and prive.affaire_modifiable(affaire_id))
    or (affaire_id is null and prive.client_modifiable(client_id))
    or (type = 'R4' and affaire_id is not null and prive.r4_autorise(affaire_id)));

-- etape_instance (validation d'étape)
create policy etape_lecture on public.etape_instance for select to authenticated using (prive.affaire_visible(affaire_id));
create policy etape_ajout on public.etape_instance for insert to authenticated with check (
  prive.affaire_modifiable(affaire_id) or (etape_code = 'R4' and prive.r4_autorise(affaire_id)));
create policy etape_modif on public.etape_instance for update to authenticated
  using (prive.affaire_modifiable(affaire_id) or (etape_code = 'R4' and prive.r4_autorise(affaire_id)))
  with check (prive.affaire_modifiable(affaire_id) or (etape_code = 'R4' and prive.r4_autorise(affaire_id)));

-- tache : ses tâches pour chacun, celles des affaires visibles, toutes pour un gérant ; tâches libres pour tous (D14).
create policy tache_lecture on public.tache for select to authenticated using (
  prive.auth_role() = 'gerant'
  or assignee_id = auth.uid()
  or created_by = auth.uid()
  or (affaire_id is not null and prive.affaire_visible(affaire_id)));
create policy tache_ajout on public.tache for insert to authenticated with check (
  prive.auth_role() is not null and (affaire_id is null or prive.affaire_visible(affaire_id)));
create policy tache_modif on public.tache for update to authenticated
  using (
    prive.auth_role() = 'gerant'
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or (affaire_id is not null and prive.affaire_modifiable(affaire_id)))
  with check (prive.auth_role() is not null and (affaire_id is null or prive.affaire_visible(affaire_id)));

-- commande_fournisseur (BPA gardé par trigger) et document
create policy commande_lecture on public.commande_fournisseur for select to authenticated using (prive.affaire_visible(affaire_id));
create policy commande_ajout on public.commande_fournisseur for insert to authenticated with check (prive.affaire_modifiable(affaire_id));
create policy commande_modif on public.commande_fournisseur for update to authenticated
  using (prive.affaire_modifiable(affaire_id)) with check (prive.affaire_modifiable(affaire_id));

create policy document_lecture on public.document for select to authenticated using (prive.affaire_visible(affaire_id));
create policy document_ajout on public.document for insert to authenticated with check (
  prive.affaire_modifiable(affaire_id) or prive.r4_autorise(affaire_id));
create policy document_modif on public.document for update to authenticated
  using (prive.affaire_modifiable(affaire_id)) with check (prive.affaire_modifiable(affaire_id));

-- mail_sortant : boîte d'envoi lisible par le destinataire et par les gérants ; écrite par l'application.
create policy mail_lecture on public.mail_sortant for select to authenticated using (
  destinataire_id = auth.uid() or prive.auth_role() = 'gerant');
create policy mail_ajout on public.mail_sortant for insert to authenticated with check (prive.auth_role() is not null);

-- journal : lecture seule ; chacun voit l'historique de ce qu'il voit, les gérants tout.
-- Le rattachement le plus précis décide : une trace d'affaire n'est jamais ouverte par le seul fait de voir son client.
create policy journal_lecture on public.journal for select to authenticated using (
  prive.auth_role() = 'gerant'
  or (affaire_id is not null and prive.affaire_visible(affaire_id))
  or (affaire_id is null and vente_id is not null and prive.vente_visible(vente_id))
  or (affaire_id is null and vente_id is null and client_id is not null and prive.client_visible(client_id)));
