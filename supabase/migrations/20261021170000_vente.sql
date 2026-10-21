-- Vente, échéancier et planning (session 3.2 : EF-50, EF-51, EF-60, EF-61, RG-08, RG-10 à RG-12).
--
-- public.creer_vente écrit d'un bloc : la vente, son échéancier (somme = TTC, RG-11), le passage des
-- affaires en « gagnee » avec leur rattachement (RG-08), les effets du moteur (VENTE validée, ACOMPTE_1
-- ouvert), la demande de planning et la tâche de confirmation du gérant logistique (EF-60).
-- public.confirmer_planning : réponse du gérant (EF-61) ; une confirmation recale les dates attendues de
-- l'acompte 2 (lundi de la semaine de livraison) et du solde (date de pose), RG-12.

-- Nouvel effet « faire_taches » : une action qui accomplit elle-même des tâches de l'étape les marque faites
-- avant la fermeture (sinon RG-05 les annulerait et les signalerait comme non faites).
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

      when 'faire_taches' then
        -- Tâches accomplies par l'action elle-même (ex. « Créer la vente » quand on crée la vente).
        update public.tache t
           set statut = 'faite', fait_le = prive.app_now(), fait_par = auth.uid()
          from public.etape_instance ei
         where t.etape_instance_id = ei.id and t.statut = 'a_faire'
           and ei.affaire_id = p_affaire and ei.etape_code = e ->> 'etape' and ei.iteration = (e ->> 'iteration')::int
           and t.modele_code in (select jsonb_array_elements_text(e -> 'codes'));

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

create or replace function prive.creer_vente(p_vente jsonb, p_echeances jsonb, p_affaires jsonb, p_planning jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := (p_vente ->> 'client_id')::uuid;
  v_magasin uuid := (p_vente ->> 'magasin_id')::uuid;
  v_ttc integer := (p_vente ->> 'montant_ttc_cts')::integer;
  v_id uuid;
  a jsonb;
  x public.affaire;
  premiere uuid;
  somme bigint;
begin
  if prive.auth_role() is null or prive.auth_role() not in ('gerant', 'conceptrice') then
    raise exception 'Seuls les gérants et les conceptrices créent une vente.' using errcode = '42501';
  end if;
  if not prive.peut_modifier_magasin(v_magasin) then
    raise exception 'Vous ne pouvez pas créer de vente dans ce magasin.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_affaires) is distinct from 'array' or jsonb_array_length(p_affaires) = 0 then
    raise exception 'Une vente regroupe au moins une affaire (RG-08).' using errcode = '22023';
  end if;

  -- RG-08 : affaires du même client, toutes actives.
  for a in select * from jsonb_array_elements(p_affaires) loop
    select * into x from public.affaire where id = (a ->> 'id')::uuid for update;
    if not found or x.client_id is distinct from v_client then
      raise exception 'Les affaires d''une vente doivent appartenir au même client (RG-08).' using errcode = '22023';
    end if;
    if x.statut <> 'active' or x.vente_id is not null then
      raise exception 'L''affaire % n''est plus active (RG-08).', x.libelle using errcode = '22023';
    end if;
    premiere := coalesce(premiere, x.id);
  end loop;

  -- RG-11 : la somme des échéances égale le montant TTC.
  select coalesce(sum((e ->> 'montant_prevu_cts')::bigint), 0) into somme from jsonb_array_elements(p_echeances) e;
  if somme <> v_ttc then
    raise exception 'La somme des échéances (% cts) diffère du montant TTC (% cts) (RG-11).', somme, v_ttc using errcode = '22023';
  end if;

  insert into public.vente (client_id, magasin_id, date_signature, montant_ht_cts, montant_ttc_cts, financement, gesteos_devis_ref)
  values (v_client, v_magasin, (p_vente ->> 'date_signature')::date, (p_vente ->> 'montant_ht_cts')::integer, v_ttc,
          coalesce(p_vente ->> 'financement', 'aucun'), nullif(p_vente ->> 'gesteos_devis_ref', ''))
  returning id into v_id;

  insert into public.echeance (vente_id, type, ordre, pourcentage, montant_prevu_cts, date_attendue, mode, commentaire)
  select v_id, e ->> 'type', (e ->> 'ordre')::integer, (e ->> 'pourcentage')::numeric, (e ->> 'montant_prevu_cts')::integer,
         (e ->> 'date_attendue')::date, nullif(e ->> 'mode', ''), nullif(e ->> 'commentaire', '')
    from jsonb_array_elements(p_echeances) e;

  for a in select * from jsonb_array_elements(p_affaires) loop
    update public.affaire set vente_id = v_id, statut = 'gagnee' where id = (a ->> 'id')::uuid;
    perform prive.appliquer_effets((a ->> 'id')::uuid, coalesce(a -> 'effets', '[]'),
                                   array(select jsonb_array_elements_text(coalesce(a -> 'ouvertes', '[]'))));
  end loop;

  -- EF-60 : demande de planning et tâche du gérant logistique.
  if p_planning is not null then
    insert into public.planning (vente_id, semaine_livraison_souhaitee, date_pose_souhaitee, statut, demande_par)
    values (v_id, nullif(p_planning ->> 'semaine_livraison_souhaitee', ''), (nullif(p_planning ->> 'date_pose_souhaitee', ''))::date,
            'demandee', auth.uid());
    insert into public.tache (affaire_id, modele_code, titre, assignee_id, echeance, origine)
    values (premiere, 'confirmer_planning', 'Confirmer le planning de livraison et de pose',
            prive.profil_du_role(premiere, 'gerant_logistique'), prive.app_today() + 2, 'process');
  end if;
  return v_id;
end;
$$;

create or replace function prive.confirmer_planning(p_vente uuid, p_statut text, p_semaine text, p_date_pose date,
                                                    p_poseur text, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(prive.auth_role() = 'gerant', false) then
    raise exception 'Seul un gérant peut confirmer ou décaler un planning.' using errcode = '42501';
  end if;
  if p_statut not in ('confirmee', 'decalee') then
    raise exception 'Réponse inconnue : %.', p_statut using errcode = '22023';
  end if;
  update public.planning
     set statut = p_statut, semaine_livraison_confirmee = p_semaine, date_pose_confirmee = p_date_pose,
         poseur = nullif(p_poseur, ''), commentaire = nullif(p_commentaire, ''), confirme_par = auth.uid()
   where vente_id = p_vente;
  if not found then
    raise exception 'Aucune demande de planning pour cette vente.' using errcode = 'P0002';
  end if;

  if p_statut = 'confirmee' then
    -- RG-12 : acompte 2 attendu à la livraison (lundi de la semaine), solde à la pose.
    update public.echeance set date_attendue = to_date(replace(p_semaine, '-S', '-'), 'IYYY-IW')
     where vente_id = p_vente and type = 'acompte_2' and recu_le is null and p_semaine is not null;
    update public.echeance set date_attendue = p_date_pose
     where vente_id = p_vente and type = 'solde' and recu_le is null and p_date_pose is not null;
  end if;

  update public.tache t set statut = 'faite', fait_le = prive.app_now(), fait_par = auth.uid()
    from public.affaire x
   where t.affaire_id = x.id and x.vente_id = p_vente and t.modele_code = 'confirmer_planning' and t.statut = 'a_faire';
end;
$$;

revoke all on all functions in schema prive from public, anon;
grant execute on all functions in schema prive to authenticated, service_role;

create or replace function public.creer_vente(vente jsonb, echeances jsonb, affaires jsonb, planning jsonb)
returns uuid
language sql security invoker set search_path = '' as $$ select prive.creer_vente(vente, echeances, affaires, planning); $$;

create or replace function public.confirmer_planning(vente_id uuid, statut text, semaine text, date_pose date, poseur text, commentaire text)
returns void
language sql security invoker set search_path = '' as $$
  select prive.confirmer_planning(vente_id, statut, semaine, date_pose, poseur, commentaire);
$$;

revoke all on function public.creer_vente(jsonb, jsonb, jsonb, jsonb), public.confirmer_planning(uuid, text, text, date, text, text) from public, anon;
grant execute on function public.creer_vente(jsonb, jsonb, jsonb, jsonb), public.confirmer_planning(uuid, text, text, date, text, text)
  to authenticated, service_role;
