-- Only public room state enters Realtime. Words, roles and pending ballots stay private.
begin;
create table public.undercover_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[A-Z0-9]{8}$'),
  creator_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[null,null,null,null,null,null,null,null]' check(jsonb_array_length(players)=8),
  status text not null default 'waiting' check(status in ('waiting','speaking','voting','finished')),
  round_number integer not null default 1, current_turn integer check(current_turn between 0 and 7),
  alive integer[] not null default '{}', spoken integer[] not null default '{}',
  speeches jsonb not null default '[]', voted integer[] not null default '{}', vote_candidates integer[] not null default '{}',
  ballot_id integer not null default 0, revotes integer not null default 0,
  last_vote jsonb, eliminated jsonb not null default '[]',
  winner text check(winner in ('civilian','undercover')), result jsonb,
  game_number integer not null default 0, version integer not null default 0, updated_at timestamptz not null default now()
);
create table public.undercover_room_members (
  room_id uuid not null references public.undercover_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '玩家' check(char_length(trim(nickname)) between 1 and 12),
  primary key(room_id,user_id)
);
create table public.undercover_secrets (
  room_id uuid primary key references public.undercover_rooms(id) on delete cascade,
  assignments jsonb not null, ballots jsonb not null default '{}'
);
alter table public.undercover_rooms enable row level security;
alter table public.undercover_room_members enable row level security;
alter table public.undercover_secrets enable row level security;
create policy "read own undercover membership" on public.undercover_room_members for select to authenticated using(user_id=auth.uid());
create policy "members read public undercover rooms" on public.undercover_rooms for select to authenticated using(
  exists(select 1 from public.undercover_room_members m where m.room_id=id and m.user_id=auth.uid())
);
revoke all on public.undercover_rooms,public.undercover_room_members,public.undercover_secrets from public,anon,authenticated;
grant select on public.undercover_rooms,public.undercover_room_members to authenticated;

create function public.undercover_deal(target_room_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare room public.undercover_rooms; seats integer[]; shuffled integer[]; spies integer[]; pair jsonb; bank jsonb;
  assignments jsonb := '[null,null,null,null,null,null,null,null]'; s integer; orientation integer;
begin
  select * into room from public.undercover_rooms where id=target_room_id;
  select array_agg(i order by i),array_agg(i order by gen_random_uuid()) into seats,shuffled
    from generate_series(0,7) i where room.players->i->>'id' is not null;
  if coalesce(cardinality(seats),0)<4 then raise exception 'four players are required'; end if;
  spies := shuffled[1:case when cardinality(seats)>=7 then 2 else 1 end];
  bank := '[["苹果","梨"],["牛奶","豆浆"],["咖啡","奶茶"],["可乐","雪碧"],["饺子","馄饨"],["包子","馒头"],["面条","米粉"],["火锅","麻辣烫"],["蛋糕","面包"],["西瓜","哈密瓜"],["薯片","薯条"],["冰淇淋","冰棍"],["猫","狗"],["老虎","狮子"],["企鹅","鸭子"],["蝴蝶","蜜蜂"],["吉他","小提琴"],["钢琴","电子琴"],["篮球","足球"],["乒乓球","羽毛球"],["自行车","电动车"],["火车","地铁"],["飞机","直升机"],["书包","行李箱"],["雨伞","雨衣"],["眼镜","墨镜"],["毛衣","卫衣"],["牙膏","洗面奶"],["电风扇","空调"],["冰箱","冰柜"],["手机","平板"],["沙发","椅子"]]';
  pair := bank->(get_byte(decode(substr(replace(gen_random_uuid()::text,'-',''),1,2),'hex'),0)%jsonb_array_length(bank));
  orientation := get_byte(decode(substr(replace(gen_random_uuid()::text,'-',''),1,2),'hex'),0)%2;
  foreach s in array seats loop
    assignments := jsonb_set(assignments,array[s::text],jsonb_build_object('word',pair->>(case when s=any(spies) then 1-orientation else orientation end),'role',case when s=any(spies) then 'undercover' else 'civilian' end));
  end loop;
  insert into public.undercover_secrets(room_id,assignments) values(target_room_id,assignments)
    on conflict(room_id) do update set assignments=excluded.assignments,ballots='{}';
  update public.undercover_rooms set status='speaking',alive=seats,current_turn=seats[1],round_number=1,
    spoken='{}',speeches='[]',voted='{}',vote_candidates=seats,ballot_id=ballot_id+1,revotes=0,last_vote=null,
    eliminated='[]',winner=null,result=null,game_number=game_number+1,version=version+1,updated_at=now() where id=target_room_id;
end $$;

create function public.create_undercover_lobby() returns table(room_id uuid,room_code text)
language plpgsql security definer set search_path=public as $$
declare room public.undercover_rooms;
begin
  if auth.uid() is null then raise exception 'sign in before creating a room'; end if;
  insert into public.undercover_rooms(code,creator_id) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid()) returning * into room;
  insert into public.undercover_room_members(room_id,user_id) values(room.id,auth.uid());
  return query select room.id,room.code;
end $$;

create function public.enter_undercover_lobby(invite_code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'sign in before joining a room'; end if;
  if invite_code is null or upper(trim(invite_code)) !~ '^[A-Z0-9]{8}$' then raise exception 'room is unavailable'; end if;
  select id into target from public.undercover_rooms where code=upper(trim(invite_code));
  if not found then raise exception 'room is unavailable'; end if;
  insert into public.undercover_room_members(room_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end $$;

create function public.undercover_lobby_action(target_room_id uuid,action text,seat text default null,nickname text default null) returns void
language plpgsql security definer set search_path=public as $$
declare room public.undercover_rooms; selected integer; own_seat integer; display_name text;
begin
  select * into room from public.undercover_rooms where id=target_room_id for update;
  if not found or auth.uid() is null then raise exception 'room is unavailable'; end if;
  select m.nickname into display_name from public.undercover_room_members m where m.room_id=target_room_id and m.user_id=auth.uid();
  if not found then raise exception 'room is unavailable'; end if;
  select i into own_seat from generate_series(0,7) i where room.players->i->>'id'=auth.uid()::text;
  if action='name' then
    if nickname is null or char_length(trim(nickname)) not between 1 and 12 then raise exception 'invalid nickname'; end if;
    display_name := trim(nickname);
    update public.undercover_room_members set nickname=display_name where room_id=target_room_id and user_id=auth.uid();
    if own_seat is not null then room.players := jsonb_set(room.players,array[own_seat::text,'name'],to_jsonb(display_name)); end if;
  elsif action='reset' then
    if room.creator_id<>auth.uid() then raise exception 'only host can start'; end if;
    if room.status<>'finished' then raise exception 'not playable'; end if;
    delete from public.undercover_secrets where room_id=target_room_id;
    room.status:='waiting'; room.alive:='{}'; room.current_turn:=null; room.round_number:=1;
    room.spoken:='{}'; room.speeches:='[]'; room.voted:='{}'; room.vote_candidates:='{}';
    room.ballot_id:=room.ballot_id+1; room.revotes:=0; room.last_vote:=null; room.eliminated:='[]'; room.winner:=null; room.result:=null;
  else
    if room.status<>'waiting' then raise exception 'lobby already started'; end if;
    if action='seat' then
      if seat is null or seat !~ '^seat[0-7]$' then raise exception 'invalid seat'; end if;
      selected := right(seat,1)::integer;
      if room.players->selected->>'id' is not null and room.players->selected->>'id'<>auth.uid()::text then raise exception 'seat is occupied'; end if;
      if own_seat is not null and own_seat<>selected then raise exception 'leave your seat first'; end if;
      room.players:=jsonb_set(room.players,array[selected::text],jsonb_build_object('id',auth.uid(),'name',display_name));
    elsif action='leave' then
      if own_seat is not null then room.players:=jsonb_set(room.players,array[own_seat::text],'null'); end if;
    elsif action='start' then
      if room.creator_id<>auth.uid() then raise exception 'only host can start'; end if;
      perform public.undercover_deal(target_room_id); return;
    else raise exception 'invalid lobby action'; end if;
  end if;
  update public.undercover_rooms set players=room.players,status=room.status,alive=room.alive,current_turn=room.current_turn,
    round_number=room.round_number,spoken=room.spoken,speeches=room.speeches,voted=room.voted,vote_candidates=room.vote_candidates,
    ballot_id=room.ballot_id,revotes=room.revotes,last_vote=room.last_vote,eliminated=room.eliminated,winner=room.winner,result=room.result,
    version=version+1,updated_at=now() where id=target_room_id;
end $$;

create function public.get_undercover_snapshot(target_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare room public.undercover_rooms; own_seat integer; s integer; public_room jsonb; own_word text; own_vote integer; display_name text;
begin
  if auth.uid() is null then return null; end if;
  select m.nickname into display_name from public.undercover_room_members m where m.room_id=target_room_id and m.user_id=auth.uid();
  if not found then return null; end if;
  select * into room from public.undercover_rooms where id=target_room_id;
  if not found then return null; end if;
  public_room:=to_jsonb(room);
  for s in 0..7 loop
    public_room:=public_room||jsonb_build_object('seat'||s||'_player_id',room.players->s->>'id','seat'||s||'_name',room.players->s->>'name');
    if room.players->s->>'id'=auth.uid()::text then own_seat:=s; end if;
  end loop;
  if own_seat is not null then
    select assignments->own_seat->>'word',(ballots->>own_seat::text)::integer into own_word,own_vote from public.undercover_secrets where room_id=target_room_id;
  end if;
  return jsonb_build_object('room',public_room,'word',own_word,'my_vote',own_vote,'nickname',display_name);
end $$;

create function public.undercover_game_action(target_room_id uuid,action text,expected_version integer,description text default null,target_seat integer default null,expected_ballot integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare room public.undercover_rooms; secret public.undercover_secrets; own_seat integer; s integer; n integer; max_votes integer:=-1;
  counts jsonb:='{}'; tied integer[]:='{}'; eliminated_seat integer; spy_count integer;
begin
  select * into room from public.undercover_rooms where id=target_room_id for update;
  if not found or auth.uid() is null or not exists(select 1 from public.undercover_room_members where room_id=target_room_id and user_id=auth.uid()) then raise exception 'room is unavailable'; end if;
  select i into own_seat from generate_series(0,7) i where room.players->i->>'id'=auth.uid()::text;
  select * into secret from public.undercover_secrets where room_id=target_room_id;
  if action in ('speak','skip') then
    if room.status<>'speaking' or (own_seat is distinct from room.current_turn and not (action='skip' and room.creator_id=auth.uid())) then raise exception 'not your turn'; end if;
    if expected_version is null or expected_version<>room.version then raise exception 'stale game'; end if;
    if action='speak' then
      if description is null or char_length(trim(description)) not between 1 and 120 then raise exception 'invalid description'; end if;
      if strpos(description,secret.assignments->own_seat->>'word')>0 then raise exception 'word in description'; end if;
    end if;
    room.speeches:=room.speeches||jsonb_build_array(jsonb_build_object('seat',room.current_turn,'round',room.round_number,'text',case when action='skip' then '（跳过发言）' else trim(description) end));
    room.spoken:=array_append(room.spoken,room.current_turn);
    select min(i) into room.current_turn from unnest(room.alive) i where not i=any(room.spoken);
    if room.current_turn is null then
      room.status:='voting'; room.vote_candidates:=room.alive; room.voted:='{}'; room.ballot_id:=room.ballot_id+1; room.revotes:=0; secret.ballots:='{}';
    end if;
  elsif action='vote' then
    -- Concurrent voters share a ballot token, rather than invalidating each other on every room update.
    if expected_ballot is null or expected_ballot<>room.ballot_id then raise exception 'stale ballot'; end if;
    if room.status<>'voting' or own_seat is null or not own_seat=any(room.alive) or target_seat is null or target_seat=own_seat or not target_seat=any(room.vote_candidates) then raise exception 'invalid vote'; end if;
    if own_seat=any(room.voted) then raise exception 'already voted'; end if;
    secret.ballots:=secret.ballots||jsonb_build_object(own_seat::text,target_seat); room.voted:=array_append(room.voted,own_seat);
    if cardinality(room.voted)=cardinality(room.alive) then
      foreach s in array room.vote_candidates loop
        select count(*) into n from jsonb_each_text(secret.ballots) b where b.value::integer=s;
        counts:=counts||jsonb_build_object(s::text,n);
        if n>max_votes then max_votes:=n; tied:=array[s]; elsif n=max_votes then tied:=array_append(tied,s); end if;
      end loop;
      room.last_vote:=jsonb_build_object('round',room.round_number,'counts',counts,'tied',cardinality(tied)>1,'eliminated',null);
      secret.ballots:='{}'; room.voted:='{}';
      if cardinality(tied)>1 and room.revotes=0 then
        room.vote_candidates:=tied; room.revotes:=1; room.ballot_id:=room.ballot_id+1;
      else
        if cardinality(tied)=1 then
          eliminated_seat:=tied[1]; room.alive:=array_remove(room.alive,eliminated_seat);
          room.eliminated:=room.eliminated||jsonb_build_array(jsonb_build_object('seat',eliminated_seat,'role',secret.assignments->eliminated_seat->>'role'));
          room.last_vote:=room.last_vote||jsonb_build_object('eliminated',eliminated_seat);
          select count(*) into spy_count from unnest(room.alive) i where secret.assignments->i->>'role'='undercover';
          if spy_count=0 then room.winner:='civilian'; elsif cardinality(room.alive)<=3 then room.winner:='undercover'; end if;
        end if;
        if room.winner is not null then room.status:='finished'; room.current_turn:=null; room.result:=secret.assignments;
        else room.status:='speaking'; room.round_number:=room.round_number+1; room.current_turn:=room.alive[1]; room.spoken:='{}'; room.revotes:=0; room.vote_candidates:=room.alive; end if;
      end if;
    end if;
  else raise exception 'invalid game action'; end if;
  update public.undercover_secrets set ballots=secret.ballots where room_id=target_room_id;
  update public.undercover_rooms set status=room.status,current_turn=room.current_turn,alive=room.alive,round_number=room.round_number,
    spoken=room.spoken,speeches=room.speeches,voted=room.voted,vote_candidates=room.vote_candidates,ballot_id=room.ballot_id,revotes=room.revotes,
    last_vote=room.last_vote,eliminated=room.eliminated,winner=room.winner,result=room.result,version=version+1,updated_at=now() where id=target_room_id;
end $$;

revoke all on function public.undercover_deal(uuid),public.create_undercover_lobby(),public.enter_undercover_lobby(text),public.undercover_lobby_action(uuid,text,text,text),public.get_undercover_snapshot(uuid),public.undercover_game_action(uuid,text,integer,text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_undercover_lobby(),public.enter_undercover_lobby(text),public.undercover_lobby_action(uuid,text,text,text),public.get_undercover_snapshot(uuid),public.undercover_game_action(uuid,text,integer,text,integer,integer) to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='undercover_rooms') then
    alter publication supabase_realtime add table public.undercover_rooms;
  end if;
end $$;
commit;
