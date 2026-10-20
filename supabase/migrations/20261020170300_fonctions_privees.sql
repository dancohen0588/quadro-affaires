-- Fonctions de contexte et d'horloge dans un schéma privé, non exposé par l'API REST
-- (alerte Supabase « security definer function executable » : elles étaient appelables via /rest/v1/rpc).
-- Les valeurs par défaut, triggers et politiques RLS suivent la fonction déplacée (référence par identifiant) ;
-- seules les fonctions qui en appellent d'autres par leur nom sont réécrites.

create schema if not exists prive;
revoke all on schema prive from public, anon;
grant usage on schema prive to authenticated, service_role;

alter function public.app_now() set schema prive;
alter function public.app_today() set schema prive;
alter function public.maj_updated_at() set schema prive;
alter function public.auth_role() set schema prive;
alter function public.auth_est_admin() set schema prive;
alter function public.auth_rubriques() set schema prive;
alter function public.auth_magasins() set schema prive;

create or replace function prive.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (prive.app_now() at time zone 'Europe/Paris')::date;
$$;

create or replace function prive.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := prive.app_now();
  return new;
end;
$$;

create or replace function prive.auth_magasins()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select prive.auth_role() as role)
  select case
    when moi.role is null then '{}'::uuid[]
    when moi.role = 'gerant' then coalesce((select array_agg(m.id order by m.code) from public.magasin m), '{}'::uuid[])
    else coalesce(
      (select array_agg(pm.magasin_id order by pm.magasin_id) from public.profil_magasin pm where pm.profil_id = auth.uid()),
      '{}'::uuid[])
  end
  from moi;
$$;

-- Droits d'exécution : jamais anon ; authenticated en a besoin pour évaluer les politiques RLS.
revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;
alter default privileges in schema prive revoke execute on functions from public, anon;

-- Index des clés étrangères created_by (alerte de performance Supabase).
create index if not exists societe_created_by_idx on public.societe (created_by);
create index if not exists magasin_created_by_idx on public.magasin (created_by);
create index if not exists profil_created_by_idx on public.profil (created_by);
create index if not exists profil_magasin_created_by_idx on public.profil_magasin (created_by);
create index if not exists parametre_created_by_idx on public.parametre (created_by);
