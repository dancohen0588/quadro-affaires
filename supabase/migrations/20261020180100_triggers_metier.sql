-- Triggers du schéma métier : updated_at, dernière activité (RG-09), journal (ENF-09) et gardes de droits
-- qu'une politique RLS ne sait pas exprimer colonne par colonne (section 12).

-- ── updated_at ─────────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['process_version', 'client', 'vente', 'affaire', 'echeance', 'rdv', 'etape_instance',
                           'tache', 'commande_fournisseur', 'planning', 'document', 'mail_sortant'] loop
    execute format('create trigger %I before update on public.%I for each row execute function prive.maj_updated_at()',
                   t || '_maj', t);
  end loop;
end;
$$;

-- ── Dernière activité (RG-09) ──────────────────────────────────────────────────────────────────
-- Toute écriture sur l'affaire, ses étapes, tâches, RDV, commandes, documents, échéances ou planning
-- met à jour affaire.derniere_activite_at (point rouge d'inactivité, RG-27).

create or replace function prive.affaire_activite_propre()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.derniere_activite_at := prive.app_now();
  return new;
end;
$$;

create trigger affaire_activite before insert or update on public.affaire
  for each row execute function prive.affaire_activite_propre();

-- Écriture sur une ligne liée à une affaire (colonne affaire_id) ou à une vente (colonne vente_id).
create or replace function prive.affaire_activite_liee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne jsonb := to_jsonb(coalesce(new, old));
  ancienne jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
begin
  if ligne ? 'affaire_id' then
    update public.affaire set derniere_activite_at = prive.app_now()
     where id in ((ligne ->> 'affaire_id')::uuid, (ancienne ->> 'affaire_id')::uuid);
  elsif tg_table_name = 'vente' then
    update public.affaire set derniere_activite_at = prive.app_now() where vente_id = (ligne ->> 'id')::uuid;
  elsif ligne ? 'vente_id' then
    update public.affaire set derniere_activite_at = prive.app_now() where vente_id = (ligne ->> 'vente_id')::uuid;
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['etape_instance', 'tache', 'rdv', 'commande_fournisseur', 'document', 'echeance', 'planning', 'vente'] loop
    execute format('create trigger %I after insert or update on public.%I for each row execute function prive.affaire_activite_liee()',
                   t || '_activite', t);
  end loop;
end;
$$;

-- ── Journal (ENF-09) ───────────────────────────────────────────────────────────────────────────
-- Chaque écriture métier laisse une trace. Les mises à jour qui ne touchent que des colonnes techniques
-- (updated_at, derniere_activite_at, etape_courante_code) ne sont pas journalisées.
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
  insert into public.journal (table_nom, ligne_id, action, avant, apres, auteur_id, affaire_id, vente_id, client_id)
  values (
    tg_table_name,
    (ligne ->> 'id')::uuid,
    lower(tg_op),
    avant,
    apres,
    (select p.id from public.profil p where p.id = auth.uid()),
    -- Sur une suppression, la trace reste dans « avant » sans clé étrangère vers une ligne qui disparaît.
    case when tg_op = 'DELETE' then null when tg_table_name = 'affaire' then (ligne ->> 'id')::uuid else (ligne ->> 'affaire_id')::uuid end,
    case when tg_op = 'DELETE' then null when tg_table_name = 'vente' then (ligne ->> 'id')::uuid else (ligne ->> 'vente_id')::uuid end,
    case when tg_op = 'DELETE' then null when tg_table_name = 'client' then (ligne ->> 'id')::uuid else (ligne ->> 'client_id')::uuid end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['societe', 'magasin', 'profil', 'parametre', 'process_version', 'client', 'vente', 'affaire',
                           'echeance', 'rdv', 'etape_instance', 'tache', 'commande_fournisseur', 'planning', 'document'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function prive.journaliser()',
                   t || '_journal', t);
  end loop;
end;
$$;

-- ── Gardes de droits (section 12) ──────────────────────────────────────────────────────────────
-- Contexte serveur sans utilisateur (seed, traitements de nuit avec la clé secrète) : autorisé.
create or replace function prive.est_gerant_ou_serveur()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null or coalesce(prive.auth_role() = 'gerant', false);
$$;

-- EF-41 : seul un gérant réassigne une affaire ou la change de magasin.
create or replace function prive.garde_affaire()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.concepteur_id is distinct from old.concepteur_id or new.magasin_id is distinct from old.magasin_id)
     and not prive.est_gerant_ou_serveur() then
    raise exception 'Seul un gérant peut réassigner une affaire ou changer son magasin.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger affaire_garde before update on public.affaire for each row execute function prive.garde_affaire();

-- Section 12 : seul un gérant donne le BPA.
create or replace function prive.garde_bpa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bpa_donne_le is distinct from (case when tg_op = 'UPDATE' then old.bpa_donne_le else null end)
     and not prive.est_gerant_ou_serveur() then
    raise exception 'Seul un gérant peut donner le BPA.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger commande_garde_bpa before insert or update on public.commande_fournisseur
  for each row execute function prive.garde_bpa();

-- Section 12 et EF-61 : seul un gérant confirme ou décale un planning.
create or replace function prive.garde_planning()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  confirmation_changee boolean;
begin
  if tg_op = 'INSERT' then
    confirmation_changee := new.statut <> 'demandee' or new.semaine_livraison_confirmee is not null
                            or new.date_pose_confirmee is not null or new.confirme_par is not null;
  else
    confirmation_changee := new.statut is distinct from old.statut
                            or new.semaine_livraison_confirmee is distinct from old.semaine_livraison_confirmee
                            or new.date_pose_confirmee is distinct from old.date_pose_confirmee
                            or new.confirme_par is distinct from old.confirme_par;
  end if;
  if confirmation_changee and not prive.est_gerant_ou_serveur() then
    raise exception 'Seul un gérant peut confirmer ou décaler un planning.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger planning_garde before insert or update on public.planning for each row execute function prive.garde_planning();

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;
