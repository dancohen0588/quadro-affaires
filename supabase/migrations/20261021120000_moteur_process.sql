-- Moteur de process côté base (session 2.1, sections 7 et 8.1).
--
-- Le moteur pur (src/lib/process/moteur.ts) décide ; la base applique ses effets d'un bloc :
--   public.appliquer_effets(affaire, effets, ouvertes) → prive.appliquer_effets (SECURITY DEFINER).
-- La fonction contrôle elle-même les droits (section 12), vérifie que les étapes ouvertes n'ont pas
-- changé depuis la lecture (deux validations simultanées), puis écrit étapes, tâches, RDV et statut.
-- Elle passe par le propriétaire des tables : la responsable R4 peut ainsi ouvrir RELANCE_AVIS ou
-- ARCHIVAGE après son R4, ce que ses droits directs ne permettent pas.
--
-- RG-01 est aussi gardée par trigger : aucune écriture ne peut marquer COMMANDE_AGEM « faite » sans
-- acompte 1 reçu, même hors de l'application (seule la clé secrète passe : seed, reprise d'historique).

-- ── RG-01 ──────────────────────────────────────────────────────────────────────────────────────
create or replace function prive.acompte_1_recu(a uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.affaire x
      join public.echeance e on e.vente_id = x.vente_id
     where x.id = a and e.type = 'acompte_1' and e.recu_le is not null);
$$;

create or replace function prive.garde_acompte_1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etape_code = 'COMMANDE_AGEM' and new.statut = 'faite'
     and (tg_op = 'INSERT' or old.statut is distinct from 'faite')
     and auth.uid() is not null
     and not prive.acompte_1_recu(new.affaire_id) then
    raise exception 'La commande AGEM attend l''acompte 1 (RG-01).' using errcode = 'P0001', hint = 'bloquee_acompte_1';
  end if;
  return new;
end;
$$;
create trigger etape_garde_acompte_1 before insert or update on public.etape_instance
  for each row execute function prive.garde_acompte_1();

-- ── Résolution des rôles du process (section 7.2) ──────────────────────────────────────────────
-- concepteur → concepteur de l'affaire ; autres rôles → référent de la table parametre ;
-- référent non désigné → concepteur de l'affaire (la tâche n'est jamais perdue).
create or replace function prive.profil_du_role(a uuid, role text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case when role = 'concepteur' then null
         else (select (p.valeur #>> '{}')::uuid from public.parametre p where p.cle = role and jsonb_typeof(p.valeur) = 'string') end,
    (select x.concepteur_id from public.affaire x where x.id = a));
$$;

-- ── Application des effets ─────────────────────────────────────────────────────────────────────
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

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;

-- Point d'entrée de l'API : SECURITY INVOKER, il ne fait que déléguer (pas de SECURITY DEFINER exposé).
create or replace function public.appliquer_effets(affaire_id uuid, effets jsonb, ouvertes text[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select prive.appliquer_effets(affaire_id, effets, ouvertes);
$$;
revoke all on function public.appliquer_effets(uuid, jsonb, text[]) from public, anon;
grant execute on function public.appliquer_effets(uuid, jsonb, text[]) to authenticated, service_role;
