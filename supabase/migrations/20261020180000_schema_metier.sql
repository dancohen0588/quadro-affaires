-- Schéma métier (docs/conception.md, section 6.2).
-- Conventions (6.1) : uuid, created_at / updated_at / created_by sur chaque table, montants en centimes (integer),
-- dates métier en date, « maintenant » = prive.app_now(), énumérations en text + check, suppression logique.

create extension if not exists pg_trgm with schema extensions;

-- ── process_version ────────────────────────────────────────────────────────────────────────────
create table public.process_version (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  definition jsonb not null,
  active boolean not null default false,
  publiee_le timestamptz,
  publiee_par uuid references public.profil (id) on delete set null,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);
-- Une seule version active à la fois (6.2).
create unique index process_version_une_active on public.process_version (active) where active;

-- ── client ─────────────────────────────────────────────────────────────────────────────────────
create table public.client (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'particulier' check (type in ('particulier', 'professionnel')),
  raison_sociale text,
  nom text not null check (length(trim(nom)) > 0),
  prenom text,
  telephone text,
  email text,
  adresse text,
  code_postal text,
  ville text,
  cnq boolean not null default false,
  source text,
  magasin_id uuid not null references public.magasin (id),
  gesteos_ref text,
  rappel_convenu_le date,
  archive_le date,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  constraint client_pro_raison_sociale check (type <> 'professionnel' or length(trim(coalesce(raison_sociale, ''))) > 0),
  constraint client_cnq_sans_coordonnees check (not cnq or (telephone is null and email is null))
);
create index client_magasin_idx on public.client (magasin_id);
create index client_created_by_idx on public.client (created_by);
-- Recherche globale (section 9) et détection des clients qui reviennent (EF-21).
create index client_nom_trgm on public.client using gin (nom extensions.gin_trgm_ops);
create index client_prenom_trgm on public.client using gin (prenom extensions.gin_trgm_ops);
create index client_raison_sociale_trgm on public.client using gin (raison_sociale extensions.gin_trgm_ops);
create index client_telephone_trgm on public.client using gin (telephone extensions.gin_trgm_ops);
create index client_email_trgm on public.client using gin (email extensions.gin_trgm_ops);
-- EF-21 : pas de doublon exact nom + téléphone.
create unique index client_nom_telephone_unique on public.client (upper(nom), telephone)
  where telephone is not null and archive_le is null;

-- ── vente ──────────────────────────────────────────────────────────────────────────────────────
-- magasin_id : ajout à la spec 6.2, pour les droits par magasin et les indicateurs par magasin.
create table public.vente (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client (id),
  magasin_id uuid not null references public.magasin (id),
  date_signature date not null,
  montant_ht_cts integer not null check (montant_ht_cts >= 0),
  montant_ttc_cts integer not null check (montant_ttc_cts >= 0),
  financement text not null default 'aucun' check (financement in ('aucun', 'franfinance')),
  gesteos_devis_ref text,
  commission_saisie_le date,
  archive_le date,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  constraint vente_ttc_superieur_ht check (montant_ttc_cts >= montant_ht_cts)
);
create index vente_client_idx on public.vente (client_id);
create index vente_magasin_idx on public.vente (magasin_id);
create index vente_signature_idx on public.vente (date_signature);
create index vente_created_by_idx on public.vente (created_by);

-- ── affaire ────────────────────────────────────────────────────────────────────────────────────
create table public.affaire (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client (id),
  magasin_id uuid not null references public.magasin (id),
  concepteur_id uuid not null references public.profil (id),
  projet text not null,
  libelle text not null,
  -- RG-03 : le libellé n'est plus recalculé s'il a été modifié à la main.
  libelle_manuel boolean not null default false,
  contremarque text not null,
  statut text not null default 'active' check (statut in ('active', 'gagnee', 'perdue', 'abandonnee', 'cloturee')),
  motif_perte text,
  montant_devis_ht_cts integer check (montant_devis_ht_cts >= 0),
  process_version_id uuid not null references public.process_version (id),
  -- Résumé d'affichage uniquement (section 7.4) : jamais utilisé par la logique.
  etape_courante_code text,
  vente_id uuid references public.vente (id),
  derniere_activite_at timestamptz not null default prive.app_now(),
  pcloud_folder_id text,
  pcloud_url text,
  avis_google_obtenu_le date,
  archive_le date,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  -- RG-06 : une affaire perdue ou abandonnée a un motif.
  constraint affaire_motif_perte check (statut not in ('perdue', 'abandonnee') or length(trim(coalesce(motif_perte, ''))) > 0)
);
create index affaire_client_idx on public.affaire (client_id);
create index affaire_magasin_statut_idx on public.affaire (magasin_id, statut);
create index affaire_concepteur_idx on public.affaire (concepteur_id);
create index affaire_vente_idx on public.affaire (vente_id);
create index affaire_process_version_idx on public.affaire (process_version_id);
create index affaire_activite_idx on public.affaire (derniere_activite_at);
create index affaire_created_by_idx on public.affaire (created_by);
create index affaire_contremarque_trgm on public.affaire using gin (contremarque extensions.gin_trgm_ops);

-- ── echeance ───────────────────────────────────────────────────────────────────────────────────
create table public.echeance (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.vente (id),
  type text not null check (type in ('acompte_1', 'acompte_2', 'solde', 'autre')),
  ordre integer not null check (ordre >= 1),
  pourcentage numeric(5, 2) check (pourcentage between 0 and 100),
  montant_prevu_cts integer not null check (montant_prevu_cts >= 0),
  date_attendue date,
  mode text check (mode in ('cheque', 'cb', 'virement', 'especes', 'franfinance')),
  recu_le date,
  montant_recu_cts integer check (montant_recu_cts >= 0),
  saisi_par uuid references public.profil (id) on delete set null,
  commentaire text,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  -- RG-13 : Franfinance jamais sur l'acompte 1.
  constraint echeance_pas_franfinance_acompte_1 check (not (type = 'acompte_1' and mode = 'franfinance')),
  constraint echeance_reception_complete check ((recu_le is null) = (montant_recu_cts is null)),
  unique (vente_id, ordre)
);
create index echeance_attendue_idx on public.echeance (date_attendue) where recu_le is null;
create index echeance_saisi_par_idx on public.echeance (saisi_par);
create index echeance_created_by_idx on public.echeance (created_by);

-- ── rdv ────────────────────────────────────────────────────────────────────────────────────────
create table public.rdv (
  id uuid primary key default gen_random_uuid(),
  affaire_id uuid references public.affaire (id),
  client_id uuid not null references public.client (id),
  type text not null check (type in ('R0', 'R1', 'R2', 'R3', 'R4', 'point_technique', 'point_strategique')),
  rang integer not null default 1 check (rang >= 1),
  debut timestamptz not null,
  profil_id uuid not null references public.profil (id),
  statut text not null default 'prevu' check (statut in ('prevu', 'fait', 'annule')),
  notes text,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  constraint rdv_rang_r3 check (type = 'R3' or rang = 1)
);
create index rdv_affaire_idx on public.rdv (affaire_id);
create index rdv_client_idx on public.rdv (client_id);
create index rdv_profil_debut_idx on public.rdv (profil_id, debut);
create index rdv_created_by_idx on public.rdv (created_by);

-- ── etape_instance ─────────────────────────────────────────────────────────────────────────────
-- phase_code et branche : ajouts à la spec 6.2, copiés de la définition à l'ouverture (la version est figée, RG-04).
create table public.etape_instance (
  id uuid primary key default gen_random_uuid(),
  affaire_id uuid not null references public.affaire (id),
  etape_code text not null,
  phase_code text not null,
  branche text not null default 'principale' check (branche in ('principale', 'autres_fournisseurs', 'sav')),
  iteration integer not null default 1 check (iteration >= 1),
  statut text not null default 'a_venir' check (statut in ('a_venir', 'en_cours', 'faite', 'sautee', 'bloquee')),
  issue_code text,
  motif text,
  debut_at timestamptz,
  fin_at timestamptz,
  valide_par uuid references public.profil (id) on delete set null,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  unique (affaire_id, etape_code, iteration)
);
create index etape_instance_ouvertes_idx on public.etape_instance (affaire_id) where statut = 'en_cours';
create index etape_instance_valide_par_idx on public.etape_instance (valide_par);
create index etape_instance_created_by_idx on public.etape_instance (created_by);

-- ── tache ──────────────────────────────────────────────────────────────────────────────────────
create table public.tache (
  id uuid primary key default gen_random_uuid(),
  affaire_id uuid references public.affaire (id),
  etape_instance_id uuid references public.etape_instance (id),
  modele_code text,
  titre text not null check (length(trim(titre)) > 0),
  detail text,
  assignee_id uuid not null references public.profil (id),
  echeance date,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'faite', 'annulee')),
  origine text not null default 'libre' check (origine in ('process', 'relance', 'avis', 'alerte', 'libre')),
  optionnelle boolean not null default false,
  fait_le timestamptz,
  fait_par uuid references public.profil (id) on delete set null,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  constraint tache_faite_complete check ((statut = 'faite') = (fait_le is not null)),
  constraint tache_etape_dans_affaire check (etape_instance_id is null or affaire_id is not null)
);
-- Une tâche modèle n'est générée qu'une fois par étape ouverte.
create unique index tache_modele_unique on public.tache (etape_instance_id, modele_code)
  where etape_instance_id is not null and modele_code is not null;
create index tache_assignee_ouvertes_idx on public.tache (assignee_id, echeance) where statut = 'a_faire';
create index tache_affaire_idx on public.tache (affaire_id);
create index tache_fait_par_idx on public.tache (fait_par);
create index tache_created_by_idx on public.tache (created_by);

-- ── commande_fournisseur ───────────────────────────────────────────────────────────────────────
create table public.commande_fournisseur (
  id uuid primary key default gen_random_uuid(),
  affaire_id uuid not null references public.affaire (id),
  fournisseur text not null check (length(trim(fournisseur)) > 0),
  iteration integer not null default 1 check (iteration >= 1),
  gesteos_commande_ref text,
  envoyee_le date,
  semaine_demandee text check (semaine_demandee ~ '^[0-9]{4}-S[0-9]{2}$'),
  lieu_livraison text,
  prix_achat_cts integer check (prix_achat_cts >= 0),
  points numeric(10, 2) check (points >= 0),
  arc_recu_le date,
  ar_recu_le date,
  semaine_annoncee text check (semaine_annoncee ~ '^[0-9]{4}-S[0-9]{2}$'),
  confirmation_recue_le date,
  bpa_version text,
  bpa_donne_le date,
  statut text not null default 'a_passer'
    check (statut in ('a_passer', 'envoyee', 'arc_recu', 'en_verification', 'bpa_donne', 'livree')),
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);
create index commande_affaire_idx on public.commande_fournisseur (affaire_id);
create index commande_bpa_attente_idx on public.commande_fournisseur (confirmation_recue_le)
  where fournisseur = 'AGEM' and bpa_donne_le is null;
create index commande_created_by_idx on public.commande_fournisseur (created_by);

-- ── planning ───────────────────────────────────────────────────────────────────────────────────
create table public.planning (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null unique references public.vente (id),
  semaine_livraison_souhaitee text check (semaine_livraison_souhaitee ~ '^[0-9]{4}-S[0-9]{2}$'),
  date_pose_souhaitee date,
  semaine_livraison_confirmee text check (semaine_livraison_confirmee ~ '^[0-9]{4}-S[0-9]{2}$'),
  date_pose_confirmee date,
  poseur text,
  statut text not null default 'demandee' check (statut in ('demandee', 'confirmee', 'decalee')),
  demande_par uuid references public.profil (id) on delete set null,
  confirme_par uuid references public.profil (id) on delete set null,
  commentaire text,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);
create index planning_statut_idx on public.planning (statut);
create index planning_demande_par_idx on public.planning (demande_par);
create index planning_confirme_par_idx on public.planning (confirme_par);
create index planning_created_by_idx on public.planning (created_by);

-- ── document ───────────────────────────────────────────────────────────────────────────────────
create table public.document (
  id uuid primary key default gen_random_uuid(),
  affaire_id uuid not null references public.affaire (id),
  etape_instance_id uuid references public.etape_instance (id),
  type_doc text not null,
  nom_original text not null,
  nom_final text not null,
  dossier_pcloud text not null,
  pcloud_file_id text,
  version integer not null default 1 check (version >= 1),
  depose_par uuid default auth.uid() references public.profil (id) on delete set null,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);
create index document_affaire_idx on public.document (affaire_id, type_doc);
create index document_etape_idx on public.document (etape_instance_id);
create index document_depose_par_idx on public.document (depose_par);
create index document_created_by_idx on public.document (created_by);

-- ── mail_sortant ───────────────────────────────────────────────────────────────────────────────
create table public.mail_sortant (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid references public.profil (id) on delete set null,
  destinataire_email text not null,
  type text not null check (type in ('digest_quotidien', 'digest_lundi', 'planning', 'bpa', 'facture_recap', 'autre')),
  objet text not null,
  html text not null,
  genere_le timestamptz not null default prive.app_now(),
  envoye_le timestamptz,
  created_at timestamptz not null default prive.app_now(),
  updated_at timestamptz not null default prive.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);
create index mail_sortant_destinataire_idx on public.mail_sortant (destinataire_id, genere_le desc);
create index mail_sortant_created_by_idx on public.mail_sortant (created_by);

-- ── journal ────────────────────────────────────────────────────────────────────────────────────
-- Table en ajout seul (pas de updated_at). affaire_id, vente_id, client_id : ajouts à la spec 6.2, pour
-- l'historique d'une fiche (EF-40) et pour n'ouvrir à chacun que l'historique de ce qu'il voit.
create table public.journal (
  id uuid primary key default gen_random_uuid(),
  table_nom text not null,
  ligne_id uuid,
  action text not null check (action in ('insert', 'update', 'delete', 'validation', 'import')),
  avant jsonb,
  apres jsonb,
  auteur_id uuid references public.profil (id) on delete set null,
  at timestamptz not null default prive.app_now(),
  affaire_id uuid references public.affaire (id) on delete set null,
  vente_id uuid references public.vente (id) on delete set null,
  client_id uuid references public.client (id) on delete set null,
  created_at timestamptz not null default prive.app_now()
);
create index journal_affaire_idx on public.journal (affaire_id, at desc);
create index journal_vente_idx on public.journal (vente_id, at desc);
create index journal_client_idx on public.journal (client_id, at desc);
create index journal_table_ligne_idx on public.journal (table_nom, ligne_id);
create index journal_auteur_idx on public.journal (auteur_id);
