import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { classify, findPlays, rank } from '../src/games/doudizhu/doudizhu.js'
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])))
const db = new PGlite()
const ids = ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555']
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to authenticated,anon;
    alter default privileges in schema public grant execute on functions to authenticated,anon;`)
  for (const id of ids) await db.query('insert into auth.users values($1)', [id])
  await db.exec(await readFile(new URL('../supabase/migrations/20261002000000_doudizhu.sql', import.meta.url), 'utf8'))
  const user = (id, sql, args = []) => db.transaction(async tx => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id])
    return (await tx.query(sql,args)).rows
  })
  const entry = (await user(ids[0], 'select * from create_doudizhu_lobby()'))[0]
  const snap = async id => (await user(id, 'select get_doudizhu_snapshot($1) as data', [entry.room_id]))[0].data
  const lobby = (id, command, seat = null, name = null) => user(id, 'select doudizhu_lobby_action($1,$2,$3,$4)', [entry.room_id,command,seat,name])
  const act = (id, command, version, value = null, cards = []) => user(id,'select doudizhu_game_action($1,$2,$3,$4,$5)',[entry.room_id,command,version,value,cards])
  assert.equal(await snap(ids[4]), null)
  assert.equal((await user(ids[4], 'select * from doudizhu_rooms')).length, 0)
  await assert.rejects(lobby(ids[4], 'seat', 'seat0'), /unavailable/)
  for (const id of ids.slice(1,4)) await user(id, 'select enter_doudizhu_lobby($1)', [entry.room_code])
  await lobby(ids[0], 'name', null, '房主')
  await assert.rejects(lobby(ids[0], 'name', null, ' '), /invalid nickname/)
  await lobby(ids[0], 'seat','seat0')
  await assert.rejects(lobby(ids[1], 'seat','seat0'), /occupied/)
  await assert.rejects(lobby(ids[0], 'seat','seat1'), /leave your seat/)
  await assert.rejects(lobby(ids[0], 'start'), /three seats/)
  await lobby(ids[1], 'seat','seat1'); await lobby(ids[2], 'seat','seat2')
  await assert.rejects(lobby(ids[1], 'start'), /only host/)
  await lobby(ids[0], 'start')
  await assert.rejects(lobby(ids[0], 'leave'), /already started/)
  let state = await snap(ids[0])
  assert.equal(state.room.status, 'bidding'); assert.equal(state.room.bottom, null)
  assert.equal(state.room.seat0_name, '房主')
  const all = await Promise.all(ids.slice(0,4).map(snap))
  assert.deepEqual(all.map(s => s.hand.length), [17,17,17,0])
  assert.equal(new Set(all.flatMap(s => s.hand)).size, 51)
  assert.ok(!Object.hasOwn(state.room, 'hands'))
  await assert.rejects(user(ids[0], 'select * from doudizhu_deals'), /permission denied/)
  await assert.rejects(user(ids[0], 'select doudizhu_deal($1)', [entry.room_id]), /permission denied/)
  await assert.rejects(user(ids[0], "update doudizhu_rooms set status='playing' where id=$1", [entry.room_id]), /permission denied/)
  await assert.rejects(act(ids[3], 'bid', state.room.version, 3), /not your turn/)
  await assert.rejects(act(ids[state.room.current_turn], 'bid', -1, 3), /stale/)
  // Everyone passing triggers a fresh private deal and a fresh version.
  for (let i = 0; i < 3; i++) { state = await snap(ids[0]); await act(ids[state.room.current_turn], 'bid', state.room.version, 0) }
  state = await snap(ids[0]); assert.equal(state.room.status, 'bidding'); assert.ok(state.room.bids.every(b => b === null))
  const landlord = state.room.current_turn
  await act(ids[landlord], 'bid', state.room.version, 3)
  state = await snap(ids[landlord]); assert.equal(state.room.status, 'playing'); assert.equal(state.hand.length, 20)
  assert.equal(state.room.bottom.length, 3)
  await assert.rejects(act(ids[landlord], 'play', state.room.version, null, []), /cannot pass/)
  const other = await snap(ids[(landlord+1)%3])
  await assert.rejects(act(ids[landlord], 'play', state.room.version, null, [other.hand[0]]), /not owned/)
  await assert.rejects(act(ids[landlord], 'play', state.room.version, null, [state.hand[0],state.hand[0]]), /invalid combination/)
  await act(ids[landlord], 'play', state.room.version, null, [state.hand.find(c => rank(c) < 15) || state.hand[0]])
  for (let i = 0; i < 2; i++) { state = await snap(ids[0]); await act(ids[state.room.current_turn], 'play', state.room.version, null, []) }
  state = await snap(ids[0]); assert.equal(state.room.current_turn, landlord); assert.equal(state.room.last_play, null)
  let steps = 0
  while (state.room.status === 'playing' && steps++ < 500) {
    const turn = state.room.current_turn
    const own = await snap(ids[turn])
    const choice = findPlays(own.hand, own.room.last_play?.shape)[0]
    await act(ids[turn], 'play', own.room.version, null, choice?.cards || [])
    state = await snap(ids[0])
  }
  assert.equal(state.room.status, 'finished'); assert.ok(state.room.remaining.includes(0))
  await assert.rejects(lobby(ids[1], 'restart'), /only host/)
  await lobby(ids[0], 'restart'); assert.equal((await snap(ids[0])).room.status, 'bidding')
  assert.equal((await snap(ids[3])).hand.length, 0)
  await db.query("update doudizhu_rooms set status='playing',landlord=0,current_turn=0,remaining=array[1,2,2],play_counts=array[0,0,0],multiplier=1 where id=$1",[entry.room_id])
  await db.query("update doudizhu_deals set hands='[[0],[8,9],[12,13]]'::jsonb where room_id=$1",[entry.room_id])
  state=await snap(ids[0]); await act(ids[0],'play',state.room.version,null,[0])
  state=await snap(ids[0]); assert.equal(state.room.spring,true); assert.equal(state.room.multiplier,2)
  await db.query("update doudizhu_rooms set status='playing',winner=null,spring=false,landlord=0,current_turn=1,remaining=array[2,1,2],play_counts=array[1,0,0],last_play=null,multiplier=3 where id=$1",[entry.room_id])
  await db.query("update doudizhu_deals set hands='[[0,1],[8],[12,13]]'::jsonb where room_id=$1",[entry.room_id])
  state=await snap(ids[1]); await act(ids[1],'play',state.room.version,null,[8])
  state=await snap(ids[0]); assert.equal(state.room.winner,'farmers'); assert.equal(state.room.spring,true); assert.equal(state.room.multiplier,6)
  const secrets = await db.query(`select tablename from pg_publication_tables where pubname='supabase_realtime'`)
  assert.deepEqual(secrets.rows.map(r => r.tablename), ['doudizhu_rooms'])
  const permissions = await db.query(`select proname,has_function_privilege('anon',oid,'execute') as allowed from pg_proc where proname like '%doudizhu%'`)
  assert.ok(permissions.rows.every(p => !p.allowed))
  // Cross-check independent JS and SQL classifiers using valid combinations and randomized subsets.
  let seed = 18426
  const rand = () => { seed = (seed*1664525+1013904223)>>>0; return seed/2**32 }
  const combinations = []
  for (let i = 0; i < 120; i++) {
    const deck = Array.from({length:54},(_,i)=>i).sort(()=>rand()-.5)
    combinations.push(deck.slice(0,1+Math.floor(rand()*20)))
    combinations.push(...findPlays(deck.slice(0,20)).map(p=>p.cards))
  }
  for (const cards of combinations) assert.deepEqual((await db.query('select doudizhu_shape($1) as shape',[cards])).rows[0].shape,classify(cards),`classifier disagreement: ${cards}`)
  console.log(`PASS: private hands and bottom, spectator isolation, RLS, host start, bidding/redeal, ownership, stale turns, full game/restart; ${combinations.length} JS/SQL combination comparisons.`)
} finally { await db.close() }
