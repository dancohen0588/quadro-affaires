-- Traitements de nuit (session 4.2, section 11) : tâches d'alerte (RG-20, RG-22, RG-23), rappels RG-32,
-- digest quotidien et digest du lundi. Le job est idempotent : chaque tâche ou mail qu'il crée porte une clé
-- unique, et le rejouer pour le même jour ne crée rien de plus.

alter table public.tache add column cle text;
comment on column public.tache.cle is
  'Clé d''idempotence d''une tâche créée par les traitements de nuit (ex. « RG-22:<affaire>:<depuis> ») ; null pour les autres.';
create unique index tache_cle_unique on public.tache (cle);

alter table public.mail_sortant add column cle text;
comment on column public.mail_sortant.cle is
  'Clé d''idempotence d''un mail des traitements de nuit (ex. « digest_quotidien:<jour>:<profil> ») ; null pour les autres.';
create unique index mail_sortant_cle_unique on public.mail_sortant (cle);
create index if not exists mail_sortant_genere_le_idx on public.mail_sortant (genere_le desc);

-- Une tâche créée par les traitements de nuit n'est pas une activité de l'affaire (RG-09, RG-27) :
-- sinon une relance automatique effacerait l'inactivité qu'elle signale. La faire, ensuite, en est une.
create or replace function prive.affaire_activite_liee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne jsonb := to_jsonb(coalesce(new, old));
  ancienne jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  quand timestamptz := case when tg_op = 'INSERT' then coalesce((ligne ->> 'created_at')::timestamptz, prive.app_now())
                            else prive.app_now() end;
begin
  if tg_op = 'INSERT' and tg_table_name = 'tache' and ligne ->> 'cle' is not null then
    return null;
  end if;
  if ligne ? 'affaire_id' then
    update public.affaire set derniere_activite_at = quand
     where id in ((ligne ->> 'affaire_id')::uuid, (ancienne ->> 'affaire_id')::uuid) and derniere_activite_at < quand;
  elsif tg_table_name = 'vente' then
    update public.affaire set derniere_activite_at = quand
     where vente_id = (ligne ->> 'id')::uuid and derniere_activite_at < quand;
  elsif ligne ? 'vente_id' then
    update public.affaire set derniere_activite_at = quand
     where vente_id = (ligne ->> 'vente_id')::uuid and derniere_activite_at < quand;
  end if;
  return null;
end;
$$;

revoke all on function prive.affaire_activite_liee() from public, anon;
