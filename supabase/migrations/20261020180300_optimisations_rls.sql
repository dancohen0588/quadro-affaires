-- Alertes de performance Supabase après la session 1.3 :
-- auth.uid() évalué une seule fois par requête (sous-requête) plutôt qu'à chaque ligne,
-- et index des dernières clés étrangères sans index.

drop policy rdv_lecture on public.rdv;
create policy rdv_lecture on public.rdv for select to authenticated using (
  profil_id = (select auth.uid())
  or (affaire_id is not null and prive.affaire_visible(affaire_id))
  or (affaire_id is null and prive.client_visible(client_id)));

drop policy tache_lecture on public.tache;
create policy tache_lecture on public.tache for select to authenticated using (
  prive.auth_role() = 'gerant'
  or assignee_id = (select auth.uid())
  or created_by = (select auth.uid())
  or (affaire_id is not null and prive.affaire_visible(affaire_id)));

drop policy tache_modif on public.tache;
create policy tache_modif on public.tache for update to authenticated
  using (
    prive.auth_role() = 'gerant'
    or assignee_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (affaire_id is not null and prive.affaire_modifiable(affaire_id)))
  with check (prive.auth_role() is not null and (affaire_id is null or prive.affaire_visible(affaire_id)));

drop policy mail_lecture on public.mail_sortant;
create policy mail_lecture on public.mail_sortant for select to authenticated using (
  destinataire_id = (select auth.uid()) or prive.auth_role() = 'gerant');

create index if not exists process_version_created_by_idx on public.process_version (created_by);
create index if not exists process_version_publiee_par_idx on public.process_version (publiee_par);
