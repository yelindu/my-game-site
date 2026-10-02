import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {apply,createGame,score} from '../src/games/go/go.js'
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])))
const db=new PGlite(),ids=['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444']
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to authenticated,anon;
    alter default privileges in schema public grant execute on functions to authenticated,anon;`)
  for(const id of ids) await db.query('insert into auth.users values($1)',[id])
  await db.exec(await readFile(new URL('../supabase/migrations/20261002020000_go.sql',import.meta.url),'utf8'))
  const user=(id,sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return (await tx.query(sql,args)).rows})
  const entry=(await user(ids[0],'select * from create_go_lobby()'))[0]
  const snap=async id=>(await user(id,'select get_go_snapshot($1) as data',[entry.room_id]))[0].data
  const lobby=(id,action,seat=null,name=null)=>user(id,'select go_lobby_action($1,$2,$3,$4)',[entry.room_id,action,seat,name])
  const act=(id,action,state,p=null)=>user(id,'select go_game_action($1,$2,$3,$4)',[entry.room_id,action,state.version,p])
  assert.equal(await snap(ids[3]),null);assert.equal((await user(ids[3],'select * from go_rooms')).length,0)
  for(const id of ids.slice(1,3)) await user(id,'select enter_go_lobby($1)',[entry.room_code])
  await lobby(ids[0],'seat','black');await assert.rejects(lobby(ids[1],'seat','black'),/occupied/)
  await assert.rejects(lobby(ids[0],'seat','white'),/leave your seat/);await assert.rejects(lobby(ids[0],'start'),/both seats/)
  await lobby(ids[1],'seat','white');await assert.rejects(lobby(ids[1],'start'),/only host/)
  await lobby(ids[0],'name',null,'围棋房主');await lobby(ids[0],'start')
  let state=(await snap(ids[0])).room.state
  await assert.rejects(act(ids[2],'place',state,0),/spectator/);await assert.rejects(act(ids[1],'place',state,0),/not your turn/)
  await assert.rejects(user(ids[0],"update go_rooms set status='finished' where id=$1",[entry.room_id]),/permission denied/)
  await assert.rejects(user(ids[0],"select go_apply($1,'pass',1,null)",[state]),/permission denied/)
  const sequence=[['place',1,0],['place',2,1],['place',1,9],['pass',2,null],['place',1,2],['place',2,80],['pass',1,null],['pass',2,null],['mark',1,0],['confirm',1,null],['mark',2,9],['confirm',2,null],['resume',1,null],['pass',1,null],['pass',2,null],['confirm',1,null],['confirm',2,null]]
  for(const [action,player,p] of sequence) {
    const expected=apply(state,action,player,p)
    await act(ids[player-1],action,state,p)
    const next=(await snap(ids[2])).room.state
    assert.deepEqual(next,expected,`JS/SQL mismatch: ${action}`)
    if(action==='place') await assert.rejects(act(ids[player-1],action,state,p),/stale/)
    state=next
  }
  assert.equal(state.phase,'finished');await assert.rejects(lobby(ids[1],'reset'),/only host/)
  const version=state.version;await lobby(ids[0],'reset');state=(await snap(ids[0])).room.state
  assert.equal((await snap(ids[0])).room.status,'waiting');assert.ok(state.version>version);assert.equal(state.board.filter(Boolean).length,0)
  await lobby(ids[0],'start');state=(await snap(ids[0])).room.state;await act(ids[1],'resign',state)
  assert.equal((await snap(ids[0])).room.state.winner,1)
  // Independent fixtures and randomized legal play cross-check the two rule engines, including rejected moves.
  const fixture=(black,white)=>{const g=createGame();black.forEach(p=>g.board[p]=1);white.forEach(p=>g.board[p]=2);g.positions=[g.board.join('')];return g}
  const check=async(g,action,player,p)=>{
    let expected
    try {expected=apply(g,action,player,p)} catch {await assert.rejects(db.query('select go_apply($1,$2,$3,$4)',[g,action,player,p]));return null}
    const actual=(await db.query('select go_apply($1,$2,$3,$4) as game',[g,action,player,p])).rows[0].game
    assert.deepEqual(actual,expected);return expected
  }
  const ko=await check(fixture([31,39,49],[40,32,42,50]),'place',1,41)
  await check(ko,'place',2,40);await check(fixture([],[31,39,41,49]),'place',1,40)
  await check(fixture([1,2,9,12,18,28],[10,11,19]),'place',1,20)
  await check(fixture([22,30,32,38,48,42,50,58],[31,39,41,49]),'place',1,40)
  const walls=fixture(Array.from({length:9},(_,i)=>i*9+3),[...Array.from({length:9},(_,i)=>i*9+5),10])
  assert.deepEqual((await db.query('select go_score($1,$2) as score',[walls.board,[10]])).rows[0].score,score(walls.board,[10]))
  let seed=7123, comparisons=0
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
  for(let trial=0;trial<4;trial++) {
    let g=createGame()
    for(let step=0;step<100;step++) {const next=await check(g,'place',g.turn,Math.floor(rand()*81));if(next)g=next;comparisons++}
    const actual=(await db.query('select go_score($1,$2) as score',[g.board,[]])).rows[0].score
    assert.deepEqual(actual,score(g.board))
  }
  assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(r=>r.tablename),['go_rooms'])
  assert.ok((await db.query("select has_function_privilege('anon',oid,'execute') as allowed from pg_proc where proname like 'go_%' or proname in ('create_go_lobby','enter_go_lobby','get_go_snapshot')")).rows.every(r=>!r.allowed))
  console.log(`PASS: RLS, lobby ownership, two players and spectator, stale moves, agreed scoring, reset/resign, capture/suicide/ko and ${comparisons} randomized JS/SQL move comparisons.`)
} catch(error) {console.error({message:error.message,where:error.where,position:error.position,actual:error.actual,expected:error.expected});process.exitCode=1} finally {await db.close()}
