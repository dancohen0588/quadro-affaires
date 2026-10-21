-- Administration (EF-100, EF-101) : ajout d'un utilisateur, consultation et modification des magasins et sociétés.
--
-- Ajout : le compte d'authentification est préparé par l'AuthAdapter (démo : compte à mot de passe commun des
-- personnages ; B1 : compte sans mot de passe, rattaché à la première connexion Microsoft par l'adresse),
-- puis public.creer_profil écrit le profil et ses magasins, tout ou rien, réservé aux administrateurs.
-- Le profil doit porter l'adresse du compte : on ne rattache jamais un profil au compte de quelqu'un d'autre.

create or replace function prive.creer_profil(
  p_id uuid, p_prenom text, p_nom text, p_email text, p_initiales text, p_role text, p_magasins uuid[], p_rubriques text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not prive.auth_est_admin() then
    raise exception 'Seuls les administrateurs ajoutent un utilisateur.' using errcode = '42501';
  end if;
  if p_role not in ('gerant', 'conceptrice', 'transverse') then
    raise exception 'Rôle inconnu : %.', p_role using errcode = '22023';
  end if;
  if length(trim(coalesce(p_prenom, ''))) = 0 then
    raise exception 'Indiquez le prénom.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_magasins, 1), 0) = 0 then
    raise exception 'Rattachez l''utilisateur à au moins un magasin.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_magasins) m where not exists (select 1 from public.magasin where id = m)) then
    raise exception 'Magasin inconnu.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_id and lower(u.email) = lower(trim(p_email))) then
    raise exception 'Le compte de connexion de cet utilisateur est introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profil where lower(email) = lower(trim(p_email)) or id = p_id) then
    raise exception 'Cette adresse est déjà utilisée par un autre utilisateur.' using errcode = '23505';
  end if;

  insert into public.profil (id, prenom, nom, email, role, est_admin, rubriques, initiales)
  values (p_id, trim(p_prenom), trim(coalesce(p_nom, '')), lower(trim(p_email)), p_role,
          p_role = 'gerant', -- les gérants administrent (section 3)
          case when p_role = 'transverse' then coalesce(p_rubriques, '{}') else '{}' end, p_initiales);
  insert into public.profil_magasin (profil_id, magasin_id)
  select p_id, m from (select distinct unnest(p_magasins) as m) s;
  return p_id;
end;
$$;

create or replace function public.creer_profil(
  p_id uuid, p_prenom text, p_nom text, p_email text, p_initiales text, p_role text, p_magasins uuid[], p_rubriques text[]
) returns uuid language sql security invoker set search_path = '' as $$
  select prive.creer_profil(p_id, p_prenom, p_nom, p_email, p_initiales, p_role, p_magasins, p_rubriques);
$$;

revoke all on function prive.creer_profil(uuid, text, text, text, text, text, uuid[], text[]),
  public.creer_profil(uuid, text, text, text, text, text, uuid[], text[]) from public, anon;
grant execute on function prive.creer_profil(uuid, text, text, text, text, text, uuid[], text[]),
  public.creer_profil(uuid, text, text, text, text, text, uuid[], text[]) to authenticated, service_role;

-- ── Magasins et sociétés (EF-101) ────────────────────────────────────────────────────────────────
-- La RLS (session 1.2) réserve déjà l'écriture aux administrateurs. On limite en plus les colonnes modifiables
-- depuis l'application : les codes (AIX, VAL, CIO… repris dans les dossiers PCloud et l'import CSV) et le dossier
-- racine PCloud (bloc B3) ne changent pas depuis l'écran. La clé secrète (seed) garde tous les droits ; l'ajout
-- d'un magasin reste ouvert aux administrateurs par la RLS (aucun écran : un nouveau showroom se prépare avec nous).
revoke update on public.societe, public.magasin from authenticated;
grant update (nom, siren) on public.societe to authenticated;
grant update (nom, societe_id, adresse, telephone) on public.magasin to authenticated;

alter table public.societe add constraint societe_nom_renseigne check (length(trim(nom)) > 0);
alter table public.magasin add constraint magasin_nom_renseigne check (length(trim(nom)) > 0);
