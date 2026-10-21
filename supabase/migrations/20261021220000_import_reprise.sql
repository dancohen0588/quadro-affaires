-- Reprise initiale des affaires (section 13.1, session 5.2) : écriture d'une ligne du CSV, tout ou rien.
-- Le plan (client, vente, échéancier, planning, RDV, étapes, tâches) est calculé par l'application
-- (src/lib/import/affaires.ts, rejeu du moteur) ; la base vérifie le droit et écrit en une transaction.

-- Insère une ligne JSON dans une table métier, en ne renseignant que les colonnes fournies
-- (les autres gardent leur valeur par défaut). Tables autorisées : celles de l'import.
create or replace function prive.inserer_ligne(p_table text, p_ligne jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  colonnes text;
begin
  if p_table not in ('client', 'vente', 'affaire', 'echeance', 'planning', 'rdv', 'etape_instance', 'tache') then
    raise exception 'Table non importable : %', p_table using errcode = '22023';
  end if;
  select string_agg(quote_ident(c.column_name), ', ')
    into colonnes
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table and p_ligne ? c.column_name;
  if colonnes is null then return; end if;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', p_table, colonnes, colonnes, p_table)
    using p_ligne;
end;
$$;

create or replace function prive.importer_affaire(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := p -> 'affaire';
  x jsonb;
begin
  if prive.auth_role() is distinct from 'gerant' and not prive.est_gerant_ou_serveur() then
    raise exception 'Seuls les gérants importent des affaires.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.affaire f
     where f.magasin_id = (a ->> 'magasin_id')::uuid
       and upper(extensions.unaccent(f.contremarque)) = upper(extensions.unaccent(a ->> 'contremarque'))
       and upper(extensions.unaccent(f.projet)) = upper(extensions.unaccent(a ->> 'projet'))) then
    raise exception 'Déjà présente : % · %.', a ->> 'contremarque', a ->> 'projet' using errcode = '23505';
  end if;
  if jsonb_typeof(p -> 'client') = 'object' then perform prive.inserer_ligne('client', p -> 'client'); end if;
  if jsonb_typeof(p -> 'vente') = 'object' then perform prive.inserer_ligne('vente', p -> 'vente'); end if;
  perform prive.inserer_ligne('affaire', a);
  -- Échéancier avant les étapes : la garde RG-01 lit l'acompte 1 reçu.
  for x in select * from jsonb_array_elements(coalesce(p -> 'echeances', '[]')) loop perform prive.inserer_ligne('echeance', x); end loop;
  if jsonb_typeof(p -> 'planning') = 'object' then perform prive.inserer_ligne('planning', p -> 'planning'); end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'rdv', '[]')) loop perform prive.inserer_ligne('rdv', x); end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'etapes', '[]')) loop perform prive.inserer_ligne('etape_instance', x); end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'taches', '[]')) loop perform prive.inserer_ligne('tache', x); end loop;
  return (a ->> 'id')::uuid;
end;
$$;

create or replace function public.importer_affaire(p jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select prive.importer_affaire(p);
$$;

revoke all on function prive.inserer_ligne(text, jsonb), prive.importer_affaire(jsonb), public.importer_affaire(jsonb) from public, anon;
-- inserer_ligne n'est appelée que par importer_affaire (même propriétaire) : aucun droit direct.
grant execute on function prive.inserer_ligne(text, jsonb) to service_role;
grant execute on function prive.importer_affaire(jsonb) to authenticated, service_role;
grant execute on function public.importer_affaire(jsonb) to authenticated, service_role;
