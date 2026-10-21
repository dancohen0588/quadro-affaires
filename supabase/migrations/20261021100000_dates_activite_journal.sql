-- Dates d'activité et de journal fidèles à la date de l'écriture (préparation de la reprise d'historique :
-- seed de démo, import CSV de la section 13.1).
--
-- Avant : toute insertion datait la dernière activité et la trace du journal à « maintenant », même pour
-- une ligne historique dont created_at est fourni. Désormais :
--   - à l'insertion, la date retenue est le created_at de la ligne (qui vaut prive.app_now() par défaut) ;
--   - à la mise à jour, c'est prive.app_now() ;
--   - la dernière activité d'une affaire ne recule jamais.
-- En usage normal (created_at par défaut), le comportement est inchangé.

-- Sans valeur par défaut : le trigger distingue ainsi une date fournie (historique) d'une insertion ordinaire.
alter table public.affaire alter column derniere_activite_at drop default;

create or replace function prive.affaire_activite_propre()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.derniere_activite_at := coalesce(new.derniere_activite_at, new.created_at, prive.app_now());
  elsif new.derniere_activite_at is not distinct from old.derniere_activite_at then
    -- Écriture directe sur l'affaire : elle compte comme une activité.
    new.derniere_activite_at := prive.app_now();
  end if;
  -- Sinon, la valeur a été fixée explicitement (activité d'une ligne liée) : on la garde.
  return new;
end;
$$;

create or replace function prive.affaire_activite_liee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne jsonb := to_jsonb(coalesce(new, old));
  ancienne jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  quand timestamptz := case when tg_op = 'INSERT' then coalesce((ligne ->> 'created_at')::timestamptz, prive.app_now())
                            else prive.app_now() end;
begin
  if ligne ? 'affaire_id' then
    update public.affaire set derniere_activite_at = quand
     where id in ((ligne ->> 'affaire_id')::uuid, (ancienne ->> 'affaire_id')::uuid) and derniere_activite_at < quand;
  elsif tg_table_name = 'vente' then
    update public.affaire set derniere_activite_at = quand
     where vente_id = (ligne ->> 'id')::uuid and derniere_activite_at < quand;
  elsif ligne ? 'vente_id' then
    update public.affaire set derniere_activite_at = quand
     where vente_id = (ligne ->> 'vente_id')::uuid and derniere_activite_at < quand;
  end if;
  return null;
end;
$$;

create or replace function prive.journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  avant jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  apres jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  ligne jsonb := coalesce(apres, avant);
  techniques text[] := array['updated_at', 'derniere_activite_at', 'etape_courante_code'];
begin
  if tg_op = 'UPDATE' and (avant - techniques) = (apres - techniques) then
    return null;
  end if;
  insert into public.journal (table_nom, ligne_id, action, avant, apres, auteur_id, at, affaire_id, vente_id, client_id)
  values (
    tg_table_name,
    (ligne ->> 'id')::uuid,
    lower(tg_op),
    avant,
    apres,
    (select p.id from public.profil p where p.id = auth.uid()),
    case when tg_op = 'INSERT' then coalesce((apres ->> 'created_at')::timestamptz, prive.app_now()) else prive.app_now() end,
    -- Sur une suppression, la trace reste dans « avant » sans clé étrangère vers une ligne qui disparaît.
    case when tg_op = 'DELETE' then null when tg_table_name = 'affaire' then (ligne ->> 'id')::uuid else (ligne ->> 'affaire_id')::uuid end,
    case when tg_op = 'DELETE' then null when tg_table_name = 'vente' then (ligne ->> 'id')::uuid else (ligne ->> 'vente_id')::uuid end,
    case when tg_op = 'DELETE' then null when tg_table_name = 'client' then (ligne ->> 'id')::uuid else (ligne ->> 'client_id')::uuid end
  );
  return null;
end;
$$;

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;
