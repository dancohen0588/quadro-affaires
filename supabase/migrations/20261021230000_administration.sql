-- Administration légère (session 5.2, EF-100) : rôle et magasins d'un utilisateur, désactivation avec
-- réassignation des affaires en cours et des tâches ouvertes, tout ou rien. Réservé aux administrateurs.

create or replace function prive.modifier_profil(p_profil uuid, p_role text, p_magasins uuid[], p_rubriques text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not prive.auth_est_admin() then
    raise exception 'Seuls les administrateurs modifient les utilisateurs.' using errcode = '42501';
  end if;
  if p_profil = auth.uid() and p_role is distinct from (select role from public.profil where id = p_profil) then
    raise exception 'Vous ne pouvez pas changer votre propre rôle.' using errcode = '22023';
  end if;
  if p_role not in ('gerant', 'conceptrice', 'transverse') then
    raise exception 'Rôle inconnu : %.', p_role using errcode = '22023';
  end if;
  if coalesce(array_length(p_magasins, 1), 0) = 0 then
    raise exception 'Rattachez l''utilisateur à au moins un magasin.' using errcode = '22023';
  end if;
  update public.profil
     set role = p_role,
         rubriques = case when p_role = 'transverse' then coalesce(p_rubriques, '{}') else '{}' end,
         est_admin = est_admin and p_role = 'gerant'
   where id = p_profil;
  if not found then raise exception 'Utilisateur introuvable.' using errcode = 'P0002'; end if;
  delete from public.profil_magasin where profil_id = p_profil and magasin_id <> all (p_magasins);
  insert into public.profil_magasin (profil_id, magasin_id)
  select p_profil, m from unnest(p_magasins) m on conflict do nothing;
end;
$$;

create or replace function prive.desactiver_profil(p_profil uuid, p_repreneur uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  nb_affaires int;
  nb_taches int;
  referent text;
begin
  if not prive.auth_est_admin() then
    raise exception 'Seuls les administrateurs désactivent un utilisateur.' using errcode = '42501';
  end if;
  if p_profil = auth.uid() then
    raise exception 'Vous ne pouvez pas vous désactiver vous-même.' using errcode = '22023';
  end if;
  select string_agg(p.cle, ', ') into referent
    from public.parametre p
   where p.cle in ('gerant_bpa', 'gerant_logistique', 'gerant_finance', 'responsable_r4') and p.valeur = to_jsonb(p_profil::text);
  if referent is not null then
    raise exception 'Cet utilisateur est référent (%) : désignez d''abord un autre référent dans les paramètres.', referent using errcode = '22023';
  end if;
  select count(*) into nb_affaires from public.affaire where concepteur_id = p_profil and statut in ('active', 'gagnee');
  select count(*) into nb_taches from public.tache where assignee_id = p_profil and statut = 'a_faire';
  if (nb_affaires > 0 or nb_taches > 0) and (
       p_repreneur is null or p_repreneur = p_profil
       or not exists (select 1 from public.profil r where r.id = p_repreneur and r.actif and r.role in ('gerant', 'conceptrice'))) then
    raise exception 'Choisissez à qui confier ses % affaire(s) en cours et % tâche(s) ouverte(s).', nb_affaires, nb_taches using errcode = '22023';
  end if;
  update public.affaire set concepteur_id = p_repreneur where concepteur_id = p_profil and statut in ('active', 'gagnee');
  update public.tache set assignee_id = p_repreneur where assignee_id = p_profil and statut = 'a_faire';
  update public.profil set actif = false where id = p_profil;
  if not found then raise exception 'Utilisateur introuvable.' using errcode = 'P0002'; end if;
  return jsonb_build_object('affaires', nb_affaires, 'taches', nb_taches);
end;
$$;

create or replace function public.modifier_profil(p_profil uuid, p_role text, p_magasins uuid[], p_rubriques text[])
returns void language sql security invoker set search_path = '' as $$ select prive.modifier_profil(p_profil, p_role, p_magasins, p_rubriques); $$;
create or replace function public.desactiver_profil(p_profil uuid, p_repreneur uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select prive.desactiver_profil(p_profil, p_repreneur); $$;

revoke all on function prive.modifier_profil(uuid, text, uuid[], text[]), prive.desactiver_profil(uuid, uuid),
  public.modifier_profil(uuid, text, uuid[], text[]), public.desactiver_profil(uuid, uuid) from public, anon;
grant execute on function prive.modifier_profil(uuid, text, uuid[], text[]), prive.desactiver_profil(uuid, uuid),
  public.modifier_profil(uuid, text, uuid[], text[]), public.desactiver_profil(uuid, uuid) to authenticated, service_role;
