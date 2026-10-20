-- Droits d'accès (section 12) : fonctions de contexte et politiques RLS du référentiel.
-- Les fonctions sont SECURITY DEFINER pour lire profil sans repasser par ses propres politiques.

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profil p where p.id = auth.uid() and p.actif;
$$;

create or replace function public.auth_est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.est_admin from public.profil p where p.id = auth.uid() and p.actif), false);
$$;

create or replace function public.auth_rubriques()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.rubriques from public.profil p where p.id = auth.uid() and p.actif), '{}'::text[]);
$$;

-- Magasins visibles : les trois pour un gérant, ses rattachements sinon, aucun pour un profil inactif.
create or replace function public.auth_magasins()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select public.auth_role() as role)
  select case
    when moi.role is null then '{}'::uuid[]
    when moi.role = 'gerant' then coalesce((select array_agg(m.id order by m.code) from public.magasin m), '{}'::uuid[])
    else coalesce(
      (select array_agg(pm.magasin_id order by pm.magasin_id) from public.profil_magasin pm where pm.profil_id = auth.uid()),
      '{}'::uuid[])
  end
  from moi;
$$;

revoke all on function public.auth_role(), public.auth_est_admin(), public.auth_rubriques(), public.auth_magasins() from public;
grant execute on function public.auth_role(), public.auth_est_admin(), public.auth_rubriques(), public.auth_magasins()
  to authenticated, service_role;

-- ── RLS ────────────────────────────────────────────────────────────────────────────────────────
alter table public.societe enable row level security;
alter table public.magasin enable row level security;
alter table public.profil enable row level security;
alter table public.profil_magasin enable row level security;
alter table public.parametre enable row level security;

-- Lecture : tout profil actif (référentiel commun, noms des collègues pour l'assignation).
create policy societe_lecture on public.societe for select to authenticated using (public.auth_role() is not null);
create policy magasin_lecture on public.magasin for select to authenticated using (public.auth_role() is not null);
create policy profil_lecture on public.profil for select to authenticated using (public.auth_role() is not null);
create policy profil_magasin_lecture on public.profil_magasin for select to authenticated using (public.auth_role() is not null);
create policy parametre_lecture on public.parametre for select to authenticated using (public.auth_role() is not null);

-- Écriture : administrateurs (les trois gérants), EF-100 à EF-102. Aucune suppression depuis l'interface.
create policy societe_admin_ajout on public.societe for insert to authenticated with check (public.auth_est_admin());
create policy societe_admin_modif on public.societe for update to authenticated using (public.auth_est_admin()) with check (public.auth_est_admin());
create policy magasin_admin_ajout on public.magasin for insert to authenticated with check (public.auth_est_admin());
create policy magasin_admin_modif on public.magasin for update to authenticated using (public.auth_est_admin()) with check (public.auth_est_admin());
create policy profil_admin_ajout on public.profil for insert to authenticated with check (public.auth_est_admin());
create policy profil_admin_modif on public.profil for update to authenticated using (public.auth_est_admin()) with check (public.auth_est_admin());
create policy profil_magasin_admin_ajout on public.profil_magasin for insert to authenticated with check (public.auth_est_admin());
create policy profil_magasin_admin_retrait on public.profil_magasin for delete to authenticated using (public.auth_est_admin());
create policy parametre_admin_ajout on public.parametre for insert to authenticated with check (public.auth_est_admin());
create policy parametre_admin_modif on public.parametre for update to authenticated using (public.auth_est_admin()) with check (public.auth_est_admin());

-- Droits de table explicites (ne pas dépendre de l'exposition automatique des nouvelles tables).
-- La RLS ci-dessus filtre ensuite ce que chaque utilisateur voit et modifie.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.societe, public.magasin, public.profil, public.profil_magasin, public.parametre
  to authenticated, service_role;

-- Le rôle anonyme n'a rien à faire dans ces tables.
revoke all on public.societe, public.magasin, public.profil, public.profil_magasin, public.parametre from anon;
