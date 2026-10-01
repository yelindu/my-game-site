-- Add a waiting lobby and optional spectators; keep legacy rooms and RPCs playable.
begin;
alter table public.xiangqi_rooms add column creator_id uuid references auth.users(id) on delete cascade;
update public.xiangqi_rooms set creator_id = red_player_id;
alter table public.xiangqi_rooms alter column creator_id set not null;
alter table public.xiangqi_rooms alter column creator_id set default auth.uid();
alter table public.xiangqi_rooms alter column red_player_id drop not null;
alter table public.xiangqi_rooms add column red_name text;
alter table public.xiangqi_rooms add column black_name text;
-- Replace only the old status/seat constraint, identified by its columns rather than an auto-generated name.
do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
    where conrelid = 'public.xiangqi_rooms'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%waiting%' and pg_get_constraintdef(oid) like '%black_player_id%';
  execute format('alter table public.xiangqi_rooms drop constraint %I', constraint_name);
end $$;
alter table public.xiangqi_rooms add constraint xiangqi_lobby_state check (
  (status = 'waiting' and move_number = 0 and winner is null and reason is null)
  or (status = 'playing' and red_player_id is not null and black_player_id is not null and winner is null and reason is null)
  or (status = 'finished' and red_player_id is not null and black_player_id is not null and winner is not null and reason is not null)
);
create table public.xiangqi_room_members (
  room_id uuid not null references public.xiangqi_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '棋友' check (char_length(trim(nickname)) between 1 and 12),
  primary key(room_id,user_id)
);
insert into public.xiangqi_room_members(room_id,user_id)
  select id,red_player_id from public.xiangqi_rooms where red_player_id is not null
  union select id,black_player_id from public.xiangqi_rooms where black_player_id is not null;
alter table public.xiangqi_room_members enable row level security;
create policy "read own xiangqi membership" on public.xiangqi_room_members for select to authenticated using(user_id = auth.uid());
revoke all on public.xiangqi_room_members from public,anon,authenticated;
grant select on public.xiangqi_room_members to authenticated;
drop policy "xiangqi players read rooms" on public.xiangqi_rooms;
create policy "xiangqi members read rooms" on public.xiangqi_rooms for select to authenticated using (
  auth.uid() in (creator_id,red_player_id,black_player_id)
  or exists(select 1 from public.xiangqi_room_members m where m.room_id = id and m.user_id = auth.uid())
);
drop policy "xiangqi players read moves" on public.xiangqi_moves;
create policy "xiangqi members read moves" on public.xiangqi_moves for select to authenticated
  using(exists(select 1 from public.xiangqi_rooms r where r.id = room_id));

create function public.create_xiangqi_lobby() returns table(room_id uuid,room_code text)
language plpgsql security definer set search_path = public as $$
declare new_room public.xiangqi_rooms;
begin
  if auth.uid() is null then raise exception 'sign in before creating a room'; end if;
  insert into public.xiangqi_rooms(code,creator_id) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid()) returning * into new_room;
  insert into public.xiangqi_room_members(room_id,user_id) values(new_room.id,auth.uid());
  return query select new_room.id,new_room.code;
end $$;

create function public.enter_xiangqi_lobby(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in before joining a room'; end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then raise exception 'room is unavailable'; end if;
  select id into target from public.xiangqi_rooms where code = upper(trim(invite_code));
  if not found then raise exception 'room is unavailable'; end if;
  insert into public.xiangqi_room_members(room_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end $$;

create function public.xiangqi_lobby_action(target_room_id uuid,action text,seat text default null,nickname text default null) returns void
language plpgsql security definer set search_path = public as $$
declare room public.xiangqi_rooms; display_name text;
begin
  select * into room from public.xiangqi_rooms where id = target_room_id for update;
  if not found or auth.uid() is null or not exists(select 1 from public.xiangqi_room_members where room_id = target_room_id and user_id = auth.uid()) then raise exception 'room is unavailable'; end if;
  select m.nickname into display_name from public.xiangqi_room_members m where m.room_id = target_room_id and m.user_id = auth.uid();
  if action = 'name' then
    if nickname is null or char_length(trim(nickname)) not between 1 and 12 then raise exception 'invalid nickname'; end if;
    display_name := trim(nickname);
    update public.xiangqi_room_members set nickname = display_name where room_id = target_room_id and user_id = auth.uid();
    update public.xiangqi_rooms set red_name = case when red_player_id = auth.uid() then display_name else red_name end,
      black_name = case when black_player_id = auth.uid() then display_name else black_name end,updated_at = now() where id = target_room_id;
    return;
  end if;
  if room.status <> 'waiting' then raise exception 'lobby already started'; end if;
  if action = 'seat' then
    if seat is null or seat not in ('red','black') then raise exception 'invalid seat'; end if;
    if seat = 'red' then
      if room.red_player_id is not null and room.red_player_id <> auth.uid() then raise exception 'seat is occupied'; end if;
      if room.black_player_id = auth.uid() then raise exception 'leave your seat first'; end if;
      update public.xiangqi_rooms set red_player_id = auth.uid(),red_name = display_name,updated_at = now() where id = target_room_id;
    else
      if room.black_player_id is not null and room.black_player_id <> auth.uid() then raise exception 'seat is occupied'; end if;
      if room.red_player_id = auth.uid() then raise exception 'leave your seat first'; end if;
      update public.xiangqi_rooms set black_player_id = auth.uid(),black_name = display_name,updated_at = now() where id = target_room_id;
    end if;
  elsif action = 'leave' then
    update public.xiangqi_rooms set
      red_player_id = case when red_player_id = auth.uid() then null else red_player_id end,
      black_player_id = case when black_player_id = auth.uid() then null else black_player_id end,
      red_name = case when red_player_id = auth.uid() then null else red_name end,
      black_name = case when black_player_id = auth.uid() then null else black_name end,updated_at = now() where id = target_room_id;
  elsif action = 'start' then
    if room.creator_id <> auth.uid() then raise exception 'only host can start'; end if;
    if room.red_player_id is null or room.black_player_id is null then raise exception 'both seats are required'; end if;
    update public.xiangqi_rooms set status = 'playing',updated_at = now() where id = target_room_id;
  else raise exception 'invalid lobby action'; end if;
end $$;

create or replace function public.get_xiangqi_snapshot(target_room_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('room',to_jsonb(r),'moves',coalesce((
    select jsonb_agg(to_jsonb(m) order by m.move_number) from public.xiangqi_moves m where m.room_id = r.id
  ),'[]'::jsonb),'nickname',(select m.nickname from public.xiangqi_room_members m where m.room_id = r.id and m.user_id = auth.uid()))
  from public.xiangqi_rooms r where r.id = target_room_id;
$$;
revoke all on function public.create_xiangqi_lobby(),public.enter_xiangqi_lobby(text),public.xiangqi_lobby_action(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_xiangqi_lobby(),public.enter_xiangqi_lobby(text),public.xiangqi_lobby_action(uuid,text,text,text) to authenticated;
commit;
