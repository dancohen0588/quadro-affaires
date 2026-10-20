-- Horloge applicative (docs/conception.md, sections 5.4 et 6.1).
-- « Maintenant » côté SQL passe toujours par app_now() / app_today(), jamais par now() ni current_date :
-- en démo, l'horloge est décalée (parametre.horloge_demo) et les triggers, valeurs par défaut et vues
-- d'indicateurs doivent avancer avec l'interface.
--
-- parametre.horloge_demo vaut null (heure réelle) ou {"decalage_secondes": <nombre>}.
-- Un décalage plutôt qu'une date figée : le temps continue de s'écouler pendant la démo,
-- et deux écritures successives gardent leur ordre.

create or replace function public.app_now()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reglage jsonb;
  decalage numeric;
begin
  -- La table parametre est créée dans la migration suivante ; plpgsql ne la résout qu'à l'exécution.
  select p.valeur into reglage from public.parametre p where p.cle = 'horloge_demo';
  decalage := coalesce((reglage ->> 'decalage_secondes')::numeric, 0);
  return now() + make_interval(secs => decalage);
end;
$$;

comment on function public.app_now() is
  'Instant courant de l''application : heure réelle, décalée de parametre.horloge_demo en démo.';

create or replace function public.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (public.app_now() at time zone 'Europe/Paris')::date;
$$;

comment on function public.app_today() is 'Date du jour de l''application, en Europe/Paris.';

-- Trigger commun : updated_at suit l'horloge applicative.
create or replace function public.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := public.app_now();
  return new;
end;
$$;

revoke all on function public.app_now() from public;
revoke all on function public.app_today() from public;
grant execute on function public.app_now() to authenticated, service_role;
grant execute on function public.app_today() to authenticated, service_role;
