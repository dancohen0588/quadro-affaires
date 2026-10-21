-- Socle des tests pgTAP (section 12) : exécutés par la CI sur une base éphémère (`supabase test db`).
-- Les tests des politiques RLS arrivent avec les migrations (sessions 1.2 et 1.3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select has_schema('public', 'le schéma public existe');
select is(current_setting('server_version_num')::int >= 170000, true, 'PostgreSQL 17 ou plus récent');

select * from finish();
rollback;
