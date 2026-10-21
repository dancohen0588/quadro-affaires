-- Quotidien des conceptrices et des gérants (session 3.1, EF-20 à EF-25).
--
-- 1. Clôture d'une affaire avant la vente (EF-25) : nouvel effet « sauter_etape » du moteur.
-- 2. Doublon exact nom + téléphone interdit (EF-21), quelle que soit la façon d'écrire le numéro.
-- 3. public.rechercher_clients : propose les clients existants de tous les magasins (client qui revient,
--    D1), avec les seules informations utiles pour le reconnaître.
-- 4. public.creer_affaires : crée une ou plusieurs affaires pour un client et les démarre dans le
--    process (effets du moteur), tout ou rien (EF-23, RG-02).

-- ── 1. Effet sauter_etape ──────────────────────────────────────────────────────────────────────
create or replace function prive.appliquer_effets(p_affaire uuid, p_effets jsonb, p_ouvertes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.affaire;
  e jsonb;
  t text;
  modifiable boolean := prive.affaire_modifiable(p_affaire);
  actuelles text[];
  etape_id uuid;
begin
  if jsonb_typeof(p_effets) is distinct from 'array' then
    raise exception 'Effets invalides.' using errcode = '22023';
  end if;

  -- Droits : modifier l'affaire, ou responsable R4 qui valide son R4 (section 12).
  if not modifiable then
    if not prive.r4_autorise(p_affaire) then
      raise exception 'Vous ne pouvez pas modifier cette affaire.' using errcode = '42501';
    end if;
    for e in select * from jsonb_array_elements(p_effets) loop
      t := e ->> 'type';
      if not (t in ('creer_tache', 'etape_courante')
              or (t in ('fermer_etape', 'annuler_taches') and e ->> 'etape' = 'R4')
              or (t = 'ouvrir_etape' and e ->> 'etape' in ('RELANCE_AVIS', 'ARCHIVAGE'))) then
        raise exception 'La responsable R4 ne valide que l''étape R4.' using errcode = '42501';
      end if;
    end loop;
  end if;

  select * into x from public.affaire where id = p_affaire for update;
  if not found then
    raise exception 'Affaire introuvable.' using errcode = 'P0002';
  end if;

  -- Concurrence : les étapes ouvertes doivent être celles que l'utilisateur a vues.
  select coalesce(array_agg(etape_code || '.' || iteration order by etape_code, iteration), '{}')
    into actuelles
    from public.etape_instance where affaire_id = p_affaire and statut = 'en_cours';
  if actuelles is distinct from (select coalesce(array_agg(v order by split_part(v, '.', 1), split_part(v, '.', 2)::int), '{}')
                                   from unnest(p_ouvertes) v) then
    raise exception 'L''affaire a été modifiée entre-temps : rechargez la fiche.' using errcode = '40001';
  end if;

  for e in select * from jsonb_array_elements(p_effets) loop
    case e ->> 'type'
      when 'fermer_etape' then
        update public.etape_instance
           set statut = 'faite', issue_code = e ->> 'issue', motif = e ->> 'motif',
               fin_at = (e ->> 'quand')::timestamptz, valide_par = (e ->> 'par')::uuid
         where affaire_id = p_affaire and etape_code = e ->> 'etape' and iteration = (e ->> 'iteration')::int
           and statut = 'en_cours';
        if not found then
          raise exception 'Étape % non ouverte.', e ->> 'etape' using errcode = '40001';
        end if;

      when 'sauter_etape' then
        update public.etape_instance
           set statut = 'sautee', motif = e ->> 'motif',
               fin_at = (e ->> 'quand')::timestamptz, valide_par = (e ->> 'par')::uuid
         where affaire_id = p_affaire and etape_code = e ->> 'etape' and iteration = (e ->> 'iteration')::int
           and statut = 'en_cours';
        if not found then
          raise exception 'Étape % non ouverte.', e ->> 'etape' using errcode = '40001';
        end if;

      when 'annuler_taches' then
        update public.tache t
           set statut = 'annulee'
          from public.etape_instance ei
         where t.etape_instance_id = ei.id and t.statut = 'a_faire'
           and ei.affaire_id = p_affaire and ei.etape_code = e ->> 'etape' and ei.iteration = (e ->> 'iteration')::int;

      when 'ouvrir_etape' then
        insert into public.etape_instance (affaire_id, etape_code, phase_code, branche, iteration, statut, debut_at)
        values (p_affaire, e ->> 'etape', e ->> 'phase', e ->> 'branche', (e ->> 'iteration')::int, 'en_cours',
                (e ->> 'quand')::timestamptz);

      when 'creer_tache' then
        select id into etape_id from public.etape_instance
         where affaire_id = p_affaire and etape_code = e ->> 'etape' and iteration = (e ->> 'iteration')::int;
        insert into public.tache (affaire_id, etape_instance_id, modele_code, titre, assignee_id, echeance, origine, optionnelle)
        values (p_affaire, etape_id, e ->> 'code', e ->> 'titre', prive.profil_du_role(p_affaire, e ->> 'role'),
                (e ->> 'echeance')::date, e ->> 'origine', coalesce((e ->> 'optionnelle')::boolean, false));

      when 'statut_affaire' then
        update public.affaire
           set statut = e ->> 'statut',
               motif_perte = case when e ->> 'statut' in ('perdue', 'abandonnee') then e ->> 'motif' else motif_perte end,
               archive_le = case when e ->> 'statut' = 'cloturee' then prive.app_today() else archive_le end
         where id = p_affaire;

      when 'creer_rdv' then
        insert into public.rdv (affaire_id, client_id, type, rang, debut, profil_id)
        values (p_affaire, x.client_id, e ->> 'rdv', (e ->> 'rang')::int,
                ((e ->> 'date') || ' 10:00')::timestamp at time zone 'Europe/Paris', x.concepteur_id);

      when 'etape_courante' then
        update public.affaire set etape_courante_code = e ->> 'etape' where id = p_affaire;

      else
        raise exception 'Effet inconnu : %.', e ->> 'type' using errcode = '22023';
    end case;
  end loop;
end;
$$;


-- ── 2. Doublons ────────────────────────────────────────────────────────────────────────────────
create or replace function prive.chiffres(t text)
returns text language sql immutable set search_path = '' as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g'); $$;

create unique index client_doublon_nom_telephone on public.client (upper(btrim(nom)), prive.chiffres(telephone))
  where telephone is not null and length(prive.chiffres(telephone)) >= 6;

-- ── 3. Recherche des clients existants ─────────────────────────────────────────────────────────
-- Insensible aux accents (« Hélène » trouve « HELENE ») et aux espaces des numéros.
create extension if not exists unaccent with schema extensions;

create or replace function prive.rechercher_clients(p_q text)
returns table (id uuid, type text, nom text, prenom text, raison_sociale text, telephone text, ville text,
               magasin text, affaires integer, visible boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_q, ''));
  num text := prive.chiffres(p_q);
begin
  if prive.auth_role() is null or prive.auth_role() not in ('gerant', 'conceptrice') then
    raise exception 'Recherche réservée aux gérants et conceptrices.' using errcode = '42501';
  end if;
  if length(q) < 2 then
    return;
  end if;
  return query
    select k.id, k.type, k.nom, k.prenom, k.raison_sociale, k.telephone, k.ville, m.nom,
           (select count(*)::int from public.affaire a where a.client_id = k.id),
           prive.client_visible(k.id)
      from public.client k
      join public.magasin m on m.id = k.magasin_id
     where k.archive_le is null
       and (extensions.unaccent(k.nom || ' ' || coalesce(k.prenom, '')) ilike extensions.unaccent(q) || '%'
            or extensions.unaccent(coalesce(k.raison_sociale, '')) ilike '%' || extensions.unaccent(q) || '%'
            or (length(num) >= 4 and prive.chiffres(k.telephone) like '%' || num || '%'))
     order by k.nom, k.prenom
     limit 8;
end;
$$;

-- ── 4. Création d'affaires ─────────────────────────────────────────────────────────────────────
create or replace function prive.creer_affaires(p_client uuid, p_affaires jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  nouvelle uuid;
  ids uuid[] := '{}';
begin
  if prive.auth_role() is null or prive.auth_role() not in ('gerant', 'conceptrice') then
    raise exception 'Seuls les gérants et les conceptrices créent des affaires.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.client where id = p_client) then
    raise exception 'Client introuvable.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_affaires) is distinct from 'array' or jsonb_array_length(p_affaires) = 0 then
    raise exception 'Aucune affaire à créer.' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_affaires) loop
    if not prive.peut_modifier_magasin((item ->> 'magasin_id')::uuid) then
      raise exception 'Vous ne pouvez pas créer d''affaire dans ce magasin.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profil p where p.id = (item ->> 'concepteur_id')::uuid and p.actif
                   and p.role in ('gerant', 'conceptrice')) then
      raise exception 'Le concepteur doit être un gérant ou une conceptrice actif.' using errcode = '22023';
    end if;
    insert into public.affaire (client_id, magasin_id, concepteur_id, projet, libelle, libelle_manuel, contremarque,
                                process_version_id, derniere_activite_at)
    values (p_client, (item ->> 'magasin_id')::uuid, (item ->> 'concepteur_id')::uuid, item ->> 'projet',
            item ->> 'libelle', coalesce((item ->> 'libelle_manuel')::boolean, false), item ->> 'contremarque',
            (item ->> 'process_version_id')::uuid, prive.app_now())
    returning id into nouvelle;
    perform prive.appliquer_effets(nouvelle, item -> 'effets', '{}');
    ids := ids || nouvelle;
  end loop;
  return ids;
end;
$$;

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;

create or replace function public.rechercher_clients(q text)
returns table (id uuid, type text, nom text, prenom text, raison_sociale text, telephone text, ville text,
               magasin text, affaires integer, visible boolean)
language sql stable security invoker set search_path = '' as $$ select * from prive.rechercher_clients(q); $$;

create or replace function public.creer_affaires(client_id uuid, affaires jsonb)
returns uuid[]
language sql security invoker set search_path = '' as $$ select prive.creer_affaires(client_id, affaires); $$;

revoke all on function public.rechercher_clients(text), public.creer_affaires(uuid, jsonb) from public, anon;
grant execute on function public.rechercher_clients(text), public.creer_affaires(uuid, jsonb) to authenticated, service_role;

-- ── 5. Rappel convenu au R0 (RG-35) : la tâche de relance pointe vers le client, sans affaire ─────
alter table public.tache add column client_id uuid references public.client (id);
create index tache_client_idx on public.tache (client_id);

-- ── 6. Identité d'un client d'un autre magasin, pour composer le libellé de son affaire (RG-03) ───
create or replace function prive.identite_client(p_client uuid)
returns table (type text, nom text, prenom text, raison_sociale text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if prive.auth_role() is null or prive.auth_role() not in ('gerant', 'conceptrice') then
    raise exception 'Réservé aux gérants et conceptrices.' using errcode = '42501';
  end if;
  return query select k.type, k.nom, k.prenom, k.raison_sociale from public.client k where k.id = p_client;
end;
$$;
revoke all on function prive.identite_client(uuid) from public, anon;
grant execute on function prive.identite_client(uuid) to authenticated, service_role;

create or replace function public.identite_client(client_id uuid)
returns table (type text, nom text, prenom text, raison_sociale text)
language sql stable security invoker set search_path = '' as $$ select * from prive.identite_client(client_id); $$;
revoke all on function public.identite_client(uuid) from public, anon;
grant execute on function public.identite_client(uuid) to authenticated, service_role;

-- ── 7. Lecture d'un client tout juste créé (INSERT … RETURNING) ──────────────────────────────────
-- client_visible() relit la table : la ligne en cours d'insertion n'y est pas encore. La conceptrice
-- lit donc aussi directement les clients de ses magasins (même règle que client_visible).
drop policy client_lecture on public.client;
create policy client_lecture on public.client for select to authenticated using (
  (prive.auth_role() = 'conceptrice' and magasin_id = any (prive.auth_magasins())) or prive.client_visible(id));
