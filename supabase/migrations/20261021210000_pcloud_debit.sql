-- PCloud simulé et débit AGEM (session 5.1, sections 7.3, 13.3, 13.4, KPI-11).

-- Modèle « NOUVEAU CLIENT » : liste provisoire des sous-dossiers 01 à 12, déduite des dossiers cités par le
-- process (section 7.3). Les intitulés 02, 04 et 09 sont à corriger quand Benjamin fournit le vrai modèle.
insert into public.parametre (cle, valeur) values ('pcloud_modele', '[
  "01 - Données d''Entrée",
  "01 - Données d''Entrée/Relevés-Métrés",
  "02 - Plans et visuels (à confirmer)",
  "03 - BDC",
  "04 - Devis (à confirmer)",
  "05 - Commande AGEM et autres fournisseurs/Commande AGEM",
  "05 - Commande AGEM et autres fournisseurs/Commande autres fournisseurs",
  "06 - ARC-BPA AGEM et autres fournisseurs/ARC-BPA AGEM/AR",
  "06 - ARC-BPA AGEM et autres fournisseurs/ARC-BPA AGEM/02-BPA",
  "06 - ARC-BPA AGEM et autres fournisseurs/AR AUTRES FOURNISSEURS",
  "07 - Livraison",
  "08 - Pose",
  "09 - Factures (à confirmer)",
  "10 - SAV",
  "11 - Compléments",
  "12 - Photos Finales"
]') on conflict (cle) do nothing;

-- KPI-11 : marge estimée = montant HT des ventes − prix d'achat des commandes de leurs affaires,
-- sur les ventes de la période dont au moins une commande porte un prix d'achat (débit lu ou saisi).
create view public.kpi_marge with (security_invoker = true) as
  select p.code as periode, v.magasin_id, prive.concepteur_vente(v.id) as concepteur_id,
         count(*)::int as nb_ventes, sum(v.montant_ht_cts)::bigint as ca_ht_cts, sum(a.achats)::bigint as achats_cts
    from public.vente v
    cross join lateral (
      select sum(c.prix_achat_cts) as achats
        from public.commande_fournisseur c join public.affaire x on x.id = c.affaire_id
       where x.vente_id = v.id) a
    join public.kpi_periodes p on v.date_signature between p.debut and p.fin
   where a.achats is not null
   group by 1, 2, 3;

revoke all on public.kpi_marge from public, anon, authenticated;
grant select on public.kpi_marge to authenticated, service_role;
