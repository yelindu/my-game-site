-- Add private Xiangqi rooms without altering existing Gomoku tables or RPCs.
begin;

create function public.xiangqi_initial_board() returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  board jsonb := '[]'; piece jsonb; r integer; c integer; side text; kind text;
  back text[] := array['rook','horse','elephant','advisor','king','advisor','elephant','horse','rook'];
begin
  for i in 0..89 loop
    r := i / 9; c := i % 9; kind := null; piece := 'null';
    side := case when r >= 5 then 'red' else 'black' end;
    if r in (0,9) then kind := back[c+1];
    elsif r in (2,7) and c in (1,7) then kind := 'cannon';
    elsif r in (3,6) and c % 2 = 0 then kind := 'pawn'; end if;
    if kind is not null then piece := jsonb_build_object('side',side,'type',kind); end if;
    board := board || jsonb_build_array(piece);
  end loop;
  return board;
end;
$$;

create function public.xiangqi_screens(board jsonb, source integer, target integer) returns integer
language plpgsql immutable set search_path = public as $$
declare dr integer := target / 9 - source / 9; dc integer := target % 9 - source % 9;
  step integer; idx integer; total integer := 0;
begin
  if source = target or (dr <> 0 and dc <> 0) then return -1; end if;
  step := case when dr <> 0 then sign(dr) * 9 else sign(dc) end;
  idx := source + step;
  while idx <> target loop
    if board->idx <> 'null'::jsonb then total := total + 1; end if;
    idx := idx + step;
  end loop;
  return total;
end;
$$;

create function public.xiangqi_reaches(board jsonb, source integer, target integer) returns boolean
language plpgsql immutable set search_path = public as $$
declare piece jsonb; victim jsonb; side text; kind text;
  r integer; c integer; tr integer; tc integer; dr integer; dc integer; ar integer; ac integer; in_palace boolean;
begin
  if source is null or target is null or source < 0 or source > 89 or target < 0 or target > 89 or source = target then return false; end if;
  piece := board->source; victim := board->target;
  side := piece->>'side'; kind := piece->>'type';
  if kind is null or victim->>'side' = side then return false; end if;
  r := source / 9; c := source % 9; tr := target / 9; tc := target % 9;
  dr := tr-r; dc := tc-c; ar := abs(dr); ac := abs(dc);
  in_palace := tc between 3 and 5 and case when side = 'red' then tr between 7 and 9 else tr between 0 and 2 end;
  case kind
    when 'rook' then return public.xiangqi_screens(board,source,target) = 0;
    when 'cannon' then return public.xiangqi_screens(board,source,target) = case when victim = 'null'::jsonb then 0 else 1 end;
    when 'horse' then return (ar = 2 and ac = 1 and board->((r+sign(dr)::integer)*9+c) = 'null'::jsonb)
      or (ar = 1 and ac = 2 and board->(r*9+c+sign(dc)::integer) = 'null'::jsonb);
    when 'elephant' then return ar = 2 and ac = 2
      and case when side = 'red' then tr >= 5 else tr <= 4 end
      and board->((r+dr/2)*9+c+dc/2) = 'null'::jsonb;
    when 'advisor' then return ar = 1 and ac = 1 and in_palace;
    when 'king' then
      if victim->>'type' = 'king' and dc = 0 and public.xiangqi_screens(board,source,target) = 0 then return true; end if;
      return ar+ac = 1 and in_palace;
    when 'pawn' then return (dc = 0 and dr = case when side = 'red' then -1 else 1 end)
      or (dr = 0 and ac = 1 and case when side = 'red' then r <= 4 else r >= 5 end);
    else return false;
  end case;
end;
$$;

create function public.xiangqi_in_check(board jsonb, side text) returns boolean
language plpgsql immutable set search_path = public as $$
declare king integer := -1;
begin
  for i in 0..89 loop
    if board->i->>'side' = side and board->i->>'type' = 'king' then king := i; exit; end if;
  end loop;
  if king < 0 then return true; end if;
  for i in 0..89 loop
    if board->i->>'side' <> side and public.xiangqi_reaches(board,i,king) then return true; end if;
  end loop;
  return false;
end;
$$;

create function public.xiangqi_after_move(board jsonb, source integer, target integer) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_set(jsonb_set(board,array[target::text],board->source),array[source::text],'null'::jsonb);
$$;

create function public.xiangqi_legal_move(board jsonb, source integer, target integer) returns boolean
language plpgsql immutable set search_path = public as $$
begin
  if not public.xiangqi_reaches(board,source,target) or board->target->>'type' = 'king' then return false; end if;
  return not public.xiangqi_in_check(public.xiangqi_after_move(board,source,target),board->source->>'side');
end;
$$;

create function public.xiangqi_has_move(board jsonb, side text) returns boolean
language plpgsql immutable set search_path = public as $$
begin
  for source in 0..89 loop
    if board->source->>'side' = side then
      for target in 0..89 loop
        if public.xiangqi_legal_move(board,source,target) then return true; end if;
      end loop;
    end if;
  end loop;
  return false;
end;
$$;

create table public.xiangqi_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  red_player_id uuid not null references auth.users(id) on delete cascade,
  black_player_id uuid references auth.users(id) on delete set null,
  current_turn text not null default 'red' check (current_turn in ('red','black')),
  board jsonb not null default public.xiangqi_initial_board() check (jsonb_typeof(board) = 'array' and jsonb_array_length(board) = 90),
  move_number integer not null default 0 check (move_number >= 0),
  winner text check (winner in ('red','black','draw')),
  reason text check (reason in ('checkmate','stalemate','agreed')),
  draw_offered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (black_player_id is null or red_player_id <> black_player_id),
  check (draw_offered_by is null or draw_offered_by in (red_player_id,black_player_id)),
  check ((status = 'waiting' and black_player_id is null and winner is null and reason is null)
    or (status = 'playing' and black_player_id is not null and winner is null and reason is null)
    or (status = 'finished' and black_player_id is not null and winner is not null and reason is not null))
);

create table public.xiangqi_moves (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.xiangqi_rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  from_index smallint not null check (from_index between 0 and 89),
  to_index smallint not null check (to_index between 0 and 89),
  move_number integer not null check (move_number > 0),
  created_at timestamptz not null default now(), unique(room_id,move_number), check(from_index <> to_index)
);
alter table public.xiangqi_rooms enable row level security;
alter table public.xiangqi_moves enable row level security;
create policy "xiangqi players read rooms" on public.xiangqi_rooms for select to authenticated
  using (auth.uid() in (red_player_id,black_player_id));
create policy "xiangqi players read moves" on public.xiangqi_moves for select to authenticated
  using (exists(select 1 from public.xiangqi_rooms r where r.id = room_id and auth.uid() in (r.red_player_id,r.black_player_id)));
revoke all on public.xiangqi_rooms, public.xiangqi_moves from public, anon, authenticated;
grant select on public.xiangqi_rooms, public.xiangqi_moves to authenticated;

create function public.create_xiangqi_room() returns table(room_id uuid,room_code text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in before creating a room'; end if;
  return query insert into public.xiangqi_rooms(code,red_player_id)
    values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid()) returning id,code;
end;
$$;

create function public.join_xiangqi_room(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare room public.xiangqi_rooms;
begin
  if auth.uid() is null then raise exception 'sign in before joining a room'; end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then raise exception 'room is unavailable'; end if;
  select * into room from public.xiangqi_rooms where code = upper(trim(invite_code)) for update;
  if not found then raise exception 'room is unavailable'; end if;
  if auth.uid() in (room.red_player_id,room.black_player_id) then return room.id; end if;
  if room.status <> 'waiting' or room.black_player_id is not null then raise exception 'room is unavailable'; end if;
  update public.xiangqi_rooms set black_player_id = auth.uid(),status = 'playing',updated_at = now() where id = room.id;
  return room.id;
end;
$$;

create function public.get_xiangqi_snapshot(target_room_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('room',to_jsonb(r),'moves',coalesce((
    select jsonb_agg(to_jsonb(m) order by m.move_number) from public.xiangqi_moves m where m.room_id = r.id
  ),'[]'::jsonb)) from public.xiangqi_rooms r where r.id = target_room_id;
$$;

create function public.play_xiangqi_move(target_room_id uuid,source_index integer,target_index integer,expected_move_number integer) returns void
language plpgsql security definer set search_path = public as $$
declare room public.xiangqi_rooms; side text; next_side text; next_board jsonb; ended boolean; next_reason text;
begin
  select * into room from public.xiangqi_rooms where id = target_room_id for update;
  if not found or auth.uid() is null or not coalesce(auth.uid() in (room.red_player_id,room.black_player_id),false) then raise exception 'room is unavailable'; end if;
  if room.status <> 'playing' then raise exception 'room is not playable'; end if;
  if expected_move_number is null or expected_move_number <> room.move_number then raise exception 'stale position'; end if;
  side := case when auth.uid() = room.red_player_id then 'red' else 'black' end;
  if room.current_turn <> side then raise exception 'it is not your turn'; end if;
  if source_index is null or target_index is null or source_index not between 0 and 89 or target_index not between 0 and 89
    or room.board->source_index->>'side' is distinct from side or not public.xiangqi_legal_move(room.board,source_index,target_index) then raise exception 'illegal xiangqi move'; end if;
  next_side := case when side = 'red' then 'black' else 'red' end;
  next_board := public.xiangqi_after_move(room.board,source_index,target_index);
  ended := not public.xiangqi_has_move(next_board,next_side);
  if ended then next_reason := case when public.xiangqi_in_check(next_board,next_side) then 'checkmate' else 'stalemate' end; end if;
  insert into public.xiangqi_moves(room_id,player_id,from_index,to_index,move_number)
    values(room.id,auth.uid(),source_index,target_index,room.move_number+1);
  update public.xiangqi_rooms set board = next_board,move_number = room.move_number+1,current_turn = next_side,
    status = case when ended then 'finished' else 'playing' end,winner = case when ended then side else null end,
    reason = next_reason,draw_offered_by = null,updated_at = now() where id = room.id;
end;
$$;

create function public.xiangqi_draw(target_room_id uuid,action text) returns void
language plpgsql security definer set search_path = public as $$
declare room public.xiangqi_rooms;
begin
  select * into room from public.xiangqi_rooms where id = target_room_id for update;
  if not found or auth.uid() is null or not coalesce(auth.uid() in (room.red_player_id,room.black_player_id),false) then raise exception 'room is unavailable'; end if;
  if room.status <> 'playing' then raise exception 'room is not playable'; end if;
  if action = 'offer' then
    if room.draw_offered_by is not null and room.draw_offered_by <> auth.uid() then raise exception 'draw offer is pending'; end if;
    update public.xiangqi_rooms set draw_offered_by = auth.uid(),updated_at = now() where id = room.id;
  elsif action = 'accept' or action = 'decline' then
    if room.draw_offered_by is null or room.draw_offered_by = auth.uid() then raise exception 'no opponent draw offer'; end if;
    update public.xiangqi_rooms set draw_offered_by = null,updated_at = now(),
      status = case when action = 'accept' then 'finished' else status end,
      winner = case when action = 'accept' then 'draw' else winner end,
      reason = case when action = 'accept' then 'agreed' else reason end where id = room.id;
  elsif action = 'cancel' then
    if room.draw_offered_by is distinct from auth.uid() then raise exception 'no own draw offer'; end if;
    update public.xiangqi_rooms set draw_offered_by = null,updated_at = now() where id = room.id;
  else raise exception 'invalid draw action'; end if;
end;
$$;

revoke all on function public.xiangqi_initial_board(),public.xiangqi_screens(jsonb,integer,integer),
  public.xiangqi_reaches(jsonb,integer,integer),public.xiangqi_in_check(jsonb,text),public.xiangqi_after_move(jsonb,integer,integer),
  public.xiangqi_legal_move(jsonb,integer,integer),public.xiangqi_has_move(jsonb,text) from public, anon, authenticated;
revoke all on function public.create_xiangqi_room(),public.join_xiangqi_room(text),public.get_xiangqi_snapshot(uuid),
  public.play_xiangqi_move(uuid,integer,integer,integer),public.xiangqi_draw(uuid,text) from public, anon, authenticated;
grant execute on function public.create_xiangqi_room(),public.join_xiangqi_room(text),public.get_xiangqi_snapshot(uuid),
  public.play_xiangqi_move(uuid,integer,integer,integer),public.xiangqi_draw(uuid,text) to authenticated;
alter publication supabase_realtime add table public.xiangqi_rooms, public.xiangqi_moves;
commit;
