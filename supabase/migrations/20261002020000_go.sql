begin;
create function public.go_initial() returns jsonb language sql immutable set search_path=public as $$
  select jsonb_build_object('size',9,'phase','playing','board',to_jsonb(array_fill(0,array[81])),'turn',1,
    'captures','[0,0,0]'::jsonb,'moves','[]'::jsonb,'positions',jsonb_build_array(repeat('0',81)),
    'passes',0,'dead','[]'::jsonb,'confirmed','[]'::jsonb,'score',null,'winner',null,'reason',null,'version',0);
$$;
create function public.go_neighbors(move_index integer) returns integer[] language plpgsql immutable set search_path=public as $$
declare out integer[]:='{}';
begin
  if move_index>=9 then out:=array_append(out,move_index-9); end if;
  if move_index<72 then out:=array_append(out,move_index+9); end if;
  if move_index%9>0 then out:=array_append(out,move_index-1); end if;
  if move_index%9<8 then out:=array_append(out,move_index+1); end if;
  return out;
end $$;
create function public.go_group(board integer[],move_index integer) returns jsonb language plpgsql immutable set search_path=public as $$
declare stones integer[]:=array[move_index]; liberties integer[]:='{}'; cursor integer:=1; n integer;
begin
  while cursor<=cardinality(stones) loop
    foreach n in array public.go_neighbors(stones[cursor]) loop
      if board[n+1]=board[move_index+1] and not n=any(stones) then stones:=array_append(stones,n);
      elsif board[n+1]=0 and not n=any(liberties) then liberties:=array_append(liberties,n); end if;
    end loop;
    cursor:=cursor+1;
  end loop;
  return jsonb_build_object('stones',to_jsonb(stones),'liberties',to_jsonb(liberties));
end $$;
create function public.go_score(board integer[],dead integer[]) returns jsonb language plpgsql immutable set search_path=public as $$
declare cleaned integer[]:=board; territory integer[]:=array_fill(0,array[81]); seen integer[]:='{}'; stones integer[]:=array[0,0,0];
  points integer[]:=array[0,0,0]; region integer[]; borders integer[]; p integer; q integer; n integer; owner integer;
begin
  foreach p in array dead loop cleaned[p+1]:=0; end loop;
  for p in 0..80 loop
    if cleaned[p+1]>0 then stones[cleaned[p+1]+1]:=stones[cleaned[p+1]+1]+1; continue; end if;
    if p=any(seen) then continue; end if;
    select array_agg(value::integer) into region from jsonb_array_elements_text(public.go_group(cleaned,p)->'stones');
    borders:='{}';
    foreach q in array region loop
      seen:=array_append(seen,q);
      foreach n in array public.go_neighbors(q) loop
        if cleaned[n+1]>0 and not cleaned[n+1]=any(borders) then borders:=array_append(borders,cleaned[n+1]); end if;
      end loop;
    end loop;
    if cardinality(borders)=1 then
      owner:=borders[1]; points[owner+1]:=points[owner+1]+cardinality(region);
      foreach q in array region loop territory[q+1]:=owner; end loop;
    end if;
  end loop;
  return jsonb_build_object('black',stones[2]+points[2],'white',stones[3]+points[3]+7.5,'stones',to_jsonb(stones),
    'points',to_jsonb(points),'territory',to_jsonb(territory),'komi',7.5);
end $$;
create function public.go_apply(state jsonb,action text,player integer,move_index integer) returns jsonb language plpgsql immutable set search_path=public as $$
declare phase text:=state->>'phase'; turn integer:=(state->>'turn')::integer; board integer[]; captured integer[]:='{}';
  dead integer[]; confirmed integer[]; block integer[]; n integer; p integer; g jsonb; key text; passes integer; result jsonb;
begin
  if player is null or player not in (1,2) then raise exception 'go spectator'; end if;
  if phase not in ('playing','scoring') then raise exception 'not playable'; end if;
  state:=state||jsonb_build_object('version',(state->>'version')::integer+1);
  if action='resign' then return state||jsonb_build_object('phase','finished','winner',3-player,'reason','resign','score',null); end if;
  select array_agg(value::integer order by ordinality) into board from jsonb_array_elements_text(state->'board') with ordinality;
  if action in ('place','pass') then
    if phase<>'playing' or player<>turn then raise exception 'not your turn'; end if;
    state:=state||jsonb_build_object('turn',3-player);
    if action='pass' then
      passes:=(state->>'passes')::integer+1;
      state:=state||jsonb_build_object('passes',passes,'moves',(state->'moves')||jsonb_build_array(jsonb_build_object('type','pass','position',null,'player',player,'captured','[]'::jsonb)));
      if passes=2 then state:=state||jsonb_build_object('phase','scoring','dead','[]'::jsonb,'confirmed','[]'::jsonb); end if;
      return state;
    end if;
    if move_index is null or move_index<0 or move_index>80 then raise exception 'go invalid position'; end if;
    if board[move_index+1]<>0 then raise exception 'go occupied'; end if;
    board[move_index+1]:=player;
    foreach n in array public.go_neighbors(move_index) loop
      if board[n+1]=3-player then
        g:=public.go_group(board,n);
        if jsonb_array_length(g->'liberties')=0 then
          for p in select value::integer from jsonb_array_elements_text(g->'stones') loop board[p+1]:=0; captured:=array_append(captured,p); end loop;
        end if;
      end if;
    end loop;
    if jsonb_array_length(public.go_group(board,move_index)->'liberties')=0 then raise exception 'go suicide'; end if;
    key:=array_to_string(board,'');
    if (state->'positions')?key then raise exception 'go repetition'; end if;
    select coalesce(array_agg(c order by c),'{}'::integer[]) into captured from unnest(captured) c;
    state:=jsonb_set(state,array['captures',player::text],to_jsonb((state->'captures'->>player)::integer+cardinality(captured)));
    return state||jsonb_build_object('board',to_jsonb(board),'passes',0,'positions',(state->'positions')||jsonb_build_array(key),
      'moves',(state->'moves')||jsonb_build_array(jsonb_build_object('type','place','position',move_index,'player',player,'captured',to_jsonb(captured))));
  end if;
  if phase<>'scoring' then raise exception 'go scoring'; end if;
  select coalesce(array_agg(value::integer),'{}'::integer[]) into dead from jsonb_array_elements_text(state->'dead');
  select coalesce(array_agg(value::integer),'{}'::integer[]) into confirmed from jsonb_array_elements_text(state->'confirmed');
  if action='mark' then
    if move_index is null or move_index<0 or move_index>80 or board[move_index+1]=0 then raise exception 'go invalid position'; end if;
    select array_agg(value::integer) into block from jsonb_array_elements_text(public.go_group(board,move_index)->'stones');
    if move_index=any(dead) then select coalesce(array_agg(d order by d),'{}'::integer[]) into dead from unnest(dead) d where not d=any(block);
    else select array_agg(distinct d order by d) into dead from unnest(dead||block) d; end if;
    return state||jsonb_build_object('dead',to_jsonb(dead),'confirmed','[]'::jsonb);
  elsif action='confirm' then
    if player=any(confirmed) then raise exception 'go already confirmed'; end if;
    confirmed:=array_append(confirmed,player); state:=state||jsonb_build_object('confirmed',to_jsonb(confirmed));
    if cardinality(confirmed)=2 then
      result:=public.go_score(board,dead);
      state:=state||jsonb_build_object('phase','finished','score',result,'winner',case when (result->>'black')::numeric>(result->>'white')::numeric then 1 else 2 end,'reason','score');
    end if;
    return state;
  elsif action='resume' then return state||jsonb_build_object('phase','playing','passes',0,'dead','[]'::jsonb,'confirmed','[]'::jsonb);
  else raise exception 'invalid game action'; end if;
end $$;

create table public.go_rooms (
  id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z0-9]{8}$'),
  creator_id uuid not null references auth.users(id) on delete cascade,
  black_player_id uuid references auth.users(id) on delete cascade,white_player_id uuid references auth.users(id) on delete cascade,
  black_name text,white_name text,status text not null default 'waiting' check(status in ('waiting','playing','scoring','finished')),
  state jsonb not null default public.go_initial(),updated_at timestamptz not null default now(),
  check(black_player_id is distinct from white_player_id or black_player_id is null),
  check(status='waiting' or status=state->>'phase')
);
create table public.go_room_members (
  room_id uuid not null references public.go_rooms(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '棋友' check(char_length(trim(nickname)) between 1 and 12),primary key(room_id,user_id)
);
alter table public.go_rooms enable row level security;
alter table public.go_room_members enable row level security;
create policy "read own go membership" on public.go_room_members for select to authenticated using(user_id=auth.uid());
create policy "members read go rooms" on public.go_rooms for select to authenticated using(
  exists(select 1 from public.go_room_members m where m.room_id=id and m.user_id=auth.uid())
);
revoke all on public.go_rooms,public.go_room_members from public,anon,authenticated;
grant select on public.go_rooms,public.go_room_members to authenticated;
create function public.create_go_lobby() returns table(room_id uuid,room_code text) language plpgsql security definer set search_path=public as $$
declare room public.go_rooms;
begin
  if auth.uid() is null then raise exception 'sign in before creating a room'; end if;
  insert into public.go_rooms(code,creator_id) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid()) returning * into room;
  insert into public.go_room_members(room_id,user_id) values(room.id,auth.uid());
  return query select room.id,room.code;
end $$;
create function public.enter_go_lobby(invite_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in before joining a room'; end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then raise exception 'room is unavailable'; end if;
  select id into target from public.go_rooms where code=upper(trim(invite_code));
  if not found then raise exception 'room is unavailable'; end if;
  insert into public.go_room_members(room_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end $$;
create function public.go_lobby_action(target_room_id uuid,action text,seat text default null,nickname text default null) returns void
language plpgsql security definer set search_path=public as $$
declare room public.go_rooms; display_name text;
begin
  select * into room from public.go_rooms where id=target_room_id for update;
  if not found or auth.uid() is null then raise exception 'room is unavailable'; end if;
  select m.nickname into display_name from public.go_room_members m where m.room_id=target_room_id and m.user_id=auth.uid();
  if not found then raise exception 'room is unavailable'; end if;
  if action='name' then
    if nickname is null or char_length(trim(nickname)) not between 1 and 12 then raise exception 'invalid nickname'; end if;
    display_name:=trim(nickname); update public.go_room_members set nickname=display_name where room_id=target_room_id and user_id=auth.uid();
    if room.black_player_id=auth.uid() then room.black_name:=display_name; end if;
    if room.white_player_id=auth.uid() then room.white_name:=display_name; end if;
  elsif action='reset' then
    if room.creator_id<>auth.uid() then raise exception 'only host can start'; end if;
    if room.status<>'finished' then raise exception 'not playable'; end if;
    room.status:='waiting'; room.state:=public.go_initial()||jsonb_build_object('version',(room.state->>'version')::integer+1);
  else
    if room.status<>'waiting' then raise exception 'lobby already started'; end if;
    if action='seat' then
      if seat is null or seat not in ('black','white') then raise exception 'invalid seat'; end if;
      if seat='black' then
        if room.black_player_id is not null and room.black_player_id<>auth.uid() then raise exception 'seat is occupied'; end if;
        if room.white_player_id=auth.uid() then raise exception 'leave your seat first'; end if;
        room.black_player_id:=auth.uid(); room.black_name:=display_name;
      else
        if room.white_player_id is not null and room.white_player_id<>auth.uid() then raise exception 'seat is occupied'; end if;
        if room.black_player_id=auth.uid() then raise exception 'leave your seat first'; end if;
        room.white_player_id:=auth.uid(); room.white_name:=display_name;
      end if;
    elsif action='leave' then
      if room.black_player_id=auth.uid() then room.black_player_id:=null;room.black_name:=null;end if;
      if room.white_player_id=auth.uid() then room.white_player_id:=null;room.white_name:=null;end if;
    elsif action='start' then
      if room.creator_id<>auth.uid() then raise exception 'only host can start'; end if;
      if room.black_player_id is null or room.white_player_id is null then raise exception 'both seats are required'; end if;
      room.status:='playing';room.state:=public.go_initial()||jsonb_build_object('version',(room.state->>'version')::integer+1);
    else raise exception 'invalid lobby action'; end if;
  end if;
  update public.go_rooms set black_player_id=room.black_player_id,white_player_id=room.white_player_id,black_name=room.black_name,
    white_name=room.white_name,status=room.status,state=room.state,updated_at=now() where id=target_room_id;
end $$;
create function public.get_go_snapshot(target_room_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('room',to_jsonb(r),'nickname',(select m.nickname from public.go_room_members m where m.room_id=r.id and m.user_id=auth.uid()))
    from public.go_rooms r where r.id=target_room_id;
$$;
create function public.go_game_action(target_room_id uuid,action text,expected_version integer,move_index integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare room public.go_rooms; player integer;
begin
  select * into room from public.go_rooms where id=target_room_id for update;
  if not found or auth.uid() is null then raise exception 'room is unavailable'; end if;
  if auth.uid()=room.black_player_id then player:=1; elsif auth.uid()=room.white_player_id then player:=2; else raise exception 'go spectator'; end if;
  if room.status='waiting' then raise exception 'not playable'; end if;
  if expected_version is null or expected_version<>(room.state->>'version')::integer then raise exception 'stale game'; end if;
  room.state:=public.go_apply(room.state,action,player,move_index);
  update public.go_rooms set state=room.state,status=room.state->>'phase',updated_at=now() where id=target_room_id;
end $$;
revoke all on function public.go_initial(),public.go_neighbors(integer),public.go_group(integer[],integer),public.go_score(integer[],integer[]),public.go_apply(jsonb,text,integer,integer),public.create_go_lobby(),public.enter_go_lobby(text),public.go_lobby_action(uuid,text,text,text),public.get_go_snapshot(uuid),public.go_game_action(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_go_lobby(),public.enter_go_lobby(text),public.go_lobby_action(uuid,text,text,text),public.get_go_snapshot(uuid),public.go_game_action(uuid,text,integer,integer) to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='go_rooms') then alter publication supabase_realtime add table public.go_rooms; end if;
end $$;
commit;
