-- Allow the same player to resume a room and read one consistent board snapshot.
begin;

create or replace function public.join_gomoku_room(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  joined_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in before joining a room';
  end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then
    raise exception 'room is unavailable';
  end if;

  select id into joined_room_id
  from public.rooms
  where code = upper(trim(invite_code))
    and auth.uid() in (black_player_id, white_player_id);
  if joined_room_id is not null then
    return joined_room_id;
  end if;

  update public.rooms
  set white_player_id = auth.uid(), status = 'playing', updated_at = now()
  where code = upper(trim(invite_code))
    and status = 'waiting'
    and white_player_id is null
    and black_player_id <> auth.uid()
  returning id into joined_room_id;

  -- A concurrent retry may have already joined this user while this update waited.
  if joined_room_id is null then
    select id into joined_room_id
    from public.rooms
    where code = upper(trim(invite_code))
      and auth.uid() in (black_player_id, white_player_id);
  end if;
  if joined_room_id is null then
    raise exception 'room is unavailable';
  end if;
  return joined_room_id;
end;
$$;

create or replace function public.get_gomoku_snapshot(target_room_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'room', to_jsonb(r),
    'moves', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.move_number)
      from public.moves m where m.room_id = r.id
    ), '[]'::jsonb)
  )
  from public.rooms r
  where r.id = target_room_id;
$$;

-- Supabase projects may grant anon function access through default privileges.
revoke all on function public.create_gomoku_room() from public, anon;
revoke all on function public.join_gomoku_room(text) from public, anon;
revoke all on function public.play_gomoku_move(uuid, smallint, smallint) from public, anon;
revoke all on function public.get_gomoku_snapshot(uuid) from public, anon;
grant execute on function public.join_gomoku_room(text) to authenticated;
grant execute on function public.get_gomoku_snapshot(uuid) to authenticated;

commit;
