-- Repairs the initial migration after SQL Editor stopped before the move function.

begin;

create or replace function public.play_gomoku_move(
  target_room_id uuid,
  target_x smallint,
  target_y smallint
)
returns table (
  played_move_number smallint,
  room_status text,
  next_turn text,
  game_winner text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.rooms%rowtype;
  player_side text;
  new_move_number smallint;
  direction_x integer;
  direction_y integer;
  window_start integer;
  stones_in_window integer;
  won boolean := false;
begin
  if auth.uid() is null then
    raise exception 'sign in before playing';
  end if;

  if target_x not between 0 and 14 or target_y not between 0 and 14 then
    raise exception 'move is outside the board';
  end if;

  select * into room
  from public.rooms
  where id = target_room_id
  for update;

  if not found or room.status <> 'playing' then
    raise exception 'game is not playable';
  end if;

  player_side := case
    when room.black_player_id = auth.uid() then 'black'
    when room.white_player_id = auth.uid() then 'white'
    else null
  end;

  if player_side is null or room.current_turn <> player_side then
    raise exception 'it is not your turn';
  end if;

  if exists (
    select 1 from public.moves
    where room_id = room.id
      and position_x = target_x
      and position_y = target_y
  ) then
    raise exception 'this position is already occupied';
  end if;

  select coalesce(max(move_number), 0)::smallint + 1
  into new_move_number
  from public.moves
  where room_id = room.id;

  insert into public.moves (room_id, player_id, position_x, position_y, move_number)
  values (room.id, auth.uid(), target_x, target_y, new_move_number);

  for direction_x, direction_y in values (1, 0), (0, 1), (1, 1), (1, -1)
  loop
    for window_start in -4..0
    loop
      select count(*) into stones_in_window
      from generate_series(window_start, window_start + 4) as step(step_offset)
      where exists (
        select 1 from public.moves
        where room_id = room.id
          and player_id = auth.uid()
          and position_x = target_x + direction_x * step.step_offset
          and position_y = target_y + direction_y * step.step_offset
      );

      if stones_in_window = 5 then
        won := true;
        exit;
      end if;
    end loop;

    exit when won;
  end loop;

  if won then
    update public.rooms
    set status = 'finished', winner = player_side, updated_at = now()
    where id = room.id
    returning * into room;
  elsif new_move_number = 225 then
    update public.rooms
    set status = 'finished', winner = 'draw', updated_at = now()
    where id = room.id
    returning * into room;
  else
    update public.rooms
    set
      current_turn = case player_side when 'black' then 'white' else 'black' end,
      updated_at = now()
    where id = room.id
    returning * into room;
  end if;

  return query
  select new_move_number, room.status, room.current_turn, room.winner;
end;
$$;

revoke all on function public.create_gomoku_room() from public;
revoke all on function public.join_gomoku_room(text) from public;
revoke all on function public.play_gomoku_move(uuid, smallint, smallint) from public;
grant execute on function public.create_gomoku_room() to authenticated;
grant execute on function public.join_gomoku_room(text) to authenticated;
grant execute on function public.play_gomoku_move(uuid, smallint, smallint) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.moves;
exception when duplicate_object then null;
end;
$$;

commit;
