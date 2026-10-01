-- Apply after both lobby upgrades. Old entry points must also require explicit seats and host start.
begin;
create or replace function public.create_gomoku_room() returns table(room_id uuid,room_code text)
language sql security invoker set search_path = public as $$
  select * from public.create_gomoku_lobby();
$$;
create or replace function public.join_gomoku_room(invite_code text) returns uuid
language sql security invoker set search_path = public as $$
  select public.enter_gomoku_lobby(invite_code);
$$;
create or replace function public.create_xiangqi_room() returns table(room_id uuid,room_code text)
language sql security invoker set search_path = public as $$
  select * from public.create_xiangqi_lobby();
$$;
create or replace function public.join_xiangqi_room(invite_code text) returns uuid
language sql security invoker set search_path = public as $$
  select public.enter_xiangqi_lobby(invite_code);
$$;
-- CREATE OR REPLACE preserves ACLs; revoke again to keep the boundary explicit.
revoke all on function public.create_gomoku_room(),public.join_gomoku_room(text),public.create_xiangqi_room(),public.join_xiangqi_room(text) from public,anon;
grant execute on function public.create_gomoku_room(),public.join_gomoku_room(text),public.create_xiangqi_room(),public.join_xiangqi_room(text) to authenticated;
commit;
