-- Horloge applicative (section 5.4) : app_now() et app_today() suivent parametre.horloge_demo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(abs(extract(epoch from (public.app_now() - now()))) < 1, 'sans réglage, app_now() est l''heure réelle');

update public.parametre set valeur = '{"decalage_secondes": 259200}' where cle = 'horloge_demo';
select is(public.app_today(), ((now() at time zone 'Europe/Paris')::date + 3), 'décalage de 3 jours : app_today() avance de 3 jours');
select ok(abs(extract(epoch from (public.app_now() - (now() + interval '3 days')))) < 1, 'app_now() avance du décalage');

update public.parametre set valeur = null where cle = 'horloge_demo';
select is(public.app_today(), (now() at time zone 'Europe/Paris')::date, 'retour à l''heure réelle');

select * from finish();
rollback;
