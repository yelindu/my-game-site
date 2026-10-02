-- Classic three-player rooms. Deals are private; only sanitized room updates enter Realtime.
begin;
create table public.doudizhu_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[A-Z0-9]{8}$'),
  creator_id uuid not null references auth.users(id) on delete cascade,
  seat0_player_id uuid references auth.users(id) on delete cascade,
  seat1_player_id uuid references auth.users(id) on delete cascade,
  seat2_player_id uuid references auth.users(id) on delete cascade,
  seat0_name text, seat1_name text, seat2_name text,
  status text not null default 'waiting' check(status in ('waiting','bidding','playing','finished')),
  current_turn integer not null default 0 check(current_turn between 0 and 2),
  bids integer[] not null default array[null,null,null]::integer[],
  highest_bid integer not null default 0 check(highest_bid between 0 and 3),
  landlord integer check(landlord between 0 and 2),
  bottom integer[], remaining integer[] not null default array[0,0,0],
  last_play jsonb, passes integer not null default 0 check(passes between 0 and 1),
  passed boolean[] not null default array[false,false,false],
  multiplier integer not null default 1,
  play_counts integer[] not null default array[0,0,0], spring boolean not null default false,
  winner text check(winner in ('landlord','farmers')),
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  check(seat0_player_id is distinct from seat1_player_id or seat0_player_id is null),
  check(seat1_player_id is distinct from seat2_player_id or seat1_player_id is null),
  check(seat0_player_id is distinct from seat2_player_id or seat0_player_id is null)
);
create table public.doudizhu_room_members (
  room_id uuid not null references public.doudizhu_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '牌友' check(char_length(trim(nickname)) between 1 and 12),
  primary key(room_id,user_id)
);
create table public.doudizhu_deals (
  room_id uuid primary key references public.doudizhu_rooms(id) on delete cascade,
  hands jsonb not null, bottom integer[] not null
);
alter table public.doudizhu_rooms enable row level security;
alter table public.doudizhu_room_members enable row level security;
alter table public.doudizhu_deals enable row level security;
create policy "read own doudizhu membership" on public.doudizhu_room_members for select to authenticated using(user_id = auth.uid());
create policy "members read public doudizhu rooms" on public.doudizhu_rooms for select to authenticated using(
  exists(select 1 from public.doudizhu_room_members m where m.room_id = id and m.user_id = auth.uid())
);
revoke all on public.doudizhu_rooms,public.doudizhu_room_members,public.doudizhu_deals from public,anon,authenticated;
grant select on public.doudizhu_rooms,public.doudizhu_room_members to authenticated;

create function public.doudizhu_shape(cards integer[]) returns jsonb
language plpgsql immutable set search_path = public as $$
declare n integer := cardinality(cards); counts integer[] := array_fill(0,array[17]);
  c integer; r integer; ranks integer := 0; lo integer := 18; hi integer := 0; triple integer; four integer;
  same boolean; typ text; unit integer; size integer; first_rank integer; body_ok boolean; wings_ok boolean; wing_ranks integer;
begin
  if n is null or n < 1 or n > 20 or exists(select 1 from unnest(cards) x where x is null or x < 0 or x > 53)
    or (select count(distinct x) from unnest(cards) x) <> n then return null; end if;
  foreach c in array cards loop r := case when c < 52 then c / 4 + 3 else c - 36 end; counts[r] := counts[r] + 1; end loop;
  for r in 3..17 loop
    if counts[r] > 0 then ranks := ranks + 1; lo := least(lo,r); hi := greatest(hi,r); end if;
    if counts[r] = 3 then triple := r; end if;
    if counts[r] = 4 then four := r; end if;
  end loop;
  if n = 2 and counts[16] = 1 and counts[17] = 1 then typ := 'rocket'; hi := 17;
  elsif ranks = 1 then typ := case n when 1 then 'single' when 2 then 'pair' when 3 then 'triple' when 4 then 'bomb' end;
  elsif n = 4 and triple is not null then typ := 'tripleSingle'; hi := triple;
  elsif n = 5 and triple is not null and ranks = 2 then typ := 'triplePair'; hi := triple;
  elsif hi <= 14 and hi-lo+1 = ranks and n = ranks and n >= 5 then typ := 'straight';
  elsif hi <= 14 and hi-lo+1 = ranks and ranks >= 3 then
    same := true;
    for r in lo..hi loop if counts[r] <> 2 then same := false; end if; end loop;
    if same then typ := 'pairs'; end if;
  end if;
  if typ is not null then return jsonb_build_object('type',typ,'main',hi,'length',n); end if;
  for unit in 3..5 loop
    if n % unit <> 0 or n / unit < 2 then continue; end if;
    size := n / unit;
    for first_rank in 3..(15-size) loop
      body_ok := true; wings_ok := true; wing_ranks := 0;
      for r in 3..17 loop
        if r >= first_rank and r < first_rank + size then
          if counts[r] <> 3 then body_ok := false; end if;
        elsif counts[r] > 0 then
          wing_ranks := wing_ranks + 1;
          if unit = 3 or unit = 4 and counts[r] > 2 or unit = 5 and counts[r] <> 2 then wings_ok := false; end if;
        end if;
      end loop;
      if body_ok and wings_ok and (unit <> 5 or wing_ranks = size) then
        typ := case unit when 3 then 'airplane' when 4 then 'airplaneSingle' else 'airplanePair' end;
        return jsonb_build_object('type',typ,'main',first_rank+size-1,'length',n);
      end if;
    end loop;
  end loop;
  if four is not null and n = 6 then typ := 'fourSingle';
  elsif four is not null and n = 8 and ranks = 3 then
    same := true;
    for r in 3..17 loop if r <> four and counts[r] > 0 and counts[r] <> 2 then same := false; end if; end loop;
    if same then typ := 'fourPair'; end if;
  end if;
  if typ is null then return null; end if;
  return jsonb_build_object('type',typ,'main',four,'length',n);
end $$;

create function public.doudizhu_deal(target_room_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare deck integer[]; hands jsonb;
begin
  -- UUID randomness avoids exposing a predictable PRNG seed through public deal metadata.
  select array_agg(c order by gen_random_uuid()) into deck from generate_series(0,53) c;
  hands := jsonb_build_array(to_jsonb(deck[1:17]),to_jsonb(deck[18:34]),to_jsonb(deck[35:51]));
  insert into public.doudizhu_deals(room_id,hands,bottom) values(target_room_id,hands,deck[52:54])
    on conflict(room_id) do update set hands = excluded.hands,bottom = excluded.bottom;
  update public.doudizhu_rooms set status = 'bidding',current_turn = (get_byte(decode(substr(replace(gen_random_uuid()::text,'-',''),1,2),'hex'),0) % 3),
    bids = array[null,null,null]::integer[],highest_bid = 0,landlord = null,bottom = null,remaining = array[17,17,17],
    last_play = null,passes = 0,passed = array[false,false,false],multiplier = 1,play_counts = array[0,0,0],spring = false,winner = null,version = version + 1,updated_at = now()
    where id = target_room_id;
end $$;

create function public.create_doudizhu_lobby() returns table(room_id uuid,room_code text)
language plpgsql security definer set search_path = public as $$
declare room public.doudizhu_rooms;
begin
  if auth.uid() is null then raise exception 'sign in before creating a room'; end if;
  insert into public.doudizhu_rooms(code,creator_id) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid()) returning * into room;
  insert into public.doudizhu_room_members(room_id,user_id) values(room.id,auth.uid());
  return query select room.id,room.code;
end $$;

create function public.enter_doudizhu_lobby(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in before joining a room'; end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then raise exception 'room is unavailable'; end if;
  select id into target from public.doudizhu_rooms where code = upper(trim(invite_code));
  if not found then raise exception 'room is unavailable'; end if;
  insert into public.doudizhu_room_members(room_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end $$;

create function public.doudizhu_lobby_action(target_room_id uuid,action text,seat text default null,nickname text default null) returns void
language plpgsql security definer set search_path = public as $$
declare room public.doudizhu_rooms; display_name text; ids uuid[]; selected integer;
begin
  select * into room from public.doudizhu_rooms where id = target_room_id for update;
  if not found or auth.uid() is null or not exists(select 1 from public.doudizhu_room_members where room_id = target_room_id and user_id = auth.uid()) then raise exception 'room is unavailable'; end if;
  select m.nickname into display_name from public.doudizhu_room_members m where m.room_id = target_room_id and m.user_id = auth.uid();
  ids := array[room.seat0_player_id,room.seat1_player_id,room.seat2_player_id];
  if action = 'name' then
    if nickname is null or char_length(trim(nickname)) not between 1 and 12 then raise exception 'invalid nickname'; end if;
    display_name := trim(nickname);
    update public.doudizhu_room_members set nickname = display_name where room_id = target_room_id and user_id = auth.uid();
    update public.doudizhu_rooms set seat0_name = case when seat0_player_id = auth.uid() then display_name else seat0_name end,
      seat1_name = case when seat1_player_id = auth.uid() then display_name else seat1_name end,
      seat2_name = case when seat2_player_id = auth.uid() then display_name else seat2_name end,updated_at = now() where id = target_room_id;
    return;
  end if;
  if action = 'restart' then
    if room.creator_id <> auth.uid() then raise exception 'only host can start'; end if;
    if room.status <> 'finished' then raise exception 'not playable'; end if;
    perform public.doudizhu_deal(target_room_id); return;
  end if;
  if room.status <> 'waiting' then raise exception 'lobby already started'; end if;
  if action = 'seat' then
    if seat is null or seat not in ('seat0','seat1','seat2') then raise exception 'invalid seat'; end if;
    selected := right(seat,1)::integer + 1;
    if ids[selected] is not null and ids[selected] <> auth.uid() then raise exception 'seat is occupied'; end if;
    if auth.uid() = any(ids) and ids[selected] is distinct from auth.uid() then raise exception 'leave your seat first'; end if;
    execute format('update public.doudizhu_rooms set %I = $1,%I = $2,updated_at = now() where id = $3',seat||'_player_id',seat||'_name') using auth.uid(),display_name,target_room_id;
  elsif action = 'leave' then
    update public.doudizhu_rooms set
      seat0_player_id = case when seat0_player_id = auth.uid() then null else seat0_player_id end,
      seat1_player_id = case when seat1_player_id = auth.uid() then null else seat1_player_id end,
      seat2_player_id = case when seat2_player_id = auth.uid() then null else seat2_player_id end,
      seat0_name = case when seat0_player_id = auth.uid() then null else seat0_name end,
      seat1_name = case when seat1_player_id = auth.uid() then null else seat1_name end,
      seat2_name = case when seat2_player_id = auth.uid() then null else seat2_name end,updated_at = now() where id = target_room_id;
  elsif action = 'start' then
    if room.creator_id <> auth.uid() then raise exception 'only host can start'; end if;
    if array_position(ids,null) is not null then raise exception 'three seats are required'; end if;
    perform public.doudizhu_deal(target_room_id);
  else raise exception 'invalid lobby action'; end if;
end $$;

create function public.get_doudizhu_snapshot(target_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare room public.doudizhu_rooms; seat integer; hand jsonb := '[]'::jsonb; display_name text;
begin
  if auth.uid() is null then return null; end if;
  select m.nickname into display_name from public.doudizhu_room_members m where m.room_id = target_room_id and m.user_id = auth.uid();
  if not found then return null; end if;
  select * into room from public.doudizhu_rooms where id = target_room_id;
  if not found then return null; end if;
  seat := array_position(array[room.seat0_player_id,room.seat1_player_id,room.seat2_player_id],auth.uid()) - 1;
  if seat is not null then select d.hands -> seat into hand from public.doudizhu_deals d where d.room_id = target_room_id; end if;
  return jsonb_build_object('room',to_jsonb(room),'hand',coalesce(hand,'[]'::jsonb),'nickname',display_name);
end $$;

create function public.doudizhu_game_action(target_room_id uuid,action text,expected_version integer,bid_value integer default null,played_cards integer[] default array[]::integer[]) returns void
language plpgsql security definer set search_path = public as $$
declare room public.doudizhu_rooms; deal public.doudizhu_deals; seat integer; hand integer[]; shape jsonb; previous jsonb; next_hand integer[]; c integer;
begin
  select * into room from public.doudizhu_rooms where id = target_room_id for update;
  if not found or auth.uid() is null then raise exception 'room is unavailable'; end if;
  seat := array_position(array[room.seat0_player_id,room.seat1_player_id,room.seat2_player_id],auth.uid()) - 1;
  if seat is null or seat <> room.current_turn then raise exception 'not your turn'; end if;
  if expected_version is null or expected_version <> room.version then raise exception 'stale game'; end if;
  select * into deal from public.doudizhu_deals where room_id = target_room_id;
  if action = 'bid' then
    if room.status <> 'bidding' then raise exception 'not playable'; end if;
    if bid_value is null or bid_value < 0 or bid_value > 3 or bid_value > 0 and bid_value <= room.highest_bid then raise exception 'invalid bid'; end if;
    room.bids[seat+1] := bid_value;
    if bid_value > room.highest_bid then room.highest_bid := bid_value; room.landlord := seat; end if;
    if bid_value = 3 or array_position(room.bids,null) is null then
      if room.highest_bid = 0 then perform public.doudizhu_deal(target_room_id); return; end if;
      select array_agg(x::integer) into hand from jsonb_array_elements_text(deal.hands -> room.landlord) x;
      hand := hand || deal.bottom;
      update public.doudizhu_deals set hands = jsonb_set(deal.hands,array[room.landlord::text],to_jsonb(hand)) where room_id = target_room_id;
      room.remaining[room.landlord+1] := 20;
      update public.doudizhu_rooms set status = 'playing',bids = room.bids,highest_bid = room.highest_bid,landlord = room.landlord,
        current_turn = room.landlord,bottom = deal.bottom,remaining = room.remaining,multiplier = room.highest_bid,version = version + 1,updated_at = now() where id = target_room_id;
    else
      update public.doudizhu_rooms set bids = room.bids,highest_bid = room.highest_bid,landlord = room.landlord,current_turn = (seat+1)%3,version = version + 1,updated_at = now() where id = target_room_id;
    end if;
    return;
  end if;
  if action <> 'play' or room.status <> 'playing' then raise exception 'not playable'; end if;
  if played_cards is null then raise exception 'invalid cards'; end if;
  if cardinality(played_cards) = 0 then
    if room.last_play is null or (room.last_play->>'seat')::integer = seat then raise exception 'cannot pass'; end if;
    room.passed[seat+1] := true;
    if room.passes = 1 then room.last_play := null; room.passes := 0; room.passed := array[false,false,false];
    else room.passes := 1; end if;
    update public.doudizhu_rooms set last_play = room.last_play,passes = room.passes,passed = room.passed,current_turn = (seat+1)%3,version = version + 1,updated_at = now() where id = target_room_id;
    return;
  end if;
  shape := public.doudizhu_shape(played_cards);
  if shape is null then raise exception 'invalid combination'; end if;
  select array_agg(x::integer) into hand from jsonb_array_elements_text(deal.hands -> seat) x;
  foreach c in array played_cards loop if not c = any(hand) then raise exception 'cards not owned'; end if; end loop;
  previous := room.last_play -> 'shape';
  if previous is not null and not (
    previous->>'type' <> 'rocket' and (
      shape->>'type' = 'rocket' or shape->>'type' = 'bomb' and previous->>'type' <> 'bomb'
      or shape->>'type' = previous->>'type' and shape->>'length' = previous->>'length' and (shape->>'main')::integer > (previous->>'main')::integer
    )
  ) then raise exception 'cannot beat'; end if;
  select coalesce(array_agg(x),array[]::integer[]) into next_hand from unnest(hand) x where not x = any(played_cards);
  update public.doudizhu_deals set hands = jsonb_set(deal.hands,array[seat::text],to_jsonb(next_hand)) where room_id = target_room_id;
  room.remaining[seat+1] := cardinality(next_hand);
  room.play_counts[seat+1] := room.play_counts[seat+1] + 1;
  if cardinality(next_hand) = 0 then
    if seat = room.landlord then
      room.spring := true;
      for c in 1..3 loop if c <> room.landlord+1 and room.play_counts[c] > 0 then room.spring := false; end if; end loop;
    else room.spring := room.play_counts[room.landlord+1] <= 1; end if;
  end if;
  update public.doudizhu_rooms set remaining = room.remaining,last_play = jsonb_build_object('seat',seat,'cards',to_jsonb(played_cards),'shape',shape),
    passes = 0,passed = array[false,false,false],current_turn = (seat+1)%3,
    play_counts = room.play_counts,spring = room.spring,
    multiplier = multiplier * case when shape->>'type' in ('bomb','rocket') then 2 else 1 end * case when room.spring then 2 else 1 end,
    status = case when cardinality(next_hand) = 0 then 'finished' else 'playing' end,
    winner = case when cardinality(next_hand) = 0 then case when seat = landlord then 'landlord' else 'farmers' end else null end,
    version = version + 1,updated_at = now() where id = target_room_id;
end $$;

revoke all on function public.doudizhu_shape(integer[]),public.doudizhu_deal(uuid),public.create_doudizhu_lobby(),public.enter_doudizhu_lobby(text),public.doudizhu_lobby_action(uuid,text,text,text),public.get_doudizhu_snapshot(uuid),public.doudizhu_game_action(uuid,text,integer,integer,integer[]) from public,anon,authenticated;
grant execute on function public.create_doudizhu_lobby(),public.enter_doudizhu_lobby(text),public.doudizhu_lobby_action(uuid,text,text,text),public.get_doudizhu_snapshot(uuid),public.doudizhu_game_action(uuid,text,integer,integer,integer[]) to authenticated;
alter publication supabase_realtime add table public.doudizhu_rooms;
commit;
