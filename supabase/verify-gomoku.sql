-- Read-only deployment checks. Expect two protected tables, four RPCs, and two published tables.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('rooms', 'moves')
order by tablename;

select p.proname, p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as unauthenticated_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_gomoku_room', 'join_gomoku_room', 'play_gomoku_move', 'get_gomoku_snapshot')
order by p.proname;

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('rooms', 'moves')
order by tablename;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('rooms', 'moves') and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
