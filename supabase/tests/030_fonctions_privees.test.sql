-- Les fonctions SECURITY DEFINER ne sont pas exposées par l'API et restent inaccessibles à anon.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select hasnt_function('public', 'auth_role', 'auth_role() n''est plus dans le schéma exposé public');
select hasnt_function('public', 'app_now', 'app_now() n''est plus dans le schéma exposé public');
select has_function('prive', 'auth_magasins', 'auth_magasins() est dans le schéma privé');
select ok(not has_function_privilege('anon', 'prive.auth_role()', 'execute'), 'anon ne peut pas exécuter auth_role()');
select ok(has_function_privilege('authenticated', 'prive.auth_role()', 'execute'), 'authenticated peut évaluer les politiques');

select * from finish();
rollback;
