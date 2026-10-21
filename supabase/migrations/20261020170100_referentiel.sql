-- Référentiel : sociétés, magasins, profils, rattachements, paramètres (sections 3 et 6.2).

-- ── societe ────────────────────────────────────────────────────────────────────────────────────
create table public.societe (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  siren text check (siren ~ '^[0-9]{9}$'),
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  created_by uuid default auth.uid()
);

-- ── magasin ────────────────────────────────────────────────────────────────────────────────────
create table public.magasin (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  societe_id uuid not null references public.societe (id),
  adresse text,
  telephone text,
  pcloud_root_id text,
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  created_by uuid default auth.uid()
);
create index magasin_societe_idx on public.magasin (societe_id);

-- ── profil ─────────────────────────────────────────────────────────────────────────────────────
-- Un profil par compte Supabase Auth. Un compte sans profil actif n'a accès à rien (EF-02).
create table public.profil (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text not null check (length(trim(prenom)) > 0),
  nom text not null default '',
  email text not null,
  role text not null check (role in ('gerant', 'conceptrice', 'transverse')),
  est_admin boolean not null default false,
  rubriques text[] not null default '{}',
  actif boolean not null default true,
  initiales text not null check (length(initiales) between 1 and 3),
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  created_by uuid default auth.uid(),
  constraint profil_rubriques_connues check (rubriques <@ array['r4_avis', 'dossiers_pose']::text[]),
  constraint profil_rubriques_transverses check (role = 'transverse' or rubriques = '{}'),
  constraint profil_admin_gerant check (not est_admin or role = 'gerant')
);
create unique index profil_email_unique on public.profil (lower(email));

-- created_by pointe vers un profil (le profil lui-même peut être créé par un admin).
alter table public.societe add constraint societe_created_by_fk foreign key (created_by) references public.profil (id) on delete set null;
alter table public.magasin add constraint magasin_created_by_fk foreign key (created_by) references public.profil (id) on delete set null;
alter table public.profil add constraint profil_created_by_fk foreign key (created_by) references public.profil (id) on delete set null;

-- ── profil_magasin ─────────────────────────────────────────────────────────────────────────────
create table public.profil_magasin (
  profil_id uuid not null references public.profil (id) on delete cascade,
  magasin_id uuid not null references public.magasin (id) on delete cascade,
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null,
  primary key (profil_id, magasin_id)
);
create index profil_magasin_magasin_idx on public.profil_magasin (magasin_id);

-- ── parametre ──────────────────────────────────────────────────────────────────────────────────
create table public.parametre (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  valeur jsonb,
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  created_by uuid default auth.uid() references public.profil (id) on delete set null
);

-- updated_at suit l'horloge applicative
create trigger societe_maj before update on public.societe for each row execute function public.maj_updated_at();
create trigger magasin_maj before update on public.magasin for each row execute function public.maj_updated_at();
create trigger profil_maj before update on public.profil for each row execute function public.maj_updated_at();
create trigger profil_magasin_maj before update on public.profil_magasin for each row execute function public.maj_updated_at();
create trigger parametre_maj before update on public.parametre for each row execute function public.maj_updated_at();

-- Valeurs par défaut des paramètres (section 6.2, seuils des sections 8.4 et 8.5).
-- Les gérants référents (gerant_logistique, gerant_bpa, gerant_finance, responsable_r4) sont renseignés
-- quand les profils existent (seed de démo, puis administration en production).
insert into public.parametre (cle, valeur) values
  ('types_projet', '["cuisine", "dressing", "entrée", "bibliothèque", "placard", "bureau", "salle de bain", "autre"]'),
  ('sources_contact', '["passage", "recommandation", "internet", "réseaux sociaux", "salon", "client existant", "autre"]'),
  ('motifs_non_vente', '["prix", "délai", "concurrent", "réflexion longue", "projet abandonné", "injoignable", "autre"]'),
  ('echeancier_standard', '[{"type": "acompte_1", "pourcentage": 40}, {"type": "acompte_2", "pourcentage": 50}, {"type": "solde", "pourcentage": 10}]'),
  ('seuils', '{
     "retard_commerce_jours": 14,
     "retard_bpa_jours_ouvres": 3,
     "arc_non_recu_jours_ouvres": 5,
     "ar_non_recu_jours_ouvres": 5,
     "acompte_1_non_recu_jours": 3,
     "acompte_2_non_recu_jours": 2,
     "solde_non_recu_jours": 7,
     "inactivite_jours": 10,
     "dossier_pose_incomplet_jours": 7,
     "max_r2_par_jour": 1,
     "max_r3_par_semaine": 4,
     "relance_r2_sans_reponse_jours": 7
   }'),
  ('gerant_logistique', null),
  ('gerant_bpa', null),
  ('gerant_finance', null),
  ('responsable_r4', null),
  ('horloge_demo', null);
