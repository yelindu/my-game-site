import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { PGlite }=await import(pathToFileURL(resolve(process.argv[2])))
const db=new PGlite()
const ids=Array.from({length:10},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-1111-1111-111111111111`)
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to authenticated,anon;
    alter default privileges in schema public grant execute on functions to authenticated,anon;`)
  for(const id of ids) await db.query('insert into auth.users values($1)',[id])
  await db.exec(await readFile(new URL('../supabase/migrations/20261002010000_undercover.sql',import.meta.url),'utf8'))
  const user=(id,sql,args=[])=>db.transaction(async tx=>{
    await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id])
    return (await tx.query(sql,args)).rows
  })
  const entry=(await user(ids[0],'select * from create_undercover_lobby()'))[0]
  const snap=async id=>(await user(id,'select get_undercover_snapshot($1) as data',[entry.room_id]))[0].data
  const lobby=(id,action,seat=null,name=null)=>user(id,'select undercover_lobby_action($1,$2,$3,$4)',[entry.room_id,action,seat,name])
  const act=(id,action,state,text=null,target=null,ballot=state.ballot_id,version=state.version)=>user(id,'select undercover_game_action($1,$2,$3,$4,$5,$6)',[entry.room_id,action,version,text,target,ballot])
  assert.equal(await snap(ids[9]),null)
  assert.equal((await user(ids[9],'select * from undercover_rooms')).length,0)
  await assert.rejects(lobby(ids[9],'seat','seat0'),/unavailable/)
  await assert.rejects(lobby(ids[0],'start'),/four players/)
  for(const id of ids.slice(1,9)) await user(id,'select enter_undercover_lobby($1)',[entry.room_code])
  const seats=[0,2,4,7]
  for(let i=0;i<4;i++) await lobby(ids[i],'seat',`seat${seats[i]}`)
  await assert.rejects(lobby(ids[1],'seat','seat0'),/occupied/)
  await assert.rejects(lobby(ids[0],'seat','seat1'),/leave your seat/)
  await assert.rejects(lobby(ids[4],'seat','seat8'),/invalid seat/)
  await assert.rejects(lobby(ids[0],'name',null,' '),/invalid nickname/)
  await lobby(ids[0],'name',null,'房主'); await assert.rejects(lobby(ids[1],'start'),/only host/)
  await lobby(ids[0],'start')
  let state=(await snap(ids[0])).room
  assert.deepEqual(state.alive,seats); assert.equal(state.seat0_name,'房主'); assert.equal(state.result,null)
  const views=await Promise.all(ids.slice(0,5).map(snap))
  assert.equal(views[4].word,null); assert.equal(views[4].my_vote,null)
  assert.equal(new Set(views.slice(0,4).map(v=>v.word)).size,2)
  assert.ok(views.every(v=>!Object.hasOwn(v,'role')&&!Object.hasOwn(v.room,'assignments')&&!Object.hasOwn(v.room,'ballots')))
  await assert.rejects(user(ids[0],'select * from undercover_secrets'),/permission denied/)
  await assert.rejects(user(ids[0],'select undercover_deal($1)',[entry.room_id]),/permission denied/)
  await assert.rejects(user(ids[0],"update undercover_rooms set status='finished' where id=$1",[entry.room_id]),/permission denied/)
  await assert.rejects(lobby(ids[0],'leave'),/already started/)
  await assert.rejects(act(ids[1],'speak',state,'生活里可以见到'),/not your turn/)
  await assert.rejects(act(ids[0],'speak',state,'字'.repeat(121)),/invalid description/)
  await assert.rejects(act(ids[0],'speak',state,views[0].word),/word in description/)
  await assert.rejects(act(ids[0],'speak',state,'生活里可以见到',null,0,-1),/stale/)
  const describe=async()=>{
    let room=(await snap(ids[0])).room
    while(room.status==='speaking') {
      const index=seats.indexOf(room.current_turn)
      await act(ids[index],'speak',room,'生活里可以见到'); room=(await snap(ids[0])).room
    }
    return room
  }
  state=await describe()
  await assert.rejects(act(ids[0],'vote',state,null,0),/invalid vote/)
  await assert.rejects(act(ids[4],'vote',state,null,0),/invalid vote/)
  const before=state.ballot_id
  await act(ids[0],'vote',state,null,2)
  assert.equal((await snap(ids[0])).my_vote,2); assert.equal((await snap(ids[1])).my_vote,null)
  assert.equal((await snap(ids[4])).room.last_vote,null)
  await assert.rejects(act(ids[0],'vote',state,null,4),/already voted/)
  // All legitimate votes carry the original version; only ballot changes should invalidate them.
  for(const [i,target] of [[1,0],[2,2],[3,0]]) await act(ids[i],'vote',state,null,target)
  state=(await snap(ids[0])).room
  assert.equal(state.status,'voting'); assert.equal(state.revotes,1); assert.deepEqual(state.vote_candidates,[0,2])
  await assert.rejects(act(ids[0],'vote',state,null,2,before),/stale ballot/)
  await assert.rejects(act(ids[0],'vote',state,null,4),/invalid vote/)
  for(const [i,target] of [[0,2],[1,0],[2,2],[3,0]]) await act(ids[i],'vote',state,null,target)
  state=(await snap(ids[0])).room
  assert.equal(state.status,'speaking'); assert.equal(state.round_number,2); assert.deepEqual(state.alive,seats)
  // The host can advance a disconnected player's description, but a spectator cannot.
  await act(ids[0],'skip',state); state=(await snap(ids[0])).room
  await assert.rejects(act(ids[4],'skip',state),/not your turn/)
  await act(ids[0],'skip',state); state=await describe()
  const secret=(await db.query('select assignments from undercover_secrets where room_id=$1',[entry.room_id])).rows[0].assignments
  const spy=seats.find(s=>secret[s].role==='undercover')
  for(let i=0;i<4;i++) await act(ids[i],'vote',state,null,seats[i]===spy?seats.find(s=>s!==spy):spy)
  state=(await snap(ids[4])).room
  assert.equal(state.status,'finished'); assert.equal(state.winner,'civilian'); assert.deepEqual(state.result,secret)
  await assert.rejects(lobby(ids[1],'reset'),/only host/)
  const oldBallot=state.ballot_id
  await lobby(ids[0],'reset'); state=(await snap(ids[0])).room
  assert.equal(state.status,'waiting'); assert.equal(state.result,null); assert.ok(state.ballot_id>oldBallot)
  assert.equal((await snap(ids[0])).word,null)
  // Fill seven seats, then all eight; deal exactly two undercovers and preserve each private view.
  for(let i=4;i<7;i++) await lobby(ids[i],'seat',`seat${[1,3,5][i-4]}`)
  await lobby(ids[0],'start')
  let assignments=(await db.query('select assignments from undercover_secrets where room_id=$1',[entry.room_id])).rows[0].assignments
  assert.equal(assignments.filter(p=>p?.role==='undercover').length,2)
  // Owner-only fixture returns to waiting to test eight seats without playing another random game.
  await db.query("update undercover_rooms set status='finished' where id=$1",[entry.room_id]); await lobby(ids[0],'reset')
  await lobby(ids[7],'seat','seat6'); await lobby(ids[0],'start')
  assignments=(await db.query('select assignments from undercover_secrets where room_id=$1',[entry.room_id])).rows[0].assignments
  assert.equal(assignments.filter(p=>p.role==='undercover').length,2)
  assert.equal((await snap(ids[8])).word,null)
  const published=await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")
  assert.deepEqual(published.rows.map(r=>r.tablename),['undercover_rooms'])
  const permissions=await db.query("select proname,has_function_privilege('anon',oid,'execute') as allowed from pg_proc where proname like '%undercover%'")
  assert.ok(permissions.rows.every(p=>!p.allowed))
  console.log('PASS: 4–8 seats with holes, host permissions, private words/roles/ballots, RLS and Realtime isolation, descriptions, stale/repeated votes, tie/revote, winner, reset and monotonic ballots.')
} finally { await db.close() }
