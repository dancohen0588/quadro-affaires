-- Indicateurs de pilotage (section 10, KPI-01 à KPI-10) et alertes (section 8.4, RG-20 à RG-29).
-- Définitions : docs/indicateurs.md. Toutes les vues sont en security_invoker : elles ne montrent que ce que
-- la RLS laisse voir à la personne connectée. « Aujourd'hui » vient de prive.app_today() (horloge de démo).

-- ── Calendrier (même règle que src/lib/rules/calendrier.ts) ───────────────────────────────────
-- Dimanche de Pâques, algorithme de Meeus.
create or replace function prive.paques(p_annee integer)
returns date language plpgsql immutable set search_path = '' as $$
declare
  a int := p_annee % 19; b int := p_annee / 100; c int := p_annee % 100;
  d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  return make_date(p_annee, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- Les 11 jours fériés de France métropolitaine.
create or replace function prive.est_ferie(p_jour date)
returns boolean language sql immutable set search_path = '' as $$
  select to_char(p_jour, 'MM-DD') in ('01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25')
      or p_jour - prive.paques(extract(year from p_jour)::int) in (1, 39, 50);
$$;

create or replace function prive.est_jour_ouvre(p_jour date)
returns boolean language sql immutable set search_path = '' as $$
  select extract(isodow from p_jour) < 6 and not prive.est_ferie(p_jour);
$$;

-- Jours ouvrés écoulés après a, jusqu'à b inclus (0 si b <= a). Retards RG-21 à RG-23.
create or replace function prive.jours_ouvres_ecoules(p_a date, p_b date)
returns integer language sql immutable set search_path = '' as $$
  select count(*)::int
    from generate_series((p_a + 1)::timestamp, p_b::timestamp, interval '1 day') as j(jour)
   where prive.est_jour_ouvre(j.jour::date);
$$;

-- Seuil de parametre.seuils (sections 8.4 et 8.5).
create or replace function prive.seuil(p_cle text)
returns integer language sql stable security definer set search_path = '' as $$
  select (p.valeur ->> p_cle)::int from public.parametre p where p.cle = 'seuils';
$$;

-- Concepteur d'une vente : celui de la première affaire rattachée.
create or replace function prive.concepteur_vente(p_vente uuid)
returns uuid language sql stable set search_path = '' as $$
  select a.concepteur_id from public.affaire a where a.vente_id = p_vente order by a.created_at, a.id limit 1;
$$;

-- Première affaire d'une vente, à laquelle on rattache une alerte de règlement.
create or replace function prive.affaire_vente(p_vente uuid)
returns uuid language sql stable set search_path = '' as $$
  select a.id from public.affaire a where a.vente_id = p_vente order by a.created_at, a.id limit 1;
$$;

revoke all on function prive.paques(integer), prive.est_ferie(date), prive.est_jour_ouvre(date),
  prive.jours_ouvres_ecoules(date, date), prive.seuil(text), prive.concepteur_vente(uuid), prive.affaire_vente(uuid)
  from public, anon;
grant execute on function prive.paques(integer), prive.est_ferie(date), prive.est_jour_ouvre(date),
  prive.jours_ouvres_ecoules(date, date), prive.seuil(text), prive.concepteur_vente(uuid), prive.affaire_vente(uuid)
  to authenticated, service_role;

-- ── Périodes ─────────────────────────────────────────────────────────────────────────────────
create view public.kpi_periodes with (security_invoker = true) as
  with j as (select prive.app_today() as t, extract(isodow from prive.app_today())::int as dow)
  select p.ordre, p.code, p.libelle, p.debut, p.fin
    from j, lateral (values
      (1, 'semaine', 'Cette semaine', j.t - (j.dow - 1), j.t),
      (2, 'semaine_precedente', 'Semaine dernière', j.t - (j.dow - 1) - 7, j.t - j.dow),
      (3, 'mois', 'Ce mois', date_trunc('month', j.t::timestamp)::date, j.t),
      (4, 'mois_precedent', 'Mois dernier', (date_trunc('month', j.t::timestamp) - interval '1 month')::date,
          date_trunc('month', j.t::timestamp)::date - 1),
      (5, 'trimestre', 'Ce trimestre', date_trunc('quarter', j.t::timestamp)::date, j.t),
      (6, 'annee', 'Cette année', date_trunc('year', j.t::timestamp)::date, j.t),
      (7, 'douze_mois', '12 derniers mois', (j.t::timestamp - interval '12 months')::date + 1, j.t)
    ) as p(ordre, code, libelle, debut, fin);

-- ── KPI-01, KPI-02 : CA signé, nombre de ventes ───────────────────────────────────────────────
create view public.kpi_ventes with (security_invoker = true) as
  select p.code as periode, v.magasin_id, prive.concepteur_vente(v.id) as concepteur_id,
         count(*)::int as nb_ventes, sum(v.montant_ht_cts)::bigint as ca_ht_cts, sum(v.montant_ttc_cts)::bigint as ca_ttc_cts
    from public.vente v
    join public.kpi_periodes p on v.date_signature between p.debut and p.fin
   group by 1, 2, 3;

-- ── KPI-03 : flux entrant ────────────────────────────────────────────────────────────────────
create view public.kpi_flux_entrant with (security_invoker = true) as
  select p.code as periode, k.magasin_id,
         coalesce(k.created_by, (select a.concepteur_id from public.affaire a where a.client_id = k.id order by a.created_at limit 1)) as concepteur_id,
         count(*)::int as nb_clients, (count(*) filter (where k.cnq))::int as nb_cnq
    from public.client k
    join public.kpi_periodes p on (k.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1, 2, 3;

-- ── KPI-04 : potentiel de CA (affaires actives en phase conception ou vente, photo du jour) ────
create view public.kpi_potentiel with (security_invoker = true) as
  select a.magasin_id, a.concepteur_id, count(*)::int as nb_affaires,
         coalesce(sum(a.montant_devis_ht_cts), 0)::bigint as potentiel_ht_cts,
         count(a.montant_devis_ht_cts)::int as nb_chiffrees
    from public.affaire a
   where a.statut = 'active'
     and exists (select 1 from public.etape_instance e
                  where e.affaire_id = a.id and e.statut = 'en_cours' and e.branche = 'principale'
                    and e.phase_code in ('conception', 'vente'))
   group by 1, 2;

-- ── KPI-05 : transformation (premier R3 fait dans la période, part vendue à ce jour) ────────────
create view public.kpi_transformation with (security_invoker = true) as
  with premier as (
    select r.affaire_id, min((r.debut at time zone 'Europe/Paris')::date) as jour
      from public.rdv r
     where r.type = 'R3' and r.statut = 'fait' and r.affaire_id is not null
     group by 1)
  select p.code as periode, a.magasin_id, a.concepteur_id,
         count(*)::int as nb_r3, (count(*) filter (where a.vente_id is not null))::int as nb_vendues
    from premier pr
    join public.affaire a on a.id = pr.affaire_id
    join public.kpi_periodes p on pr.jour between p.debut and p.fin
   group by 1, 2, 3;

-- ── KPI-06 : RDV faits par type ──────────────────────────────────────────────────────────────
create view public.kpi_rdv with (security_invoker = true) as
  select p.code as periode, coalesce(a.magasin_id, k.magasin_id) as magasin_id, r.profil_id as concepteur_id, r.type,
         count(*)::int as nb
    from public.rdv r
    left join public.affaire a on a.id = r.affaire_id
    left join public.client k on k.id = r.client_id
    join public.kpi_periodes p on (r.debut at time zone 'Europe/Paris')::date between p.debut and p.fin
   where r.statut = 'fait' and r.type in ('R0', 'R1', 'R2', 'R3')
   group by 1, 2, 3, 4;

-- ── KPI-08 : règlements (photo du jour) ──────────────────────────────────────────────────────
create view public.kpi_reglements with (security_invoker = true) as
  select v.magasin_id, prive.concepteur_vente(v.id) as concepteur_id,
         coalesce(sum(e.montant_prevu_cts) filter (where e.date_attendue between j.t and j.t + 30), 0)::bigint as attendu_30j_cts,
         (count(*) filter (where e.date_attendue between j.t and j.t + 30))::int as nb_attendus_30j,
         coalesce(sum(e.montant_prevu_cts) filter (where e.date_attendue < j.t), 0)::bigint as retard_cts,
         (count(*) filter (where e.date_attendue < j.t))::int as nb_retard
    from public.echeance e
    join public.vente v on v.id = e.vente_id
    cross join (select prive.app_today() as t) j
   where e.recu_le is null and e.montant_prevu_cts > 0
   group by 1, 2;

-- ── KPI-09 : délai R1 → vente ────────────────────────────────────────────────────────────────
create view public.kpi_delai_r1_vente with (security_invoker = true) as
  select p.code as periode, v.magasin_id, prive.concepteur_vente(v.id) as concepteur_id,
         count(*)::int as nb_ventes, sum(v.date_signature - r1.jour)::int as total_jours
    from public.vente v
    cross join lateral (
      select min((r.debut at time zone 'Europe/Paris')::date) as jour
        from public.rdv r join public.affaire a on a.id = r.affaire_id
       where a.vente_id = v.id and r.type = 'R1' and r.statut = 'fait') r1
    join public.kpi_periodes p on v.date_signature between p.debut and p.fin
   where r1.jour is not null
   group by 1, 2, 3;

-- ── KPI-10 : motifs de non-vente ─────────────────────────────────────────────────────────────
create view public.kpi_motifs with (security_invoker = true) as
  select p.code as periode, a.magasin_id, a.concepteur_id, a.motif_perte as motif, count(*)::int as nb
    from public.affaire a
    cross join lateral (
      select coalesce(
        (select max((e.fin_at at time zone 'Europe/Paris')::date) from public.etape_instance e
          where e.affaire_id = a.id and e.motif is not null and e.fin_at is not null),
        (select max((r.debut at time zone 'Europe/Paris')::date) from public.rdv r
          where r.affaire_id = a.id and r.statut = 'fait'),
        (a.created_at at time zone 'Europe/Paris')::date) as jour) d
    join public.kpi_periodes p on d.jour between p.debut and p.fin
   where a.statut in ('perdue', 'abandonnee')
   group by 1, 2, 3, 4;

-- ── Affaires en cours et inactives (RG-27) ───────────────────────────────────────────────────
create view public.kpi_en_cours with (security_invoker = true) as
  select a.magasin_id, a.concepteur_id, count(*)::int as nb_affaires,
         (count(*) filter (where prive.app_today() - (a.derniere_activite_at at time zone 'Europe/Paris')::date
                                 > prive.seuil('inactivite_jours')))::int as nb_inactives
    from public.affaire a
   where a.statut in ('active', 'gagnee')
   group by 1, 2;

-- ── Alertes RG-20 à RG-29 (EF-91, KPI-07) ────────────────────────────────────────────────────
create view public.alertes with (security_invoker = true) as
  with j as (select prive.app_today() as t)
  -- RG-20 : R1 fait, pas encore de présentation ni de vente après N jours (D17 : > 2 semaines entre R1 et R3).
  select a.id as affaire_id, a.magasin_id, a.concepteur_id, 'RG-20'::text as regle, 1 as gravite, r1.jour as depuis,
         null::bigint as montant_cts,
         format('R1 fait il y a %s jours, pas encore de présentation', j.t - r1.jour) as detail, null::uuid as echeance_id
    from public.affaire a
    cross join j
    cross join lateral (select min((r.debut at time zone 'Europe/Paris')::date) as jour from public.rdv r
                         where r.affaire_id = a.id and r.type = 'R1' and r.statut = 'fait') r1
   where a.statut = 'active' and a.vente_id is null
     and j.t - r1.jour > prive.seuil('retard_commerce_jours')
     and not exists (select 1 from public.rdv r where r.affaire_id = a.id and r.type = 'R3' and r.statut = 'fait')
  union all
  -- RG-21 : confirmation AGEM reçue, BPA non donné.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-21', 1, c.confirmation_recue_le, null,
         format('BPA non donné, confirmation AGEM reçue il y a %s jours ouvrés', prive.jours_ouvres_ecoules(c.confirmation_recue_le, j.t)), null
    from public.commande_fournisseur c
    join public.affaire a on a.id = c.affaire_id
    cross join j
   where c.fournisseur = 'AGEM' and c.confirmation_recue_le is not null and c.bpa_donne_le is null
     and a.statut in ('active', 'gagnee')
     and prive.jours_ouvres_ecoules(c.confirmation_recue_le, j.t) > prive.seuil('retard_bpa_jours_ouvres')
  union all
  -- RG-22 : commande AGEM envoyée sans ARC.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-22', 1, c.envoyee_le, null,
         format('ARC AGEM attendu depuis %s jours ouvrés', prive.jours_ouvres_ecoules(c.envoyee_le, j.t)), null
    from public.commande_fournisseur c
    join public.affaire a on a.id = c.affaire_id
    cross join j
   where c.fournisseur = 'AGEM' and c.envoyee_le is not null and c.arc_recu_le is null and c.statut <> 'livree'
     and a.statut in ('active', 'gagnee')
     and prive.jours_ouvres_ecoules(c.envoyee_le, j.t) > prive.seuil('arc_non_recu_jours_ouvres')
  union all
  -- RG-23 : commande autre fournisseur envoyée sans AR.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-23', 2, c.envoyee_le, null,
         format('AR %s attendu depuis %s jours ouvrés', c.fournisseur, prive.jours_ouvres_ecoules(c.envoyee_le, j.t)), null
    from public.commande_fournisseur c
    join public.affaire a on a.id = c.affaire_id
    cross join j
   where c.fournisseur <> 'AGEM' and c.envoyee_le is not null and c.ar_recu_le is null and c.statut <> 'livree'
     and a.statut in ('active', 'gagnee')
     and prive.jours_ouvres_ecoules(c.envoyee_le, j.t) > prive.seuil('ar_non_recu_jours_ouvres')
  union all
  -- RG-24 à RG-26 : règlements non reçus, rattachés à la première affaire de la vente.
  select a.id, v.magasin_id, a.concepteur_id, x.regle, x.gravite, x.depuis, e.montant_prevu_cts,
         format(x.texte, j.t - x.depuis), e.id
    from public.echeance e
    join public.vente v on v.id = e.vente_id
    join public.affaire a on a.id = prive.affaire_vente(v.id)
    cross join j
    cross join lateral (select * from (values
        ('acompte_1', 'RG-24', 1, 'Acompte 1 non reçu, %s jours après la signature', v.date_signature, prive.seuil('acompte_1_non_recu_jours')),
        ('acompte_2', 'RG-25', 1, 'Acompte 2 non reçu, attendu depuis %s jours', e.date_attendue, prive.seuil('acompte_2_non_recu_jours')),
        ('solde', 'RG-26', 2, 'Solde non reçu, attendu depuis %s jours', e.date_attendue, prive.seuil('solde_non_recu_jours'))
      ) as r(type, regle, gravite, texte, depuis, seuil) where r.type = e.type) x
   where e.recu_le is null and e.montant_prevu_cts > 0 and x.depuis is not null
     and j.t - x.depuis > x.seuil
  union all
  -- RG-27 : affaire en cours sans activité depuis N jours.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-27', 2, (a.derniere_activite_at at time zone 'Europe/Paris')::date, null,
         format('Sans mouvement depuis %s jours', j.t - (a.derniere_activite_at at time zone 'Europe/Paris')::date), null
    from public.affaire a
    cross join j
   where a.statut in ('active', 'gagnee')
     and j.t - (a.derniere_activite_at at time zone 'Europe/Paris')::date > prive.seuil('inactivite_jours')
  union all
  -- RG-28 : pose confirmée dans N jours au plus, dossier de pose pas fait.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-28', 1, pl.date_pose_confirmee - prive.seuil('dossier_pose_incomplet_jours'), null,
         case when pl.date_pose_confirmee = j.t then 'Dossier de pose incomplet, pose aujourd''hui'
              else format('Dossier de pose incomplet, pose dans %s jour%s', pl.date_pose_confirmee - j.t,
                          case when pl.date_pose_confirmee - j.t > 1 then 's' else '' end) end, null
    from public.planning pl
    join public.affaire a on a.vente_id = pl.vente_id
    cross join j
   where pl.statut = 'confirmee' and pl.date_pose_confirmee is not null
     and pl.date_pose_confirmee between j.t and j.t + prive.seuil('dossier_pose_incomplet_jours')
     and a.statut = 'gagnee'
     and not exists (select 1 from public.etape_instance e
                      where e.affaire_id = a.id and e.etape_code = 'DOSSIER_POSE' and e.statut = 'faite')
  union all
  -- RG-29 : la semaine annoncée par l'ARC dépasse la semaine de livraison confirmée.
  select a.id, a.magasin_id, a.concepteur_id, 'RG-29', 1, coalesce(c.arc_recu_le, c.ar_recu_le, c.envoyee_le), null,
         format('Livraison menacée : %s annonce %s, livraison confirmée %s', c.fournisseur,
                substr(c.semaine_annoncee, 6), substr(pl.semaine_livraison_confirmee, 6)), null
    from public.commande_fournisseur c
    join public.affaire a on a.id = c.affaire_id
    join public.planning pl on pl.vente_id = a.vente_id
   where c.semaine_annoncee is not null and c.statut <> 'livree'
     and pl.statut = 'confirmee' and pl.semaine_livraison_confirmee is not null
     and c.semaine_annoncee > pl.semaine_livraison_confirmee
     and a.statut = 'gagnee';

-- ── Droits : lecture seule pour les comptes connectés, jamais anon ───────────────────────────
do $$
declare v text;
begin
  foreach v in array array['kpi_periodes', 'kpi_ventes', 'kpi_flux_entrant', 'kpi_potentiel', 'kpi_transformation', 'kpi_rdv',
                           'kpi_reglements', 'kpi_delai_r1_vente', 'kpi_motifs', 'kpi_en_cours', 'alertes'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    execute format('grant select on public.%I to authenticated, service_role', v);
  end loop;
end;
$$;

-- Index utiles aux vues (RDV par affaire et type, commandes en attente).
create index if not exists rdv_affaire_type_idx on public.rdv (affaire_id, type) where statut = 'fait';
create index if not exists etape_instance_dossier_pose_idx on public.etape_instance (affaire_id) where etape_code = 'DOSSIER_POSE';
